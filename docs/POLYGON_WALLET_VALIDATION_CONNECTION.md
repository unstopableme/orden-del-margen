# Polygon Wallet Validation Connection Proposal

**Status:** Future design proposal; not adopted and not authorized for implementation
**Scope:** Node.js server connection for validating supported Polygon wallet and land-NFT state

## 1. Boundary

This document describes how a future Node.js service could connect to Polygon
for read-only wallet and contract validation. The repository currently has no
Polygon integration, wallet service, RPC credentials, NFT contract, custody,
or on-chain reward path. This proposal authorizes no code, dependency, provider
account, contract deployment, wallet linking, transfer, burn, or reward claim.

NFT ownership would prove control of a supported digital asset only. It would
not prove a unique participant, LLC or real-property ownership, or entitlement
to `$MARGEN`, `$DONCELLA`, Tower progression, or rewards.

## 2. Proposed Node.js connection boundary

The application would use a provider adapter behind a small internal interface,
for example:

- `getChainStatus()` — chain ID, latest block, and provider health;
- `getFinalizedBlock()` — the block safe for authorization decisions;
- `readContract()` — allowlisted read-only contract calls;
- `getTransferEvents()` — bounded event queries for reconciliation; and
- `classifyProviderError()` — unavailable, rate-limited, malformed, reverted,
  or unsupported responses.

The rest of the application must not construct arbitrary JSON-RPC URLs,
contract addresses, ABI fragments, or provider requests. A Polygon provider
(Alchemy, Infura, or another approved service) remains a replaceable
configuration choice; no vendor is selected by this proposal.

## 3. Configuration and secret handling

Future deployment configuration should provide:

- an explicit Polygon chain ID and network name;
- an RPC endpoint supplied through secret configuration, never client input;
- an allowlist of contract addresses and immutable contract version/ABI
  fingerprints;
- request timeout, retry, rate-limit, and maximum event-range settings;
- a finality depth or finalized-block policy; and
- separate provider credentials and quotas for reads, reconciliation, and
  operational monitoring where needed.

RPC keys and service credentials remain server-side. The service must never
request or store a private key, seed phrase, or signing capability for an
ownership read. If future writes are ever considered, signing must be a
separate reviewed boundary with independent custody and authorization.

## 4. Request flow for a protected game action

1. Derive the authenticated account from the server session.
2. Resolve an approved wallet link established through a proof-of-control
   challenge. A body-supplied wallet address is not sufficient.
3. Validate address format, normalized casing, supported chain, contract
   allowlist, and token identifier.
4. Obtain a finalized block and call the contract's read-only ownership method
   (for example, an `ownerOf`-equivalent) at that block.
5. Check the wallet-link uniqueness and any separately authorized abuse or
   multi-wallet-cluster review. Similarity signals alone cannot establish a
   person's identity or guilt.
6. Compare the returned owner with the proof-bound wallet and record the
   decision, block, contract, token, provider, and expiry in an auditable
   validation observation.
7. Recheck the validation at the protected harvest, marketplace, or claim
   boundary. A background cache or event listener is not the sole authority.

The response should expose only an allow/deny/pending state and a safe support
reference. It must not reveal RPC credentials, risk signals, internal wallet
links, or raw provider errors.

## 5. Caching, finality, and reconciliation

An ownership observation may be cached only with its chain ID, contract, token,
owner, block number/hash, observed time, expiry, and validation policy version.
Cache lifetime must be shorter than the accepted transfer/finality risk for the
protected action. A stale cache cannot authorize a new claim.

An event listener may enqueue transfer observations, but events can be delayed,
duplicated, missed during downtime, or removed by a chain reorganization. A
periodic reconciliation job must reread the authoritative contract state at a
finalized block and record corrections. Duplicate events must be idempotent;
reorgs must invalidate observations derived from affected blocks.

Ownership changes, disputed transfers, or contradictory provider responses
should place the affected plot in a pending/disputed state. The plot is excluded
from rewards and claims until an authorized review resolves the state. A
confirmed transfer grants no inherited activity credit.

## 6. Failure and abuse handling

- Provider timeout, outage, rate limit, malformed response, unsupported chain,
  contract mismatch, or reorg uncertainty produces a retryable/pending result,
  not an optimistic grant.
- A definitive contract response that the wallet does not own the token is a
  terminal denial for that validation attempt.
- Retries use an idempotency key for the protected action; they cannot create a
  second harvest, claim, listing, transfer, or reward record.
- Multi-wallet-cluster and sanctions/abuse findings require an authorized,
  privacy-limited review process and an appeal path. They must not be inferred
  solely from IP, device, transaction, or graph similarity.
- The system must preserve audit evidence without retaining unnecessary wallet,
  account, or provider data.

Marketplace activity and wallet validation cannot bypass participant, Tower,
reward, distribution, or per-participant cap eligibility rules. `$MARGEN` and
`$DONCELLA` claim semantics remain separate unresolved designs.

## 7. Open decisions

- Polygon network/chain ID, contract addresses, ABI/versioning, finality depth,
  provider, quotas, and data-retention period;
- wallet-link proof, account recovery, wallet uniqueness, cluster review,
  sanctions process, reviewer separation, and appeals;
- supported NFT standards and ownership methods, including escrow or transfer
  states;
- cache TTLs, reconciliation schedule, reorg handling, and operational SLOs;
- the exact protected actions and their idempotency/accounting contracts; and
- legal, tax, consumer, custody, marketplace, and token obligations.

## 8. Implementation boundary

Do not add Node.js RPC code, provider SDKs, environment secrets, Polygon
connections, contract ABIs, wallet tables, event workers, ownership caches,
transfers, burns, or reward claims from this proposal alone. Adoption requires
separate architecture, security, legal/compliance, privacy, threat-model, and
operational approval.
