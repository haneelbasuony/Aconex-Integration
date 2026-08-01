/**
 * ============================================================================
 * ACONEX WORKFLOW SQL REPOSITORY
 * ============================================================================
 *
 * Responsible for synchronizing parsed Aconex Workflow rows into SQL Server.
 *
 * Workflow table is separate from DocumentRegister.
 *
 * Primary key:
 *   projectId + workflowId
 *
 * This allows the same workflow ID to exist in different Aconex projects.
 *
 * The actual SQL connection is handled by src/db/sqlSync.js.
 * ============================================================================
 */

'use strict';

const { getBackend } = require('./sqlSync');

/**
 * Synchronize workflow rows into SQL Server.
 *
 * @param {Array<Object>} rows
 * @param {Object} options
 * @param {string} options.table
 * @param {string} options.schema
 */
async function syncWorkflowRowsToSql(
  rows,
  {
    table = 'Workflow',
    schema = 'dbo',
  } = {}
) {
  if (!Array.isArray(rows)) {
    throw new Error('Workflow rows must be an array.');
  }

  if (rows.length === 0) {
    console.log('No workflow rows to synchronize.');
    return;
  }

  /*
   * Make sure every workflow has projectId.
   */
  const missingProjectId = rows.filter(
    row => !row.projectId
  );

  if (missingProjectId.length > 0) {
    throw new Error(
      `${missingProjectId.length} workflow row(s) are missing projectId.`
    );
  }

  /*
   * Make sure every workflow has workflowId.
   */
  const missingWorkflowId = rows.filter(
    row => !row.workflowId
  );

  if (missingWorkflowId.length > 0) {
    throw new Error(
      `${missingWorkflowId.length} workflow row(s) are missing workflowId.`
    );
  }

  console.log(
    `Syncing ${rows.length} workflow rows to ${schema}.${table}...`
  );

  const { syncWorkflowRowsToSql: backendSyncWorkflowRows, closeConnection } =
    getBackend();

  if (typeof backendSyncWorkflowRows !== 'function') {
    throw new Error(
      'The SQL backend does not implement syncWorkflowRowsToSql(). ' +
      'Update src/db/sqlSync.js and the selected SQL backend.'
    );
  }

  try {
    await backendSyncWorkflowRows(rows, {
      table,
      schema,
      primaryKeys: ['projectId', 'workflowId'],
    });

    console.log(
      `✔ Workflow sync completed: ${rows.length} rows`
    );
  } finally {
    await closeConnection();
  }
}

module.exports = {
  syncWorkflowRowsToSql,
};