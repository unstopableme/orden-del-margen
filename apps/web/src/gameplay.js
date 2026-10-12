const BUILDINGS = [
  { type: 'wheat_farm', name: 'Wheat Farm', material: 'wheat', icon: '🌾' },
  { type: 'lumber_mill', name: 'Lumber Mill', material: 'wood', icon: '🌲' },
  { type: 'quarry', name: 'Quarry', material: 'stone', icon: '🪨' },
  { type: 'provisioner', name: 'Provisioner', material: 'food', icon: '🥖' },
  { type: 'textile_mill', name: 'Textile Mill', material: 'cloth', icon: '🧵' }
];

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

  function pendingCollectionKey(identity, authenticatedAccountId) {
    return `${identity}\u0000${authenticatedAccountId}`;
  }

  function clearSession() {
    sessionVersion += 1;
    sessionIdentity = null;
    accountId = null;
    accountStateRequestVersion += 1;
    pendingCollections.clear();
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
  demoMode = false
}) {
  if (demoMode) {
    root.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">Idle production</p><h2>Gameplay</h2></div></div>
      <p class="muted" role="status">Gameplay requires Passport authentication. The community demo remains available.</p>
    `;
    return;
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
    const buildings = accountState?.buildings || [];
    const balances = new Map((accountState?.balances || [])
      .map((balance) => [balance.assetCode, balance.amount]));
    const provisioned = buildings.length === BUILDINGS.length;
    const missingRules = BUILDINGS.some((building) =>
      !rules.some((rule) => rule.buildingType === building.type)
    );
    const cards = BUILDINGS.map((building) => {
      const rule = rules.find((candidate) => candidate.buildingType === building.type);
      const owned = buildings.find((candidate) => candidate.buildingType === building.type);
      const production = rule
        ? `${escapeHtml(rule.unitsPerHour)} ${escapeHtml(building.material)}/hour · ${escapeHtml(capLabel(rule.storageLimitMs))}`
        : 'Not present in the active server ruleset';
      return `
        <article class="game-building">
          <div class="game-building-icon" aria-hidden="true">${building.icon}</div>
          <div class="game-building-copy">
            <h3>${building.name}</h3>
            <p>${owned ? `Level ${escapeHtml(owned.level)} · Active` : 'Not provisioned'}</p>
            <small>${production}</small>
          </div>
          <strong class="game-balance">${escapeHtml(formatAmount(balances.get(building.material) || '0'))}<span>${building.material}</span></strong>
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
      <p class="muted gameplay-intro">Production rates and storage caps are supplied by the active server ruleset.</p>
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
      button.addEventListener('click', () => runAction(button.dataset.action));
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

  async function runAction(action) {
    if (view.busy) return;
    view.busy = true;
    view.message = action === 'collect'
      ? 'Collecting production…'
      : action === 'provision'
        ? 'Provisioning initial buildings…'
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
      }
      const refreshed = await loadAccountState();
      if (!refreshed.ok) {
        const completedAction = action === 'collect'
          ? 'Collection completed'
          : 'Initial buildings were provisioned';
        view.message = `${completedAction}, but account refresh failed: ${refreshed.message}`;
        view.messageKind = 'error';
      } else {
        view.message = action === 'collect'
          ? 'Idle production collected.'
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
}
