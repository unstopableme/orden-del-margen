'use strict';

const express = require('express');
const { MarketplaceValidationError } = require('./marketplaceService');
const { MarketplacePersistenceError } = require('./queries/postgresMarketplace');

function handleError(error, res, next) {
  if (error instanceof MarketplaceValidationError || error instanceof MarketplacePersistenceError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  return next(error);
}

function body(req, res, allowed) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
      Object.keys(req.body).some((key) => !allowed.includes(key)) || Object.hasOwn(req.body, 'accountId')) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Request body is invalid' } });
    return null;
  }
  return req.body;
}

function createEconomyRouter({ service, authenticate }) {
  if (!service || typeof service.createListing !== 'function' ||
      typeof service.cancelListing !== 'function' || typeof service.purchaseListing !== 'function') {
    throw new TypeError('Marketplace service is required');
  }
  if (typeof authenticate !== 'function') throw new TypeError('Economy authentication middleware is required');

  const router = express.Router();
  router.use(authenticate);

  router.get('/marketplace/listings', async (req, res, next) => {
    try {
      return res.json({ listings: await service.listActive() });
    } catch (error) {
      return handleError(error, res, next);
    }
  });

  router.post('/marketplace/listings', async (req, res, next) => {
    const input = body(req, res, ['equipmentId', 'currencyType', 'price']);
    if (!input) return;
    try {
      const listing = await service.createListing({
        sellerAccountId: req.callerContext?.accountId,
        equipmentId: input.equipmentId,
        currencyType: input.currencyType,
        price: input.price,
        idempotencyKey: req.get('Idempotency-Key')
      });
      return res.status(201).json({ listing });
    } catch (error) {
      return handleError(error, res, next);
    }
  });

  router.post('/marketplace/listings/:listingId/cancel', async (req, res, next) => {
    const input = body(req, res, []);
    if (!input) return;
    try {
      return res.json({ listing: await service.cancelListing({
        sellerAccountId: req.callerContext?.accountId,
        listingId: req.params.listingId
      }) });
    } catch (error) {
      return handleError(error, res, next);
    }
  });

  router.post('/marketplace/listings/:listingId/purchase', async (req, res, next) => {
    const input = body(req, res, []);
    if (!input) return;
    try {
      return res.json({ listing: await service.purchaseListing({
        buyerAccountId: req.callerContext?.accountId,
        listingId: req.params.listingId,
        idempotencyKey: req.get('Idempotency-Key')
      }) });
    } catch (error) {
      return handleError(error, res, next);
    }
  });

  return router;
}

module.exports = { createEconomyRouter };
