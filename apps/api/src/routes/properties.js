const express = require('express');
const { properties } = require('../data/mockData');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    count: properties.length,
    data: properties
  });
});

router.get('/:id', (req, res) => {
  const property = properties.find((item) => item.id === Number(req.params.id));

  if (!property) {
    return res.status(404).json({ message: 'Property not found' });
  }

  res.json(property);
});

module.exports = router;
