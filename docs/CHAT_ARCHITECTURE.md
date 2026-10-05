Chat Architecture Specification

Project: Orden del Margen
Document: Chat / Communication Architecture
Status: Design Specification --- Not Authorized for Implementation
Scope: Future communication and chat architecture
Last Updated: 2026-10-05

1. Purpose

This document defines the intended architecture and behavioral
boundaries for the future communication system in Orden del Margen.

The system is intended to support real-time and asynchronous
communication across multiple channel types while remaining independent
from game-state authority, progression, rewards, property ownership, and
other economically or competitively sensitive systems.

This document is an architectural specification only.

It does not authorize implementation of:

WebSocket infrastructure

Redis infrastructure

PostgreSQL migrations

Chat routes

Authentication

RBAC middleware

Moderation workers

AI queues

Guild tables

Forum tables

Message persistence

Real-time delivery

Production deployment

Implementation must be separately authorized after the design is
reviewed.

2. Architectural Goal

The desired real-time architecture is:

Player Client A
       │
       │ Persistent WebSocket
       ▼
WebSocket Gateway Node 1
       │
       │ Redis Pub/Sub
       ▼
Redis Pub/Sub & Cache
       ▲
       │ Redis Pub/Sub
       │
WebSocket Gateway Node 2
       ▲
       │ Persistent WebSocket
       │
Player Client B

WebSocket Gateway Nodes
       │
       │ Asynchronous durable persistence
       ▼
PostgreSQL Chat History

The WebSocket gateway layer provides client connectivity and
authorization.

Redis provides real-time message distribution between gateway nodes and
short-lived/cache functionality.

PostgreSQL is the durable source of truth for persisted chat history.

Redis Pub/Sub must not be treated as durable message storage.

3. Core Architectural Principle

Communication is a shared infrastructure layer.

Different communication experiences should use the same underlying
channel/message architecture rather than implementing independent
messaging systems.

Conceptually:

Authenticated Account
        │
        ▼
Communication Identity / Policy
        │
        ├── World Chat
        ├── AI Chat
        ├── Guild Chat
        ├── Forum
        ├── Glitch Chat
        ├── Trade
        ├── Help
        ├── Party
        ├── Direct Messages
        └── System Alerts

The communication system must remain separate from the game-authority
layer.

A chat message must never directly establish or modify:

Property ownership

Real-world acquisition state

Payments

Securities

Custody

Tower eligibility

Rewards

XP

Inventory

Guild game-state

Other authoritative game state

A message may communicate an action or request, but the actual game
action must be authorized and recorded by the appropriate game service.

4. Identity Boundaries

The future communication system should use an authenticated account as
the primary communication identity.

The architecture should distinguish:

Authenticated Account
        │
        ├── Communication Identity
        │
        └── Participant Association
                │
                └── Primary Progression Account

Communication identity and reward/progression identity are related but
separate concerns.

An authenticated account should be capable of communicating even when it
is not eligible for rewards.

The current community_members records must not be treated as the
future authenticated account system.

The current repository has no production end-user authentication system.
Future implementation must derive the authenticated account from a
verified authentication mechanism rather than trusting arbitrary
memberId, senderId, or similar client-supplied identifiers.

5. Channel Identity

A channel is a uniquely identified, scoped communication context bounded
by an explicit access policy.

Each channel should have an immutable identity.

Channel names and other presentation properties may change without
changing the channel's underlying identity.

5.1 Static System Channels

System channels are permanently created by developers or controlled
seeding/bootstrap processes.

Examples:

Global / World

Trade

Help

System Alert

5.2 Dynamic Channels

Dynamic channels are associated with the lifecycle of another domain
object.

Examples:

Guild

Party

Direct Message

Alliance

Future event or game-object channels

Dynamic channels should be created by the system when the corresponding
domain object is successfully created.

Their lifecycle should follow the relevant domain object without making
the communication system the authority over that object.

6. Channel Access Control

Authorization is enforced at the API/WebSocket gateway boundary.

Clients must not be trusted to enforce channel permissions themselves.

The initial conceptual RBAC matrix is:

Channel Type            Join / Read             Send

Global / Help           All authenticated       All authenticated
players                 players, subject to
throttling

Trade                   All authenticated       Players satisfying
players                 anti-spam requirements

Guild / Alliance        Valid members of the    Active members, subject
matching entity         to guild rank
permissions

Party                   Current active party    Current active party
members                 members

Direct Message          Only the two            Only the two
participants            participants

The exact roles, thresholds, and permission names remain subject to
implementation design.

Example Trade anti-spam requirements may include:

Account age greater than 24 hours

Character level greater than 5

Other future anti-abuse requirements

These values are design examples and must not be treated as production
constants without separate approval.

7. Channel Types

The architecture must support at least these product requirements:

7.1 World Chat

General in-game communication available to authenticated players.

World Chat may contain logical system channels such as:

Global

Help

Trade

These may share infrastructure while retaining separate channel
identities and policies.

7.2 AI Chat

Communication between a player and an AI-controlled entity, assistant,
NPC, oracle, or other future AI service.

AI Chat must not require every AI response to execute synchronously
inside the main WebSocket request loop.

Expected architecture:

Player
  │
  ▼
WebSocket Gateway
  │
  ▼
AI Message Queue
  │
  ▼
AI / Rule Engine
  │
  ▼
Player-specific response event
  │
  ▼
WebSocket Gateway
  │
  ▼
Player

A queueing mechanism such as BullMQ, RabbitMQ, or another approved
asynchronous system may eventually be used.

No specific queue technology is mandated by this document.

AI Chat should use isolated player-specific response events rather than
global broadcast behavior.

7.3 Guild Chat

Guild Chat is a communication channel whose access depends on future
Guild membership and Guild permissions.

Guilds are currently a future game concept.

The repository currently has:

No Guild implementation

No Guild tables

No Guild models

No Guild routes

No Guild membership system

No Guild roles

No Guild permissions

Therefore Guild Chat must not be implemented by treating current
Community membership as Guild membership.

Future Guild Chat access should be derived from the authoritative Guild
domain.

7.4 Forum

Forum communication is asynchronous and persistent.

Forum posts should be a related but separate persistence model from
real-time chat messages.

Forum-specific requirements may include:

Threads

Parent/child relationships

Titles

Markdown or rich-text content

Sticky/pinned posts

Upvotes

View counters

Deep historical retrieval

Real-time chat and forum persistence should not be forced into a single
table merely for conceptual similarity.

7.5 Glitch Chat

Glitch Chat is a specialized future system.

Two possible meanings have been identified:

Gameplay Mechanic

A lore/gameplay effect may distort outgoing communication.

Examples:

Character substitution

Random symbol insertion

Partial text scrambling

Zone-specific distortion

Debuff-specific distortion

Other controlled visual effects

The distortion should be a gameplay presentation/effect and must not
corrupt the authoritative original message.

System Failure / Degraded Mode

Glitch behavior could alternatively describe a controlled degraded
communication state when infrastructure loses synchronization.

In this case, clients may enter a throttled/disconnected visual mode
rather than allowing a communication failure to destabilize the core
game server.

The final meaning of Glitch Chat must be selected before implementation.

8. Message Lifecycle

8.1 Messages Are Immutable

Messages must not be editable after creation.

Reasons:

Simplifies client synchronization

Simplifies moderation auditing

Prevents historical context from being rewritten

Reduces harassment abuse

Reduces potential market-manipulation/scam scenarios

If a player wants to correct a message, the expected mechanism is a new
message.

9. Message Deletion / Moderation

Messages should use soft deletion.

True database deletion should not be the normal moderation mechanism
because it destroys audit evidence.

A future implementation may use fields conceptually similar to:

is_visible
moderated_at
moderated_by
moderation_reason

The exact schema is not approved by this document.

9.1 Player View

When a moderator removes a message, a WebSocket event may notify
connected clients:

MESSAGE_DELETE
{
    message_id: ...
}

The client replaces the visible message with:

This message has been removed by a moderator.

9.2 Database View

The original message content remains available to authorized
security/moderation personnel subject to the project's privacy,
access-control, and retention policies.

10. Reporting and Moderation

A player report should identify the message and a reason code.

A future moderation pipeline may copy:

Message ID

Original message text

Sender identity

Channel identity

Relevant account metadata

Surrounding message context

into a moderation queue.

The initial proposed context window is the surrounding five messages.

This is a design target, not an implementation requirement.

10.1 Automatic Escalation

A future automated system may trigger temporary restrictions when abuse
thresholds are reached.

Example:

5 distinct reports
within 10 minutes
        │
        ▼
Temporary global chat mute
        │
        ▼
Human GM review

Thresholds and automatic sanctions must be configurable and approved
before production use.

Automated moderation must not permanently punish an account solely on an
unreviewed report threshold.

11. Retention

Chat data should use a tiered retention strategy.

11.1 Hot / Real-Time Layer

Redis and fast database indexes may support recent-message retrieval and
live UI loading.

For high-volume channels such as:

Global

Trade

Help

the real-time UI may maintain a rolling recent-message window of
approximately 50--100 messages.

This cache is not the authoritative history.

11.2 Durable Layer

PostgreSQL stores durable chat history according to the approved
persistence policy.

11.3 Archive / Cold Storage

Older records may eventually be moved into archive storage.

A proposed retention period is approximately 30--90 days, with
exceptions for records associated with active moderation/security
investigations.

The exact retention period, anonymization rules, legal requirements, and
deletion process must be approved before implementation.

12. Real-Time Delivery

The WebSocket gateway is responsible for:

Authenticating the connection

Establishing the communication identity

Authorizing channel access

Validating message submissions

Applying rate limits

Publishing authorized messages

Receiving messages from Redis

Delivering messages to connected clients

Emitting moderation events

Handling connection lifecycle

Multiple gateway nodes must be able to serve the same logical channels.

Redis Pub/Sub provides cross-node distribution.

Example:

Client A
   │
   ▼
Gateway 1
   │
   ▼
Redis Channel / Room Topic
   │
   ├───────────────┐
   ▼               ▼
Gateway 1       Gateway 2
                   │
                   ▼
                Client B

13. Persistence

PostgreSQL is the durable source of truth for chat history.

The desired architecture allows gateway nodes to perform asynchronous
batch writes.

Conceptually:

Gateway
   │
   ▼
Durable Persistence Pipeline
   │
   ▼
PostgreSQL

Redis Pub/Sub itself must not be considered a durable queue.

If asynchronous persistence is used, the eventual implementation must
define failure handling so that a message that has been accepted and/or
delivered is not silently lost because a gateway process crashes.

Possible future approaches include:

Redis Streams

Outbox pattern

Dedicated durable message queue

Another explicitly approved persistence mechanism

No specific technology is mandated yet.

14. Guild Lifecycle

Guilds are a future game domain and are currently not implemented.

When a Guild is eventually dissolved:

Its Guild Chat room should no longer accept normal new messages.

The room may transition to an archived state.

Active subscribers should be removed from the live channel.

Historical messages should remain available according to retention
policy unless separately authorized for removal.

The communication system must not decide whether a Guild itself is
valid, dissolved, transferred, or owned.

That decision belongs to the authoritative Guild service/domain.

15. Guild Rename and Ownership Transfer

Guild Chat history must survive:

Guild renames

Guild leadership changes

Ownership transfers

Other non-destructive Guild metadata changes

This is achieved by referencing immutable identifiers.

Conceptually:

Guild
  guild_id = immutable
  name = mutable

Guild Chat Room
  room_id = immutable
  guild_id = stable reference

Message
  message_id = immutable
  room_id = stable reference

The guild name must never be used as the primary identity of a chat
room.

16. Direct Messages

Direct Messages are private channels automatically initialized when a
player initiates a private conversation.

Authorization must be enforced server-side.

Only the two explicitly associated accounts may:

Read

Send

The server should derive the authenticated sender from the authenticated
session/token.

Clients must not be able to impersonate another account by submitting an
arbitrary sender ID.

Private-message access for authorized moderation/security personnel
remains subject to the project's final privacy and moderation policy.

17. System Alerts

System Alert channels are read-only for ordinary players.

Messages may be generated by:

Authorized system event runners

Game Masters

Administrators

Approved automated webhooks/services

Ordinary clients must never be able to submit System Alert messages.

18. Administrative / GM Authority

Game Administrators and designated Game Masters may eventually have
global administrative privileges.

Subject to the final security model, authorized administrative accounts
may be able to:

Inspect moderation records

Remove messages

Temporarily mute accounts

Eject players from channels

Apply channel restrictions

Override certain channel-level moderation states

Investigate flagged private-channel activity when explicitly
authorized

Administrative privileges must be enforced server-side.

A client-visible role indicator is never sufficient authorization.

Administrative actions must be auditable.

19. Community vs Guild

The current repository contains a Community MVP.

Community entities are not Guilds.

Community currently represents social/community participation such as:

Community profiles

Community memberships

Announcements

Referrals

Quests

Points

Knowledge challenges

Coffee gifts

Guilds belong to a future Game track.

The system must not:

Treat Community membership as Guild membership

Infer Guild permissions from Community membership

Convert existing Community records into Guild records without an
explicit migration/design decision

Shared infrastructure is acceptable, but the domain permissions remain
separate.

20. Faction vs Guild

Faction and Guild are distinct concepts.

Factions are proposed character-level alignment/narrative metadata.

Guilds are future player-organized game groups.

Faction selection must not automatically establish:

Guild membership

Community membership

Reward eligibility

Chat permissions

Any future relationship between factions and guilds requires an explicit
game-design decision.

21. Relationship to Participant / Rewards

Guilds and chat must not become the source of truth for participant
rewards or progression.

Conceptually:

Authenticated Account
        │
        ├── Communication
        │      ├── World
        │      ├── AI
        │      ├── Guild
        │      ├── Forum
        │      └── Glitch
        │
        └── Participant Association
               │
               └── Primary Progression Account
                      │
                      └── Rewards / Tower / Progression

Chat may discuss rewards, Guild activity, properties, battles, or other
game actions.

Chat messages must not themselves grant or modify those things.

22. Current Repository Reality

The current repository does not implement this architecture.

Current findings:

No production end-user authentication system

No WebSocket gateway

No Redis infrastructure

No chat tables

No chat migrations

No chat models

No chat repositories

No chat routes

No message persistence

No Forum system

No Guild system

No Guild membership system

No AI messaging queue

No Glitch Chat implementation

The current Community implementation is primarily in-memory.

The current repository's Community schema is not a chat schema.

Therefore this document describes the intended future architecture
rather than the current runtime.

23. Non-Goals

This architecture document does not define:

Password/authentication implementation

Identity provider selection

JWT/session implementation

Exact RBAC role names

Exact Guild game mechanics

Guild creation rules

Guild ownership rules

Guild treasury rules

Guild rank hierarchy

Guild progression

Guild combat rules

Party game mechanics

Faction mechanics

AI model selection

AI prompt design

Redis cluster topology

PostgreSQL deployment topology

WebSocket library selection

Queue technology selection

Exact database schema

Exact retention duration

Legal/privacy policy

Production moderation staffing

These require separate design decisions.

24. Implementation Safety Boundary

Until this document is explicitly approved for implementation,
developers and coding assistants must not:

Create chat database migrations.

Create chat_rooms or equivalent tables.

Create chat_messages or equivalent tables.

Add Redis dependencies.

Add WebSocket dependencies.

Add WebSocket routes or servers.

Add chat REST endpoints.

Add authentication middleware.

Add Guild tables.

Add Forum tables.

Add AI queues.

Add moderation workers.

Modify Community membership to behave as Guild membership.

Treat community_members as authenticated accounts.

Make chat messages authoritative for game-state changes.

Stage or commit implementation changes as part of this design task.

Implementation should begin only after the architecture is reviewed and
the relevant implementation scope is explicitly authorized.

25. Recommended Future Implementation Sequence

When implementation is eventually authorized, the preferred sequence for the
broad future architecture is:

1. Authentication / Account Identity
            │
            ▼
2. Communication Identity + Authorization Boundary
            │
            ▼
3. Channel / Room Domain Model
            │
            ▼
4. Message Persistence Model
            │
            ▼
5. Moderation / Reporting Model
            │
            ▼
6. WebSocket Gateway
            │
            ▼
7. Redis Cross-Node Distribution
            │
            ▼
8. Durable Async Persistence
            │
            ▼
9. World / Help / Trade
            │
            ▼
10. Direct Messages
            │
            ▼
11. Forum
            │
            ▼
12. Guild Chat after Guild Domain Exists
            │
            ▼
13. AI Chat
            │
            ▼
14. Glitch Chat

The exact sequence may change after detailed implementation planning. The
initial-release proposal in section 25A has precedence over this broad future
sequence: its one-gateway, direct-PostgreSQL, single-Community-channel scope
does not require Redis, multi-node delivery, or World/Help/Trade expansion.

25A. Proposed Initial Release and Message Semantics

The following amendments are proposals for review only. They do not adopt
these rules, authorize implementation, authorize migrations, or change the
implementation safety boundary in section 24.

Initial release scope:

- Provide one authenticated community text channel.
- Use one gateway with direct PostgreSQL persistence for this release. Redis
  and multi-node gateway scaling are deferred and are not requirements for the
  initial channel.
- Defer World/Help/Trade expansion, direct messages, Guild Chat, Party Chat,
  Alliance Chat, Forum, AI Chat, and Glitch Chat.
- Permit access for authenticated accounts that hold the channel's explicit
  permission. Reward-participant verification is not required for this
  communication channel and must not be inferred from channel access.
- Preserve the distinction between Community, Guild, Faction, Participant,
  authenticated Account, and game-authority domains.
- Do not treat community membership as Guild membership or as a substitute
  for authenticated identity.

Durable acceptance:

- Accept a message only after its PostgreSQL transaction commits successfully.
- A sender acknowledgment means durable acceptance into PostgreSQL; it does
  not mean that any recipient received or rendered the message.
- Redis Pub/Sub must never be the durable acceptance mechanism.
- If persistence fails, the sender must receive a non-acceptance result and
  the message must not be reported as accepted. A message published before a
  failed persistence attempt must be treated as an undelivered transient event
  and must not become authoritative history.
- If persistence commits but broadcast fails, the message remains accepted and
  authorized history reads must make it recoverable. Broadcast delivery must be
  retried or reported as a delivery failure without rolling back committed
  history.

Acceptance outcomes:

- `committed acceptance` means the message transaction committed and the
  sender may receive the original immutable message ID and channel sequence.
- `terminal rejection` means validation or authorization failed and the
  submission is finalized as rejected according to the idempotency policy.
- `retryable infrastructure failure` means no committed acceptance or
  terminal rejection exists. The submission must remain retryable and must not
  be permanently finalized merely because a database, gateway, or delivery
  dependency failed.
- `unknown outcome` means the sender lost the acknowledgment and cannot know
  whether the transaction committed. Retrying with the same submission ID
  must resolve to the committed original message if one exists, or continue
  the retryable path if no terminal result was committed. It must never create
  a second accepted message.

Identity, ordering, and retries:

- Every accepted message has an immutable server-assigned message ID.
- Every channel assigns a server-assigned event sequence number while holding
  the channel's serialization boundary in the same transaction that accepts
  the event. Message events and moderation visibility events share that
  channel sequence. Timestamps are metadata only and never establish
  ordering.
- The serialization boundary must prevent a later accepted event from
  overtaking an earlier accepted event in the same channel. A transaction that
  rolls back commits neither its event nor its sequence number; numbering must
  not rely on a standalone sequence object that creates unexplained gaps.
- If a committed event is later hidden, its moderation tombstone/event remains
  part of the channel's ordered history even though the original content may
  no longer be available to every reader.
- A submission ID is required and is scoped to the authenticated sender and
  channel. A retry with the same sender, channel, and submission ID may replay
  only a committed acceptance or a finalized terminal rejection, without
  creating another message. A transient failure is not a finalized result and
  remains retryable under the same submission ID.
- Reuse of a submission ID with a different canonical payload must be rejected
  as a conflicting reuse and must not mutate the original record.

History recovery and authorization:

- Clients recover missed events through authorized, paginated history reads
  using an opaque channel sequence cursor, not by trusting a client-provided
  timestamp. Each page returns a continuation cursor or an explicit end.
- Authorization must be rechecked before every history page. A page must not
  be used to infer continuing access to later pages.
- A cursor that is malformed, belongs to another channel, or is tied to a
  channel the caller can no longer read must return an explicit unauthorized
  result. A cursor below the durable retained-history boundary must return an
  explicit history-expired result with the current restart boundary.
- Eviction from a hot cache must never expire durable history. Cursor expiry is
  determined only by the approved durable retention/deletion boundary.
- After recovery, the client must reconcile history and live delivery by
  continuing from the highest received channel sequence and de-duplicating by
  immutable event ID/sequence. The exact subscribe-before-replay or
  replay-before-subscribe handshake remains open.
- The service must recheck authorization for message sends, history reads,
  subscriptions, and replay requests. A permission change must affect future
  operations even if a connection or subscription was previously accepted.
- Revocation must remove or disable the affected subscription, reject new
  sends and reads, and prevent replay through an already-issued cursor.

Subscription revocation:

- The gateway must recheck permission before accepting each send and before
  delivering each live event. An in-flight send that has not committed when
  revocation takes effect must be rejected or rolled back; a send committed
  before revocation remains accepted.
- The affected connection must receive an explicit revocation notification and
  stop receiving the channel. The exact event name, close code, and whether a
  connection may remain open for other authorized channels remain unresolved.
- Permission restoration requires a fresh authorization check and a new
  subscription or resume operation. Previously delivered content cannot be
  reliably recalled from a client after revocation.

Moderation, retention, and audit boundaries:

- Moderation visibility changes are separate from message-content editing.
  Message content, sender, channel, message ID, submission ID, and sequence
  number remain immutable after acceptance.
- A visibility change must be represented by an auditable moderation event or
  equivalent append-only history, including actor, time, reason, and affected
  message. The current visible state is a projection of that moderation
  history, not an edit to the original message.
- A replay that encounters a moderated message must return a tombstone/event
  indicating that content is unavailable to that reader, without implying
  that the original content is retained forever. Authorized retention,
  deletion, anonymization, and legal-hold policy determines whether and for
  how long restricted content remains available to authorized personnel.
- Retention, deletion, anonymization, legal holds, and moderation/security
  exceptions must be defined separately for accepted messages, moderation
  events, submission-idempotency records, and delivery diagnostics.
- Hard deletion is not the normal moderation operation. Any authorized
  deletion or anonymization must preserve the audit boundary and define what
  history cursors and client events observe afterward.

These proposals intentionally leave unresolved the exact account/session
mechanism, PostgreSQL schema, transaction and lock strategy, cursor encoding,
the precise per-channel serialization implementation, idempotency-record
retention, content-retention period, deletion/anonymization schedule,
connection revocation protocol details, Redis recovery mechanism, moderation
roles, privacy/legal retention periods, and deployment topology. Those
decisions require separate review and approval before implementation.

26. Architectural Summary

The intended system is a shared communication platform built around:

Authenticated accounts

Explicit communication identity

Server-side authorization

Immutable channel identities

Immutable messages

Soft deletion

Moderation/audit records

WebSocket gateways

Redis Pub/Sub for cross-node real-time distribution

PostgreSQL for durable history

Asynchronous durable persistence

Separate Forum persistence

Future Guild-aware authorization

Isolated asynchronous AI processing

Explicit separation between communication and game authority

For the initial release, the applicable proposal is one authenticated
Community text channel, one gateway, and direct PostgreSQL persistence. The
multi-node Redis topology and the World/Help/Trade, Direct Message, Forum,
Guild, AI, and Glitch expansions remain later proposals and do not override
the initial-release boundary.

The central architectural rule is:

Chat is a communication system, not a game-state authority.

Guilds, Communities, Factions, Participants, Rewards, Properties, and
Progression remain separate domains with explicit relationships rather
than implicit identity or permission inheritance.

27. Status

Design complete enough for repository review.

Implementation status: NOT AUTHORIZED.

This document should be reviewed against the existing repository before
any code, migration, infrastructure, or dependency changes are made.
