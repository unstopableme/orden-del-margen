'use strict';

const pool = require('./db');
const data = require('./data/communityData');
const { PostgresCommunityPersistence } = require('./data/postgresCommunityPersistence');
const {
  assertDatabaseOperationConfiguration,
  verifyDatabaseTarget
} = require('./databaseConfig');

async function seedCommunityDemo() {
  const operation = assertDatabaseOperationConfiguration(process.env);
  if (!pool) throw new Error('A PostgreSQL connection is required');
  await verifyDatabaseTarget(pool, operation.configuredName);
  const persistence = new PostgresCommunityPersistence(pool);
  await persistence.initialize(data, { seed: true });
}

if (require.main === module) {
  seedCommunityDemo()
    .then(() => console.log('Community demo data initialized'))
    .catch((error) => {
      console.error('Community demo initialization refused or failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) await pool.end();
    });
}

module.exports = seedCommunityDemo;
