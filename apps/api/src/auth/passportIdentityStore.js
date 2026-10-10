'use strict';

class PostgresPassportIdentityStore {
  constructor(pool) {
    this.pool = pool;
  }

  async verifyReady() {
    await this.pool.query('SELECT 1 FROM passport_wallet_bindings LIMIT 0');
    await this.pool.query('SELECT 1 FROM wallet_property_access LIMIT 0');
  }

  async findByIdentity(passportIssuer, passportSubject) {
    const { rows } = await this.pool.query(`
      SELECT m.external_id AS member_id, b.wallet_address,
        COALESCE(jsonb_agg(jsonb_build_object(
          'id', p.id,
          'address', p.address,
          'city', p.city,
          'state', p.state,
          'propertyType', p.property_type,
          'status', p.status,
          'accessRole', a.access_role,
          'verifiedAt', a.verified_at
        ) ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS properties
      FROM passport_wallet_bindings b
      JOIN community_members m ON m.id=b.member_id
      LEFT JOIN wallet_property_access a ON a.wallet_address=b.wallet_address
      LEFT JOIN properties p ON p.id=a.property_id
      WHERE b.passport_issuer=$1 AND b.passport_subject=$2 AND b.revoked_at IS NULL
      GROUP BY m.external_id, b.wallet_address
    `, [passportIssuer, passportSubject]);
    if (!rows[0]) return null;
    return {
      memberId: rows[0].member_id,
      walletAddress: rows[0].wallet_address,
      properties: rows[0].properties
    };
  }
}

module.exports = { PostgresPassportIdentityStore };
