/**
 * ============================================================================
 * MSSQL CONNECTION — supports Windows Integrated Security
 * ============================================================================
 * Sequelize's MSSQL support only works through the "tedious" driver, and
 * tedious cannot do genuine Windows Integrated Security (no username or
 * password at all — trusting whichever Windows account is running the
 * process, same as SSMS does). That's why this project uses the "mssql"
 * package directly instead of an ORM: it can load the "msnodesqlv8"
 * driver, a native addon wrapping the real Windows ODBC/SSPI stack.
 *
 * TWO CONNECTION MODES (auto-detected from .env):
 *
 * 1. SQL_CONNECTION_STRING is set (RECOMMENDED for your setup):
 *    Paste your manager's exact connection string here. Uses
 *    msnodesqlv8 — genuine Windows Integrated Security, no credentials
 *    needed in .env at all.
 *
 * 2. SQL_CONNECTION_STRING is blank, SQL_SERVER/SQL_USER/SQL_PASSWORD set:
 *    Falls back to a standard SQL Server login via the tedious driver.
 *    Useful if you're ever given a SQL login instead.
 *
 * IMPORTANT — WINDOWS-ONLY NATIVE DEPENDENCY:
 * msnodesqlv8 is a native addon. It only installs/works on Windows, and
 * npm needs Python + Visual Studio Build Tools available to compile it.
 * If `npm install` fails on msnodesqlv8 specifically, see the README's
 * "Windows Integrated Security setup" section for what to install first.
 * ============================================================================
 */

'use strict';

require('dotenv').config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required .env value: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value.trim();
}

// The 'mssql' package needs a different sub-module required depending on
// driver — done lazily (inside functions) so files that never touch the
// database (most CLI modes) never even attempt to load msnodesqlv8.
function loadSqlModule() {
  const connectionString = (process.env.SQL_CONNECTION_STRING || '').trim();
  if (connectionString) {
    // Windows Integrated Security path
    return require('mssql/msnodesqlv8');
  }
  // Standard SQL login path (default tedious driver)
  return require('mssql');
}

let poolPromise = null;

// ----------------------------------------------------------------------------
// Returns a shared, already-connecting connection pool (singleton — only
// ever opens one pool for the whole process, however many times this is
// called).
// ----------------------------------------------------------------------------
function getPool() {
  if (poolPromise) return poolPromise;

  const sql = loadSqlModule();
  const connectionString = (process.env.SQL_CONNECTION_STRING || '').trim();

  if (connectionString) {
    console.log('Connecting to SQL Server via Windows Integrated Security (msnodesqlv8)...');
    poolPromise = sql.connect(connectionString);
  } else {
    console.log('Connecting to SQL Server via SQL login (tedious)...');
    const encrypt = (process.env.SQL_ENCRYPT ?? 'true').toLowerCase() === 'true';
    const trustServerCertificate = (process.env.SQL_TRUST_SERVER_CERT ?? 'true').toLowerCase() === 'true';

    const rawServer = requireEnv('SQL_SERVER');
    const options = { encrypt, trustServerCertificate };

    const config = {
      database: requireEnv('SQL_DATABASE'),
      user: requireEnv('SQL_USER'),
      password: requireEnv('SQL_PASSWORD'),
      options,
    };

    // SQL_SERVER can be either a plain host ("localhost") or a NAMED
    // INSTANCE ("HOST\SQLEXPRESS"). Named instances almost always listen
    // on a dynamically assigned port discovered via the SQL Server
    // Browser service (UDP 1434), NOT a fixed port — so if we detect a
    // "\instance" and no explicit SQL_PORT was set, we deliberately don't
    // send a port at all and let tedious resolve it via the instance name.
    // Sending an explicit port alongside an instance name is what caused
    // "Could not connect" here, since 1433 usually isn't where a named
    // instance actually listens.
    if (rawServer.includes('\\')) {
      const [host, instanceName] = rawServer.split('\\');
      config.server = host;
      options.instanceName = instanceName;

      if (process.env.SQL_PORT) {
        config.port = parseInt(process.env.SQL_PORT, 10);
        console.log(`Named instance "${instanceName}" on ${host}, using explicit port ${config.port} (SQL_PORT was set).`);
      } else {
        console.log(`Named instance "${instanceName}" on ${host}, resolving port via SQL Server Browser (no SQL_PORT set).`);
      }
    } else {
      config.server = rawServer;
      config.port = parseInt(process.env.SQL_PORT || '1433', 10);
    }

    poolPromise = sql.connect(config);
  }

  return poolPromise;
}

// getSqlTypes() gives callers access to the same 'sql' module (for its
// NVarChar/Int/BigInt/etc. type constructors) without loading it twice.
function getSqlTypes() {
  return loadSqlModule();
}

async function closeConnection() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  await pool.close();
  poolPromise = null;
}

module.exports = { getPool, getSqlTypes, closeConnection };
