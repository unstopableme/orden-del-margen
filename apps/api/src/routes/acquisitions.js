// Routes for property acquisition tracking

const express = require('express');
const Acquisition = require('../models/Acquisition');

const router = express.Router();

// GET all acquisitions for an organization
router.get('/org/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const acquisitions = await Acquisition.findByOrganization(
      req.db,
      organizationId
    );
    res.json({
      count: acquisitions.length,
      data: acquisitions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single acquisition
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const acquisition = await Acquisition.findById(req.db, id);

    if (!acquisition) {
      return res.status(404).json({ message: 'Acquisition not found' });
    }

    res.json(acquisition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new acquisition
router.post('/', async (req, res) => {
  try {
    const {
      organizationId,
      opportunityId,
      propertyAddress,
      offerAmount,
      offerDate,
      status
    } = req.body;

    if (!organizationId || !propertyAddress) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const acquisition = await Acquisition.create(req.db, {
      organizationId,
      opportunityId,
      propertyAddress,
      offerAmount,
      offerDate,
      status
    });

    res.status(201).json(acquisition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update acquisition status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const acquisition = await Acquisition.updateStatus(req.db, id, status);

    if (!acquisition) {
      return res.status(404).json({ message: 'Acquisition not found' });
    }

    res.json(acquisition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET acquisitions by status
router.get('/org/:organizationId/status/:status', async (req, res) => {
  try {
    const { organizationId, status } = req.params;
    const acquisitions = await Acquisition.findByStatus(
      req.db,
      organizationId,
      status
    );

    res.json({
      count: acquisitions.length,
      status,
      data: acquisitions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
