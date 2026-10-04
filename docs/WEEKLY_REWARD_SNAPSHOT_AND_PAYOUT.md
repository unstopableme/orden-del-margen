# Weekly reward snapshot and pure payout contract

## Calendar

A weekly reward period starts Sunday at 00:00 UTC inclusive and ends the next
Sunday at 00:00 UTC exclusive. It lasts exactly seven days. Periods align to
those UTC boundaries and do not overlap. Active status is evaluated at query
time; it is not stored in a time-dependent generated column.

## Immutable snapshot

The future snapshot service must persist one immutable, versioned snapshot per
period before payout calculation. A validated calculator input contains:

- canonical `periodStart` and `periodEnd` UTC timestamps;
- `snapshotAt`, not earlier than `periodEnd`;
- snapshot identifier, schema version, policy version, and source revision;
- available weekly `$MARGEN` pool as a nonnegative decimal integer string;
- one record per confirmed participant, with a unique participant identifier;
- the participant's associations effective at the exclusive period end;
- the explicitly designated primary account effective for that period;
- that account's independently completed Tower level;
- deduplicated eligible mining-plot inputs and their time-weighted portfolio;
- the final nonnegative integer reward weight consumed by the pure calculator;
- exclusion reasons for accounts or participants omitted from allocation; and
- hashes or references sufficient to reproduce and audit the snapshot.

Unassociated accounts do not appear as payout participants and receive no
fallback or retroactive allocation. Association or primary-account changes after
the exclusive period end affect only later periods.

### Formula-to-integer weight boundary

The payout calculator consumes only canonical nonnegative integer weight
strings. It does not evaluate the fractional reward formula or convert its
result into an integer.

The deterministic formula-to-integer conversion remains a separate unresolved
snapshot requirement. A later decision must specify the decimal or fixed-point
representation, scale, exponent and logarithm precision, rounding mode,
implementation compatibility requirements, canonical serialization, and bounds.
No conversion parameters are adopted or implied by this contract or calculator.
Until those parameters are approved, a snapshot producer cannot claim that its
integer weights are authoritative payout inputs.

## Pure calculator

The pure calculator accepts only the available pool and unique participant
weight records from a previously validated snapshot. It performs no database,
clock, identity, eligibility, snapshot, or API work.

All pool, weight, allocation, and retained values use arbitrary-precision integer
arithmetic. For each participant, the uncapped allocation is the floor of
`pool * weight / totalWeight`. The cap is the floor of `pool * 5 / 100`.
Allocation is the lesser value. Zero-weight participants receive zero. If the
participant list is empty or total weight is zero, the full pool remains in the
Game Vault.

Fractional remainders, cap-clipped amounts, and every other undistributed unit
remain in the Game Vault; they are not redistributed. Therefore the sum of all
participant allocations plus the retained Game Vault balance equals the input
pool exactly.

## Integration boundary

Database snapshot creation, payout persistence, idempotency, locking, retries,
and any API are separate future work. No payout endpoint or production job is
authorized by this contract or by the pure calculator.
