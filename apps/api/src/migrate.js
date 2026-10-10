const fs = require('fs');
const path = require('path');
const pool = require('./db');
const {
  assertDatabaseOperationConfiguration,
  verifyDatabaseTarget
} = require('./databaseConfig');

async function runMigrations(targetPool = pool) {
  if (!targetPool) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  const client = await targetPool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDirectory = path.resolve(__dirname, '..', 'migrations');
    const filenames = fs.readdirSync(migrationsDirectory)
      .filter((filename) => filename.endsWith('.js'))
      .sort();

    for (const filename of filenames) {
      const { rows } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (rows.length > 0) {
        continue;
      }

      const migration = require(path.join(migrationsDirectory, filename));

      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`Applied migration ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  let operation;
  try {
    operation = assertDatabaseOperationConfiguration(process.env, { allowProduction: true });
  } catch (error) {
    console.error('Migration refused:', error.message);
    process.exitCode = 1;
  }

  if (operation) verifyDatabaseTarget(pool, operation.configuredName)
    .then(() => runMigrations())
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error('Migration failed:', error.message);
      if (pool) await pool.end();
      process.exitCode = 1;
    });
}

module.exports = runMigrations;
