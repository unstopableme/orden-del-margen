// Routes for property management

const express = require('express');
const Property = require('../models/Property');

const router = express.Router();

// GET all properties for an organization
router.get('/org/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const properties = await Property.findByOrganization(req.db, organizationId);
    res.json({
      count: properties.length,
      data: properties
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single property
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(req.db, id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new property
router.post('/', async (req, res) => {
  try {
    const {
      organizationId,
      acquisitionId,
      address,
      city,
      state,
      zipCode,
      propertyType,
      purchasePrice,
      purchaseDate,
      status
    } = req.body;

    if (!organizationId || !address) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const property = await Property.create(req.db, {
      organizationId,
      acquisitionId,
      address,
      city,
      state,
      zipCode,
      propertyType,
      purchasePrice,
      purchaseDate,
      status
    });

    res.status(201).json(property);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update property status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const property = await Property.updateStatus(req.db, id, status);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET portfolio metrics
router.get('/org/:organizationId/metrics', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const metrics = await Property.getPortfolioMetrics(req.db, organizationId);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
