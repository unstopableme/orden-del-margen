'use strict';

const express = require('express');
const { normalizeOrganizationId } = require('../properties.js');
const { readOrganizationProfileSnapshot } = require('../organizationProfileSnapshot');

function createOrganizationProfileRouter({ authenticate, authorizeOrganizationProfile } = {}) {
  if (typeof authenticate !== 'function') {
    throw new TypeError('authenticate must be a function');
  }
  if (typeof authorizeOrganizationProfile !== 'function') {
    throw new TypeError('authorizeOrganizationProfile must be a function');
  }

  const router = express.Router();

  router.use((req, res, next) => {
    void req;
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  router.get('/:organizationId/profile', authenticate, async (req, res, next) => {
    if (!req.callerContext) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication is required' }
      });
    }

    let organizationId;
    try {
      organizationId = normalizeOrganizationId(req.params.organizationId);
    } catch (error) {
      if (error.code === 'INVALID_ORGANIZATION_ID') {
        return res.status(400).json({
          error: { code: error.code, message: error.message }
        });
      }
      return next(error);
    }

    try {
      const result = await readOrganizationProfileSnapshot({
        db: req.db,
        callerContext: req.callerContext,
        organizationId,
        authorizeOrganizationProfile
      });

      if (!result.authorized) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Organization access is not authorized' }
        });
      }
      if (!result.profile) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      return res.json(result.profile);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createOrganizationProfileRouter };