const express = require('express');
const pool = require('./db');
const acquisitionsRouter = require('./routes/acquisitions');
const opportunitiesRouter = require('./routes/opportunities');
const propertiesRouter = require('./routes/properties');

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  req.db = pool;
  next();
});

app.use('/api/properties', propertiesRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/acquisitions', acquisitionsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orden-del-magen-api',
    message: 'API is running'
  });
});

module.exports = app;
