"""
============================================================================
UPSERT TO SQL SERVER — via pyodbc, Windows Integrated Security
============================================================================
Called by src/db/pythonUpsert.js. Reads a JSON file containing rows +
column metadata (written by Node), connects to SQL Server using
Trusted_Connection=yes, upserts every row, then deletes rows that no
longer exist in Aconex.
============================================================================
"""

import argparse
import json
import sys

import pyodbc


def build_connection_string(server, database, driver):
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        "Trusted_Connection=yes;"
        "Encrypt=no;"
    )


def build_merge_sql(schema, table, columns):
    pk_column = next(
        (c for c in columns if c["canonicalKey"] == "documentId"),
        None,
    )

    if pk_column is None:
        raise ValueError(
            "aconex.config.js 'fields' must include 'documentId'."
        )

    non_key_columns = [
        c for c in columns
        if c["canonicalKey"] != "documentId"
    ]

    set_clause = ", ".join(
        f'target.[{c["column"]}] = source.[{c["column"]}]'
        for c in non_key_columns
    )

    insert_cols = ", ".join(
        f'[{c["column"]}]'
        for c in columns
    )

    insert_vals = ", ".join(
        f'source.[{c["column"]}]'
        for c in columns
    )

    source_select = ", ".join(
        f'? AS [{c["column"]}]'
        for c in columns
    )

    return f"""
MERGE [{schema}].[{table}] AS target
USING (
    SELECT {source_select}
) AS source
ON target.[{pk_column["column"]}] = source.[{pk_column["column"]}]

WHEN MATCHED THEN
    UPDATE SET
        {set_clause}

WHEN NOT MATCHED THEN
    INSERT ({insert_cols})
    VALUES ({insert_vals});
"""


def delete_removed_rows(cursor, schema, table, document_ids):
    """
    Delete rows that are no longer returned by the API.
    """

    if not document_ids:
        cursor.execute(f"DELETE FROM [{schema}].[{table}]")
        return 0

    placeholders = ",".join("?" for _ in document_ids)

    sql = f"""
DELETE FROM [{schema}].[{table}]
WHERE documentId NOT IN ({placeholders})
"""

    cursor.execute(sql, document_ids)

    return cursor.rowcount


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--data-file", required=True)
    parser.add_argument("--server", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--table", required=True)
    parser.add_argument("--driver", default="ODBC Driver 18 for SQL Server")

    args = parser.parse_args()

    with open(args.data_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    rows = payload["rows"]
    columns = payload["columns"]

    conn = pyodbc.connect(
        build_connection_string(
            args.server,
            args.database,
            args.driver
        ),
        autocommit=False
    )

    cursor = conn.cursor()

    merge_sql = build_merge_sql(
        args.schema,
        args.table,
        columns
    )

    upserted = 0

    try:

        document_ids = []

        for row in rows:

            params = [
                row.get(c["canonicalKey"])
                for c in columns
            ]

            cursor.execute(merge_sql, params)

            upserted += 1

            document_ids.append(row["documentId"])

        deleted = delete_removed_rows(
            cursor,
            args.schema,
            args.table,
            document_ids
        )

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()

    print(f"UPSERTED:{upserted}")
    print(f"DELETED:{deleted}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)