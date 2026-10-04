'use strict';

/**
 * Unmounted Express router contract for administrative appeal resolution.
 * Authentication and the transactional service must be supplied by a future
 * composition root. This artifact contains no mock credentials or mutations.
 */
const express = require('express');
const { validateResolveAppealInput } = require('./adminVerification');

function createAdminRouter({ authenticateReviewer, reviewService }) {
  if (typeof authenticateReviewer !== 'function') {
    throw new TypeError('authenticateReviewer must be a function');
  }
  if (!reviewService || typeof reviewService.resolveAppeal !== 'function') {
    throw new TypeError('reviewService.resolveAppeal must be a function');
  }

  const router = express.Router();
  router.post('/review-cases/:caseId/resolve-appeal', authenticateReviewer, async (req, res, next) => {
    const caller = req.callerContext;
    if (!caller || typeof caller !== 'object' || Array.isArray(caller)) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }

    let input;
    try {
      input = validateResolveAppealInput({
        ...(req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}),
        caseId: req.params.caseId,
        reviewerAccountId: caller.accountId,
        idempotencyKey: req.get('Idempotency-Key')
      });
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: error.message });
      }
      return next(error);
    }

    try {
      const result = await reviewService.resolveAppeal(input);
      return res.status(200).json({ success: true, result });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

module.exports = { createAdminRouter };
