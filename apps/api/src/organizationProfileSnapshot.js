'use strict';

const { getOrganizationProfile } = require('./properties');

/**
 * Keep membership authorization and every profile query on one PostgreSQL
 * REPEATABLE READ snapshot. A concurrent membership revocation is observed by
 * the next request; it cannot make this request authorize against one snapshot
 * and read organization data from another.
 */
async function readOrganizationProfileSnapshot({
  db,
  callerContext,
  organizationId,
  authorizeOrganizationProfile
} = {}) {
  if (!db || typeof db.connect !== 'function') {
    throw new TypeError('db.connect must be a function');
  }
  if (typeof authorizeOrganizationProfile !== 'function') {
    throw new TypeError('authorizeOrganizationProfile must be a function');
  }

  const client = await db.connect();
  let transactionStarted = false;
  let transactionFinished = false;
  let releaseError;

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionStarted = true;

    const authorized = await authorizeOrganizationProfile({
      callerContext,
      organizationId,
      db: client
    });
    if (authorized !== true) {
      await client.query('ROLLBACK');
      transactionFinished = true;
      return { authorized: false, profile: null };
    }

    const profile = await getOrganizationProfile(client, organizationId);
    await client.query('COMMIT');
    transactionFinished = true;
    return { authorized: true, profile };
  } catch (error) {
    if (transactionStarted && !transactionFinished) {
      try {
        await client.query('ROLLBACK');
        transactionFinished = true;
      } catch (rollbackError) {
        if (error && typeof error === 'object') {
          error.rollbackError = rollbackError;
        }
        releaseError = rollbackError;
      }
    }
    throw error;
  } finally {
    if (client && typeof client.release === 'function') {
      client.release(releaseError);
    }
  }
}

module.exports = { readOrganizationProfileSnapshot };
