import { CATALOG, itemMass, quantityLabel } from '../inventory/containers.js';
import { SUIT_COLORS } from './protocol.js';
import { createSocialUI } from './social-ui.js';

if (typeof document !== 'undefined') void import('./ui.css');

const AUTH_ROOT = '/api/auth';
const CALLSIGN = /^[A-Za-z0-9_-]{3,24}$/;
const CONTAINERS = ['pack', 'ship', 'station'];
const KEYBOARD_KEYS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'0123456789', '@', '.', '_', '-'];
const catalogById = new Map(CATALOG.map(item => [item.id, item]));

const codePoints = value => [...String(value ?? '')].length;
const messageOf = value => typeof value === 'string' ? value : value?.message || value?.error || '';
const accountFrom = value => value?.account ?? (value?.id && value?.callsign ? value : null);

export function validateAuth(view, values) {
  const email = String(values.email ?? '').trim();
  const callsign = String(values.callsign ?? '').trim();
  const password = String(values.password ?? '');
  if (view !== 'reset' && !/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.';
  if (view === 'register' && !CALLSIGN.test(callsign)) return 'Callsign must be 3–24 letters, numbers, underscores, or hyphens.';
  if (['register', 'reset'].includes(view) && (codePoints(password) < 12 || codePoints(password) > 128)) return 'Password must be 12–128 characters.';
  if (view === 'login' && !password) return 'Enter your password.';
  return '';
}

export function normalizeMultiplayerState(value = {}) {
  const state = value?.state && !Object.hasOwn(value, 'connected') ? value.state : value;
  return {
    connected: Boolean(state?.connected),
    needsRespawn: Boolean(state?.connected && (state.health === 0 || state.inventory?.health === 0 || state.players?.some?.(peer => peer.id === state.ownId && peer.shipHealth === 0))),
    account: accountFrom(state),
    ownId: state?.ownId ?? null,
    players: Array.isArray(state?.players) ? state.players : [],
    maxPlayers: Number.isFinite(state?.maxPlayers) ? state.maxPlayers : null,
    hangar: state?.hangar ?? null,
    inventory: state?.inventory ?? null,
    health: Number.isFinite(state?.health) ? state.health : Number.isFinite(state?.inventory?.health) ? state.inventory.health : null,
    drops: Array.isArray(state?.drops) ? state.drops : [],
    error: typeof state?.error === 'string' ? state.error : null,
    moderation: typeof state?.moderation === 'string' ? state.moderation : null,
  };
}

export function inventoryRows(inventory) {
  if (!inventory?.containers) return [];
  return CATALOG.flatMap(item => {
    const amounts = Object.fromEntries(CONTAINERS.map(name => [name, Number(inventory.containers[name]?.[item.id] ?? 0)]));
    return Object.values(amounts).some(value => value > 0) ? [{ item, amounts }] : [];
  });
}

export function inventoryCommand(action, itemId, inventory) {
  const item = catalogById.get(itemId);
  const revision = inventory?.revision;
  const dropping = action === 'drop-pack';
  const [from, to] = dropping ? ['pack', null] : String(action).split('-');
  if (!item || !CONTAINERS.includes(from) || (!dropping && !CONTAINERS.includes(to)) || !Number.isSafeInteger(revision)) return null;
  const available = Number(inventory.containers?.[from]?.[item.id] ?? 0);
  const quantity = Math.min(available, 1);
  if (!(quantity > 0)) return null;
  return { method: dropping ? 'drop' : 'transfer', payload: dropping
    ? { item: item.id, quantity, revision }
    : { from, to, item: item.id, quantity, revision } };
}

export async function authRequest(path, payload, fetcher = globalThis.fetch) {
  const response = await fetcher(`${AUTH_ROOT}/${path}`, {
    method: path === 'session' ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: path === 'session' ? undefined : { 'Content-Type': 'application/json' },
    body: path === 'session' ? undefined : JSON.stringify(payload ?? {}),
  });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw Object.assign(new Error(messageOf(body) || `Request failed (${response.status}).`), { status: response.status });
  return body ?? {};
}

export async function signOutSession({ connected = false, fetcher = globalThis.fetch, onSignedOut = () => {}, onLeave = () => {} } = {}) {
  const result = await authRequest('logout', {}, fetcher);
  onSignedOut(result);
  if (connected) await onLeave();
  return result;
}

export function consumeResetToken(locationObject = globalThis.location, historyObject = globalThis.history) {
  if (!locationObject?.href) return null;
  const url = new URL(locationObject.href);
  const token = url.searchParams.get('reset');
  if (!token) return null;
  url.searchParams.delete('reset');
  historyObject?.replaceState?.(historyObject.state, '', `${url.pathname}${url.search}${url.hash}`);
  return token;
}

function hangarLabel(hangar) {
  if (!hangar) return 'No hangar assigned';
  const status = hangar.status ? String(hangar.status) : 'assigned';
  const id = Number.isInteger(hangar.id) ? `Hangar ${String(hangar.id).padStart(2, '0')}` : String(hangar.id ?? 'Hangar');
  return `${id} · ${status}`;
}

function padLabel(pad) {
  return Array.isArray(pad) && pad.length === 3 ? 'Landing marker active' : 'Awaiting landing marker';
}

function expiryLabel(expiresAt) {
  if (!expiresAt) return '';
  const date = new Date(expiresAt);
  return Number.isNaN(date.valueOf()) ? '' : `Expires ${date.toISOString().slice(11, 16)} UTC`;
}

function stopNavigation(nav) {
  nav.keys?.clear?.();
  nav.velocity?.set?.(0, 0, 0);
  nav.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock?.();
  nav.gamepad?.suspend?.();
}

function restoreNavigation(nav) {
  nav.keys?.clear?.();
  nav.gamepad?.suspend?.();
  nav.enabled = !document.querySelector('dialog[open]');
  if (nav.enabled) nav.canvas?.focus?.({ preventScroll: true });
}

function safeCallsign(account) {
  return account?.callsign ? String(account.callsign) : 'Guest pilot';
}

/** Account, comms and authoritative server-inventory dialogs. The shared
 * controller dialog router discovers the semantic controls added here.
 */
export function createMultiplayerUI({ nav, client, onJoin = account => client.connect?.(account), onLeave = () => client.disconnect?.(), fetcher = globalThis.fetch } = {}) {
  if (!nav || !client) throw new TypeError('createMultiplayerUI requires nav and client');
  const resetToken = consumeResetToken();
  let state = normalizeMultiplayerState(client.state);
  let sessionAccount = state.account;
  let authView = resetToken ? 'reset' : 'login';
  let activeKeyboard = null;
  let currentDialog = null;
  let busy = false;
  let disposed = false;

  const accountDialog = document.createElement('dialog');
  accountDialog.id = 'multiplayer-account-dialog';
  accountDialog.setAttribute('aria-labelledby', 'multiplayer-account-title');
  accountDialog.innerHTML = `<div class="dialog-top mp-dialog-top"><span class="eyebrow">Pilot account</span><button type="button" data-mp-close aria-label="Close account">✕</button></div>
    <h2 id="multiplayer-account-title">Fly together when you choose</h2>
    <p class="mp-intro">Sign in or create an account to join up to ten pilots. Choose a callsign, not a real name. You can also continue offline.</p>
    <nav class="mp-auth-tabs" aria-label="Account access">
      <button type="button" data-auth-view="login" data-controller-key="auth-login">Sign in</button>
      <button type="button" data-auth-view="register" data-controller-key="auth-register">Create account</button>
    </nav>
    <section class="mp-account-session" hidden>
      <div class="mp-callout"><span>Signed in as</span><strong data-account-callsign></strong></div>
      <div class="mp-action-row"><button type="button" data-join data-controller-focus data-controller-key="join-multiplayer">Join multiplayer</button><button type="button" data-leave data-controller-key="leave-multiplayer">Leave multiplayer</button><button type="button" data-logout data-controller-key="logout">Sign out</button></div>
    </section>
    <form data-auth-form="login">
      <label>Email<input id="mp-login-email" name="email" type="email" autocomplete="email" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-login-email" data-controller-key="edit-login-email">Enter email with controller</button>
      <label>Password<input id="mp-login-password" name="password" type="password" autocomplete="current-password" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-login-password" data-controller-key="edit-login-password">Enter password with controller</button>
      <div class="mp-action-row"><button type="submit" data-controller-focus data-controller-key="submit-login">Sign in</button><button type="button" data-auth-view="forgot" data-controller-key="auth-forgot">Forgot password</button></div>
    </form>
    <form data-auth-form="register" hidden>
      <label>Email<input id="mp-register-email" name="email" type="email" autocomplete="email" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-register-email" data-controller-key="edit-register-email">Enter email with controller</button>
      <label>Callsign<input id="mp-register-callsign" name="callsign" autocomplete="nickname" pattern="[A-Za-z0-9_\\-]{3,24}" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-register-callsign" data-controller-key="edit-register-callsign">Enter callsign with controller</button>
      <label>Password<input id="mp-register-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-register-password" data-controller-key="edit-register-password">Enter password with controller</button>
      <button type="submit" data-controller-focus data-controller-key="submit-register">Create account</button>
    </form>
    <form data-auth-form="forgot" hidden>
      <p>Enter your account email. The response is the same whether an account exists or not.</p>
      <label>Email<input id="mp-forgot-email" name="email" type="email" autocomplete="email" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-forgot-email" data-controller-key="edit-forgot-email">Enter email with controller</button>
      <div class="mp-action-row"><button type="submit" data-controller-focus data-controller-key="submit-forgot">Send reset link</button><button type="button" data-auth-view="login" data-controller-key="forgot-back">Back to sign in</button></div>
    </form>
    <form data-auth-form="reset" hidden>
      <p>Choose a new password. You will sign in again after it is changed.</p>
      <label>New password<input id="mp-reset-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
      <button type="button" class="mp-controller-edit" data-edit-field="mp-reset-password" data-controller-key="edit-reset-password">Enter password with controller</button>
      <button type="submit" data-controller-focus data-controller-key="submit-reset">Change password</button>
    </form>
    <section class="mp-keyboard" hidden aria-label="Controller text entry"><div class="mp-keyboard-readout"><span data-keyboard-label>Text entry</span><output data-keyboard-output></output></div><div class="mp-keyboard-keys"></div><div class="mp-action-row"><button type="button" data-key-action="backspace" data-controller-key="keyboard-backspace">Backspace</button><button type="button" data-key-action="clear" data-controller-key="keyboard-clear">Clear</button><button type="button" data-key-action="done" data-controller-key="keyboard-done">Done</button></div></section>
    <p class="mp-feedback" role="status" aria-live="polite"></p>
    <div class="mp-action-row"><button type="button" data-mp-continue data-controller-key="account-continue">Continue offline</button></div>
    <p class="mp-controller-note">Controller: D-pad or left stick to choose · A to activate · B to close</p>`;

  const commsDialog = document.createElement('dialog');
  commsDialog.id = 'multiplayer-comms-dialog';
  commsDialog.setAttribute('aria-labelledby', 'multiplayer-comms-title');
  commsDialog.innerHTML = `<div class="dialog-top mp-dialog-top"><span class="eyebrow">Ship communications</span><button type="button" data-mp-close aria-label="Close communications">✕</button></div>
    <h2 id="multiplayer-comms-title">Communications</h2>
    <div data-comms-flight>
    <div class="mp-status-grid"><div><span>Connection</span><strong data-comms-connection></strong></div><div><span>Pilots</span><strong data-comms-players></strong></div><div><span>Callsign</span><strong data-comms-callsign></strong></div><div><span>Health</span><strong data-comms-health></strong></div></div>
    <section class="mp-hangar"><span>Hangar assignment</span><strong data-hangar-status></strong><small data-hangar-pad></small><small data-hangar-expiry></small></section>
    <div class="mp-action-row"><button type="button" data-request-hangar data-controller-focus data-controller-key="request-hangar">Request hangar</button><button type="button" data-cancel-hangar data-controller-key="cancel-hangar">Cancel request</button><button type="button" data-comms-join data-controller-key="comms-join">Join multiplayer</button><button type="button" data-comms-leave data-controller-key="comms-leave">Leave multiplayer</button><button type="button" data-open-account data-controller-key="comms-account">Account</button></div>
    <div class="mp-roster" aria-label="Connected pilots"></div></div><p class="mp-feedback" role="status" aria-live="polite"></p>
    <p class="mp-controller-note">Controller: D-pad or left stick to choose · A to confirm · B to return</p>`;

  const inventoryDialog = document.createElement('dialog');
  inventoryDialog.id = 'multiplayer-inventory-dialog';
  inventoryDialog.setAttribute('aria-labelledby', 'multiplayer-inventory-title');
  inventoryDialog.innerHTML = `<div class="dialog-top mp-dialog-top"><span class="eyebrow">Server inventory</span><button type="button" data-mp-close aria-label="Close multiplayer inventory">✕</button></div>
    <h2 id="multiplayer-inventory-title">Cargo manifest</h2><p class="mp-inventory-summary"></p><div class="mp-inventory-list"></div><p class="mp-feedback" role="status" aria-live="polite"></p>
    <p class="mp-controller-note">Transfers and drops are checked by the server against access, proximity, capacity, and manifest revision.</p>`;

  document.body.append(accountDialog, commsDialog, inventoryDialog);
  const socialUI = createSocialUI({ nav, client, dialog: commsDialog, flight: commsDialog.querySelector('[data-comms-flight]') });
  const releasedKeys = new Set();
  const heldKey = event => {
    if (!event.repeat) releasedKeys.delete(event.code);
    else if (releasedKeys.has(event.code)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const releasedKey = event => releasedKeys.delete(event.code);
  document.addEventListener('keydown', heldKey, true); document.addEventListener('keyup', releasedKey, true);
  // Outside the launcher: both the cinematic and player-active mode hide it.
  const accessButton = document.createElement('button');
  accessButton.id = 'multiplayer-access'; accessButton.type = 'button';
  accessButton.setAttribute('aria-haspopup', 'dialog');
  document.body.append(accessButton);
  const dialogs = [accountDialog, commsDialog, inventoryDialog];
  const feedback = dialog => dialog.querySelector('.mp-feedback');
  const currentAccount = () => state.account ?? sessionAccount;

  function setFeedback(dialog, text, error = false) {
    const output = feedback(dialog); output.textContent = text; output.classList.toggle('error', error);
  }

  function showAuthView(view) {
    authView = view;
    accountDialog.querySelectorAll('[data-auth-form]').forEach(form => { form.hidden = form.dataset.authForm !== view; });
    accountDialog.querySelectorAll('[data-auth-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.authView === view)));
    closeKeyboard();
  }

  function closeKeyboard() {
    activeKeyboard = null;
    const keyboard = accountDialog.querySelector('.mp-keyboard'); keyboard.hidden = true;
    accountDialog.querySelectorAll('[data-auth-form]').forEach(form => { form.inert = false; });
  }

  function openKeyboard(input) {
    activeKeyboard = input;
    const keyboard = accountDialog.querySelector('.mp-keyboard'); keyboard.hidden = false;
    accountDialog.querySelectorAll('[data-auth-form]').forEach(form => { form.inert = true; });
    keyboard.querySelector('[data-keyboard-label]').textContent = input.labels?.[0]?.textContent?.trim() || input.name;
    updateKeyboardOutput();
    keyboard.querySelector('button')?.focus();
  }

  function updateKeyboardOutput() {
    if (!activeKeyboard) return;
    accountDialog.querySelector('[data-keyboard-output]').textContent = activeKeyboard.type === 'password' ? '•'.repeat(codePoints(activeKeyboard.value)) : activeKeyboard.value || 'Empty';
  }

  const keyboardKeys = accountDialog.querySelector('.mp-keyboard-keys');
  for (const key of KEYBOARD_KEYS) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = key;
    button.dataset.keyValue = key.toLowerCase(); button.dataset.controllerKey = `keyboard-${key === '@' ? 'at' : key === '.' ? 'dot' : key}`;
    keyboardKeys.append(button);
  }

  function renderAccount() {
    const account = currentAccount();
    accountDialog.querySelector('.mp-account-session').hidden = !account;
    accountDialog.querySelector('.mp-auth-tabs').hidden = Boolean(account);
    accountDialog.querySelectorAll('[data-auth-form]').forEach(form => { if (account) form.hidden = true; });
    if (!account && !activeKeyboard) showAuthView(authView);
    accountDialog.querySelector('[data-account-callsign]').textContent = safeCallsign(account);
    const join = accountDialog.querySelector('[data-join]'); const leave = accountDialog.querySelector('[data-leave]');
    join.hidden = state.connected; join.disabled = busy || !account;
    leave.hidden = !state.connected; leave.disabled = busy;
    accountDialog.querySelector('[data-logout]').disabled = busy;
    accountDialog.querySelector('[data-mp-continue]').textContent = state.connected ? 'Return to flight' : 'Continue offline';
    accessButton.textContent = state.connected ? 'COMMS' : account ? 'ACCOUNT' : 'SIGN IN / REGISTER';
    accessButton.title = state.connected ? 'Multiplayer communications · controller Menu' : 'Pilot account · controller Menu';
    accessButton.setAttribute('aria-controls', state.connected ? commsDialog.id : accountDialog.id);
  }

  function renderComms() {
    const account = currentAccount();
    commsDialog.querySelector('[data-comms-connection]').textContent = state.connected ? 'Connected' : 'Offline';
    commsDialog.querySelector('[data-comms-players]').textContent = state.maxPlayers == null ? `${state.players.length}` : `${state.players.length} / ${state.maxPlayers}`;
    commsDialog.querySelector('[data-comms-callsign]').textContent = safeCallsign(account);
    commsDialog.querySelector('[data-comms-health]').textContent = state.health == null ? 'Awaiting server' : `${state.health}`;
    commsDialog.querySelector('[data-hangar-status]').textContent = hangarLabel(state.hangar);
    commsDialog.querySelector('[data-hangar-pad]').textContent = state.hangar ? padLabel(state.hangar.pad) : 'Request a berth when connected.';
    commsDialog.querySelector('[data-hangar-expiry]').textContent = expiryLabel(state.hangar?.expiresAt);
    const request = commsDialog.querySelector('[data-request-hangar]'); const cancel = commsDialog.querySelector('[data-cancel-hangar]');
    request.hidden = Boolean(state.hangar); request.disabled = busy || !state.connected;
    cancel.hidden = !state.hangar; cancel.disabled = busy || !state.connected;
    commsDialog.querySelector('[data-comms-join]').hidden = state.connected || !account;
    commsDialog.querySelector('[data-comms-join]').disabled = busy;
    commsDialog.querySelector('[data-comms-leave]').hidden = !state.connected;
    commsDialog.querySelector('[data-comms-leave]').disabled = busy;
    commsDialog.querySelector('[data-open-account]').hidden = false;
    if (!state.connected && (state.moderation || state.error)) setFeedback(commsDialog, state.moderation || state.error, true);
    const roster = commsDialog.querySelector('.mp-roster'); roster.replaceChildren();
    if (!state.connected) { const p = document.createElement('p'); p.textContent = account ? 'Join multiplayer to see the live roster.' : 'Sign in, then choose Join multiplayer.'; roster.append(p); }
    for (const player of state.players) {
      const row = document.createElement('div'); row.className = 'mp-pilot';
      const assignedColor = SUIT_COLORS[player.colorIndex] ?? player.color ?? player.suitColor ?? '#879699';
      const color = document.createElement('i'); color.style.backgroundColor = String(assignedColor); color.setAttribute('aria-label', `Server assigned suit colour ${Number.isInteger(player.colorIndex) ? player.colorIndex + 1 : ''}`.trim());
      const name = document.createElement('strong'); name.textContent = String(player.callsign ?? 'Pilot');
      const mode = document.createElement('span'); mode.textContent = player.id === state.ownId ? 'You' : String(player.mode ?? 'online');
      row.append(color, name, mode); roster.append(row);
    }
  }

  function renderInventory() {
    const inventory = state.inventory;
    const summary = inventoryDialog.querySelector('.mp-inventory-summary');
    const list = inventoryDialog.querySelector('.mp-inventory-list'); list.replaceChildren();
    if (!state.connected) { summary.textContent = 'Join multiplayer to load the server manifest.'; return; }
    if (!inventory?.containers) { summary.textContent = 'Waiting for the authoritative server manifest.'; return; }
    const revision = Number.isSafeInteger(inventory.revision) ? inventory.revision : null;
    const health = state.health == null ? '—' : state.health;
    summary.textContent = `Revision ${revision ?? '—'} · Health ${health} · Pack ${itemMass(inventory.containers.pack ?? {}).toFixed(1)} / ${inventory.capacity?.pack ?? '—'} kg · Ship ${itemMass(inventory.containers.ship ?? {}).toFixed(1)} / ${inventory.capacity?.ship ?? '—'} kg`;
    if (state.needsRespawn) {
      const respawn = document.createElement('button'); respawn.type = 'button'; respawn.textContent = 'Respawn';
      respawn.dataset.inventoryRequest = 'respawn'; respawn.dataset.controllerKey = 'respawn'; respawn.disabled = busy;
      list.append(respawn);
    }
    const rows = inventoryRows(inventory);
    if (!rows.length) { const empty = document.createElement('p'); empty.className = 'mp-empty'; empty.textContent = 'The server manifest is empty.'; list.append(empty); }
    for (const { item, amounts } of rows) {
      const article = document.createElement('article'); article.className = 'mp-item'; article.dataset.item = item.id;
      const info = document.createElement('div'); const title = document.createElement('h3'); title.textContent = item.name;
      const quantities = document.createElement('p'); quantities.textContent = CONTAINERS.map(name => `${name}: ${quantityLabel(item, amounts[name])}`).join(' · ');
      info.append(title, quantities); const actions = document.createElement('div'); actions.className = 'mp-item-actions';
      const addAction = (label, action, source) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.dataset.inventoryAction = action; button.dataset.item = item.id; button.dataset.controllerKey = `${action}-${item.id}`;
        button.disabled = busy || amounts[source] <= 0 || revision == null; actions.append(button);
      };
      addAction('Pack to ship', 'pack-ship', 'pack'); addAction('Ship to pack', 'ship-pack', 'ship');
      addAction('Station to ship', 'station-ship', 'station'); addAction('Ship to station', 'ship-station', 'ship');
      addAction('Drop from pack', 'drop-pack', 'pack');
      if (['rifle-laser', 'sidearm-pistol', 'mining-laser-tool'].includes(item.id)) {
        const equip = document.createElement('button'); equip.type = 'button'; equip.textContent = 'Equip';
        equip.dataset.inventoryRequest = 'equip'; equip.dataset.weapon = item.id; equip.dataset.controllerKey = `equip-${item.id}`;
        equip.disabled = busy || amounts.pack <= 0; actions.append(equip);
      }
      article.append(info, actions); list.append(article);
    }
    const holster = document.createElement('button'); holster.type = 'button'; holster.textContent = 'Holster';
    holster.dataset.inventoryRequest = 'equip'; holster.dataset.weapon = ''; holster.dataset.controllerKey = 'equip-none'; holster.disabled = busy;
    list.append(holster);
    for (const drop of state.drops) {
      const item = catalogById.get(drop.item); if (!item || !drop.id) continue;
      const pickup = document.createElement('button'); pickup.type = 'button';
      pickup.textContent = `Pick up ${quantityLabel(item, Number(drop.quantity ?? 0))} ${item.name}`;
      pickup.dataset.inventoryRequest = 'pickup'; pickup.dataset.dropId = drop.id;
      pickup.dataset.controllerKey = `pickup-${drop.id}`; pickup.disabled = busy; list.append(pickup);
    }
  }

  function render() { if (!disposed) { renderAccount(); renderComms(); renderInventory(); } }
  function applyState(next) { state = normalizeMultiplayerState(next ?? client.state); if (state.account) sessionAccount = state.account; render(); }

  async function perform(dialog, pendingMessage, action) {
    if (busy) return false;
    busy = true; setFeedback(dialog, pendingMessage); render();
    try {
      const result = await action();
      if (result?.state || Object.hasOwn(result ?? {}, 'connected')) applyState(result.state ?? result);
      else applyState(client.state);
      setFeedback(dialog, messageOf(result) || 'Server confirmed the request.');
      return true;
    } catch (error) {
      setFeedback(dialog, error?.message || 'The request could not be completed.', true);
      return false;
    } finally { busy = false; render(); }
  }

  async function join(dialog = accountDialog) {
    const account = currentAccount();
    if (!account || state.connected) return false;
    return perform(dialog, 'Connecting…', () => onJoin(account));
  }
  async function leave(dialog = accountDialog) {
    if (!state.connected) return false;
    return perform(dialog, 'Leaving shared flight…', onLeave);
  }

  function openDialog(dialog) {
    if (disposed || document.querySelector('dialog[open]')) return false;
    stopNavigation(nav); client.suspendInput?.(); render();
    const reason = dialog === commsDialog && !state.connected ? state.moderation || state.error || '' : '';
    setFeedback(dialog, reason, Boolean(reason)); currentDialog = dialog; dialog.showModal(); nav.gamepad?.suspend?.(); return true;
  }
  function finishDialog(dialog) {
    // Native close events are queued. A pointer close must restore controls
    // before the next key, without a late event clearing newly pressed input.
    if (dialog.open || currentDialog !== dialog) return;
    currentDialog = null; closeKeyboard();
    for (const key of nav.physicalKeys ?? []) releasedKeys.add(key);
    client.suspendInput?.(); restoreNavigation(nav);
  }
  function closeDialog(dialog) { dialog.close(); finishDialog(dialog); }
  const openAccount = (view = null) => { if (view) showAuthView(view); return openDialog(accountDialog); };
  const openComms = () => openDialog(commsDialog);
  const openInventory = () => openDialog(inventoryDialog);
  accessButton.addEventListener('click', () => state.connected ? openComms() : openAccount());
  accountDialog.querySelector('[data-mp-continue]').addEventListener('click', () => closeDialog(accountDialog));

  dialogs.forEach(dialog => {
    dialog.querySelector('[data-mp-close]').addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('close', () => finishDialog(dialog));
  });
  accountDialog.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-auth-view]'); if (viewButton) { showAuthView(viewButton.dataset.authView); return; }
    const edit = event.target.closest('[data-edit-field]'); if (edit) { openKeyboard(accountDialog.querySelector(`#${edit.dataset.editField}`)); return; }
    const key = event.target.closest('[data-key-value]'); if (key && activeKeyboard) { activeKeyboard.value += key.dataset.keyValue; activeKeyboard.dispatchEvent(new Event('input', { bubbles: true })); updateKeyboardOutput(); return; }
    const action = event.target.closest('[data-key-action]');
    if (action && activeKeyboard) {
      if (action.dataset.keyAction === 'backspace') activeKeyboard.value = [...activeKeyboard.value].slice(0, -1).join('');
      if (action.dataset.keyAction === 'clear') activeKeyboard.value = '';
      if (action.dataset.keyAction === 'done') { const input = activeKeyboard; closeKeyboard(); accountDialog.querySelector(`[data-edit-field="${input.id}"]`)?.focus(); return; }
      activeKeyboard.dispatchEvent(new Event('input', { bubbles: true })); updateKeyboardOutput(); return;
    }
    if (event.target.closest('[data-join]')) void join();
    if (event.target.closest('[data-leave]')) void leave();
    if (event.target.closest('[data-logout]')) void perform(accountDialog, 'Signing out…', async () => {
      const result = await signOutSession({ connected: state.connected, fetcher, onLeave, onSignedOut: () => {
        sessionAccount = null;
        state = { ...state, connected: false, account: null };
      } });
      return { ...result, state: { ...normalizeMultiplayerState(client.state), connected: false, account: null } };
    });
  });

  accountDialog.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target; const view = form.dataset.authForm; const values = Object.fromEntries(new FormData(form));
    const validation = validateAuth(view, values); if (validation) { setFeedback(accountDialog, validation, true); return; }
    const payload = view === 'reset' ? { token: resetToken, password: values.password } : values;
    void perform(accountDialog, view === 'forgot' ? 'Sending reset instructions…' : 'Checking account…', async () => {
      const result = await authRequest(view, payload, fetcher);
      form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
      const account = accountFrom(result);
      if (account) { sessionAccount = account; state = { ...state, account }; }
      if (view === 'forgot' || view === 'reset') showAuthView('login');
      return result;
    });
  });

  commsDialog.addEventListener('click', event => {
    if (event.target.closest('[data-request-hangar]')) void perform(commsDialog, 'Requesting a hangar…', () => client.requestHangar());
    if (event.target.closest('[data-cancel-hangar]')) void perform(commsDialog, 'Cancelling the hangar request…', () => client.cancelHangar());
    if (event.target.closest('[data-comms-join]')) void join(commsDialog);
    if (event.target.closest('[data-comms-leave]')) void leave(commsDialog);
    if (event.target.closest('[data-open-account]')) { closeDialog(commsDialog); queueMicrotask(() => openAccount()); }
  });

  inventoryDialog.addEventListener('click', event => {
    const request = event.target.closest('[data-inventory-request]');
    if (request && !busy) {
      const action = request.dataset.inventoryRequest;
      void perform(inventoryDialog, 'Sending server request…', () => action === 'respawn' ? client.respawn()
        : action === 'pickup' ? client.pickup(request.dataset.dropId) : client.equip({ weapon: request.dataset.weapon || null }));
      return;
    }
    const button = event.target.closest('[data-inventory-action]'); if (!button || busy) return;
    const command = inventoryCommand(button.dataset.inventoryAction, button.dataset.item, state.inventory);
    if (!command) { setFeedback(inventoryDialog, 'Waiting for an authoritative manifest revision and available stack.', true); return; }
    void perform(inventoryDialog, 'Sending manifest request…', () => client[command.method](command.payload));
  });

  let unsubscribe = () => {};
  if (typeof client.subscribe === 'function') unsubscribe = client.subscribe(applyState) || unsubscribe;
  else if (typeof client.addEventListener === 'function') {
    const listener = event => applyState(event.detail ?? client.state);
    client.addEventListener('state', listener); unsubscribe = () => client.removeEventListener('state', listener);
  }

  async function refreshSession() {
    try {
      const result = await authRequest('session', null, fetcher); sessionAccount = accountFrom(result); render(); return sessionAccount;
    } catch (error) {
      if (error.status === 401) { sessionAccount = null; render(); return null; }
      setFeedback(accountDialog, error.message, true); return null;
    }
  }

  render();
  void refreshSession();
  const auth = { open: openAccount, refreshSession, get account() { return currentAccount(); } };
  return {
    auth, dialogs: { account: accountDialog, comms: commsDialog, inventory: inventoryDialog },
    openAccount, openComms, openInventory, refreshSession,
    render: applyState,
    dispose() { disposed = true; unsubscribe(); socialUI.dispose(); document.removeEventListener('keydown', heldKey, true); document.removeEventListener('keyup', releasedKey, true); accessButton.remove(); dialogs.forEach(dialog => dialog.remove()); },
  };
}
