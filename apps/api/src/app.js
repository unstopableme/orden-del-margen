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

function createApp({
  pool = defaultPool,
  communityPersistence = null,
  allowedOrigins = configuredOrigins(),
  trustProxy = configuredTrustProxy(),
  rateLimitStore,
  rateLimits,
  communityAuthenticate
} = {}) {
const app = express();
app.set('trust proxy', trustProxy);

app.use((req, res, next) => {
  const origin = req.get('origin');
  const originAllowed = origin && allowedOrigins.has(origin);
  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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

module.exports = createApp();
module.exports.createApp = createApp;
module.exports.configuredOrigins = configuredOrigins;
module.exports.configuredTrustProxy = configuredTrustProxy;
