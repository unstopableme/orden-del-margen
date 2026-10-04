# Orden del Margen — Project Vision

## Purpose

Orden del Margen connects community participation with a separate
land-and-guild strategy game. Its long-term business vision includes
funding real property purchases through Café de la Doncella LLC.

This game is separate from Echoes of Ash.

## Long-term business vision

Café de la Doncella plans to use profits from book sales, café sales,
paid memberships, and the game to fund real property purchases.

The company also plans to explore a farmer-partnered coffee agroforestry
carbon project in Colima, with possible expansion to other Mexican states.
Carbon-credit income is potential future revenue, not an assumed operating
budget or a promised source of player rewards.

Real property ownership and shareholder economic rights belong to
the company side. The exact ownership structure remains to be defined.
Playing the game does not make someone a shareholder.

## Game vision

Players can play solo or form guilds to acquire digital land,
gather resources, grow stronger, and battle other players or guilds.

The central theme is collective action against concentrated wealth
and the exploitation of land and resources. Detailed rules for
acquisition, cooperation, resource use, and combat remain to be designed.

The confirmed design direction is to build the baseline economic loop with
a Web2-first architecture for performance and development speed. Regulatory
stability is a goal, not a guaranteed outcome. A later Web3 phase may add
public blockchain assets, but it is not part of the current implementation.

The broader design includes a fixed initial supply of 100,000,000 `$MARGEN`
with no gameplay minting. `$MARGEN` remains ownership-related in the vision,
but its actual rights and legal structure are unresolved. `$DONCELLA` is the
proposed game utility asset earned through tasks, battles, and trade. “Bronze
currency” is another name for `$DONCELLA`, not a separate resource. Currency
costs, including Resource Chest purchases, are denominated in `$DONCELLA`.
This naming does not affect the distinct Bronze plot mining-land tier. The
reference relationship of 1 `$MARGEN` to 1,000 `$DONCELLA` is not a guaranteed
exchange rate.

Kingdom Tower Level 3 requires at least 4,500 lifetime Character XP, the
authoritative account-level Tower progression counter. Character XP may come from Training
Grounds, Arena Stage Victories, Bounty Board tasks, and completed Idle
Expeditions/Adventures. Construction or building XP and community points do not
qualify. Naming Adventures as a qualifying source does not determine when that
feature will be implemented; only completed eligible activities can award XP.

The Level 3 equipment gate requires Tier I-or-higher gear equipped in all six
main-avatar slots: Weapon, Armor, Helmet, Boots, Ring, and Amulet. Inventory
ownership alone is insufficient. Character XP and equipped gear are
prerequisites, not upgrade costs. An upgrade never deducts, burns, reserves, or
resets Character XP and does not consume equipment; the full lifetime XP total
remains available for future progression. Only the specified `$DONCELLA` and
material costs may be consumed. A failed prerequisite check must leave the
Tower level and all balances unchanged. Thresholds for later Tower levels are
undefined.

See [Economy](ECONOMY.md) for reward mechanics and commercial proposals,
[Roadmap](ROADMAP.md) for delivery phases, and the
[Decision register](DECISIONS.md) for confirmed and unresolved decisions.

## Digital land boundary

Digital land is a game asset. It grants no ownership, shareholder
status, income entitlement, or other economic rights in real property.

Game revenue may contribute to business profits that separately
fund property purchases. Digital land acquisition does not transfer
real property rights.

Internal `$MARGEN` balances during the Web2 phase likewise do not establish
shares, income entitlements, redemption rights, or real-property rights.

Game land records and internal real property records must remain
separate, with distinct permissions.

## Current implementation

The current demo includes member profiles and status, community
memberships, announcements, referrals, quests, internal points,
knowledge challenges, and non-monetary coffee appreciation gifts.

Community demo data is stored in memory. PostgreSQL migrations and
some internal property backend foundations also exist.

The API starts in community demo mode without PostgreSQL configuration.
When DATABASE_URL is configured, startup runs database migrations
and enables internal property routes. Community interactions still
use in-memory data in both modes.

Digital land acquisition, guilds, resource competition, and land
battles are future features. Existing knowledge challenges do not
implement the planned strategy game.

Token purchases, token sales, crypto deposits, locked Web3 balances,
marketplace burns, and on-chain assets are also future design work and are
not capabilities of the community demo.

The community demo does not process payments, custody funds,
execute share purchases, or establish legal property ownership.
Its points and coffee gifts have no cash value or ownership rights.

## Development tracks

1. Shared foundation: documentation, accounts, permissions,
   and database infrastructure.
2. Community: profiles, announcements, invitations,
   and participation.
3. Game: players, digital land, guilds, resources, and battles.
4. Internal business operations: business revenue records,
   property acquisition, portfolio management, and maintenance.
5. Web3 preparation: network selection, contracts, migration rules,
   launch pools, liquidity, and tradable game assets after the Web2 baseline.

These tracks may share infrastructure without sharing ownership
rules or access permissions.

## Confirmed reward identity policy

Each confirmed participant designates one primary progression account. That
account supplies the Kingdom Level multiplier and must complete Kingdom Tower
Level 3 for the participant to qualify. Secondary accounts supply no additional
Kingdom Level multiplier, and the system must not automatically choose the
highest-level account as primary.

Eligible time-weighted mining-plot scores are aggregated once across the
participant's associated holdings. The 5% weekly payout cap applies to the
participant's combined allocation, not separately to each associated account.
Pet contributions remain deferred. Under the current confirmed rule, every
undistributed `$MARGEN` allocation, including an amount clipped by the 5% cap,
remains in the Game Vault and is not redistributed.

Unassociated accounts may play and retain account-specific progression but
receive no weekly rewards, fallback-pool allocation, or retroactive allocation.
Each confirmed participant explicitly designates one primary account. Accounts
retain their own XP and Tower progression, and a newly designated primary must
independently complete Tower Level 3. An approved switch activates at the next
weekly boundary and is limited to once per four weekly periods, except for
separately authorized and audited recovery exceptions. Verification evidence
and recovery procedures remain proposed and require explicit approval. Weekly
periods run from Sunday 00:00 UTC inclusive to the following Sunday 00:00 UTC
exclusive. Evidence and approval criteria, reviewer authority, recovery
criteria, identity-provider selection, assurance profiles, and restricted-
evidence retention remain unresolved. Device or IP similarity alone must not
establish a confirmed association. A pure payout calculator exists; snapshot
persistence, payout storage, scheduled execution, and an API do not.

The later participant-review service must restrict case approval and reversal
to authorized reviewers while allowing players to appeal cases involving their
own accounts. Approval requires reviewed evidence and a recorded reason; device
or IP similarity alone is never sufficient. Appeals request reconsideration and
preserve the original decision. Confirmed participant associations are created
through a separate audited operation, and case-history events are immutable to
the application role.

## Open proposals

The authenticated Web2 account is proposed as the primary game identity. Wallet
linking would remain optional: an account could link multiple supported wallets
after proof of control, while each supported wallet identity could link to only
one account. Wallet binding would not prove that separate accounts belong to
separate people and cannot by itself confirm a participant association.

The use of a public blockchain is planned for a later phase, but the network,
including Polygon, remains unconfirmed. Tradable NFTs for pet cards and
digital land, public launch pools, DEX liquidity, and player voting remain
proposals rather than finalized mechanics.

The `$MARGEN` initial supply and no-gameplay-minting rule are confirmed design
direction. Allocation percentages, distribution, vesting, burn rates,
unlocking, transfer eligibility, pricing, migration details, and legal rights
are not finalized.

Claims about legal safety, KYC requirements, NFT ownership,
jurisdiction, trademark control, and service discontinuation
remain unverified and must not be presented as established facts.
