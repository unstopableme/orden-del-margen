'use strict';

const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const DEFAULT_JWKS_URI = 'https://auth.immutable.com/.well-known/jwks.json';

function passportConfiguration(environment = process.env) {
  const clientId = environment.IMMUTABLE_PASSPORT_CLIENT_ID?.trim();
  const issuer = environment.IMMUTABLE_PASSPORT_ISSUER?.trim();
  const jwksUri = environment.IMMUTABLE_PASSPORT_JWKS_URI?.trim() || DEFAULT_JWKS_URI;
  if (!clientId) throw new Error('IMMUTABLE_PASSPORT_CLIENT_ID is required');
  if (!issuer) throw new Error('IMMUTABLE_PASSPORT_ISSUER is required');
  const parsedIssuer = new URL(issuer);
  if (parsedIssuer.protocol !== 'https:') throw new Error('IMMUTABLE_PASSPORT_ISSUER must use HTTPS');
  const parsedJwks = new URL(jwksUri);
  if (parsedJwks.protocol !== 'https:') throw new Error('IMMUTABLE_PASSPORT_JWKS_URI must use HTTPS');
  return Object.freeze({ clientId, issuer, jwksUri });
}

function bearerToken(req) {
  const authorization = req.get('authorization');
  const match = typeof authorization === 'string'
    ? /^Bearer\s+([^\s]+)$/i.exec(authorization)
    : null;
  return match?.[1] || null;
}

function verifyJwt(token, signingClient, configuration) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, (header, callback) => {
      if (!header.kid) return callback(new Error('Token key identifier is missing'));
      signingClient.getSigningKey(header.kid, (error, key) => {
        if (error) return callback(error);
        return callback(null, key.getPublicKey());
      });
    }, {
      algorithms: ['RS256'],
      audience: configuration.clientId,
      issuer: configuration.issuer,
      clockTolerance: 5
    }, (error, payload) => error ? reject(error) : resolve(payload));
  });
}

function createImmutablePassportAuthenticator({
  identityStore,
  configuration = passportConfiguration(),
  signingClient = jwksRsa({
    jwksUri: configuration.jwksUri,
    cache: true,
    cacheMaxAge: 60 * 60 * 1000,
    cacheMaxEntries: 5,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 5_000
  })
}) {
  if (!identityStore || typeof identityStore.findByIdentity !== 'function') {
    throw new TypeError('Passport identity store is required');
  }

  return async function authenticateImmutablePassport(req, res, next) {
    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
    }
    try {
      const claims = await verifyJwt(token, signingClient, configuration);
      if (typeof claims.sub !== 'string' || !claims.sub || claims.iss !== configuration.issuer) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Passport ID token is invalid' } });
      }
      const identity = await identityStore.findByIdentity(claims.iss, claims.sub);
      if (!identity) {
        return res.status(403).json({
          error: { code: 'PASSPORT_IDENTITY_NOT_LINKED', message: 'Passport identity is not linked to a member' }
        });
      }
      req.callerContext = Object.freeze({
        memberId: identity.memberId,
        passportSubject: claims.sub,
        passportSessionId: typeof claims.sid === 'string' ? claims.sid : null,
        walletAddress: identity.walletAddress,
        properties: Object.freeze(identity.properties.map((property) => Object.freeze({ ...property })))
      });
      return next();
    } catch {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Passport ID token is invalid' } });
    }
  };
}

module.exports = {
  DEFAULT_JWKS_URI,
  bearerToken,
  createImmutablePassportAuthenticator,
  passportConfiguration,
  verifyJwt
};
