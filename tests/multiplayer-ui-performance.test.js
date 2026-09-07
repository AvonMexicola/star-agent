import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerUI, multiplayerPanelKey, normalizeMultiplayerState } from '../src/multiplayer/ui.js';

function connectedState() {
  return { connected: true, account: { id: 'self', callsign: 'Pilot' }, ownId: 'self', maxPlayers: 10, health: 100,
    players: [{ id: 'self', callsign: 'Pilot', colorIndex: 0, mode: 'walk', health: 100, shipHealth: 100, position: [0, 0, 0] },
      { id: 'peer', callsign: 'Peer', colorIndex: 1, mode: 'walk', health: 100, shipHealth: 100, position: [5, 0, 0] }],
    hangar: { id: 1, status: 'occupied', pad: [1, 2, 3], expiresAt: 100000 },
    inventory: { revision: 4, containers: { pack: { bandage: 2, 'rifle-laser': 1 }, ship: { bandage: 1 }, station: {} }, capacity: { pack: 20, ship: 120 } },
    drops: [{ id: 'drop', item: 'bandage', quantity: 1, position: [1, 0, 0], expiresAt: 200000 }],
    social: { relationships: [{ id: 'peer', callsign: 'Peer', status: 'friend' }], blocked: [] }, chat: [] };
}

test('panel dependencies ignore movement but include all displayed manifest, roster and lease changes', () => {
  const state = normalizeMultiplayerState(connectedState());
  const changed = structuredClone(state);
  changed.players[1].position = [25_000_000_000, 0, 0]; changed.hangar.expiresAt += 1000;
  changed.drops[0].position[0] += 10; changed.drops[0].expiresAt += 1000;
  for (const panel of ['account', 'comms', 'inventory']) assert.equal(multiplayerPanelKey(panel, changed), multiplayerPanelKey(panel, state));
  for (const edit of [s => s.inventory.containers.pack.bandage++, s => s.inventory.capacity.pack++, s => s.inventory.revision++,
    s => s.health--, s => s.needsRespawn = true, s => s.drops[0].quantity++, s => s.drops.push({ id: 'new', item: 'ice', quantity: 1 }), s => s.connected = false]) {
    const next = structuredClone(state); edit(next);
    assert.notEqual(multiplayerPanelKey('inventory', next), multiplayerPanelKey('inventory', state));
  }
  for (const edit of [s => s.hangar.expiresAt += 60000, s => s.hangar.status = 'approach', s => s.hangar.pad = null,
    s => s.players[1].callsign = 'New_name', s => s.players[1].mode = 'eva', s => s.players[1].colorIndex++, s => s.players.pop(),
    s => s.ownId = 'peer', s => s.error = 'Connection lost', s => s.moderation = 'Removed', s => s.account = null]) {
    const next = structuredClone(state); edit(next);
    assert.notEqual(multiplayerPanelKey('comms', next), multiplayerPanelKey('comms', state));
  }
  for (const panel of ['account', 'comms', 'inventory']) assert.notEqual(multiplayerPanelKey(panel, state, state.account, true), multiplayerPanelKey(panel, state));
});

// A small instrumented DOM boundary, not a browser layout/focus substitute.
// Native controller, dialog and visual behavior is covered by browser QA.
function instrumentedDOM() {
  const metrics = { created: 0, replaced: 0 }, elements = [];
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.style = {};
      this.attributes = new Map(); this.listeners = new Map(); this.selectors = new Map();
      this.value = ''; this.textContent = ''; this.open = false; this.scrollHeight = this.scrollTop = this.clientHeight = 0;
      this.classList = { toggle() {} }; elements.push(this);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    after() {}
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
    replaceChildren(...children) { metrics.replaced++; this.children = []; this.append(...children); }
    querySelector(selector) {
      if (!this.selectors.has(selector)) this.selectors.set(selector, new Element(selector === 'input' ? 'input' : 'div'));
      return this.selectors.get(selector);
    }
    querySelectorAll() { return []; }
    addEventListener(type, listener) { const list = this.listeners.get(type) ?? []; list.push(listener); this.listeners.set(type, list); }
    removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(value => value !== listener)); }
    dispatchEvent(event) { for (const listener of this.listeners.get(event.type) ?? []) listener(event); }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; queueMicrotask(() => this.dispatchEvent({ type: 'close' })); }
  }
  document = { body: new Element('body'), activeElement: null,
    createElement(tag) { metrics.created++; return new Element(tag); },
    querySelector(selector) { return selector === 'dialog[open]' ? elements.find(element => element.tagName === 'DIALOG' && element.open) ?? null : null; },
    addEventListener() {}, removeEventListener() {} };
  return { document, metrics };
}

test('hidden snapshots create no rows; unchanged open controls retain identity and reopening applies the latest manifest', async t => {
  const previous = { document: globalThis.document, window: globalThis.window, innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight };
  const { document, metrics } = instrumentedDOM();
  Object.assign(globalThis, { document, window: { addEventListener() {}, removeEventListener() {} }, innerWidth: 1440, innerHeight: 900 });
  let ui;
  t.after(() => { ui?.dispose(); for (const [key, value] of Object.entries(previous)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; });
  const listeners = new Set();
  const client = { state: connectedState(), subscribe(callback) { listeners.add(callback); callback(this.state); return () => listeners.delete(callback); }, suspendInput() {} };
  const nav = { enabled: true, keys: new Set(), physicalKeys: new Set(), velocity: { set() {} }, gamepad: { suspend() {} }, canvas: { focus() {} } };
  ui = createMultiplayerUI({ nav, client, fetcher: async () => ({ ok: true, json: async () => ({ account: client.state.account }) }) });
  await new Promise(resolve => setImmediate(resolve));
  const publish = patch => { client.state = { ...client.state, ...patch }; for (const callback of listeners) callback(client.state); };
  let sequence = 0;
  const movement = () => ({ players: client.state.players.map((p, i) => ({ ...p, position: [i + ++sequence / 100, 0, 0] })), inventory: structuredClone(client.state.inventory), drops: structuredClone(client.state.drops) });
  metrics.created = metrics.replaced = 0;
  for (let i = 0; i < 150; i++) publish(movement());
  assert.deepEqual(metrics, { created: 0, replaced: 0 }, 'ten seconds of hidden movement snapshots do no DOM reconstruction');
  assert.equal(ui.openInventory(), true);
  const list = ui.dialogs.inventory.querySelector('.mp-inventory-list'), controls = [...list.children];
  list.children[0].focus(); const focused = document.activeElement;
  metrics.created = metrics.replaced = 0;
  for (let i = 0; i < 150; i++) publish(movement());
  assert.deepEqual(metrics, { created: 0, replaced: 0 });
  assert.deepEqual(list.children, controls); assert.equal(document.activeElement, focused);
  ui.dialogs.inventory.close(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(nav.enabled, true);
  const inventory = structuredClone(client.state.inventory); inventory.containers.pack.bandage = 9; inventory.revision++;
  publish({ inventory, health: 42, drops: [] });
  assert.deepEqual(list.children, controls, 'hidden updates retain state without rebuilding its dormant tree');
  assert.equal(ui.openInventory(), true);
  assert.match(ui.dialogs.inventory.querySelector('.mp-inventory-summary').textContent, /Revision 5 · Health 42/);
  assert.match(list.children.find(child => child.dataset.item === 'bandage').children[0].children[1].textContent, /pack: 9/);
  assert.equal(list.children.some(child => child.dataset.dropId === 'drop'), false);
  publish({ health: 0, players: client.state.players.map(p => p.id === 'self' ? { ...p, health: 0, shipHealth: 0 } : p) });
  assert.ok(list.children.some(child => child.dataset.inventoryRequest === 'respawn'));
  publish({ connected: false, error: 'Connection lost', social: null, chat: [] });
  assert.equal(list.children.length, 0);
  assert.equal(ui.dialogs.inventory.querySelector('.mp-inventory-summary').textContent, 'Join multiplayer to load the server manifest.');
});
