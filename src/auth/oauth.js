/**
 * ============================================================================
 * OAUTH — User-Bound Integration, Lobby OAuth 2.0 (client_credentials grant)
 * ============================================================================
 * The token is issued by the ORACLE CONSTRUCTION & ENGINEERING LOBBY, not by
 * the Aconex instance itself. Auth is HTTP Basic (base64 client_id:secret)
 * in the Authorization header — not form fields.
 * ============================================================================
 */

'use strict';

const axios = require('axios');
const { CONFIG, LOBBY_URL, USER_SITE } = require('../config');

async function getAccessToken() {
  const basicAuth = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');

  // Safe debug output — never prints the real secret, just enough to
  // confirm the .env values loaded correctly (right length, no stray
  // quotes/whitespace). Enable with ACONEX_DEBUG=true in .env.
  if (CONFIG.debug) {
    console.log('--- DEBUG: credentials loaded from .env ---');
    console.log(`clientId: "${CONFIG.clientId}" (length ${CONFIG.clientId.length})`);
    console.log(`clientSecret: length ${CONFIG.clientSecret.length}, starts "${CONFIG.clientSecret.slice(0, 3)}...", ends "...${CONFIG.clientSecret.slice(-3)}"`);
    console.log(`Token endpoint: ${LOBBY_URL}/auth/token`);
    console.log('--------------------------------------------\n');
  }

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  // Only needed if the Lobby account bound to your integration has MORE
  // than one linked Aconex account — otherwise the Lobby resolves the
  // single account automatically.
  if (CONFIG.userId) {
    body.append('user_id', CONFIG.userId);
    body.append('user_site', USER_SITE);
  }

  const response = await axios.post(`${LOBBY_URL}/auth/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
  });

  console.log(`✔ Access token acquired from ${LOBBY_URL} (expires in ${response.data.expires_in}s)`);
  return response.data.access_token;
}

module.exports = { getAccessToken };
