/**
 * ============================================================================
 *  ACONEX DOCUMENTS API CLIENT — User-Bound Integration (Lobby OAuth 2.0)
 *  Configured for the EARLY ACCESS (EA1) testing environment
 * ============================================================================
 *
 * EVERYTHING IS CONTROLLED BY aconex.config.js — NOT COMMAND-LINE FLAGS
 * -------------------------------------------------------------------------
 * Just run:
 *   node index.js
 *
 * What it actually does depends entirely on aconex.config.js's `mode`:
 *   'sync'           -> fetch documents, write to Excel and/or SQL Server
 *   'listProjects'    -> print available EA1 projects (find your project ID)
 *   'documentLookup'  -> fetch metadata + event log for one document
 *
 * And whether it runs once or repeats forever depends on
 * aconex.config.js's `schedule.enabled` — set that to true with
 * intervalMinutes: 30 for automatic recurring sync.
 *
 * PROJECT STRUCTURE
 * -------------------
 *   index.js                     <- you are here (orchestration + scheduler)
 *   aconex.config.js             <- the ONE file to edit to change behavior
 *   src/config.js                <- .env loading + derived URLs
 *   src/httpClient.js             <- shared auth header helper
 *   src/auth/oauth.js             <- Lobby OAuth token request
 *   src/api/projects.js           <- List Projects
 *   src/api/documents.js          <- List Documents (XML-based)
 *   src/api/documentsAllFilters.js <- All Filters List Documents (JSON-based)
 *   src/api/documentDetails.js    <- Metadata / Event Log / Download File
 *   src/export/xlsxExporter.js    <- writes rows to .xlsx
 *   src/db/mssqlConnection.js     <- MSSQL connection (Windows auth or SQL login)
 *   src/db/documentRegisterRepository.js <- upsert logic
 *   src/utils/xml.js              <- shared XML parser
 *   src/utils/fieldMap.js         <- canonical field dictionary (XML/JSON/SQL names)
 *
 * INSTALL & RUN
 * ---------------
 *   npm install
 *   cp .env.example .env      (then edit .env with your real credentials)
 *   Edit aconex.config.js to set `mode` and everything else
 *   node index.js
 * ============================================================================
 */

'use strict';

const { CONFIG, LOBBY_URL, USER_SITE, RESOURCE_SERVER } = require('./src/config');
const { getAccessToken } = require('./src/auth/oauth');
const { listProjects } = require('./src/api/projects');
const { listAllDocuments } = require('./src/api/documents');
const { searchAllDocumentsAllFilters } = require('./src/api/documentsAllFilters');
const { getDocumentMetadata, getDocumentEventLog, flattenMetadata, flattenEventLog } = require('./src/api/documentDetails');
const { exportKeyValueToXlsx, exportTableToXlsx } = require('./src/export/xlsxExporter');
const { normalizeRow, selectConfiguredFields, byCanonicalKey } = require('./src/utils/fieldMap');
const syncConfig = require('./aconex.config');

// ----------------------------------------------------------------------------
// MODE: 'sync' — fetch per config, normalize, write to xlsx and/or SQL
// ----------------------------------------------------------------------------
async function runSync(accessToken) {
  console.log(`Sync mode — searchMode: "${syncConfig.searchMode}"`);
  console.log(`Fields: ${syncConfig.fields.join(', ')}`);
  console.log(`Output: xlsx=${syncConfig.output.xlsx}, sql=${syncConfig.output.sql}\n`);

  let rawRows;
  let keyKind;

  if (syncConfig.searchMode === 'allFilters') {
    const jsonReturnFields = syncConfig.fields
      .filter((k) => k !== 'documentId') // documentId ("id") is always returned, not requestable
      .map((k) => byCanonicalKey[k]?.jsonKey)
      .filter(Boolean);

    rawRows = await searchAllDocumentsAllFilters(accessToken, {
      filters: syncConfig.allFilters.filters,
      returnFields: jsonReturnFields,
      resultSize: syncConfig.allFilters.resultSize,
    });
    keyKind = 'json';
  } else {
    const xmlReturnFields = syncConfig.fields.filter((k) => k !== 'documentId');

    rawRows = await listAllDocuments(accessToken, {
      searchQuery: syncConfig.register.searchQuery,
      pageSize: syncConfig.register.pageSize,
      returnFields: xmlReturnFields,
    });
    keyKind = 'xml';
  }

  const canonicalRows = rawRows.map((r) => selectConfiguredFields(normalizeRow(r, keyKind), syncConfig.fields));
  console.log(`\n✔ Normalized ${canonicalRows.length} rows to the configured field set`);

  if (syncConfig.output.xlsx) {
    await exportTableToXlsx(canonicalRows, './document-register.xlsx', 'Document Register');
  }

  if (syncConfig.output.sql) {
    // Lazy require so the mssql/msnodesqlv8 packages are only touched when
    // SQL output is actually enabled.
    // Lazy require + dispatch so the mssql/msnodesqlv8/Python paths are
    // only touched when SQL output is actually enabled, and the right
    // backend is chosen automatically based on what's set in .env.
    const { getBackend } = require('./src/db/sqlSync');
    const { syncRowsToSql, closeConnection } = getBackend();
    await syncRowsToSql(canonicalRows);
    await closeConnection();
  }
}

// ----------------------------------------------------------------------------
// MODE: 'listProjects'
// ----------------------------------------------------------------------------
async function runListProjects(accessToken) {
  const projects = await listProjects(accessToken);
  console.log('\n--- Your available EA1 projects ---');
  projects.forEach((p) => console.log(`${p.projectId}   ${p.projectName}`));
  console.log('\nCopy the projectId you want into ACONEX_PROJECT_ID in your .env file.');
}

// ----------------------------------------------------------------------------
// MODE: 'documentLookup'
// ----------------------------------------------------------------------------
async function runDocumentLookup(accessToken) {
  const documentId = syncConfig.documentLookup.documentId;
  if (!documentId) {
    console.error('✖ aconex.config.js: documentLookup.documentId is empty — set a real document ID first.');
    return;
  }

  console.log(`Fetching metadata + event log for document ${documentId} only...\n`);

  const metadataXml = await getDocumentMetadata(accessToken, documentId);
  const metadataRow = flattenMetadata(metadataXml);
  await exportKeyValueToXlsx(metadataRow, `./document-${documentId}-metadata.xlsx`, 'Metadata');

  const eventLogXml = await getDocumentEventLog(accessToken, documentId);
  const eventRows = flattenEventLog(eventLogXml);
  await exportTableToXlsx(eventRows, `./document-${documentId}-eventlog.xlsx`, 'Event Log');
}

// ----------------------------------------------------------------------------
// One full run: authenticate, then dispatch to whichever mode is configured.
// ----------------------------------------------------------------------------
async function runOnce() {
  console.log(`Environment: ${CONFIG.useEarlyAccess ? 'EARLY ACCESS (EA1)' : 'PRODUCTION'}`);
  console.log(`Lobby: ${LOBBY_URL}`);
  console.log(`Resource Server: ${RESOURCE_SERVER}`);
  console.log(`user_site: ${USER_SITE}\n`);

  const accessToken = await getAccessToken();

  switch (syncConfig.mode) {
    case 'sync':
      return runSync(accessToken);
    case 'listProjects':
      return runListProjects(accessToken);
    case 'documentLookup':
      return runDocumentLookup(accessToken);
    default:
      throw new Error(`aconex.config.js: unknown mode "${syncConfig.mode}". Expected 'sync', 'listProjects', or 'documentLookup'.`);
  }
}

// ----------------------------------------------------------------------------
// MAIN — runs once, or repeats on a schedule per aconex.config.js
// ----------------------------------------------------------------------------
let isRunInProgress = false;

async function runOnceGuarded(label) {
  if (isRunInProgress) {
    console.log(`⏭ [${label}] Previous run is still in progress — skipping this cycle to avoid overlap.`);
    return;
  }
  isRunInProgress = true;
  try {
    await runOnce();
  } catch (err) {
    if (err.response) {
      console.error(`✖ [${label}] API error (${err.response.status}):`, err.response.data);
    } else {
      console.error(`✖ [${label}] Error:`, err.message);
    }
  } finally {
    isRunInProgress = false;
  }
}

async function main() {
  if (!syncConfig.schedule || !syncConfig.schedule.enabled) {
    // Run once and exit — the normal case, and what you want if Windows
    // Task Scheduler (or similar) is the thing calling this every 30 min.
    await runOnceGuarded('single run');
    return;
  }

  // Scheduled mode: stays running and repeats forever. Useful if you'd
  // rather this script manage its own timing instead of Task Scheduler.
  const cron = require('node-cron');
  const minutes = syncConfig.schedule.intervalMinutes || 30;
  const cronExpression = `*/${minutes} * * * *`;

  console.log(`Scheduling enabled — will run every ${minutes} minute(s) (cron: "${cronExpression}").`);
  console.log('Running first sync immediately, then on schedule. Press Ctrl+C to stop.\n');

  await runOnceGuarded('initial run');

  cron.schedule(cronExpression, () => {
    const timestamp = new Date().toISOString();
    console.log(`\n===== Scheduled run starting at ${timestamp} =====`);
    runOnceGuarded(timestamp);
  });
}

main();
