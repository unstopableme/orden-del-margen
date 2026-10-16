'use strict';

const crypto = require('node:crypto');

class PostgresPassportIdentityStore {
  constructor(pool) {
    this.pool = pool;
  }

  async verifyReady() {
    await this.pool.query('SELECT 1 FROM passport_wallet_bindings LIMIT 0');
    await this.pool.query('SELECT 1 FROM wallet_property_access LIMIT 0');
    await this.pool.query('SELECT 1 FROM authenticated_accounts LIMIT 0');
    await this.pool.query('SELECT 1 FROM authenticated_account_identities LIMIT 0');
    await this.pool.query('SELECT 1 FROM passport_community_member_bindings LIMIT 0');
  }

  async findByIdentity(passportIssuer, passportSubject) {
    if (typeof passportIssuer !== 'string' || !passportIssuer || passportIssuer.length > 2048) {
      throw new TypeError('passportIssuer must be a nonempty string of at most 2048 characters');
    }
    if (typeof passportSubject !== 'string' || !passportSubject.trim() || passportSubject.length > 255) {
      throw new TypeError('passportSubject must be a nonempty string of at most 255 characters');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let { rows: bindings } = await client.query(`
        SELECT m.external_id AS member_id, NULL::varchar AS wallet_address
        FROM passport_community_member_bindings i
        JOIN community_members m ON m.id=i.member_id
        WHERE i.passport_issuer=$1 AND i.passport_subject=$2
        FOR UPDATE OF i
      `, [passportIssuer, passportSubject]);
      if (!bindings[0]) {
        ({ rows: bindings } = await client.query(`
        SELECT m.external_id AS member_id, b.wallet_address
        FROM passport_wallet_bindings b
        JOIN community_members m ON m.id=b.member_id
        WHERE b.passport_issuer=$1 AND b.passport_subject=$2 AND b.revoked_at IS NULL
        FOR UPDATE OF b
        `, [passportIssuer, passportSubject]));
      }
      if (!bindings[0]) {
        await client.query('COMMIT');
        return null;
      }

      const { rows: identities } = await client.query(`
        SELECT account_id
        FROM authenticated_account_identities
        WHERE provider='immutable-passport' AND issuer=$1 AND subject=$2
      `, [passportIssuer, passportSubject]);
      let accountId = identities[0]?.account_id;
      if (!accountId) {
        accountId = crypto.randomUUID();
        await client.query(
          'INSERT INTO authenticated_accounts (id) VALUES ($1)',
          [accountId]
        );
        await client.query(`
          INSERT INTO authenticated_account_identities (provider, issuer, subject, account_id)
          VALUES ('immutable-passport', $1, $2, $3)
        `, [passportIssuer, passportSubject, accountId]);
      }

      const { rows: propertyRows } = bindings[0].wallet_address
        ? await client.query(`
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', p.id,
          'address', p.address,
          'city', p.city,
          'state', p.state,
          'propertyType', p.property_type,
          'status', p.status,
          'accessRole', a.access_role,
          'verifiedAt', a.verified_at
        ) ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS properties
        FROM wallet_property_access a
        LEFT JOIN properties p ON p.id=a.property_id
        WHERE a.wallet_address=$1
        `, [bindings[0].wallet_address])
        : { rows: [{ properties: [] }] };

      await client.query('COMMIT');
      return {
        accountId,
        memberId: bindings[0].member_id,
        walletAddress: bindings[0].wallet_address || null,
        properties: propertyRows[0].properties
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { PostgresPassportIdentityStore };
