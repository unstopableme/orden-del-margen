'use strict';

const http = require('node:http');
const dotenv = require('dotenv');
const jwksRsa = require('jwks-rsa');
const {
  assertDatabaseOperationConfiguration,
  verifyDatabaseTarget
} = require('../src/databaseConfig');
const { passportConfiguration, verifyJwt } = require('../src/auth/immutablePassportAuth');

dotenv.config({ path: require('node:path').resolve(__dirname, '..', '.env.gameplay-dev') });

const TARGET_DATABASE = 'orden_margen_gameplay_dev';
const TARGET_MEMBER = Object.freeze({
  externalId: 'passport-developer',
  displayName: 'Passport Developer',
  handle: '@passport-dev'
});
const ALLOWED_ORIGIN = 'http://localhost:8000';
const MAX_TOKEN_BYTES = 16_384;

class PassportVerificationError extends Error {
  constructor(code) {
    super('Passport token verification failed');
    this.code = code;
  }
}

function verificationFailureCode(error) {
  if (/audience/i.test(error.message)) return 'AUDIENCE_MISMATCH';
  if (/issuer/i.test(error.message)) return 'ISSUER_MISMATCH';
  if (/expired/i.test(error.message)) return 'TOKEN_EXPIRED';
  if (/signing key|key identifier|kid/i.test(error.message)) return 'SIGNING_KEY_UNAVAILABLE';
  if (/ENOTFOUND|ECONN|timeout|network/i.test(error.message)) return 'JWKS_NETWORK_ERROR';
  return 'TOKEN_SIGNATURE_OR_FORMAT_INVALID';
}

async function linkVerifiedIdentity(token, pool, configuration, signingClient) {
  let claims;
  try {
    claims = await verifyJwt(token, signingClient, configuration);
  } catch (error) {
    throw new PassportVerificationError(verificationFailureCode(error));
  }
  if (typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 255 ||
      claims.iss !== configuration.issuer) {
    throw new PassportVerificationError('VERIFIED_IDENTITY_CLAIMS_INVALID');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const memberResult = await client.query(`
      INSERT INTO community_members
        (external_id, display_name, handle, bio, status, role, points, level, topics, badges, knowledge_score)
      VALUES ($1, $2, $3, 'Local Passport development account.', 'Ready for local testing',
        'member', 0, 1, '[]'::jsonb, '[]'::jsonb, 0)
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
      RETURNING id
    `, [TARGET_MEMBER.externalId, TARGET_MEMBER.displayName, TARGET_MEMBER.handle]);
    const member = memberResult.rows[0] || (await client.query(`
      SELECT id FROM community_members
      WHERE external_id=$1 AND display_name=$2 AND handle=$3
      FOR UPDATE
    `, [TARGET_MEMBER.externalId, TARGET_MEMBER.displayName, TARGET_MEMBER.handle])).rows[0];
    if (!member) throw new Error('The reserved development member already exists with different details');

    const community = (await client.query(
      'SELECT id FROM communities WHERE external_id=$1',
      ['casa-azul']
    )).rows[0];
    if (!community) throw new Error('The local community seed is missing');
    await client.query(`
      INSERT INTO community_memberships (member_id, community_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [member.id, community.id]);

    const existing = (await client.query(`
      SELECT member_id FROM passport_community_member_bindings
      WHERE passport_issuer=$1 AND passport_subject=$2
      FOR UPDATE
    `, [claims.iss, claims.sub])).rows[0];
    if (existing) {
      if (existing.member_id !== member.id) {
        throw new Error('This verified Passport identity is already linked to a different member');
      }
      await client.query('COMMIT');
      return { linked: false, alreadyLinked: true };
    }

    await client.query(`
      INSERT INTO passport_community_member_bindings
        (passport_issuer, passport_subject, member_id)
      VALUES ($1, $2, $3)
    `, [claims.iss, claims.sub, member.id]);
    await client.query('COMMIT');
    return { linked: true, alreadyLinked: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function start() {
  const operation = assertDatabaseOperationConfiguration(process.env);
  if (operation.configuredName !== TARGET_DATABASE || operation.purpose !== 'development') {
    throw new Error('Refusing to link identities outside the dedicated development database');
  }
  if (process.env.GAMEPLAY_API_ENABLED !== 'false') {
    throw new Error('Gameplay must remain disabled during the development identity link');
  }

  const pool = require('../src/db');
  const configuration = passportConfiguration(process.env);
  const signingClient = jwksRsa({
    jwksUri: configuration.jwksUri,
    cache: true,
    cacheMaxAge: 60 * 60 * 1000,
    cacheMaxEntries: 5,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 5_000
  });

  await verifyDatabaseTarget(pool, TARGET_DATABASE);
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin !== ALLOWED_ORIGIN) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS' && request.url === '/link') {
      response.writeHead(204).end();
      return;
    }
    if (request.method !== 'POST' || request.url !== '/link' ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
      response.writeHead(404).end();
      return;
    }

    const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.authorization || '');
    if (!match || match[1].length > MAX_TOKEN_BYTES) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'A valid Passport session is required' }));
      return;
    }

    try {
      const result = await linkVerifiedIdentity(match[1], pool, configuration, signingClient);
      response.writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify(result));
      console.log(result.alreadyLinked ? 'Development Passport identity already linked' : 'Development Passport identity linked');
      server.close();
    } catch (error) {
      if (error instanceof PassportVerificationError) {
        response.writeHead(401, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: error.message, code: error.code }));
        console.error(`Passport token verification failed: ${error.code}`);
        return;
      }
      const status = /already linked|reserved development member|community seed/i.test(error.message) ? 409 : 500;
      response.writeHead(status, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({
          error: status === 409 ? error.message : 'Development identity binding could not be saved',
          code: status === 409 ? 'BINDING_CONFLICT' : 'BINDING_PERSISTENCE_ERROR'
        }));
      if (status === 500) console.error('Development Passport identity persistence failed');
    }
  });

  server.listen(3002, '127.0.0.1', () => {
    console.log('One-time Passport development link listener ready on 127.0.0.1:3002');
  });
  server.on('close', async () => pool.end().catch(() => {}));
}

start().catch((error) => {
  console.error(`Development Passport linker refused to start: ${error.message}`);
  process.exitCode = 1;
});
