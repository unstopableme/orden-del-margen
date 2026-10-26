# Test suite manifest

This file is the authoritative inventory and execution boundary for automated tests in this repository.

## Current suites

| Area | Test files | State | Dependencies and scope |
| --- | --- | --- | --- |
| Administrative input contract | `apps/api/test/admin/adminVerification.test.js` | READY | Pure validation and read-only checklist behavior; no database |
| Administrative route contract | `apps/api/test/admin/adminRouter.test.js` | READY | Express handler behavior with injected spies; no real authentication or database |
| Administrative transaction fallback | `apps/api/test/admin/transactionFallback.test.js` | READY | Contract/fallback behavior only; not a PostgreSQL transaction test |
| Idle-production arithmetic | `apps/api/test/gameplay/idleProduction.test.js` | READY | Pure deterministic calculator; no route, clock service, or database |
| Idle collection planning | `apps/api/test/gameplay/idleCollection.test.js` | READY | Pure batch settlement, ownership consistency, asset aggregation, ledger reconciliation, carry restoration, and input preservation; no authentication, database, transaction, or route |
| Idle collection rules and persistence | `apps/api/test/gameplay/ruleFingerprint.test.js`, `apps/api/test/gameplay/idleProduction.test.js`, `apps/api/test/integration/gameplayCollectionPostgres.test.js` (`npm --prefix apps/api run test:gameplay:integration`) | READY WHEN CONFIGURED; MANUAL PASS REPORTED | Deterministic rules/request fingerprints and migration seed are unit-tested; calculator accepts persisted ruleset rates/caps; guarded PostgreSQL suite covers custom rules, account isolation, different-key concurrent collection without double credit, append-only settlements/ledger, idempotent replay, fingerprint rejection/tampering, and transaction rollback in an isolated schema. The owner reports one top-level integration test passed against `orden_margen_gameplay_test`; see the manual execution record below. |
| Weekly payout arithmetic | `apps/api/test/gameplay/weeklyPayout.test.js` | READY | Pure deterministic allocator; no snapshot, job, ledger, or database |
| Community authentication and authorization | `apps/api/test/community/communityAuthorization.test.js` | READY | Route-level 401/403, ownership, membership, and no-mutation assertions |
| Immutable Passport authentication | `apps/api/test/community/immutablePassportAuth.test.js` | READY | Offline RSA/JWKS verification, audience/expiry checks, server-owned account/member identity mapping, authenticated property-route behavior, and distinct `503 AUTH_PROVIDER_UNAVAILABLE` handling for JWKS-provider failures versus `401 UNAUTHORIZED` for invalid tokens |
| Persistent authenticated account mapping | `apps/api/test/auth/passportIdentityStore.test.js`, `apps/api/test/integration/communityPostgres.test.js` | READY WHEN CONFIGURED | Transaction behavior and migration shape have mock-backed unit coverage; the gated PostgreSQL test verifies stable account creation, issuer scoping, and revoked-binding denial in an isolated schema |
| Gameplay route isolation | `apps/api/test/gameplay/gameplayRoutesDisabled.test.js` | READY | Community demo dashboard remains available with in-memory storage and gameplay endpoints remain unmounted |
| Authenticated gameplay query/collection routes | `apps/api/src/routes/gameplay.js`, `apps/api/test/gameplay/gameplayRoutes.test.js`, `apps/api/test/gameplay/gameplayRoutesDisabled.test.js` | IMPLEMENTED; ROUTE CONTRACT TESTS | Account-scoped query, explicit initial-building provisioning, and collection use Immutable Passport caller context; gameplay has separate IP-before-authentication and shared per-account limits, with 429/no-service-call and invalid-body/fingerprint/idempotency coverage. Mounting requires PostgreSQL and `GAMEPLAY_API_ENABLED=true`, which defaults to false. Tests use injected authentication and do not validate enabled server startup against live PostgreSQL/JWKS. |
| Community duplicate rewards | `apps/api/test/community/communityRewards.test.js` | READY | In-memory retry and concurrent-request coverage with exact point totals |
| Community CORS | `apps/api/test/cors.test.js` | READY | Allowed/rejected origins, preflight, and authentication independence |
| Database TLS and operation safety | `apps/api/test/databaseConfig.test.js`, `apps/api/test/configurationSecurity.test.js` | READY | Certificate verification, unsafe URL rejection, explicit target confirmation, production demo guards, and trusted-proxy validation |
| Community rate limiting | `apps/api/test/community/communityRateLimit.test.js` | READY | Per-member 429 behavior, reward mutation protection, and forged forwarding-header resistance |
| Community PostgreSQL persistence | `apps/api/test/integration/communityPostgres.test.js` | READY WHEN CONFIGURED | API restart, concurrent HTTP claims, retries, and rollback atomicity; requires an explicitly disposable database, `TEST_DATABASE_URL`, `TEST_DATABASE_PURPOSE=disposable`, and an exact `TEST_DATABASE_EXPECTED_NAME` containing `test`; isolated schemas are created and removed |
| PostgreSQL concurrency and locking | Not created | **SKIPPED** | Requires explicit authorization and a dedicated disposable PostgreSQL integration-test environment |
| Automated state-transition simulations | Not created | **SKIPPED** | Creation and execution are deferred pending the same explicit authorization |
| Payout uniqueness and replay integration | Not created | **SKIPPED** | Adopted design is documented in `IDEMPOTENCY_AND_UNIQUENESS.md`; database validation requires the authorized PostgreSQL environment |
| Payout API idempotency responses | Not created | **SKIPPED** | Proposed HTTP contract is documented in `API_IDEMPOTENCY_ERROR_HANDLING.md`; no gateway, route, cache, or integration harness is authorized |
| Tower Level 3 snapshot eligibility | Not created | **SKIPPED** | Adopted checker is documented in `TOWER_LEVEL_3_ELIGIBILITY_CHECKER.md`; no schema, checker, boundary job, or PostgreSQL harness is authorized |
| Administrative appeal persistence | Not created | **SKIPPED** | Adopted workflow is documented in `ADMIN_APPEAL_VALIDATION_WORKFLOW.md`; the existing router tests use injected fakes and do not validate PostgreSQL transactions or grants |
| Materials manifest conformance | Not created | NOT AUTHORIZED | Offline attributes are proposed in `MATERIALS_MANIFEST_SCHEMA.md`; no JSON Schema, validator, catalog, loader, simulation, or test exists |
| Gameplay supplement verification | Not created | **SKIPPED** | Candidate combat, loot, crafting, and overlay parameters are consolidated in `04_gameplay_proposals_supplement.md`; no runtime or simulation is authorized |
| Faction onboarding validation | Not created | NOT AUTHORIZED | Offline lore, strings, and UI candidates are documented in `11_faction_selection_sheets.md`; no manifest, preview, service, persistence, or test exists |
| Crafting-history UI validation | Not created | NOT AUTHORIZED | Offline layouts and strings are documented in `13_weapon_upgrade_crafting_logs.md`; no ledger, recipe engine, preview, persistence, or test exists |
| Quest-log UI validation | Not created | NOT AUTHORIZED | File 14 has an offline documentation-review baseline only; no quest manifest, engine, persistence, preview, database verification, or test exists |
| Skill-tree UI validation | Not created | NOT AUTHORIZED | Offline branches, node candidates, layouts, and strings are documented in `15_character_skill_tree_descriptions.md`; no skill manifest, service, persistence, preview, or test exists |
| Combat loot-table validation | Not created | NOT AUTHORIZED | Offline weights and layout candidates are documented in `16_combat_loot_table_weights.md`; no loot manifest, RNG engine, fee transaction, persistence, simulation, or test exists |
| Master roadmap validation | Not created | DOCUMENTATION ONLY | `09_master_roadmap.md` indexes actual and reserved documents; it is not an executable project-management check |
| Primary onboarding UI validation | Not created | NOT AUTHORIZED | Offline account/designation layouts are documented in `10_primary_account_onboarding_ui.md`; no authentication, association, designation, credit, preview, or test exists |
| Account-summary UI validation | Not created | NOT AUTHORIZED | Privacy-safe offline layouts are documented in `12_user_settings_account_summary.md`; no identity, balance, wallet, custody, session, preview, or test exists |

`npm test` discovers the existing `*.test.js` files through Node's test runner. The skipped categories have no executable files and are not silently included in that command.

### Local targeted execution (October 11, 2026)

Ran the gameplay route-contract, disabled-route, Immutable Passport, and CORS
tests with `npm --prefix apps/api test -- test/gameplay/gameplayRoutes.test.js
test/gameplay/gameplayRoutesDisabled.test.js
test/community/immutablePassportAuth.test.js test/cors.test.js`: **18 passed,
0 failed, 0 skipped**. These HTTP/authentication tests use local fakes/offline
keys and do not connect to PostgreSQL or validate a live Passport/JWKS service.

## Authorization gate

The project owner authorized the narrowly scoped community PostgreSQL tests on
October 6, 2026. They require explicit disposable-database confirmation,
validate the URL database name against `TEST_DATABASE_EXPECTED_NAME`, and
isolate each run in a temporary schema. On October 11, 2026, the owner
separately authorized the idle-collection gameplay PostgreSQL suite, restricted
to a newly created, dedicated disposable gameplay test database. It requires
`GAMEPLAY_TEST_DATABASE_URL`, `GAMEPLAY_TEST_DATABASE_PURPOSE=disposable`, and
an exact `GAMEPLAY_TEST_DATABASE_EXPECTED_NAME` containing both `gameplay` and
`test`; it additionally refuses a target whose `public` schema already has
tables. Run it with `npm --prefix apps/api run test:gameplay:integration`.
Supply the URL only in the local test process; do not persist it in Windows
user or machine environment variables. Both suites use temporary schemas, do
not load the API `.env`, and do not use `DATABASE_URL`; missing confirmations
skip the suite. Neither
authorization permits tests against an application database. Authorization
for the idle-collection suite is limited to that dedicated, guarded harness;
it does not authorize unrelated payout, Tower, broad gameplay, or
administrative persistence/concurrency categories:

- do not create or run broad concurrency simulations or tests for unrelated gameplay systems;
- do not create or run deadlock/isolation tests or unrelated database locking/rollback tests;
- do not point tests at developer, staging, or production databases;
- keep unrelated proposed PostgreSQL scenarios as non-executable documentation only;
- do not interpret **SKIPPED** as failed, pending execution, or permission to scaffold a harness.

After authorization, the environment must be disposable and isolated, apply production migrations, use least-privilege application roles where relevant, and have an explicit teardown boundary before any skipped category can move to READY.

### User-reported manual execution (October 11, 2026)

The project owner reports running `npm --prefix apps/api run test:integration`
against the dedicated disposable database
`orden_margen_passport_test_20261011_7fd1`: **5 passed, 0 failed, 0 skipped**.
The output was not independently captured or verified in this session. The
guarded harness applies migrations only in its isolated temporary schemas and
removes those schemas during teardown; it does not drop the test database.
This report validates only the existing community PostgreSQL integration suite,
not the separately skipped concurrency, payout, gameplay, or administrative
categories.

### User-reported manual gameplay execution (October 11, 2026)

The project owner reports running
`npm --prefix apps/api run test:gameplay:integration` against the newly created,
dedicated disposable database `orden_margen_gameplay_test`: **1 passed, 0
failed, 0 skipped**. The owner subsequently reports a successful manual rerun
after correcting the account-state balance expectation; the output was not
captured or independently verified in this session. The one top-level
PostgreSQL test covers the approved prototype rules, custom persisted
rates/caps, the complete five-material balance response, account isolation,
different-key concurrent collection without double credit, idempotent replay,
fingerprint rejection/tampering, append-only settlement and ledger
enforcement, and transaction rollback. The result does not validate
authenticated gameplay HTTP routes, rate limiting, or feature-flag behavior.
The guarded harness uses an isolated temporary schema and leaves the dedicated
test database in place.

## Missing service definitions found during initial inspection

These are structural findings, not authorization to implement them.

| Service boundary | Present artifact | Missing definition or integration |
| --- | --- | --- |
| Appeal resolution | `src/admin/adminRouter.js` and `src/admin/adminVerification.js` | Transaction-owning `reviewService.resolveAppeal`, reviewer authentication/authorization, error mapping, persistence schema/migrations, idempotency storage, append-only history enforcement, and composition-root mounting |
| Participant verification and primary-account switching | Design documents only | Provider adapter, credential validation, review workflow, switch orchestration, scheduler/worker, persistence model, audit service, and mounted API |
| Idle production | `apps/api/src/gameplay/idleProduction.js`, `apps/api/src/gameplay/postgresIdleCollection.js`; PostgreSQL schema and transaction-owned collection are implemented for the approved prototype rules and the owner reports a passing run of the guarded PostgreSQL suite | Authenticated account query/collection routes, route-level authentication integration, explicit feature-flagged mounting, and route-level tests remain deferred; gameplay routes stay unmounted |
| Tower upgrades | Design documents only | Approved rule source, transaction-owning upgrade service or explicitly approved database function, models/schema, ledger, route, and feature-flagged mounting |
| Weekly rewards | `src/gameplay/weeklyPayout.js` pure calculator | Deterministic weight converter, immutable snapshot service, eligibility aggregation, payout persistence, idempotent scheduled job, audit trail, and API/operations surface |
| Community MVP | Authenticated router, Immutable Passport JWT adapter, canonical authenticated accounts and issuer/subject mapping, server-owned wallet/property mapping, in-memory demo data, and PostgreSQL persistence adapter | Trusted identity-link provisioning, local session revocation, moderation service, and operational observability |

**Current gameplay status:** the authenticated idle query, explicit
provisioning, and collection routes have since been implemented locally behind
the disabled-by-default feature flag. The table's route deferral entry above is
historical; the live database/query assertions and enabled server startup still
need validation.

The administrative router remains intentionally unmounted. Gameplay routes
mount only when `GAMEPLAY_API_ENABLED=true`, PostgreSQL is configured, and
Immutable Passport authentication is available; the flag defaults to false.
The composition root also mounts the community routes and, when `DATABASE_URL`
is present, the internal property/acquisition routes.

## Static document asset review

These markers report file presence/manual documentation review only. They are
not executable tests and do not change any suite state above.

- [x] `docs/09_master_roadmap.md` — static index; actual/missing files distinguished
- [x] `docs/10_primary_account_onboarding_ui.md` — static interface proposal
- [x] `docs/12_user_settings_account_summary.md` — privacy-safe static interface proposal
- [x] `docs/13_weapon_upgrade_crafting_logs.md` — reviewed static craft log interface proposal
- [x] `docs/14_game_quest_log_descriptions.md` — reviewed static lore baseline
- [x] `docs/15_character_skill_tree_descriptions.md` — reviewed refined layout baseline
- [x] `docs/16_combat_loot_table_weights.md` — reviewed static document asset
- [ ] `docs/17_user_settings_config.md` — reserved; file is not present
- [x] `docs/18_character_achievement_sheets.md` — reviewed static character achievement layouts


### File 16 documentation disposition (October 4, 2026)

- `$DONCELLA` denomination: passed for candidate fee vocabulary.
- Reward-system isolation: passed as an offline documentation boundary.
- Authority/database verification: **NOT RUN / NOT AUTHORIZED**.


### File 13 documentation disposition (October 4, 2026)

- `$DONCELLA` enhancement fee validation: PASSED. Fictional item upgrade costs adhere strictly to the candidate gameplay activation currency rules.
- Crafting logic isolation: PASSED. Weapon modifications apply strictly as textual mockup parameters with zero backend recipe engines or file writes.
- Execution and database status: NOT RUN / NOT AUTHORIZED. System changes remain non-executable configuration text layout proposals only.

### File 18 documentation disposition (October 4, 2026)

- `$DONCELLA` milestone gift tracking: PASSED. Fictional gift distributions use the strict global currency standard for layout presentation only.
- Validation loop isolation: PASSED. Milestone unlock checks operate strictly as static visual text layout mockups.
- Execution and state mutation: NOT RUN / NOT AUTHORIZED. No automated calculation engines, data updates, ledger state modifications, or background validation scripts are created or run.

### Verified local browser and development PostgreSQL execution (October 12, 2026)

This session independently validated the feature-flagged gameplay flow against
the dedicated local development database `orden_margen_gameplay_dev`, using an
authenticated Opera session at `http://localhost:8000` with the linked
**Passport Developer** identity. This was an application-development
verification, not the disposable integration-test harness and not a production
deployment.

- Initial authenticated account-state query: **passed**.
- Explicit provisioning: **passed**, with exactly five Level 1 building types.
- Browser collection and refresh: **passed**. After real elapsed production
  time the persisted balances were `wheat=1` and `wood=1`; the ledger contained
  two credit entries totaling two units.
- Idempotent replay: **passed**. Reusing the first persisted account/key pair
  returned the original result, retained one request row, and did not change
  balances.
- Process isolation: **passed**, with one listener each on local ports 8000 and
  3001.
- Browser client tests: `node --test apps/web/test/gameplay.test.js` reported
  **13 passed, 0 failed, 0 skipped**.
- Immutable Passport authentication tests, including the JWKS outage/invalid
  token distinction: `node --test
  apps/api/test/community/immutablePassportAuth.test.js` reported **10 passed,
  0 failed, 0 skipped**.

No `.env` value, Passport token, idempotency key, account identifier, or
database credential is recorded in this manifest. No production configuration
was changed and nothing was published.

### Clean-checkout disposable PostgreSQL execution (October 12, 2026)

Commit `e019cc7` was checked out in an isolated temporary clone and executed
manually against the two authorized local disposable databases with the suite
guards enabled. Results were **5 community integrations passed** and **1
gameplay integration passed**, with **0 failed and 0 skipped** across the two
commands. The community harness used its `community_*` temporary schemas and
advisory lock; the gameplay harness additionally verified an empty `public`
schema before and after running migrations in its `gameplay_idle_*` temporary
schema. No production system was targeted and nothing was published.

### Prototype upgrade PostgreSQL execution (October 12, 2026)

The guarded gameplay integration suite was rerun manually against the
authorized disposable gameplay database after correcting the concurrent
N1-to-N2 upgrade lock order. The single integration test completed with
**1 passed, 0 failed, and 0 skipped**. This run retained the concurrent
different-key assertion that exactly one upgrade succeeds and the other
returns `BUILDING_UPGRADE_CONFLICT`; it did not accept PostgreSQL `40P01` as
an expected result. The same run covered transactional rollback, same-key
replay, single debit/ledger persistence, Level 1 settlement before upgrade,
and preservation of carry. No production system was targeted and nothing was
published.
