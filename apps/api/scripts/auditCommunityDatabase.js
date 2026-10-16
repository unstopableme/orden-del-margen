'use strict';

const path = require('path');
const { Pool } = require('pg');
const { createPoolConfig } = require('../src/databaseConfig');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function addressClass(address) {
  if (!address) return 'local-socket-or-hidden';
  if (address === '127.0.0.1' || address === '::1') return 'loopback';
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)) return 'private-network';
  return 'public-or-provider-network';
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const configured = new URL(process.env.DATABASE_URL);
  const pool = new Pool({ ...createPoolConfig(process.env), max: 1 });
  try {
    const metadata = await pool.query(`
      SELECT current_database() AS database_name,
             inet_server_addr()::text AS server_address,
             pg_is_in_recovery() AS is_replica,
             obj_description(oid, 'pg_database') AS database_comment
      FROM pg_database WHERE datname = current_database()
    `);
    const migrations = await pool.query(`
      SELECT filename, applied_at FROM schema_migrations
      WHERE filename IN (
        '003_harden_community_persistence.js',
        '004_create_api_rate_limits.js',
        '005_create_passport_identity_mapping.js'
      )
      ORDER BY filename
    `);
    const seeded = await pool.query(`
      SELECT 'members' AS kind, array_agg(external_id ORDER BY external_id) AS identifiers
        FROM community_members WHERE external_id IN ('member-1','member-2')
      UNION ALL
      SELECT 'communities', array_agg(external_id ORDER BY external_id)
        FROM communities WHERE external_id IN ('casa-azul','viviendas-del-sol')
      UNION ALL
      SELECT 'quests', array_agg(external_id ORDER BY external_id)
        FROM community_quests WHERE external_id IN ('quest-1','quest-2')
      UNION ALL
      SELECT 'challenges', array_agg(external_id ORDER BY external_id)
        FROM knowledge_challenges WHERE external_id IN ('knowledge-1','knowledge-2')
      UNION ALL
      SELECT 'referrals', array_agg(external_id ORDER BY external_id)
        FROM referrals WHERE external_id IN ('referral-1','referral-2')
      UNION ALL
      SELECT 'gifts', array_agg(external_id ORDER BY external_id)
        FROM coffee_gifts WHERE external_id IN ('coffee-gift-1')
      UNION ALL
      SELECT 'events', array_agg(external_id ORDER BY external_id)
        FROM progression_events WHERE external_id IN ('event-1','event-2')
      UNION ALL
      SELECT 'announcements', array_agg(external_id ORDER BY external_id)
        FROM community_announcements
        WHERE external_id IN ('announcement-1','announcement-2','announcement-3')
    `);
    const memberships = await pool.query(`
      SELECT m.external_id AS member_id, array_agg(c.external_id ORDER BY c.external_id) AS communities
      FROM community_memberships cm
      JOIN community_members m ON m.id=cm.member_id
      JOIN communities c ON c.id=cm.community_id
      WHERE m.external_id IN ('member-1','member-2')
      GROUP BY m.external_id ORDER BY m.external_id
    `);
    const ddl = await pool.query(`
      SELECT
        to_regclass('public.knowledge_reward_claims') IS NOT NULL AS reward_table,
        to_regclass('public.api_rate_limits') IS NOT NULL AS rate_limit_table,
        to_regclass('public.passport_wallet_bindings') IS NOT NULL AS passport_binding_table,
        to_regclass('public.wallet_property_access') IS NOT NULL AS wallet_property_access_table,
        to_regclass('public.uq_progression_reward_source') IS NOT NULL AS reward_source_index,
        EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='community_members' AND column_name='external_id')
          AS member_external_id
    `);
    let passportMappingCounts = { state: 'not-present' };
    if (ddl.rows[0].passport_binding_table && ddl.rows[0].wallet_property_access_table) {
      const counts = await pool.query(`
        SELECT
          (SELECT count(*)::integer FROM passport_wallet_bindings) AS passport_bindings,
          (SELECT count(*)::integer FROM wallet_property_access) AS wallet_property_access
      `);
      passportMappingCounts = { state: 'present', ...counts.rows[0] };
    }
    const runtimeState = await pool.query(`
      SELECT jsonb_build_object(
        'members', (SELECT jsonb_agg(jsonb_build_object(
          'externalId', external_id, 'points', points, 'knowledgeScore', knowledge_score,
          'status', status) ORDER BY external_id)
          FROM community_members WHERE external_id IN ('member-1','member-2')),
        'quests', (SELECT jsonb_agg(jsonb_build_object(
          'externalId', external_id, 'status', status) ORDER BY external_id)
          FROM community_quests WHERE external_id IN ('quest-1','quest-2')),
        'knowledgeClaims', (SELECT count(*) FROM knowledge_reward_claims),
        'generatedReferrals', (SELECT coalesce(jsonb_agg(external_id ORDER BY external_id), '[]'::jsonb)
          FROM referrals WHERE external_id IS NOT NULL AND external_id NOT IN ('referral-1','referral-2')),
        'generatedGifts', (SELECT coalesce(jsonb_agg(external_id ORDER BY external_id), '[]'::jsonb)
          FROM coffee_gifts WHERE external_id IS NOT NULL AND external_id <> 'coffee-gift-1'),
        'generatedEvents', (SELECT coalesce(jsonb_agg(external_id ORDER BY external_id), '[]'::jsonb)
          FROM progression_events WHERE external_id IS NOT NULL AND external_id NOT IN ('event-1','event-2'))
      ) AS state
    `);
    const row = metadata.rows[0];
    console.log(JSON.stringify({
      connection: {
        configuredDatabase: decodeURIComponent(configured.pathname.slice(1)),
        actualDatabase: row.database_name,
        serverClass: addressClass(row.server_address),
        isReplica: row.is_replica,
        databaseComment: row.database_comment || null
      },
      hardeningMigrations: migrations.rows,
      migrationObjectsPresent: ddl.rows[0],
      passportMappingCounts,
      initializedIdentifiers: Object.fromEntries(seeded.rows.map((item) => [item.kind, item.identifiers || []])),
      initializedMemberships: memberships.rows,
      currentRuntimeState: runtimeState.rows[0].state
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Read-only audit failed: ${error.message}`);
  process.exitCode = 1;
});
