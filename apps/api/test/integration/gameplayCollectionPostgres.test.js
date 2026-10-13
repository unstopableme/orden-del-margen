'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createPoolConfig } = require('../../src/databaseConfig');
const runMigrations = require('../../src/migrate');
const { PostgresIdleCollectionService } = require('../../src/gameplay/postgresIdleCollection');
const { calculateIdleProduction } = require('../../src/gameplay/idleProduction');
const { fingerprintRules } = require('../../src/gameplay/ruleFingerprint');

const testUrl = process.env.GAMEPLAY_TEST_DATABASE_URL;
const expectedName = process.env.GAMEPLAY_TEST_DATABASE_EXPECTED_NAME;
const parsedUrl = (() => {
  try {
    return testUrl ? new URL(testUrl) : null;
  } catch {
    return null;
  }
})();
const actualName = parsedUrl ? decodeURIComponent(parsedUrl.pathname.slice(1)) : null;
const skipReason = !testUrl
  ? 'GAMEPLAY_TEST_DATABASE_URL is not configured'
  : (!parsedUrl
      ? 'GAMEPLAY_TEST_DATABASE_URL is invalid'
      : (process.env.GAMEPLAY_TEST_DATABASE_PURPOSE !== 'disposable'
          ? 'GAMEPLAY_TEST_DATABASE_PURPOSE must explicitly be disposable'
          : (!expectedName || expectedName !== actualName
              ? 'GAMEPLAY_TEST_DATABASE_EXPECTED_NAME must exactly match the test URL database'
              : (!/gameplay.*test|test.*gameplay/i.test(actualName)
                  ? 'gameplay test database name must contain gameplay and test'
                  : false))));

async function isolatedDatabase(t) {
  const schema = `gameplay_idle_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  assert.match(schema, /^gameplay_idle_[a-z0-9_]+$/);
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
    try {
      if (pool) await attempt(() => pool.end());
      if (schemaCreated && adminClient) {
        await attempt(() => adminClient.query(`DROP SCHEMA "${schema}" CASCADE`));
      }
    } finally {
      if (lockAcquired && adminClient) {
        await attempt(() => adminClient.query(
          "SELECT pg_advisory_unlock(hashtext('orden-del-margen-gameplay-collection-integration'))"
        ));
      }
      if (adminClient) await attempt(() => adminClient.release());
      if (admin) await attempt(() => admin.end());
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Gameplay PostgreSQL fixture cleanup failed');
  });

  const connectionConfig = createPoolConfig({
    DATABASE_URL: testUrl,
    PGSSL_MODE: process.env.GAMEPLAY_TEST_PGSSL_MODE
  });
  admin = new Pool({ ...connectionConfig, max: 1 });
  adminClient = await admin.connect();
  const identity = await adminClient.query(`
    SELECT current_database() AS database_name,
      (SELECT count(*)::integer FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS public_table_count
  `);
  assert.equal(identity.rows[0].database_name, expectedName);
  assert.equal(identity.rows[0].public_table_count, 0,
    'dedicated gameplay test database must have no public application tables');
  const lock = await adminClient.query(
    "SELECT pg_try_advisory_lock(hashtext('orden-del-margen-gameplay-collection-integration')) AS acquired"
  );
  assert.equal(lock.rows[0].acquired, true, 'gameplay test database is already in use');
  lockAcquired = true;

  await adminClient.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  pool = new Pool({
    ...connectionConfig,
    max: 10,
    options: `-c search_path=${schema}`
  });
  await runMigrations(pool);
  const publicTables = await adminClient.query(
    "SELECT count(*)::integer AS count FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
  );
  assert.equal(publicTables.rows[0].count, 0, 'migrations must remain inside the isolated test schema');
  return pool;
}

test('idle collection persists balances atomically, validates fingerprints, and replays idempotently',
  { skip: skipReason }, async (t) => {
    const pool = await isolatedDatabase(t);
    const accountId = '123e4567-e89b-42d3-a456-426614174000';
    await pool.query('INSERT INTO authenticated_accounts (id) VALUES ($1)', [accountId]);
    const service = new PostgresIdleCollectionService(pool);
    const activeRuleset = await service.getActiveRulesetFingerprint();
    const { ruleSetId, fingerprint } = activeRuleset;
    assert.equal(activeRuleset.versionNumber, 2);
    assert.equal(activeRuleset.rules.length, 10);
    assert.equal(activeRuleset.upgradeCosts.length, 20);
    assert.deepEqual(activeRuleset.rules.filter((rule) => rule.level === 2)
      .map(({ building_type, units_per_hour, storage_limit_ms }) => ({
        building_type, units_per_hour, storage_limit_ms
      })), [
      { building_type: 'lumber_mill', units_per_hour: 100, storage_limit_ms: 43_200_000 },
      { building_type: 'provisioner', units_per_hour: 33, storage_limit_ms: 43_200_000 },
      { building_type: 'quarry', units_per_hour: 66, storage_limit_ms: 43_200_000 },
      { building_type: 'textile_mill', units_per_hour: 33, storage_limit_ms: 43_200_000 },
      { building_type: 'wheat_farm', units_per_hour: 132, storage_limit_ms: 43_200_000 }
    ]);

    const provisioned = await service.provisionInitialBuildings({
      accountId, expectedRulesFingerprint: fingerprint
    });
    assert.equal(provisioned.length, 5);
    const initialAccountState = await service.getAccountState({ accountId });
    assert.equal(initialAccountState.ruleSet.fingerprint, fingerprint);
    assert.equal(initialAccountState.buildings.length, 5);
    assert.deepEqual(initialAccountState.balances, []);
    assert.deepEqual(provisioned.map(({ building_type }) => building_type).sort(), [
      'lumber_mill', 'provisioner', 'quarry', 'textile_mill', 'wheat_farm'
    ]);
    assert.equal((await service.provisionInitialBuildings({
      accountId, expectedRulesFingerprint: fingerprint
    })).length, 5);

    const unfundedAccountId = '123e4567-e89b-42d3-a456-426614174009';
    await pool.query('INSERT INTO authenticated_accounts (id) VALUES ($1)', [unfundedAccountId]);
    await service.provisionInitialBuildings({
      accountId: unfundedAccountId, expectedRulesFingerprint: fingerprint
    });
    await assert.rejects(service.upgradeBuilding({
      accountId: unfundedAccountId,
      buildingType: 'wheat_farm',
      targetLevel: 2,
      idempotencyKey: 'upgrade-without-collected-costs',
      expectedRulesFingerprint: fingerprint
    }), { code: 'INSUFFICIENT_COLLECTED_BALANCE', status: 409 });
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM building_upgrade_requests
      WHERE account_id = $1
    `, [unfundedAccountId])).rows[0].count, 0);
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM game_asset_balances
      WHERE account_id = $1
    `, [unfundedAccountId])).rows[0].count, 0);
    assert.equal((await pool.query(`
      SELECT level FROM kingdom_buildings
      WHERE account_id = $1 AND building_type = 'wheat_farm'
    `, [unfundedAccountId])).rows[0].level, 1);

    await pool.query(`
      UPDATE kingdom_buildings
      SET last_settled_at = date_trunc('milliseconds', clock_timestamp() - interval '10 hours')
      WHERE account_id = $1
    `, [accountId]);
    const buildingTimestamps = await pool.query(`
      SELECT id, last_settled_at FROM kingdom_buildings WHERE account_id = $1 ORDER BY id
    `, [accountId]);
    await pool.query(`
      CREATE FUNCTION reject_gameplay_ledger_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test ledger failure'; END;
      $$;
      CREATE TRIGGER reject_gameplay_ledger_test BEFORE INSERT ON game_asset_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_gameplay_ledger_test();
    `);
    await assert.rejects(
      service.collect({
        accountId, idempotencyKey: 'rollback-001',
        expectedRulesFingerprint: fingerprint
      }),
      /test ledger failure/
    );
    await pool.query('DROP TRIGGER reject_gameplay_ledger_test ON game_asset_ledger');
    await pool.query('DROP FUNCTION reject_gameplay_ledger_test()');
    assert.deepEqual((await pool.query(`
      SELECT id, last_settled_at FROM kingdom_buildings WHERE account_id = $1 ORDER BY id
    `, [accountId])).rows, buildingTimestamps.rows);
    for (const table of ['game_asset_balances', 'production_settlements',
      'production_collection_requests', 'game_asset_ledger']) {
      assert.equal((await pool.query(`SELECT count(*)::integer AS count FROM ${table}`)).rows[0].count, 0);
    }

    await assert.rejects(
      service.collect({
        accountId, idempotencyKey: 'stale-fingerprint',
        expectedRulesFingerprint: '0'.repeat(64)
      }),
      { code: 'IDEMPOTENCY_CONFLICT', status: 409 }
    );
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM production_collection_requests'))
      .rows[0].count, 0);

    const [result, concurrentReplay] = await Promise.all([
      service.collect({
        accountId, idempotencyKey: 'collect-001',
        expectedRulesFingerprint: fingerprint
      }),
      service.collect({
        accountId, idempotencyKey: 'collect-001',
        expectedRulesFingerprint: fingerprint
      })
    ]);
    assert.equal(result.ruleSetId, ruleSetId);
    assert.equal(result.rulesFingerprint, fingerprint);
    assert.deepEqual(result.credits, [
      { asset: 'cloth', amount: '120' },
      { asset: 'food', amount: '120' },
      { asset: 'stone', amount: '240' },
      { asset: 'wheat', amount: '480' },
      { asset: 'wood', amount: '360' }
    ]);
    assert.equal(result.settlements.every((row) =>
      row.activeMilliseconds === 28_800_000 &&
      row.discardedMilliseconds >= 7_200_000
    ), true);

    assert.deepEqual(concurrentReplay, result);
    const replay = await service.collect({
      accountId, idempotencyKey: 'collect-001',
      expectedRulesFingerprint: fingerprint
    });
    assert.deepEqual(replay, result);
    await assert.rejects(
      service.collect({
        accountId, idempotencyKey: 'collect-001',
        expectedRulesFingerprint: 'f'.repeat(64)
      }),
      { code: 'IDEMPOTENCY_CONFLICT', status: 409 }
    );

    const raceStartResult = await pool.query(
      "SELECT date_trunc('milliseconds', clock_timestamp() - interval '10 hours') AS started_at"
    );
    const raceStart = raceStartResult.rows[0].started_at.toISOString();
    await pool.query(`
      UPDATE kingdom_buildings
      SET last_settled_at = $2, carry_numerator = 0
      WHERE account_id = $1
    `, [accountId, raceStart]);
    const distinctKeyRace = await Promise.all([
      service.collect({
        accountId, idempotencyKey: 'collect-distinct-a',
        expectedRulesFingerprint: fingerprint
      }),
      service.collect({
        accountId, idempotencyKey: 'collect-distinct-b',
        expectedRulesFingerprint: fingerprint
      })
    ]);
    assert.notDeepEqual(distinctKeyRace[0], distinctKeyRace[1]);
    const { rows: raceSettlements } = await pool.query(`
      SELECT s.building_id, s.interval_start, s.interval_end, s.credited_amount
      FROM production_settlements s
      JOIN production_collection_requests r ON r.id = s.request_id
      WHERE r.account_id = $1 AND r.idempotency_key = ANY($2::text[])
      ORDER BY s.building_id, s.interval_start, s.interval_end
    `, [accountId, ['collect-distinct-a', 'collect-distinct-b']]);
    assert.equal(raceSettlements.length, 10);
    const byBuilding = new Map();
    const raceCreditsByAsset = new Map();
    for (const settlement of raceSettlements) {
      const entries = byBuilding.get(settlement.building_id) || [];
      entries.push(settlement);
      byBuilding.set(settlement.building_id, entries);
    }
    const { rows: raceBuildings } = await pool.query(`
      SELECT id, building_type, level, last_settled_at
      FROM kingdom_buildings WHERE account_id = $1
    `, [accountId]);
    for (const building of raceBuildings) {
      const entries = byBuilding.get(building.id);
      assert.equal(entries.length, 2);
      assert.equal(entries[0].interval_start.toISOString(), raceStart);
      assert.equal(entries[0].interval_end.toISOString(), entries[1].interval_start.toISOString());
      assert.equal(entries[1].interval_end.toISOString(), building.last_settled_at.toISOString());
      const rule = activeRuleset.rules.find((candidate) =>
        candidate.building_type === building.building_type &&
        Number(candidate.level) === Number(building.level));
      const expected = calculateIdleProduction({
        buildingType: building.building_type,
        level: Number(building.level),
        lastSettledAt: raceStart,
        settledAt: building.last_settled_at.toISOString(),
        productionRule: {
          asset: rule.asset_code,
          unitsPerHour: rule.units_per_hour,
          storageLimitMs: rule.storage_limit_ms
        }
      });
      assert.equal(
        entries.reduce((total, row) => total + BigInt(row.credited_amount), 0n).toString(),
        expected.producedUnits
      );
      raceCreditsByAsset.set(
        rule.asset_code,
        (raceCreditsByAsset.get(rule.asset_code) || 0n) + BigInt(expected.producedUnits)
      );
    }

    const { rows: balances } = await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId]);
    const expectedBalances = new Map(result.credits.map(({ asset, amount }) =>
      [asset, BigInt(amount)]));
    for (const [asset, amount] of raceCreditsByAsset) {
      expectedBalances.set(asset, (expectedBalances.get(asset) || 0n) + amount);
    }
    assert.deepEqual(balances, [...expectedBalances]
      .sort(([assetA], [assetB]) => assetA.localeCompare(assetB))
      .map(([asset_code, amount]) => ({ asset_code, amount: amount.toString() })));
    const { rows: ledger } = await pool.query(`
      SELECT asset_code, sum(amount)::text AS amount
      FROM game_asset_ledger WHERE account_id = $1 GROUP BY asset_code ORDER BY asset_code
    `, [accountId]);
    assert.deepEqual(ledger, balances);
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM production_settlements'))
      .rows[0].count, 15);

    const wheatBeforeRollback = await pool.query(`
      SELECT level, last_settled_at, carry_numerator FROM kingdom_buildings
      WHERE account_id = $1 AND building_type = 'wheat_farm'
    `, [accountId]);
    const balancesBeforeRollback = await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId]);
    await pool.query(`
      CREATE FUNCTION reject_building_upgrade_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test upgrade ledger failure'; END;
      $$;
      CREATE TRIGGER reject_building_upgrade_test BEFORE INSERT ON building_upgrade_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_building_upgrade_test();
    `);
    await assert.rejects(service.upgradeBuilding({
      accountId,
      buildingType: 'wheat_farm',
      targetLevel: 2,
      idempotencyKey: 'upgrade-rollback',
      expectedRulesFingerprint: fingerprint
    }), /test upgrade ledger failure/);
    await pool.query('DROP TRIGGER reject_building_upgrade_test ON building_upgrade_ledger');
    await pool.query('DROP FUNCTION reject_building_upgrade_test()');
    assert.deepEqual((await pool.query(`
      SELECT level, last_settled_at, carry_numerator FROM kingdom_buildings
      WHERE account_id = $1 AND building_type = 'wheat_farm'
    `, [accountId])).rows, wheatBeforeRollback.rows);
    assert.deepEqual((await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId])).rows, balancesBeforeRollback.rows);
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM building_upgrade_requests
      WHERE account_id = $1 AND idempotency_key = 'upgrade-rollback'
    `, [accountId])).rows[0].count, 0);

    await pool.query(`
      UPDATE kingdom_buildings
      SET last_settled_at = date_trunc('milliseconds', clock_timestamp() - interval '1 hour'),
        carry_numerator = 0
      WHERE account_id = $1 AND building_type = 'wheat_farm'
    `, [accountId]);
    const upgradeInput = {
      accountId,
      buildingType: 'wheat_farm',
      targetLevel: 2,
      idempotencyKey: 'upgrade-wheat-001',
      expectedRulesFingerprint: fingerprint
    };
    const balancesBeforeUpgrade = await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId]);
    const [upgrade, concurrentUpgradeReplay] = await Promise.all([
      service.upgradeBuilding(upgradeInput),
      service.upgradeBuilding(upgradeInput)
    ]);
    assert.deepEqual(concurrentUpgradeReplay, upgrade);
    assert.equal(upgrade.building.level, 2);
    assert.equal(upgrade.settlement.amount, '60');
    assert.deepEqual(upgrade.costs, [
      { asset: 'cloth', amount: '60' },
      { asset: 'food', amount: '60' },
      { asset: 'stone', amount: '120' },
      { asset: 'wood', amount: '180' }
    ]);
    const expectedBalancesAfterUpgrade = new Map(balancesBeforeUpgrade.rows.map(
      ({ asset_code, amount }) => [asset_code, BigInt(amount)]
    ));
    expectedBalancesAfterUpgrade.set(
      upgrade.settlement.asset,
      (expectedBalancesAfterUpgrade.get(upgrade.settlement.asset) || 0n) +
        BigInt(upgrade.settlement.amount)
    );
    for (const { asset, amount } of upgrade.costs) {
      expectedBalancesAfterUpgrade.set(
        asset,
        (expectedBalancesAfterUpgrade.get(asset) || 0n) - BigInt(amount)
      );
    }
    const expectedBalanceRows = [...expectedBalancesAfterUpgrade]
      .sort(([assetA], [assetB]) => assetA.localeCompare(assetB))
      .map(([asset_code, amount]) => ({ asset_code, amount: amount.toString() }));
    const balancesAfterUpgrade = await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId]);
    assert.deepEqual(balancesAfterUpgrade.rows, expectedBalanceRows,
      'the successful upgrade must settle production and debit its costs once');

    const upgradeReplay = await service.upgradeBuilding(upgradeInput);
    assert.deepEqual(upgradeReplay, upgrade);
    const balancesAfterReplay = await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId]);
    assert.deepEqual(balancesAfterReplay.rows, balancesAfterUpgrade.rows,
      'replaying the upgrade must not debit costs a second time');
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM building_upgrade_requests
      WHERE account_id = $1 AND idempotency_key = $2
    `, [accountId, upgradeInput.idempotencyKey])).rows[0].count, 1);
    await assert.rejects(service.upgradeBuilding({
      ...upgradeInput, buildingType: 'quarry'
    }), { code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM building_upgrade_ledger
      WHERE account_id = $1 AND building_type = 'wheat_farm'
    `, [accountId])).rows[0].count, 1);
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM building_upgrade_cost_ledger
      WHERE account_id = $1
    `, [accountId])).rows[0].count, 4);

    const lumberRaces = await Promise.allSettled([
      service.upgradeBuilding({
        accountId, buildingType: 'lumber_mill', targetLevel: 2,
        idempotencyKey: 'upgrade-lumber-a', expectedRulesFingerprint: fingerprint
      }),
      service.upgradeBuilding({
        accountId, buildingType: 'lumber_mill', targetLevel: 2,
        idempotencyKey: 'upgrade-lumber-b', expectedRulesFingerprint: fingerprint
      })
    ]);
    assert.equal(lumberRaces.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(lumberRaces.filter(({ status }) => status === 'rejected').length, 1);
    assert.equal(lumberRaces.find(({ status }) => status === 'rejected').reason.code,
      'BUILDING_UPGRADE_CONFLICT');
    assert.equal((await pool.query(`
      SELECT count(*)::integer AS count FROM building_upgrade_ledger
      WHERE account_id = $1 AND building_type = 'lumber_mill'
    `, [accountId])).rows[0].count, 1);

    await assert.rejects(
      pool.query(`
        UPDATE building_level_rules SET units_per_hour = units_per_hour + 1
        WHERE rule_set_id = $1 AND building_type = 'wheat_farm'
      `, [ruleSetId]),
      /building level rules are immutable/
    );
    await pool.query(
      'ALTER TABLE building_level_rules DISABLE TRIGGER immutable_building_level_rule'
    );
    try {
      await pool.query(`
        UPDATE building_level_rules SET units_per_hour = units_per_hour + 1
        WHERE rule_set_id = $1 AND building_type = 'wheat_farm'
      `, [ruleSetId]);
    } finally {
      await pool.query(
        'ALTER TABLE building_level_rules ENABLE TRIGGER immutable_building_level_rule'
      );
    }
    await assert.rejects(
      service.collect({
        accountId, idempotencyKey: 'tampered-rules',
        expectedRulesFingerprint: fingerprint
      }),
      /do not match their fingerprint/
    );
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM production_collection_requests'))
      .rows[0].count, 3);

    const secondAccountId = '123e4567-e89b-42d3-a456-426614174001';
    await pool.query('INSERT INTO authenticated_accounts (id) VALUES ($1)', [secondAccountId]);
    const customRules = activeRuleset.rules.map((rule) => ({
      ...rule,
      ...(rule.building_type === 'wheat_farm'
        ? { units_per_hour: 120, storage_limit_ms: 7_200_000 }
        : {})
    }));
    const customFingerprint = fingerprintRules(activeRuleset.ruleSetKey, customRules, 3);
    const customRuleSetId = 'a95b4a15-f621-4c4f-8908-12cb3e060003';
    const activationClient = await pool.connect();
    try {
      await activationClient.query('BEGIN');
      try {
        await activationClient.query(
          'UPDATE building_rule_sets SET is_active = FALSE WHERE id = $1', [ruleSetId]
        );
        await activationClient.query(`
          INSERT INTO building_rule_sets
            (id, rule_set_key, version_number, fingerprint, is_active)
          VALUES ($1, $2, 3, $3, TRUE)
        `, [customRuleSetId, activeRuleset.ruleSetKey, customFingerprint]);
        for (const rule of customRules) {
          await activationClient.query(`
            INSERT INTO building_level_rules
              (rule_set_id, building_type, level, asset_code, units_per_hour, storage_limit_ms)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [customRuleSetId, rule.building_type, rule.level, rule.asset_code,
            rule.units_per_hour, rule.storage_limit_ms]);
        }
        await activationClient.query('COMMIT');
      } catch (error) {
        await activationClient.query('ROLLBACK');
        throw error;
      }
    } finally {
      activationClient.release();
    }

    const customActiveRuleset = await service.getActiveRulesetFingerprint();
    assert.equal(customActiveRuleset.versionNumber, 3);
    assert.equal(customActiveRuleset.fingerprint, customFingerprint);
    const accountOneBalancesBeforeSecondCollection = await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId]);
    const accountOneState = await service.getAccountState({ accountId });
    assert.deepEqual(accountOneState.balances.map(({ assetCode, amount }) => [assetCode, amount]),
      accountOneBalancesBeforeSecondCollection.rows.map(({ asset_code, amount }) => [asset_code, amount]));
    assert.equal(await service.getAccountState({
      accountId: '123e4567-e89b-42d3-a456-426614174099'
    }), null);
    await service.provisionInitialBuildings({
      accountId: secondAccountId,
      expectedRulesFingerprint: customFingerprint
    });
    const customStartResult = await pool.query(
      "SELECT date_trunc('milliseconds', clock_timestamp() - interval '10 hours') AS started_at"
    );
    await pool.query(`
      UPDATE kingdom_buildings
      SET last_settled_at = $2, carry_numerator = 0
      WHERE account_id = $1
    `, [secondAccountId, customStartResult.rows[0].started_at]);
    const customCollection = await service.collect({
      accountId: secondAccountId,
      idempotencyKey: 'custom-rate-and-cap',
      expectedRulesFingerprint: customFingerprint
    });
    const customWheat = customCollection.settlements.find((row) => row.asset === 'wheat');
    assert.equal(customWheat.amount, '240');
    assert.equal(customWheat.activeMilliseconds, 7_200_000);
    assert.ok(customWheat.discardedMilliseconds >= 8 * 60 * 60 * 1000);
    const accountTwoWheatBalance = await pool.query(`
      SELECT amount::text FROM game_asset_balances
      WHERE account_id = $1 AND asset_code = 'wheat'
    `, [secondAccountId]);
    assert.deepEqual(accountTwoWheatBalance.rows, [{ amount: '240' }]);
    const accountTwoState = await service.getAccountState({ accountId: secondAccountId });
    assert.deepEqual(accountTwoState.balances, [
      { assetCode: 'cloth', amount: '120' },
      { assetCode: 'food', amount: '120' },
      { assetCode: 'stone', amount: '240' },
      { assetCode: 'wheat', amount: '240' },
      { assetCode: 'wood', amount: '360' }
    ]);
    assert.deepEqual((await pool.query(`
      SELECT asset_code, amount::text FROM game_asset_balances
      WHERE account_id = $1 ORDER BY asset_code
    `, [accountId])).rows, accountOneBalancesBeforeSecondCollection.rows);

    await assert.rejects(
      pool.query('UPDATE game_asset_ledger SET amount = amount WHERE account_id = $1', [secondAccountId]),
      /game_asset_ledger is append-only/
    );
    await assert.rejects(
      pool.query('DELETE FROM game_asset_ledger WHERE account_id = $1', [secondAccountId]),
      /game_asset_ledger is append-only/
    );
    await assert.rejects(
      pool.query('UPDATE production_settlements SET credited_amount = credited_amount WHERE account_id = $1',
        [secondAccountId]),
      /production_settlements is append-only/
    );
    await assert.rejects(
      pool.query('DELETE FROM production_settlements WHERE account_id = $1', [secondAccountId]),
      /production_settlements is append-only/
    );

  });
