/**
 * ============================================================================
 * SQL SERVER CONNECTION DIAGNOSTIC
 * ============================================================================
 * A standalone test — connects to SQL Server using the exact same logic the
 * main project uses (auto-selecting the same backend index.js would), but
 * does nothing else (no Aconex API calls, no upserts). Use this whenever
 * you need to debug the database connection without waiting for the full
 * Aconex fetch first.
 *
 * RUN:
 *   node test-db-connection.js
 * ============================================================================
 */

'use strict';

require('dotenv').config();

async function runMssqlPackageDiagnostic() {
  const connectionString = (process.env.SQL_CONNECTION_STRING || '').trim();
  const usingWindowsAuthViaOdbc = Boolean(connectionString);

  console.log(`Backend: mssql package (${usingWindowsAuthViaOdbc ? 'Windows auth via msnodesqlv8/ODBC' : 'SQL login via tedious'})`);

  if (!usingWindowsAuthViaOdbc) {
    console.log(`SQL_SERVER: ${process.env.SQL_SERVER || '(not set)'}`);
    console.log(`SQL_PORT: ${process.env.SQL_PORT || '(not set — defaults to 1433, or resolves via instance name if SQL_SERVER contains \\)'}`);
    console.log(`SQL_DATABASE: ${process.env.SQL_DATABASE || '(not set)'}`);
    console.log(`SQL_USER: ${process.env.SQL_USER || '(not set)'}`);
    console.log(`SQL_PASSWORD: ${process.env.SQL_PASSWORD ? '(set, ' + process.env.SQL_PASSWORD.length + ' characters)' : '(not set)'}\n`);
  } else {
    console.log(`SQL_CONNECTION_STRING: (set, ${connectionString.length} characters)\n`);
  }

  const { getPool, closeConnection } = require('./src/db/mssqlConnection');

  console.log('Step 1: Loading SQL module and connecting...');
  const pool = await getPool();
  console.log('✔ Connected successfully.\n');

  console.log('Step 2: Running a trivial query (SELECT 1)...');
  const result = await pool.request().query('SELECT 1 AS ok');
  console.log('✔ Query succeeded:', result.recordset, '\n');

  console.log('Step 3: Checking the target table exists and is reachable...');
  const config = require('./aconex.config');
  const tableCheck = await pool.request()
    .input('schema', config.sql.schema)
    .input('tableName', config.sql.tableName)
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `);

  if (tableCheck.recordset.length === 0) {
    console.log(`⚠ No columns found for ${config.sql.schema}.${config.sql.tableName} — table may not exist, or this login lacks permission to see it.`);
  } else {
    console.log(`✔ Found ${config.sql.schema}.${config.sql.tableName} with ${tableCheck.recordset.length} columns:`);
    tableCheck.recordset.forEach((col) => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length}`);
    });
  }

  await closeConnection();
}

async function runPythonDiagnostic() {
  console.log('Backend: Python/pyodbc (Windows auth, no compilation)\n');

  const { execFile } = require('child_process');
  const path = require('path');
  const config = require('./aconex.config');

  const pythonCommand = process.env.PYTHON_COMMAND || 'python';
  const scriptPath = path.join(__dirname, 'scripts', 'test_connection.py');
  const driver = process.env.SQL_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';

  console.log(`SQL_SERVER: ${process.env.SQL_SERVER || '(not set)'}`);
  console.log(`SQL_DATABASE: ${process.env.SQL_DATABASE || '(not set)'}\n`);

  return new Promise((resolve, reject) => {
    execFile(
      pythonCommand,
      [
        scriptPath,
        '--server', process.env.SQL_SERVER || '',
        '--database', process.env.SQL_DATABASE || '',
        '--schema', config.sql.schema,
        '--table', config.sql.tableName,
        '--driver', driver,
      ],
      (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (err) {
          reject(new Error((stderr || err.message).trim()));
          return;
        }
        resolve();
      }
    );
  });
}

async function main() {
  console.log('=== SQL Server Connection Diagnostic ===\n');

  const connectionString = (process.env.SQL_CONNECTION_STRING || '').trim();
  const sqlUser = (process.env.SQL_USER || '').trim();

  try {
    if (connectionString || sqlUser) {
      await runMssqlPackageDiagnostic();
    } else {
      await runPythonDiagnostic();
    }
    console.log('\n=== All checks passed — connection is fully working ===');
  } catch (err) {
    console.error('\n✖ Diagnostic failed.');
    console.error('Error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    console.error('\nCommon causes by error message:');
    console.error('  "Could not connect"        -> wrong host/port, service not listening there, or firewall');
    console.error('  "Login failed"             -> wrong username/password, or login disabled/missing on THIS instance');
    console.error('  "Cannot open database"     -> database name typo, or account lacks access to that database');
    console.error('  "certificate chain"        -> set SQL_TRUST_SERVER_CERT=true in .env');
    process.exitCode = 1;
  }
}

main();
