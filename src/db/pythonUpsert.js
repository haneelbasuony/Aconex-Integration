/**
 * ============================================================================
 * WINDOWS AUTH VIA PYTHON/PYODBC
 * ============================================================================
 *
 * Handles:
 *
 *   1. Document Register
 *      scripts/upsert_to_sql.py
 *
 *   2. Workflow Register
 *      scripts/workflow_upsert_to_sql.py
 *
 * Windows Integrated Authentication:
 *
 *      Trusted_Connection=yes
 *
 * No native Node SQL compilation required.
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
    throw new Error(
      `Missing required .env value: ${name}.`
    );
  }

  return value.trim();
}


// ============================================================================
// DOCUMENT COLUMNS
// ============================================================================

function getColumns() {

  const overrides =
    config.columnOverrides || {};

  return config.fields
    .map((canonicalKey) => {

      const field =
        byCanonicalKey[canonicalKey];

      if (!field) {

        console.warn(
          `⚠ aconex.config.js lists unknown field "${canonicalKey}" — skipping.`
        );

        return null;
      }

      return {
        canonicalKey,
        column:
          overrides[canonicalKey] ||
          field.sqlColumn
      };

    })
    .filter(Boolean);
}


// ============================================================================
// CONNECTION
// ============================================================================

async function verifyConnection() {

  console.log(
    '(Windows auth via Python/pyodbc — connection happens during SQL operation)'
  );
}


const PYTHON_COMMAND =
  process.env.PYTHON_COMMAND || 'python';


// ============================================================================
// DOCUMENT REGISTER
// ============================================================================

async function upsertRows(rows) {

  if (!rows.length) {

    console.log(
      'No document rows to sync — skipping SQL upsert.'
    );

    return {
      upserted: 0,
      deleted: 0
    };
  }


  const columns =
    getColumns();

  const server =
    requireEnv('SQL_SERVER');

  const database =
    requireEnv('SQL_DATABASE');

  const driver =
    process.env.SQL_ODBC_DRIVER ||
    'ODBC Driver 17 for SQL Server';

  const scriptPath =
    path.join(
      __dirname,
      '..',
      '..',
      'scripts',
      'upsert_to_sql.py'
    );


  if (!fs.existsSync(scriptPath)) {

    throw new Error(
      `Python upsert script not found at ${scriptPath}`
    );
  }


  const tmpFile =
    path.join(
      os.tmpdir(),
      `aconex-sync-${Date.now()}-${process.pid}.json`
    );


  const projectId =
    requireEnv('ACONEX_PROJECT_ID');


  rows = rows.map(row => ({
    projectid: projectId,
    ...row
  }));


  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      rows,
      columns
    })
  );


  console.log(
    `Handing off ${rows.length} document rows to Python (${scriptPath})...`
  );


  return new Promise((resolve, reject) => {

    execFile(
      PYTHON_COMMAND,
      [
        scriptPath,

        '--data-file',
        tmpFile,

        '--server',
        server,

        '--database',
        database,

        '--schema',
        config.sql.schema,

        '--table',
        config.sql.tableName,

        '--driver',
        driver
      ],
      {
        maxBuffer: 1024 * 1024 * 50
      },

      (err, stdout, stderr) => {

        fs.unlink(
          tmpFile,
          () => {}
        );


        if (stdout) {
          console.log(stdout);
        }


        if (stderr) {
          console.error(stderr);
        }


        if (err) {

          reject(
            new Error(
              `Python document upsert failed: ${
                (stderr || err.message).trim()
              }`
            )
          );

          return;
        }


        const upsertMatch =
          stdout.match(
            /UPSERTED:(\d+)/
          );

        const deleteMatch =
          stdout.match(
            /DELETED:(\d+)/
          );


        const upserted =
          upsertMatch
            ? parseInt(upsertMatch[1], 10)
            : 0;

        const deleted =
          deleteMatch
            ? parseInt(deleteMatch[1], 10)
            : 0;

          console.log(
          `✔ Upserted ${upserted} document rows`
        );

        console.log(
          `✔ Deleted ${deleted} document rows`
        );


        resolve({
          upserted,
          deleted
        });
      }
    );
  });
}


// ============================================================================
// WORKFLOW REGISTER
// ============================================================================

async function syncWorkflowRowsToSql(rows) {

  if (!rows || rows.length === 0) {

    console.log(
      'No workflow rows to sync — skipping SQL operation.'
    );

    return {
      upserted: 0,
      deleted: 0
    };
  }


  const server =
    requireEnv('SQL_SERVER');

  const database =
    requireEnv('SQL_DATABASE');

  const driver =
    process.env.SQL_ODBC_DRIVER ||
    'ODBC Driver 17 for SQL Server';


  const scriptPath =
    path.join(
      __dirname,
      '..',
      '..',
      'scripts',
      'workflow_upsert_to_sql.py'
    );


  if (!fs.existsSync(scriptPath)) {

    throw new Error(
      `Workflow Python script not found at ${scriptPath}`
    );
  }


  const tmpFile =
    path.join(
      os.tmpdir(),
      `aconex-workflow-${Date.now()}-${process.pid}.json`
    );


  /*
   * The parser already adds projectId.
   *
   * Do NOT use ACONEX_PROJECT_ID to overwrite it here.
   *
   * This keeps the workflow rows tied to the actual project
   * returned/used by the Workflow API.
   */

  const workflowRows =
    rows.map(row => ({
      ...row
    }));


  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      rows: workflowRows
    })
  );


  console.log(
    `Handing off ${workflowRows.length} workflow rows to Python (${scriptPath})...`
  );


  return new Promise((resolve, reject) => {

    execFile(
      PYTHON_COMMAND,
      [
        scriptPath,

        '--data-file',
        tmpFile,

        '--server',
        server,

        '--database',
        database,

        '--schema',
        config.sql.schema,

        '--table',
        config.sql.workflowTableName,

        '--driver',
        driver
      ],
      {
        maxBuffer: 1024 * 1024 * 50
      },

      (err, stdout, stderr) => {

        fs.unlink(
          tmpFile,
          () => {}
        );


        if (stdout) {
          console.log(stdout);
        }


        if (stderr) {
          console.error(stderr);
        }


        if (err) {

          reject(
            new Error(
              `Python workflow upsert failed: ${
                (stderr || err.message).trim()
              }`
            )
          );

          return;
        }


        const upsertMatch =
          stdout.match(
            /UPSERTED:(\d+)/
          );

        const deleteMatch =
          stdout.match(
            /DELETED:(\d+)/
          );


        const upserted =
          upsertMatch
            ? parseInt(upsertMatch[1], 10)
            : 0;

        const deleted =
          deleteMatch
            ? parseInt(deleteMatch[1], 10)
            : 0;


        console.log(
          `✔ Upserted ${upserted} workflow rows into ${config.sql.schema}.${config.sql.workflowTableName}`
        );

        console.log(
          `✔ Deleted ${deleted} workflow rows`
        );


        resolve({
          upserted,
          deleted
        });
      }
    );
  });
}

// ============================================================================
// PACKAGE REGISTER
// ============================================================================
async function syncPackageRowsToSql(rows) {

  if (!rows || rows.length === 0) {

    console.log(
      'No packages rows to sync — skipping SQL operation.'
    );

    return {
      upserted: 0,
      deleted: 0
    };
  }


  const server =
    requireEnv('SQL_SERVER');

  const database =
    requireEnv('SQL_DATABASE');

  const driver =
    process.env.SQL_ODBC_DRIVER ||
    'ODBC Driver 17 for SQL Server';


  const scriptPath =
    path.join(
      __dirname,
      '..',
      '..',
      'scripts',
      'package_upsert_to_sql.py'
    );


  if (!fs.existsSync(scriptPath)) {

    throw new Error(
      `Package Python script not found at ${scriptPath}`
    );
  }


  const tmpFile =
    path.join(
      os.tmpdir(),
      `aconex-package-${Date.now()}-${process.pid}.json`
    );


  /*
   * The parser already adds projectId.
   *
   * Do NOT use ACONEX_PROJECT_ID to overwrite it here.
   *
   * This keeps the workflow rows tied to the actual project
   * returned/used by the Workflow API.
   */

  const packages =
    rows.map(row => ({
      ...row
    }));


  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      rows: packages
    })
  );


  console.log(
    `Handing off ${packages.length} workflow rows to Python (${scriptPath})...`
  );


  return new Promise((resolve, reject) => {

    execFile(
      PYTHON_COMMAND,
      [
        scriptPath,

        '--data-file',
        tmpFile,

        '--server',
        server,

        '--database',
        database,

        '--schema',
        config.sql.schema,

        '--table',
        config.sql.packageTableName,

        '--driver',
        driver
      ],
      {
        maxBuffer: 1024 * 1024 * 50
      },

      (err, stdout, stderr) => {

        fs.unlink(
          tmpFile,
          () => {}
        );


        if (stdout) {
          console.log(stdout);
        }


        if (stderr) {
          console.error(stderr);
        }


        if (err) {

          reject(
            new Error(
              `Python package upsert failed: ${
                (stderr || err.message).trim()
              }`
            )
          );

          return;
        }


        const upsertMatch =
          stdout.match(
            /UPSERTED:(\d+)/
          );

        const deleteMatch =
          stdout.match(
            /DELETED:(\d+)/
          );


        const upserted =
          upsertMatch
            ? parseInt(upsertMatch[1], 10)
            : 0;

        const deleted =
          deleteMatch
            ? parseInt(deleteMatch[1], 10)
            : 0;


        console.log(
          `✔ Upserted ${upserted} workflow rows into ${config.sql.schema}.${config.sql.packageTableName}`
        );

        console.log(
          `✔ Deleted ${deleted} package rows`
        );


        resolve({
          upserted,
          deleted
        });
      }
    );
  });
}

// ============================================================================
// EXISTING DOCUMENT API
// ============================================================================

async function syncRowsToSql(rows) {

  await verifyConnection();

  return upsertRows(rows);
}


// ============================================================================
// CONNECTION CLOSE
// ============================================================================

async function closeConnection() {

  /*
   * Nothing to close.
   *
   * Every Python process opens and closes its own pyodbc connection.
   */
}
async function upsertHistoryRows(rows) {

  if (!rows.length) {

    console.log(
      'No document rows to sync — skipping SQL upsert.'
    );

    return {
      upserted: 0,
      deleted: 0
    };
  }


  const columns =
    getColumns();

  const server =
    requireEnv('SQL_SERVER');

  const database =
    requireEnv('SQL_DATABASE');

  const driver =
    process.env.SQL_ODBC_DRIVER ||
    'ODBC Driver 17 for SQL Server';

  const scriptPath =
    path.join(
      __dirname,
      '..',
      '..',
      'scripts',
      'upsert_to_sql_history.py'
    );


  if (!fs.existsSync(scriptPath)) {

    throw new Error(
      `Python upsert script not found at ${scriptPath}`
    );
  }


  const tmpFile =
    path.join(
      os.tmpdir(),
      `aconex-sync-${Date.now()}-${process.pid}.json`
    );


  const projectId =
    requireEnv('ACONEX_PROJECT_ID');


  rows = rows.map(row => ({
    projectid: projectId,
    ...row
  }));


  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      rows,
      columns
    })
  );


  console.log(
    `Handing off ${rows.length} document rows to Python (${scriptPath})...`
  );


  return new Promise((resolve, reject) => {

    execFile(
      PYTHON_COMMAND,
      [
        scriptPath,

        '--data-file',
        tmpFile,

        '--server',
        server,

        '--database',
        database,

        '--schema',
        config.sql.schema,

        '--table',
        config.sql.documentHistoryTableName,

        '--driver',
        driver
      ],
      {
        maxBuffer: 1024 * 1024 * 50
      },

      (err, stdout, stderr) => {

        fs.unlink(
          tmpFile,
          () => {}
        );


        if (stdout) {
          console.log(stdout);
        }


        if (stderr) {
          console.error(stderr);
        }


        if (err) {

          reject(
            new Error(
              `Python document upsert failed: ${
                (stderr || err.message).trim()
              }`
            )
          );

          return;
        }


        const upsertMatch =
          stdout.match(
            /UPSERTED:(\d+)/
          );

        const deleteMatch =
          stdout.match(
            /DELETED:(\d+)/
          );


        const upserted =
          upsertMatch
            ? parseInt(upsertMatch[1], 10)
            : 0;

        const deleted =
          deleteMatch
            ? parseInt(deleteMatch[1], 10)
            : 0;

          console.log(
          `✔ Upserted ${upserted} document rows`
        );

        console.log(
          `✔ Deleted ${deleted} document rows`
        );


        resolve({
          upserted,
          deleted
        });
      }
    );
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {

  verifyConnection,

  upsertRows,

  upsertHistoryRows,

  syncRowsToSql,

  syncWorkflowRowsToSql,

  syncPackageRowsToSql,

  closeConnection,

  getColumns
};