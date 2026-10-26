'use strict';

const { randomUUID } = require('node:crypto');

class MarketplacePersistenceError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = 'MarketplacePersistenceError';
    this.code = code;
    this.status = status;
  }
}

function listingResult(row) {
  return {
    id: row.id,
    sellerAccountId: row.seller_account_id,
    buyerAccountId: row.buyer_account_id,
    equipmentId: Number(row.equipment_id),
    currencyType: row.currency_type,
    price: String(row.price),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
  };
}

async function rollback(client, originalError) {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    throw new AggregateError([originalError, rollbackError], 'Marketplace transaction and rollback both failed');
  }
  throw originalError;
}

class PostgresMarketplace {
  constructor(pool) {
    if (!pool || typeof pool.connect !== 'function') throw new TypeError('PostgreSQL pool is required');
    this.pool = pool;
  }

  async verifyReady() {
    await this.pool.query('SELECT id FROM economy_listings LIMIT 0');
  }

  async listActive() {
    const { rows } = await this.pool.query(`
      SELECT id, seller_account_id, buyer_account_id, equipment_id, currency_type,
        price, status, created_at, updated_at, completed_at
      FROM economy_listings WHERE status = 'ACTIVE'
      ORDER BY created_at DESC, id
    `);
    return rows.map(listingResult);
  }

  async createListing({ sellerAccountId, equipmentId, currencyType, price, idempotencyKey }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await client.query(`
        SELECT id, seller_account_id, buyer_account_id, equipment_id, currency_type,
          price, status, created_at, updated_at, completed_at
        FROM economy_listings
        WHERE seller_account_id = $1 AND create_idempotency_key = $2
      `, [sellerAccountId, idempotencyKey]);
      if (replay.rows[0]) {
        const existing = replay.rows[0];
        if (Number(existing.equipment_id) !== equipmentId || existing.currency_type !== currencyType ||
            String(existing.price) !== price) {
          throw new MarketplacePersistenceError('IDEMPOTENCY_CONFLICT',
            'Idempotency-Key was already used with a different listing');
        }
        await client.query('COMMIT');
        return listingResult(existing);
      }

      const equipment = await client.query(`
        SELECT id, account_id, is_equipped FROM player_equipment
        WHERE id = $1 FOR UPDATE
      `, [equipmentId]);
      if (!equipment.rows[0] || equipment.rows[0].account_id !== sellerAccountId) {
        throw new MarketplacePersistenceError('EQUIPMENT_NOT_OWNED',
          'Equipment is not owned by the authenticated account', 404);
      }
      if (equipment.rows[0].is_equipped) {
        throw new MarketplacePersistenceError('EQUIPMENT_EQUIPPED',
          'Equipped items cannot be listed');
      }

      const now = new Date();
      const inserted = await client.query(`
        INSERT INTO economy_listings
          (id, seller_account_id, equipment_id, currency_type, price,
           create_idempotency_key, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING id, seller_account_id, buyer_account_id, equipment_id, currency_type,
          price, status, created_at, updated_at, completed_at
      `, [randomUUID(), sellerAccountId, equipmentId, currencyType, price, idempotencyKey, now]);
      await client.query('COMMIT');
      return listingResult(inserted.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uq_economy_one_active_listing_per_equipment') {
        return rollback(client, new MarketplacePersistenceError('EQUIPMENT_ALREADY_LISTED',
          'Equipment already has an active listing'));
      }
      return rollback(client, error);
    } finally {
      client.release();
    }
  }

  async cancelListing({ sellerAccountId, listingId }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`
        SELECT id, seller_account_id, buyer_account_id, equipment_id, currency_type,
          price, status, created_at, updated_at, completed_at
        FROM economy_listings WHERE id = $1 FOR UPDATE
      `, [listingId]);
      const listing = rows[0];
      if (!listing || listing.seller_account_id !== sellerAccountId) {
        throw new MarketplacePersistenceError('LISTING_NOT_FOUND', 'Listing was not found', 404);
      }
      if (listing.status === 'CANCELLED') {
        await client.query('COMMIT');
        return listingResult(listing);
      }
      if (listing.status !== 'ACTIVE') {
        throw new MarketplacePersistenceError('LISTING_NOT_ACTIVE', 'Listing is no longer active');
      }
      const updated = await client.query(`
        UPDATE economy_listings
        SET status = 'CANCELLED', updated_at = clock_timestamp(), completed_at = clock_timestamp()
        WHERE id = $1
        RETURNING id, seller_account_id, buyer_account_id, equipment_id, currency_type,
          price, status, created_at, updated_at, completed_at
      `, [listingId]);
      await client.query('COMMIT');
      return listingResult(updated.rows[0]);
    } catch (error) {
      return rollback(client, error);
    } finally {
      client.release();
    }
  }

  async purchaseListing({ buyerAccountId, listingId, idempotencyKey }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`
        SELECT id, seller_account_id, buyer_account_id, equipment_id, currency_type,
          price, status, purchase_idempotency_key, created_at, updated_at, completed_at
        FROM economy_listings WHERE id = $1 FOR UPDATE
      `, [listingId]);
      const listing = rows[0];
      if (!listing) throw new MarketplacePersistenceError('LISTING_NOT_FOUND', 'Listing was not found', 404);
      if (listing.status === 'COMPLETED' && listing.buyer_account_id === buyerAccountId &&
          listing.purchase_idempotency_key === idempotencyKey) {
        await client.query('COMMIT');
        return listingResult(listing);
      }
      if (listing.status !== 'ACTIVE') {
        throw new MarketplacePersistenceError('LISTING_NOT_ACTIVE', 'Listing is no longer active');
      }
      if (listing.seller_account_id === buyerAccountId) {
        throw new MarketplacePersistenceError('SELF_PURCHASE_FORBIDDEN',
          'An account cannot purchase its own equipment listing');
      }

      const equipment = await client.query(`
        SELECT id FROM player_equipment
        WHERE id = $1 AND account_id = $2 AND is_equipped = FALSE FOR UPDATE
      `, [listing.equipment_id, listing.seller_account_id]);
      if (!equipment.rows[0]) {
        throw new MarketplacePersistenceError('ESCROW_INTEGRITY_FAILURE',
          'Listed equipment is no longer transferable');
      }

      await client.query(`
        INSERT INTO game_asset_balances (account_id, asset_code, amount)
        VALUES ($1, $3, 0), ($2, $3, 0)
        ON CONFLICT (account_id, asset_code) DO NOTHING
      `, [buyerAccountId, listing.seller_account_id, listing.currency_type]);
      const balances = await client.query(`
        SELECT account_id, amount FROM game_asset_balances
        WHERE asset_code = $1 AND account_id = ANY($2::uuid[])
        ORDER BY account_id FOR UPDATE
      `, [listing.currency_type, [buyerAccountId, listing.seller_account_id]]);
      const buyerBalance = balances.rows.find((row) => row.account_id === buyerAccountId);
      if (!buyerBalance || BigInt(buyerBalance.amount) < BigInt(listing.price)) {
        throw new MarketplacePersistenceError('INSUFFICIENT_BALANCE',
          `Insufficient ${listing.currency_type} balance`, 422);
      }

      const debited = await client.query(`
        UPDATE game_asset_balances SET amount = amount - $1, updated_at = clock_timestamp()
        WHERE account_id = $2 AND asset_code = $3 AND amount >= $1
      `, [listing.price, buyerAccountId, listing.currency_type]);
      if (debited.rowCount !== 1) {
        throw new MarketplacePersistenceError('INSUFFICIENT_BALANCE',
          `Insufficient ${listing.currency_type} balance`, 422);
      }
      await client.query(`
        UPDATE game_asset_balances SET amount = amount + $1, updated_at = clock_timestamp()
        WHERE account_id = $2 AND asset_code = $3
      `, [listing.price, listing.seller_account_id, listing.currency_type]);
      const now = new Date();
      const updated = await client.query(`
        UPDATE economy_listings
        SET status = 'COMPLETED', buyer_account_id = $1, purchase_idempotency_key = $2,
          updated_at = $3, completed_at = $3
        WHERE id = $4
        RETURNING id, seller_account_id, buyer_account_id, equipment_id, currency_type,
          price, status, created_at, updated_at, completed_at
      `, [buyerAccountId, idempotencyKey, now, listingId]);
      const transferred = await client.query(`
        UPDATE player_equipment SET account_id = $1
        WHERE id = $2 AND account_id = $3 AND is_equipped = FALSE
      `, [buyerAccountId, listing.equipment_id, listing.seller_account_id]);
      if (transferred.rowCount !== 1) {
        throw new MarketplacePersistenceError('ESCROW_INTEGRITY_FAILURE',
          'Listed equipment ownership changed during purchase');
      }
      await client.query(`
        INSERT INTO economy_settlements
          (id, listing_id, buyer_account_id, seller_account_id, equipment_id,
           currency_type, amount, occurred_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [randomUUID(), listingId, buyerAccountId, listing.seller_account_id,
        listing.equipment_id, listing.currency_type, listing.price, now]);
      await client.query('COMMIT');
      return listingResult(updated.rows[0]);
    } catch (error) {
      return rollback(client, error);
    } finally {
      client.release();
    }
  }
}

module.exports = { MarketplacePersistenceError, PostgresMarketplace };
