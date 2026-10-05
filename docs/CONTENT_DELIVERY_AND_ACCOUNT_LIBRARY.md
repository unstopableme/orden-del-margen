# Content Delivery and Account Library Design

**Status:** Delivery model adopted for design; implementation pending and not authorized
**Scope:** EPUB/PDF bundle delivery, account library presentation, and browser-based game access
**Related business rule:** A confirmed purchase grants content access only; it does not change Tower progression or reward eligibility.

## 1. Purpose and boundary

This proposal describes a possible delivery experience for the full 12-chapter
book/RPG bundle. It does not set a price, create a payment contract, establish
refund rights, or authorize checkout, custody, entitlement ledgers, file
hosting, account creation, or game runtime work.

The existing business model records the bundle as twelve book chapters and the
corresponding twelve RPG chapters. Chapters 1–3 are free, and Kingdom Tower
Levels 1–9 unlock Chapters 4–12 respectively. Purchases grant content access
only; every player still faces identical Tower progression and reward-eligibility
requirements.

## 2. Adopted delivery model

For each available chapter, the adopted delivery model includes:

- an EPUB book file;
- a PDF book file; and
- a browser-game entry that opens the corresponding RPG chapter when that
  chapter is available to the account.

The account library is the primary delivery surface. An email backup may be
used to provide delivery notices and backup download links, subject to an
approved account, privacy, and delivery policy. Email is a backup channel, not
the authoritative access record.

The library should identify the chapter, media type, version, language, and
availability state without exposing storage paths or internal entitlement IDs.
The book files should carry accessible titles, chapter navigation, selectable
text where technically possible, and a visible version/date marker.

The bundle should be presented as one content-access product even if files are
delivered separately. A successful purchase should not be represented as a
share, investment, property right, token allocation, or reward entitlement.

## 3. Adopted authenticated account library

An authenticated account has a private **Library** view with:

- available free chapters;
- purchased chapters whose access has been confirmed by an authorized future
  entitlement service;
- EPUB and PDF actions for each available book chapter;
- a **Play in browser** action for each available RPG chapter;
- delivery status such as `available`, `processing`, `retry available`, or
  `support review`; and
- a non-sensitive support reference for delivery problems.

The account identity must come from the authenticated session. A client-supplied
account ID, wallet address, email, or hidden form field must not select another
account's library. Library responses must authorize every chapter and every
download or game-launch request.

The library is an access presentation, not a reward ledger. It must not grant
Tower levels, Character XP, weekly `$MARGEN` distributions, participant status,
primary-account designation, or any other progression state.

## 4. Adopted browser RPG access

The adopted **Play in browser** action opens the RPG chapter in the web game
after the server checks the authenticated account's current content access. The
browser may receive a short-lived launch token or route reference rather than a
permanent entitlement identifier. The game server must repeat authorization at
chapter load and on any privileged content request.

Access failure should produce a clear state explaining whether the chapter is
locked by progression, unavailable because delivery is processing, or
temporarily unavailable because of infrastructure trouble. The UI must not
suggest that a purchase bypasses Tower requirements.

Participant verification is not required merely to read a purchased book or
open an authorized browser-game chapter. Any future participant or reward
workflow remains separate.

## 5. Delivery acceptance and failure recommendations

The eventual delivery service should distinguish these states:

1. **Accepted:** the purchase/access record is durably recorded and the
   library can be refreshed to obtain the files or launch the game.
2. **Processing:** payment or file preparation is not yet complete; the user
   may retry a status refresh without creating a second purchase.
3. **Retryable failure:** a temporary storage, rendering, email, or network
   failure occurred. The submission remains retryable and must never be
   finalized as either acceptance or rejection solely because of that failure.
4. **Unknown outcome:** the client lost an acknowledgment. The user should
   first refresh the library or query the authoritative fulfillment record
   before retrying. The client must not assume that access was granted or
   refused from the missing acknowledgment alone.
5. **Terminal rejection:** the request was definitively refused. The UI should
   show a stable support reference and must not claim that content access was
   granted.

When a retry succeeds after a transient failure or unknown outcome, it returns
the existing access grant if one was already committed. It must not create a
duplicate grant or second fulfillment.

Recommended recovery order for a failed delivery is:

- let the user refresh the account library and retry a failed file preparation;
- offer an authenticated in-library re-download or regenerated download link;
- offer the browser-game entry when the game chapter is authorized even if an
  EPUB/PDF download is temporarily unavailable;
- route persistent failures to support using the support reference and the
  original submission identity; and
- consider replacement delivery, account credit, or a refund only under a
  separately approved sales/refund policy.

No automatic refund, duplicate fulfillment, wallet reversal, or compensation
is adopted by this proposal. A missing email must not erase content already
available in the authenticated library.

## 6. Privacy, security, and accessibility considerations

- Use least-privilege, expiring download links and do not expose object-store
  paths, credentials, account IDs, or payment details in the UI.
- Record access and delivery events with an auditable support reference, while
  minimizing personal data and download telemetry.
- Provide keyboard-accessible controls, readable status text, captions or text
  alternatives for game media, and clear file-format labels.
- Define account recovery and access-revocation behavior before treating the
  library as durable ownership of files.
- Do not imply DRM, offline access, unlimited downloads, device limits, or
  perpetual access until those terms are separately decided.

## 7. Decisions still required

The following remain unresolved:

- bundle price, payment confirmation, and supported payment methods;
- sales, delivery, refund, cancellation, chargeback, and regional terms;
- whether access is perpetual, time-limited, revocable, or transferable;
- file hosting, encryption/DRM, download limits, offline reading, and device
  support;
- account creation, sign-in, recovery, email verification, and session policy;
- the entitlement record and idempotency model for repeated delivery attempts;
- whether EPUB/PDF files are generated per chapter or as a single bundle;
- browser-game hosting, save persistence, maintenance behavior, and launch-token
  lifetime; and
- support staffing, service-level targets, and replacement/refund authority.

## 8. Pending infrastructure and implementation boundary

Payment settlement, account recovery, file hosting, and all implementation
details remain pending. This document authorizes no runtime code, database
schema, payment route, wallet custody, file-storage integration, account
service, entitlement ledger, download endpoint, browser-game route, email
delivery service, or automated refund behavior. Any future implementation must
first reconcile this adopted delivery model with the confirmed business model,
the authenticated-account design, applicable legal and tax review, and the
project's MVP exclusions.
