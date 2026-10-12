'use strict';

const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const DEFAULT_JWKS_URI = 'https://auth.immutable.com/.well-known/jwks.json';

class PassportJwksUnavailableError extends Error {
  constructor(message = 'Passport signing keys are temporarily unavailable') {
    super(message);
    this.name = 'PassportJwksUnavailableError';
  }
}

function passportConfiguration(environment = process.env) {
  const clientId = environment.IMMUTABLE_PASSPORT_CLIENT_ID?.trim();
  const issuer = environment.IMMUTABLE_PASSPORT_ISSUER?.trim();
  const jwksUri = environment.IMMUTABLE_PASSPORT_JWKS_URI?.trim() || DEFAULT_JWKS_URI;
  if (!clientId) throw new Error('IMMUTABLE_PASSPORT_CLIENT_ID is required');
  if (!issuer) throw new Error('IMMUTABLE_PASSPORT_ISSUER is required');
  if (issuer.length > 2048) throw new Error('IMMUTABLE_PASSPORT_ISSUER must not exceed 2048 characters');
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

async function verifyJwt(token, signingClient, configuration) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new jwt.JsonWebTokenError('Token key identifier is missing');
  const publicKey = await new Promise((resolve, reject) => {
    signingClient.getSigningKey(decoded.header.kid, (error, key) => {
      if (error?.name === 'SigningKeyNotFoundError') return reject(error);
      if (error) return reject(new PassportJwksUnavailableError());
      try {
        return resolve(key.getPublicKey());
      } catch {
        return reject(new PassportJwksUnavailableError());
      }
    });
  });
  return new Promise((resolve, reject) => {
    jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: configuration.clientId,
      issuer: configuration.issuer,
      clockTolerance: 5
    }, (error, payload) => error ? reject(error) : resolve(payload));
  });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    let claims;
    try {
      claims = await verifyJwt(token, signingClient, configuration);
    } catch (error) {
      if (error instanceof PassportJwksUnavailableError) {
        return res.status(503).json({
          error: {
            code: 'AUTH_PROVIDER_UNAVAILABLE',
            message: 'Passport authentication is temporarily unavailable'
          }
        });
      }
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Passport ID token is invalid' } });
    }
    if (typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 255 ||
        claims.iss !== configuration.issuer) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Passport ID token is invalid' } });
    }

    let identity;
    try {
      identity = await identityStore.findByIdentity(claims.iss, claims.sub);
    } catch (error) {
      return next(error);
    }
    if (!identity) {
      return res.status(403).json({
        error: { code: 'PASSPORT_IDENTITY_NOT_LINKED', message: 'Passport identity is not linked to a member' }
      });
    }
    if (typeof identity.accountId !== 'string' || !UUID_PATTERN.test(identity.accountId)) {
      return next(new Error('Passport identity has no valid authenticated account mapping'));
    }
    req.callerContext = Object.freeze({
      accountId: identity.accountId,
      memberId: identity.memberId,
      passportSubject: claims.sub,
      passportSessionId: typeof claims.sid === 'string' ? claims.sid : null,
      walletAddress: identity.walletAddress,
      properties: Object.freeze(identity.properties.map((property) => Object.freeze({ ...property })))
    });
    return next();
  };
}

module.exports = {
  DEFAULT_JWKS_URI,
  PassportJwksUnavailableError,
  bearerToken,
  createImmutablePassportAuthenticator,
  passportConfiguration,
  verifyJwt
};
