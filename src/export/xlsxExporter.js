/**
 * ============================================================================
 * XLSX EXPORTER
 * ============================================================================
 * Writes an array of flat row objects (as produced by documents.js) to a
 * real .xlsx file — one column per field (union across all rows, so a
 * field missing from one document doesn't drop a column for everyone
 * else), one row per document, bold header, auto-filter enabled.
 * ============================================================================
 */

'use strict';

const ExcelJS = require('exceljs');

// ----------------------------------------------------------------------------
// TABLE EXPORT — one column per field (union across all rows so a field
// missing from one row doesn't drop a column for everyone else), one row
// per record. Used for the document register and for event logs.
// ----------------------------------------------------------------------------
async function exportTableToXlsx(rows, outputPath, sheetName = 'Sheet1') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  sheet.columns = columns.map((c) => ({ header: c, key: c, width: 22 }));

  rows.forEach((r) => sheet.addRow(r));
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(columns.length).letter}1` };

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✔ Saved to ${outputPath} (${rows.length} rows, ${columns.length} columns)`);
}

// ----------------------------------------------------------------------------
// KEY/VALUE EXPORT — for a SINGLE record with many fields (like one
// document's metadata), a two-column "Field | Value" vertical layout reads
// far better than one wide row with 60 columns.
// ----------------------------------------------------------------------------
async function exportKeyValueToXlsx(row, outputPath, sheetName = 'Sheet1') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'Field', key: 'Field', width: 30 },
    { header: 'Value', key: 'Value', width: 60 },
  ];

  Object.entries(row).forEach(([Field, Value]) => sheet.addRow({ Field, Value }));
  sheet.getRow(1).font = { bold: true };

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✔ Saved to ${outputPath} (${Object.keys(row).length} fields)`);
}

// Kept for backward compatibility with existing calls in index.js — this
// is just exportTableToXlsx with the register's default sheet name.
async function exportRegisterToXlsx(rows, outputPath) {
  return exportTableToXlsx(rows, outputPath, 'Document Register');
}

module.exports = { exportTableToXlsx, exportKeyValueToXlsx, exportRegisterToXlsx };
