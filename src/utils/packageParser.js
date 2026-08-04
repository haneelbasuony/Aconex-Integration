'use strict';

const { parseStringPromise } =
  require('xml2js');

function getValue(v) {
  if (
    v === undefined ||
    v === null
  ) {
    return null;
  }

  if (typeof v === 'string') {
    const trimmed = v.trim();

    return trimmed || null;
  }

  return v;
}

function flattenPackage(pkg, projectId) {

  const projectFields =
    pkg?.projectFields?.projectFields || [];

  const fields =
    Array.isArray(projectFields)
      ? projectFields
      : [projectFields];

  const values =
    fields.map(field =>
      field?.values?.values ?? null
    );

  return {

    projectId:
      String(projectId),

    packageNumber:
      getValue(pkg.packageNumber),

    title:
      getValue(pkg.title),

    revision:
      getValue(pkg.revision),

    state:
      getValue(pkg.state),

    projectField1: values[0] ?? null,
    projectField2: values[1] ?? null,
    projectField3: values[2] ?? null,
    projectField4: values[3] ?? null,
    projectField5: values[4] ?? null,
    projectField6: values[5] ?? null
  };
}

async function parsePackageXml(
  xml,
  projectId
) {

  const parsed =
    await parseStringPromise(
      xml,
      {
        explicitArray: false,
        trim: true
      }
    );

  let packages =
    parsed?.entities?.content?.package;

  if (!packages) {
    return [];
  }

  if (!Array.isArray(packages)) {
    packages = [packages];
  }

  return packages
    .map(
      (p) =>
        flattenPackage(
          p,
          projectId
        )
    )
    .filter(Boolean);
}

async function parsePackagePages(
  xmlPages,
  projectId
) {

  const rows = [];

  for (const xml of xmlPages) {

    const pageRows =
      await parsePackageXml(
        xml,
        projectId
      );

    rows.push(
      ...pageRows
    );
  }

  return rows;
}

module.exports = {
  parsePackagePages
};