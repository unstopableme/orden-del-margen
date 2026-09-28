// Routes for property opportunity tracking

const express = require('express');
const PropertyOpportunity = require('../models/PropertyOpportunity');

const router = express.Router();

// GET all opportunities for an organization
router.get('/org/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const opportunities = await PropertyOpportunity.findByOrganization(
      req.db,
      organizationId
    );
    res.json({
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single opportunity
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await PropertyOpportunity.findById(req.db, id);

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new opportunity
router.post('/', async (req, res) => {
  try {
    const {
      organizationId,
      propertyAddress,
      propertyType,
      propertySize,
      propertyUnits,
      sellerName,
      sellerEmail,
      brokerName,
      listPrice,
      status
    } = req.body;

    if (!organizationId || !propertyAddress) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const opportunity = await PropertyOpportunity.create(req.db, {
      organizationId,
      propertyAddress,
      propertyType,
      propertySize,
      propertyUnits,
      sellerName,
      sellerEmail,
      brokerName,
      listPrice,
      status
    });

    res.status(201).json(opportunity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update opportunity status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const opportunity = await PropertyOpportunity.updateStatus(
      req.db,
      id,
      status
    );

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET opportunities by status
router.get('/org/:organizationId/status/:status', async (req, res) => {
  try {
    const { organizationId, status } = req.params;
    const opportunities = await PropertyOpportunity.findByStatus(
      req.db,
      organizationId,
      status
    );

    res.json({
      count: opportunities.length,
      status,
      data: opportunities
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
