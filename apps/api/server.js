const app = require('./src/app');
const pool = require('./src/db');
const runMigrations = require('./src/migrate');

const PORT = process.env.PORT || 3000;

async function start() {
  await runMigrations();

  const server = app.listen(PORT, () => {
    console.log(`Orden del Magén API running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch(async (error) => {
  console.error('Unable to start API:', error.message);
  await pool.end();
  process.exitCode = 1;
});
