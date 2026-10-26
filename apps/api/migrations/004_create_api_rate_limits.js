'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS api_rate_limits (
        bucket VARCHAR(80) NOT NULL,
        subject_key VARCHAR(160) NOT NULL,
        window_started_at TIMESTAMPTZ NOT NULL,
        request_count INTEGER NOT NULL CHECK (request_count > 0),
        PRIMARY KEY (bucket, subject_key)
      )
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS api_rate_limits');
  }
};
