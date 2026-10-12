'use strict';

const express = require('express');
const {
  MemoryRateLimitStore,
  configuredRateLimits,
  createRateLimitMiddleware
} = require('../rateLimit');
const {
  CollectionConflictError,
  CollectionNotProvisionedError,
  BuildingUpgradeError
} = require('../gameplay/postgresIdleCollection');

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function invalidRequest(res, message) {
  return res.status(400).json({
    error: { code: 'INVALID_REQUEST', message }
  });
}

function requestBody(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    invalidRequest(res, 'Request body must be a JSON object');
    return null;
  }
  if (Object.hasOwn(req.body, 'accountId')) {
    invalidRequest(res, 'accountId is derived from authentication and must not be supplied');
    return null;
  }
  return req.body;
}

function expectedRulesFingerprint(body, res) {
  const value = body.expectedRulesFingerprint;
  if (typeof value !== 'string' || !FINGERPRINT_PATTERN.test(value)) {
    invalidRequest(res, 'expectedRulesFingerprint must be a lowercase SHA-256 fingerprint');
    return null;
  }
  return value;
}

function handleServiceError(error, res, next) {
  if (error instanceof CollectionConflictError || error instanceof CollectionNotProvisionedError ||
      error instanceof BuildingUpgradeError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message }
    });
  }
  return next(error);
}

function toBuilding(building) {
  return {
    id: building.id,
    ruleSetId: building.rule_set_id,
    buildingType: building.building_type,
    level: Number(building.level),
    assetCode: building.asset_code,
    activity: building.activity_state,
    lastSettledAt: new Date(building.last_settled_at).toISOString(),
    carryNumerator: String(building.carry_numerator)
  };
}

function createGameplayRouter({
  service,
  authenticate,
  rateLimitStore = new MemoryRateLimitStore(),
  rateLimits
}) {
  if (!service || typeof service.getAccountState !== 'function' ||
      typeof service.provisionInitialBuildings !== 'function' ||
      typeof service.collect !== 'function') {
    throw new TypeError('Gameplay collection service is required');
  }
  if (typeof authenticate !== 'function') {
    throw new TypeError('Gameplay authentication middleware is required');
  }

  const router = express.Router();
  const defaultGameplayLimits = configuredRateLimits().gameplay;
  const effectiveGameplayLimits = {
    ip: { ...defaultGameplayLimits.ip, ...rateLimits?.gameplay?.ip },
    account: { ...defaultGameplayLimits.account, ...rateLimits?.gameplay?.account }
  };
  const ipLimit = createRateLimitMiddleware({
    store: rateLimitStore,
    bucket: 'gameplay-auth-attempts',
    subject: (req) => req.ip,
    ...effectiveGameplayLimits.ip
  });
  const accountLimit = createRateLimitMiddleware({
    store: rateLimitStore,
    bucket: 'gameplay-account',
    subject: (req) => req.callerContext?.accountId,
    ...effectiveGameplayLimits.account
  });
  router.use(ipLimit);
  router.use(authenticate);
  router.use(accountLimit);

  router.get('/idle-collection', async (req, res, next) => {
    try {
      const state = await service.getAccountState({
        accountId: req.callerContext?.accountId
      });
      if (!state) {
        return res.status(404).json({
          error: { code: 'ACCOUNT_NOT_FOUND', message: 'Authenticated account was not found' }
        });
      }
      return res.json(state);
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.post('/idle-buildings/provision', async (req, res, next) => {
    const body = requestBody(req, res);
    if (!body) return;
    const fingerprint = expectedRulesFingerprint(body, res);
    if (!fingerprint) return;
    try {
      const buildings = await service.provisionInitialBuildings({
        accountId: req.callerContext?.accountId,
        expectedRulesFingerprint: fingerprint
      });
      return res.json({ buildings: buildings.map(toBuilding) });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.post('/idle-collection', async (req, res, next) => {
    const body = requestBody(req, res);
    if (!body) return;
    const fingerprint = expectedRulesFingerprint(body, res);
    if (!fingerprint) return;
    const idempotencyKey = req.get('Idempotency-Key');
    if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return invalidRequest(res, 'Idempotency-Key must contain 1-128 supported characters');
    }
    try {
      const result = await service.collect({
        accountId: req.callerContext?.accountId,
        idempotencyKey,
        expectedRulesFingerprint: fingerprint
      });
      return res.json(result);
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  router.post('/idle-buildings/:buildingType/upgrade', async (req, res, next) => {
    const body = requestBody(req, res);
    if (!body) return;
    const fingerprint = expectedRulesFingerprint(body, res);
    if (!fingerprint) return;
    if (!Number.isInteger(body.targetLevel) || body.targetLevel !== 2) {
      return invalidRequest(res, 'targetLevel must be 2 for this prototype');
    }
    const idempotencyKey = req.get('Idempotency-Key');
    if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return invalidRequest(res, 'Idempotency-Key must contain 1-128 supported characters');
    }
    try {
      const result = await service.upgradeBuilding({
        accountId: req.callerContext?.accountId,
        buildingType: req.params.buildingType,
        targetLevel: body.targetLevel,
        idempotencyKey,
        expectedRulesFingerprint: fingerprint
      });
      return res.json(result);
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  });

  return router;
}

module.exports = { createGameplayRouter };
