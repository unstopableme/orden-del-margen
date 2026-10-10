'use strict';

class MemoryRateLimitStore {
  constructor() {
    this.entries = new Map();
  }

  async consume(bucket, subjectKey, limit, windowMs, now = Date.now()) {
    const key = `${bucket}:${subjectKey}`;
    let entry = this.entries.get(key);
    if (!entry || entry.windowStartedAt + windowMs <= now) {
      entry = { count: 0, windowStartedAt: now };
    }
    entry.count += 1;
    this.entries.set(key, entry);
    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - now) / 1000))
    };
  }
}

class PostgresRateLimitStore {
  constructor(pool) {
    this.pool = pool;
  }

  async verifyReady() {
    await this.pool.query('SELECT 1 FROM api_rate_limits LIMIT 0');
  }

  async consume(bucket, subjectKey, limit, windowMs) {
    const { rows } = await this.pool.query(`
      INSERT INTO api_rate_limits (bucket, subject_key, window_started_at, request_count)
      VALUES ($1, $2, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (bucket, subject_key) DO UPDATE SET
        request_count = CASE
          WHEN api_rate_limits.window_started_at + ($3 * interval '1 millisecond') <= CURRENT_TIMESTAMP THEN 1
          ELSE api_rate_limits.request_count + 1
        END,
        window_started_at = CASE
          WHEN api_rate_limits.window_started_at + ($3 * interval '1 millisecond') <= CURRENT_TIMESTAMP
            THEN CURRENT_TIMESTAMP
          ELSE api_rate_limits.window_started_at
        END
      RETURNING request_count,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM
          (window_started_at + ($3 * interval '1 millisecond') - CURRENT_TIMESTAMP))))::integer
          AS retry_after_seconds
    `, [bucket, subjectKey, windowMs]);
    return {
      allowed: rows[0].request_count <= limit,
      remaining: Math.max(0, limit - rows[0].request_count),
      retryAfterSeconds: rows[0].retry_after_seconds
    };
  }
}

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function configuredRateLimits(environment = process.env) {
  return {
    authentication: {
      limit: positiveInteger(environment.AUTH_ATTEMPT_RATE_LIMIT, 60, 'AUTH_ATTEMPT_RATE_LIMIT'),
      windowMs: positiveInteger(environment.AUTH_ATTEMPT_RATE_WINDOW_MS, 60_000, 'AUTH_ATTEMPT_RATE_WINDOW_MS')
    },
    authenticated: {
      limit: positiveInteger(environment.AUTHENTICATED_RATE_LIMIT, 120, 'AUTHENTICATED_RATE_LIMIT'),
      windowMs: positiveInteger(environment.AUTHENTICATED_RATE_WINDOW_MS, 60_000, 'AUTHENTICATED_RATE_WINDOW_MS')
    },
    rewards: {
      limit: positiveInteger(environment.REWARD_RATE_LIMIT, 10, 'REWARD_RATE_LIMIT'),
      windowMs: positiveInteger(environment.REWARD_RATE_WINDOW_MS, 60_000, 'REWARD_RATE_WINDOW_MS')
    }
  };
}

function createRateLimitMiddleware({
  store,
  bucket,
  limit,
  windowMs,
  subject = (req) => req.callerContext?.memberId
}) {
  if (!store || typeof store.consume !== 'function') throw new TypeError('rate-limit store is required');
  return async function rateLimit(req, res, next) {
    try {
      const subjectKey = subject(req);
      if (!subjectKey) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
      const result = await store.consume(bucket, subjectKey, limit, windowMs);
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests; retry later' }
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  configuredRateLimits,
  createRateLimitMiddleware
};
