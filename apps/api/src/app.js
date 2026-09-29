const express = require('express');
const propertiesRouter = require('./routes/properties');
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
app.use('/api/properties', propertiesRouter);
app.use('/api/community', communityRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orden-del-magen-api',
    message: 'API is running'
  });
});

module.exports = app;
