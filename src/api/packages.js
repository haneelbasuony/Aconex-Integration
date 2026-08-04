'use strict';

const axios = require('axios');
const { RESOURCE_SERVER } = require('../config');

async function getPackagePage(
  accessToken,
  {
    projectId,
    page = 1,
    limit = 100
  }
) {

  const url =
    `${RESOURCE_SERVER}/api/package-management/projects/${projectId}/packages/list`;

  const response =
    await axios.post(
      url,
      {},
      {
        params: {
          page,
          limit
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept:
            'application/vnd.aconex.packages.v1+xml',

          'Content-Type':
            'application/vnd.aconex.packages.v1+json'
        },

        responseType: 'text'
      }
    );

  return response.data;
}

async function listAllPackages(
  accessToken,
  {
    projectId,
    limit = 100
  }
) {

  const firstXml =
    await getPackagePage(
      accessToken,
      {
        projectId,
        page: 1,
        limit
      }
    );

  const totalPagesMatch =
    firstXml.match(
      /<totalPages>(\d+)<\/totalPages>/i
    );

  const totalPages =
    totalPagesMatch
      ? parseInt(totalPagesMatch[1], 10)
      : 1;

  const pages = [
    firstXml
  ];

  for (
    let page = 2;
    page <= totalPages;
    page++
  ) {

    console.log(
      `Fetching package page ${page}/${totalPages}`
    );

    pages.push(
      await getPackagePage(
        accessToken,
        {
          projectId,
          page,
          limit
        }
      )
    );
  }

  return pages;
}

module.exports = {
  listAllPackages
};