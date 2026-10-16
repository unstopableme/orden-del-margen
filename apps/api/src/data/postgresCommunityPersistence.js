'use strict';

function nextExternalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function memberRow(client, externalId, lock = false) {
  const { rows } = await client.query(
    `SELECT * FROM community_members WHERE external_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [externalId]
  );
  return rows[0];
}

async function seedDatabase(client, data) {
  for (const member of data.members) {
    await client.query(`
      INSERT INTO community_members
        (external_id, display_name, handle, bio, status, role, points, level, topics, badges, knowledge_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [member.id, member.displayName, member.handle, member.bio, member.status, member.role,
      member.points, member.level, JSON.stringify(member.topics), JSON.stringify(member.badges),
      member.knowledgeScore || 0]);
  }

  for (const community of data.communities) {
    await client.query(`
      INSERT INTO communities (external_id, name, area, description)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [community.id, community.name, community.area, community.description]);
  }

  for (const member of data.members) {
    for (const communityId of member.communityIds) {
      await client.query(`
        INSERT INTO community_memberships (member_id, community_id)
        SELECT m.id, c.id FROM community_members m, communities c
        WHERE m.external_id = $1 AND c.external_id = $2
        ON CONFLICT DO NOTHING
      `, [member.id, communityId]);
    }
  }

  for (const quest of data.quests) {
    await client.query(`
      INSERT INTO community_quests
        (external_id, community_id, title, description, topic, points, status, resolved_by, resolved_at)
      SELECT $1, c.id, $3, $4, $5, $6, $7::varchar, m.id,
             CASE WHEN $7::varchar = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END
      FROM communities c LEFT JOIN community_members m ON m.external_id = $8
      WHERE c.external_id = $2
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [quest.id, quest.communityId, quest.title, quest.description, quest.topic, quest.points,
      quest.status, quest.resolvedBy]);
  }

  for (const challenge of data.knowledgeChallenges) {
    await client.query(`
      INSERT INTO knowledge_challenges
        (external_id, topic, question, options, correct_option, points)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6)
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [challenge.id, challenge.topic, challenge.question, JSON.stringify(challenge.options),
      challenge.correctOption, challenge.points]);
  }

  for (const referral of data.referrals) {
    await client.query(`
      INSERT INTO referrals (external_id, referrer_id, invitee_name, status, reward_points)
      SELECT $1, id, $3, $4, $5 FROM community_members WHERE external_id = $2
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [referral.id, referral.referrerId, referral.inviteeName, referral.status, referral.rewardPoints]);
  }

  for (const gift of data.coffeeGifts) {
    await client.query(`
      INSERT INTO coffee_gifts (external_id, sender_id, recipient_id, message, created_at)
      SELECT $1, s.id, r.id, $4, $5 FROM community_members s, community_members r
      WHERE s.external_id = $2 AND r.external_id = $3
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [gift.id, gift.senderId, gift.recipientId, gift.message, gift.createdAt]);
  }

  for (const announcement of data.announcements) {
    await client.query(`
      INSERT INTO community_announcements
        (external_id, community_id, author_id, title, body, pinned, created_at)
      SELECT $1, c.id, m.id, $4, $5, $6, $7
      FROM communities c, community_members m
      WHERE c.external_id=$2 AND m.display_name=$3
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [announcement.id, announcement.communityId, announcement.author, announcement.title,
      announcement.body, announcement.pinned, announcement.createdAt]);
  }

  for (const event of data.progressionEvents) {
    await client.query(`
      INSERT INTO progression_events (external_id, member_id, event_type, label, points, created_at)
      SELECT $1, id, $3, $4, $5, $6 FROM community_members WHERE external_id = $2
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [event.id, event.memberId, event.type, event.label, event.points, event.createdAt]);
  }
}

class PostgresCommunityPersistence {
  constructor(pool) {
    this.pool = pool;
  }

  async initialize(data, { seed = false } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (seed) {
        await seedDatabase(client, data);
      }
      await client.query('COMMIT');
      await this.reload(data);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reload(data) {
    const [members, communities, memberships, referrals, events, quests, gifts, challenges, awards,
      announcements] =
      await Promise.all([
        this.pool.query('SELECT * FROM community_members WHERE external_id IS NOT NULL ORDER BY id'),
        this.pool.query('SELECT * FROM communities WHERE external_id IS NOT NULL ORDER BY id'),
        this.pool.query(`SELECT m.external_id AS member_id, c.external_id AS community_id
          FROM community_memberships cm JOIN community_members m ON m.id=cm.member_id
          JOIN communities c ON c.id=cm.community_id`),
        this.pool.query(`SELECT r.*, m.external_id AS referrer_external_id FROM referrals r
          JOIN community_members m ON m.id=r.referrer_id WHERE r.external_id IS NOT NULL ORDER BY r.id`),
        this.pool.query(`SELECT p.*, m.external_id AS member_external_id FROM progression_events p
          JOIN community_members m ON m.id=p.member_id WHERE p.external_id IS NOT NULL ORDER BY p.id`),
        this.pool.query(`SELECT q.*, c.external_id AS community_external_id, m.external_id AS resolver_external_id
          FROM community_quests q JOIN communities c ON c.id=q.community_id
          LEFT JOIN community_members m ON m.id=q.resolved_by WHERE q.external_id IS NOT NULL ORDER BY q.id`),
        this.pool.query(`SELECT g.*, s.external_id AS sender_external_id, r.external_id AS recipient_external_id
          FROM coffee_gifts g JOIN community_members s ON s.id=g.sender_id
          JOIN community_members r ON r.id=g.recipient_id WHERE g.external_id IS NOT NULL ORDER BY g.id`),
        this.pool.query('SELECT * FROM knowledge_challenges WHERE external_id IS NOT NULL ORDER BY id'),
        this.pool.query(`SELECT m.external_id AS member_id, k.external_id AS challenge_id, a.points, a.created_at
          FROM knowledge_reward_claims a JOIN community_members m ON m.id=a.member_id
          JOIN knowledge_challenges k ON k.id=a.challenge_id`),
        this.pool.query(`SELECT a.*, c.external_id AS community_external_id, m.display_name AS author_name
          FROM community_announcements a JOIN communities c ON c.id=a.community_id
          JOIN community_members m ON m.id=a.author_id WHERE a.external_id IS NOT NULL
          ORDER BY a.created_at DESC`)
      ]);

    const communityIds = new Map();
    for (const row of memberships.rows) {
      if (!communityIds.has(row.member_id)) communityIds.set(row.member_id, []);
      communityIds.get(row.member_id).push(row.community_id);
    }
    data.members.splice(0, data.members.length, ...members.rows.map((row) => ({
      id: row.external_id, displayName: row.display_name, handle: row.handle, bio: row.bio || '',
      topics: row.topics || [], status: row.status, role: row.role, points: row.points,
      knowledgeScore: row.knowledge_score, level: row.level, badges: row.badges || [],
      communityIds: communityIds.get(row.external_id) || []
    })));
    data.communities.splice(0, data.communities.length, ...communities.rows.map((row) => ({
      id: row.external_id, name: row.name, area: row.area, description: row.description,
      propertyId: row.property_id
    })));
    data.referrals.splice(0, data.referrals.length, ...referrals.rows.map((row) => ({
      id: row.external_id, referrerId: row.referrer_external_id, inviteeName: row.invitee_name,
      status: row.status, rewardPoints: row.reward_points
    })));
    data.progressionEvents.splice(0, data.progressionEvents.length, ...events.rows.map((row) => ({
      id: row.external_id, memberId: row.member_external_id, type: row.event_type,
      label: row.label, points: row.points, createdAt: row.created_at.toISOString()
    })));
    data.quests.splice(0, data.quests.length, ...quests.rows.map((row) => ({
      id: row.external_id, communityId: row.community_external_id, title: row.title,
      description: row.description, topic: row.topic, points: row.points, status: row.status,
      resolvedBy: row.resolver_external_id || null
    })));
    data.coffeeGifts.splice(0, data.coffeeGifts.length, ...gifts.rows.map((row) => ({
      id: row.external_id, senderId: row.sender_external_id, recipientId: row.recipient_external_id,
      message: row.message, createdAt: row.created_at.toISOString()
    })));
    data.knowledgeChallenges.splice(0, data.knowledgeChallenges.length, ...challenges.rows.map((row) => ({
      id: row.external_id, topic: row.topic, question: row.question, options: row.options,
      correctOption: row.correct_option, points: row.points
    })));
    data.knowledgeAwards.splice(0, data.knowledgeAwards.length, ...awards.rows.map((row) => ({
      memberId: row.member_id, challengeId: row.challenge_id, points: row.points,
      createdAt: row.created_at.toISOString()
    })));
    data.announcements.splice(0, data.announcements.length, ...announcements.rows.map((row) => ({
      id: row.external_id, communityId: row.community_external_id, title: row.title,
      body: row.body, author: row.author_name, createdAt: row.created_at.toISOString(),
      pinned: row.pinned
    })));
  }

  async updateStatus(memberId, status) {
    await this.pool.query(`UPDATE community_members SET status=$2, updated_at=CURRENT_TIMESTAMP
      WHERE external_id=$1`, [memberId, status]);
  }

  async updateProfile(memberId, { displayName, bio, topics }) {
    await this.pool.query(`UPDATE community_members SET display_name=$2, bio=$3, topics=$4::jsonb,
      updated_at=CURRENT_TIMESTAMP WHERE external_id=$1`,
    [memberId, displayName, bio, JSON.stringify(topics)]);
  }

  async createReferral(referrerId, inviteeName) {
    const id = nextExternalId('referral');
    await this.pool.query(`INSERT INTO referrals (external_id, referrer_id, invitee_name)
      SELECT $1, id, $3 FROM community_members WHERE external_id=$2`, [id, referrerId, inviteeName]);
    return id;
  }

  async createGift(senderId, recipientId, message) {
    const id = nextExternalId('coffee-gift');
    const createdAt = new Date().toISOString();
    await this.pool.query(`INSERT INTO coffee_gifts
      (external_id, sender_id, recipient_id, message, created_at)
      SELECT $1, s.id, r.id, $4, $5 FROM community_members s, community_members r
      WHERE s.external_id=$2 AND r.external_id=$3`, [id, senderId, recipientId, message, createdAt]);
    return { id, createdAt };
  }

  async resolveQuest(memberId, questId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const member = await memberRow(client, memberId, true);
      const { rows } = await client.query(`SELECT q.*, c.external_id AS community_external_id
        FROM community_quests q JOIN communities c ON c.id=q.community_id
        WHERE q.external_id=$1 FOR UPDATE`, [questId]);
      const quest = rows[0];
      if (!member || !quest) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      const membership = await client.query(`SELECT 1 FROM community_memberships
        WHERE member_id=$1 AND community_id=$2`, [member.id, quest.community_id]);
      if (!membership.rowCount) {
        await client.query('ROLLBACK');
        return { status: 'forbidden' };
      }
      if (quest.status !== 'open') {
        await client.query('ROLLBACK');
        return { status: 'already_resolved' };
      }
      const eventId = nextExternalId('event');
      const points = member.points + quest.points;
      const level = Math.floor(points / 100) + 1;
      await client.query(`UPDATE community_quests SET status='resolved', resolved_by=$2,
        resolved_at=CURRENT_TIMESTAMP WHERE id=$1`, [quest.id, member.id]);
      await client.query('UPDATE community_members SET points=$2, level=$3 WHERE id=$1',
        [member.id, points, level]);
      await client.query(`INSERT INTO progression_events
        (external_id, member_id, event_type, label, points, source_type, source_id)
        VALUES ($1,$2,'community_quest',$3,$4,'quest',$5)`,
      [eventId, member.id, `Resolved quest: ${quest.title}`, quest.points, questId]);
      await client.query('COMMIT');
      return { status: 'awarded' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async awardKnowledge(memberId, challengeId, option) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const member = await memberRow(client, memberId, true);
      const { rows } = await client.query(
        'SELECT * FROM knowledge_challenges WHERE external_id=$1', [challengeId]
      );
      const challenge = rows[0];
      if (!member || !challenge) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      if (option !== challenge.correct_option) {
        await client.query('COMMIT');
        return { status: 'incorrect' };
      }
      const claim = await client.query(`INSERT INTO knowledge_reward_claims
        (member_id, challenge_id, points) VALUES ($1,$2,$3)
        ON CONFLICT (member_id, challenge_id) DO NOTHING RETURNING created_at`,
      [member.id, challenge.id, challenge.points]);
      if (!claim.rowCount) {
        await client.query('COMMIT');
        return { status: 'already_rewarded' };
      }
      const points = member.points + challenge.points;
      const score = member.knowledge_score + challenge.points;
      const level = Math.floor(points / 100) + 1;
      await client.query(`UPDATE community_members SET points=$2, knowledge_score=$3, level=$4
        WHERE id=$1`, [member.id, points, score, level]);
      await client.query(`INSERT INTO progression_events
        (external_id, member_id, event_type, label, points, source_type, source_id)
        VALUES ($1,$2,'knowledge_pvp',$3,$4,'knowledge_challenge',$5)`,
      [nextExternalId('event'), member.id, `Answered a ${challenge.topic} knowledge challenge`,
        challenge.points, challengeId]);
      await client.query('COMMIT');
      return { status: 'awarded' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { PostgresCommunityPersistence };
