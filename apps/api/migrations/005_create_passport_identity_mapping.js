'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS passport_wallet_bindings (
        passport_subject VARCHAR(255) PRIMARY KEY,
        member_id INTEGER NOT NULL UNIQUE REFERENCES community_members(id) ON DELETE CASCADE,
        wallet_address VARCHAR(42) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (wallet_address ~ '^0x[0-9a-f]{40}$')
      );

      CREATE TABLE IF NOT EXISTS wallet_property_access (
        wallet_address VARCHAR(42) NOT NULL REFERENCES passport_wallet_bindings(wallet_address) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        access_role VARCHAR(40) NOT NULL DEFAULT 'member',
        verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (wallet_address, property_id)
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_property_access_property
        ON wallet_property_access(property_id);
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS wallet_property_access');
    await db.query('DROP TABLE IF EXISTS passport_wallet_bindings');
  }
};
