'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { parseConfiguredSessions } = require('../src/auth/communityAuth');

test('demo authentication is rejected in production', () => {
  assert.throws(
    () => parseConfiguredSessions({ NODE_ENV: 'production', COMMUNITY_DEMO_AUTH: 'true' }),
    /cannot be enabled in production/
  );
});

for (const [name, value] of [
  ['COMMUNITY_STORAGE', 'memory'],
  ['COMMUNITY_DEMO_AUTH', 'true'],
  ['COMMUNITY_SEED_DEMO', 'true']
]) {
  test(`${name}=${value} is rejected during production startup`, () => {
    const result = spawnSync(process.execPath, ['-e', "require('./src/db')"], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', [name]: value }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden in production/);
  });
}
