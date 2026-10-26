'use strict';

module.exports = {
  up: async (db) => {
    // Intentionally create no memberships here. Owner assignment needs a separately reviewed workflow.
    await db.query(`
      CREATE TABLE organization_memberships (
        organization_id INTEGER NOT NULL
          REFERENCES organizations(id) ON DELETE RESTRICT,
        account_id UUID NOT NULL
          REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        role VARCHAR(16) NOT NULL
          CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
        status VARCHAR(16) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'revoked')),
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (organization_id, account_id)
      );

      CREATE INDEX idx_organization_memberships_active_account
        ON organization_memberships(account_id, organization_id)
        WHERE status = 'active';
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS organization_memberships');
  }
};
