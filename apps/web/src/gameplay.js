const BUILDINGS = [
  { type: 'wheat_farm', name: 'Wheat Farm', material: 'wheat', icon: '🌾' },
  { type: 'lumber_mill', name: 'Lumber Mill', material: 'wood', icon: '🌲' },
  { type: 'quarry', name: 'Quarry', material: 'stone', icon: '🪨' },
  { type: 'provisioner', name: 'Provisioner', material: 'food', icon: '🥖' },
  { type: 'textile_mill', name: 'Textile Mill', material: 'cloth', icon: '🧵' }
];

const CARRY_DENOMINATOR = 3_600_000n;

export class GameplayHttpError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message);
    this.name = 'GameplayHttpError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function sessionChangedError() {
  return new GameplayHttpError(401, 'PASSPORT_SESSION_CHANGED', 'Your Passport session changed. Refresh gameplay before continuing.');
}

function authenticationError(message = 'Sign in with Passport and refresh gameplay before continuing.') {
  return new GameplayHttpError(401, 'UNAUTHORIZED', message);
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createGameplayClient(
  passportFetch,
  createIdempotencyKey = () => globalThis.crypto.randomUUID(),
  getSessionIdentity = async () => 'test-session'
) {
  let sessionIdentity = null;
  let accountId = null;
  let sessionVersion = 0;
  let accountStateRequestVersion = 0;
  const pendingCollections = new Map();
  const pendingUpgrades = new Map();

  function pendingCollectionKey(identity, authenticatedAccountId) {
    return `${identity}\u0000${authenticatedAccountId}`;
  }

  function clearSession() {
    sessionVersion += 1;
    sessionIdentity = null;
    accountId = null;
    accountStateRequestVersion += 1;
    pendingCollections.clear();
    pendingUpgrades.clear();
  }

  async function currentIdentity() {
    const identity = await getSessionIdentity();
    return typeof identity === 'string' && identity.length > 0 ? identity : null;
  }

  async function beginRequest() {
    const identity = await currentIdentity();
    if (!identity) {
      clearSession();
      throw authenticationError();
    }
    if (sessionIdentity !== identity) {
      clearSession();
      sessionIdentity = identity;
    }
    return { identity, version: sessionVersion };
  }

  async function assertRequestSession(requestSession) {
    const identity = await currentIdentity();
    if (requestSession.version !== sessionVersion) {
      throw sessionChangedError();
    }
    if (identity !== requestSession.identity) {
      clearSession();
      throw sessionChangedError();
    }
  }

  async function request(path, options, requestSession = null) {
    const capturedSession = requestSession || await beginRequest();
    try {
      const response = await passportFetch(path, options);
      await assertRequestSession(capturedSession);
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new GameplayHttpError(
          response.status,
          payload?.error?.code,
          payload?.error?.message || `Gameplay request failed (${response.status})`,
          response.headers.get('Retry-After')
        );
      }
      if (payload === null) {
        throw new Error('Gameplay API returned an invalid JSON response');
      }
      return payload;
    } catch (error) {
      if ((error?.status === 401 || error?.status === 403) &&
          capturedSession.version === sessionVersion) {
        clearSession();
      }
      throw error;
    }
  }

  return {
    getAccountState() {
      return (async () => {
        const requestSession = await beginRequest();
        const stateRequestVersion = ++accountStateRequestVersion;
        const state = await request('/api/gameplay/idle-collection', { method: 'GET' }, requestSession);
        await assertRequestSession(requestSession);
        if (stateRequestVersion !== accountStateRequestVersion) {
          throw sessionChangedError();
        }
        if (typeof state.accountId !== 'string' || !state.accountId) {
          throw new Error('Gameplay API returned no authenticated account ID');
        }
        if (accountId !== null && accountId !== state.accountId) {
          sessionVersion += 1;
          pendingCollections.clear();
          pendingUpgrades.clear();
        }
        accountId = state.accountId;
        return state;
      })();
    },

    provisionInitialBuildings(expectedRulesFingerprint) {
      return (async () => {
        const requestSession = await beginRequest();
        if (!accountId) throw sessionChangedError();
        return request('/api/gameplay/idle-buildings/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRulesFingerprint })
        }, requestSession);
      })();
    },

    collect({ accountId: requestedAccountId, expectedRulesFingerprint }) {
      return (async () => {
        const requestSession = await beginRequest();
        if (!accountId || requestedAccountId !== accountId) {
          accountId = null;
          throw sessionChangedError();
        }
        const operationKey = pendingCollectionKey(requestSession.identity, accountId);
        let operation = pendingCollections.get(operationKey);
        if (operation?.promise) return operation.promise;
        if (!operation) {
          operation = {
            key: createIdempotencyKey(),
            fingerprint: expectedRulesFingerprint,
            accountId,
            identity: requestSession.identity,
            promise: null
          };
          pendingCollections.set(operationKey, operation);
        }
        operation.promise = request('/api/gameplay/idle-collection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': operation.key
          },
          body: JSON.stringify({ expectedRulesFingerprint: operation.fingerprint })
        }, requestSession).then((result) => {
          if (pendingCollections.get(operationKey) === operation) {
            pendingCollections.delete(operationKey);
          }
          return result;
        }).finally(() => {
          operation.promise = null;
        });
        return operation.promise;
      })();
    },

    upgradeBuilding({
      accountId: requestedAccountId, buildingType, targetLevel = 2,
      expectedRulesFingerprint
    }) {
      return (async () => {
        const requestSession = await beginRequest();
        if (!accountId || requestedAccountId !== accountId) {
          accountId = null;
          throw sessionChangedError();
        }
        const operationKey = `${requestSession.identity}\u0000${accountId}\u0000${buildingType}`;
        let operation = pendingUpgrades.get(operationKey);
        if (operation?.promise) return operation.promise;
        if (!operation) {
          operation = {
            key: createIdempotencyKey(), expectedRulesFingerprint, targetLevel, promise: null
          };
          pendingUpgrades.set(operationKey, operation);
        }
        operation.promise = request(`/api/gameplay/idle-buildings/${encodeURIComponent(buildingType)}/upgrade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': operation.key
          },
          body: JSON.stringify({
            expectedRulesFingerprint: operation.expectedRulesFingerprint,
            targetLevel: operation.targetLevel
          })
        }, requestSession).then((result) => {
          if (pendingUpgrades.get(operationKey) === operation) pendingUpgrades.delete(operationKey);
          return result;
        }).finally(() => {
          operation.promise = null;
        });
        return operation.promise;
      })();
    }
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatAmount(value) {
  try {
    return new Intl.NumberFormat().format(BigInt(value));
  } catch {
    return '0';
  }
}

function capLabel(storageLimitMs) {
  const hours = storageLimitMs / 3_600_000;
  if (Number.isInteger(hours)) return `${hours}h storage cap`;
  const minutes = storageLimitMs / 60_000;
  return `${Number.isInteger(minutes) ? minutes : hours.toFixed(1)}${Number.isInteger(minutes) ? 'm' : 'h'} storage cap`;
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Unavailable';
  if (milliseconds === 0) return '0m';
  const totalSeconds = Math.max(1, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function estimatePendingProduction({ building, rule, now = Date.now() } = {}) {
  try {
    if (!building || !rule || building.buildingType !== rule.buildingType ||
        Number(building.level) !== Number(rule.level) ||
        building.assetCode !== rule.assetCode || building.activity !== 'active' ||
        !Number.isSafeInteger(rule.unitsPerHour) || rule.unitsPerHour <= 0 ||
        !Number.isSafeInteger(rule.storageLimitMs) || rule.storageLimitMs < 0 ||
        typeof building.carryNumerator !== 'string' || !/^\d+$/.test(building.carryNumerator)) {
      return null;
    }
    const lastSettledAt = Date.parse(building.lastSettledAt);
    const nowMilliseconds = now instanceof Date ? now.getTime() : now;
    const carry = BigInt(building.carryNumerator);
    if (!Number.isSafeInteger(lastSettledAt) || !Number.isSafeInteger(nowMilliseconds) ||
        carry < 0n || carry >= CARRY_DENOMINATOR) {
      return null;
    }

    const elapsedMilliseconds = Math.max(0, nowMilliseconds - lastSettledAt);
    const activeMilliseconds = Math.min(elapsedMilliseconds, rule.storageLimitMs);
    const remainingCapacityMs = rule.storageLimitMs - activeMilliseconds;
    const rate = BigInt(rule.unitsPerHour);
    const availableNumerator = carry + (BigInt(activeMilliseconds) * rate);
    const pendingUnits = availableNumerator / CARRY_DENOMINATOR;
    const estimatedCarry = availableNumerator % CARRY_DENOMINATOR;
    const remainingCapacityUnits = (estimatedCarry + (BigInt(remainingCapacityMs) * rate)) /
      CARRY_DENOMINATOR;
    const numeratorUntilNext = CARRY_DENOMINATOR - estimatedCarry;
    const millisecondsUntilNext = Number((numeratorUntilNext + rate - 1n) / rate);

    return Object.freeze({
      pendingUnits: pendingUnits.toString(),
      remainingCapacityMs,
      remainingCapacityUnits: remainingCapacityUnits.toString(),
      millisecondsUntilNext: remainingCapacityMs >= millisecondsUntilNext
        ? millisecondsUntilNext
        : null,
      storageFull: remainingCapacityMs === 0
    });
  } catch {
    return null;
  }
}

export function gameplayErrorMessage(error) {
  if (error?.status === 401) return 'Your Passport session expired. Sign in again to use gameplay.';
  if (error?.status === 403) {
    if (error.code === 'PASSPORT_IDENTITY_NOT_LINKED') {
      return 'Your Passport identity is valid but is not linked to an account.';
    }
    return 'Your Passport identity does not have permission to use gameplay.';
  }
  if (error?.status === 409) {
    if (error.code === 'GAMEPLAY_NOT_PROVISIONED') {
      return 'Provision your initial buildings before collecting.';
    }
    if (error.code === 'INSUFFICIENT_COLLECTED_BALANCE') {
      return 'Not enough collected materials are available for this building upgrade.';
    }
    return 'The rules or collection request conflicted. Refresh the account state, then retry.';
  }
  if (error?.status === 429) {
    const retry = Number(error.retryAfter);
    return Number.isFinite(retry) && retry > 0
      ? `Gameplay is rate limited. Retry in ${retry} second${retry === 1 ? '' : 's'}.`
      : 'Gameplay is rate limited. Wait a moment, then retry.';
  }
  return error?.message || 'Unable to complete the gameplay request.';
}

export async function mountGameplay(root, {
  passportFetch,
  getSessionIdentity,
  demoMode = false,
  now = () => Date.now(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval
}) {
  if (demoMode) {
    root.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">Idle production</p><h2>Gameplay</h2></div></div>
      <p class="muted" role="status">Gameplay requires Passport authentication. The community demo remains available.</p>
    `;
    return () => {};
  }

  const client = createGameplayClient(
    passportFetch,
    undefined,
    getSessionIdentity
  );
  const view = {
    accountState: null,
    busy: false,
    message: 'Loading your gameplay account…',
    messageKind: 'info'
  };
  let accountLoadVersion = 0;

  function render() {
    const accountState = view.accountState;
    const rules = accountState?.ruleSet?.rules || [];
    const upgradeCosts = accountState?.ruleSet?.upgradeCosts || [];
    const buildings = accountState?.buildings || [];
    const balances = new Map((accountState?.balances || [])
      .map((balance) => [balance.assetCode, balance.amount]));
    const provisioned = buildings.length === BUILDINGS.length;
    const missingRules = BUILDINGS.some((building) => {
      const owned = buildings.find((candidate) => candidate.buildingType === building.type);
      const requiredLevel = owned ? Number(owned.level) : 1;
      return !rules.some((rule) =>
        rule.buildingType === building.type && Number(rule.level) === requiredLevel);
    });
    const cards = BUILDINGS.map((building) => {
      const owned = buildings.find((candidate) => candidate.buildingType === building.type);
      const rule = rules.find((candidate) =>
        candidate.buildingType === building.type &&
        Number(candidate.level) === (owned ? Number(owned.level) : 1));
      const production = rule
        ? `${escapeHtml(rule.unitsPerHour)} ${escapeHtml(building.material)}/hour · ${escapeHtml(capLabel(rule.storageLimitMs))}`
        : 'Not present in the active server ruleset';
      const estimate = owned && rule
        ? estimatePendingProduction({ building: owned, rule, now: now() })
        : null;
      const estimateMarkup = estimate ? `
        <dl class="game-production-estimate" aria-label="Estimated uncollected production">
          <div><dt>Pending estimate</dt><dd>${escapeHtml(formatAmount(estimate.pendingUnits))} ${escapeHtml(building.material)}</dd></div>
          <div><dt>Capacity remaining</dt><dd>${estimate.storageFull
            ? 'Storage cap reached'
            : `${escapeHtml(formatDuration(estimate.remainingCapacityMs))} · about ${escapeHtml(formatAmount(estimate.remainingCapacityUnits))} more`}</dd></div>
          <div><dt>Next unit</dt><dd>${estimate.millisecondsUntilNext === null
            ? 'Storage cap reached'
            : `about ${escapeHtml(formatDuration(estimate.millisecondsUntilNext))}`}</dd></div>
        </dl>` : '';
      const costs = owned ? upgradeCosts.filter((cost) =>
        cost.buildingType === building.type && Number(cost.fromLevel) === Number(owned.level) &&
        Number(cost.toLevel) === Number(owned.level) + 1) : [];
      const missing = costs.flatMap((cost) => {
        const required = BigInt(cost.amount);
        const available = BigInt(balances.get(cost.assetCode) || '0');
        return available < required
          ? [{ ...cost, missing: (required - available).toString() }]
          : [];
      });
      const upgradeMarkup = costs.length > 0 ? `
        <div class="game-upgrade">
          <p><strong>Level ${escapeHtml(Number(owned.level) + 1)} cost</strong>: ${costs.map((cost) =>
            `${escapeHtml(formatAmount(cost.amount))} ${escapeHtml(cost.assetCode)}`).join(' · ')}</p>
          <p class="${missing.length > 0 ? 'game-upgrade-missing' : 'game-upgrade-ready'}">${missing.length > 0
            ? `Missing: ${missing.map((cost) =>
              `${escapeHtml(formatAmount(cost.missing))} ${escapeHtml(cost.assetCode)}`).join(' · ')}`
            : 'All collected materials available.'}</p>
          <button class="secondary" data-action="upgrade" data-building-type="${escapeHtml(building.type)}"
            ${view.busy || missing.length > 0 ? 'disabled' : ''}>Upgrade to Level ${escapeHtml(Number(owned.level) + 1)}</button>
        </div>` : '';
      return `
        <article class="game-building">
          <div class="game-building-icon" aria-hidden="true">${building.icon}</div>
          <div class="game-building-copy">
            <h3>${building.name}</h3>
            <p>${owned ? `Level ${escapeHtml(owned.level)} · Active` : 'Not provisioned'}</p>
            <small>${production}</small>
            ${estimateMarkup}
            ${upgradeMarkup}
          </div>
          <strong class="game-balance">${escapeHtml(formatAmount(balances.get(building.material) || '0'))}<span>collected ${building.material}</span></strong>
        </article>`;
    }).join('');
    const ruleset = accountState?.ruleSet;
    const message = view.message
      ? `<p class="gameplay-message ${view.messageKind}" role="status">${escapeHtml(view.message)}</p>`
      : '';

    root.innerHTML = `
      <div class="section-heading">
        <div><p class="eyebrow">Your account · server-authoritative rules</p><h2>Idle production</h2></div>
        <span class="count">${ruleset ? `Ruleset v${escapeHtml(ruleset.versionNumber)}` : 'Passport'}</span>
      </div>
      <p class="muted gameplay-intro">Production rates and storage caps are supplied by the active server ruleset. Pending production, remaining capacity, and next-unit times are local estimates from server timestamps and carry; collected balances change only after collection.</p>
      ${ruleset ? `<p class="rules-fingerprint">Rules fingerprint: <code>${escapeHtml(ruleset.fingerprint)}</code></p>` : ''}
      ${message}
      ${accountState ? `
        <div class="gameplay-buildings">${cards}</div>
        ${missingRules ? '<p class="gameplay-message error" role="alert">The server ruleset does not include all five prototype buildings. Actions are disabled.</p>' : ''}
      ` : ''}
      <div class="gameplay-actions">
        <button class="secondary" data-action="refresh" ${view.busy ? 'disabled' : ''}>Refresh</button>
        ${accountState ? `
          ${!provisioned ? `<button class="primary" data-action="provision" ${view.busy || missingRules ? 'disabled' : ''}>Provision five buildings</button>` : ''}
          <button class="primary" data-action="collect" ${view.busy || !provisioned || missingRules ? 'disabled' : ''}>Collect idle production</button>
        ` : ''}
      </div>
    `;

    root.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => runAction(
        button.dataset.action, button.dataset.buildingType
      ));
    });
  }

  async function loadAccountState() {
    const loadVersion = ++accountLoadVersion;
    try {
      const accountState = await client.getAccountState();
      if (loadVersion !== accountLoadVersion) return { ok: false, stale: true };
      view.accountState = accountState;
      view.message = '';
      view.messageKind = 'info';
      return { ok: true };
    } catch (error) {
      if (loadVersion !== accountLoadVersion) return { ok: false, stale: true };
      if (error?.status === 401 || error?.status === 403) {
        view.accountState = null;
      }
      view.message = gameplayErrorMessage(error);
      view.messageKind = 'error';
      return { ok: false, error, message: view.message };
    }
  }

  async function runAction(action, buildingType) {
    if (view.busy) return;
    view.busy = true;
    view.message = action === 'collect'
      ? 'Collecting production…'
      : action === 'provision'
        ? 'Provisioning initial buildings…'
        : action === 'upgrade'
          ? 'Upgrading building…'
        : 'Refreshing gameplay account…';
    view.messageKind = 'info';
    render();

    try {
      if (action === 'refresh') {
        const refreshed = await loadAccountState();
        if (refreshed.stale) {
          view.message = 'Refresh was superseded by a newer gameplay request.';
          view.messageKind = 'info';
        } else if (!refreshed.ok) {
          view.message = refreshed.message;
          view.messageKind = 'error';
        } else {
          view.message = 'Gameplay account refreshed.';
          view.messageKind = 'success';
        }
        return;
      }

      if (action === 'provision') {
        await client.provisionInitialBuildings(view.accountState.ruleSet.fingerprint);
      } else if (action === 'collect') {
        await client.collect({
          accountId: view.accountState.accountId,
          expectedRulesFingerprint: view.accountState.ruleSet.fingerprint
        });
      } else if (action === 'upgrade') {
        await client.upgradeBuilding({
          accountId: view.accountState.accountId,
          buildingType,
          targetLevel: 2,
          expectedRulesFingerprint: view.accountState.ruleSet.fingerprint
        });
      }
      const refreshed = await loadAccountState();
      if (!refreshed.ok) {
        const completedAction = action === 'collect'
          ? 'Collection completed'
          : action === 'upgrade'
            ? 'Building upgrade completed'
          : 'Initial buildings were provisioned';
        view.message = `${completedAction}, but account refresh failed: ${refreshed.message}`;
        view.messageKind = 'error';
      } else {
        view.message = action === 'collect'
          ? 'Idle production collected.'
          : action === 'upgrade'
            ? 'Building upgraded.'
          : 'Initial buildings provisioned.';
        view.messageKind = 'success';
      }
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        view.accountState = null;
      }
      view.message = gameplayErrorMessage(error);
      view.messageKind = 'error';
    } finally {
      view.busy = false;
      render();
    }
  }

  render();
  await loadAccountState();
  render();

  const estimateTimer = setIntervalFn(() => {
    if (view.accountState && !view.busy) render();
  }, 1000);
  estimateTimer?.unref?.();
  return () => clearIntervalFn(estimateTimer);
}
