# Storage Buffer and Adventure Energy/Reward Rules

**Status:** Design proposal; not adopted and not authorized for implementation
**Scope:** Idle-production storage buffers and future Adventure energy/rewards
**Tracking boundary:** Documentation only; no calculator, route, schema, ledger, or reward job is authorized

## 1. Authority and terminology

This document separates existing implementation facts, existing documented
proposals, and new recommendations. A recommendation is not a confirmed game
rule merely because it is written as a precise example.

The following existing artifacts are relevant:

- `apps/api/src/gameplay/idleProduction.js` is an implemented pure calculator,
  not a persistence or gameplay service.
- `docs/IMPLEMENTATION_PLAN.md` documents exact carry arithmetic, elapsed-time
  caps, settlement-before-upgrade requirements, and missing runtime safeguards.
- `docs/04_gameplay_proposals_supplement.md` marks a 100-energy cap, +10/hour
  regeneration, and encounter costs as proposed values.
- `docs/VISION.md` allows completed Adventures to qualify as a future Character
  XP source for Tower progression, but does not schedule implementation.

No rule in this document authorizes implementation, changes the existing
calculators, changes weekly reward policy, or creates a `$MARGEN` payout path.

## 2. Storage-buffer status

### 2.1 Existing implemented calculator behavior

The current pure calculator recognizes these storage-time candidates as code:

| Building level | Storage-time limit in calculator | Meaning in current calculator |
| --- | ---: | --- |
| Level 1 | 8 hours | Cap newly elapsed production time |
| Level 2 | 12 hours | Cap newly elapsed production time |

The calculator also:

- uses the configured hourly production rate;
- represents fractional production as an integer `carryNumerator` under a
  `3,600,000` millisecond-per-hour denominator;
- credits whole units and carries the remainder exactly;
- reports discarded elapsed time after the cap; and
- advances the settlement timestamp to the requested settlement time.

These are implementation facts about the isolated calculator, not approval of
all surrounding gameplay or persistence rules.

### 2.2 Existing documented rules and open questions

The implementation plan documents that previous carry is added to capped new
accrual and is not discarded by the elapsed-time cap. It also requires future
collection and upgrade transactions to settle under one authoritative timestamp
before changing a building's rate or level.

The repository has not adopted whether a stored quantity cap is distinct from
the current elapsed-time cap, whether production continues while inactive or
upgrading, or how a persisted balance and carry are locked in a service.

### 2.3 New storage-capacity recommendation

The following is a new recommendation for review:

`buffer capacity in asset units = hourly production rate × buffer hours`

Under this recommendation, the Level 1 and Level 2 buffer-hour values remain
8 and 12 respectively, but the resulting capacity is calculated per building
type and level from the authoritative hourly rate. The capacity is not a
universal number shared by every building.

Examples using the existing calculator rates:

| Building | Level | Hourly rate | Buffer hours | Candidate capacity |
| --- | ---: | ---: | ---: | ---: |
| wheat farm | 1 | 60 wheat/hour | 8 | 480 wheat |
| wheat farm | 2 | 132 wheat/hour | 12 | 1,584 wheat |
| lumber mill | 1 | 45 wood/hour | 8 | 360 wood |
| `$DONCELLA` bank | 2 | 25 `$DONCELLA`/hour | 12 | 300 `$DONCELLA` |

This recommendation must not be read as changing the current calculator's
elapsed-time cap. A future authoritative service would need to choose whether
the quantity capacity replaces, supplements, or merely explains that cap.

### 2.4 Fractional carry and capacity treatment

The current calculator stores a fractional remainder exactly. For example,
500 milliseconds at 45 units/hour adds `22,500 / 3,600,000` of a unit to
carry. The carry is not rounded away when a settlement occurs.

The current calculator's cap applies to newly elapsed time. Existing carry is
added afterward and therefore does not consume additional capped elapsed time.
For example, a Level 1 wheat farm settling 8 hours with a carry of
`3,599,999 / 3,600,000` returns 480 whole wheat and retains that fractional
remainder. This demonstrates that the current implementation treats carry as
accounting state, not as elapsed buffer time.

New recommendation for a future quantity-cap service:

- Treat fractional carry as part of the exact accrued amount for the purpose of
  deciding whether a quantity capacity is full.
- Do not discard the carry merely because the whole-unit capacity has been
  reached; retain it in an explicit overflow or capacity policy instead.
- Choose one policy before persistence is implemented: pause fractional accrual
  at exact capacity, retain sub-unit overflow separately, or define capacity as
  a whole-unit display limit while exact carry may remain below one unit.

The choice is unresolved because the existing calculator permits capacity plus
sub-unit carry under its elapsed-time interpretation.

### 2.5 Stopping, collection, and resumption

Proposed behavior for review:

1. Production accrues only until the applicable elapsed-time or quantity cap,
   according to the adopted rule version.
2. Once capacity is full, further production stops; the authoritative state
   records the cap condition rather than silently advancing an unlimited
   balance.
3. Collection settles production through one authoritative timestamp, credits
   whole units, persists exact carry, and records discarded or stopped time.
4. Collection resumes only after capacity is freed or the adopted cap window is
   reset. Resumption must not retroactively apply a later building rate.
5. A building upgrade, downgrade, pause, activation, or disable operation first
   settles production under the old rate, old level, old activity state, and
   one authoritative timestamp in the same transaction.
6. Only after settlement succeeds may the operation change the building rule
   or capacity.

The activity states that accrue production, the reset behavior, and whether
capacity is inventory-wide or per building remain unresolved.

### 2.6 Storage balance examples

These examples illustrate candidate arithmetic only:

- A Level 1 wheat farm at 60/hour left for 9 hours produces at most 480 wheat
  under the 8-hour candidate buffer and reports 1 hour of discarded elapsed
  time. The current calculator returns this result.
- A Level 2 wheat farm at 132/hour left for 13 hours produces at most 1,584
  wheat under the 12-hour candidate buffer and reports 1 discarded hour.
- A Level 1 lumber mill at 45/hour settled after 30 minutes produces 22 whole
  wood and carries `1,800,000 / 3,600,000` of a wood unit. A later settlement
  must add that carry exactly rather than round it away.
- If an adopted quantity capacity is already full, a collection must not add
  new whole units merely because more wall-clock time elapsed. The behavior of
  sub-unit carry at that boundary remains the explicit unresolved choice in
  section 2.4.

## 3. Adventure energy status

### 3.1 Existing candidate values

The gameplay supplement marks these values as proposed, not adopted:

| Parameter | Existing candidate | Status |
| --- | ---: | --- |
| Maximum energy | 100 energy | Proposed |
| Regeneration | 10 energy/hour | Proposed |
| Ordinary Adventure encounter | 15 energy | Proposed |
| Boss Arena encounter | 40 energy | Proposed |

Energy is documented as separate from weekly reward boundaries, participant
verification, reward weight, Portfolio, `$MARGEN`, and community points.

### 3.2 New duration/difficulty cost recommendation

The following cost ladder is a new fictional recommendation, not an adopted
balance table:

| Adventure tier | Example duration | Example energy cost | Fictional purpose |
| --- | ---: | ---: | --- |
| Scout / Easy | 15 minutes | 10 | Short low-risk expedition |
| Standard | 1 hour | 15 | Ordinary Adventure baseline |
| Hazardous | 4 hours | 30 | Higher-risk resource run |
| Elite | 8 hours | 50 | Long expedition with stronger rewards |
| Apex / Boss | 12 hours | 75 | High-risk cap-constrained encounter |

The existing 15-energy ordinary candidate is compatible with the Standard row,
and the existing 40-energy Boss Arena candidate is a different combat proposal;
neither is silently converted into an Adventure rule.

### 3.3 Energy settlement and insufficient-energy recommendation

Proposed transaction boundary:

1. Derive the acting account from authentication.
2. Settle regeneration to one authoritative timestamp using exact carry.
3. Validate Adventure availability, duration, difficulty, and cost.
4. Reject insufficient energy without changing energy, carry, Adventure state,
   inventory, Character XP, or any reward record.
5. When the Adventure is accepted, reserve or debit its cost exactly once in the
   same transaction that creates a unique Adventure run.
6. Record the run's rule version, cost, start time, expected completion time,
   and idempotency/submission key.

The client may display an insufficient-energy warning, but only the
authenticated authoritative service may accept an Adventure run or debit
energy.

### 3.4 Failure, cancellation, and refund recommendation

New recommendation for review:

- Validation failure before acceptance: no energy charge and no run record.
- Duplicate start request: return the original run result without a second
  charge.
- Accepted run that fails due to the Adventure outcome: consume the stated
  energy cost and grant no success reward, unless an approved failure reward is
  later defined.
- Player cancellation after acceptance: no automatic refund by default; the
  run records cancellation and any approved partial result separately.
- System failure before the debit transaction commits: no charge and the run is
  not accepted.
- System failure after the debit commits: the run remains authoritative and
  must be recoverable by its run ID; it must not be charged again on retry.

Refund timing, partial refunds, maintenance interruption, timeout behavior,
and whether some difficulty tiers have failure protection remain unresolved.

### 3.5 Fictional Adventure rewards

The following are fictional reward candidates for balance discussion only:

| Tier | Candidate materials | Candidate equipment | Candidate Character XP |
| --- | --- | --- | ---: |
| Scout / Easy | 5 `mat_iron_scrap` | none | 25 |
| Standard | 15 `mat_iron_scrap`, 5 `mat_coarse_leather` | `equip_scout_grip_i` | 75 |
| Hazardous | 20 `mat_refined_steel`, 5 `mat_treated_hide` | `equip_wayfinder_boots_i` | 150 |
| Elite | 10 `mat_enchanted_amber`, 10 `mat_refined_steel` | `equip_expedition_mail_ii` | 300 |
| Apex / Boss | 5 `mat_royal_core`, 10 `mat_enchanted_amber` | `equip_apex_relic_ii` | 500 |

Rewards must be posted only after a uniquely identified successful completion
commits. Material and equipment identifiers are fictional candidates and do
not create a manifest, inventory record, or ledger.

Adventure rewards remain separate from weekly `$MARGEN` payouts. Adventure
completion may be a future qualifying Character XP source for Tower progression,
consistent with the vision, but its contribution to weekly `$MARGEN` reward
weight, snapshots, or payout allocation remains deferred and must not be
inferred from these examples.

### 3.6 Duplicate completion versus repeatable Adventures

- A duplicate completion request repeats the same Adventure run ID or
  completion idempotency key. It must return the original committed result and
  must not issue a second energy debit or reward.
- A new repeatable Adventure is a distinct run with a new run ID, new start,
  new cost, and separately validated availability. It may award the same
  candidate reward according to an approved repeatability rule.
- A failed or cancelled run must not be mistaken for a successful completion,
  and a retry must resolve the original run state rather than create an
  untracked second completion.

## 4. Unresolved decisions

The following remain open and require explicit design approval:

- whether 8 and 12 hours are final buffer hours or only calculator candidates;
- whether capacity is elapsed-time, whole-unit inventory, exact quantity, or a
  layered combination;
- whether existing fractional carry occupies quantity capacity;
- how overflow, full-capacity carry, inactive buildings, and cap resets work;
- authoritative clock, settlement frequency, and maintenance behavior;
- upgrade timing, production during upgrades, and old/new rule boundaries;
- the 100-energy cap and +10/hour regeneration values;
- initial energy, offline regeneration, and regeneration while capped;
- final Adventure duration/difficulty costs and availability limits;
- reservation versus immediate debit and failure/cancellation/refund policy;
- fictional reward tables, equipment rules, inventory capacity, and XP values;
- whether any Adventure reward qualifies for Character XP and under which rule
  version;
- all effects on `$MARGEN` reward weights, snapshots, payouts, and eligibility;
- duplicate/retry retention, idempotency scope, and completion audit history;
- account authentication, authorization, persistence, and transaction design.

## 5. Implementation boundary

This document is design-only. It authorizes no code, calculator changes,
Adventure service, route, database schema, migration, inventory mutation,
energy ledger, Character XP ledger, reward job, simulation, or test harness.

No storage limit, energy value, duration cost, fictional material, equipment,
XP reward, refund rule, or `$MARGEN` relationship in this document is adopted
by its inclusion here.
