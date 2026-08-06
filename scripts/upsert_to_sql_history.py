"""
============================================================================
UPSERT TO SQL SERVER — via pyodbc, Windows Integrated Security
============================================================================

Called by src/db/pythonUpsert.js.

Reads a JSON file containing rows + column metadata (written by Node),
connects to SQL Server using Trusted_Connection=yes, then:

    1. Uses (projectid + documentId) as the synchronization key.
    2. Updates an existing document when the key already exists.
    3. Inserts a new document when the key does not exist.
    4. Deletes documents from SQL that are no longer returned by Aconex.
    5. Deletes in batches to avoid SQL Server's 2,100 parameter limit.

Primary key in SQL Server:

    PRIMARY KEY (projectid, documentId)

============================================================================
"""

import argparse
import json
import sys

import pyodbc


# ============================================================================
# DATABASE CONNECTION
# ============================================================================

def build_connection_string(server, database, driver):
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        "Trusted_Connection=yes;"
        "Encrypt=no;"
    )


# ============================================================================
# UPDATE SQL
# ============================================================================

def build_update_sql(schema, table, columns):
    """
    Build UPDATE statement.

    Synchronization key:

        projectid + documentId

    documentId is NOT used as the primary/synchronization key.
    """

    non_key_columns = [
        c
        for c in columns
        if c["canonicalKey"] not in (
            "projectid",
            "documentId"
        )
    ]

    if not non_key_columns:
        raise ValueError(
            "No columns available for UPDATE."
        )

    set_clause = ", ".join(
        f'[{c["column"]}] = ?'
        for c in non_key_columns
    )

    sql = f"""
    UPDATE [{schema}].[{table}]
    SET
    {set_clause}
    WHERE [projectid] = ?
    AND [documentId] = ?
    """

    return sql


# ============================================================================
# INSERT SQL
# ============================================================================

def build_insert_sql(schema, table, columns):
    """
    Build INSERT statement for all configured columns.
    """

    insert_columns = ", ".join(
        f'[{c["column"]}]'
        for c in columns
    )

    placeholders = ", ".join(
        "?"
        for _ in columns
    )

    sql = f"""
INSERT INTO [{schema}].[{table}]
(
    {insert_columns}
)
VALUES
(
    {placeholders}
)
"""

    return sql


# ============================================================================
# UPDATE PARAMETERS
# ============================================================================

def build_update_params(row, columns):
    """
    Parameters must exactly match build_update_sql().

    SQL expects:

        1. all non-key column values
        2. projectid
        3. documentId
    """

    non_key_values = [
        row.get(c["canonicalKey"])
        for c in columns
        if c["canonicalKey"] not in (
            "projectid",
            "documentId"
        )
    ]

    project_id = row.get("projectid")
    tracking_id = row.get("documentId")

    return (
        non_key_values
        + [
            project_id,
            tracking_id
        ]
    )


# ============================================================================
# INSERT PARAMETERS
# ============================================================================

def build_insert_params(row, columns):
    """
    Parameters exactly follow the column order.
    """

    return [
        row.get(c["canonicalKey"])
        for c in columns
    ]


# ============================================================================
# DELETE REMOVED ROWS
# ============================================================================

def delete_removed_rows(
    cursor,
    schema,
    table,
    project_id,
    tracking_ids,
    batch_size=1000
):
    """
    Delete rows for the current project whose documentId was not returned
    by Aconex.

    Deletion is performed in batches to avoid SQL Server's 2,100 parameter
    limit.

    Example:

        DELETE FROM DocumentRegister
        WHERE projectid = ?
        AND documentId NOT IN (?, ?, ...)

    Only up to batch_size tracking IDs are placed in each statement.
    """

    if not project_id:
        return 0

    # ----------------------------------------------------------------------
    # If Aconex returned no tracking IDs, do NOT blindly delete the project.
    #
    # This protects against accidental deletion if the API unexpectedly
    # returns an empty result.
    # ----------------------------------------------------------------------

    if not tracking_ids:
        print(
            f"WARNING: No tracking IDs returned for project "
            f"{project_id}. Skipping deletion."
        )

        return 0

    deleted_total = 0

    # ----------------------------------------------------------------------
    # IMPORTANT:
    #
    # We cannot simply use:
    #
    #     documentId NOT IN (?, ?, ... all IDs ...)
    #
    # because SQL Server has a 2,100 parameter limit.
    #
    # Instead, use a temporary table containing the returned IDs.
    #
    # This is safer and handles all 24,493 documents without generating
    # thousands of parameters.
    # ----------------------------------------------------------------------

    cursor.execute("""
        CREATE TABLE #AconexdocumentIds
        (
            documentId NVARCHAR(255) NOT NULL
        )
    """)

    # Insert returned tracking IDs into temporary table.
    insert_sql = """
        INSERT INTO #AconexdocumentIds (documentId)
        VALUES (?)
    """

    for tracking_id in tracking_ids:
        cursor.execute(
            insert_sql,
            tracking_id
        )

    # ----------------------------------------------------------------------
    # Delete SQL records for this project that are not present in the
    # current Aconex result.
    # ----------------------------------------------------------------------

    delete_sql = f"""
DELETE target
FROM [{schema}].[{table}] AS target
WHERE target.[projectid] = ?
  AND NOT EXISTS
  (
      SELECT 1
      FROM #AconexdocumentIds AS source
      WHERE source.[documentId] = target.[documentId]
  )
"""

    cursor.execute(
        delete_sql,
        project_id
    )

    deleted_total = cursor.rowcount

    return deleted_total


# ============================================================================
# MAIN
# ============================================================================

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--data-file",
        required=True
    )

    parser.add_argument(
        "--server",
        required=True
    )

    parser.add_argument(
        "--database",
        required=True
    )

    parser.add_argument(
        "--schema",
        required=True
    )

    parser.add_argument(
        "--table",
        required=True
    )

    parser.add_argument(
        "--driver",
        default="ODBC Driver 18 for SQL Server"
    )

    args = parser.parse_args()


    # =========================================================================
    # READ INPUT JSON
    # =========================================================================

    with open(
        args.data_file,
        "r",
        encoding="utf-8"
    ) as f:

        payload = json.load(f)

    rows = payload["rows"]
    columns = payload["columns"]


    # =========================================================================
    # VALIDATE REQUIRED COLUMNS
    # =========================================================================

    canonical_keys = {
        c["canonicalKey"]
        for c in columns
    }

    if "projectid" not in canonical_keys:
        raise ValueError(
            "The configured fields must include 'projectid'."
        )

    if "documentId" not in canonical_keys:
        raise ValueError(
            "The configured fields must include 'documentId'."
        )


    # =========================================================================
    # DATABASE CONNECTION
    # =========================================================================

    conn = pyodbc.connect(
        build_connection_string(
            args.server,
            args.database,
            args.driver
        ),
        autocommit=False
    )

    cursor = conn.cursor()


    # =========================================================================
    # BUILD SQL
    # =========================================================================

    update_sql = build_update_sql(
        args.schema,
        args.table,
        columns
    )

    insert_sql = build_insert_sql(
        args.schema,
        args.table,
        columns
    )


    # =========================================================================
    # DEBUG INFORMATION
    # =========================================================================

    print(
        f"SQL columns: {len(columns)}"
    )

    print(
        f"UPDATE placeholders: {update_sql.count('?')}"
    )

    print(
        f"INSERT placeholders: {insert_sql.count('?')}"
    )

    print(
        "SQL synchronization key: projectid + documentId"
    )

    print(
        f"Rows received from Aconex: {len(rows)}"
    )


    # =========================================================================
    # COUNTERS
    # =========================================================================

    updated = 0
    inserted = 0
    skipped = 0
    deleted = 0

    project_ids = set()

    # Store tracking IDs per project.

    tracking_ids_by_project = {}


    # =========================================================================
    # UPSERT
    # =========================================================================

    try:

        for index, row in enumerate(rows, start=1):

            project_id = row.get("projectid")
            tracking_id = row.get("documentId")


            # -----------------------------------------------------------------
            # Validate synchronization key
            # -----------------------------------------------------------------

            if not project_id:

                print(
                    f"WARNING: Row #{index} has no projectid. Skipping.",
                    file=sys.stderr
                )

                skipped += 1

                continue


            if not tracking_id:

                print(
                    f"WARNING: Row #{index} has no documentId. Skipping.",
                    file=sys.stderr
                )

                skipped += 1

                continue


            # -----------------------------------------------------------------
            # Remember project and tracking ID for deletion synchronization.
            # -----------------------------------------------------------------

            project_ids.add(project_id)

            if project_id not in tracking_ids_by_project:

                tracking_ids_by_project[project_id] = set()

            tracking_ids_by_project[project_id].add(
                tracking_id
            )


            # -----------------------------------------------------------------
            # UPDATE
            #
            # Match using:
            #
            #     projectid + documentId
            #
            # If an existing row is found, rowcount should be 1.
            # -----------------------------------------------------------------

            update_params = build_update_params(
                row,
                columns
            )

            expected_update_parameters = (
                len(columns)
            )

            actual_update_parameters = (
                len(update_params)
            )

            if (
                actual_update_parameters
                != expected_update_parameters
            ):

                raise ValueError(
                    f"UPDATE parameter mismatch on row #{index}: "
                    f"expected {expected_update_parameters}, "
                    f"got {actual_update_parameters}"
                )


            try:

                cursor.execute(
                    update_sql,
                    update_params
                )

            except Exception as exc:

                print(
                    f"FAILED UPDATE ON ROW #{index}",
                    file=sys.stderr
                )

                print(
                    f"projectid = {project_id}",
                    file=sys.stderr
                )

                print(
                    f"documentId = {tracking_id}",
                    file=sys.stderr
                )

                print(
                    f"parameters = {len(update_params)}",
                    file=sys.stderr
                )

                print(
                    f"placeholders = {update_sql.count('?')}",
                    file=sys.stderr
                )

                raise exc


            # -----------------------------------------------------------------
            # Existing row
            # -----------------------------------------------------------------

            if cursor.rowcount > 0:

                updated += 1

                continue


            # -----------------------------------------------------------------
            # New row → INSERT
            # -----------------------------------------------------------------

            insert_params = build_insert_params(
                row,
                columns
            )

            expected_insert_parameters = (
                len(columns)
            )

            actual_insert_parameters = (
                len(insert_params)
            )

            if (
                actual_insert_parameters
                != expected_insert_parameters
            ):

                raise ValueError(
                    f"INSERT parameter mismatch on row #{index}: "
                    f"expected {expected_insert_parameters}, "
                    f"got {actual_insert_parameters}"
                )


            try:

                cursor.execute(
                    insert_sql,
                    insert_params
                )

            except Exception as exc:

                print(
                    f"FAILED INSERT ON ROW #{index}",
                    file=sys.stderr
                )

                print(
                    f"projectid = {project_id}",
                    file=sys.stderr
                )

                print(
                    f"documentId = {tracking_id}",
                    file=sys.stderr
                )

                print(
                    f"parameters = {len(insert_params)}",
                    file=sys.stderr
                )

                print(
                    f"placeholders = {insert_sql.count('?')}",
                    file=sys.stderr
                )

                raise exc


            inserted += 1


        # =========================================================================
        # DELETE REMOVED DOCUMENTS
        # =========================================================================

        print(
            "Synchronizing removed documents..."
        )


        for project_id in project_ids:

            tracking_ids = tracking_ids_by_project.get(
                project_id,
                set()
            )

            project_deleted = delete_removed_rows(
                cursor,
                args.schema,
                args.table,
                project_id,
                tracking_ids
            )

            deleted += project_deleted

            print(
                f"Project {project_id}: "
                f"{len(tracking_ids)} returned, "
                f"{project_deleted} deleted"
            )


        # =========================================================================
        # COMMIT
        # =========================================================================

        conn.commit()


    except Exception:

        conn.rollback()

        raise


    finally:

        cursor.close()

        conn.close()


    # =========================================================================
    # RESULT
    # =========================================================================

    print(
        f"UPDATED:{updated}"
    )

    print(
        f"INSERTED:{inserted}"
    )

    print(
        f"SKIPPED:{skipped}"
    )

    print(
        f"DELETED:{deleted}"
    )

    print(
        f"PROCESSED:{updated + inserted}"
    )


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":

    try:

        main()

    except Exception as exc:

        print(
            f"ERROR: {exc}",
            file=sys.stderr
        )

        sys.exit(1)