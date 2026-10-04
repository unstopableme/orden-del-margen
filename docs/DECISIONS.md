# Design decision register

This register records product direction without presenting future work as
implemented or legally established. The current runtime remains the
community-first demo described in the [README](../README.md).

## Confirmed design direction

| Area | Decision | Status boundary |
| --- | --- | --- |
| Architecture | Establish the baseline economic loop Web2-first for performance and development speed. | Future game work; not in the community MVP. Regulatory stability is a goal, not a guarantee. |
| `$MARGEN` supply | Fix the initial supply at 100,000,000 with no gameplay minting. | Design decision, not an issued on-chain asset. |
| Web2 accounting | Reconcile all internal allocations and balances against the fixed supply. | Accounting design remains to be implemented. |
| On-chain migration | Premint at the later on-chain launch and prevent duplicate issuance during migration. | Detailed migration rules remain open. |
| Gameplay rewards | Pay from weekly pools within the Game Vault's available allocation. | Not implemented; scoring details listed below remain open. |
| Kingdom Tower Level 3 | Unlock eligibility for weekly `$MARGEN` distributions and access to `$DONCELLA` Armory Chests. | A distribution depends on qualified reward weight and the available weekly pool, is capped at 5% of the pool for the confirmed participant's combined allocation, and is not guaranteed. Eligibility does not confer an entitlement to company revenue. |
| Level 3 Character XP gate | Require at least 4,500 lifetime Character XP, the authoritative account-level Tower progression counter. Qualifying sources are Training Grounds, Arena Stage Victories, Bounty Board tasks, and completed Idle Expeditions/Adventures. | Construction/building XP and community points are excluded. An upgrade never deducts, burns, reserves, or resets XP; the full total remains available for future progression. Adventure eligibility does not determine implementation timing, and future Tower thresholds are undefined. |
| Level 3 equipment and cost boundary | Require Tier I-or-higher gear equipped in all six main-avatar slots: Weapon, Armor, Helmet, Boots, Ring, and Amulet. | Inventory ownership alone does not qualify, and equipment is not consumed. Only specified `$DONCELLA` and material costs may be consumed. Failed prerequisites leave Tower level and balances unchanged. |
| Reward weight | Use `KL^2.75 × [1 + 0.23 × ln(1 + Portfolio/10)]`. | Portfolio inputs and timing rules remain partly open. |
| Payout cap | Cap a confirmed participant's combined allocation at 5% of the available weekly pool. | Under the current confirmed rule, every undistributed allocation, including a cap-clipped amount, stays in the Game Vault and is not redistributed. No payout implementation exists. |
| Reward identity | Use one designated primary progression account per confirmed participant for the Kingdom Level multiplier; that account must complete Tower Level 3. | Secondary accounts add no Kingdom Level multiplier. Do not automatically select the highest-level account. Participant verification, unassociated-account eligibility, and primary-account switching remain unresolved. Device/IP similarity alone cannot confirm association. |
| Participant aggregation | Aggregate eligible time-weighted mining-plot scores once across associated holdings and apply the 5% weekly payout cap to the participant's combined allocation. | Duplicate attribution is prohibited. Pet contributions remain deferred, and undistributed tokens remain in the Game Vault. |
| Plot maturity | A fueled, active mining plot reaches full operational score after 96 active hours. | The accumulation curve is unresolved. |
| Ownership boundary | Keep `$MARGEN` ownership-related in the broader vision without assigning unresolved legal rights. | Internal balances and digital land confer no shares, income entitlement, redemption, or real-property rights. |
| Utility asset | Use `$DONCELLA` as the proposed utility asset earned through tasks, battles, and trade. | “Proposed” describes its role; implementation and detailed utility rules remain future work. |
| Currency naming | Treat “Bronze currency” as another name for `$DONCELLA`, not a separate resource; denominate currency costs and Resource Chest purchases in `$DONCELLA`. | The Bronze plot is a distinct mining-land tier. |
| Reference relationship | Use `1 $MARGEN = 1,000 $DONCELLA` as a reference. | It is not a guaranteed exchange rate. |
| Burns | Burn a defined portion of eligible `$MARGEN` spending and marketplace fees. | Rate and eligible transactions remain unresolved; burns do not promise price increases. |
| Earnings lock | Put gameplay earnings into a locked Web3 vault balance for gradual post-launch unlocking. | Schedule, transfers, and locked uses remain unresolved. |
| Community boundary | Preserve the current community MVP as non-monetary and informational. | No payments, custody, token sales, strategy game, ownership, or blockchain runtime behavior is added by these decisions. |

## Proposals under consideration

- Use the authenticated Web2 account as the primary game identity. Keep wallet
  linking optional, allow multiple proof-of-control wallet links per account,
  and permit each supported wallet identity to link to only one account.
- Use platform activity, developer treasury allocations, and in-game spending
  as pool-funding sources; revenue would not automatically become
  distributable `$MARGEN`.
- Direct revenue toward Beta Pioneers, the Game Vault, and LLC treasury
  reinvestment.
- Offer a free starter with the tutorial and enough quests to demonstrate the
  core loop.
- Sell a complete Season 1 story/learning chapter and missions at an $8.99
  equivalent, paid only in BTC.
- Later offer a supporter bundle of cosmetics or lore extras without an
  advantage in earning cashable rewards.
- Support browser-native `$MARGEN` purchases through direct crypto deposits.
- Start an internal purchase price at €0.10 and adjust it upward using a
  formula based exclusively on internal burn velocity.
- Run a pre-mint Beta Pioneer sale for early gamers who buy the book/chapter,
  test, report bugs, rate, and provide feedback.
- Treat pet expeditions, guild raids, and leaderboard contributions as future
  upgrades with explicit scoring or separate budgets.
- Prepare for official smart contracts, public launch pools, DEX liquidity,
  and tradable NFTs for pet cards and digital land in a later Web3 phase.
- Explore a farmer-partnered coffee agroforestry carbon project in Colima and
  potentially other Mexican states. Carbon-credit income is not an assumed
  budget or promised reward source.

## Unresolved decisions

### Rights, legal structure, and compliance

- Actual rights and legal structure of `$MARGEN`
- Ownership structure on the company side
- Jurisdiction, KYC and other compliance requirements
- Legally supportable descriptions of tokens, NFTs, ownership, and voting
- Trademark control and service-discontinuation terms

### Weekly scoring

- Final Bronze plot, Silver plot, and Gold plot ring scores; current estimated
  single-plot boosts are +28%, +51%, and +77%
- Shape of the 96-hour accumulation curve
- Weekly reset behavior
- Treatment of inactive or unfueled plots
- Time and method of the weekly scoring snapshot
- Scoring rules or separate budgets for pet expeditions, guild raids, and
  leaderboard contributions
- How participant identity and account associations are verified; wallet
  binding and device/IP similarity alone are insufficient
- Whether and how an unassociated account can qualify for weekly rewards
- No shared unassociated-account pool is adopted; eligibility must be decided
  without assuming `SUSPECT_UNASSOCIATED_POOL` or an equivalent catch-all group
- How a confirmed participant designates or switches the primary progression
  account, including timing and anti-abuse constraints
- Exact duplicate-attribution controls for mining assets linked through wallets
  or accounts

### Supply, burns, and unlocking

- Allocation of the fixed supply among internal and future launch pools
- Detailed Web2-to-chain reconciliation and migration procedure
- Burn rates and eligible spending or marketplace fees
- Unlock schedule for locked Web3 vault balances
- Transfer eligibility and permitted uses while locked
- Player voting, if any

### Funding and revenue

- Which proposed sources fund which pools
- Percentages directed to Beta Pioneers, the Game Vault, and LLC treasury
- Vesting rules
- Whether and under what conditions carbon-credit income affects budgets

### Pricing, purchases, and presale

- Internal burn-velocity pricing formula, measurement period, and adjustment
  limits
- Supported crypto assets and networks
- Custody arrangements and delivery terms
- Beta Pioneer presale price, allocation limits, eligibility, vesting, and
  delay or cancellation terms
- Whether purchases may improve reward-bearing progression
- Whether a book purchase, allocation purchase, and tester recognition will
  ever be bundled; they remain separate until explicitly decided

### Web3 launch

- Public blockchain selection, including whether to use Polygon
- Smart-contract design and audit requirements
- Public launch pool structure and DEX liquidity design
- NFT ownership and utility rules for pet cards and digital land
- Deployment timing; late 2027–2028 is a provisional preparation target, not
  a guaranteed launch window

## Interpretation rules

- “Confirmed” means project design direction, not implementation, legal
  approval, guaranteed value, or a promise to launch.
- Internal prices are not guaranteed resale, redemption, or market values.
- External exchange prices may differ from internal prices.
- A fixed supply, burn, reward, or locked balance does not create a guaranteed
  return.
- Missing details remain unresolved; this register does not fill them by
  assumption.
