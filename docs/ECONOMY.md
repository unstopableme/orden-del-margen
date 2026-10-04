# Economy design

This document separates confirmed project design direction from proposals and
unresolved details. “Confirmed” describes an intended design, not an
implemented feature, legally established right, promised return, or guarantee
of regulatory treatment.

None of these economic systems are part of the current community MVP. Current
points, badges, knowledge scores, referrals, and coffee gifts have no cash
value or ownership rights.

## Confirmed design direction

### Web2-first foundation

- Build the baseline economic loop with a Web2-first architecture for
  performance and development speed.
- Treat regulatory stability as a design goal, not a guaranteed outcome.
- Use a fixed initial supply of 100,000,000 `$MARGEN`; gameplay does not mint
  additional `$MARGEN`.
- During Web2, all internal allocations and balances must reconcile against
  the fixed supply.
- Premint the supply only at the later on-chain launch, with migration rules
  that prevent internal balances from being issued a second time.
- Distribute gameplay rewards from existing weekly allocations, limited by
  the Game Vault's available budget.

`$MARGEN` remains ownership-related in the broader vision, but its legal
structure and actual rights are unresolved. Internal balances and digital land
do not themselves confer shares, income entitlements, redemption rights, or
rights in real property.

### Utility asset

`$DONCELLA` is the proposed utility asset earned through tasks, battles, and
trade. “Bronze currency” is an alternate name for `$DONCELLA`, not a separate
currency or resource. All currency costs use `$DONCELLA`, including Resource
Chest purchases.

The Bronze plot remains a distinct mining-land tier; references to that tier
do not mean `$DONCELLA`. The relationship

```text
1 $MARGEN = 1,000 $DONCELLA
```

is a reference only. It is not a guaranteed exchange, redemption, resale, or
market rate.

## Weekly Game Vault rewards

### Confirmed reward identity policy

One designated primary progression account per confirmed participant supplies
the Kingdom Level multiplier and must complete Kingdom Tower Level 3. Secondary
accounts provide no additional Kingdom Level multiplier. The system must not
automatically choose the participant's highest-level account as primary.

Eligible time-weighted mining-plot scores are aggregated once across associated
holdings under the established activity rules. The 5% weekly payout cap applies
to the participant's combined allocation. Pet contributions remain deferred,
and any undistributed `$MARGEN` remains in the Game Vault.

Participant verification, unassociated-account eligibility, and rules for
switching the designated primary account remain unresolved. Device or IP
similarity alone is insufficient to establish a confirmed association.
Unassociated accounts are not automatically combined into a shared eligibility
or cap pool.

### Proposed wallet binding

The authenticated Web2 account is proposed as the primary game identity, with
optional links to multiple supported wallets after proof of control. Each
supported wallet identity could be linked to only one account. This uniqueness
constraint would prevent duplicate wallet binding, but would not establish that
different accounts belong to different people.

Wallet binding is not participant verification. If adopted, duplicate-
attribution controls must ensure that an eligible mining asset contributes only
once through all associated wallet and account paths.

### Kingdom Tower Level 3 gate

Level 3 requires at least 4,500 lifetime Character XP, the authoritative
account-level Tower progression counter. Qualifying sources are Training Grounds, Arena Stage Victories, Bounty
Board tasks, and completed Idle Expeditions/Adventures. Construction or
building XP and community points are excluded. Adventures being an eligible
XP source does not set their implementation timing.

The main avatar must have Tier I-or-higher gear equipped in all six slots:
Weapon, Armor, Helmet, Boots, Ring, and Amulet. Owning qualifying items in
inventory without equipping them does not satisfy the gate. XP and equipment
are prerequisites, not costs. An upgrade never deducts, burns, reserves, or
resets Character XP and does not consume equipment. The full lifetime XP total
remains available for future progression; only the specified `$DONCELLA` and
material costs may be consumed. Any failed prerequisite must leave Tower level
and balances unchanged. Thresholds for future Tower levels are undefined.

Completing Kingdom Tower Level 3 unlocks eligibility for weekly `$MARGEN`
distributions and access to `$DONCELLA` Armory Chests. Eligibility does not
guarantee a weekly payout or confer an entitlement to company revenue. For an
eligible confirmed participant, the qualified reward weight is:

```text
Weight = KL^2.75 × [1 + 0.23 × ln(1 + Portfolio/10)]
```

`KL` comes only from the designated primary progression account. `Portfolio`
is the cumulative time-weighted ring score of eligible active, fueled mining
plots aggregated once across associated holdings. A plot reaches its full
operational score after 96 active hours.

Each distribution depends on the participant's qualified reward weight and the
available weekly Game Vault pool, with a maximum combined allocation of 5% per
participant:

```text
Payout = min(
  available weekly pool × participant weight / sum of qualified participant weights,
  5% of available weekly pool
)
```

- Undistributed amounts remain in the Game Vault.
- If no players qualify, the full pool remains in the Game Vault.
- Estimated single-plot boosts are Bronze plot +28%, Silver plot +51%, and
  Gold plot +77%. These are estimates because final ring scores are unresolved.
- Multiple plot effects do not add directly; their scores combine within the
  logarithmic portfolio term.

The 96-hour accumulation curve, weekly reset behavior, treatment of inactive
plots, scoring snapshot, and final ring scores remain unresolved. No linear
curve or reset rule is assumed.

Pet expeditions, guild raids, and leaderboard contributions are future
upgrades. They cannot affect payouts until they have explicit scoring rules or
separate reward budgets.

## Supply reduction and locked balances

Confirmed direction:

- Eligible spending and marketplace fees will burn a defined portion of
  `$MARGEN`.
- Burns reduce supply; they do not automatically increase price or an internal
  reference value.
- Gameplay earnings initially enter a locked Web3 vault balance and unlock
  gradually after launch.

Unresolved details:

- Burn rates and which transactions are eligible
- Unlock schedule
- Transfer eligibility
- Permitted uses while balances are locked

## Pool funding and revenue destinations

The following are proposals, not finalized funding rules:

- Platform activity, developer treasury allocations, and in-game spending as
  sources for reward pools
- Revenue destinations for Beta Pioneers, the Game Vault, and LLC treasury
  reinvestment

Revenue does not automatically become distributable `$MARGEN`. Allocation
percentages and vesting remain unresolved.

## Commercial proposals

### Access and content

- Free starter with the tutorial and enough quests to experience the core loop
- Season 1 chapter priced at an $8.99 equivalent and paid only in BTC,
  containing a complete story/learning chapter and missions
- Later supporter bundle with cosmetics or lore extras and no advantage in
  earning cashable rewards

### Browser-native purchases

Direct crypto deposits for browser-native `$MARGEN` purchases are proposed.
Supported assets, networks, custody arrangements, and delivery terms remain
unresolved.

An internal purchase price starting at €0.10 and increasing through a formula
based exclusively on internal burn velocity is proposed. The formula,
measurement period, and adjustment limits are unresolved. An internal price
does not guarantee resale, redemption, or future market value, and external
exchange prices may differ.

### Beta Pioneers

A pre-mint Beta Pioneer sale is proposed for early gamers who buy the
book/chapter, test the game, report bugs, rate it, and provide feedback.

Book purchase, token-allocation purchase, and tester recognition remain
separate unless a bundle is explicitly defined. Presale price, allocation
limits, eligibility, vesting, and delay or cancellation terms are unresolved.
Whether purchases may improve reward-bearing progression is also unresolved.

## Business context

Café de la Doncella plans to explore a farmer-partnered coffee agroforestry
carbon project in Colima, with possible expansion to other Mexican states.
Carbon-credit income is potential future revenue, not an assumed operating
budget or a promised reward source.

## Boundaries

- Digital land and internal balances do not grant real-property rights.
- Playing the game does not make a player a shareholder.
- Revenue is not automatically a token allocation or player distribution.
- Supply reduction does not promise price appreciation.
- Preparation for an on-chain launch does not guarantee a launch date,
  exchange listing, liquidity, market value, or regulatory outcome.
