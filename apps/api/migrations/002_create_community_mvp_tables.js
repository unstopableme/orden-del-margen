// Migration: Community MVP data model.
// This schema intentionally stores no securities, custody, payment, or legal title records.

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS community_members (
        id SERIAL PRIMARY KEY,
        display_name VARCHAR(120) NOT NULL,
        handle VARCHAR(80) NOT NULL UNIQUE,
        date_of_birth DATE,
        age_verified BOOLEAN NOT NULL DEFAULT FALSE,
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
      CREATE TABLE IF NOT EXISTS community_quests (
        id SERIAL PRIMARY KEY,
        community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        title VARCHAR(160) NOT NULL,
        description TEXT NOT NULL,
        topic VARCHAR(80) NOT NULL,
        points INTEGER NOT NULL CHECK (points > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        resolved_by INTEGER REFERENCES community_members(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS coffee_gifts (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES community_members(id),
        recipient_id INTEGER NOT NULL REFERENCES community_members(id),
        message VARCHAR(240) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (sender_id <> recipient_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS knowledge_challenges (
        id SERIAL PRIMARY KEY,
        topic VARCHAR(80) NOT NULL,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option INTEGER NOT NULL,
        points INTEGER NOT NULL CHECK (points > 0)
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
      CREATE INDEX IF NOT EXISTS idx_progression_member ON progression_events(member_id);
      CREATE INDEX IF NOT EXISTS idx_announcements_community ON community_announcements(community_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quests_community_status ON community_quests(community_id, status);
      CREATE INDEX IF NOT EXISTS idx_coffee_gifts_recipient ON coffee_gifts(recipient_id, created_at DESC);
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS community_announcements CASCADE');
    await db.query('DROP TABLE IF EXISTS knowledge_challenges CASCADE');
    await db.query('DROP TABLE IF EXISTS coffee_gifts CASCADE');
    await db.query('DROP TABLE IF EXISTS community_quests CASCADE');
    await db.query('DROP TABLE IF EXISTS progression_events CASCADE');
    await db.query('DROP TABLE IF EXISTS referrals CASCADE');
    await db.query('DROP TABLE IF EXISTS community_memberships CASCADE');
    await db.query('DROP TABLE IF EXISTS communities CASCADE');
    await db.query('DROP TABLE IF EXISTS community_members CASCADE');
  }
};
