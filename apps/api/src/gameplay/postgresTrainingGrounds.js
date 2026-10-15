'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { createSessionChallenges } = require('./trainingGroundsCatalog');

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_ID_PATTERN = ACCOUNT_ID_PATTERN;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const ACTION_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const XP_PER_SUCCESS = 25;
const RULES_VERSION = 1;
const MAX_DAILY_STARTS = 6;
const MAX_DAILY_REWARDS = 4;
const VOID_CODES = new Set([
  'RULESET_INTEGRITY',
  'CHALLENGE_DATA_UNAVAILABLE',
  'SERVER_ABORTED_SESSION'
]);

class TrainingGroundsError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = 'TrainingGroundsError';
    this.code = code;
    this.status = status;
  }
}

function validateAccountId(accountId) {
  if (typeof accountId !== 'string' || !ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new TypeError('accountId must be a UUID from trusted server authentication');
  }
}

function validateIdempotencyKey(idempotencyKey) {
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    throw new TypeError('idempotencyKey must contain 1-128 supported characters');
  }
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function iso(value) {
  return new Date(value).toISOString();
}

function publicChallenge(row) {
  return {
    id: row.id,
    ordinal: Number(row.ordinal),
    familyId: row.family_id,
    variantId: row.variant_id,
    prompt: row.prompt,
    state: row.state,
    options: row.option_order,
    opensAt: iso(row.opens_at),
    closesAt: iso(row.closes_at),
    status: row.status,
    selectedActionId: row.selected_action_id,
    answeredAt: row.answered_at ? iso(row.answered_at) : null
  };
}

async function loadSession(client, sessionId, accountId, { lock = false } = {}) {
  const { rows } = await client.query(`
    SELECT id, account_id, idempotency_key, request_fingerprint, rules_version,
      started_at, quota_date, status, correct_count, result, void_code, voided_at,
      void_evidence_ref
    FROM training_ground_sessions
    WHERE id = $1 AND account_id = $2
    ${lock ? 'FOR UPDATE' : ''}
  `, [sessionId, accountId]);
  return rows[0] || null;
}

async function loadChallenges(client, sessionId, { lock = false } = {}) {
  const { rows } = await client.query(`
    SELECT id, ordinal, family_id, variant_id, prompt, state, option_order,
      correct_action_id, opens_at, closes_at, status, selected_action_id, answered_at
    FROM training_ground_challenges
    WHERE session_id = $1
    ORDER BY ordinal
    ${lock ? 'FOR UPDATE' : ''}
  `, [sessionId]);
  return rows;
}

function sessionResult(session, challenges) {
  const deadline = new Date(session.started_at).getTime() + 10 * 60 * 1000;
  return {
    sessionId: session.id,
    status: session.status,
    startedAt: iso(session.started_at),
    deadlineAt: new Date(deadline).toISOString(),
    quotaDate: typeof session.quota_date === 'string'
      ? session.quota_date
      : iso(session.quota_date).slice(0, 10),
    rulesVersion: Number(session.rules_version),
    correctCount: session.correct_count === null ? null : Number(session.correct_count),
    xpAwarded: session.status === 'COMPLETED_SUCCESS' ? XP_PER_SUCCESS : 0,
    result: session.result,
    challenges: challenges.map(publicChallenge)
  };
}

async function settleReservation(client, session, finalStatus) {
  const { rows: reservationRows } = await client.query(`
    SELECT start_status, reward_status
    FROM training_ground_quota_reservations
    WHERE session_id = $1
    FOR UPDATE
  `, [session.id]);
  const reservation = reservationRows[0];
  if (!reservation) throw new Error('Training session has no quota reservation');
  if (reservation.start_status !== 'RESERVED' || reservation.reward_status !== 'RESERVED') {
    throw new Error('Active training session has a non-reserved quota reservation');
  }

  const successful = finalStatus === 'COMPLETED_SUCCESS';
  const startStatus = finalStatus === 'VOID' ? 'RELEASED' : 'CONSUMED';
  const rewardStatus = successful ? 'CONSUMED' : 'RELEASED';
  const changed = await client.query(`
    UPDATE training_ground_quota_reservations
    SET start_status = $1, reward_status = $2, updated_at = clock_timestamp()
    WHERE session_id = $3 AND start_status = 'RESERVED' AND reward_status = 'RESERVED'
  `, [startStatus, rewardStatus, session.id]);
  if (changed.rowCount !== 1) throw new Error('Training session quota was already settled');

  const quotaUpdate = finalStatus === 'VOID'
    ? await client.query(`
      UPDATE training_ground_daily_quotas
      SET starts_used = starts_used - 1,
          rewards_reserved = rewards_reserved - 1,
          updated_at = clock_timestamp()
      WHERE account_id = $1 AND quota_date = $2
        AND starts_used > 0 AND rewards_reserved > 0
    `, [session.account_id, session.quota_date])
    : (successful
      ? await client.query(`
        UPDATE training_ground_daily_quotas
        SET rewards_reserved = rewards_reserved - 1,
            rewards_awarded = rewards_awarded + 1,
            updated_at = clock_timestamp()
        WHERE account_id = $1 AND quota_date = $2 AND rewards_reserved > 0
          AND rewards_awarded < $3
      `, [session.account_id, session.quota_date, MAX_DAILY_REWARDS])
      : await client.query(`
        UPDATE training_ground_daily_quotas
        SET rewards_reserved = rewards_reserved - 1,
            updated_at = clock_timestamp()
        WHERE account_id = $1 AND quota_date = $2 AND rewards_reserved > 0
        `, [session.account_id, session.quota_date]));
  if (quotaUpdate.rowCount !== 1) throw new Error('Training session quota counters are inconsistent');
}

async function completeSession(client, session, challenges) {
  const correctCount = challenges.filter((challenge) => challenge.status === 'CORRECT').length;
  const acceptedCount = challenges.filter((challenge) =>
    challenge.status === 'CORRECT' || challenge.status === 'INCORRECT').length;
  const status = correctCount >= 4
    ? 'COMPLETED_SUCCESS'
    : (acceptedCount === 0 ? 'EXPIRED' : 'COMPLETED_FAILURE');
  const result = {
    status,
    correctCount,
    xpAwarded: status === 'COMPLETED_SUCCESS' ? XP_PER_SUCCESS : 0
  };
  await client.query(`
    UPDATE training_ground_sessions
    SET status = $1, correct_count = $2, result = $3
    WHERE id = $4 AND status = 'ACTIVE'
  `, [status, correctCount, result, session.id]);
  await settleReservation(client, session, status);

  if (status === 'COMPLETED_SUCCESS') {
    const inserted = await client.query(`
      INSERT INTO character_xp_ledger
        (id, account_id, source_type, source_event_id, xp, occurred_at, quota_date, rules_version)
      VALUES ($1, $2, 'training_grounds', $3, $4, clock_timestamp(), $5, $6)
      ON CONFLICT (account_id, source_type, source_event_id) DO NOTHING
    `, [randomUUID(), session.account_id, session.id, XP_PER_SUCCESS,
      session.quota_date, session.rules_version]);
    if (inserted.rowCount !== 1) {
      throw new Error('Training session XP ledger entry already exists before completion');
    }
  }
  return { ...session, status, correct_count: correctCount, result };
}

async function advanceSession(client, session, now) {
  if (session.status !== 'ACTIVE') return { session, challenges: await loadChallenges(client, session.id) };

  await client.query(`
    UPDATE training_ground_challenges
    SET status = 'MISSED'
    WHERE session_id = $1 AND status = 'PENDING' AND closes_at <= $2
  `, [session.id, now]);
  let challenges = await loadChallenges(client, session.id, { lock: true });
  const deadlinePassed = new Date(now).getTime() >= new Date(session.started_at).getTime() + 10 * 60 * 1000;
  if (challenges.length !== 5) throw new Error('Training session must contain exactly five challenges');
  if (deadlinePassed || challenges.every((challenge) => challenge.status !== 'PENDING')) {
    session = await completeSession(client, session, challenges);
    challenges = await loadChallenges(client, session.id);
  }
  return { session, challenges };
}

async function readSessionResponse(client, session, challenges) {
  return sessionResult(session, challenges);
}

class PostgresTrainingGroundsService {
  constructor(pool) {
    if (!pool || typeof pool.connect !== 'function') {
      throw new TypeError('pool must provide connect()');
    }
    this.pool = pool;
  }

  async verifyReady() {
    const client = await this.pool.connect();
    try {
      for (const table of [
        'training_ground_sessions',
        'training_ground_challenges',
        'training_ground_daily_quotas',
        'training_ground_quota_reservations',
        'training_ground_answers',
        'character_xp_ledger',
        'training_ground_void_audit'
      ]) {
        await client.query(`SELECT 1 FROM ${table} LIMIT 0`);
      }
    } finally {
      client.release();
    }
  }

  async createSession({ accountId, idempotencyKey } = {}) {
    validateAccountId(accountId);
    validateIdempotencyKey(idempotencyKey);
    const requestFingerprint = hash({ operation: 'training_session_start', accountId, rulesVersion: RULES_VERSION });
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const account = await client.query(
        'SELECT id FROM authenticated_accounts WHERE id = $1 FOR UPDATE',
        [accountId]
      );
      if (account.rowCount !== 1) {
        throw new TrainingGroundsError('ACCOUNT_NOT_FOUND', 'Authenticated account was not found', 404);
      }

      const prior = await client.query(`
        SELECT id FROM training_ground_sessions
        WHERE account_id = $1 AND idempotency_key = $2
        FOR UPDATE
      `, [accountId, idempotencyKey]);
      if (prior.rows[0]) {
        const session = await loadSession(client, prior.rows[0].id, accountId, { lock: true });
        if (session.request_fingerprint !== requestFingerprint) {
          throw new TrainingGroundsError('IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for another session request');
        }
        const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS now');
        const advanced = await advanceSession(client, session, timeRows[0].now);
        const response = await readSessionResponse(client, advanced.session, advanced.challenges);
        await client.query('COMMIT');
        transactionStarted = false;
        return response;
      }

      const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS now');
      const startedAt = timeRows[0].now;
      const { rows: dateRows } = await client.query(
        "SELECT ($1::timestamptz AT TIME ZONE 'UTC')::date AS quota_date",
        [startedAt]
      );
      const quotaDate = dateRows[0].quota_date;

      const { rows: activeRows } = await client.query(`
        SELECT id, account_id, started_at, quota_date, status, rules_version,
          correct_count, result
        FROM training_ground_sessions
        WHERE account_id = $1 AND status = 'ACTIVE'
        FOR UPDATE
      `, [accountId]);
      if (activeRows[0]) {
        const advanced = await advanceSession(client, activeRows[0], startedAt);
        if (advanced.session.status === 'ACTIVE') {
          throw new TrainingGroundsError('ACTIVE_SESSION_EXISTS',
            'An active Training Grounds session already exists');
        }
      }

      await client.query(`
        INSERT INTO training_ground_daily_quotas (account_id, quota_date)
        VALUES ($1, $2) ON CONFLICT (account_id, quota_date) DO NOTHING
      `, [accountId, quotaDate]);
      const { rows: quotaRows } = await client.query(`
        SELECT starts_used, rewards_reserved, rewards_awarded
        FROM training_ground_daily_quotas
        WHERE account_id = $1 AND quota_date = $2
        FOR UPDATE
      `, [accountId, quotaDate]);
      const quota = quotaRows[0];
      if (quota.starts_used >= MAX_DAILY_STARTS) {
        throw new TrainingGroundsError('DAILY_START_LIMIT_REACHED',
          'Daily Training Grounds start limit has been reached');
      }
      if (Number(quota.rewards_reserved) + Number(quota.rewards_awarded) >= MAX_DAILY_REWARDS) {
        throw new TrainingGroundsError('DAILY_REWARD_LIMIT_REACHED',
          'Daily Training Grounds reward limit has been reached');
      }

      const sessionId = randomUUID();
      const sessionInsert = await client.query(`
        INSERT INTO training_ground_sessions
          (id, account_id, idempotency_key, request_fingerprint, rules_version, started_at, quota_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, account_id, rules_version, started_at, quota_date, status, correct_count, result
      `, [sessionId, accountId, idempotencyKey, requestFingerprint, RULES_VERSION, startedAt, quotaDate]);
      const session = sessionInsert.rows[0];
      const challenges = createSessionChallenges();
      for (const challenge of challenges) {
        await client.query(`
          INSERT INTO training_ground_challenges
            (id, session_id, ordinal, family_id, variant_id, prompt, state, option_order,
             correct_action_id, opens_at, closes_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10 + (($3 - 1) * INTERVAL '2 minutes'),
            $10 + ($3 * INTERVAL '2 minutes'))
        `, [randomUUID(), sessionId, challenge.ordinal, challenge.familyId, challenge.variantId,
          challenge.prompt, challenge.state, challenge.options, challenge.correctActionId, startedAt]);
      }
      const reserved = await client.query(`
        UPDATE training_ground_daily_quotas
        SET starts_used = starts_used + 1,
            rewards_reserved = rewards_reserved + 1,
            updated_at = clock_timestamp()
        WHERE account_id = $1 AND quota_date = $2
          AND starts_used < $3 AND rewards_reserved + rewards_awarded < $4
      `, [accountId, quotaDate, MAX_DAILY_STARTS, MAX_DAILY_REWARDS]);
      if (reserved.rowCount !== 1) throw new Error('Training session quota reservation failed');
      await client.query(`
        INSERT INTO training_ground_quota_reservations
          (session_id, account_id, quota_date)
        VALUES ($1, $2, $3)
      `, [sessionId, accountId, quotaDate]);
      const storedChallenges = await loadChallenges(client, sessionId);
      const response = await readSessionResponse(client, session, storedChallenges);
      await client.query('COMMIT');
      transactionStarted = false;
      return response;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Training session creation and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async answer({ accountId, sessionId, challengeId, actionId, idempotencyKey } = {}) {
    validateAccountId(accountId);
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      throw new TypeError('sessionId must be a UUID');
    }
    if (typeof challengeId !== 'string' || !SESSION_ID_PATTERN.test(challengeId)) {
      throw new TypeError('challengeId must be a UUID');
    }
    if (typeof actionId !== 'string' || !ACTION_ID_PATTERN.test(actionId)) {
      throw new TypeError('actionId must be a stable action ID');
    }
    validateIdempotencyKey(idempotencyKey);
    const payloadFingerprint = hash({ sessionId, challengeId, actionId });
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const session = await loadSession(client, sessionId, accountId, { lock: true });
      if (!session) {
        throw new TrainingGroundsError('SESSION_NOT_FOUND', 'Training Grounds session was not found', 404);
      }
      const { rows: replayRows } = await client.query(`
        SELECT payload_fingerprint, result
        FROM training_ground_answers
        WHERE session_id = $1 AND idempotency_key = $2
        FOR UPDATE
      `, [sessionId, idempotencyKey]);
      if (replayRows[0]) {
        if (replayRows[0].payload_fingerprint !== payloadFingerprint) {
          throw new TrainingGroundsError('IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for another answer');
        }
        await client.query('COMMIT');
        transactionStarted = false;
        return replayRows[0].result;
      }

      const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS now');
      const receivedAt = timeRows[0].now;
      const challengesBeforeAdvance = await loadChallenges(client, sessionId);
      const targetBeforeAdvance = challengesBeforeAdvance.find((challenge) => challenge.id === challengeId);
      if (!targetBeforeAdvance) {
        throw new TrainingGroundsError('CHALLENGE_NOT_FOUND', 'Challenge does not belong to this session', 404);
      }
      const advanced = await advanceSession(client, session, receivedAt);
      const target = advanced.challenges.find((challenge) => challenge.id === challengeId);
      let rejected = null;
      if (advanced.session.status !== 'ACTIVE' || target.status !== 'PENDING' ||
          receivedAt < target.opens_at || receivedAt >= target.closes_at) {
        rejected = new TrainingGroundsError(
          receivedAt < target.opens_at ? 'ANSWER_WINDOW_NOT_OPEN' : 'ANSWER_WINDOW_CLOSED',
          receivedAt < target.opens_at
            ? 'This challenge answer window has not opened'
            : 'This challenge answer window has closed'
        );
      }
      if (rejected) {
        await client.query('COMMIT');
        transactionStarted = false;
        throw rejected;
      }
      if (!target.option_order.some((option) => option.id === actionId)) {
        await client.query('COMMIT');
        transactionStarted = false;
        throw new TrainingGroundsError('ACTION_NOT_OFFERED',
          'The selected action was not offered for this challenge', 400);
      }
      const isCorrect = actionId === target.correct_action_id;
      const challengeStatus = isCorrect ? 'CORRECT' : 'INCORRECT';
      const updated = await client.query(`
        UPDATE training_ground_challenges
        SET status = $1, selected_action_id = $2, answered_at = $3
        WHERE id = $4 AND session_id = $5 AND status = 'PENDING'
      `, [challengeStatus, actionId, receivedAt, challengeId, sessionId]);
      if (updated.rowCount !== 1) throw new Error('Training challenge was concurrently answered');
      const answerId = randomUUID();
      await client.query(`
        INSERT INTO training_ground_answers
          (id, session_id, challenge_id, idempotency_key, payload_fingerprint,
           action_id, is_correct, result, received_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8)
      `, [answerId, sessionId, challengeId, idempotencyKey, payloadFingerprint,
        actionId, isCorrect, receivedAt]);

      const updatedChallenges = await loadChallenges(client, sessionId);
      let updatedSession = advanced.session;
      if (updatedChallenges.every((challenge) => challenge.status !== 'PENDING')) {
        updatedSession = await completeSession(client, updatedSession, updatedChallenges);
      }
      const result = {
        sessionId,
        challengeId,
        actionId,
        correct: isCorrect,
        challengeStatus,
        sessionStatus: updatedSession.status,
        correctCount: updatedSession.correct_count === null
          ? updatedChallenges.filter((challenge) => challenge.status === 'CORRECT').length
          : Number(updatedSession.correct_count),
        xpAwarded: updatedSession.status === 'COMPLETED_SUCCESS' ? XP_PER_SUCCESS : 0
      };
      await client.query('UPDATE training_ground_answers SET result = $1 WHERE id = $2', [result, answerId]);
      await client.query('COMMIT');
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Training answer and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getSession({ accountId, sessionId } = {}) {
    validateAccountId(accountId);
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      throw new TypeError('sessionId must be a UUID');
    }
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const session = await loadSession(client, sessionId, accountId, { lock: true });
      if (!session) {
        throw new TrainingGroundsError('SESSION_NOT_FOUND', 'Training Grounds session was not found', 404);
      }
      const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS now');
      const advanced = await advanceSession(client, session, timeRows[0].now);
      const response = await readSessionResponse(client, advanced.session, advanced.challenges);
      await client.query('COMMIT');
      transactionStarted = false;
      return response;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Training session read and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getCharacterXp({ accountId } = {}) {
    validateAccountId(accountId);
    const { rows } = await this.pool.query(`
      SELECT COALESCE(SUM(xp), 0)::bigint AS lifetime_total,
        MAX(occurred_at) AS as_of
      FROM character_xp_ledger
      WHERE account_id = $1 AND source_type = 'training_grounds'
    `, [accountId]);
    return {
      lifetimeTotal: String(rows[0].lifetime_total),
      asOf: rows[0].as_of ? iso(rows[0].as_of) : null
    };
  }

  async voidSession({ sessionId, voidCode, evidenceRef, serviceVersion } = {}) {
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      throw new TypeError('sessionId must be a UUID');
    }
    if (!VOID_CODES.has(voidCode) || typeof evidenceRef !== 'string' ||
        !evidenceRef.trim() || evidenceRef.length > 512 ||
        typeof serviceVersion !== 'string' || !serviceVersion.trim() || serviceVersion.length > 64) {
      throw new TypeError('VOID requires a supported code, evidence reference, and service version');
    }
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const { rows } = await client.query(`
        SELECT id, account_id, started_at, quota_date, status, rules_version,
          correct_count, result
        FROM training_ground_sessions
        WHERE id = $1
        FOR UPDATE
      `, [sessionId]);
      const session = rows[0];
      if (!session) throw new TrainingGroundsError('SESSION_NOT_FOUND', 'Training Grounds session was not found', 404);
      if (session.status !== 'ACTIVE') {
        throw new TrainingGroundsError('SESSION_NOT_VOIDABLE',
          'Only an active session can be voided');
      }
      const { rows: timeRows } = await client.query('SELECT clock_timestamp() AS now');
      const advanced = await advanceSession(client, session, timeRows[0].now);
      if (advanced.session.status !== 'ACTIVE') {
        await client.query('COMMIT');
        transactionStarted = false;
        throw new TrainingGroundsError('SESSION_NOT_VOIDABLE',
          'A session with a completed outcome cannot be voided');
      }
      const voidedAt = timeRows[0].now;
      await client.query(`
        UPDATE training_ground_sessions
        SET status = 'VOID', void_code = $1, voided_at = $2, void_evidence_ref = $3
        WHERE id = $4 AND status = 'ACTIVE'
      `, [voidCode, voidedAt, evidenceRef, sessionId]);
      await client.query(`
        INSERT INTO training_ground_void_audit
          (id, session_id, void_code, evidence_ref, service_version, voided_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [randomUUID(), sessionId, voidCode, evidenceRef, serviceVersion, voidedAt]);
      await settleReservation(client, session, 'VOID');
      await client.query('COMMIT');
      transactionStarted = false;
      return { sessionId, status: 'VOID', voidCode, voidedAt: iso(voidedAt) };
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Training session VOID and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  PostgresTrainingGroundsService,
  TrainingGroundsError
};
