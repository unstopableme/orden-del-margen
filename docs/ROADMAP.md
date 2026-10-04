# Orden del Margen roadmap

Dates and phases in this roadmap describe product direction, not guaranteed
delivery commitments. A checked item is present in the current demo; it does
not imply production readiness, legal approval, or an economic right.

## Current MVP: community loop

The current release validates whether members return to connect and
contribute. It remains community-first and does not create financial or legal
claims.

### Member identity

- [x] Member profile with display name, handle, bio, and role
- [x] User-controlled presence/status
- [ ] Persistent authentication and account recovery
- [ ] Member directory with privacy controls

### Community participation

- [x] Community membership model
- [x] Moderated announcement feed
- [x] Referral invitations
- [x] Member-owned profile topics
- [x] Points and badge progression
- [x] Community quests that award points when resolved
- [x] Knowledge-based PvP scoring
- [x] Non-monetary coffee appreciation gifts
- [ ] Events and participation check-ins
- [ ] Discussion threads and reporting

### Property context

- [x] Read-only property/community cards
- [x] Area, type, summary, and operations notes
- [ ] Maintenance request intake
- [ ] Property-specific resource library

## Next phase: trusted operations

- Persistent PostgreSQL repositories for community data
- Authentication, role-based authorization, and account recovery
- Moderation tools and an audit trail
- Maintenance requests, vendors, and completion tracking
- Notifications and an event calendar
- Member and community engagement analytics

## Future game foundation: Web2-first

The game foundation will establish the level-and-land design and baseline
economic loop before an on-chain launch.

Planned work includes:

- Players, Kingdom Tower levels, digital land, active mining plots, and ring
  scores
- A proposed authenticated-account identity model with optional proof-of-control
  links to multiple wallets and one-account uniqueness per supported wallet
  identity
- Solo and guild play, resource gathering, and battles
- Fixed-supply internal `$MARGEN` allocation accounting
- Weekly Game Vault distributions with eligibility unlocked by completing
  Kingdom Tower Level 3 on the designated primary progression account, subject
  to available allocation and the participant-level combined cap
- `$DONCELLA` Armory Chest access unlocked by completing Kingdom Tower Level 3
- A Level 3 gate requiring 4,500 lifetime Character XP, the authoritative
  account-level Tower progression counter, from Training
  Grounds, Arena Stage Victories, Bounty Board tasks, or completed Idle
  Expeditions/Adventures, excluding construction/building XP and community
  points
- Tier I-or-higher gear equipped in all six main-avatar slots for Level 3;
  inventory ownership alone does not qualify, XP and equipment are not
  consumed, and only specified `$DONCELLA` and material costs may be charged
- Locked Web3 vault balances for gameplay earnings
- `$DONCELLA` utility-asset gameplay, including currency costs and Resource
  Chest purchases; “Bronze currency” is the same asset, while Bronze plots are
  a distinct mining-land tier
- A free starter experience and proposed paid Season 1 chapter

Pet expeditions, guild raids, and leaderboard contributions are upgrades to
the level-and-land design, not prerequisites for the whole design. Each needs
explicit scoring rules or a separate reward budget before it can affect
payouts.

Listing completed Idle Expeditions/Adventures as a Character XP source does not
schedule or prioritize Adventure implementation. Failed Level 3 prerequisites
must leave Tower level and balances unchanged.
The full lifetime Character XP total remains available for future progression;
future Tower thresholds are undefined.

For weekly rewards, each confirmed participant designates one primary
progression account, which supplies the Kingdom Level multiplier and must
complete Tower Level 3. Secondary accounts provide no additional multiplier,
and the highest-level account is not selected automatically. Eligible
time-weighted mining-plot scores are aggregated once across associated holdings,
and the 5% cap applies to the participant's combined allocation. Pet
contributions remain deferred. Under the current confirmed rule, every
undistributed allocation, including a cap-clipped amount, remains in the Game
Vault and is not redistributed.

Unassociated accounts may play and progress but receive no weekly rewards,
fallback-pool allocation, or retroactive allocation. Each confirmed participant
explicitly designates one primary account. Accounts retain their own XP and
Tower progression, and a newly designated primary must independently complete
Tower Level 3. An approved switch activates at the next weekly boundary and is
limited to once per four weekly periods, except for separately authorized and
audited recovery exceptions. Verification evidence and approval criteria, the
switch approval procedure, recovery-exception criteria, and the exact calendar
boundary remain unresolved; Sunday 00:00 UTC is proposed. Device or IP
similarity alone cannot confirm an association, and wallet binding does not
prove that accounts belong to different people. No payout implementation exists.

Commercial proposals—including BTC chapter payments, a supporter bundle,
browser-native crypto purchases, internal burn-velocity pricing, and a Beta
Pioneer sale—require the unresolved product, custody, pricing, eligibility,
and legal decisions recorded in [DECISIONS.md](DECISIONS.md).

## Phase 0: Web3 preparation

Provisional target: late 2027–2028. This window is for preparation and is not
a guaranteed deployment date.

Planned areas:

- Select a public blockchain; Polygon is not yet confirmed
- Define and deploy official `$MARGEN` smart contracts
- Premint the fixed supply at on-chain launch
- Migrate Web2 balances without duplicate issuance
- Define public launch pools and DEX liquidity
- Add tradable NFTs for in-game pet cards and digital land
- Define unlocking, transfers, custody, and permitted uses

External exchange prices may differ from any internal price. The Web3 phase
must not imply that digital land or internal balances confer real-property
rights, shares, income entitlements, redemption, or guaranteed market value.

## Business exploration

Café de la Doncella plans to explore a farmer-partnered coffee agroforestry
carbon project in Colima, with possible expansion to other Mexican states.
Carbon-credit income is potential future revenue and is neither an assumed
operating budget nor a promised reward source.

## Explicitly outside the current MVP

- Strategy-game land, resources, guilds, and battles
- Token allocations, sales, purchases, burns, transfers, or unlocking
- Crypto deposits, payment processing, or custody
- Securities or share purchases
- Rent collection or financial accounts
- Legally consequential ownership/title records
- NFTs, blockchain contracts, public pools, or DEX liquidity

These systems require separate product, legal, security, and operational
decisions. Current points, badges, referrals, coffee gifts, knowledge scores,
and informational property cards must not represent cash value or ownership.
