# Community database audit — 2026-10-06

This report contains no connection URL, hostname, username, password, token, or
certificate material. The audit queries were read-only.

## Destination classification

- Configured and actual database name: `orden_del_magen`.
- Network classification: public/provider network, not loopback or private LAN.
- PostgreSQL reported a writable primary, not a replica.
- The database has no database comment identifying its purpose.
- On October 6, 2026, the project owner explicitly confirmed this database is
  development. This confirmation authorizes necessary migrations, but not demo
  reinitialization, destructive cleanup, or integration/concurrency tests.

## Observed migration

`003_harden_community_persistence.js` was recorded in `schema_migrations` at
`2026-10-06T23:20:58.933Z`. Its external-ID columns, reward-source index, and
`knowledge_reward_claims` table are present.

After the development-purpose confirmation, `004_create_api_rate_limits.js`
was applied at `2026-10-06T23:48:30.077Z`. The `api_rate_limits` table is
present. No seed was run, and the community record inventory below remained
unchanged after migration and verified-TLS startup validation.

`005_create_passport_identity_mapping.js` was applied at
`2026-10-07T00:02:24.852Z`. It created `passport_wallet_bindings` and
`wallet_property_access`. Both contained zero rows immediately after the
migration: no Passport subject, wallet, member, or property association was
invented or seeded. The pre/post read-only inventory showed the same community
records and runtime values.

## Observed initialization records

- Members: `member-1`, `member-2`.
- Communities: `casa-azul`, `viviendas-del-sol`.
- Memberships: member 1 in Casa Azul; member 2 in Casa Azul and Viviendas del Sol.
- Quests: `quest-1`, `quest-2`.
- Knowledge challenges: `knowledge-1`, `knowledge-2`.
- Referrals: `referral-1`, `referral-2`.
- Coffee gifts: `coffee-gift-1`.
- Progression events: `event-1`, `event-2`.
- Announcements with demo external IDs: none.

At audit time both quests remained open, no knowledge reward claim existed,
and no generated referral, gift, or reward event was present. Member points,
knowledge scores, and statuses matched the source demo values.

No rollback or deletion was performed.
