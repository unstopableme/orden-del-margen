'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertDatabaseOperationConfiguration,
  createPoolConfig,
  validatedConnectionString
} = require('../src/databaseConfig');
const { configuredTrustProxy } = require('../src/app');

test('production PostgreSQL uses certificate verification', () => {
  const config = createPoolConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://database.example/app'
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, undefined);
});

test('provider CA and TLS server name are supported without weakening verification', () => {
  const config = createPoolConfig({
    DATABASE_URL: 'postgres://provider.example/app',
    PGSSL_MODE: 'verify-full',
    PGSSL_CA_BASE64: Buffer.from('test-provider-ca').toString('base64'),
    PGSSL_SERVERNAME: 'database.provider.example'
  });
  assert.deepEqual(config.ssl, {
    rejectUnauthorized: true,
    ca: 'test-provider-ca',
    servername: 'database.provider.example'
  });
});

for (const mode of ['disable', 'allow', 'prefer', 'no-verify']) {
  test(`DATABASE_URL cannot disable TLS verification with sslmode=${mode}`, () => {
    assert.throws(
      () => validatedConnectionString(`postgres://provider.example/app?sslmode=${mode}`),
      /forbidden/
    );
  });
}

test('safe URL SSL parameters cannot override the explicit verified TLS object', () => {
  const config = createPoolConfig({
    DATABASE_URL: 'postgres://provider.example/app?sslmode=require',
    PGSSL_MODE: 'verify-full'
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
});

test('legacy URL ssl flags are removed before node-postgres parses the connection string', () => {
  const config = createPoolConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://provider.example/app?ssl=0&uselibpqcompat=true'
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  const sanitized = new URL(config.connectionString);
  assert.equal(sanitized.searchParams.has('ssl'), false);
  assert.equal(sanitized.searchParams.has('uselibpqcompat'), false);
});

test('TLS can be disabled only for a local non-production database', () => {
  assert.equal(createPoolConfig({
    NODE_ENV: 'test', DATABASE_URL: 'postgres://127.0.0.1/app_test', PGSSL_MODE: 'disable'
  }).ssl, false);
  assert.throws(() => createPoolConfig({
    NODE_ENV: 'development', DATABASE_URL: 'postgres://remote.example/app', PGSSL_MODE: 'disable'
  }), /only for local/);
  assert.throws(() => createPoolConfig({
    NODE_ENV: 'production', DATABASE_URL: 'postgres://127.0.0.1/app', PGSSL_MODE: 'disable'
  }), /only for local/);
});

test('database operations require an explicit purpose and exact expected name', () => {
  const environment = {
    DATABASE_URL: 'postgres://127.0.0.1/application_development',
    DATABASE_PURPOSE: 'development',
    DATABASE_EXPECTED_NAME: 'application_development'
  };
  assert.deepEqual(assertDatabaseOperationConfiguration(environment), {
    configuredName: 'application_development', purpose: 'development'
  });
  assert.throws(() => assertDatabaseOperationConfiguration({
    ...environment, DATABASE_EXPECTED_NAME: 'another_database'
  }), /exactly match/);
});

test('trust proxy requires an explicit non-global allowlist', () => {
  assert.equal(configuredTrustProxy({}), false);
  assert.deepEqual(configuredTrustProxy({ TRUST_PROXY_CIDRS: '127.0.0.1,10.0.0.0/8' }),
    ['127.0.0.1', '10.0.0.0/8']);
  assert.throws(() => configuredTrustProxy({ TRUST_PROXY_CIDRS: '0.0.0.0/0' }), /explicit/);
  assert.throws(() => configuredTrustProxy({ TRUST_PROXY_CIDRS: '*' }), /explicit/);
});
