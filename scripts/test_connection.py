"""
============================================================================
TEST CONNECTION — via pyodbc, Windows Integrated Security
============================================================================

Standalone diagnostic for Python/pyodbc SQL Server connection.

Features:
- Uses Windows Authentication
- Connects to SQL Server
- Runs SELECT 1 test query
- Searches for table without requiring schema
- Lists table columns

USAGE:

python test_connection.py \
    --server <server> \
    --database <database> \
    --table <table>

Example:

python test_connection.py --server localhost --database TestDB --table Employees

============================================================================
"""

import argparse
import sys
import pyodbc


def main():

    parser = argparse.ArgumentParser(
        description="SQL Server Connection Diagnostic"
    )

    parser.add_argument(
        "--server",
        required=True,
        help="SQL Server name or instance"
    )

    parser.add_argument(
        "--database",
        required=True,
        help="Database name"
    )

    parser.add_argument(
        "--table",
        required=True,
        help="Table name"
    )

    parser.add_argument(
        "--driver",
        default="ODBC Driver 18 for SQL Server",
        help="ODBC Driver name"
    )

    args = parser.parse_args()


    print("=" * 70)
    print("SQL SERVER CONNECTION DIAGNOSTIC")
    print("=" * 70)

    print(f"Server   : {args.server}")
    print(f"Database : {args.database}")
    print(f"Table    : {args.table}")
    print(f"Driver   : {args.driver}")
    print()


    # ==========================
    # Connection String
    # ==========================

    conn_str = (
        f"DRIVER={{{args.driver}}};"
        f"SERVER={args.server};"
        f"DATABASE={args.database};"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )


    try:

        # ==========================
        # Connect
        # ==========================

        print("Step 1: Connecting to SQL Server...")

        conn = pyodbc.connect(conn_str)

        print("OK: Connected successfully.\n")


        cursor = conn.cursor()


        # ==========================
        # Test Query
        # ==========================

        print("Step 2: Running test query...")

        cursor.execute("SELECT 1")

        result = cursor.fetchone()

        print(
            f"OK: Query successful (result = {result[0]}).\n"
        )


        # ==========================
        # Find Table Schema
        # ==========================

        print(
            f"Step 3: Searching table '{args.table}'..."
        )


        cursor.execute(
            """
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = ?
            """,
            args.table
        )


        tables = cursor.fetchall()


        if not tables:

            print(
                "WARNING: Table not found."
            )

            return


        for table in tables:

            schema = table.TABLE_SCHEMA

            print(
                f"\nFound table: {schema}.{args.table}"
            )


            # ==========================
            # Get Columns
            # ==========================

            print("\nColumns:")

            cursor.execute(
                """
                SELECT
                    COLUMN_NAME,
                    DATA_TYPE,
                    CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
                """,
                schema,
                args.table
            )


            columns = cursor.fetchall()


            for col in columns:

                length = ""

                if col.CHARACTER_MAXIMUM_LENGTH:
                    length = (
                        f"({col.CHARACTER_MAXIMUM_LENGTH})"
                    )


                print(
                    f"  - {col.COLUMN_NAME}: "
                    f"{col.DATA_TYPE}{length}"
                )


        cursor.close()
        conn.close()


        print("\n" + "=" * 70)
        print("ALL CHECKS PASSED")
        print("=" * 70)


    except Exception as exc:

        print("\nFAILED:")
        print(exc)

        sys.exit(1)



if __name__ == "__main__":

    main()