const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigrations() {
  const client = await pool.connect();

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
  runMigrations()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error('Migration failed:', error.message);
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = runMigrations;