const express = require('express');
const propertiesRouter = require('./routes/properties');

const app = express();

app.use(express.json());
app.use('/api/properties', propertiesRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orden-del-magen-api',
    message: 'API is running'
  });
});

module.exports = app;
