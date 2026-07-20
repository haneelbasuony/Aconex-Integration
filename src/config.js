/**
 * ============================================================================
 * CONFIG — single source of truth for environment/config values
 * ============================================================================
 * Every other module imports CONFIG (and the derived URLs) from here instead
 * of reading process.env directly. If you ever need a new .env value, add
 * it in ONE place: here.
 * ============================================================================
 */

'use strict';

require('dotenv').config();

const syncConfig = require('../aconex.config');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required .env value: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value.trim();
}

// ----------------------------------------------------------------------------
// Everything about WHAT to run now comes from aconex.config.js's `mode`,
// not command-line flags — this decides which env values are actually
// required (e.g. projectId isn't needed for mode: 'listProjects').
// ----------------------------------------------------------------------------
const CONFIG = {
  useEarlyAccess: (process.env.ACONEX_USE_EARLY_ACCESS || 'true').toLowerCase() === 'true',
  clientId: requireEnv('ACONEX_CLIENT_ID'),
  clientSecret: requireEnv('ACONEX_CLIENT_SECRET'),
  userId: (process.env.ACONEX_USER_ID || '').trim(),
  projectId: syncConfig.mode === 'listProjects' ? (process.env.ACONEX_PROJECT_ID || null) : requireEnv('ACONEX_PROJECT_ID'),
  debug: process.env.ACONEX_DEBUG === 'true',

  // --- Needed only when syncConfig.searchMode = 'allFilters'. This is a
  // DIFFERENT userId to the Lobby one above — it's your numeric Aconex
  // user ID, sent in the request body. Both are optional: if left blank,
  // they're simply omitted from the request body.
  aconexOrgId: (process.env.ACONEX_ORG_ID || '').trim(),
  aconexSearchUserId: (process.env.ACONEX_SEARCH_USER_ID || '').trim(),
};

// ----------------------------------------------------------------------------
// ENVIRONMENT-DERIVED URLS
// ----------------------------------------------------------------------------
const LOBBY_URL = CONFIG.useEarlyAccess
  ? 'https://constructionandengineering-ea.oraclecloud.com'
  : 'https://constructionandengineering.oraclecloud.com';

const USER_SITE = CONFIG.useEarlyAccess
  ? 'https://ea1.aconex.com'
  : 'https://ksa1.aconex.com'; // <-- swap for your production instance later

// The Resource Server is the SAME for every instance, including EA1.
const RESOURCE_SERVER = 'https://api.aconex.com';

module.exports = {
  CONFIG,
  LOBBY_URL,
  USER_SITE,
  RESOURCE_SERVER,
};
