


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
# PACKAGE COLUMNS
# ============================================================================

PACKAGE_COLUMNS = [
    "projectId",
    "packageNumber",
    "title",
    "revision",
    "state",
    "projectField1",
    "projectField2",
    "projectField3",
    "projectField4",
    "projectField5",
    "projectField6"
]

KEY_COLUMNS = [
    "projectId",
    "packageNumber"
]


# ============================================================================
# BUILD UPDATE / INSERT SQL
# ============================================================================

def build_upsert_sql(schema, table):

    update_columns = [
        column
        for column in PACKAGE_COLUMNS
        if column not in KEY_COLUMNS
    ]


    # ------------------------------------------------------------------------
    # UPDATE SET
    # ------------------------------------------------------------------------

    update_set = ", ".join(
        f"[{column}] = ?"
        for column in update_columns
    )


    # ------------------------------------------------------------------------
    # INSERT COLUMNS
    # ------------------------------------------------------------------------

    insert_columns = ", ".join(
        f"[{column}]"
        for column in PACKAGE_COLUMNS
    )


    # ------------------------------------------------------------------------
    # INSERT VALUES
    # ------------------------------------------------------------------------

    insert_values = ", ".join(
        "?"
        for _ in PACKAGE_COLUMNS
    )


    sql = f"""
IF EXISTS
(
    SELECT 1
    FROM [{schema}].[{table}]
    WHERE [projectId] = ?
      AND [packageNumber] = ?
)
BEGIN

    UPDATE [{schema}].[{table}]
    SET
        {update_set}
    WHERE [projectId] = ?
      AND [packageNumber] = ?

END
ELSE
BEGIN

    INSERT INTO [{schema}].[{table}]
    (
        {insert_columns}
    )
    VALUES
    (
        {insert_values}
    )

END
"""

    return sql


# ============================================================================
# BUILD PARAMETERS
# ============================================================================

def build_upsert_params(row):

    project_id = row.get("projectId")
    package_number = row.get("packageNumber")


    # ------------------------------------------------------------------------
    # UPDATE VALUES
    #
    # Must match update_set order exactly.
    # ------------------------------------------------------------------------

    update_values = [
        row.get(column)
        for column in PACKAGE_COLUMNS
        if column not in KEY_COLUMNS
    ]


    # ------------------------------------------------------------------------
    # INSERT VALUES
    #
    # Must match PACKAGE_COLUMNS order exactly.
    # ------------------------------------------------------------------------

    insert_values = [
        row.get(column)
        for column in PACKAGE_COLUMNS
    ]


    # ------------------------------------------------------------------------
    # SQL ORDER
    #
    # 1. EXISTS projectId
    # 2. EXISTS packageNumber
    # 3. UPDATE values
    # 4. UPDATE projectId
    # 5. UPDATE packageNumber
    # 6. INSERT values
    # ------------------------------------------------------------------------

    params = (
        [
            project_id,
            package_number,
        ]

        + update_values

        + [
            project_id,
            package_number,
        ]

        + insert_values
    )


    return params


# ============================================================================
# DELETE REMOVED Packages
# ============================================================================

def delete_removed_packages(
    cursor,
    schema,
    table,
    project_id,
    package_numbers
):
    """
    Delete Packages for the current project that were not returned
    by Aconex.

    A temporary SQL table is used instead of a giant NOT IN (?, ?, ...)
    parameter list because SQL Server has a 2,100-parameter limit.
    """

    # ------------------------------------------------------------------------
    # Create temporary table
    # ------------------------------------------------------------------------

    cursor.execute("""
        IF OBJECT_ID('tempdb..#ReturnedPackagesNumbers') IS NOT NULL
            DROP TABLE #ReturnedPackagesNumbers;

        CREATE TABLE #ReturnedPackagesNumbers
        (
            packageNumber NVARCHAR(100) NOT NULL
        );
    """)

    # ------------------------------------------------------------------------
    # If Aconex returned no package, delete all packages for this project.
    # ------------------------------------------------------------------------

    if not package_numbers:

        cursor.execute(
            f"""
            DELETE FROM [{schema}].[{table}]
            WHERE [projectId] = ?
            """,
            project_id
        )

        return cursor.rowcount

    # ------------------------------------------------------------------------
    # Insert returned Package IDs into temporary table.
    #
    # This uses executemany() instead of creating 171,850 SQL parameters
    # inside one DELETE statement.
    # ------------------------------------------------------------------------

    insert_sql = """
        INSERT INTO #ReturnedPackagesNumbers (packageNumber)
        VALUES (?)
    """

    cursor.fast_executemany = True

    cursor.executemany(
        insert_sql,
        [(str(package_number),) for package_number in package_numbers]
    )

    # ------------------------------------------------------------------------
    # Delete packages that are NOT present in the Aconex result.
    # ------------------------------------------------------------------------

    delete_sql = f"""
        DELETE target
        FROM [{schema}].[{table}] AS target
        WHERE target.[projectId] = ?
          AND NOT EXISTS
          (
              SELECT 1
              FROM #ReturnedPackagesNumbers AS returned
              WHERE returned.[packageNumber] = target.[packageNumber]
          )
    """

    cursor.execute(
        delete_sql,
        project_id
    )

    deleted = cursor.rowcount

    # ------------------------------------------------------------------------
    # Drop temporary table
    # ------------------------------------------------------------------------

    cursor.execute("""
        DROP TABLE #ReturnedPackagesNumbers;
    """)

    return deleted

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


    # ========================================================================
    # LOAD JSON
    # ========================================================================

    with open(
        args.data_file,
        "r",
        encoding="utf-8"
    ) as f:

        payload = json.load(f)


    rows = payload.get(
        "rows",
        []
    )


    if not rows:

        print("NO_ROWS")

        return


    # ========================================================================
    # VALIDATE Package ROWS
    # ========================================================================

    for index, row in enumerate(rows):

        if not row.get("projectId"):

            raise ValueError(
                f"Package row {index} is missing projectId."
            )


        if not row.get("packageNumber"):

            raise ValueError(
                f"Package row {index} is missing packageNumber."
            )


    # ========================================================================
    # MAKE SURE ALL ROWS BELONG TO ONE PROJECT
    # ========================================================================

    project_ids = {
        str(row["projectId"])
        for row in rows
    }


    if len(project_ids) != 1:

        raise ValueError(
            "Package sync received rows from multiple projects "
            "in one execution."
        )


    project_id = next(
        iter(project_ids)
    )


    # ========================================================================
    # DATABASE CONNECTION
    # ========================================================================

    conn = pyodbc.connect(
        build_connection_string(
            args.server,
            args.database,
            args.driver
        ),
        autocommit=False
    )


    cursor = conn.cursor()


    # ========================================================================
    # BUILD SQL
    # ========================================================================

    upsert_sql = build_upsert_sql(
        args.schema,
        args.table
    )


    # ========================================================================
    # DEBUG INFORMATION
    # ========================================================================

    print(
        f"SQL columns: {len(PACKAGE_COLUMNS)}"
    )


    print(
        f"UPDATE placeholders: "
        f"{len(PACKAGE_COLUMNS) - len(KEY_COLUMNS) + len(KEY_COLUMNS) + len(KEY_COLUMNS)}"
    )


    print(
        f"INSERT placeholders: "
        f"{len(PACKAGE_COLUMNS)}"
    )


    print(
        "SQL synchronization key: projectId + packageNumber"
    )


    print(
        f"Rows received from Aconex: {len(rows)}"
    )


    # ========================================================================
    # COUNTERS
    # ========================================================================

    updated = 0
    inserted = 0
    skipped = 0
    deleted = 0


    try:

        # ====================================================================
        # Package IDs RETURNED BY ACONEX
        # ====================================================================

        package_numbers = []


        # ====================================================================
        # UPSERT PACKages
        # ====================================================================

        for index, row in enumerate(rows):

            package_number = row.get(
                "packageNumber"
            )


            params = build_upsert_params(
                row
            )


            try:

                cursor.execute(
                    upsert_sql,
                    params
                )


            except Exception as exc:

                print(
                    "",
                    file=sys.stderr
                )


                print(
                    "============================================",
                    file=sys.stderr
                )


                print(
                    "Package SQL ERROR",
                    file=sys.stderr
                )


                print(
                    "============================================",
                    file=sys.stderr
                )


                print(
                    f"Row number: {index + 1}",
                    file=sys.stderr
                )


                print(
                    f"Project ID: {row.get('projectId')}",
                    file=sys.stderr
                )


                print(
                    f"Package Number: {package_number}",
                    file=sys.stderr
                )


                print(
                    f"Parameters supplied: {len(params)}",
                    file=sys.stderr
                )


                print(
                    f"SQL placeholders: {upsert_sql.count('?')}",
                    file=sys.stderr
                )


                print(
                    f"Error: {exc}",
                    file=sys.stderr
                )


                raise


            # ----------------------------------------------------------------
            # Determine whether INSERT or UPDATE occurred.
            #
            # SQL Server rowcount from this IF/UPDATE/INSERT statement is not
            # reliable enough to use directly, so we check existence before
            # executing the upsert in a lightweight query.
            #
            # However, to avoid an additional query for every row, we simply
            # count the row as processed here.
            # ----------------------------------------------------------------

            package_numbers.append(
                package_number
            )


            # Print progress every 5,000 rows.
            if (index + 1) % 5000 == 0:

                print(
                    f"Processed {index + 1}/{len(rows)} package..."
                )


        # ====================================================================
        # DETERMINE INSERTED / UPDATED COUNTS
        # ====================================================================
        #
        # The IF EXISTS statement performs the actual synchronization.
        # To keep the SQL operation efficient for 171,850 rows, we do not
        # execute an additional SELECT for every row.
        #
        # Therefore the synchronization result is reported as PROCESSED.
        #

        processed = len(rows)


        # ====================================================================
        # DELETE REMOVED PACKAGES
        # ====================================================================

        print(
            "Synchronizing removed packages..."
        )


        deleted = delete_removed_packages(
            cursor,
            args.schema,
            args.table,
            project_id,
            package_numbers
        )


        # ====================================================================
        # COMMIT
        # ====================================================================

        conn.commit()


    except Exception:

        conn.rollback()

        raise


    finally:

        cursor.close()

        conn.close()


    # ========================================================================
    # RESULT
    # ========================================================================

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
        f"PROCESSED:{processed}"
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

