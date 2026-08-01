"""
============================================================================
WORKFLOW UPSERT TO SQL SERVER — via pyodbc / Windows Integrated Security
============================================================================

Receives workflow rows from Node.js and:

1. Inserts new workflows.
2. Updates existing workflows.
3. Deletes workflows that are no longer returned by Aconex.

Synchronization key:

    projectId + workflowId

This allows multiple Aconex projects to coexist in the same Workflow table.

The implementation intentionally uses:

    IF EXISTS
        UPDATE
    ELSE
        INSERT

instead of MERGE, to avoid parameter-marker problems with pyodbc/SQL Server.
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
# WORKFLOW COLUMNS
# ============================================================================

WORKFLOW_COLUMNS = [
    "projectId",
    "workflowId",
    "assignees",
    "comments",
    "dateCompleted",
    "dateDue",
    "dateIn",
    "daysLate",
    "documentNumber",
    "documentRevision",
    "documentTitle",
    "documentTrackingId",
    "documentVersion",
    "duration",
    "fileName",
    "fileSize",
    "initiator",
    "originalDueDate",
    "reasonForIssue",
    "reviewer",
    "stepName",
    "stepOutcome",
    "stepStatus",
    "workflowName",
    "workflowNumber",
    "workflowStatus",
    "workflowTemplate",
]


KEY_COLUMNS = [
    "projectId",
    "workflowId",
]


# ============================================================================
# BUILD UPDATE / INSERT SQL
# ============================================================================

def build_upsert_sql(schema, table):

    update_columns = [
        column
        for column in WORKFLOW_COLUMNS
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
        for column in WORKFLOW_COLUMNS
    )


    # ------------------------------------------------------------------------
    # INSERT VALUES
    # ------------------------------------------------------------------------

    insert_values = ", ".join(
        "?"
        for _ in WORKFLOW_COLUMNS
    )


    sql = f"""
IF EXISTS
(
    SELECT 1
    FROM [{schema}].[{table}]
    WHERE [projectId] = ?
      AND [workflowId] = ?
)
BEGIN

    UPDATE [{schema}].[{table}]
    SET
        {update_set}
    WHERE [projectId] = ?
      AND [workflowId] = ?

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
    workflow_id = row.get("workflowId")


    # ------------------------------------------------------------------------
    # UPDATE VALUES
    #
    # Must match update_set order exactly.
    # ------------------------------------------------------------------------

    update_values = [
        row.get(column)
        for column in WORKFLOW_COLUMNS
        if column not in KEY_COLUMNS
    ]


    # ------------------------------------------------------------------------
    # INSERT VALUES
    #
    # Must match WORKFLOW_COLUMNS order exactly.
    # ------------------------------------------------------------------------

    insert_values = [
        row.get(column)
        for column in WORKFLOW_COLUMNS
    ]


    # ------------------------------------------------------------------------
    # SQL ORDER
    #
    # 1. EXISTS projectId
    # 2. EXISTS workflowId
    # 3. UPDATE values
    # 4. UPDATE projectId
    # 5. UPDATE workflowId
    # 6. INSERT values
    # ------------------------------------------------------------------------

    params = (
        [
            project_id,
            workflow_id,
        ]

        + update_values

        + [
            project_id,
            workflow_id,
        ]

        + insert_values
    )


    return params


# ============================================================================
# DELETE REMOVED WORKFLOWS
# ============================================================================

def delete_removed_workflows(
    cursor,
    schema,
    table,
    project_id,
    workflow_ids
):
    """
    Delete workflows for the current project that were not returned
    by Aconex.

    A temporary SQL table is used instead of a giant NOT IN (?, ?, ...)
    parameter list because SQL Server has a 2,100-parameter limit.
    """

    # ------------------------------------------------------------------------
    # Create temporary table
    # ------------------------------------------------------------------------

    cursor.execute("""
        IF OBJECT_ID('tempdb..#ReturnedWorkflowIds') IS NOT NULL
            DROP TABLE #ReturnedWorkflowIds;

        CREATE TABLE #ReturnedWorkflowIds
        (
            workflowId NVARCHAR(100) NOT NULL
        );
    """)

    # ------------------------------------------------------------------------
    # If Aconex returned no workflows, delete all workflows for this project.
    # ------------------------------------------------------------------------

    if not workflow_ids:

        cursor.execute(
            f"""
            DELETE FROM [{schema}].[{table}]
            WHERE [projectId] = ?
            """,
            project_id
        )

        return cursor.rowcount

    # ------------------------------------------------------------------------
    # Insert returned workflow IDs into temporary table.
    #
    # This uses executemany() instead of creating 171,850 SQL parameters
    # inside one DELETE statement.
    # ------------------------------------------------------------------------

    insert_sql = """
        INSERT INTO #ReturnedWorkflowIds (workflowId)
        VALUES (?)
    """

    cursor.fast_executemany = True

    cursor.executemany(
        insert_sql,
        [(str(workflow_id),) for workflow_id in workflow_ids]
    )

    # ------------------------------------------------------------------------
    # Delete workflows that are NOT present in the Aconex result.
    # ------------------------------------------------------------------------

    delete_sql = f"""
        DELETE target
        FROM [{schema}].[{table}] AS target
        WHERE target.[projectId] = ?
          AND NOT EXISTS
          (
              SELECT 1
              FROM #ReturnedWorkflowIds AS returned
              WHERE returned.[workflowId] = target.[workflowId]
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
        DROP TABLE #ReturnedWorkflowIds;
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
    # VALIDATE WORKFLOW ROWS
    # ========================================================================

    for index, row in enumerate(rows):

        if not row.get("projectId"):

            raise ValueError(
                f"Workflow row {index} is missing projectId."
            )


        if not row.get("workflowId"):

            raise ValueError(
                f"Workflow row {index} is missing workflowId."
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
            "Workflow sync received rows from multiple projects "
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
        f"SQL columns: {len(WORKFLOW_COLUMNS)}"
    )


    print(
        f"UPDATE placeholders: "
        f"{len(WORKFLOW_COLUMNS) - len(KEY_COLUMNS) + len(KEY_COLUMNS) + len(KEY_COLUMNS)}"
    )


    print(
        f"INSERT placeholders: "
        f"{len(WORKFLOW_COLUMNS)}"
    )


    print(
        "SQL synchronization key: projectId + workflowId"
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
        # WORKFLOW IDs RETURNED BY ACONEX
        # ====================================================================

        workflow_ids = []


        # ====================================================================
        # UPSERT WORKFLOWS
        # ====================================================================

        for index, row in enumerate(rows):

            workflow_id = row.get(
                "workflowId"
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
                    "WORKFLOW SQL ERROR",
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
                    f"Workflow ID: {workflow_id}",
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

            workflow_ids.append(
                workflow_id
            )


            # Print progress every 5,000 rows.
            if (index + 1) % 5000 == 0:

                print(
                    f"Processed {index + 1}/{len(rows)} workflows..."
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
        # DELETE REMOVED WORKFLOWS
        # ====================================================================

        print(
            "Synchronizing removed workflows..."
        )


        deleted = delete_removed_workflows(
            cursor,
            args.schema,
            args.table,
            project_id,
            workflow_ids
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

