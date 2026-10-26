const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const { createPoolConfig } = require('./databaseConfig');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

let pool = null;
const explicitMemoryMode = process.env.COMMUNITY_STORAGE === 'memory';
const productionMode = process.env.NODE_ENV === 'production';

if (productionMode && (
  explicitMemoryMode ||
  process.env.COMMUNITY_DEMO_AUTH === 'true' ||
  process.env.COMMUNITY_SEED_DEMO === 'true'
)) {
  throw new Error('Demo authentication, demo seeding, and memory storage are forbidden in production');
}

if (process.env.DATABASE_URL && !explicitMemoryMode) {
  pool = new Pool(createPoolConfig(process.env));

  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
  });
}

module.exports = pool;
