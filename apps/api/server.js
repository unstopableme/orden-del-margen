const app = require('./src/app');
const pool = require('./src/db');

const PORT = process.env.PORT || 3000;

async function start() {
  if (pool) {
    const runMigrations = require('./src/migrate');
    await runMigrations();
  }

  const server = app.listen(PORT, () => {
    console.log(`Orden del Margen API running on http://localhost:${PORT}`);
    console.log(pool ? 'Database configured' : 'Community demo mode: in-memory data');
  });

  const shutdown = () => {
    server.close(async () => {
      if (pool) {
        await pool.end();
      }
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch(async (error) => {
  console.error('Unable to start API:', error.message);
  if (pool) {
    await pool.end();
  }
  process.exitCode = 1;
});
