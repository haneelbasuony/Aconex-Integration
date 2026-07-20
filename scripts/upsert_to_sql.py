"""
============================================================================
UPSERT TO SQL SERVER — via pyodbc, Windows Integrated Security
============================================================================
Called by src/db/pythonUpsert.js. Reads a JSON file containing rows +
column metadata (written by Node), connects to SQL Server using
Trusted_Connection=yes (Windows Integrated Security — the same approach
already proven working via a colleague's pyodbc/SQLAlchemy code on this
machine), and upserts every row via a parameterized MERGE statement
inside a transaction.

USAGE (called automatically by Node, not meant to be run manually):
  python upsert_to_sql.py --data-file <path> --server <server> \
      --database <database> --schema <schema> --table <table> \
      [--driver "ODBC Driver 17 for SQL Server"]
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
    pk_column = next((c for c in columns if c["canonicalKey"] == "documentId"), None)
    if pk_column is None:
        raise ValueError(
            "aconex.config.js 'fields' must include 'documentId' — it is "
            "required as the primary key for SQL upserts."
        )
    non_key_columns = [c for c in columns if c["canonicalKey"] != "documentId"]

    set_clause = ", ".join(
        f'target.[{c["column"]}] = source.[{c["column"]}]' for c in non_key_columns
    )
    insert_cols = ", ".join(f'[{c["column"]}]' for c in columns)
    insert_vals = ", ".join(f'source.[{c["column"]}]' for c in columns)
    # pyodbc uses positional "?" parameters, not named ones — the SELECT in
    # the USING clause supplies them in the same order as `columns`.
    source_select = ", ".join(f'? AS [{c["column"]}]' for c in columns)

    merge_sql = f"""
        MERGE [{schema}].[{table}] AS target
        USING (SELECT {source_select}) AS source
        ON target.[{pk_column["column"]}] = source.[{pk_column["column"]}]
        WHEN MATCHED THEN UPDATE SET {set_clause}
        WHEN NOT MATCHED THEN INSERT ({insert_cols}) VALUES ({insert_vals});
    """
    return merge_sql


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-file", required=True)
    parser.add_argument("--server", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--table", required=True)
    parser.add_argument("--driver", default="ODBC Driver 17 for SQL Server")
    args = parser.parse_args()

    with open(args.data_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    rows = payload["rows"]
    columns = payload["columns"]  # [{ canonicalKey, column }, ...]

    if not rows:
        print("NO_ROWS")
        return

    merge_sql = build_merge_sql(args.schema, args.table, columns)
    conn_str = build_connection_string(args.server, args.database, args.driver)

    conn = pyodbc.connect(conn_str, autocommit=False)
    cursor = conn.cursor()

    upserted = 0
    try:
        for row in rows:
            # Build params in the SAME order as `columns`, matching the
            # positional "?" placeholders in the generated MERGE SQL.
            params = [row.get(c["canonicalKey"]) for c in columns]
            cursor.execute(merge_sql, params)
            upserted += 1

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    print(f"UPSERTED:{upserted}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 — deliberately broad: report any failure to Node clearly
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
