# Minimal Account and Persistent Content-Access Scope

**Status:** Future implementation-scope proposal; not adopted and not authorized
**Purpose:** Define the smallest backend boundary needed for an authenticated
account library with durable content-access records.

## 1. Review conclusion

The account-library design is internally consistent with the confirmed content
rules: Chapters 1–3 are free, KTL 1–9 maps to Chapters 4–12, purchases grant
content access only, book and RPG availability are displayed separately, and
access never changes Tower progression or reward eligibility.

The repository does not currently implement persistent authentication,
account recovery, content entitlements, file hosting, download endpoints, or
browser-game launch authorization. The scope below is a smallest future
boundary, not an authorization to build those systems.

## 2. Smallest proposed implementation boundary

### 2.1 Account identity and sessions

Implement only the records and services needed to identify an account and
authorize its library:

- opaque `account_id`;
- normalized login identifier with a uniqueness rule;
- credential verifier reference or external-auth subject reference, never raw
  passwords or provider secrets;
- account status (`active`, `suspended`, `closed`);
- session records with expiry, revocation, and audit timestamps; and
- server-derived account context for every library request.

Email verification, password reset, passkeys, lost-email recovery, account
merging, wallet links, and participant association are outside this minimum
scope. A client-supplied account ID, email, wallet, or hidden field must never
select the library subject.

### 2.2 Content catalog

Persist a versioned catalog independent of payment and game state:

- `content_id` and stable chapter number;
- content kind (`book_epub`, `book_pdf`, or `rpg_chapter`);
- title, language, version, and publication state;
- relationship between a book chapter and its corresponding RPG chapter; and
- safe presentation metadata, without storage-provider paths or secrets.

Free Chapters 1–3 can be represented as catalog availability. File hosting,
download URLs, DRM, and browser-game hosting are separate services and are not
part of this minimum persistence scope.

### 2.3 Durable access records

Use one durable, auditable access-grant record keyed by account and content or
bundle. The minimum fields are:

- immutable `access_grant_id`;
- `account_id` and `content_id`/bundle identifier;
- source (`free`, `purchase`, or `gameplay`), recorded distinctly;
- state (`active`, `held`, `revoked`) with reason and policy version;
- created, updated, effective, and optional expiry timestamps;
- idempotency/submission identity for grant creation; and
- audit actor/reference, without payment credentials or wallet secrets.

The uniqueness rule must prevent two active grants for the same account and
content. Retried creation returns the existing grant; conflicting reuse is
rejected. A failed download does not revoke a grant or require another grant.

Payment settlement and gameplay state must not be inferred from this table. A
future payment service or game-domain adapter may submit a separately reviewed
grant request, but no payment or gameplay integration is implied by the source
values. Payment capture, BTCPay, refunds, excess funds, payment exceptions, and
KTL evaluation remain separate work.

### 2.4 Read-only library authorization

The minimum API/read model would:

1. authenticate the session and derive `account_id`; never accept a
   client-supplied account ID to select the library;
2. load catalog metadata and that account's active grants;
3. show free Chapters 1–3 independently of paid access;
4. show purchased/manual grants as book access only when the grant is active;
5. accept gameplay-unlock facts only from a separate, approved game-domain
   adapter; and
6. return separate book-access and RPG-availability states. An active access
   grant does not make an unfinished RPG chapter playable.

This scope may expose library state and safe support references, but it does
not issue download links or launch tokens. Every read must recheck account
authorization and grant state.

## 3. Explicitly separate work

The following are not part of the minimum account/content-access scope:

- payment settlement, invoices, BTCPay, custody, refunds, chargebacks, or
  excess-payment handling;
- Tower progression, KTL evaluation, Character XP, `$MARGEN` payouts,
  `$DONCELLA`, reward weights, participant verification, or eligibility caps;
- Polygon, NFT ownership, wallet linking, marketplace transfers, burns, or
  multi-wallet cluster review;
- EPUB/PDF object storage, CDN delivery, DRM, browser-game hosting, launch
  tokens, offline access, or email backup;
- verified-email recovery, passkeys, recovery codes, manual email replacement,
  or account takeover review; and
- moderation, organization membership, guild/faction state, or social access.

The library may display a pending, locked, or unavailable state supplied by
those future domains, but it must not create or infer their authoritative state.
Retries create no duplicate grants. Catalog revisions or file replacements
must not silently revoke existing access; revocation requires a separately
authorized state transition and audit reason.

### Wallet and network boundary

Polygon remains a candidate network only and requires separate adoption. A
wallet signature or proof-of-control challenge proves control of that wallet at
the time of verification; it does not prove a unique participant, person,
account ownership, LLC ownership, or real-property ownership.

Any future proof challenge must be single-use, short-lived, and bound to the
authenticated account, service domain, network/chain ID, wallet, and requested
action. A signature for one account, domain, network, or action must not be
replayed for another. Private keys and seed phrases must never be requested.

Provider outages, timeouts, rate limits, malformed responses, unsupported
networks, or reorganization uncertainty return **verification unavailable** (a
retryable/pending state), not **not owned**. A cached ownership observation
alone cannot authorize a transfer, marketplace action, reward attribution, or
claim; protected decisions require a sufficiently finalized authoritative read.

These ownership, proof, cache, and finality rules are aligned with the separate
Web3 ownership and marketplace proposal (PR #44). They do not adopt Polygon,
wallet linking, NFT contracts, transfers, rewards, or provider integrations.

## 4. Security and correctness requirements

- Scope every query and mutation to the authenticated account context.
- Use immutable IDs, unique grant keys, idempotent creation, and auditable
  state transitions.
- Keep grant state separate from file delivery state; a failed download is not
  a loss of access.
- Preserve active access grants while account-recovery procedures are designed
  and reviewed separately; recovery must not erase or recreate a grant.
- Do not expose internal account IDs, credential data, payment details, wallet
  addresses, or provider errors to ordinary library clients.
- Revoke sessions and access only through separately authorized procedures;
  recovery must not alter participant links, primary accounts, XP, Tower state,
  or rewards.

## 5. Adoption and implementation boundary

This document does not adopt an authentication provider, credential method,
database schema, API route, storage provider, payment connector, reward
adapter, Web3 adapter, or browser-game runtime. No code, migration, SQL,
dependency, account creation flow, entitlement grant, download endpoint, or
launch route is authorized by this scope alone.
