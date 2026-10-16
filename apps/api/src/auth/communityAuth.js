'use strict';

const crypto = require('crypto');

const DEMO_SESSIONS = Object.freeze({
  'demo-member-1-token': 'member-1',
  'demo-member-2-token': 'member-2'
});

function unauthorized(res, message = 'Authentication is required') {
  return res.status(401).json({
    error: { code: 'UNAUTHORIZED', message }
  });
}

function parseConfiguredSessions(environment = process.env) {
  if (environment.COMMUNITY_SESSION_TOKENS) {
    let sessions;
    try {
      sessions = JSON.parse(environment.COMMUNITY_SESSION_TOKENS);
    } catch {
      throw new Error('COMMUNITY_SESSION_TOKENS must be valid JSON');
    }

    if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) {
      throw new Error('COMMUNITY_SESSION_TOKENS must be a token-to-member object');
    }

    for (const [token, memberId] of Object.entries(sessions)) {
      if (!token || typeof memberId !== 'string' || !memberId.trim()) {
        throw new Error('COMMUNITY_SESSION_TOKENS contains an invalid session');
      }
    }
    return sessions;
  }

  if (environment.COMMUNITY_DEMO_AUTH === 'true') {
    if (environment.NODE_ENV === 'production') {
      throw new Error('COMMUNITY_DEMO_AUTH cannot be enabled in production');
    }
    return DEMO_SESSIONS;
  }

  return {};
}

function tokensEqual(left, right) {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function createCommunityAuthenticator(sessions = parseConfiguredSessions()) {
  const entries = Object.entries(sessions);

  return function authenticateCommunityMember(req, res, next) {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string'
      ? /^Bearer\s+([^\s]+)$/i.exec(authorization)
      : null;

    if (!match) {
      return unauthorized(res);
    }

    const session = entries.find(([token]) => tokensEqual(token, match[1]));
    if (!session) {
      return unauthorized(res, 'The session token is invalid');
    }

    req.callerContext = Object.freeze({ memberId: session[1] });
    return next();
  };
}

module.exports = {
  createCommunityAuthenticator,
  parseConfiguredSessions,
  unauthorized
};
