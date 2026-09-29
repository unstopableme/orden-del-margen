# Orden del Margen

Orden del Margen is a community-first platform for members to connect, contribute, and learn about the places they share. Property operations remain an internal follow-up domain; the MVP exposes only safe, informational community context.

## MVP

- Member profiles and user-controlled presence/status
- 18+ membership requirement with age verification boundary
- Free Traveler plan plus paid plan previews for future educational tiers
- Member-owned profile topics: coffee, planet care, and protecting all creatures
- Community memberships and moderated announcements
- Referral invitations with internal points
- Community quests that award points when members help resolve them
- Knowledge-based PvP challenges and a community leaderboard
- Non-monetary coffee appreciation gifts
- Read-only property/community summaries and operational notes

The current implementation uses a Node.js/CommonJS + Express API, a static HTML/CSS/JavaScript frontend, and PostgreSQL-oriented migrations. Demo data is kept in memory so the dashboard can be evaluated without provisioning a database.

## MVP boundaries

The MVP does not execute securities or share purchases, custody funds, process payments, or record legal ownership/title, and does not require NFTs/blockchain. Points, badges, knowledge scores, and coffee gifts are internal participation/appreciation signals with no cash value or ownership rights.

## Getting started

### Start the API

```bash
cd apps/api
npm install
npm run dev
```

The API is available at http://localhost:3000. The community dashboard is available at:

```text
http://localhost:3000/api/community/dashboard
```

### Open the frontend

In another terminal:

```bash
cd apps/web
python -m http.server 8000
```

Open http://localhost:8000. The page loads the demo member dashboard from the API.

## API surface

| Route | Purpose |
| --- | --- |
| `GET /api/community/dashboard?memberId=member-1` | Dashboard aggregate for a member |
| `GET /api/community/members/:id` | Public member profile |
| `PATCH /api/community/members/:id/status` | Update a member's status |
| `PATCH /api/community/members/:id/profile` | Update the member-owned profile |
| `POST /api/community/membership/verify-age` | Verify the 18+ membership requirement |
| `GET /api/community/membership/plans` | List free and paid-plan previews |
| `POST /api/community/membership/plans/:planId/interest` | Record interest in a future paid plan without charging |
| `POST /api/community/referrals` | Create a referral invitation |
| `GET /api/community/quests` | List community help quests |
| `POST /api/community/quests/:id/resolve` | Resolve a quest and award points |
| `POST /api/community/coffee-gifts` | Send a non-monetary coffee appreciation gift |
| `GET /api/community/games/knowledge/challenges` | List knowledge-based PvP challenges |
| `POST /api/community/games/knowledge/answers` | Submit an answer and update PvP score |
| `GET /api/community/communities/:id/announcements` | Community announcement feed |
| `GET /api/community/properties` | Safe property summaries |

## Repository structure

```text
.
├── apps/
│   ├── api/
│   │   ├── migrations/
│   │   └── src/
│   └── web/
├── docs/
├── README.md
└── LICENSE
```

The PostgreSQL community schema is in `apps/api/migrations/002_create_community_mvp_tables.js`. It intentionally excludes securities, custody, payment, and legal title records.

The narrative token concept is documented separately in
`docs/whitepaper-cafe-de-la-doncella.md`. It is not an implemented sale or
financial product.

Paid membership plans are currently catalog previews and interest lists only.
There is no checkout, payment processing, stored value, NFT, or token utility
attached to a plan.

## Follow-up work

Authentication hardening, persistent database wiring, moderation tooling, maintenance workflows, payments, financial reporting, messaging, and mobile clients are future phases rather than MVP requirements.
