'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Pool } = require('pg');
const { createPoolConfig } = require('../../src/databaseConfig');
const migration = require('../../migrations/013_create_organization_memberships');
const { authorizeOrganizationProfile } = require('../../src/auth/organizationAuthorization');
const { readOrganizationProfileSnapshot } = require('../../src/organizationProfileSnapshot');

const testUrl = process.env.ORGANIZATION_MEMBERSHIP_TEST_DATABASE_URL;
const expectedName = process.env.ORGANIZATION_MEMBERSHIP_TEST_DATABASE_EXPECTED_NAME;
const parsedUrl = (() => {
  try {
    return testUrl ? new URL(testUrl) : null;
  } catch {
    return null;
  }
})();
const actualName = parsedUrl ? decodeURIComponent(parsedUrl.pathname.slice(1)) : null;
const skipReason = !testUrl
  ? 'ORGANIZATION_MEMBERSHIP_TEST_DATABASE_URL is not configured'
  : (!parsedUrl
      ? 'ORGANIZATION_MEMBERSHIP_TEST_DATABASE_URL is invalid'
      : (process.env.ORGANIZATION_MEMBERSHIP_TEST_DATABASE_PURPOSE !== 'disposable'
          ? 'ORGANIZATION_MEMBERSHIP_TEST_DATABASE_PURPOSE must explicitly be disposable'
          : (!expectedName || expectedName !== actualName
              ? 'ORGANIZATION_MEMBERSHIP_TEST_DATABASE_EXPECTED_NAME must exactly match the test URL database'
              : (!/organization[_-]?membership.*test|test.*organization[_-]?membership/i.test(actualName)
                  ? 'dedicated organization membership test database name must contain organization and membership and test'
                  : false))));

async function isolatedDatabase(t) {
  const schema = `org_membership_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  assert.match(schema, /^org_membership_[a-z0-9_]+$/);

  let admin;
  let adminClient;
  let pool;
  let lockAcquired = false;
  let schemaCreated = false;

  t.after(async () => {
    const errors = [];
    const attempt = async (action) => {
      try {
        await action();
      } catch (error) {
        errors.push(error);
      }
    };

    if (pool) await attempt(() => pool.end());
    if (schemaCreated && adminClient) {
      await attempt(() => adminClient.query(`DROP SCHEMA "${schema}" CASCADE`));
    }
    if (lockAcquired && adminClient) {
      await attempt(() => adminClient.query(
        "SELECT pg_advisory_unlock(hashtext('orden-del-margen-organization-membership-integration'))"
      ));
    }
    if (adminClient) await attempt(() => adminClient.release());
    if (admin) await attempt(() => admin.end());

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Organization membership PostgreSQL fixture cleanup failed');
    }
  });

  const connectionConfig = createPoolConfig({
    DATABASE_URL: testUrl,
    PGSSL_MODE: process.env.ORGANIZATION_MEMBERSHIP_TEST_PGSSL_MODE
  });
  admin = new Pool({ ...connectionConfig, max: 1 });
  adminClient = await admin.connect();

  const identity = await adminClient.query(`
    SELECT current_database() AS database_name,
      (SELECT count(1)::integer FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS public_table_count
  `);
  assert.equal(identity.rows[0].database_name, expectedName);
  assert.equal(identity.rows[0].public_table_count, 0,
    'dedicated organization membership test database must have no public application tables');

  const lock = await adminClient.query(
    "SELECT pg_try_advisory_lock(hashtext('orden-del-margen-organization-membership-integration')) AS acquired"
  );
  assert.equal(lock.rows[0].acquired, true, 'organization membership test database is already in use');
  lockAcquired = true;

  await adminClient.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  pool = new Pool({
    ...connectionConfig,
    max: 5,
    options: `-c search_path=${schema}`
  });

  await pool.query('CREATE TABLE authenticated_accounts (id UUID PRIMARY KEY)');
  await pool.query(`
    CREATE TABLE organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      legal_entity_name TEXT,
      ein TEXT,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE property_opportunities (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      property_address TEXT,
      property_type TEXT,
      property_size_sqft INTEGER,
      property_units INTEGER,
      list_price NUMERIC(12, 2),
      status TEXT,
      property_condition TEXT,
      seller_name TEXT,
      seller_email TEXT,
      broker_name TEXT,
      broker_email TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await migration.up(pool);

  const publicTables = await adminClient.query(
    "SELECT count(1)::integer AS count FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
  );
  assert.equal(publicTables.rows[0].count, 0,
    'migration objects must remain inside the isolated schema');
  return pool;
}

test('membership, profile reads, and revocation share a consistent PostgreSQL snapshot',
  { skip: skipReason }, async (t) => {
    const db = await isolatedDatabase(t);
    const accountId = '123e4567-e89b-42d3-a456-426614174000';
    const otherAccountId = '123e4567-e89b-42d3-a456-426614174001';

    const emptyMemberships = await db.query('SELECT 1 FROM organization_memberships LIMIT 1');
    assert.equal(emptyMemberships.rows.length, 0, 'migration must not seed memberships or owners');

    const organization = await db.query(`
      INSERT INTO organizations (name, legal_entity_name, ein)
      VALUES ('Organization test', 'Organization test LLC', '12-3456789')
      RETURNING id
    `);
    const organizationId = organization.rows[0].id;
    await db.query('INSERT INTO authenticated_accounts (id) VALUES ($1), ($2)', [accountId, otherAccountId]);
    await db.query(`
      INSERT INTO property_opportunities (
        organization_id, property_address, property_type, property_size_sqft,
        property_units, list_price, status, property_condition,
        seller_name, seller_email, broker_name, broker_email, notes
      ) VALUES ($1, '123 Main Street', 'multifamily', 1200, 4, 450000, 'Lead', 'good',
        'Private Seller', 'seller@example.test', 'Private Broker', 'broker@example.test', 'Private notes')
    `, [organizationId]);

    const callerContext = { accountId };
    assert.equal(await authorizeOrganizationProfile({ callerContext, organizationId, db }), false,
      'a new organization has no members by default');

    await db.query(`
      INSERT INTO organization_memberships (organization_id, account_id, role)
      VALUES ($1, $2, 'viewer')
    `, [organizationId, accountId]);
    const pending = await db.query(`
      SELECT status FROM organization_memberships
      WHERE organization_id = $1 AND account_id = $2
    `, [organizationId, accountId]);
    assert.equal(pending.rows[0].status, 'pending');
    assert.equal(await authorizeOrganizationProfile({ callerContext, organizationId, db }), false,
      'pending memberships do not authorize access');

    await db.query(`
      UPDATE organization_memberships SET status = 'active'
      WHERE organization_id = $1 AND account_id = $2
    `, [organizationId, accountId]);
    assert.equal(await authorizeOrganizationProfile({ callerContext, organizationId, db }), true);
    assert.equal(await authorizeOrganizationProfile({
      callerContext: { accountId: otherAccountId }, organizationId, db
    }), false, 'a different authenticated account is not authorized');
    assert.equal(await authorizeOrganizationProfile({ callerContext, organizationId: organizationId + 1, db }), false,
      'membership does not authorize access to another organization');

    let concurrentChangesApplied = false;
    const snapshot = await readOrganizationProfileSnapshot({
      db,
      callerContext,
      organizationId,
      authorizeOrganizationProfile: async (input) => {
        const authorized = await authorizeOrganizationProfile(input);
        assert.equal(authorized, true);
        await db.query(`
          UPDATE organization_memberships SET status = 'revoked'
          WHERE organization_id = $1 AND account_id = $2
        `, [organizationId, accountId]);
        await db.query(`
          UPDATE property_opportunities SET status = 'Withdrawn'
          WHERE organization_id = $1
        `, [organizationId]);
        concurrentChangesApplied = true;
        return authorized;
      }
    });

    assert.equal(concurrentChangesApplied, true);
    assert.equal(snapshot.authorized, true);
    assert.equal(snapshot.profile.opportunities[0].status, 'Lead',
      'profile read must use the same repeatable-read snapshot as authorization');
    assert.equal(snapshot.profile.ein, undefined);
    assert.equal(snapshot.profile.opportunities[0].seller_name, undefined);
    assert.equal(snapshot.profile.opportunities[0].notes, undefined);
    assert.equal(await authorizeOrganizationProfile({ callerContext, organizationId, db }), false,
      'a later request observes the membership revocation');
    const latestProfile = await db.query(
      'SELECT status FROM property_opportunities WHERE organization_id = $1', [organizationId]
    );
    assert.equal(latestProfile.rows[0].status, 'Withdrawn');

    await assert.rejects(
      db.query(`
        INSERT INTO organization_memberships (organization_id, account_id, role, status)
        VALUES ($1, $2, 'viewer', 'active')
      `, [organizationId + 100, otherAccountId]),
      (error) => error.code === '23503'
    );
    await assert.rejects(
      db.query(`
        INSERT INTO organization_memberships (organization_id, account_id, role, status)
        VALUES ($1, $2, 'superadmin', 'active')
      `, [organizationId, otherAccountId]),
      (error) => error.code === '23514'
    );
  });
