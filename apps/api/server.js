const { createApp } = require('./src/app');
const pool = require('./src/db');
const communityData = require('./src/data/communityData');
const { PostgresCommunityPersistence } = require('./src/data/postgresCommunityPersistence');
const { MemoryRateLimitStore, PostgresRateLimitStore } = require('./src/rateLimit');
const { createCommunityAuthenticator } = require('./src/auth/communityAuth');
const {
  createImmutablePassportAuthenticator,
  passportConfiguration
} = require('./src/auth/immutablePassportAuth');
const { PostgresPassportIdentityStore } = require('./src/auth/passportIdentityStore');

const PORT = process.env.PORT || 3000;

async function start() {
  let communityPersistence = null;
  let rateLimitStore = new MemoryRateLimitStore();
  let communityAuthenticate;
  if (pool) {
    communityPersistence = new PostgresCommunityPersistence(pool);
    await communityPersistence.reload(communityData);
    rateLimitStore = new PostgresRateLimitStore(pool);
    await rateLimitStore.verifyReady();
  }

  const authMode = process.env.COMMUNITY_AUTH_MODE || 'configured';
  if (authMode === 'immutable-passport') {
    if (!pool) throw new Error('Immutable Passport authentication requires PostgreSQL');
    const identityStore = new PostgresPassportIdentityStore(pool);
    await identityStore.verifyReady();
    communityAuthenticate = createImmutablePassportAuthenticator({
      identityStore,
      configuration: passportConfiguration(process.env)
    });
  } else if (authMode === 'configured') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Configured static community tokens are forbidden in production');
    }
    communityAuthenticate = createCommunityAuthenticator();
  } else {
    throw new Error('COMMUNITY_AUTH_MODE must be configured or immutable-passport');
  }

  const app = createApp({ pool, communityPersistence, rateLimitStore, communityAuthenticate });

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
