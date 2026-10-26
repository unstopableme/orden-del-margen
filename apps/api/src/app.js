const express = require('express');
const defaultPool = require('./db');
const { createCommunityRouter } = require('./routes/community');

function configuredOrigins(environment = process.env) {
  return new Set((environment.ALLOWED_FRONTEND_ORIGINS || 'http://localhost:8000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean));
}

function configuredTrustProxy(environment = process.env) {
  if (!environment.TRUST_PROXY_CIDRS) return false;
  const entries = environment.TRUST_PROXY_CIDRS.split(',').map((value) => value.trim()).filter(Boolean);
  if (entries.length === 0 || entries.some((value) => ['*', 'true', '0.0.0.0/0', '::/0'].includes(value))) {
    throw new Error('TRUST_PROXY_CIDRS must contain explicit trusted proxy addresses or subnets');
  }
  return entries;
}

function configuredGameplayApiEnabled(environment = process.env) {
  const value = environment.GAMEPLAY_API_ENABLED;
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('GAMEPLAY_API_ENABLED must be true or false');
}

function configuredEconomyApiEnabled(environment = process.env) {
  const value = environment.ECONOMY_API_ENABLED;
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('ECONOMY_API_ENABLED must be true or false');
}

function configuredOrganizationProfileApiEnabled(environment = process.env) {
  const value = environment.ORGANIZATION_PROFILE_API_ENABLED;
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('ORGANIZATION_PROFILE_API_ENABLED must be true or false');
}

function createApp({
  pool = defaultPool,
  communityPersistence = null,
  allowedOrigins = configuredOrigins(),
  trustProxy = configuredTrustProxy(),
  rateLimitStore,
  rateLimits,
  communityAuthenticate,
  organizationProfileApiEnabled = configuredOrganizationProfileApiEnabled(),
  organizationProfileAuthenticate = null,
  authorizeOrganizationProfile = null,
  gameplayApiEnabled = configuredGameplayApiEnabled(),
  gameplayCollectionService = null,
  gameplayTrainingService = null,
  gameplayAuthenticate = null,
  economyApiEnabled = configuredEconomyApiEnabled(),
  economyService = null,
  economyAuthenticate = null
} = {}) {
if (typeof gameplayApiEnabled !== 'boolean') {
  throw new TypeError('gameplayApiEnabled must be a boolean');
}
if (gameplayApiEnabled && !pool) {
  throw new Error('GAMEPLAY_API_ENABLED requires PostgreSQL');
}
if (gameplayApiEnabled && (!gameplayCollectionService || !gameplayAuthenticate)) {
  throw new Error('GAMEPLAY_API_ENABLED requires the gameplay service and authenticated middleware');
}
if (typeof economyApiEnabled !== 'boolean') {
  throw new TypeError('economyApiEnabled must be a boolean');
}
if (economyApiEnabled && !pool) {
  throw new Error('ECONOMY_API_ENABLED requires PostgreSQL');
}
if (economyApiEnabled && (!economyService || !economyAuthenticate)) {
  throw new Error('ECONOMY_API_ENABLED requires the economy service and authenticated middleware');
}
if (typeof organizationProfileApiEnabled !== 'boolean') {
  throw new TypeError('organizationProfileApiEnabled must be a boolean');
}
if (organizationProfileApiEnabled && !pool) {
  throw new Error('ORGANIZATION_PROFILE_API_ENABLED requires PostgreSQL');
}
if (organizationProfileApiEnabled &&
    (typeof organizationProfileAuthenticate !== 'function' ||
     typeof authorizeOrganizationProfile !== 'function')) {
  throw new Error('ORGANIZATION_PROFILE_API_ENABLED requires authenticated middleware and organization authorization');
}

const app = express();
app.set('trust proxy', trustProxy);

app.use((req, res, next) => {
  const origin = req.get('origin');
  const originAllowed = origin && allowedOrigins.has(origin);
  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    if (origin && !originAllowed) {
      return res.status(403).json({ error: { code: 'CORS_ORIGIN_FORBIDDEN', message: 'Origin is not allowed' } });
    }
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

if (pool) {
  const acquisitionsRouter = require('./routes/acquisitions');
  const opportunitiesRouter = require('./routes/opportunities');
  const propertiesRouter = require('./routes/properties');

  app.use((req, res, next) => {
    req.db = pool;
    next();
  });

  app.use('/api/properties', propertiesRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/acquisitions', acquisitionsRouter);
}

if (organizationProfileApiEnabled) {
  const { createOrganizationProfileRouter } = require('./routes/organizations');
  app.use('/api/organizations', createOrganizationProfileRouter({
    authenticate: organizationProfileAuthenticate,
    authorizeOrganizationProfile
  }));
}

if (gameplayApiEnabled) {
  const { createGameplayRouter } = require('./routes/gameplay');
  app.use('/api/gameplay', createGameplayRouter({
    service: gameplayCollectionService,
    trainingService: gameplayTrainingService,
    authenticate: gameplayAuthenticate,
    rateLimitStore,
    rateLimits
  }));
}

if (economyApiEnabled) {
  const { createEconomyRouter } = require('./economy/economy.routes');
  app.use('/api/economy', createEconomyRouter({
    service: economyService,
    authenticate: economyAuthenticate
  }));
}

app.use('/api/community', createCommunityRouter({
  persistence: communityPersistence,
  rateLimitStore,
  rateLimits,
  authenticate: communityAuthenticate
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orden-del-margen-api',
    message: 'API is running'
  });
});

app.use((error, req, res, next) => {
  void req;
  void next;
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } });
  }
  console.error('Request failed:', error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
});

return app;
}

module.exports = createApp({ gameplayApiEnabled: false, organizationProfileApiEnabled: false });
module.exports.createApp = createApp;
module.exports.configuredOrigins = configuredOrigins;
module.exports.configuredTrustProxy = configuredTrustProxy;
module.exports.configuredGameplayApiEnabled = configuredGameplayApiEnabled;
module.exports.configuredEconomyApiEnabled = configuredEconomyApiEnabled;
module.exports.configuredOrganizationProfileApiEnabled = configuredOrganizationProfileApiEnabled;
