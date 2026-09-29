// Migration: Community MVP data model.
// This schema intentionally stores no securities, custody, payment, or legal title records.

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS community_members (
        id SERIAL PRIMARY KEY,
        display_name VARCHAR(120) NOT NULL,
        handle VARCHAR(80) NOT NULL UNIQUE,
        bio VARCHAR(280),
        status VARCHAR(120) DEFAULT 'Available to connect',
        role VARCHAR(30) DEFAULT 'member',
        points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
        level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS communities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        area VARCHAR(120),
        description TEXT NOT NULL,
        property_id INTEGER REFERENCES properties(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS community_memberships (
        member_id INTEGER NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
        community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (member_id, community_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES community_members(id),
        invitee_name VARCHAR(80) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'invited',
        reward_points INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS progression_events (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES community_members(id),
        event_type VARCHAR(50) NOT NULL,
        label VARCHAR(180) NOT NULL,
        points INTEGER NOT NULL CHECK (points > 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS community_announcements (
        id SERIAL PRIMARY KEY,
        community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES community_members(id),
        title VARCHAR(160) NOT NULL,
        body TEXT NOT NULL,
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
      CREATE INDEX IF NOT EXISTS idx_progression_member ON progression_events(member_id);
      CREATE INDEX IF NOT EXISTS idx_announcements_community ON community_announcements(community_id, created_at DESC);
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS community_announcements CASCADE');
    await db.query('DROP TABLE IF EXISTS progression_events CASCADE');
    await db.query('DROP TABLE IF EXISTS referrals CASCADE');
    await db.query('DROP TABLE IF EXISTS community_memberships CASCADE');
    await db.query('DROP TABLE IF EXISTS communities CASCADE');
    await db.query('DROP TABLE IF EXISTS community_members CASCADE');
  }
};
