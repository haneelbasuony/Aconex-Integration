/**
 * ============================================================================
 * DOCUMENT DETAIL APIs — Metadata, Event Log, Download File
 *    GET /api/projects/{id}/register/{docId}/metadata
 *    GET /api/projects/{id}/register/{docId}/eventlog
 *    GET /api/projects/{id}/register/{docId}[/markedup]
 * ============================================================================
 */

'use strict';

const axios = require('axios');
const fs = require('fs');
const { CONFIG, RESOURCE_SERVER } = require('../config');
const { authHeaders } = require('../httpClient');
const { xmlParser } = require('../utils/xml');

// ----------------------------------------------------------------------------
// VIEW DOCUMENT METADATA
// ----------------------------------------------------------------------------
async function getDocumentMetadata(accessToken, documentId, { saveTo = null } = {}) {
  const response = await axios.get(
    `${RESOURCE_SERVER}/api/projects/${CONFIG.projectId}/register/${documentId}/metadata`,
    { headers: authHeaders(accessToken) }
  );

  console.log(`✔ Metadata retrieved for document ${documentId}`);

  if (saveTo) {
    fs.writeFileSync(saveTo, response.data);
    console.log(`✔ Saved to ${saveTo}`);
  }

  return response.data;
}

// ----------------------------------------------------------------------------
// VIEW DOCUMENT EVENT LOG
// ----------------------------------------------------------------------------
async function getDocumentEventLog(accessToken, documentId, { saveTo = null } = {}) {
  const response = await axios.get(
    `${RESOURCE_SERVER}/api/projects/${CONFIG.projectId}/register/${documentId}/eventlog`,
    { headers: authHeaders(accessToken) }
  );

  console.log(`✔ Event log retrieved for document ${documentId}`);

  if (saveTo) {
    fs.writeFileSync(saveTo, response.data);
    console.log(`✔ Saved to ${saveTo}`);
  }

  return response.data;
}

// ----------------------------------------------------------------------------
// DOWNLOAD DOCUMENT FILE
//    Some documents are metadata-only placeholders with NO backing file.
//    Downloading one of those returns HTTP 400 CANNOT_DOWNLOAD_EMPTY_DOCUMENT
//    — that's a normal condition, not a bug, so callers should check the
//    Filename from getDocumentMetadata() first (see index.js for the pattern).
// ----------------------------------------------------------------------------
async function downloadDocumentFile(accessToken, documentId, { markedUp = false, sizeForceFetch = false, filename = null, outputDir = '.' } = {}) {
  let path = `/api/projects/${CONFIG.projectId}/register/${documentId}`;
  if (markedUp) path += '/markedup';

  const response = await axios.get(`${RESOURCE_SERVER}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Encoding': 'gzip, deflate, sdch', // recommended for large files
    },
    params: sizeForceFetch ? { sizeForceFetch: true } : undefined,
    responseType: 'arraybuffer',
  });

  const buffer = Buffer.from(response.data);
  console.log(`✔ Downloaded file for document ${documentId} (${buffer.length} bytes)`);

  const safeName = filename
    ? `document-${documentId}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    : `document-${documentId}-file.dat`;
  const savePath = `${outputDir}/${safeName}`;

  fs.writeFileSync(savePath, buffer);
  console.log(`✔ Saved to ${savePath}`);

  return { buffer, savedPath: savePath };
}

// ----------------------------------------------------------------------------
// FLATTEN — VIEW DOCUMENT METADATA response into one flat row
//    <RegisterDocument> is a single flat-ish record. Attribute1-4 are
//    "group" fields that can hold multiple values, so they get joined
//    with "; " into one cell. ConfidentialUserAccessList (only present on
//    confidential documents) is similarly flattened to a joined string.
// ----------------------------------------------------------------------------
function flattenMetadata(metadataXml) {
  const parsed = xmlParser.parse(metadataXml);
  const doc = parsed.RegisterDocument || {};
  const row = { DocumentId: doc.DocumentId };

  for (const [key, value] of Object.entries(doc)) {
    if (key === 'DocumentId') continue;

    if (/^Attribute[1-4]$/.test(key)) {
      let names = value?.AttributeTypeNames?.AttributeTypeName;
      if (names === undefined) names = [];
      if (!Array.isArray(names)) names = [names];
      row[key] = names.filter(Boolean).join('; ');
    } else if (key === 'ConfidentialUserAccessList') {
      let ids = value?.UserId;
      if (ids === undefined) ids = [];
      if (!Array.isArray(ids)) ids = [ids];
      row[key] = ids.join('; ');
    } else if (value !== null && typeof value === 'object') {
      row[key] = JSON.stringify(value); // unexpected nested structure — don't drop it
    } else {
      row[key] = value;
    }
  }

  return row;
}

// ----------------------------------------------------------------------------
// FLATTEN — VIEW DOCUMENT EVENT LOG response into one row per event
//    <ViewEventLog><SearchResults><CDEventLog EventType="..."> is a
//    repeating structure — one row per event makes sense as a table.
// ----------------------------------------------------------------------------
function flattenEventLog(eventLogXml) {
  const parsed = xmlParser.parse(eventLogXml);
  const log = parsed.ViewEventLog || {};

  let events = log?.SearchResults?.CDEventLog || [];
  if (!Array.isArray(events)) events = [events]; // normalize single-event case

  return events.map((e) => ({
    EventType: e['@_EventType'],
    Event: e.Event,
    EventTime: e.EventTime,
    Organization: e.Organization,
    User: e.User,
    Revision: e.Revision,
    VersionNumber: e.VersionNumber,
  }));
}

module.exports = {
  getDocumentMetadata,
  getDocumentEventLog,
  downloadDocumentFile,
  flattenMetadata,
  flattenEventLog,
};
