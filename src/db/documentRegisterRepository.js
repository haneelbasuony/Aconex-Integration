/**
 * ============================================================================
 * DOCUMENT REGISTER REPOSITORY
 * ============================================================================
 * Upserts document rows into SQL Server using a parameterized MERGE
 * statement per row, inside a transaction. This module NEVER issues
 * CREATE TABLE, ALTER TABLE, or DROP — it only reads column names/types
 * from aconex.config.js + fieldMap.js and writes row data. This is
 * deliberate: it's connecting to a table your manager already owns, so
 * the code is structurally incapable of changing that table's shape.
 *
 * Columns come from aconex.config.js's `fields` list, with real column
 * names from fieldMap.js's sqlColumn — or aconex.config.js's
 * `columnOverrides` when the existing table names them differently.
 * ============================================================================
 */

'use strict';

const { getPool, getSqlTypes, closeConnection } = require('./mssqlConnection');
const { byCanonicalKey } = require('../utils/fieldMap');
const config = require('../../aconex.config');

// Map our simple internal sqlType names to real mssql package types.
function toSqlType(sql, field) {
  switch (field.sqlType) {
    case 'bigString':
      return sql.NVarChar(field.length || 32); // exact-string IDs, never a numeric type
    case 'string':
      return sql.NVarChar(field.length || 255);
    case 'text':
      return sql.NVarChar(sql.MAX);
    case 'integer':
      return sql.Int;
    case 'bigint':
      return sql.BigInt;
    case 'boolean':
      return sql.Bit;
    case 'date':
      return sql.DateTime2;
    default:
      return sql.NVarChar(255);
  }
}

// ----------------------------------------------------------------------------
// Resolves aconex.config.js's `fields` list into { canonicalKey, column,
// sqlType } entries, applying columnOverrides where present.
// ----------------------------------------------------------------------------
function getColumns() {
  const sql = getSqlTypes();
  const overrides = config.columnOverrides || {};

  return config.fields
    .map((canonicalKey) => {
      const field = byCanonicalKey[canonicalKey];
      if (!field) {
        console.warn(`⚠ aconex.config.js lists unknown field "${canonicalKey}" (not in fieldMap.js) — skipping.`);
        return null;
      }
      return {
        canonicalKey,
        column: overrides[canonicalKey] || field.sqlColumn,
        sqlType: toSqlType(sql, field),
      };
    })
    .filter(Boolean);
}

async function verifyConnection() {
  await getPool();
  console.log('✔ Connected to SQL Server');
}

// ----------------------------------------------------------------------------
// Upsert an array of canonical rows into the configured table. Matches on
// documentId (must be included in aconex.config.js's `fields`). Existing
// rows get updated, new ones get inserted — safe to run repeatedly.
// ----------------------------------------------------------------------------
async function upsertRows(rows) {
  if (rows.length === 0) {
    console.log('No rows to sync — skipping SQL upsert.');
    return { upserted: 0 };
  }

  const sql = getSqlTypes();
  const pool = await getPool();
  const columns = getColumns();

  const pkColumn = columns.find((c) => c.canonicalKey === 'documentId');
  if (!pkColumn) {
    throw new Error('aconex.config.js `fields` must include "documentId" — it is required as the primary key for SQL upserts.');
  }
  const nonKeyColumns = columns.filter((c) => c.canonicalKey !== 'documentId');

  const table = `[${config.sql.schema}].[${config.sql.tableName}]`;
  const setClause = nonKeyColumns.map((c) => `target.[${c.column}] = source.[${c.column}]`).join(', ');
  const insertCols = columns.map((c) => `[${c.column}]`).join(', ');
  const insertVals = columns.map((c) => `source.[${c.column}]`).join(', ');
  const sourceSelectCols = columns.map((c) => `@${c.canonicalKey} AS [${c.column}]`).join(', ');

  const mergeSql = `
    MERGE ${table} AS target
    USING (SELECT ${sourceSelectCols}) AS source
    ON target.[${pkColumn.column}] = source.[${pkColumn.column}]
    WHEN MATCHED THEN UPDATE SET ${setClause}
    WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});
  `;

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  let upserted = 0;
  try {
    for (const row of rows) {
      const request = new sql.Request(transaction);
      for (const col of columns) {
        request.input(col.canonicalKey, col.sqlType, row[col.canonicalKey] ?? null);
      }
      await request.query(mergeSql);
      upserted++;
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  console.log(`✔ Upserted ${upserted} rows into ${table}`);
  return { upserted };
}

async function syncRowsToSql(rows) {
  await verifyConnection();
  return upsertRows(rows);
}

module.exports = { verifyConnection, upsertRows, syncRowsToSql, closeConnection, getColumns };
