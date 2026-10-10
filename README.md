# Orden del Margen

Orden del Margen is a community-first platform for members to connect, contribute, and learn about the places they share. Property operations remain an internal follow-up domain; the MVP exposes only safe, informational community context.
## Long-term vision

See [Project Vision](docs/VISION.md) for the broader game and
business plans, the boundary between digital land and real property,
and decisions that remain open. The MVP below describes the current demo.

Related design documents:

- [Economy](docs/ECONOMY.md) — confirmed economic direction, proposed commercial models, and unresolved mechanics
- [Roadmap](docs/ROADMAP.md) — implemented MVP scope and future delivery phases
- [Decision register](docs/DECISIONS.md) — confirmed decisions, proposals, and open questions

## MVP

- Member profiles and user-controlled presence/status
- Member-owned profile topics: coffee, planet care, and protecting all creatures
- Community memberships and moderated announcements
- Referral invitations with internal points
- Community quests that award points when members help resolve them
- Knowledge-based PvP challenges and a community leaderboard
- Non-monetary coffee appreciation gifts
- Read-only property/community summaries and operational notes

The implemented MVP uses a Node.js/CommonJS + Express API, a Vite-served
HTML/CSS/JavaScript frontend, and optional PostgreSQL persistence. The
credential-free local demo uses in-memory data and does not require PostgreSQL.
The gameplay and Web3 documents are proposals unless they are identified as
implemented runtime behavior.

The API includes an Immutable Passport ID-token verifier and database-backed
identity lookup. A production identity-linking workflow and a validated
deployment configuration are not included. See
[Immutable Passport integration](docs/IMMUTABLE_PASSPORT_INTEGRATION.md).

## MVP boundaries

The MVP does not execute securities or share purchases, custody funds, process payments, or record legal ownership/title, and does not require NFTs/blockchain. Points, badges, knowledge scores, and coffee gifts are internal participation/appreciation signals with no cash value or ownership rights.

## Getting started

### Start the API

```bash
cd apps/api
npm ci
cp .env.example .env
npm run dev
```

The API is available at http://localhost:3000. Its authenticated dashboard API endpoint is:

```text
http://localhost:3000/api/community/dashboard
```

### Startup modes

The checked-in `apps/api/.env.example` selects memory storage and the local
demo authenticator. Copy it to `.env` to start without PostgreSQL, database
credentials, or authentication credentials. Demo authentication uses fixed,
public sample tokens and is rejected in production. Memory storage resets on
restart.

Community data stays in memory. Changes last only until the API
restarts, when the original demo data is restored.

Internal routes under `/api/properties`, `/api/opportunities`,
and `/api/acquisitions` are unavailable in demo mode and return 404.
Informational summaries under `/api/community/properties` remain available.

When `DATABASE_URL` is configured, the API connects to PostgreSQL, loads
community state from PostgreSQL, and enables
the internal property routes. Profiles, memberships, referrals, gifts, reward
history, quests, and knowledge awards persist across restarts. An invalid
database connection causes startup to fail.

Application startup never runs migrations or inserts demo records. Database
operations are separate, explicit commands as documented below.

### PostgreSQL TLS

Remote and production PostgreSQL connections use certificate verification.
Unsafe `DATABASE_URL` parameters such as `sslmode=disable`, `allow`, `prefer`,
or `no-verify` are rejected and URL SSL parameters cannot override the explicit
TLS configuration. Publicly trusted provider certificates need no custom CA.
For a provider-private CA, configure either `PGSSL_CA_PATH` or
`PGSSL_CA_BASE64`, never both. `PGSSL_SERVERNAME` is available when the provider
requires a certificate name different from the connection hostname.

`PGSSL_MODE=disable` is accepted only for loopback, non-production databases,
such as the disposable integration cluster. Do not use it to work around a
certificate error. Obtain the provider's documented CA and expected server
name instead.

### Explicit database operations

Before migration or demo initialization, set an explicit purpose and repeat the
exact database name as a safety confirmation:

```text
DATABASE_PURPOSE=development
DATABASE_EXPECTED_NAME=orden_del_margen_development
```

Then migrate separately:

```bash
npm run migrate
```

Verify the applied filenames in `schema_migrations`, then optionally initialize
the community demo records in a development or test database:

```bash
npm run seed:community-demo
```

Both commands query `current_database()` and refuse a mismatch. Demo
initialization is refused for `DATABASE_PURPOSE=production`. Starting with
`npm start` performs neither operation.

### Authentication

For an optional PostgreSQL-backed Passport setup, comment out
`COMMUNITY_STORAGE=memory`, configure a dedicated `DATABASE_URL`, apply
migrations, and set `COMMUNITY_AUTH_MODE=immutable-passport`. The API verifies
fresh Immutable Passport ID tokens using RS256, HTTPS JWKS, issuer, client-ID
audience, and expiry checks. It then maps the verified `sub` to a wallet and
property access in PostgreSQL; caller-supplied member IDs or wallet addresses
never establish identity. Migration 005 creates these mapping tables but does
not seed associations. A reviewed administrative linking workflow is required
and is not implemented here.

For a credential-free local demo, keep `COMMUNITY_AUTH_MODE=configured` and
`COMMUNITY_DEMO_AUTH=true`. The web demo mode sends the public
`demo-member-1-token`; the API maps it to the sample member. This mode is only
for local evaluation and is refused in production.

For a separate local development bridge, set `COMMUNITY_DEMO_AUTH=false` and
configure server-owned token-to-member mappings as JSON:

```text
COMMUNITY_SESSION_TOKENS={"replace-with-a-long-random-token":"member-1"}
```

Do not commit real tokens. The web `.env.example` sets
`VITE_COMMUNITY_DEMO_MODE=true`, so the demo does not load Passport or require
client credentials. For Passport sign-in, set that flag to `false` and provide
the three `VITE_IMMUTABLE_*` values listed below. The static frontend uses the
SDK, but linking verified Passport subjects to community members must be
provisioned separately; no linking UI or workflow is implemented.

The configured adapter is refused in production. Passport tokens expire, but
immediate API-side session revocation remains follow-up work.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; enables durable community and internal property workflows |
| `PG_POOL_MAX` | Optional connection-pool size; defaults to `10` |
| `PGSSL_MODE` | `verify-full`; `disable` is limited to local non-production testing |
| `PGSSL_CA_PATH` / `PGSSL_CA_BASE64` | Optional provider CA, supplied by path or base64 but not both |
| `PGSSL_SERVERNAME` | Optional provider-documented TLS certificate server name |
| `DATABASE_PURPOSE` | Explicit `development`, `test`, or `production` for database operations |
| `DATABASE_EXPECTED_NAME` | Exact database-name confirmation for migration and seed commands |
| `COMMUNITY_AUTH_MODE` | `configured` for development/demo; `immutable-passport` for the API Passport verifier |
| `IMMUTABLE_PASSPORT_CLIENT_ID` | Passport application client ID and required JWT audience |
| `IMMUTABLE_PASSPORT_ISSUER` | Exact provider-documented ID-token issuer |
| `IMMUTABLE_PASSPORT_JWKS_URI` | Optional HTTPS JWKS override; defaults to Immutable's authentication JWKS |
| `COMMUNITY_SESSION_TOKENS` | Development-only configured token-to-member JSON mapping |
| `COMMUNITY_DEMO_AUTH` | Explicit local demo authentication; forbidden in production |
| `COMMUNITY_STORAGE` | Set to `memory` for an explicit reset-on-restart local store; forbidden in production |
| `VITE_COMMUNITY_DEMO_MODE` | `true` uses the API's public local demo token without loading Passport |
| `VITE_IMMUTABLE_PASSPORT_CLIENT_ID` | Public Passport client ID required when web demo mode is `false` |
| `VITE_IMMUTABLE_REDIRECT_URI` | Registered Passport redirect URI required when web demo mode is `false` |
| `VITE_IMMUTABLE_LOGOUT_URI` | Registered Passport logout URI required when web demo mode is `false` |
| `VITE_API_BASE_URL` | API origin used by the frontend; defaults to `http://localhost:3000` |
| `ALLOWED_FRONTEND_ORIGINS` | Comma-separated browser origins; defaults to `http://localhost:8000` |
| `TRUST_PROXY_CIDRS` | Explicit comma-separated trusted proxy addresses/subnets; broad trust is rejected |
| `AUTH_ATTEMPT_RATE_LIMIT` / `AUTH_ATTEMPT_RATE_WINDOW_MS` | Per-client-IP limit applied before token verification |
| `AUTHENTICATED_RATE_LIMIT` / `AUTHENTICATED_RATE_WINDOW_MS` | Per-member authenticated-route limit and window |
| `REWARD_RATE_LIMIT` / `REWARD_RATE_WINDOW_MS` | Per-member, per-reward-family limit and window |
| `PORT` | API port; defaults to `3000` |

### Open the frontend

In another terminal:

```bash
cd apps/web
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:8000. The page loads the in-memory demo member dashboard
from the API. Demo updates last only until the API restarts.

## API surface

| Route | Purpose |
| --- | --- |
| `GET /api/community/dashboard` | Authenticated member's own dashboard |
| `GET /api/community/me/properties` | Wallet/property access resolved from the verified Passport subject |
| `GET /api/community/members/:id` | Public member profile |
| `PATCH /api/community/members/:id/status` | Update a member's status |
| `PATCH /api/community/members/:id/profile` | Update the member-owned profile |
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

## Follow-up work

Account recovery, trusted identity-link provisioning, local session revocation, moderation tooling,
maintenance workflows, payments, financial reporting, messaging, and mobile
clients remain future work.

## Test execution boundary

Run dependency-local unit and route tests with `npm test` from `apps/api`.
PostgreSQL restart and concurrency tests are skipped unless an explicitly
configured, dedicated disposable database is provided. The suite creates and
drops isolated schemas in that database; never point it at production or a
database containing real data:

```bash
TEST_DATABASE_URL=postgres://.../orden_del_margen_test npm run test:integration
```

Also set `TEST_DATABASE_PURPOSE=disposable` and
`TEST_DATABASE_EXPECTED_NAME=orden_del_margen_test` in the environment. The
suite uses only `TEST_DATABASE_URL` (never `DATABASE_URL` or the API `.env`),
checks the expected database name, and creates/removes isolated schemas only
inside that dedicated test database. It skips unless all three confirmations
are present. See the
[test suite manifest](docs/TEST_MANIFEST.md) for the broader project test
inventory.

In PostgreSQL mode, rate-limit counters are shared through
`api_rate_limits`, so multiple API instances enforce the same per-member
limits. In explicit memory mode the limiter is process-local and is suitable
only for the local demo.
