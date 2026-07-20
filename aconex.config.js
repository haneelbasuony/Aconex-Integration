/**
 * ============================================================================
 * ACONEX SYNC CONFIGURATION
 * ============================================================================
 * This is the ONE file to edit to change what gets synced, how it's
 * filtered, which columns are produced, and where the output goes.
 * No other file needs to change for any of the following:
 *
 *   - Switching between the simple register search and the structured
 *     "All Filters" search
 *   - Changing which documents are included (search query / filters)
 *   - Adding, removing, or reordering output columns
 *   - Turning Excel export and/or SQL Server sync on or off
 *   - Renaming the SQL table/schema
 *
 * Secrets (SQL Server credentials, Aconex client_id/secret) stay in .env,
 * NOT here — this file is safe to commit to source control, .env is not.
 * ============================================================================
 */

'use strict';

/**
 * ============================================================================
 * ACONEX SYNC CONFIGURATION
 * ============================================================================
 * This is the ONE file to edit to control everything: which action runs
 * (mode), how documents are filtered, which columns are produced, where
 * output goes, and whether it repeats automatically on a schedule.
 * No command-line flags are needed — just run `node index.js` and it does
 * whatever this file says.
 *
 * Secrets (SQL Server credentials, Aconex client_id/secret) stay in .env,
 * NOT here — this file is safe to commit to source control, .env is not.
 * ============================================================================
 */

'use strict';

module.exports = {
  // --------------------------------------------------------------------
  // WHAT TO DO — this replaces the old --list-projects / --all-filters /
  // documentId / --sync command-line flags. Just change this value.
  //
  //   'sync'           -> fetch documents + write to xlsx/SQL (see `output` below)
  //   'listProjects'    -> print available EA1 projects (to find your project ID)
  //   'documentLookup'  -> fetch metadata + event log for ONE document (see `documentLookup` below)
  // --------------------------------------------------------------------
  mode: 'sync',

  // Used when mode = 'documentLookup'
  documentLookup: {
    documentId: '271341877549391954',
  },

  // --------------------------------------------------------------------
  // WHICH SEARCH API TO USE (used when mode = 'sync')
  //   'register'   -> GET /register  (simple, Lucene query string)
  //   'allFilters' -> POST /register/search (structured filters, JSON)
  // --------------------------------------------------------------------
  searchMode: 'register',

  // Settings used when searchMode = 'register'
  register: {
    searchQuery: '',   // '' = every document. e.g. 'doctype:"Drawing"'
    pageSize: 100,      // must be a multiple of 25, max 500
  },

  // Settings used when searchMode = 'allFilters'
  allFilters: {
    filters: {},         // e.g. { category: 'Category 1' } — same shape as Postman body
    resultSize: 250,      // must be a multiple of 25
  },

  // --------------------------------------------------------------------
  // WHICH COLUMNS TO SYNC (used when mode = 'sync')
  //   Reference canonicalKeys from src/utils/fieldMap.js. This ONE array
  //   controls both the Excel columns AND the SQL table columns — add or
  //   remove a line here and both outputs update automatically.
  // --------------------------------------------------------------------
  fields: [
    'documentId',   // always keep this — it's the primary key in SQL
    'docno',
    'title',
    'doctype',
    'statusid',
    'revision',
    'revisiondate',
    'author',
    'category',
    'discipline',
    'filename',
    'fileSize',
    'confidential',
    'current',
    'registered',
    'attribute1',
    'attribute2',
    'attribute3',
    'attribute4',
  ],

  // --------------------------------------------------------------------
  // WHERE OUTPUT GOES (used when mode = 'sync') — toggle either or both
  // --------------------------------------------------------------------
  output: {
    xlsx: false,                              // write ./document-register.xlsx
    sql: true,                               // upsert into SQL Server (see sql section below)
  },

  // --------------------------------------------------------------------
  // RUN ON A SCHEDULE, OR JUST ONCE
  //   enabled: false -> runs once and exits (good for testing, or for
  //                     driving from Windows Task Scheduler yourself)
  //   enabled: true  -> stays running and repeats automatically every
  //                     intervalMinutes, forever (until you stop it)
  // --------------------------------------------------------------------
  schedule: {
    enabled: true,
    intervalMinutes: 3,
  },

  // --------------------------------------------------------------------
  // SQL SERVER TABLE SETTINGS (connection details themselves live in .env)
  // --------------------------------------------------------------------
  sql: {
    schema: 'dbo',
    tableName: 'DocumentRegisterTest', // <-- confirm exact spelling with your manager

    // Set to a real column name (e.g. 'LastSyncedAt') ONLY if the existing
    // table actually has a column for tracking sync time. Set to null/false
    // to skip writing any such column — most existing tables won't have one.
    syncTimestampColumn: null,
  },

  // --------------------------------------------------------------------
  // COLUMN NAME OVERRIDES — maps canonicalKey -> the REAL column name in
  // your existing table, when it doesn't match fieldMap.js's default
  // (e.g. fieldMap says 'DocumentNumber' but the real table calls it
  // 'DocNo'). Only add entries here for columns that actually differ —
  // anything not listed falls back to fieldMap.js's default sqlColumn.
  // --------------------------------------------------------------------
  columnOverrides: {
    // documentId: 'DocumentID',
    // docno: 'DocNo',
  },
};
