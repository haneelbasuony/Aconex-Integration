# Aconex Documents API Client

A Node.js client for Aconex's Documents APIs using the **User-Bound Integration**
OAuth method (Lobby OAuth 2.0, `client_credentials` grant), configured for the
**Early Access (EA1)** testing environment — with optional sync into a local
SQL Server database.

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your real ACONEX_CLIENT_ID / ACONEX_CLIENT_SECRET / ACONEX_PROJECT_ID
```

## Usage — everything is controlled by `aconex.config.js`, not command-line flags

```bash
node index.js
```

That's it — always the same command. What actually happens depends entirely
on `aconex.config.js`'s `mode`:

| `mode` | What it does |
|---|---|
| `'sync'` | Fetches documents (per `searchMode`/`fields`/filters) and writes to Excel and/or SQL Server (per `output`) |
| `'listProjects'` | Prints every EA1 project your user can access — use this to find your `ACONEX_PROJECT_ID` |
| `'documentLookup'` | Fetches metadata + event log for one document (`documentLookup.documentId`), each as a `.xlsx` |

Change `mode` in `aconex.config.js`, save, run `node index.js` again — no
flags to remember.

## `aconex.config.js` — the one file to customize everything

This is the single control point. No other file needs editing for any of:

- **`mode`**: which action runs (see table above)
- **`searchMode`**: `'register'` (simple GET, Lucene query) or `'allFilters'` (structured POST, JSON filters)
- **`register.searchQuery`** / **`allFilters.filters`**: which documents to include
- **`fields`**: which columns to fetch and output — this ONE array controls both the Excel columns and the SQL table columns
- **`output.xlsx`** / **`output.sql`**: turn either destination on or off independently
- **`schedule.enabled`** / **`schedule.intervalMinutes`**: run once, or repeat automatically forever
- **`sql.tableName`** / **`sql.schema`** / **`columnOverrides`**: SQL Server table + column mapping

Example — add a column and switch to SQL output only, running every 30 minutes:
```javascript
mode: 'sync',
fields: [
  'documentId', 'docno', 'title', 'doctype',
  'packagenumber',   // <- just add the canonicalKey here
],
output: { xlsx: false, sql: true },
schedule: { enabled: true, intervalMinutes: 30 },
```
No code changes needed for any of this.

Field names available for `fields` are defined in `src/utils/fieldMap.js` —
extend that file first if you need a field not already listed there.

## Running on a schedule (every 30 minutes)

Two ways to achieve this — pick one, not both:

**Option A — let the script manage its own timing (`schedule.enabled: true`)**
```bash
node index.js
```
With `schedule.enabled: true` in `aconex.config.js`, this runs an initial
sync immediately, then keeps the process alive and re-runs automatically
every `intervalMinutes` (using `node-cron` internally). Stop it with
Ctrl+C. A run that's still in progress when the next one would start is
automatically skipped (not queued) so overlapping syncs can't stack up.
Since the process must stay running continuously, you'd typically run this
inside something that keeps it alive across reboots (e.g. `pm2`, or a
Windows service wrapper) — plain `node index.js` in a terminal stops if you
close the window or log out.

**Option B — let Windows Task Scheduler call it every 30 minutes (`schedule.enabled: false`)**
Leave `schedule.enabled: false` (the default) — each run does one sync and
exits. Create a Windows Task Scheduler task that runs `node index.js`
every 30 minutes. This is generally the more robust choice for unattended
long-term use: Task Scheduler survives reboots, logs failures, and doesn't
depend on a terminal window staying open.

## SQL Server connection — three auth modes, auto-detected

`src/db/sqlSync.js` automatically picks the right backend based on what's
filled in `.env` — no mode flag to set yourself:

| What's in `.env` | Backend used | Compilation needed? |
|---|---|---|
| `SQL_CONNECTION_STRING` set | `mssql` + `msnodesqlv8` (native ODBC) | **Yes** — needs Visual Studio Build Tools |
| `SQL_USER` set (no connection string) | `mssql` + `tedious` (SQL login) | No — pure JavaScript |
| Neither set, `SQL_SERVER`/`SQL_DATABASE` filled in | Python + `pyodbc` (Windows auth) | No — and doesn't depend on PowerShell execution policy either |

### If your manager gave you a Windows-auth connection string

This is **Windows Integrated Security** — no username/password, SQL Server
trusts whichever Windows account is running the process (same as SSMS).
Three ways to achieve this from Node, in order of practicality on a
locked-down company machine:

**Recommended: Python/pyodbc path (Mode 3 above)**

This needs no native compilation, and if a colleague already has working
Python code connecting to the same server (e.g. via `pyodbc` or
SQLAlchemy with `trusted_connection=yes`), it's proven to work on your
exact machine already. Node writes the fetched rows to a temp file and
hands off to `scripts/upsert_to_sql.py`, which does the actual connection
+ upsert using the same approach.

```
SQL_SERVER=your-server
SQL_DATABASE=Your Database Name
```
Leave `SQL_CONNECTION_STRING`, `SQL_USER`, and `SQL_PASSWORD` all blank.

Setup: `pip install pyodbc` (the ODBC Driver for SQL Server itself is
likely already installed if anyone on your team has working Python SQL
Server code — check with `python -c "import pyodbc; print(pyodbc.drivers())"`
if unsure).

**If you have Visual Studio Build Tools available — native ODBC path (Mode 1 above)**

`msnodesqlv8` needs the **ODBC connection string format**, different from
a raw ADO.NET string (e.g. `Data Source=...;Integrated Security=True;...`).
It's the same format Python's `pyodbc` uses:
```
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=your-server;Database=your-database;Trusted_Connection=Yes;
```
Requires `npm install` to successfully compile `msnodesqlv8` — needs
Python + Visual Studio Build Tools ("Desktop development with C++"
workload).

### If you're ever given a SQL Server login instead (Mode 2 above)

```
SQL_SERVER=your-server
SQL_DATABASE=your-database
SQL_USER=your-login
SQL_PASSWORD=your-password
```
No compilation needed — uses the pure-JS `tedious` driver.

### Testing the connection

```powershell
node test-db-connection.js
```
This dispatches to the correct diagnostic automatically, whichever mode
is active, and reports the real table columns it can see — useful for
filling in `columnOverrides` correctly.

### What this project will and won't do to the database

All three backends only ever execute a parameterized `MERGE` statement
(upsert) — none of them can create, alter, or drop anything. They read/
write row data into columns that must already exist. If a column name is
wrong, SQL Server rejects the query with a clear "Invalid column name"
error — never an auto-create attempt.

**Testing boundary, for transparency:** the actual database connection
(all three modes) can only be verified on a machine with real SQL Server
access — none was available while building this. What's been verified
here: the config → column-mapping logic for all three backends, that the
generated `MERGE` SQL (Node/mssql and Python/pyodbc versions) is
syntactically valid T-SQL, the backend auto-selection dispatch logic, and
a full simulated round-trip of the Node → temp-file → Python data pipeline
(with `pyodbc`'s actual network connection stubbed out, since no real SQL
Server was reachable while building this). The genuine database
connection itself is the one thing that could only be verified by
actually running it on your machine.

## Project structure

```
aconex.config.js             the ONE file to customize mode/search/fields/output/schedule
index.js                     entry point — dispatches by mode, handles scheduling
test-db-connection.js        standalone SQL Server connection diagnostic
scripts/
  upsert_to_sql.py             Python/pyodbc upsert (Windows auth, no compilation)
  test_connection.py            Python/pyodbc connection diagnostic
src/
  config.js                  .env loading, derived URLs, mode-aware requirements
  httpClient.js              shared Authorization/Accept header helper
  auth/
    oauth.js                 Lobby OAuth token request (client_credentials)
  api/
    projects.js               List Projects
    documents.js               List Documents (all pages, all fields) — XML-based
    documentsAllFilters.js     All Filters List Documents (JSON-based search)
    documentDetails.js         Metadata / Event Log / Download File
  db/
    sqlSync.js                   auto-selects the right backend based on .env
    mssqlConnection.js          MSSQL connection (native ODBC or SQL login)
    documentRegisterRepository.js  column mapping + MERGE upsert (mssql package)
    pythonUpsert.js               column mapping + delegates upsert to Python
  export/
    xlsxExporter.js            writes document rows to a formatted .xlsx
  utils/
    xml.js                     shared XML parser + filename extraction
    fieldMap.js                canonical field dictionary (XML name <-> JSON name <-> SQL column) + row normalization
```

## Two different search APIs

This project wraps **two** distinct Aconex search endpoints:

| | `documents.js` (`searchMode: 'register'`) | `documentsAllFilters.js` (`searchMode: 'allFilters'`) |
|---|---|---|
| HTTP method | GET | POST |
| Request format | URL query string, Lucene syntax | JSON body |
| Response format | XML | JSON |
| Filtering | Single Lucene query string | Structured fields: date-range qualifiers (BETWEEN/BEFORE/LAST7DAYS/etc.), `projectFieldsJSON`, multi-value lists |
| Best for | Simple filters, or none at all | Complex multi-condition filters |

**Important:** Aconex document IDs are 18-19 digit integers, exceeding
JavaScript's safe integer range. `documentsAllFilters.js` uses the
`json-bigint` package to parse responses so IDs never get silently
corrupted — don't replace this with plain `JSON.parse` / axios defaults.

`fieldMap.js` normalizes both APIs' differently-named fields into one
canonical set, so `aconex.config.js`'s `fields` list works identically
regardless of which `searchMode` is active.

## Adding a new API

1. Create a new file under `src/api/` (e.g. `src/api/workflows.js`).
2. Import what you need from `../config` and `../httpClient`, write your
   function(s), and `module.exports` them — follow the pattern in
   `src/api/projects.js` for the simplest example.
3. `require()` it in `index.js` and wire it into a new `mode`, or call it
   from an existing one.

## Switching to production later

Set `ACONEX_USE_EARLY_ACCESS=false` in `.env` and register a **separate**
OAuth Client in the production Lobby (EA credentials don't carry over).
Also update the production `USER_SITE` value in `src/config.js` to match
your real instance (currently defaults to `ksa1.aconex.com`).

## Notes

- Early Access is for testing/POC only — data may be wiped without warning.
- Access tokens expire after 1 hour. Each run gets a fresh token — no
  refresh flow needed, this is fine even for scheduled runs every 30 min.
- `page_size` must always be a multiple of 25 (max 500).
- Confidential documents are silently excluded from results/metadata/
  downloads/event logs unless you're on that document's access list.
- Some documents are metadata-only placeholders with no backing file —
  downloading one returns `CANNOT_DOWNLOAD_EMPTY_DOCUMENT` (HTTP 400).
# Aconex-Integration
