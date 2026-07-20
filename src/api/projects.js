/**
 * ============================================================================
 * PROJECTS API
 *    GET https://api.aconex.com/api/projects
 * ============================================================================
 * Returns every project the authenticated Aconex user has access to. Mainly
 * used to discover the numeric projectId to put in .env (ACONEX_PROJECT_ID).
 * ============================================================================
 */

'use strict';

const axios = require('axios');
const { RESOURCE_SERVER } = require('../config');
const { authHeaders } = require('../httpClient');

async function listProjects(accessToken) {
  const response = await axios.get(`${RESOURCE_SERVER}/api/projects`, {
    headers: authHeaders(accessToken),
  });

  console.log('✔ List Projects response received');

  // Simple regex extraction is enough here — the response shape is small
  // and predictable, so a full XML parser would be overkill.
  const projects = [];
  const projectBlocks = response.data.match(/<Project\b[^>]*>[\s\S]*?<\/Project>/g) || [];
  for (const block of projectBlocks) {
    const idMatch = block.match(/<ProjectId>(.*?)<\/ProjectId>/);
    const nameMatch = block.match(/<ProjectName>(.*?)<\/ProjectName>/);
    projects.push({
      projectId: idMatch ? idMatch[1] : null,
      projectName: nameMatch ? nameMatch[1].replace(/&amp;/g, '&') : null,
    });
  }
  return projects;
}

module.exports = { listProjects };
