/**
 * ============================================================================
 * XML UTILITIES — shared parser instance + small extraction helpers
 * ============================================================================
 * Aconex's Documents APIs return XML (there's no native JSON representation).
 * This module centralizes parsing so every API module handles XML the same
 * way instead of each writing its own regex.
 * ============================================================================
 */

'use strict';

const { XMLParser } = require('fast-xml-parser');

// Keeps attributes (like DocumentId="...") alongside child elements,
// prefixed with "@_" so they're distinguishable from real fields.
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// Pulls the Filename (and its extension) out of a metadata XML response.
// Returns { filename: null, extension: null } for placeholder documents
// that have no backing file at all.
function extractFilenameFromMetadata(metadataXml) {
  const filenameMatch = metadataXml.match(/<Filename>(.*?)<\/Filename>/);
  const filename = filenameMatch ? filenameMatch[1] : null;
  const extensionMatch = filename ? filename.match(/\.([a-zA-Z0-9]+)$/) : null;
  return { filename, extension: extensionMatch ? extensionMatch[1] : null };
}

module.exports = { xmlParser, extractFilenameFromMetadata };
