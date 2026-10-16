# Specification: User settings account summary

**System module:** User interface / privacy-safe profile summary  
**Status:** Gameplay proposal; implementation deferred  
**Tracking scope:** Offline layout reference only

## 1. Privacy and authority boundary

The proposed summary presents a signed-in user with a limited view of their own
account, participant-association status, primary-designation status, gameplay
utility balance, and relevant weekly-period information.

The submitted example contained a real-looking legal name, gendered account
class, stable system-access identifier, wallet balance, and escrow balance.
Those values are excluded. Offline design fixtures must not contain personal
data or imply custody, escrow, wallet ownership, or financial services.

The UI is not authoritative. Authentication, authorization, association,
designation, balances, and switch state must come from future services backed
by PostgreSQL. Community profile data must not be treated as verified legal
identity.

## 2. Field visibility proposal

| Field | Proposed display rule |
| --- | --- |
| Display name | User-controlled profile value; privacy/moderation policy required |
| Account reference | Opaque, masked support reference; never a credential or database primary key |
| Participant status | Show only to the authenticated subject with safe status vocabulary |
| Primary designation | Show `not eligible`, `eligible`, `designated`, or `switch pending` only when authorized |
| `$DONCELLA` gameplay balance | Show exact authoritative balance if implemented and authorized; not a wallet/cash balance |
| Weekly reward period | Show the adopted UTC interval as informational context |
| Switch activation | Show only a committed authorized request and its effective boundary |

Do not show restricted identity evidence, provider subjects, public-key
fingerprints, linked-wallet addresses, reviewer identities, fraud/risk signals,
internal participant/account IDs, idempotency keys, payout grouping, or other
people's associations.

## 3. Terminal layout blueprint

```text
+----------------------------------------------------------------------------+
| [USER SETTINGS: ACCOUNT SUMMARY]                         [SESSION: ACTIVE] |
+----------------------------------------------------------------------------+
| PROFILE
|   DISPLAY NAME:              Example Player
|   ACCOUNT REFERENCE:         acct_••••7K2Q (illustrative)
|
| PARTICIPANT AND PROGRESSION
|   PARTICIPANT STATUS:        NOT VERIFIED / PENDING / CONFIRMED
|   PRIMARY ACCOUNT STATUS:    NOT ELIGIBLE / ELIGIBLE / DESIGNATED
|   SWITCH STATUS:             NONE / PENDING FUTURE BOUNDARY
|
| GAMEPLAY UTILITY ASSET
|   $DONCELLA BALANCE:         UNAVAILABLE (no persistence implemented)
|   This is not a wallet, cash, escrow, or redeemable balance.
|
| WEEKLY REWARD PERIOD
|   CURRENT PERIOD:            Sunday 00:00 UTC inclusive
|                              to Sunday 00:00 UTC exclusive
|   SWITCH EFFECTIVE AT:       Show only from an authorized committed request
+----------------------------------------------------------------------------+
| [BACK TO SETTINGS]                                      [SIGN OUT]        |
+----------------------------------------------------------------------------+
```

“Example Player” and the masked reference are fictional placeholders. They are
not seeded identities or acceptable production fixtures.

## 4. Proposed localization tokens

| Localization key | Fallback English text |
| --- | --- |
| `TXT_SETTINGS_ACCOUNT_HEADER` | `USER SETTINGS: ACCOUNT SUMMARY` |
| `TXT_SETTINGS_PROFILE_SECTION` | `PROFILE` |
| `TXT_SETTINGS_PARTICIPANT_SECTION` | `PARTICIPANT AND PROGRESSION` |
| `TXT_SETTINGS_DONCELLA_SECTION` | `GAMEPLAY UTILITY ASSET` |
| `TXT_SETTINGS_WEEKLY_SECTION` | `WEEKLY REWARD PERIOD` |
| `TXT_SETTINGS_DISPLAY_NAME` | `DISPLAY NAME` |
| `TXT_SETTINGS_ACCOUNT_REFERENCE` | `ACCOUNT REFERENCE` |
| `TXT_SETTINGS_PARTICIPANT_STATUS` | `PARTICIPANT STATUS` |
| `TXT_SETTINGS_PRIMARY_STATUS` | `PRIMARY ACCOUNT STATUS` |
| `TXT_SETTINGS_SWITCH_STATUS` | `SWITCH STATUS` |
| `TXT_SETTINGS_DONCELLA_BALANCE` | `$DONCELLA BALANCE` |
| `TXT_SETTINGS_BACK` | `BACK TO SETTINGS` |
| `TXT_SETTINGS_SIGN_OUT` | `SIGN OUT` |

Localized text must not be parsed as state. Status codes, timestamps, asset
codes, and exact quantities remain structured data.

## 5. Weekly-period and switch interpretation

The weekly period is half-open: Sunday 00:00 UTC inclusive to the next Sunday
00:00 UTC exclusive. The display must include actual dates when implemented so
two identical weekday labels are not mistaken for a zero-duration interval.

Primary-account switches do not execute merely because the UI reaches a clock
boundary. A separately authorized, approved, non-cancelled request must pass
service-side revalidation and commit atomically. The summary displays committed
state; it does not schedule or execute transitions.

## 6. Session, privacy, and accessibility

- “Sign out” must invalidate or end the applicable session through the future
  authentication system; closing a panel is not sign-out.
- Avoid caching sensitive settings responses in shared clients or gateways.
- Apply authorization on every refresh; a hidden field is not access control.
- Support keyboard, touch, screen readers, zoom/reflow, localization expansion,
  and reduced motion.
- Do not rely only on color or abbreviations such as `SEC` for security state.
- Provide explicit stale/unavailable/error states without displaying fabricated
  zero balances.

## 7. Offline boundary

No personal-data store, wallet, custody, escrow, balance service, authentication,
database initialization, switch executor, route, UI preview, simulation, or
test is authorized. All implementation remains deferred.
