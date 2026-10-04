# Deterministic reward-weight conversion

## Status and boundary

This document proposes conversion contract `reward-weight-v1` for explicit
approval. Its scale, rounding, canonical inputs, evaluation rules, and resource
limits are not adopted by this document. If approved, it would determine how the
adopted fractional reward formula becomes the canonical integer weight consumed
by the pure weekly allocator.

This contract does not generate snapshots, decide eligibility, calculate mining
activity, persist data, schedule payouts, or expose an API. A future snapshot
producer must implement this contract and store its inputs, output, algorithm
identifier, and reproducibility metadata.

## Canonical inputs

The proposed converter accepts:

- `kingdomLevel`: a canonical positive decimal integer string; and
- `portfolioNumerator` and `portfolioDenominator`: canonical decimal integer
  strings representing the exact nonnegative rational Portfolio score in ring-
  score units.

The denominator must be positive. The numerator and denominator must be reduced
to lowest terms, with zero represented only as `0/1`. Leading zeroes, signs,
decimal points, exponent notation, binary floating-point values, and unreduced
fractions are rejected.

Defining how eligible mining events produce the exact Portfolio rational is part
of future snapshot generation and is not defined here. The converter must never
reconstruct Portfolio from a rounded decimal or JavaScript `Number`.

## Exact formula

Interpret all constants as exact rational values:

```text
KL exponent = 11/4
portfolio divisor = 10
logarithmic coefficient = 23/100

formulaWeight = KL^(11/4) × [1 + (23/100) × ln(1 + Portfolio/10)]
```

`ln` is the natural logarithm of the exact positive real argument. Implementations
must not substitute base-10 logarithms or binary floating-point approximations.

## Integer scale and rounding

The proposed canonical integer scale is exactly `10^12` weight units per
formula-weight unit. The proposed output is:

```text
integerWeight = floor(formulaWeight × 10^12)
```

Floor is toward negative infinity; because valid weights are positive, this is
equivalent to truncating the exact positive real result. No intermediate value
is rounded to the output scale. The scale, formula, and rounding rule are part
of `reward-weight-v1` and may change only under a new version identifier.

## Deterministic evaluation requirement

A compliant implementation must establish the correctly floored mathematical
result. It may use arbitrary-precision interval arithmetic or another method
that produces proven rational lower and upper bounds, subject to these rules:

1. Arithmetic starts from exact integer and reduced rational inputs. Each input
   begins as the degenerate interval whose lower and upper bounds equal that
   exact value.
2. Integer powers are calculated exactly. Addition, subtraction,
   multiplication, division, multiplication by the exact `23/100` coefficient,
   addition of the exact `1`, and final multiplication by `10^12` all propagate
   rational interval endpoints with outward rounding. Division additionally
   proves that the denominator interval excludes zero.
3. Fourth-root and natural-logarithm operations produce certified enclosing
   rational bounds. Monotonicity is applied only after proving the operand lies
   in the operation's valid domain. A rounded root or logarithm is never treated
   as exact.
4. The bounds enclose the complete scaled formula result, not merely each
   transcendental subexpression in isolation. Before returning `n`, the
   implementation proves both `n <= lowerBound` and `upperBound < n + 1`.
   Equivalently, both bounds imply the same floored integer.
5. Precision increases until that proof succeeds. An implementation may not
   return while the interval spans two candidate integers.
6. Before interval refinement, an exact-boundary path attempts symbolic or exact
   integer proof. For every zero-Portfolio input, calculate
   `floorFourthRoot(KL^11 × (10^12)^4)` with integer arithmetic; this directly
   proves the correct floor even when the scaled result is an exact integer. For
   any other case where interval bounds converge on an integer boundary, return
   only after a certified exact equality or strict-side proof; otherwise fail
   explicitly rather than choosing either adjacent integer.
7. If resource limits prevent proof, conversion fails with
   `WEIGHT_RESOURCE_LIMIT`. It must never
   select the nearest candidate or fall back to `Math.pow`, `Math.log`, or other
   platform floating-point functions.

This result definition is independent of programming language, CPU, locale,
runtime version, and database numeric settings. A future implementation must
publish cross-language conformance vectors before snapshot generation is
enabled.

## Proposed input and resource limits

These limits are part of the proposal and require approval with the other
`reward-weight-v1` parameters:

- `kingdomLevel` is between `1` and `1000000000` inclusive;
- `portfolioNumerator` and `portfolioDenominator` contain at most 256 decimal
  digits each before reduction validation;
- interval evaluation starts at 256 bits of precision and doubles through a
  maximum of 65,536 bits;
- no more than nine precision attempts are permitted (`256` through `65536`);
- any series-based root or logarithm implementation may consume at most
  1,000,000 terms across one conversion; and
- exceeding an input or computation limit returns a typed failure and produces
  no integer weight.

Limits are checked before or during evaluation using exact counters. Wall-clock
timeouts may stop work defensively but must not cause a candidate weight to be
returned.

## Canonical output and snapshot metadata

The output is one canonical positive decimal integer string with no leading
zeroes. A future immutable snapshot record must retain at least:

- `weightAlgorithm = "reward-weight-v1"`;
- the three canonical input strings;
- the canonical integer output;
- the exact source records used to construct Portfolio or their immutable hash;
  and
- the implementation build identifier and conformance-vector version.

The snapshot must reject duplicate participants, noncanonical inputs, a missing
algorithm identifier, or a stored integer that does not reproduce from the
stored inputs.

## Exact conformance anchors

These zero-Portfolio cases are exact and do not depend on approximation. Their
expected values must also be verified by an independent exact-integer script in
the future conformance suite rather than copied from the implementation under
test:

| Kingdom Level | Portfolio | Scale | Integer weight |
| ---: | ---: | ---: | ---: |
| `1` | `0/1` | `10^12` | `1000000000000` |
| `3` | `0/1` | `10^12` | `20515563512592` |
| `16` | `0/1` | `10^12` | `2048000000000000` |
| `81` | `0/1` | `10^12` | `177147000000000000` |

For the Kingdom Level 3 anchor, let `w = 20515563512592`. Exact `BigInt`
arithmetic verifies:

```text
w^4 <= 3^11 × 10^48 < (w + 1)^4
```

The left inequality is strict, so the fourth root is not an integer. The two
inequalities nevertheless prove exactly that `w` is the floor of the fourth
root. The integer fourth-root algorithm therefore provides a complete proof for
this non-integer zero-Portfolio case without floating-point approximation.

Future implementation work must add nonzero-Portfolio vectors produced by an
independent high-precision reference and test invalid canonical forms, precision
escalation, exact boundaries, large inputs, and explicit resource-limit failure.

## Pending work

- Define the authoritative event-to-Portfolio rational construction.
- Implement and independently review the interval evaluator.
- Publish nonzero conformance vectors and direct tests.
- Integrate conversion into immutable snapshot generation.
- Add database persistence, scheduled payout execution, and APIs separately.
