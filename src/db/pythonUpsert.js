/**
 * ============================================================================
 * WINDOWS AUTH VIA PYTHON/PYODBC — no native Node compilation required
 * ============================================================================
 * Alternative to src/db/documentRegisterRepository.js (needs msnodesqlv8 to
 * compile) for machines where that isn't possible. Also an alternative to
 * the PowerShell-based approach, for machines where PowerShell's execution
 * policy blocks running scripts (a common company-managed-PC restriction).
 *
 * This uses the exact same approach already proven working on this
 * machine via a colleague's Python/pyodbc code: Trusted_Connection=yes,
 * ODBC Driver 17 for SQL Server. Node writes the row data to a temp JSON
 * file, then spawns scripts/upsert_to_sql.py to do the actual connection
 * + upsert.
 *
 * Used automatically (see src/db/sqlSync.js) when no SQL_CONNECTION_STRING
 * and no SQL_USER are set in .env, but SQL_SERVER/SQL_DATABASE are.
 * ============================================================================
 */

'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { byCanonicalKey } = require('../utils/fieldMap');
const config = require('../../aconex.config');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required .env value: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value.trim();
}

// ----------------------------------------------------------------------------
// Resolves aconex.config.js's `fields` list into { canonicalKey, column }
// pairs, applying columnOverrides — same logic as the other SQL backends,
// kept in sync so all of them produce identical SQL column mapping.
// ----------------------------------------------------------------------------
function getColumns() {
  const overrides = config.columnOverrides || {};
  return config.fields
    .map((canonicalKey) => {
      const field = byCanonicalKey[canonicalKey];
      if (!field) {
        console.warn(`⚠ aconex.config.js lists unknown field "${canonicalKey}" (not in fieldMap.js) — skipping.`);
        return null;
      }
      return { canonicalKey, column: overrides[canonicalKey] || field.sqlColumn };
    })
    .filter(Boolean);
}

async function verifyConnection() {
  console.log('(Windows auth via Python/pyodbc — connection happens during upsert)');
}

// The Python launcher command differs across Windows setups — 'python' is
// most common when installed via python.org's installer (which is what a
// colleague's already-working pyodbc setup implies is present here).
const PYTHON_COMMAND = process.env.PYTHON_COMMAND || 'python';

// ----------------------------------------------------------------------------
// Writes rows + column metadata to a temp JSON file, then runs the Python
// script to perform the actual upsert.
// ----------------------------------------------------------------------------
async function upsertRows(rows) {
  if (rows.length === 0) {
    console.log('No rows to sync — skipping SQL upsert.');
    return { upserted: 0 };
  }

  const columns = getColumns();
  const server = requireEnv('SQL_SERVER');
  const database = requireEnv('SQL_DATABASE');
  const driver = process.env.SQL_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'upsert_to_sql.py');

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Python upsert script not found at ${scriptPath} — did scripts/upsert_to_sql.py get included in this project copy?`);
  }

  const tmpFile = path.join(os.tmpdir(), `aconex-sync-${Date.now()}-${process.pid}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({ rows, columns }));

  console.log(`Handing off ${rows.length} rows to Python (${scriptPath}) for upsert via pyodbc...`);

  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_COMMAND,
      [
        scriptPath,
        '--data-file', tmpFile,
        '--server', server,
        '--database', database,
        '--schema', config.sql.schema,
        '--table', config.sql.tableName,
        '--driver', driver,
      ],
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {
        fs.unlink(tmpFile, () => {}); // best-effort cleanup

        if (err) {
          reject(new Error(`Python upsert failed: ${(stderr || err.message).trim()}`));
          return;
        }

        if (/^NO_ROWS/m.test(stdout)) {
          console.log('✔ Python reported no rows to upsert.');
          resolve({ upserted: 0 });
          return;
        }

        const match = stdout.match(/UPSERTED:(\d+)/);
        const upserted = match ? parseInt(match[1], 10) : 0;
        console.log(`✔ Upserted ${upserted} rows into ${config.sql.schema}.${config.sql.tableName} (via Python/pyodbc, Windows auth)`);
        resolve({ upserted });
      }
    );
  });
}

async function syncRowsToSql(rows) {
  await verifyConnection();
  return upsertRows(rows);
}

async function closeConnection() {
  // Nothing to close — each Python invocation manages its own connection.
}

module.exports = { verifyConnection, upsertRows, syncRowsToSql, closeConnection, getColumns };
