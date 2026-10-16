'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Pool } = require('pg');
const { createPoolConfig } = require('../../src/databaseConfig');
const runMigrations = require('../../src/migrate');
const { MarketplaceService } = require('../../src/economy/marketplaceService');
const { PostgresMarketplace } = require('../../src/economy/queries/postgresMarketplace');

const testUrl = process.env.ECONOMY_TEST_DATABASE_URL;
const expectedName = process.env.ECONOMY_TEST_DATABASE_EXPECTED_NAME;
const parsedUrl = (() => {
  try {
    return testUrl ? new URL(testUrl) : null;
  } catch {
    return null;
  }
})();
const actualName = parsedUrl ? decodeURIComponent(parsedUrl.pathname.slice(1)) : null;
const skipReason = !testUrl
  ? 'ECONOMY_TEST_DATABASE_URL is not configured'
  : (!parsedUrl
      ? 'ECONOMY_TEST_DATABASE_URL is invalid'
      : (process.env.ECONOMY_TEST_DATABASE_PURPOSE !== 'disposable'
          ? 'ECONOMY_TEST_DATABASE_PURPOSE must explicitly be disposable'
          : (!expectedName || expectedName !== actualName
              ? 'ECONOMY_TEST_DATABASE_EXPECTED_NAME must exactly match the test URL database'
              : (!/economy.*test|test.*economy/i.test(actualName)
                  ? 'economy test database name must contain economy and test'
                  : false))));

async function isolatedDatabase(t) {
  const schema = `economy_market_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let admin;
  let adminClient;
  let pool;
  t.after(async () => {
    if (pool) await pool.end();
    if (adminClient) {
      await adminClient.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      adminClient.release();
    }
    if (admin) await admin.end();
  });
  const config = createPoolConfig({
    DATABASE_URL: testUrl,
    PGSSL_MODE: process.env.ECONOMY_TEST_PGSSL_MODE
  });
  admin = new Pool({ ...config, max: 1 });
  adminClient = await admin.connect();
  const identity = await adminClient.query(`
    SELECT current_database() AS database_name,
      (SELECT count(*)::integer FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS public_table_count
  `);
  assert.equal(identity.rows[0].database_name, expectedName);
  assert.equal(identity.rows[0].public_table_count, 0,
    'dedicated economy test database must have no public application tables');
  await adminClient.query(`CREATE SCHEMA "${schema}"`);
  pool = new Pool({ ...config, max: 10, options: `-c search_path=${schema}` });
  await runMigrations(pool);
  return pool;
}

const sellerId = '123e4567-e89b-42d3-a456-426614174010';
const buyerId = '123e4567-e89b-42d3-a456-426614174011';
const otherBuyerId = '123e4567-e89b-42d3-a456-426614174012';

async function seedMarket(pool) {
  await pool.query('INSERT INTO authenticated_accounts (id) VALUES ($1), ($2), ($3)',
    [sellerId, buyerId, otherBuyerId]);
  const equipment = await pool.query(`
    INSERT INTO player_equipment (account_id, item_definition_id, slot_type, is_equipped)
    SELECT $1, item_id, slot_type, FALSE FROM item_definitions WHERE item_code = 'START_SWORD'
    RETURNING id
  `, [sellerId]);
  await pool.query(`
    INSERT INTO game_asset_balances (account_id, asset_code, amount)
    VALUES ($1, '$DONCELLA', 1000), ($2, '$DONCELLA', 1000), ($3, '$DONCELLA', 0)
  `, [buyerId, otherBuyerId, sellerId]);
  return Number(equipment.rows[0].id);
}

test('marketplace atomically transfers equipment and balance exactly once', { skip: skipReason }, async (t) => {
  const pool = await isolatedDatabase(t);
  const equipmentId = await seedMarket(pool);
  const service = new MarketplaceService(new PostgresMarketplace(pool));
  await service.verifyReady();

  const listing = await service.createListing({
    sellerAccountId: sellerId,
    equipmentId,
    currencyType: '$DONCELLA',
    price: '250',
    idempotencyKey: 'list-sword-1'
  });
  assert.equal(listing.status, 'ACTIVE');
  await assert.rejects(pool.query(
    'UPDATE player_equipment SET is_equipped = TRUE WHERE id = $1', [equipmentId]),
  /actively listed equipment is held in marketplace escrow/);
  await assert.rejects(service.purchaseListing({
    buyerAccountId: sellerId,
    listingId: listing.id,
    idempotencyKey: 'self-buy-1'
  }), { code: 'SELF_PURCHASE_FORBIDDEN' });

  const purchased = await service.purchaseListing({
    buyerAccountId: buyerId,
    listingId: listing.id,
    idempotencyKey: 'buy-sword-1'
  });
  assert.equal(purchased.status, 'COMPLETED');
  assert.equal(purchased.buyerAccountId, buyerId);
  assert.deepEqual(await service.purchaseListing({
    buyerAccountId: buyerId,
    listingId: listing.id,
    idempotencyKey: 'buy-sword-1'
  }), purchased);

  assert.equal((await pool.query('SELECT account_id FROM player_equipment WHERE id = $1',
    [equipmentId])).rows[0].account_id, buyerId);
  const balances = await pool.query(`
    SELECT account_id, amount FROM game_asset_balances
    WHERE asset_code = '$DONCELLA' ORDER BY account_id
  `);
  assert.deepEqual(Object.fromEntries(balances.rows.map((row) => [row.account_id, row.amount])), {
    [sellerId]: '250',
    [buyerId]: '750',
    [otherBuyerId]: '1000'
  });
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM economy_settlements')).rows[0].count, 1);
  await assert.rejects(pool.query('DELETE FROM economy_settlements WHERE listing_id = $1', [listing.id]),
    /economy settlements are append-only/);
});

test('row locking permits only one buyer to purchase an active listing', { skip: skipReason }, async (t) => {
  const pool = await isolatedDatabase(t);
  const equipmentId = await seedMarket(pool);
  const service = new MarketplaceService(new PostgresMarketplace(pool));
  const listing = await service.createListing({
    sellerAccountId: sellerId,
    equipmentId,
    currencyType: '$DONCELLA',
    price: '400',
    idempotencyKey: 'list-race-1'
  });

  const results = await Promise.allSettled([
    service.purchaseListing({ buyerAccountId: buyerId, listingId: listing.id, idempotencyKey: 'race-a' }),
    service.purchaseListing({ buyerAccountId: otherBuyerId, listingId: listing.id, idempotencyKey: 'race-b' })
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'LISTING_NOT_ACTIVE');
  assert.equal((await pool.query('SELECT count(*)::integer AS count FROM economy_settlements')).rows[0].count, 1);
});

test('seller cancellation is idempotent and prevents purchase', { skip: skipReason }, async (t) => {
  const pool = await isolatedDatabase(t);
  const equipmentId = await seedMarket(pool);
  const service = new MarketplaceService(new PostgresMarketplace(pool));
  const listing = await service.createListing({
    sellerAccountId: sellerId,
    equipmentId,
    currencyType: '$DONCELLA',
    price: '100',
    idempotencyKey: 'list-cancel-1'
  });
  const cancelled = await service.cancelListing({ sellerAccountId: sellerId, listingId: listing.id });
  assert.equal(cancelled.status, 'CANCELLED');
  assert.deepEqual(await service.cancelListing({ sellerAccountId: sellerId, listingId: listing.id }), cancelled);
  await assert.rejects(service.purchaseListing({
    buyerAccountId: buyerId,
    listingId: listing.id,
    idempotencyKey: 'buy-cancelled-1'
  }), { code: 'LISTING_NOT_ACTIVE' });
});
