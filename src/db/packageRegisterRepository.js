'use strict';

const { getBackend } =
  require('./sqlSync');

async function syncPackageRowsToSql(
  rows
) {

  if (
    !Array.isArray(rows)
  ) {
    throw new Error(
      'Package rows must be an array.'
    );
  }

  if (
    rows.length === 0
  ) {
    console.log(
      'No package rows to synchronize.'
    );

    return;
  }

  const {
    syncPackageRowsToSql,
    closeConnection
  } = getBackend();

  try {

    await syncPackageRowsToSql(
      rows
    );

  } finally {

    await closeConnection();
  }
}

module.exports = {
  syncPackageRowsToSql
};