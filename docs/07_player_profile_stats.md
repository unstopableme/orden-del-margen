# Design Document: Player Profile Stat Screen and Progression History

**System module:** Profile UI / Historical Analytics Dashboard  
**Status:** Gameplay-only design proposal; no implementation is authorized

All titles, metrics, scores, milestones, colors, retention rules, and example
values in this document are candidates. This proposal does not create profile
persistence, an immutable ledger, a snapshot job, a migration, or an API.

## 1. Candidate interface wireframe

The Player Profile Stat Screen presents a historical summary of verified
gameplay activity and candidate progression metrics.

```text
+----------------------------------------------------------------------------+
| CHARACTER PROFILE  Player: Player_1                Title: Forge-Master      |
+----------------------------------------------------------------------------+
| CORE STATS SUMMARY                       | PERIOD EFFICIENCY HISTORY        |
| Total verified encounters: 142           | Period 01:  2.15 display        |
| Candidate peak efficiency: 23.40         | Period 02: 12.50 display        |
| Recorded crafting attempts: 48           | Period 03: 20.00 display        |
| Recorded Tier 3 failures: 4              | Current period: in progress     |
+----------------------------------------------------------------------------+
| CANDIDATE EFFICIENCY MILESTONES                                           |
| [██████████████████░░░░░░░░░░░░░░░░░░░] 50% display milestone             |
|                                                                            |
| RECENT PROFILE EVENTS                                                      |
| Sunday 00:00 UTC boundary: prior period archived                           |
+----------------------------------------------------------------------------+
```

Names, titles, totals, scores, and dates are fictional examples. Efficiency
history and weapon-attribute history are distinct: an aggregated period score
must not be presented as though it were a weapon attribute.

## 2. Candidate historical data contract

If profile history uses the adopted weekly calendar, a period starts Sunday at
00:00:00 UTC inclusive and ends the following Sunday at 00:00:00 UTC exclusive.
The final period result is determined from eligible events assigned to that
interval.

The boundary is an effective-time rule, not a requirement for a process to run
at that exact instant. Archival may complete later if period assignment is
deterministic, retries are idempotent, and no interval gap or overlap occurs.
Energy regeneration remains an elapsed-time calculation independent of this
weekly boundary.

A future approved history record would need at least:

- player or participant identifier and privacy-safe display identity;
- period start and exclusive period end;
- metric and gameplay-rule versions;
- exact canonical metric inputs and result;
- source-event references or an immutable source hash;
- calculation and archival timestamps; and
- additive correction references without silent history replacement.

No such ledger or snapshot producer is established by this document.

## 3. Exact values and display rounding

- Historical calculations must use canonical exact integer, rational, or
  fixed-point inputs under an approved metric contract, not binary floating
  point.
- The UI may show a rounded decimal for readability, but must label it as a
  display value and must not feed it back into calculations or comparisons.
- The Arena average Energy-efficiency formula, eligibility requirements,
  baseline, maximum score, and tie-break rules remain unresolved proposals.
- A `25.00` ceiling and a 50% milestone therefore remain illustrative and must
  not be treated as authoritative limits.

## 4. Active and historical state

Live equipment and balance changes may affect later eligible encounters under
the applicable rule version. They do not rewrite a previously finalized period.
The final aggregate must include or exclude events according to the approved
metric—not ignore mid-period changes merely because they were temporary.

Weapon history, equipment history, crafting history, encounter history, and
period-efficiency history should remain separately identified even if the UI
presents them together.

## 5. Candidate crafting counters

- A crafting-attempt counter changes only after an authoritative attempt is
  recorded exactly once.
- Retrying the same request must return the recorded result without incrementing
  counters or charging resources again.
- A Tier 3 failure counter changes only after an authoritative failed result and
  its atomic resource transaction commit successfully.
- The proposed 85% success rate, `$DONCELLA` cost, material deductions, partial
  salvage rule, and permanent failure statistic remain pending explicit
  approval.
- Technical or synchronization failures with no committed crafting outcome must
  not count as gameplay failures.

## 6. Candidate visual components

- Historical entries may use gray (`#6B7280`) and current-period information may
  use amber (`#F59E0B`), subject to contrast testing.
- Milestone progress must include text and not rely on color or bar length alone.
- Charts and feeds require keyboard and controller navigation, screen-reader
  labels, nonvisual summaries, responsive layouts, and reduced-motion behavior.
- Public and private profile fields require separate visibility and moderation
  rules before implementation.

## 7. Migration and prototype boundaries

Weekly archival does not imply a profile schema migration. A migration such as
`Profile_v1` to `Profile_v2` requires separate design, authorization, rollback,
and audit requirements and should not be shown as routine boundary behavior.

Any linked sandbox or playground remains an illustrative prototype until its
source and behavior are reviewed. This document does not establish that a
profile dashboard, historical archive, metric engine, or integration exists.
