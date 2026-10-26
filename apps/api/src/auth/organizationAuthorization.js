'use strict';

const ACCOUNT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POSTGRES_INTEGER = 2_147_483_647;

/**
 * Authorize access using only the account identity established by authentication.
 * Membership is queried on every request so revocations take effect immediately.
 *
 * @param {{ callerContext: Object, organizationId: number, db: { query: Function } }} input
 * @returns {Promise<boolean>} True only for an active organization membership.
 */
async function authorizeOrganizationProfile({ callerContext, organizationId, db } = {}) {
  const accountId = callerContext?.accountId;
  if (typeof accountId !== 'string' || !ACCOUNT_UUID_PATTERN.test(accountId)) {
    return false;
  }
  if (
    !Number.isSafeInteger(organizationId)
    || organizationId <= 0
    || organizationId > MAX_POSTGRES_INTEGER
  ) {
    return false;
  }
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('db.query must be a function');
  }

  const { rows } = await db.query(`
    SELECT 1
    FROM organization_memberships
    WHERE organization_id = $1
      AND account_id = $2
      AND status = 'active'
      AND role IN ('owner', 'admin', 'editor', 'viewer')
    LIMIT 1
  `, [organizationId, accountId]);

  return rows.length > 0;
}

async function verifyOrganizationMembershipSchema(db) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('db.query must be a function');
  }

  await db.query(`
    SELECT organization_id, account_id, role, status
    FROM organization_memberships
    LIMIT 0
  `);
}

module.exports = {
  authorizeOrganizationProfile,
  verifyOrganizationMembershipSchema
};
