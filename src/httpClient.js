/**
 * ============================================================================
 * HTTP CLIENT HELPERS — shared by every module that calls the Resource Server
 * ============================================================================
 */

'use strict';

// Every Documents API call needs the same Bearer token + Accept header.
// Centralizing it here means if Aconex ever changes header requirements,
// there's exactly one place to fix it.
function authHeaders(accessToken, accept = 'application/xml') {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: accept,
  };
}

module.exports = { authHeaders };
