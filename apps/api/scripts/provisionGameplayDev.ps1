$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$profilePath = Join-Path $repoRoot 'apps\api\.env.gameplay-dev'
$targetName = 'orden_margen_gameplay_dev'
$ownerName = 'odm_accounts_test'
$apiRole = 'odm_gameplay_dev_app'

if (Test-Path $profilePath) {
  throw 'apps/api/.env.gameplay-dev already exists; refusing to overwrite it.'
}

$webEnvironment = Join-Path $repoRoot 'apps\web\.env.local'
if (-not (Test-Path $webEnvironment)) {
  throw 'apps/web/.env.local is required; configure the Passport client locally first.'
}

$clientIdLine = Get-Content $webEnvironment | Where-Object {
  $_ -match '^VITE_IMMUTABLE_PASSPORT_CLIENT_ID=.+$'
}
if (@($clientIdLine).Count -ne 1) {
  throw 'apps/web/.env.local must contain exactly one configured Passport client ID.'
}
$clientId = ($clientIdLine -split '=', 2)[1].Trim()

$securePassword = Read-Host 'Local PostgreSQL postgres password (hidden input)' -AsSecureString
if (-not $securePassword -or $securePassword.Length -eq 0) {
  throw 'No password was entered; no changes were made.'
}

$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $env:PASSPORT_PUBLIC_CLIENT_ID = $clientId
  Push-Location $repoRoot
  try {
    @'
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('./apps/api/node_modules/pg');

const targetName = 'orden_margen_gameplay_dev';
const ownerName = 'odm_accounts_test';
const apiRole = 'odm_gameplay_dev_app';
const profilePath = 'apps/api/.env.gameplay-dev';
const clientId = process.env.PASSPORT_PUBLIC_CLIENT_ID;
if (!clientId) throw new Error('Passport client ID is not available');
if (fs.existsSync(profilePath)) throw new Error('Local API profile already exists; no changes made');

const admin = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 5000
});

(async () => {
  await admin.connect();
  const { rows } = await admin.query(`
    SELECT
      EXISTS (SELECT 1 FROM pg_database WHERE datname=$1) AS target_exists,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$2) AS owner_exists,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$3) AS api_role_exists
  `, [targetName, ownerName, apiRole]);
  if (rows[0].target_exists) throw new Error('Target database already exists; no changes made');
  if (!rows[0].owner_exists) throw new Error('Required owner role odm_accounts_test is unavailable; no changes made');
  if (rows[0].api_role_exists) throw new Error('Dedicated API role already exists; no changes made');

  const apiPassword = crypto.randomBytes(32).toString('hex');
  let roleCreated = false;
  let databaseCreated = false;
  let profileCreated = false;
  try {
    await admin.query(`CREATE ROLE ${apiRole} LOGIN PASSWORD '${apiPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 5`);
    roleCreated = true;
    await admin.query(`CREATE DATABASE ${targetName} OWNER ${ownerName} TEMPLATE template0 ENCODING 'UTF8'`);
    databaseCreated = true;

    const db = new Client({
      host: '127.0.0.1',
      port: 5432,
      database: targetName,
      user: 'postgres',
      password: process.env.PGPASSWORD,
      connectionTimeoutMillis: 5000
    });
    try {
      await db.connect();
      await db.query(`GRANT CONNECT ON DATABASE ${targetName} TO ${apiRole}`);
      await db.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${apiRole}`);
    } finally {
      await db.end().catch(() => {});
    }

    const lines = [
      'NODE_ENV=development',
      `DATABASE_URL=postgresql://${apiRole}:${apiPassword}@127.0.0.1:5432/${targetName}`,
      'DATABASE_PURPOSE=development',
      `DATABASE_EXPECTED_NAME=${targetName}`,
      'PGSSL_MODE=disable',
      'PGSSL_CA_PATH=',
      'PGSSL_CA_BASE64=',
      'PGSSL_SERVERNAME=',
      'PG_POOL_MAX=5',
      'COMMUNITY_STORAGE=postgres',
      'COMMUNITY_AUTH_MODE=immutable-passport',
      'COMMUNITY_DEMO_AUTH=false',
      'COMMUNITY_SESSION_TOKENS=',
      'COMMUNITY_SEED_DEMO=false',
      'GAMEPLAY_API_ENABLED=false',
      `IMMUTABLE_PASSPORT_CLIENT_ID=${clientId}`,
      'IMMUTABLE_PASSPORT_ISSUER=https://auth.immutable.com/',
      'IMMUTABLE_PASSPORT_JWKS_URI=https://auth.immutable.com/.well-known/jwks.json',
      'ALLOWED_FRONTEND_ORIGINS=http://localhost:8000',
      'PORT=3001',
      ''
    ];
    fs.writeFileSync(profilePath, lines.join('\n'), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    profileCreated = true;
    const { rows: database } = await admin.query(
      'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',
      [targetName]
    );
    console.log(JSON.stringify({
      databaseCreated: true,
      databaseOwner: database[0].owner,
      apiRoleCreated: true,
      apiProfileCreated: true,
      credentials: 'hidden'
    }));
  } catch (error) {
    if (profileCreated) fs.unlinkSync(profilePath);
    if (databaseCreated) await admin.query(`DROP DATABASE ${targetName}`).catch(() => {});
    if (roleCreated) await admin.query(`DROP ROLE ${apiRole}`).catch(() => {});
    throw error;
  }
})().catch(error => {
  console.error(`Provisioning stopped safely: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await admin.end().catch(() => {});
});
'@ | node
    if ($LASTEXITCODE -ne 0) {
      throw 'PostgreSQL provisioning did not complete.'
    }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PASSPORT_PUBLIC_CLIENT_ID -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  $securePassword.Dispose()
}
