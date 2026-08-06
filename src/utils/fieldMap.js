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
  {
    canonicalKey: 'documentId',
    xmlKey: 'documentId',
    jsonKey: 'documentId',
    jsonRequestKey: null,
    sqlColumn: 'DocumentId',
    sqlType: 'bigString',
    length: 32
  },

  {
    canonicalKey: 'docno',
    xmlKey: 'docno',
    jsonKey: 'documentNumber',
    jsonRequestKey: 'docno',
    sqlColumn: 'DocNo',
    sqlType: 'string',
    length: 210
  },

  {
    canonicalKey: 'title',
    xmlKey: 'title',
    jsonKey: 'title',
    jsonRequestKey: 'title',
    sqlColumn: 'Title',
    sqlType: 'string',
    length: 500
  },

  {
    canonicalKey: 'doctype',
    xmlKey: 'doctype',
    jsonKey: 'documentType',
    jsonRequestKey: 'doctype',
    sqlColumn: 'Doctype',
    sqlType: 'string',
    length: 200
  },

  {
    canonicalKey: 'statusid',
    xmlKey: 'statusid',
    jsonKey: 'documentStatus',
    jsonRequestKey: 'statusid',
    sqlColumn: 'StatusId',
    sqlType: 'string',
    length: 100
  },

  {
    canonicalKey: 'revision',
    xmlKey: 'revision',
    jsonKey: 'revision',
    jsonRequestKey: 'revision',
    sqlColumn: 'Revision',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'revisiondate',
    xmlKey: 'revisiondate',
    jsonKey: 'revisionDate',
    jsonRequestKey: 'revisiondate',
    sqlColumn: 'RevisionDate',
    sqlType: 'date'
  },

  {
    canonicalKey: 'author',
    xmlKey: 'author',
    jsonKey: 'author',
    jsonRequestKey: 'author',
    sqlColumn: 'Author',
    sqlType: 'string',
    length: 200
  },

  {
    canonicalKey: 'category',
    xmlKey: 'category',
    jsonKey: 'category',
    jsonRequestKey: 'category',
    sqlColumn: 'category',
    sqlType: 'string',
    length: 200
  },

  {
    canonicalKey: 'discipline',
    xmlKey: 'discipline',
    jsonKey: 'discipline',
    jsonRequestKey: 'discipline',
    sqlColumn: 'Discipline',
    sqlType: 'string',
    length: 200
  },

  {
    canonicalKey: 'filename',
    xmlKey: 'filename',
    jsonKey: 'filename',
    jsonRequestKey: 'filename',
    sqlColumn: 'filename',
    sqlType: 'string',
    length: 500
  },

  {
    canonicalKey: 'fileSize',
    xmlKey: 'fileSize',
    jsonKey: 'fileSize',
    jsonRequestKey: 'fileSize',
    sqlColumn: 'fileSize',
    sqlType: 'bigint'
  },

  {
    canonicalKey: 'fileType',
    xmlKey: 'fileType',
    jsonKey: 'fileType',
    jsonRequestKey: 'fileType',
    sqlColumn: 'fileType',
    sqlType: 'string',
    length: 10
  },

  {
    canonicalKey: 'confidential',
    xmlKey: 'confidential',
    jsonKey: 'confidential',
    jsonRequestKey: 'confidential',
    sqlColumn: 'confidential',
    sqlType: 'boolean'
  },

  {
    canonicalKey: 'current',
    xmlKey: 'current',
    jsonKey: 'current',
    jsonRequestKey: 'current',
    sqlColumn: 'current',
    sqlType: 'boolean'
  },

  {
    canonicalKey: 'comments',
    xmlKey: 'comments',
    jsonKey: 'comments',
    jsonRequestKey: 'comments',
    sqlColumn: 'Comments',
    sqlType: 'text'
  },

  {
    canonicalKey: 'comments2',
    xmlKey: 'comments2',
    jsonKey: 'comments2',
    jsonRequestKey: 'comments2',
    sqlColumn: 'comments2',
    sqlType: 'text'
  },

  {
    canonicalKey: 'registered',
    xmlKey: 'registered',
    jsonKey: 'dateModified',
    jsonRequestKey: 'registered',
    sqlColumn: 'Registered',
    sqlType: 'date'
  },

  {
    canonicalKey: 'received',
    xmlKey: 'received',
    jsonKey: 'dateCreated',
    jsonRequestKey: 'received',
    sqlColumn: 'received',
    sqlType: 'date'
  },

  {
    canonicalKey: 'reviewed',
    xmlKey: 'reviewed',
    jsonKey: 'dateReviewed',
    jsonRequestKey: 'reviewed',
    sqlColumn: 'reviewed',
    sqlType: 'date'
  },

  {
    canonicalKey: 'approved',
    xmlKey: 'approved',
    jsonKey: 'dateApproved',
    jsonRequestKey: 'approved',
    sqlColumn: 'approved',
    sqlType: 'date'
  },

  {
    canonicalKey: 'forreview',
    xmlKey: 'forreview',
    jsonKey: 'dateForReview',
    jsonRequestKey: 'forreview',
    sqlColumn: 'forreview',
    sqlType: 'date'
  },

  {
    canonicalKey: 'toclient',
    xmlKey: 'toclient',
    jsonKey: 'toClientDate',
    jsonRequestKey: 'toclient',
    sqlColumn: 'toclient',
    sqlType: 'date'
  },

  {
    canonicalKey: 'reference',
    xmlKey: 'reference',
    jsonKey: 'reference',
    jsonRequestKey: 'reference',
    sqlColumn: 'reference',
    sqlType: 'string',
    length: 120
  },

  {
    canonicalKey: 'reviewSource',
    xmlKey: 'reviewSource',
    jsonKey: 'reviewSource',
    jsonRequestKey: 'reviewSource',
    sqlColumn: 'ReviewSource',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'reviewstatus',
    xmlKey: 'reviewstatus',
    jsonKey: 'reviewStatus',
    jsonRequestKey: 'reviewstatus',
    sqlColumn: 'ReviewStatus',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'packagenumber',
    xmlKey: 'packagenumber',
    jsonKey: 'packageNumber',
    jsonRequestKey: 'packagenumber',
    sqlColumn: 'packageNumber',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'contractnumber',
    xmlKey: 'contractnumber',
    jsonKey: 'contractNumber',
    jsonRequestKey: 'contractnumber',
    sqlColumn: 'contractnumber',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'vdrcode',
    xmlKey: 'vdrcode',
    jsonKey: 'vdrcode',
    jsonRequestKey: 'vdrcode',
    sqlColumn: 'VDRCode',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'trackingid',
    xmlKey: 'trackingid',
    jsonKey: 'trackingid',
    jsonRequestKey: 'trackingid',
    sqlColumn: 'Trackingid',
    sqlType: 'bigString',
    length: 32
  },

  {
    canonicalKey: 'versionnumber',
    xmlKey: 'versionnumber',
    jsonKey: 'versionNumber',
    jsonRequestKey: 'versionnumber',
    sqlColumn: 'VersionNumber',
    sqlType: 'integer'
  },

  {
    canonicalKey: 'percentComplete',
    xmlKey: 'percentComplete',
    jsonKey: 'percentComplete',
    jsonRequestKey: 'percentComplete',
    sqlColumn: 'percentComplete',
    sqlType: 'integer'
  },

  {
    canonicalKey: 'tagNumber',
    xmlKey: 'tagNumber',
    jsonKey: 'tagNumber',
    jsonRequestKey: 'tagNumber',
    sqlColumn: 'tagNumber',
    sqlType: 'string',
    length: 50
  },

  {
    canonicalKey: 'scale',
    xmlKey: 'scale',
    jsonKey: 'scale',
    jsonRequestKey: 'scale',
    sqlColumn: 'scale',
    sqlType: 'string',
    length: 9
  },

  {
    canonicalKey: 'attribute1',
    xmlKey: 'attribute1',
    jsonKey: 'attribute1',
    jsonRequestKey: 'attribute1',
    sqlColumn: 'attribute1',
    sqlType: 'text'
  },

  {
    canonicalKey: 'attribute2',
    xmlKey: 'attribute2',
    jsonKey: 'attribute2',
    jsonRequestKey: 'attribute2',
    sqlColumn: 'attribute2',
    sqlType: 'text'
  },

  {
    canonicalKey: 'attribute3',
    xmlKey: 'attribute3',
    jsonKey: 'attribute3',
    jsonRequestKey: 'attribute3',
    sqlColumn: 'attribute3',
    sqlType: 'text'
  },

  {
    canonicalKey: 'attribute4',
    xmlKey: 'attribute4',
    jsonKey: 'attribute4',
    jsonRequestKey: 'attribute4',
    sqlColumn: 'attribute4',
    sqlType: 'text'
  },

  {
    canonicalKey: 'selectlist1',
    xmlKey: 'selectlist1',
    jsonKey: 'selectList1',
    jsonRequestKey: 'selectlist1',
    sqlColumn: 'SelectList1',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist2',
    xmlKey: 'selectlist2',
    jsonKey: 'selectList2',
    jsonRequestKey: 'selectlist2',
    sqlColumn: 'SelectList2',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist3',
    xmlKey: 'selectlist3',
    jsonKey: 'selectList3',
    jsonRequestKey: 'selectlist3',
    sqlColumn: 'SelectList3',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist4',
    xmlKey: 'selectlist4',
    jsonKey: 'selectList4',
    jsonRequestKey: 'selectlist4',
    sqlColumn: 'SelectList4',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist5',
    xmlKey: 'selectlist5',
    jsonKey: 'selectList5',
    jsonRequestKey: 'selectlist5',
    sqlColumn: 'SelectList5',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist6',
    xmlKey: 'selectlist6',
    jsonKey: 'selectList6',
    jsonRequestKey: 'selectlist6',
    sqlColumn: 'SelectList6',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist7',
    xmlKey: 'selectlist7',
    jsonKey: 'selectList7',
    jsonRequestKey: 'selectlist7',
    sqlColumn: 'SelectList7',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist8',
    xmlKey: 'selectlist8',
    jsonKey: 'selectList8',
    jsonRequestKey: 'selectlist8',
    sqlColumn: 'SelectList8',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist9',
    xmlKey: 'selectlist9',
    jsonKey: 'selectList9',
    jsonRequestKey: 'selectlist9',
    sqlColumn: 'SelectList9',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'selectlist10',
    xmlKey: 'selectlist10',
    jsonKey: 'selectList10',
    jsonRequestKey: 'selectlist10',
    sqlColumn: 'SelectList10',
    sqlType: 'text',
    length: 60
  },

  {
    canonicalKey: 'projectField1',
    xmlKey: 'projectField1',
    jsonKey: 'projectField1',
    jsonRequestKey: 'projectField1',
    sqlColumn: 'projectField1',
    sqlType: 'string',
    length: 120
  },

  {
    canonicalKey: 'projectField2',
    xmlKey: 'projectField2',
    jsonKey: 'projectField2',
    jsonRequestKey: 'projectField2',
    sqlColumn: 'projectField2',
    sqlType: 'string',
    length: 120
  },

  {
    canonicalKey: 'projectField3',
    xmlKey: 'projectField3',
    jsonKey: 'projectField3',
    jsonRequestKey: 'projectField3',
    sqlColumn: 'projectField3',
    sqlType: 'string',
    length: 120
  },

  {
    canonicalKey: 'projectid',
    xmlKey: null,
    jsonKey: null,
    jsonRequestKey: null,
    sqlColumn: 'ProjectId',
    sqlType: 'string',
    length: 50
  },
  {
 canonicalKey:'approvalDate',
 xmlKey:'approved',
 jsonKey:'approvalDate',
 jsonRequestKey:'approved',
 sqlColumn:'approvalDate',
 sqlType:'date'
},

{
 canonicalKey:'authorisedBy',
 xmlKey:'authorisedBy',
 jsonKey:'authorisedBy',
 jsonRequestKey:'authorisedBy',
 sqlColumn:'authorisedBy',
 sqlType:'string'
},

{
 canonicalKey:'printSize',
 xmlKey:'printSize',
 jsonKey:'printSize',
 jsonRequestKey:'printSize',
 sqlColumn:'printSize',
 sqlType:'string'
},

{
 canonicalKey:'dateForReview',
 xmlKey:'forreview',
 jsonKey:'dateForReview',
 jsonRequestKey:'forreview',
 sqlColumn:'dateForReview',
 sqlType:'date'
},

{
 canonicalKey:'dateCreated',
 xmlKey:'received',
 jsonKey:'dateCreated',
 jsonRequestKey:'received',
 sqlColumn:'Received',
 sqlType:'date'
},

{
 canonicalKey:'dateReviewed',
 xmlKey:'reviewed',
 jsonKey:'dateReviewed',
 jsonRequestKey:'reviewed',
 sqlColumn:'dateReviewed',
 sqlType:'date'
},

{
 canonicalKey:'toClientDate',
 xmlKey:'toclient',
 jsonKey:'toClientDate',
 jsonRequestKey:'toclient',
 sqlColumn:'toClientDate',
 sqlType:'date'
},

{
 canonicalKey:'noOfMarkups',
 xmlKey:'numberOfMarkups',
 jsonKey:'noOfMarkups',
 jsonRequestKey:'numberOfMarkups',
 sqlColumn:'noOfMarkups',
 sqlType:'integer'
},

{
 canonicalKey:'plannedSubmissionDate',
 xmlKey:'plannedsubmissiondate',
 jsonKey:'plannedSubmissionDate',
 jsonRequestKey:'plannedsubmissiondate',
 sqlColumn:'PlannedSubmissionDate',
 sqlType:'date'
},

{
 canonicalKey:'milestoneDate',
 xmlKey:'milestonedate',
 jsonKey:'milestoneDate',
 jsonRequestKey:'milestonedate',
 sqlColumn:'milestoneDate',
 sqlType:'date'
},

{
 canonicalKey:'markupLastModifiedDate',
 xmlKey:'markupLastModifiedDate',
 jsonKey:'markupLastModifiedDate',
 jsonRequestKey:'markupLastModifiedDate',
 sqlColumn:'markupLastModifiedDate',
 sqlType:'date'
},

{
 canonicalKey:'asBuiltRequired',
 xmlKey:'asBuiltRequired',
 jsonKey:'asBuiltRequired',
 jsonRequestKey:'asBuiltRequired',
 sqlColumn:'asBuiltRequired',
 sqlType:'boolean'
},

{
 canonicalKey:'contractDeliverable',
 xmlKey:'contractDeliverable',
 jsonKey:'contractDeliverable',
 jsonRequestKey:'contractDeliverable',
 sqlColumn:'contractDeliverable',
 sqlType:'boolean'
},

{
 canonicalKey:'check1',
 xmlKey:'check1',
 jsonKey:'check1',
 jsonRequestKey:'check1',
 sqlColumn:'Check1',
 sqlType:'boolean'
},

{
 canonicalKey:'check2',
 xmlKey:'check2',
 jsonKey:'check2',
 jsonRequestKey:'check2',
 sqlColumn:'check2',
 sqlType:'boolean'
},

{
 canonicalKey:'date1',
 xmlKey:'date1',
 jsonKey:'date1',
 jsonRequestKey:'date1',
 sqlColumn:'date1',
 sqlType:'date'
},

{
 canonicalKey:'date2',
 xmlKey:'date2',
 jsonKey:'date2',
 jsonRequestKey:'date2',
 sqlColumn:'date2',
 sqlType:'date'
},

{
 canonicalKey:'contractorDocumentNumber',
 xmlKey:'contractordocumentnumber',
 jsonKey:'contractorDocumentNumber',
 jsonRequestKey:'contractordocumentnumber',
 sqlColumn:'contractorDocumentNumber',
 sqlType:'string'
},

{
canonicalKey:'contractorRevision',
xmlKey:'contractorrev',
jsonKey:'contractorRevision',
jsonRequestKey:'contractorrev',
sqlColumn:'contractorRevision',
sqlType:'string'
},

{
canonicalKey:'vendorDocumentNumber',
xmlKey:'vendordocumentnumber',
jsonKey:'vendorDocumentNumber',
jsonRequestKey:'vendordocumentnumber',
sqlColumn:'vendorDocumentNumber',
sqlType:'string'
},

{
canonicalKey:'vendorRevision',
xmlKey:'vendorrev',
jsonKey:'vendorRevision',
jsonRequestKey:'vendorrev',
sqlColumn:'vendorRevision',
sqlType:'string'
},

// Project Fields (Custom Fields)
//------------------------------------------
{
    canonicalKey: 'ActivityCodeSwc_singleSelect',
    xmlKey: null,
    jsonKey: 'ActivityCodeSwc_singleSelect',
    sqlColumn: 'ProjectField1',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'AreaCodeSubpbs_singleSelect',
    xmlKey: null,
    jsonKey: 'AreaCodeSubpbs_singleSelect',
    sqlColumn: 'ProjectField2',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'AreaCode_singleSelect',
    xmlKey: null,
    jsonKey: 'AreaCode_singleSelect',
    sqlColumn: 'ProjectField3',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'CwpCode_singleSelect',
    xmlKey: null,
    jsonKey: 'CwpCode_singleSelect',
    sqlColumn: 'ProjectField4',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'EnppiOriginator_singleSelect',
    xmlKey: null,
    jsonKey: 'EnppiOriginator_singleSelect',
    sqlColumn: 'ProjectField5',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'EwpCode_singleSelect',
    xmlKey: null,
    jsonKey: 'EwpCode_singleSelect',
    sqlColumn: 'ProjectField6',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'IwpCode_singleSelect',
    xmlKey: null,
    jsonKey: 'IwpCode_singleSelect',
    sqlColumn: 'ProjectField7',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'OriginatorCode_singleSelect',
    xmlKey: null,
    jsonKey: 'OriginatorCode_singleSelect',
    sqlColumn: 'ProjectField8',
    sqlType: 'string',
    length: 100
},

{
    canonicalKey: 'ProcessUnitCode_singleSelect',
    xmlKey: null,
    jsonKey: 'ProcessUnitCode_singleSelect',
    sqlColumn: 'ProjectField9',
    sqlType: 'string',
    length: 100
}
];

// Fast lookup helpers used by the two flatten functions and the DB model.
const byXmlKey = Object.fromEntries(
  FIELD_MAP
    .filter(f => f.xmlKey)
    .map(f => [f.xmlKey, f])
);
const byJsonKey = Object.fromEntries(
  FIELD_MAP
    .filter(f => f.jsonKey)
    .map(f => [f.jsonKey, f])
);
const byCanonicalKey = Object.fromEntries(
  FIELD_MAP
    .filter(f => f.canonicalKey)
    .map(f => [f.canonicalKey, f])
);

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
