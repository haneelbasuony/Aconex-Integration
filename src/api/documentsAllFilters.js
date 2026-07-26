/**
 * ============================================================================
 * ALL FILTERS LIST DOCUMENTS (aka "Super Search")
 *    POST https://api.aconex.com/api/projects/{projectId}/register/search
 * ============================================================================
 * IMPORTANT: unlike every other Documents API in this project, this one
 * speaks JSON both ways — request body is JSON, response body is JSON.
 * There is no XML involved here at all.
 *
 * This replicates Aconex's "All Filters Search" UI page. Its main advantage
 * over the classic GET /register (documents.js) is structured filtering —
 * especially project fields (projectFieldsJSON), date-range qualifiers
 * (BETWEEN/BEFORE/AFTER/LAST7DAYS/etc.), and multi-value field lists
 * (categoryValues, attribute1Values, etc.) — expressed as real JSON instead
 * of being crammed into a single Lucene query string.
 * ============================================================================
 */

'use strict';

const axios = require('axios');
const JSONbig = require('json-bigint')({ storeAsString: true });
const { CONFIG, RESOURCE_SERVER } = require('../config');

// ----------------------------------------------------------------------------
// Default fields to return if the caller doesn't specify their own. Same
// underlying field set as the GET /register endpoint's return_fields.
// ----------------------------------------------------------------------------
const DEFAULT_RETURN_FIELDS = [
 "docno",
    "title",
    "doctype",
    "statusid",
    "revision",
    "revisiondate",
    "author",
    "authorisedBy",
    "category",
    "discipline",
    "filename",
    "fileSize",
    "fileType",
    "confidential",
    "current",
    "comments",
    "comments2",
    "registered",
    "received",
    "reviewed",
    "approved",
    "forreview",
    "toclient",
    "reference",
    "reviewSource",
    "reviewstatus",
    "packagenumber",
    "contractnumber",
    "contractordocumentnumber",
    "contractorrev",
    "vendordocumentnumber",
    "vendorrev",
    "vdrcode",
    "trackingid",
    "versionnumber",
    "percentComplete",
    "tagNumber",
    "scale",
    "attribute1",
    "attribute2",
    "attribute3",
    "attribute4",
    "selectlist1",
    "selectlist2",
    "selectlist3",
    "selectlist4",
    "selectlist5",
    "selectlist6",
    "selectlist7",
    "selectlist8",
    "selectlist9",
    "selectlist10",
    "projectField1",
    "projectField2",
    "projectField3",
    "date1",
    "date2",
    "markupLastModifiedDate",
    "milestonedate",
    "numberOfMarkups",
    "plannedsubmissiondate",
    "printSize",
    "check1",
    "check2",
    "contractDeliverable",
    "asBuiltRequired"
];

// ----------------------------------------------------------------------------
// Flatten one JSON search result into a single flat row, suitable for a
// spreadsheet. attribute1-4 arrive as { attributeType, attributeNames: [...] }
// — joined into one cell, same treatment as the XML-based documents.js.
// ----------------------------------------------------------------------------
function flattenAllFiltersDocument(doc) {

  const row = {
    documentId: String(doc.id),
    projectid: process.env.ACONEX_PROJECT_ID
  };

  for (const [key,value] of Object.entries(doc)) {

    if(key === 'id') continue;

    if(/^attribute[1-4]$/.test(key) && value && typeof value === 'object'){
        row[key] = value.attributeNames?.join('; ') || null;
    }
   else {

    if (key === 'trackingid') {
        row[key] = String(value);
    }
   
    else {
        row[key] = value;
    }
     if (Array.isArray(doc.projectFields)) {
    for (const pf of doc.projectFields) {
        row[pf.name] = pf.value;
    }
}

}
  }

  return row;
}

// ----------------------------------------------------------------------------
// Run one page of an All Filters search. `filters` is a plain object of any
// of the documented request fields (docno, title, category, dateModified,
// projectFieldsJSON, categoryValues, etc.) — passed straight through.
// ----------------------------------------------------------------------------
async function searchDocumentsAllFilters(accessToken, {
  filters = {},
  returnFields = DEFAULT_RETURN_FIELDS,
  pageNumber = 1,
  resultSize = 250, // must be a multiple of 25
} = {}) {
  const body = {
    // orgId/userId are documented as required, but are only included here
    // if configured — some tenants' tokens carry enough identity already.
    ...(CONFIG.aconexOrgId ? { orgId: CONFIG.aconexOrgId } : {}),
    ...(CONFIG.aconexSearchUserId ? { userId: CONFIG.aconexSearchUserId } : {}),
    ...filters,
    returnFields,
    resultSize: String(resultSize),
    pageNumber: String(pageNumber),
  };

  const response = await axios.post(
    `${RESOURCE_SERVER}/api/projects/${CONFIG.projectId}/register/search`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // CRITICAL: Aconex document IDs are 18-19 digit integers, which
      // exceed Number.MAX_SAFE_INTEGER (16 digits). Axios's default JSON
      // parsing silently corrupts them (e.g. ...072393 becomes ...072400).
      // Fetch as raw text and parse with json-bigint (storeAsString) so
      // every ID comes through as an exact string instead.
      responseType: 'text',
      transformResponse: [(data) => JSONbig.parse(data)],
    }
  );

  return response.data; // { searchResults: [...], totalResultsCount, totalNumberOfPages, ... }
}

// ----------------------------------------------------------------------------
// Loop through every page automatically, same pattern as listAllDocuments()
// in documents.js, returning one flat array of rows across all pages.
// ----------------------------------------------------------------------------
async function searchAllDocumentsAllFilters(accessToken, {
  filters = {},
  returnFields = DEFAULT_RETURN_FIELDS,
  resultSize = 250,
} = {}) {
  const allRows = [];
  let pageNumber = 1;
  let totalPages = 1;

  do {
    const data = await searchDocumentsAllFilters(accessToken, { filters, returnFields, pageNumber, resultSize });

    totalPages = parseInt(data.totalNumberOfPages || '1', 10);
  

const rows = (data.searchResults || []).map(flattenAllFiltersDocument);

    allRows.push(...rows);

    console.log(`✔ Page ${pageNumber}/${totalPages} retrieved (${rows.length} documents, ${data.totalResultsCount} total)`);
    pageNumber++;
  } while (pageNumber <= totalPages);

  return allRows;
}

module.exports = {
  searchDocumentsAllFilters,
  searchAllDocumentsAllFilters,
  flattenAllFiltersDocument,
  DEFAULT_RETURN_FIELDS,
};
