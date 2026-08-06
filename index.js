'use strict';

require('./src/utils/logger');

const {
  CONFIG,
  LOBBY_URL,
  USER_SITE,
  RESOURCE_SERVER
} = require('./src/config');

const { getAccessToken } = require('./src/auth/oauth');

const { listProjects } = require('./src/api/projects');

const {
  listAllDocuments
} = require('./src/api/documents');

const {
  searchAllDocumentsAllFilters
} = require('./src/api/documentsAllFilters');

const {
  getDocumentMetadata,
  getDocumentEventLog,
  flattenMetadata,
  flattenEventLog
} = require('./src/api/documentDetails');

const {
  listAllWorkflows
} = require('./src/api/workflow');

const {
  parseWorkflowPages
} = require('./src/utils/workflowParser');

const {
  exportKeyValueToXlsx,
  exportTableToXlsx
} = require('./src/export/xlsxExporter');

const {
  normalizeRow,
  selectConfiguredFields,
  byCanonicalKey
} = require('./src/utils/fieldMap');

const syncConfig = require('./aconex.config');

const {
  listAllPackages
} = require('./src/api/packages');

const {
  parsePackagePages
} = require('./src/utils/packageParser');

// ============================================================================
// DOCUMENT SYNC
// ============================================================================

async function runDocumentSync(accessToken) {

  console.log('\n============================================');
  console.log('DOCUMENT REGISTER SYNC');
  console.log('============================================\n');

  console.log(`Search mode: "${syncConfig.searchMode}"`);
  console.log(`Fields: ${syncConfig.fields.join(', ')}`);
  console.log(
    `Output: xlsx=${syncConfig.output.xlsx}, sql=${syncConfig.output.sql}`
  );
  console.log('');

  let allRows = [];
  let liveRows = [];
  let keyKind;

  // --------------------------------------------------------------------------
  // ALL FILTERS
  // --------------------------------------------------------------------------

  if (syncConfig.searchMode === 'allFilters') {

    const jsonReturnFields = syncConfig.fields
      .filter((k) => k !== 'documentId')
      .map(
        (k) =>
          byCanonicalKey[k]?.jsonRequestKey ||
          byCanonicalKey[k]?.jsonKey
      )
      .filter(Boolean);

    ({
      allRows,
      liveRows
    } = await searchAllDocumentsAllFilters(
      accessToken,
      {
        filters: syncConfig.allFilters.filters,
        returnFields: jsonReturnFields,
        resultSize: syncConfig.allFilters.resultSize
      }
    ));

    keyKind = 'json';
  }

  // --------------------------------------------------------------------------
  // XML REGISTER
  // --------------------------------------------------------------------------

  else {

    const xmlReturnFields =
      syncConfig.fields.filter(
        (k) => k !== 'documentId'
      );

    const xmlRows =
      await listAllDocuments(
        accessToken,
        {
          searchQuery:
            syncConfig.register.searchQuery,

          pageSize:
            syncConfig.register.pageSize,

          returnFields:
            xmlReturnFields
        }
      );

    allRows = xmlRows;
    liveRows = xmlRows;

    keyKind = 'xml';
  }

  // --------------------------------------------------------------------------
  // NORMALIZE HISTORY
  // --------------------------------------------------------------------------

  const canonicalHistoryRows =
    allRows.map((row) => {

      const normalized =
        normalizeRow(
          row,
          keyKind
        );

      return selectConfiguredFields(
        normalized,
        syncConfig.fields
      );
    });

  // --------------------------------------------------------------------------
  // NORMALIZE LIVE
  // --------------------------------------------------------------------------

  const canonicalLiveRows =
    liveRows.map((row) => {

      const normalized =
        normalizeRow(
          row,
          keyKind
        );

      return selectConfiguredFields(
        normalized,
        syncConfig.fields
      );
    });

  console.log(
    `✔ History rows: ${canonicalHistoryRows.length}`
  );

  console.log(
    `✔ Live rows: ${canonicalLiveRows.length}`
  );

  // --------------------------------------------------------------------------
  // EXCEL
  // --------------------------------------------------------------------------

  if (syncConfig.output.xlsx) {

    await exportTableToXlsx(
      canonicalLiveRows,
      './document-register.xlsx',
      'Document Register'
    );

    await exportTableToXlsx(
      canonicalHistoryRows,
      './document-register-history.xlsx',
      'Document Register History'
    );
  }

  // --------------------------------------------------------------------------
  // SQL
  // --------------------------------------------------------------------------

  if (syncConfig.output.sql) {

    const { getBackend } =
      require('./src/db/sqlSync');

    const {
      syncRowsToSql,
      upsertHistoryRows,
      closeConnection
    } = getBackend();

    try {

      console.log(
        `Syncing ${canonicalHistoryRows.length} history rows to ${syncConfig.sql.documentHistoryTableName}`
      );

      await upsertHistoryRows(
        canonicalHistoryRows
      );

      console.log(
        `Syncing ${canonicalLiveRows.length} live rows to ${syncConfig.sql.tableName}`
      );

      await syncRowsToSql(
        canonicalLiveRows
      );

    } finally {

      await closeConnection();
    }
  }

  console.log(
    `✔ Document sync completed. History=${canonicalHistoryRows.length}, Live=${canonicalLiveRows.length}`
  );
}


// ============================================================================
// WORKFLOW SYNC
// ============================================================================

async function runWorkflowSync(accessToken) {

  console.log('\n============================================');
  console.log('WORKFLOW SYNC');
  console.log('============================================\n');


  const projectId =
    CONFIG.projectId ||
    process.env.ACONEX_PROJECT_ID;


  if (!projectId) {

    throw new Error(
      'No ACONEX project ID configured for Workflow API.'
    );
  }


  console.log(
    `Project ID: ${projectId}`
  );

  console.log(
    'Fetching workflows...'
  );


  // --------------------------------------------------------------------------
  // GET ALL WORKFLOW PAGES
  // --------------------------------------------------------------------------

  const workflowXmlPages =
    await listAllWorkflows(
      accessToken,
      {
        projectId,
        pageSize: 1000
      }
    );


  // --------------------------------------------------------------------------
  // XML -> SQL-READY ROWS
  // --------------------------------------------------------------------------

  const workflowRows =
    await parseWorkflowPages(
      workflowXmlPages,
      projectId
    );


  // if (workflowRows.length > 0) {

  //   console.log('\n--- FIRST PARSED WORKFLOW ---');

  //   console.log(
  //     JSON.stringify(
  //       workflowRows[0],
  //       null,
  //       2
  //     )
  //   );

  //   console.log('\n--- WORKFLOW KEYS ---');

  //   console.log(
  //     Object.keys(
  //       workflowRows[0]
  //     )
  //   );

  //   console.log('-----------------------------\n');
  // }


  console.log(
    `✔ Parsed ${workflowRows.length} workflow rows`
  );


  if (!workflowRows.length) {

    console.log(
      '⚠ No workflow records returned.'
    );

    return;
  }


  // --------------------------------------------------------------------------
  // SQL
  // --------------------------------------------------------------------------

  if (syncConfig.output.sql) {

    const {
      syncWorkflowRowsToSql
    } =
      require('./src/db/workflowRegisterRepository');


    console.log(
      `Syncing ${workflowRows.length} workflow rows to ${syncConfig.sql.schema}.${syncConfig.sql.workflowTableName}...`
    );


    await syncWorkflowRowsToSql(
      workflowRows
    );
  }


  // --------------------------------------------------------------------------
  // EXCEL
  // --------------------------------------------------------------------------

  if (syncConfig.output.xlsx) {

    await exportTableToXlsx(
      workflowRows,
      './workflow-register.xlsx',
      'Workflow Register'
    );
  }


  console.log(
    `✔ Workflow Register sync completed: ${workflowRows.length} rows`
  );
}
// ============================================================================
// PACKAGES SYNC
// ============================================================================
async function runPackageSync(
  accessToken
) {

  console.log('\n============================================');
  console.log('PACKAGE REGISTER SYNC');
  console.log('============================================\n');

  const projectId =
    CONFIG.projectId ||
    process.env.ACONEX_PROJECT_ID;

  const packageXmlPages =
    await listAllPackages(
      accessToken,
      {
        projectId,
        limit: 100
      }
    );

  const packageRows =
    await parsePackagePages(
      packageXmlPages,
      projectId
    );

  console.log(
    `✔ Parsed ${packageRows.length} package rows`
  );

  const {
    syncPackageRowsToSql
  } =
    require(
      './src/db/packageRegisterRepository'
    );

  await syncPackageRowsToSql(
    packageRows
  );

  console.log(
    `✔ Package Register sync completed: ${packageRows.length} rows`
  );
}
// ============================================================================
// LIST PROJECTS
// ============================================================================

async function runListProjects(accessToken) {

  const projects =
    await listProjects(accessToken);

  console.log('\n--- Your available EA1 projects ---');

  projects.forEach((p) =>
    console.log(
      `${p.projectId}   ${p.projectName}`
    )
  );

  console.log(
    '\nCopy the projectId you want into ACONEX_PROJECT_ID in your .env file.'
  );
}


// ============================================================================
// DOCUMENT LOOKUP
// ============================================================================

async function runDocumentLookup(accessToken) {

  const documentId =
    syncConfig.documentLookup.documentId;

  if (!documentId) {

    console.error(
      '✖ aconex.config.js: documentLookup.documentId is empty.'
    );

    return;
  }


  console.log(
    `Fetching metadata + event log for document ${documentId} only...\n`
  );


  const metadataXml =
    await getDocumentMetadata(
      accessToken,
      documentId
    );

  const metadataRow =
    flattenMetadata(metadataXml);


  await exportKeyValueToXlsx(
    metadataRow,
    `./document-${documentId}-metadata.xlsx`,
    'Metadata'
  );


  const eventLogXml =
    await getDocumentEventLog(
      accessToken,
      documentId
    );

  const eventRows =
    flattenEventLog(eventLogXml);


  await exportTableToXlsx(
    eventRows,
    `./document-${documentId}-eventlog.xlsx`,
    'Event Log'
  );
}


// ============================================================================
// ONE COMPLETE RUN
// ============================================================================

async function runOnce() {

  console.log(
    `Environment: ${
      CONFIG.useEarlyAccess
        ? 'EARLY ACCESS (EA1)'
        : 'PRODUCTION'
    }`
  );

  console.log(
    `Lobby: ${LOBBY_URL}`
  );

  console.log(
    `Resource Server: ${RESOURCE_SERVER}`
  );

  console.log(
    `user_site: ${USER_SITE}\n`
  );


  // ONE TOKEN FOR THE ENTIRE EXECUTION
  const accessToken =
    await getAccessToken();


  switch (syncConfig.mode) {

    case 'sync':

      // ------------------------------------------------------------
      // 1. DOCUMENT REGISTER
      // ------------------------------------------------------------

      await runDocumentSync(
        accessToken
      );


      // ------------------------------------------------------------
      // 2. WORKFLOW REGISTER
      // ------------------------------------------------------------

      // await runWorkflowSync(
      //   accessToken
      // );

      // ------------------------------------------------------------
      // 3. Packages REGISTER
      // ------------------------------------------------------------
      // await runPackageSync(
      // accessToken
      // );

      break;


    case 'listProjects':

      await runListProjects(
        accessToken
      );

      break;


    case 'documentLookup':

      await runDocumentLookup(
        accessToken
      );

      break;


    default:

      throw new Error(
        `aconex.config.js: unknown mode "${syncConfig.mode}".`
      );
  }
}


// ============================================================================
// RUN GUARD
// ============================================================================

let isRunInProgress = false;


async function runOnceGuarded(label) {

  if (isRunInProgress) {

    console.log(
      `⏭ [${label}] Previous run is still in progress — skipping this cycle.`
    );

    return;
  }


  isRunInProgress = true;


  try {

    await runOnce();

    console.log(
      `\n✔ [${label}] Complete Aconex synchronization finished successfully.`
    );

  }

  catch (err) {

    if (err.response) {

      console.error(
        `✖ [${label}] API error (${err.response.status}):`,
        err.response.data
      );

    } else {

      console.error(
        `✖ [${label}] Error:`,
        err.message
      );
    }

  }

  finally {

    isRunInProgress = false;
  }
}


// ============================================================================
// MAIN
// ============================================================================

async function main() {

  if (
    !syncConfig.schedule ||
    !syncConfig.schedule.enabled
  ) {

    await runOnceGuarded(
      'single run'
    );

    return;
  }


  const cron =
    require('node-cron');

  const minutes =
    syncConfig.schedule.intervalMinutes || 30;

  const cronExpression =
    `*/${minutes} * * * *`;


  console.log(
    `Scheduling enabled — will run every ${minutes} minute(s) (cron: "${cronExpression}").`
  );

  console.log(
    'Running first sync immediately, then on schedule. Press Ctrl+C to stop.\n'
  );


  await runOnceGuarded(
    'initial run'
  );


  cron.schedule(
    cronExpression,
    () => {

      const timestamp =
        new Date().toISOString();

      console.log(
        `\n===== Scheduled run starting at ${timestamp} =====`
      );

      runOnceGuarded(
        timestamp
      );
    }
  );
}


main();