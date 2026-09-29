# Architecture overview

## System overview

`Orden del Margen` is a community-first web MVP. It supports member identity and presence, referrals, non-monetary progression, moderated updates, and informational property context.

## Domains

### Community

- members and profiles
- user-controlled presence/status
- communities and memberships
- announcements
- referrals and progression events

### Property context

- safe property summaries
- area and community association
- operational notes

The MVP must not expose securities, share purchases, funds custody, payments, legal title/ownership records, or NFT/blockchain dependencies.

### Administration

- moderation and access control
- operational reporting (follow-up)

## Stack

- Frontend: static HTML/CSS/JavaScript for MVP validation
- API: Node.js + Express
- Persistence target: PostgreSQL
- Authentication target: JWT + roles
- Deployment: Docker + cloud hosting later

The current demo uses in-memory data in `apps/api/src/data/communityData.js`. This makes the interaction loop easy to run locally while the migration establishes the intended persistence model.

## MVP tables

```text
community_members
communities
community_memberships
referrals
progression_events
community_announcements
```

The migration is `apps/api/migrations/002_create_community_mvp_tables.js`. Existing acquisition tables remain a separate internal domain and are not expanded by the community MVP.

## API boundary

`/api/community` owns the MVP community surface:

- dashboard aggregation
- public member profiles and status updates
- referral creation
- community announcements
- safe property summaries

Write operations must validate input and return explicit `4xx` responses. Moderator/admin authorization and persistent identity are follow-up hardening tasks before production use.
