'use strict';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const CURRENCIES = new Set(['$DONCELLA', '$MARGEN']);

class MarketplaceValidationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'MarketplaceValidationError';
    this.code = code;
    this.status = status;
  }
}

function accountId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MarketplaceValidationError('INVALID_ACCOUNT', 'Authenticated account is invalid', 401);
  }
  return value;
}

function listingId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MarketplaceValidationError('INVALID_LISTING_ID', 'listingId must be a UUID');
  }
  return value;
}

function idempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_PATTERN.test(value)) {
    throw new MarketplaceValidationError('INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key must contain 1-128 supported characters');
  }
  return value;
}

class MarketplaceService {
  constructor(persistence) {
    if (!persistence || typeof persistence.createListing !== 'function' ||
        typeof persistence.cancelListing !== 'function' ||
        typeof persistence.purchaseListing !== 'function') {
      throw new TypeError('Marketplace persistence is required');
    }
    this.persistence = persistence;
  }

  verifyReady() {
    return this.persistence.verifyReady();
  }

  listActive() {
    return this.persistence.listActive();
  }

  createListing({ sellerAccountId, equipmentId, currencyType, price, idempotencyKey: key }) {
    accountId(sellerAccountId);
    if (!Number.isSafeInteger(equipmentId) || equipmentId <= 0) {
      throw new MarketplaceValidationError('INVALID_EQUIPMENT_ID', 'equipmentId must be a positive integer');
    }
    if (!CURRENCIES.has(currencyType)) {
      throw new MarketplaceValidationError('INVALID_CURRENCY', 'currencyType must be $DONCELLA or $MARGEN');
    }
    if (typeof price !== 'string' || !/^[1-9][0-9]{0,18}$/.test(price)) {
      throw new MarketplaceValidationError('INVALID_PRICE', 'price must be a positive integer string');
    }
    return this.persistence.createListing({
      sellerAccountId, equipmentId, currencyType, price, idempotencyKey: idempotencyKey(key)
    });
  }

  cancelListing({ sellerAccountId, listingId: id }) {
    return this.persistence.cancelListing({
      sellerAccountId: accountId(sellerAccountId), listingId: listingId(id)
    });
  }

  purchaseListing({ buyerAccountId, listingId: id, idempotencyKey: key }) {
    return this.persistence.purchaseListing({
      buyerAccountId: accountId(buyerAccountId), listingId: listingId(id),
      idempotencyKey: idempotencyKey(key)
    });
  }
}

module.exports = { MarketplaceService, MarketplaceValidationError };
