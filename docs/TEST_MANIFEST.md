# Test suite manifest

This file is the authoritative inventory and execution boundary for automated tests in this repository.

## Current suites

| Area | Test files | State | Dependencies and scope |
| --- | --- | --- | --- |
| Administrative input contract | `apps/api/test/admin/adminVerification.test.js` | READY | Pure validation and read-only checklist behavior; no database |
| Administrative route contract | `apps/api/test/admin/adminRouter.test.js` | READY | Express handler behavior with injected spies; no real authentication or database |
| Administrative transaction fallback | `apps/api/test/admin/transactionFallback.test.js` | READY | Contract/fallback behavior only; not a PostgreSQL transaction test |
| Idle-production arithmetic | `apps/api/test/gameplay/idleProduction.test.js` | READY | Pure deterministic calculator; no route, clock service, or database |
| Weekly payout arithmetic | `apps/api/test/gameplay/weeklyPayout.test.js` | READY | Pure deterministic allocator; no snapshot, job, ledger, or database |
| Community authentication and authorization | `apps/api/test/community/communityAuthorization.test.js` | READY | Route-level 401/403, ownership, membership, and no-mutation assertions |
| Immutable Passport authentication | `apps/api/test/community/immutablePassportAuth.test.js` | READY | Offline RSA/JWKS verification, audience/expiry checks, server-owned identity mapping, and authenticated property-route behavior |
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

## Authorization gate

The project owner authorized the narrowly scoped community PostgreSQL tests on
October 6, 2026. They require explicit disposable-database confirmation,
validate the URL database name against `TEST_DATABASE_EXPECTED_NAME`, and
isolate each run in a temporary schema. They never load the API `.env` or use
`DATABASE_URL`; absent all confirmations, the tests are skipped. The
authorization gate below remains in force for the unrelated payout, gameplay,
and administrative categories:

- do not create or run concurrency simulation runners;
- do not create or run database row-locking, deadlock, isolation, or rollback tests;
- do not point tests at developer, staging, or production databases;
- keep proposed PostgreSQL scenarios as non-executable documentation only;
- do not interpret **SKIPPED** as failed, pending execution, or permission to scaffold a harness.

After authorization, the environment must be disposable and isolated, apply production migrations, use least-privilege application roles where relevant, and have an explicit teardown boundary before any skipped category can move to READY.

## Missing service definitions found during inspection

These are structural findings, not authorization to implement them.

| Service boundary | Present artifact | Missing definition or integration |
| --- | --- | --- |
| Appeal resolution | `src/admin/adminRouter.js` and `src/admin/adminVerification.js` | Transaction-owning `reviewService.resolveAppeal`, reviewer authentication/authorization, error mapping, persistence schema/migrations, idempotency storage, append-only history enforcement, and composition-root mounting |
| Participant verification and primary-account switching | Design documents only | Provider adapter, credential validation, review workflow, switch orchestration, scheduler/worker, persistence model, audit service, and mounted API |
| Idle production | `src/gameplay/idleProduction.js` pure calculator | Authenticated collection service, authoritative clock, persistence/ledger, idempotency, transaction ownership, gameplay route, and feature-flagged mounting |
| Tower upgrades | Design documents only | Approved rule source, transaction-owning upgrade service or explicitly approved database function, models/schema, ledger, route, and feature-flagged mounting |
| Weekly rewards | `src/gameplay/weeklyPayout.js` pure calculator | Deterministic weight converter, immutable snapshot service, eligibility aggregation, payout persistence, idempotent scheduled job, audit trail, and API/operations surface |
| Community MVP | Authenticated router, Immutable Passport JWT adapter, server-owned wallet/property mapping, in-memory demo data, and PostgreSQL persistence adapter | Trusted identity-link provisioning, local session revocation, moderation service, and operational observability |

The existing administrative router is intentionally unmounted, and the gameplay calculators are intentionally unreachable from HTTP. The current API composition root mounts only the community routes and, when `DATABASE_URL` is present, the internal property/acquisition routes.

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
