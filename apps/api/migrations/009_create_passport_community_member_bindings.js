'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS passport_community_member_bindings (
        passport_issuer VARCHAR(2048) NOT NULL,
        passport_subject VARCHAR(255) NOT NULL,
        member_id INTEGER NOT NULL UNIQUE REFERENCES community_members(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (passport_issuer, passport_subject),
        CHECK (passport_issuer ~ '^https://[^[:space:]]+$'),
        CHECK (btrim(passport_subject) <> '')
      )
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS passport_community_member_bindings');
  }
};
