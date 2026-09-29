# Orden del Margen

Orden del Margen is a community-first platform for members to connect, contribute, and learn about the places they share. Property operations remain an internal follow-up domain; the MVP exposes only safe, informational community context.

## MVP

- Member profiles and user-controlled presence/status
- Community memberships and moderated announcements
- Referral invitations with internal points
- Transparent non-monetary progression and badges
- Read-only property/community summaries and operational notes

The current implementation uses a Node.js/CommonJS + Express API, a static HTML/CSS/JavaScript frontend, and PostgreSQL-oriented migrations. Demo data is kept in memory so the dashboard can be evaluated without provisioning a database.

## MVP boundaries

The MVP does not execute securities or share purchases, custody funds, process payments, record legal ownership/title, or require NFTs/blockchain. Points and badges are internal participation signals with no cash value or ownership rights.

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
| `POST /api/community/referrals` | Create a referral invitation |
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

## Follow-up work

Authentication hardening, persistent database wiring, moderation tooling, maintenance workflows, payments, financial reporting, messaging, and mobile clients are future phases rather than MVP requirements.
