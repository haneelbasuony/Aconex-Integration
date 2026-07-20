/**
 * ============================================================================
 * SQL SYNC DISPATCHER
 * ============================================================================
 * Picks the right backend automatically based on what's actually filled in
 * .env — no separate mode flag needed, since each combination of values
 * unambiguously implies which one you want:
 *
 *   SQL_CONNECTION_STRING set        -> documentRegisterRepository.js
 *                                        (mssql + msnodesqlv8, Windows auth
 *                                        via native ODBC — needs Build Tools
 *                                        to compile)
 *   SQL_USER set (no connection str) -> documentRegisterRepository.js
 *                                        (mssql + tedious, SQL login —
 *                                        pure JS, no compilation needed)
 *   Neither set, SQL_SERVER present  -> pythonUpsert.js
 *                                        (Windows auth via Python/pyodbc —
 *                                        no compilation needed, works
 *                                        wherever Python + pyodbc are
 *                                        already set up, and doesn't
 *                                        depend on PowerShell's execution
 *                                        policy the way a .ps1-based
 *                                        approach would)
 * ============================================================================
 */

'use strict';

function getBackend() {
  const connectionString = (process.env.SQL_CONNECTION_STRING || '').trim();
  const sqlUser = (process.env.SQL_USER || '').trim();

  if (connectionString || sqlUser) {
    return require('./documentRegisterRepository');
  }

  console.log('No SQL_CONNECTION_STRING or SQL_USER set — using Python/pyodbc Windows auth fallback (no native compilation required).');
  return require('./pythonUpsert');
}

module.exports = { getBackend };
