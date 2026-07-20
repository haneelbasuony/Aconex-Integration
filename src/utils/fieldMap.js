/**
 * ============================================================================
 * FIELD MAP — single source of truth for every document field this project
 * knows about, and how it's named in each of Aconex's three different
 * "languages":
 *
 *   canonicalKey  <- what YOU use everywhere: aconex.config.js, SQL columns
 *   xmlKey        <- the element name in GET /register (XML) responses
 *   jsonKey       <- the field name in POST /register/search (JSON) responses
 *
 * WHY THIS EXISTS
 * -----------------
 * The two search APIs name the same field differently:
 *   - GET  /register        -> XML element <DocumentNumber>
 *   - POST /register/search -> JSON field  "documentNumber"
 * Without this map, aconex.config.js would need a different field list
 * depending on which API you're using. With it, you pick canonicalKeys
 * once, and both flattenDocument() (documents.js) and
 * flattenAllFiltersDocument() (documentsAllFilters.js) translate into the
 * exact same row shape — so SQL sync and Excel export don't care which
 * API produced the data.
 *
 * EXTENDING THIS FILE
 * ----------------------
 * The jsonKey values below are confirmed for fields shown in Aconex's own
 * sample responses (docno, title, doctype, filename, attribute1-4,
 * selectlist1-10, category, comments, printSize). For fields NOT covered by
 * a documented sample, jsonKey is a best-effort guess following Aconex's
 * usual lowerCamelCase-of-the-XML-element-name pattern. If a field comes
 * back empty when using --all-filters but works fine in the default mode,
 * check the actual JSON response and correct the jsonKey here — everything
 * downstream (config, SQL, Excel) will pick up the fix automatically.
 * ============================================================================
 */

'use strict';

// sqlType is a simple internal type name — mapped to real Sequelize
// DataTypes in src/db/documentRegisterModel.js. Kept simple on purpose so
// aconex.config.js stays readable without needing to know Sequelize.
const FIELD_MAP = [
  { canonicalKey: 'documentId',     xmlKey: 'DocumentId',            jsonKey: 'documentId',      sqlColumn: 'DocumentId',          sqlType: 'bigString', length: 32  }, // primary key
  { canonicalKey: 'docno',          xmlKey: 'DocumentNumber',        jsonKey: 'documentNumber',   sqlColumn: 'DocumentNumber',       sqlType: 'string',    length: 210 },
  { canonicalKey: 'title',          xmlKey: 'Title',                 jsonKey: 'title',            sqlColumn: 'Title',                sqlType: 'string',    length: 500 },
  { canonicalKey: 'doctype',        xmlKey: 'DocumentType',          jsonKey: 'documentType',     sqlColumn: 'DocumentType',         sqlType: 'string',    length: 200 },
  { canonicalKey: 'statusid',       xmlKey: 'DocumentStatus',        jsonKey: 'statusid',         sqlColumn: 'DocumentStatus',       sqlType: 'string',    length: 100 },
  { canonicalKey: 'revision',       xmlKey: 'Revision',              jsonKey: 'revision',         sqlColumn: 'Revision',             sqlType: 'string',    length: 50  },
  { canonicalKey: 'revisiondate',   xmlKey: 'RevisionDate',          jsonKey: 'revisiondate',     sqlColumn: 'RevisionDate',         sqlType: 'date'                    },
  { canonicalKey: 'author',         xmlKey: 'Author',                jsonKey: 'author',           sqlColumn: 'Author',               sqlType: 'string',    length: 200 },
  { canonicalKey: 'category',       xmlKey: 'Category',              jsonKey: 'category',         sqlColumn: 'Category',             sqlType: 'string',    length: 200 },
  { canonicalKey: 'discipline',     xmlKey: 'Discipline',            jsonKey: 'discipline',       sqlColumn: 'Discipline',           sqlType: 'string',    length: 200 },
  { canonicalKey: 'filename',       xmlKey: 'Filename',              jsonKey: 'filename',         sqlColumn: 'Filename',             sqlType: 'string',    length: 500 },
  { canonicalKey: 'fileSize',       xmlKey: 'FileSize',              jsonKey: 'fileSize',         sqlColumn: 'FileSize',             sqlType: 'bigint'                  },
  { canonicalKey: 'fileType',       xmlKey: 'FileType',              jsonKey: 'fileType',         sqlColumn: 'FileType',             sqlType: 'string',    length: 10  },
  { canonicalKey: 'confidential',   xmlKey: 'Confidential',          jsonKey: 'confidential',     sqlColumn: 'Confidential',         sqlType: 'boolean'                 },
  { canonicalKey: 'current',        xmlKey: 'Current',               jsonKey: 'current',          sqlColumn: 'IsCurrent',            sqlType: 'boolean'                 },
  { canonicalKey: 'comments',       xmlKey: 'Comments',              jsonKey: 'comments',         sqlColumn: 'Comments',             sqlType: 'text'                    },
  { canonicalKey: 'comments2',      xmlKey: 'Comments2',             jsonKey: 'comments2',        sqlColumn: 'Comments2',            sqlType: 'text'                    },
  { canonicalKey: 'registered',     xmlKey: 'DateModified',          jsonKey: 'dateModified',     sqlColumn: 'DateModified',         sqlType: 'date'                    },
  { canonicalKey: 'received',       xmlKey: 'DateCreated',           jsonKey: 'dateCreated',      sqlColumn: 'DateCreated',          sqlType: 'date'                    },
  { canonicalKey: 'reviewed',       xmlKey: 'DateReviewed',          jsonKey: 'dateReviewed',     sqlColumn: 'DateReviewed',         sqlType: 'date'                    },
  { canonicalKey: 'approved',       xmlKey: 'DateApproved',          jsonKey: 'dateApproved',     sqlColumn: 'DateApproved',         sqlType: 'date'                    },
  { canonicalKey: 'forreview',      xmlKey: 'DateForReview',         jsonKey: 'dateForReview',    sqlColumn: 'DateForReview',        sqlType: 'date'                    },
  { canonicalKey: 'toclient',       xmlKey: 'ToClientDate',          jsonKey: 'toClientDate',     sqlColumn: 'ToClientDate',         sqlType: 'date'                    },
  { canonicalKey: 'reference',      xmlKey: 'Reference',             jsonKey: 'reference',        sqlColumn: 'Reference',            sqlType: 'string',    length: 120 },
  { canonicalKey: 'reviewSource',   xmlKey: 'ReviewSource',          jsonKey: 'reviewSource',     sqlColumn: 'ReviewSource',         sqlType: 'string',    length: 50  },
  { canonicalKey: 'reviewstatus',   xmlKey: 'ReviewStatus',          jsonKey: 'reviewstatus',     sqlColumn: 'ReviewStatus',         sqlType: 'string',    length: 50  },
  { canonicalKey: 'packagenumber',  xmlKey: 'PackageNumber',         jsonKey: 'packageNumber',    sqlColumn: 'PackageNumber',        sqlType: 'string',    length: 50  },
  { canonicalKey: 'contractnumber', xmlKey: 'ContractNumber',        jsonKey: 'contractnumber',   sqlColumn: 'ContractNumber',       sqlType: 'string',    length: 50  },
  { canonicalKey: 'vdrcode',        xmlKey: 'Vdrcode',               jsonKey: 'vdrcode',          sqlColumn: 'VdrCode',              sqlType: 'string',    length: 50  },
  { canonicalKey: 'trackingid',     xmlKey: 'TrackingId',            jsonKey: 'trackingid',       sqlColumn: 'TrackingId',           sqlType: 'bigString', length: 32  },
  { canonicalKey: 'versionnumber',  xmlKey: 'VersionNumber',         jsonKey: 'versionnumber',    sqlColumn: 'VersionNumber',        sqlType: 'integer'                 },
  { canonicalKey: 'percentComplete',xmlKey: 'PercentComplete',       jsonKey: 'percentComplete',  sqlColumn: 'PercentComplete',      sqlType: 'integer'                 },
  { canonicalKey: 'tagNumber',      xmlKey: 'TagNumber',             jsonKey: 'tagNumber',        sqlColumn: 'TagNumber',            sqlType: 'string',    length: 50  },
  { canonicalKey: 'scale',          xmlKey: 'Scale',                 jsonKey: 'scale',            sqlColumn: 'Scale',                sqlType: 'string',    length: 9   },
  { canonicalKey: 'attribute1',     xmlKey: 'Attribute1',            jsonKey: 'attribute1',       sqlColumn: 'Attribute1',           sqlType: 'text'                    },
  { canonicalKey: 'attribute2',     xmlKey: 'Attribute2',            jsonKey: 'attribute2',       sqlColumn: 'Attribute2',           sqlType: 'text'                    },
  { canonicalKey: 'attribute3',     xmlKey: 'Attribute3',            jsonKey: 'attribute3',       sqlColumn: 'Attribute3',           sqlType: 'text'                    },
  { canonicalKey: 'attribute4',     xmlKey: 'Attribute4',            jsonKey: 'attribute4',       sqlColumn: 'Attribute4',           sqlType: 'text'                    },
  { canonicalKey: 'selectlist1',    xmlKey: 'SelectList1',           jsonKey: 'selectList1',      sqlColumn: 'SelectList1',          sqlType: 'string',    length: 60  },
  { canonicalKey: 'selectlist2',    xmlKey: 'SelectList2',           jsonKey: 'selectList2',      sqlColumn: 'SelectList2',          sqlType: 'string',    length: 60  },
  { canonicalKey: 'selectlist3',    xmlKey: 'SelectList3',           jsonKey: 'selectList3',      sqlColumn: 'SelectList3',          sqlType: 'string',    length: 60  },
  { canonicalKey: 'selectlist4',    xmlKey: 'SelectList4',           jsonKey: 'selectList4',      sqlColumn: 'SelectList4',          sqlType: 'string',    length: 60  },
  { canonicalKey: 'selectlist5',    xmlKey: 'SelectList5',           jsonKey: 'selectList5',      sqlColumn: 'SelectList5',          sqlType: 'string',    length: 60  },
  { canonicalKey: 'projectField1',  xmlKey: 'ProjectField1',         jsonKey: 'projectField1',    sqlColumn: 'ProjectField1',        sqlType: 'string',    length: 120 },
  { canonicalKey: 'projectField2',  xmlKey: 'ProjectField2',         jsonKey: 'projectField2',    sqlColumn: 'ProjectField2',        sqlType: 'string',    length: 120 },
  { canonicalKey: 'projectField3',  xmlKey: 'ProjectField3',         jsonKey: 'projectField3',    sqlColumn: 'ProjectField3',        sqlType: 'string',    length: 120 },
];

// Fast lookup helpers used by the two flatten functions and the DB model.
const byXmlKey = Object.fromEntries(FIELD_MAP.map((f) => [f.xmlKey, f]));
const byJsonKey = Object.fromEntries(FIELD_MAP.map((f) => [f.jsonKey, f]));
const byCanonicalKey = Object.fromEntries(FIELD_MAP.map((f) => [f.canonicalKey, f]));

// ----------------------------------------------------------------------------
// Cast a raw string/primitive value to the right JS type for its sqlType.
// 'bigString' is deliberately NEVER touched as a Number — document/tracking
// IDs must stay exact strings to avoid precision loss on large integers.
// ----------------------------------------------------------------------------
function castValue(value, sqlType) {
  if (value === null || value === undefined || value === '') return null;

  switch (sqlType) {
    case 'bigString':
      return String(value);
    case 'integer':
    case 'bigint': {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean':
      return value === true || value === 'true' || value === '1' || value === 1;
    case 'date': {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case 'string':
    case 'text':
    default:
      return String(value);
  }
}

// ----------------------------------------------------------------------------
// Normalize a raw flattened row (keyed by XML element names OR JSON field
// names, depending on which search API produced it) into a canonical row
// keyed by canonicalKey, with values cast to the correct type.
//
// keyKind: 'xml'  -> row came from documents.js (flattenDocument)
//          'json' -> row came from documentsAllFilters.js (flattenAllFiltersDocument)
//
// Unmapped keys (fields not yet in FIELD_MAP) are silently skipped —
// extend FIELD_MAP above to include them rather than having them appear
// unexpectedly in SQL/Excel output.
// ----------------------------------------------------------------------------
function normalizeRow(rawRow, keyKind) {
  const lookup = keyKind === 'json' ? byJsonKey : byXmlKey;
  const row = {};

  for (const [key, rawValue] of Object.entries(rawRow)) {
    const field = lookup[key];
    if (!field) continue;
    row[field.canonicalKey] = castValue(rawValue, field.sqlType);
  }

  return row;
}

// ----------------------------------------------------------------------------
// Keep only the canonicalKeys listed in aconex.config.js's `fields` array —
// this is what makes the config file the single control point for output
// columns, regardless of how many fields were actually fetched/available.
// ----------------------------------------------------------------------------
function selectConfiguredFields(row, configuredFields) {
  const selected = {};
  for (const key of configuredFields) {
    if (key in row) selected[key] = row[key];
  }
  return selected;
}

module.exports = { FIELD_MAP, byXmlKey, byJsonKey, byCanonicalKey, normalizeRow, selectConfiguredFields };
