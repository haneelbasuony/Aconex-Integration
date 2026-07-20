/**
 * ============================================================================
 * DOCUMENTS API — List Documents (full register)
 *    GET https://api.aconex.com/api/projects/{projectId}/register?{params}
 * ============================================================================
 * listAllDocuments() loops through every page automatically (a single call
 * only returns one page — the Aconex default is 25 results per page) and
 * requests every documented return_field, so the result is the full
 * register with every column populated.
 * ============================================================================
 */

'use strict';

const axios = require('axios');
const { CONFIG, RESOURCE_SERVER } = require('../config');
const { authHeaders } = require('../httpClient');
const { xmlParser } = require('../utils/xml');

// ----------------------------------------------------------------------------
// Full list of fields the Documents API supports in return_fields.
// (TrackingId and VersionNumber aren't listed here because Aconex returns
// them automatically regardless of return_fields.)
// ----------------------------------------------------------------------------
const ALL_RETURN_FIELDS = [
  'approved', 'asBuiltRequired', 'attribute1', 'attribute2', 'attribute3', 'attribute4',
  'author', 'authorisedBy', 'category', 'check1', 'check2', 'comments', 'comments2',
  'confidential', 'contractDeliverable', 'contractnumber', 'contractordocumentnumber',
  'contractorrev', 'current', 'date1', 'date2', 'discipline', 'docno', 'doctype',
  'filename', 'fileSize', 'forreview', 'markupLastModifiedDate', 'milestonedate',
  'numberOfMarkups', 'packagenumber', 'percentComplete', 'plannedsubmissiondate',
  'printSize', 'projectField1', 'projectField2', 'projectField3', 'received',
  'reference', 'registered', 'reviewed', 'reviewSource', 'reviewstatus', 'revision',
  'revisiondate', 'scale', 'selectlist1', 'selectlist2', 'selectlist3', 'selectlist4',
  'selectlist5', 'selectlist6', 'selectlist7', 'selectlist8', 'selectlist9',
  'selectlist10', 'tagNumber', 'title', 'toclient', 'vdrcode', 'vendordocumentnumber',
  'vendorrev',
];

// ----------------------------------------------------------------------------
// Flatten one parsed <Document> object into a single flat row, suitable for
// a spreadsheet. Attribute1-4 are "group" fields that can hold multiple
// values, so their values are joined with "; " into one cell instead of
// producing nested columns.
// ----------------------------------------------------------------------------
function flattenDocument(doc) {
  const row = { DocumentId: doc['@_DocumentId'] };

  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith('@_')) continue; // already captured DocumentId above

    if (/^Attribute[1-4]$/.test(key)) {
      let names = value?.AttributeTypeNames?.AttributeTypeName;
      if (names === undefined) names = [];
      if (!Array.isArray(names)) names = [names];
      row[key] = names.filter(Boolean).join('; ');
    } else if (value !== null && typeof value === 'object') {
      row[key] = JSON.stringify(value); // unexpected nested structure — don't drop it
    } else {
      row[key] = value;
    }
  }

  return row;
}

// ----------------------------------------------------------------------------
// List EVERY document in the project's register, across every page.
// ----------------------------------------------------------------------------
async function listAllDocuments(accessToken, { searchQuery = '', pageSize = 100, returnFields = ALL_RETURN_FIELDS } = {}) {
  const allRows = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const response = await axios.get(`${RESOURCE_SERVER}/api/projects/${CONFIG.projectId}/register`, {
      headers: authHeaders(accessToken),
      params: {
        search_query: searchQuery,
        return_fields: returnFields.join(','),
        search_type: 'PAGED',
        page_size: pageSize,      // must be a multiple of 25, max 500
        page_number: currentPage,
        sort_field: 'docno',
        sort_direction: 'ASC',
        show_document_history: false,
      },
    });

    const parsed = xmlParser.parse(response.data);
    const search = parsed.RegisterSearch;

    totalPages = parseInt(search?.['@_TotalPages'] || '1', 10);
    const totalResults = search?.['@_TotalResults'] || '?';

    // fast-xml-parser returns a single object (not an array) when there's
    // only one <Document> on the page — normalize to an array either way.
    let docs = search?.SearchResults?.Document || [];
    if (!Array.isArray(docs)) docs = [docs];

    const rows = docs.map(flattenDocument);
    allRows.push(...rows);

    console.log(`✔ Page ${currentPage}/${totalPages} retrieved (${rows.length} documents, ${totalResults} total)`);
    currentPage++;
  } while (currentPage <= totalPages);

  return allRows;
}

module.exports = { listAllDocuments, flattenDocument, ALL_RETURN_FIELDS };
