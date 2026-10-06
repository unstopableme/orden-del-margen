# Web3 Ownership Validation and Marketplace Pipeline Proposals

**Status:** Future design proposals; not adopted and not authorized for implementation
**Scope:** Land-NFT ownership checks, account linkage, and peer-to-peer digital-asset marketplace flows

## 1. Boundary and current repository state

The repository does not implement NFT ownership validation, wallet custody,
smart-contract calls, marketplace listings, token burns, or on-chain reward
claims. The current MVP prohibits payment processing, custody, legal title,
NFT/blockchain dependencies, and securities behavior. Digital land confers no
real-property ownership, and internal `$MARGEN` or `$DONCELLA` balances are not
wallet balances.

This document records future architecture options only. It does not authorize a
provider account, contract deployment, Polygon integration, wallet linking,
marketplace, reward claim, or database migration.

## 2. Option A — Server-side land-NFT ownership validation

### 2.1 Intended purpose

A future game service could verify that an authenticated account controls the
wallet currently eligible to use a digital-land plot before allowing a harvest,
resource action, or a proposed `$MARGEN`/`$DONCELLA` claim. Ownership of an NFT
would be an input to an authorization decision, not proof of participant
identity, legal property ownership, reward eligibility, or account ownership.

### 2.2 Proposed validation flow

1. Derive the authenticated account from the server session. Never accept a
   wallet address or account identifier as the sole authority from the client.
2. Resolve an approved, proof-of-control wallet link for that account. Wallet
   binding remains separate from participant verification and primary-account
   designation.
3. Read the deployed land contract through a restricted server-side JSON-RPC
   provider. Alchemy, Infura, or another provider are examples only; no vendor
   or network is selected.
4. Verify the contract address, chain/network, token identifier, ownership
   status, and a sufficiently finalized block. A cached result must expire and
   expose its block reference.
5. Check the account/wallet risk state, including approved sanctions or abuse
   blocks and any separately authorized multi-wallet-cluster review. Similarity
   signals alone must not prove that two accounts are controlled by one person.
6. Record an auditable validation result with account, wallet, contract,
   token, block, provider response, decision, and expiry. Do not expose provider
   credentials or internal risk signals to the client.
7. Recheck ownership and authorization at the protected action boundary. A
   background listener or cron job may refresh observations, but it must not be
   the sole authority for a time-sensitive harvest or claim.

### 2.3 Event listener and reconciliation option

An optional listener could observe transfer events and enqueue revalidation.
Because events can be delayed, duplicated, removed by a reorganization, or
missed during downtime, the listener is advisory until a finalized chain read
confirms the state. A periodic reconciliation job should compare stored
observations with the authoritative contract state and record corrections.

Provider outages, rate limits, malformed responses, chain reorganization,
contract upgrades, and unsupported networks must fail closed for protected
claims while preserving an auditable retryable status. A stale cache must not
silently authorize a new claim.

### 2.4 Reward and gameplay boundary

NFT ownership proves control of a supported digital asset only. It does not
prove that a wallet is a unique participant, that a person controls no other
account, or that any holder owns an LLC, real property, or company revenue.

Listings and pending transfers must not attribute the same mining asset to two
participants. The authoritative asset identity, effective transfer state, and
participant-association rules must resolve a conflict before any attribution.
Successful transfer to a new owner grants no inherited activity credit: prior
harvests, production, XP, claims, or reward history remain with their original
account or participant under the separately adopted accounting rules.

Disputed ownership excludes the affected plot from rewards and claims until the
dispute is resolved through an authorized process. NFT ownership does not
automatically grant `$MARGEN`, `$DONCELLA`, Tower progression, participant
verification, or weekly reward eligibility. Any claim would require separately
adopted reward rules, settlement, idempotency, replay, and accounting
contracts. The current project has no such runtime claim path.

## 3. Option B — In-game peer-to-peer marketplace

### 3.1 Proposed state machine

The marketplace could model each listing as an immutable state transition:

`DRAFT → ACTIVE → (CANCELLED | EXPIRED | PURCHASE_PENDING | SOLD | FAILED)`

- **DRAFT:** seller prepares an asset, price, currency, expiry, and nonce.
- **ACTIVE:** server records a validated listing and exposes it to buyers.
- **CANCELLED/EXPIRED:** listing is no longer purchasable; cancellation and
  expiry are idempotent.
- **PURCHASE_PENDING:** a buyer request is accepted for reconciliation while
  the contract transaction is pending; no second buyer may consume the listing.
- **SOLD:** the transfer and any approved settlement/burn are finalized at a
  sufficiently confirmed block.
- **FAILED:** the transaction or validation failed; the listing may return to
  `ACTIVE` only under an explicit, auditable retry rule.

The database would track listing identity, seller account and wallet, asset
contract/token, price/currency, expiry, state version, transaction references,
and an idempotency key. It would not treat a database row as proof that an
on-chain transfer succeeded.

### 3.2 Listing, cancellation, and purchase rules

- A seller must prove control of the account and authorized wallet before a
  listing is activated.
- The service must recheck ownership, approval, listing version, expiry, and
  sanctions/risk status immediately before purchase submission.
- Cancellation wins over a racing purchase only when the contract and database
  transaction ordering confirm it; otherwise the result is reconciled from the
  authoritative chain state.
- A purchase request is idempotent. Retries return the existing listing result;
  conflicting reuse is rejected, and one listing cannot produce two sales.
- The buyer receives the asset only after the contract transfer is finalized
  under the selected confirmation policy. A payment detection or pending
  transaction alone does not establish ownership.
- Failed, dropped, replaced, or reorged transactions require reconciliation;
  they do not authorize a duplicate transfer or automatic refund.
- Marketplace activity cannot bypass existing participant, Tower, reward,
  distribution, or per-participant cap eligibility rules.

### 3.3 Contract transfer and burn proposal

A future custom Polygon contract could atomically transfer the NFT and apply a
marketplace burn to an approved token amount. The submitted 15% deflationary
burn is recorded here as a proposal only. Existing repository decisions leave
burn rates and eligible transactions unresolved; no 15% rate, token contract,
currency, recipient, rounding rule, refund treatment, or legal effect is
adopted.

If a burn is ever approved, the design must define its basis (gross price or
net amount), who supplies the tokens, fee and gas handling, failed-transaction
behavior, rounding, event evidence, and whether excess/duplicate payments are
held outside distributable surplus until reconciled. A burn must not be
described as a guaranteed price increase or ownership entitlement.

## 4. Security, privacy, and operational requirements

- Keep RPC credentials, signing keys, custody keys, and provider metadata
  server-side; do not ask users for private keys or seed phrases.
- Apply authorization on every protected action, not only at login, listing,
  or subscription time.
- Use chain IDs, contract allowlists, finality thresholds, replay protection,
  immutable event IDs, and unique listing/order keys.
- Minimize wallet and risk data, restrict reviewer access, and provide an
  appeal path for mistaken cluster or abuse blocks.
- Define jurisdiction, consumer, tax, AML/sanctions, custody, securities,
  gambling, and marketplace obligations before adoption.
- Keep digital land distinct from real-property title and business ownership.

## 5. Open decisions

- Whether any NFT, wallet, Polygon network, or marketplace will be adopted.
- Contract addresses, chain selection, finality depth, RPC provider, listener
  durability, reorg policy, and upgrade authority.
- Wallet-link proof, account recovery, multi-wallet uniqueness, cluster review,
  sanctions process, appeals, and account-to-wallet limits.
- Asset classes, listing rights, royalties, fees, currencies, escrow/custody,
  transfer restrictions, refunds, and buyer/seller protections.
- Whether `$MARGEN` or `$DONCELLA` can ever be used for marketplace settlement
  or claims, and the separate reward/accounting rules required.
- The proposed 15% burn rate and all burn, rounding, reversal, and reporting
  semantics.

## 6. Implementation boundary

No code, smart contract, provider integration, wallet database, marketplace
route, cron job, event listener, token burn, NFT transfer, or reward claim is
authorized by this proposal. Adoption would require a separately approved
architecture, legal/compliance review, threat model, data-retention policy,
operational runbook, and implementation plan.
