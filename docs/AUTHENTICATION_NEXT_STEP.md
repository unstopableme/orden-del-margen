# Authentication next step

## Implemented Passport verification boundary

The API now supports `COMMUNITY_AUTH_MODE=immutable-passport`. It verifies an
Immutable Passport ID token with RS256, the provider JWKS, the configured
issuer, the Passport client ID as audience, and normal expiry/not-before
checks. The verified `sub` is looked up in PostgreSQL; wallet, property access,
and account identity values are never accepted from request fields or
unverified claims.

## Persistent authenticated accounts

Migration `007_create_authenticated_accounts.js` defines canonical UUID
accounts and a provider identity map keyed by `(provider, issuer, subject)`.
`community_members` remains a community profile and is not used as the gameplay
account key. A verified Immutable Passport identity is linked to its existing
community profile by the provisioned Passport binding and independently
resolves to one canonical account.

Migration `006` permits legacy Passport bindings with a null issuer. They do
not match the authenticated lookup and are intentionally not backfilled with a
guessed issuer; an operator must provision the exact verified issuer before
those identities can resolve to accounts.

Migration `009_create_passport_community_member_bindings.js` adds a distinct
issuer/subject-to-community-member association that does not claim a wallet.
The identity store resolves this mapping to a canonical account while leaving
wallet address and property access empty. `GET /api/community/me/properties`
continues to require a separate verified wallet binding.

On the first successful authentication for an active, pre-provisioned Passport
binding, the API creates the account and issuer/subject mapping in one
transaction. It locks the binding row so concurrent requests resolve to the
same account. Unlinked or revoked identities do not provision accounts and
remain denied. The stable UUID is exposed only in server-owned
`req.callerContext.accountId`; request-supplied account identifiers are not
used. Configured demo tokens do not receive an account ID.

The project owner reports that the guarded PostgreSQL integration suite passed
against a dedicated disposable database on October 11, 2026 (5 passed, 0
failed, 0 skipped). The suite applies migrations in temporary isolated schemas
and removes those schemas during teardown; this does not apply the migration to
an application database. The result was reported by the user and was not
independently captured in this session. Passport mode requires the migration
to be applied to its intended application database before startup because the
identity store checks for both account tables. The operational process that
provisions Passport-to-community bindings remains external. No gameplay route
or job is mounted; this identity foundation alone does not enable gameplay
access.

### Disposable PostgreSQL validation

The migration runner sorts migration filenames lexicographically.
`007_create_authenticated_accounts.js` therefore follows the existing Passport
binding migrations `005` and `006`; it creates new tables and does not alter
community-profile or Passport-binding rows. The locally staged
`001_initialize_equipment_tiers.js` is a separate pre-existing migration and
contains `DROP TABLE ... CASCADE`. Do not run the complete migration set on an
existing development, staging, production, or otherwise shared database.

For an authorized persistence check, create a **new, empty, dedicated
disposable PostgreSQL database** whose database name includes `test`, separate
from every application database. Use a dedicated test role and connection URL.
The integration harness refuses to run unless the URL name exactly matches
`TEST_DATABASE_EXPECTED_NAME`, the name includes `test`, and
`TEST_DATABASE_PURPOSE=disposable`. It does not load `.env` or `DATABASE_URL`.
Each test creates a uniquely named schema, runs all migrations there, and
drops only that schema during teardown. The `001` table drops are therefore
confined to that new isolated schema. The test database itself is not dropped
by the harness.

In PowerShell, substitute the connection URL locally without saving it in
source control:

```powershell
$env:TEST_DATABASE_URL = '<dedicated-test-database-connection-url>'
$env:TEST_DATABASE_PURPOSE = 'disposable'
$env:TEST_DATABASE_EXPECTED_NAME = '<exact-database-name-containing-test>'
$env:TEST_PGSSL_MODE = 'disable' # Only for a local loopback PostgreSQL server.
Set-Location apps\api
npm run test:integration
```

For a non-loopback PostgreSQL server, omit `TEST_PGSSL_MODE=disable` and supply
the verified TLS settings required by `databaseConfig.js`. Before running,
independently verify the target with `SELECT current_database();` and confirm it
is the newly created disposable database. The migration DDL must not be run
manually or pointed at an existing application database. Afterward, confirm
the test output reports the Passport mapping test as passed and all schemas
were torn down; the database is left intact for explicit, separately approved
cleanup.

This adapter gives token expiry and provider-side login/logout behavior, but it
does not provide immediate API-side revocation of an already issued ID token.
Unknown but valid Passport subjects are denied with 403. A one-time loopback
linking helper exists only for the isolated local development database; a
reviewed production identity-linking workflow remains an external operational
requirement.

## Recommended session follow-up

If immediate logout/revocation is required beyond short token lifetime, add a
server-owned session after the Passport login. Use a maintained OIDC/session
client rather than implementing account recovery locally.

After the provider callback, create a random opaque session identifier, store
only its cryptographic hash in PostgreSQL, and send the identifier in a
`Secure`, `HttpOnly`, `SameSite=Lax` cookie. Bind the session row to the local
member and record `created_at`, absolute `expires_at`, rolling idle expiry,
`last_seen_at`, and optional `revoked_at`/revocation reason.

Logout revokes the current session before clearing the cookie. Password or
account security changes should revoke every session for the provider subject.
Administrative revocation should support one session and all sessions for a
member. Authentication must reject expired or revoked sessions on every
request. Session rotation after login and privilege changes limits fixation.

## External configuration required

- Immutable Passport client ID, exact issuer, and stable subject policy.
- Provider-approved frontend callback/logout URLs and origins.
- Exact HTTPS redirect and post-logout URLs.
- Approved scopes (`openid`, and only required profile claims).
- Provider signing-key/JWKS validation and clock-skew policy.
- Session absolute/idle lifetimes and revocation retention.
- HTTPS termination and trusted-proxy CIDR list.
- CSRF protection for cookie-authenticated mutations.
- Documented provider logout and compromised-account response procedures.

No recovery flow should accept caller-supplied identity claims, security
questions, emailed raw credentials, or locally invented reset tokens. Recovery
must use the selected provider's verified process and revoke existing sessions.

The configured opaque-token adapter remains a development bridge and is
refused in production. It has no expiration or dynamic revocation.
