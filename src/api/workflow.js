/**
 * ============================================================================
 * ACONEX WORKFLOW API
 * ============================================================================
 *
 * GET:
 * /api/projects/{projectId}/workflows
 *
 * Response:
 * XML
 *
 * Example:
 *
 * <WorkflowSearch
 *     CurrentPage="1"
 *     PageSize="100"
 *     TotalPages="11"
 *     TotalResults="1098"
 *     TotalResultsOnPage="100">
 *
 *     <SearchResults>
 *         <Workflow WorkflowId="...">
 *             ...
 *         </Workflow>
 *     </SearchResults>
 *
 * </WorkflowSearch>
 *
 * This module retrieves ALL workflow pages.
 * ============================================================================
 */

'use strict';

const axios = require('axios');
const { RESOURCE_SERVER } = require('../config');


/**
 * Get one workflow page.
 */
async function getWorkflowPage(accessToken, {
  projectId,
  pageNumber = 1,
  pageSize = 1000
}) {

  if (!projectId) {
    throw new Error('projectId is required for Workflow API.');
  }

  const url =
    `${RESOURCE_SERVER}/api/projects/${projectId}/workflows`;

  console.log(`Fetching workflow page ${pageNumber}...`);

  const response = await axios.get(url, {

    params: {
      page_size: pageSize,
      page_number: pageNumber
    },

    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.aconex.workflow.v1+xml'
    },

    responseType: 'text'
  });

  return response.data;
}


/**
 * Get ALL workflow pages.
 *
 * We cannot know the number of pages before reading page 1,
 * because TotalPages is returned inside the XML response.
 */
async function listAllWorkflows(accessToken, {
  projectId,
  pageSize = 1000
}) {

  if (!projectId) {
    throw new Error('projectId is required for Workflow API.');
  }

  const firstPageXml = await getWorkflowPage(accessToken, {
    projectId,
    pageNumber: 1,
    pageSize
  });

  console.log('✔ Workflow XML page 1 retrieved');

  /*
   * Read TotalPages directly from:
   *
   * <WorkflowSearch
   *     CurrentPage="1"
   *     PageSize="100"
   *     TotalPages="11"
   *     TotalResults="1098"
   *     TotalResultsOnPage="100">
   */
  const totalPagesMatch =
    firstPageXml.match(/TotalPages="(\d+)"/i);

  const totalResultsMatch =
    firstPageXml.match(/TotalResults="(\d+)"/i);

  const totalPages =
    totalPagesMatch
      ? Number.parseInt(totalPagesMatch[1], 10)
      : 1;

  const totalResults =
    totalResultsMatch
      ? Number.parseInt(totalResultsMatch[1], 10)
      : null;

  console.log(
    `Workflow API reports ${totalResults ?? 'unknown'} total results across ${totalPages} page(s).`
  );


  /*
   * Store every XML page.
   */
  const pages = [];

  pages.push(firstPageXml);


  /*
   * Fetch pages 2 -> TotalPages.
   */
  for (
    let pageNumber = 2;
    pageNumber <= totalPages;
    pageNumber++
  ) {

    const xml = await getWorkflowPage(accessToken, {
      projectId,
      pageNumber,
      pageSize
    });

    console.log(
      `✔ Workflow XML page ${pageNumber}/${totalPages} retrieved`
    );

    pages.push(xml);
  }


  console.log(
    `✔ Retrieved ${pages.length} workflow page(s)`
  );

  return pages;
}


module.exports = {
  getWorkflowPage,
  listAllWorkflows
};