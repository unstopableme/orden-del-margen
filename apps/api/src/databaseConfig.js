'use strict';

const fs = require('fs');
const path = require('path');

const UNSAFE_SSL_MODES = new Set(['disable', 'allow', 'prefer', 'no-verify']);
const DATABASE_PURPOSES = new Set(['development', 'test', 'production']);

function databaseNameFromUrl(value) {
  try {
    return decodeURIComponent(new URL(value).pathname.slice(1));
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
}

function isLoopback(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function validatedConnectionString(value) {
  const parsed = new URL(value);
  for (const parameter of ['sslmode', 'sslcertmode']) {
    const setting = parsed.searchParams.get(parameter)?.toLowerCase();
    if (setting && UNSAFE_SSL_MODES.has(setting)) {
      throw new Error(`${parameter}=${setting} is forbidden; TLS verification cannot be disabled`);
    }
  }
  for (const parameter of [
    'ssl', 'sslmode', 'sslcertmode', 'sslrootcert', 'sslcert', 'sslkey',
    'uselibpqcompat', 'sslnegotiation'
  ]) {
    parsed.searchParams.delete(parameter);
  }
  return parsed.toString();
}

function readCertificateAuthority(environment) {
  if (environment.PGSSL_CA_PATH && environment.PGSSL_CA_BASE64) {
    throw new Error('Configure only one of PGSSL_CA_PATH or PGSSL_CA_BASE64');
  }
  if (environment.PGSSL_CA_BASE64) {
    return Buffer.from(environment.PGSSL_CA_BASE64, 'base64').toString('utf8');
  }
  if (environment.PGSSL_CA_PATH) {
    const certificatePath = path.resolve(environment.PGSSL_CA_PATH);
    return fs.readFileSync(certificatePath, 'utf8');
  }
  return undefined;
}

function createPoolConfig(environment = process.env) {
  if (!environment.DATABASE_URL) return null;
  const parsed = new URL(environment.DATABASE_URL);
  const mode = environment.PGSSL_MODE ||
    (environment.NODE_ENV === 'production' || !isLoopback(parsed.hostname) ? 'verify-full' : 'disable');
  if (!['verify-full', 'disable'].includes(mode)) {
    throw new Error('PGSSL_MODE must be verify-full or disable');
  }
  if (mode === 'disable' && (environment.NODE_ENV === 'production' || !isLoopback(parsed.hostname))) {
    throw new Error('PGSSL_MODE=disable is allowed only for local non-production databases');
  }

  const certificateAuthority = readCertificateAuthority(environment);
  const ssl = mode === 'verify-full'
    ? {
        rejectUnauthorized: true,
        ...(certificateAuthority ? { ca: certificateAuthority } : {}),
        ...(environment.PGSSL_SERVERNAME ? { servername: environment.PGSSL_SERVERNAME } : {})
      }
    : false;

  return {
    connectionString: validatedConnectionString(environment.DATABASE_URL),
    max: Number(environment.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl
  };
}

function assertDatabaseOperationConfiguration(environment = process.env, { allowProduction = false } = {}) {
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!DATABASE_PURPOSES.has(environment.DATABASE_PURPOSE)) {
    throw new Error('DATABASE_PURPOSE must be development, test, or production');
  }
  if (environment.DATABASE_PURPOSE === 'production' && !allowProduction) {
    throw new Error('This operation is forbidden for a production database');
  }
  const configuredName = databaseNameFromUrl(environment.DATABASE_URL);
  if (!environment.DATABASE_EXPECTED_NAME || environment.DATABASE_EXPECTED_NAME !== configuredName) {
    throw new Error('DATABASE_EXPECTED_NAME must exactly match the DATABASE_URL database name');
  }
  return { configuredName, purpose: environment.DATABASE_PURPOSE };
}

async function verifyDatabaseTarget(pool, expectedName) {
  const { rows } = await pool.query('SELECT current_database() AS database_name');
  if (rows[0]?.database_name !== expectedName) {
    throw new Error('Connected database does not match DATABASE_EXPECTED_NAME');
  }
}

module.exports = {
  assertDatabaseOperationConfiguration,
  createPoolConfig,
  databaseNameFromUrl,
  readCertificateAuthority,
  validatedConnectionString,
  verifyDatabaseTarget
};
