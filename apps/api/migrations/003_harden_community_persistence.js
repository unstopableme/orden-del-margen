'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      ALTER TABLE community_members
        ADD COLUMN IF NOT EXISTS external_id VARCHAR(80),
        ADD COLUMN IF NOT EXISTS topics JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS badges JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS knowledge_score INTEGER NOT NULL DEFAULT 0 CHECK (knowledge_score >= 0);
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);
      ALTER TABLE referrals ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);
      ALTER TABLE progression_events
        ADD COLUMN IF NOT EXISTS external_id VARCHAR(80),
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
        ADD COLUMN IF NOT EXISTS source_id VARCHAR(80);
      ALTER TABLE community_announcements ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);
      ALTER TABLE community_quests ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);
      ALTER TABLE coffee_gifts ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);
      ALTER TABLE knowledge_challenges ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);

      CREATE UNIQUE INDEX IF NOT EXISTS uq_community_members_external_id
        ON community_members(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_communities_external_id
        ON communities(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_referrals_external_id
        ON referrals(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_progression_events_external_id
        ON progression_events(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_announcements_external_id
        ON community_announcements(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_quests_external_id
        ON community_quests(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_coffee_gifts_external_id
        ON coffee_gifts(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_challenges_external_id
        ON knowledge_challenges(external_id) WHERE external_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_progression_reward_source
        ON progression_events(member_id, source_type, source_id)
        WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS knowledge_reward_claims (
        member_id INTEGER NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
        challenge_id INTEGER NOT NULL REFERENCES knowledge_challenges(id) ON DELETE CASCADE,
        points INTEGER NOT NULL CHECK (points > 0),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (member_id, challenge_id)
      );
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS knowledge_reward_claims');
    await db.query('DROP INDEX IF EXISTS uq_progression_reward_source');
    // Additive identity columns are intentionally retained on rollback to avoid
    // discarding persisted community identifiers.
  }
};
