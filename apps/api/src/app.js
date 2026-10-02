const express = require('express');
const pool = require('./db');
const communityRouter = require('./routes/community');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8000');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
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

app.use('/api/community', communityRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orden-del-magen-api',
    message: 'API is running'
  });
});

module.exports = app;
