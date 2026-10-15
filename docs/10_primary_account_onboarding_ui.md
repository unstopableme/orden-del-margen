# Specification: Primary-account onboarding user interface

**System module:** Account interface / onboarding blueprint  
**Status:** Gameplay proposal; implementation deferred  
**Tracking scope:** Offline layout reference only

## 1. Identity and workflow separation

Account creation/sign-in, participant verification, participant-account
association, primary progression-account designation, character creation, and
faction selection are separate workflows. This interface must not collapse them
into one “registration” action.

A newly authenticated Web2 account is not automatically a confirmed
participant or designated primary account. Primary designation is available
only after the account is associated through the separately authorized process.
The service must never infer designation from character activity, Tower level,
wallet linkage, faction selection, device/IP similarity, or highest level.

No user should paste a private key, seed phrase, password, identity-provider
token, or raw restricted evidence into an “identity key” field. Future
authentication and identity-proofing UI requires a separately approved security
and privacy design.

## 2. Starting-balance candidate

The submitted `500 $DONCELLA` starting bonus is an unapproved promotional
candidate. It is not a balance, allotment, entitlement, or committed ledger
credit. Before adoption, policy must define eligibility, funding source,
account/participant scope, regional restrictions, abuse controls, expiry,
idempotency, ledger reason, reversals, and whether multiple accounts controlled
by one participant may receive it.

The UI must not display the candidate as an available balance. It may appear
only in a clearly labeled design-review panel until an authoritative committed
credit exists.

## 3. Proposed localization tokens

| Localization key | Fallback English text |
| --- | --- |
| `TXT_ONBOARD_HEADER` | `WELCOME` |
| `TXT_ONBOARD_ACCOUNT_STATUS` | `ACCOUNT STATUS` |
| `TXT_ONBOARD_PARTICIPANT_STATUS` | `PARTICIPANT VERIFICATION` |
| `TXT_ONBOARD_PRIMARY_STATUS` | `PRIMARY PROGRESSION ACCOUNT` |
| `TXT_ONBOARD_CHARACTER_STATUS` | `CHARACTER SETUP` |
| `TXT_ONBOARD_CONTINUE` | `CONTINUE ACCOUNT SETUP` |
| `TXT_ONBOARD_REQUEST_DESIGNATION` | `REQUEST PRIMARY DESIGNATION` |
| `TXT_ONBOARD_EXIT` | `EXIT` |
| `TXT_ONBOARD_BONUS_CANDIDATE` | `Candidate promotion: 500 $DONCELLA (not granted)` |

Localization strings are presentation only and must not be parsed into identity,
permission, association, designation, or balance state.

## 4. Terminal layout blueprint

```text
+----------------------------------------------------------------------------+
| [WELCOME]                                           [DOCUMENT REV: 2026-10-04] |
+----------------------------------------------------------------------------+
| ACCOUNT SETUP
|
|   AUTHENTICATED ACCOUNT:       NOT CONNECTED / CONNECTED
|   PARTICIPANT VERIFICATION:    NOT STARTED / PENDING / CONFIRMED
|   ACCOUNT ASSOCIATION:         NONE / PENDING / CONFIRMED
|   PRIMARY PROGRESSION ACCOUNT: NOT AVAILABLE / ELIGIBLE / DESIGNATED
|   CHARACTER SETUP:             NOT STARTED / IN PROGRESS / COMPLETE
|
| DESIGN-REVIEW NOTE
|   Candidate promotion: 500 $DONCELLA (not granted; policy unresolved)
|
| PRIMARY-ACCOUNT NOTE
|   Designation requires a confirmed participant association.
|   Approved switches activate at an authorized future weekly boundary.
+----------------------------------------------------------------------------+
| [CONTINUE ACCOUNT SETUP]                         [REQUEST DESIGNATION]*    |
| [EXIT]                         *Shown only when the service reports eligible |
+----------------------------------------------------------------------------+
```

The document revision is not a security version or account timestamp. Statuses
must come from authorized services and must not be inferred locally.

## 5. Primary designation and switch boundary

Initial designation and later switching require explicit authenticated actions,
current authorization, effective-dated associations, version checks,
idempotency, immutable audit history, and PostgreSQL-authoritative state. An
approved switch activates at the next authorized weekly boundary and is limited
by the adopted cooldown/recovery policies; UI text cannot approve or execute it.

The precise initial-designation approval process remains unresolved. This
proposal must not imply that a single button bypasses reviewer, verification,
association, or recovery controls.

## 6. Privacy, security, and accessibility

- Collect only fields required by an adopted workflow and explain their use.
- Never expose provider subjects, credential fingerprints, restricted evidence,
  idempotency keys, reviewer details, or internal account identifiers.
- Use generic error responses that do not reveal whether another person's
  account or credential exists.
- Support keyboard, touch, controller where applicable, screen readers,
  zoom/reflow, localization expansion, and reduced motion.
- Provide clear back/cancel/recovery paths without weakening security.
- Do not use color alone for verification or designation state.

## 7. Offline boundary

No authentication, identity proofing, participant creation, association,
designation, `$DONCELLA` credit, database initialization, route, UI preview,
simulation, or test is authorized. All implementation remains deferred.
