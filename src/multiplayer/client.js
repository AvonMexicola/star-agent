import * as THREE from 'three';
import { cleanInput, MAX_PLAYERS, MULTIPLAYER_VERSION, WORLD_SEED } from './protocol.js';

const OPEN = 1;
const SEND_INTERVAL = 1 / 20;
const clamp = value => Math.max(-1, Math.min(1, value));
const finiteArray = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const axis = (keys, positive, negative, analog = 0) => clamp(Number(keys?.has?.(positive)) - Number(keys?.has?.(negative)) + (Number.isFinite(analog) ? analog : 0));

export function websocketURL(locationObject = globalThis.location) {
  if (!locationObject) return 'ws://127.0.0.1:8084/ws';
  return `${locationObject.protocol === 'https:' ? 'wss:' : 'ws:'}//${locationObject.host}/ws`;
}

export function navigationInput(nav, pad = {}, { mouseYaw = 0, mousePitch = 0, fire = false } = {}) {
  const blocked = !nav?.enabled || !nav.focused || globalThis.document?.hidden || globalThis.document?.querySelector?.('dialog[open]');
  if (blocked) return cleanInput();
  const keys = nav.keys;
  const eva = nav.mode === 'eva';
  const walking = nav.mode === 'walk';
  return cleanInput({
    forward: axis(keys, 'KeyW', 'KeyS', pad.forward),
    strafe: axis(keys, 'KeyD', 'KeyA', pad.strafe),
    vertical: eva
      ? axis(keys, 'Space', 'KeyC', pad.evaVertical)
      : walking ? 0 : axis(keys, 'Space', 'KeyC', pad.vertical),
    yaw: axis(keys, 'ArrowLeft', 'ArrowRight', pad.yaw),
    pitch: axis(keys, 'ArrowUp', 'ArrowDown', pad.pitch),
    roll: axis(keys, 'KeyE', 'KeyQ', pad.roll),
    boost: Boolean(keys?.has?.('ShiftLeft') || keys?.has?.('ShiftRight') || pad.boost),
    brake: Boolean(keys?.has?.('KeyX') || (eva ? pad.evaBrake : pad.brake)),
    jump: Boolean(walking && (keys?.has?.('Space') || pad.jump)),
    fire: Boolean(fire || (nav.mode === 'flight' ? pad.jump : (pad.mine ?? 0) > .1)),
    mouseYaw, mousePitch,
  });
}

function setVector(target, value, blend, snap = false) {
  if (!finiteArray(value, 3)) return target;
  if (!target?.isVector3) target = new THREE.Vector3();
  const source = new THREE.Vector3().fromArray(value);
  if (snap || target.distanceToSquared(source) > 10000) target.copy(source);
  else target.lerp(source, blend);
  return target;
}

function setQuaternion(target, value, blend, snap = false) {
  if (!finiteArray(value, 4)) return target;
  if (!target?.isQuaternion) target = new THREE.Quaternion();
  const source = new THREE.Quaternion().fromArray(value).normalize();
  if (snap) target.copy(source); else target.slerp(source, blend);
  return target.normalize();
}

function reviveVector(value) {
  if (finiteArray(value, 3)) return new THREE.Vector3().fromArray(value);
  if (value && [value.x, value.y, value.z].every(Number.isFinite)) return new THREE.Vector3(value.x, value.y, value.z);
  return value;
}

export function reviveTravel(value) {
  if (!value || typeof value !== 'object') return null;
  const plan = value.plan && typeof value.plan === 'object' ? {
    ...value.plan,
    start: reviveVector(value.plan.start),
    end: reviveVector(value.plan.end),
    direction: reviveVector(value.plan.direction),
  } : value.plan;
  if (plan?.kind === 'free' && plan.duration == null) plan.duration = Infinity;
  return { ...value, plan };
}

/** Reconcile prediction toward a server-owned peer. Discrete action state is
 * applied exactly; small pose error is blended and large/mode-changing error snaps.
 */
export function applyAuthoritativePeer(nav, peer, { blend = .38, snap = false } = {}) {
  if (!nav || !peer) return false;
  const modeChanged = typeof peer.mode === 'string' && peer.mode !== nav.mode;
  const frameChanged = (peer.physicsFrame ?? null) !== (nav.authoritativePhysicsFrame ?? null);
  const hard = snap || modeChanged || frameChanged;
  nav.authoritativePhysicsFrame = peer.physicsFrame ?? null;
  nav.position = setVector(nav.position, peer.position, blend, hard);
  nav.orientation = setQuaternion(nav.orientation, peer.orientation, blend, hard);
  nav.velocity = setVector(nav.velocity, peer.velocity, 1, true);
  nav.angularVelocity = setVector(nav.angularVelocity, peer.angularVelocity, 1, true);
  nav.multiplayerShipPosition = setVector(nav.multiplayerShipPosition, peer.shipPosition, blend, hard);
  if (peer.parkedShipPosition == null) nav.shipPosition = null;
  else nav.shipPosition = setVector(nav.shipPosition, peer.parkedShipPosition, blend, hard);
  nav.shipOrientation = setQuaternion(nav.shipOrientation, peer.shipOrientation, blend, hard);
  nav.shipVelocity = setVector(nav.shipVelocity, peer.shipVelocity, 1, true);
  nav.shipAngularVelocity = setVector(nav.shipAngularVelocity, peer.shipAngularVelocity, 1, true);
  for (const key of ['powered', 'cabinFlight', 'insideShip', 'dockedAtStation', 'stationLift', 'doorOpen', 'gearDeployed', 'flightAssist', 'combatMode', 'autoland', 'spaceParked', 'shipLightsOn', 'flashlightOn']) {
    if (typeof peer[key] === 'boolean') nav[key] = peer[key];
  }
  for (const key of ['doorProgress', 'gearProgress', 'jumpHeight', 'jumpVelocity', 'speedScale']) {
    if (Number.isFinite(peer[key])) nav[key] = peer[key];
  }
  if (typeof peer.shipId === 'string') nav.shipId = peer.shipId;
  if (Array.isArray(peer.freighter)&&nav.freighter)for(const state of peer.freighter){const lift=nav.freighter.lifts.find(l=>l.id===state.id);if(lift&&Number.isFinite(state.y)&&Number.isFinite(state.target)){lift.y=state.y;lift.target=state.target;}}
  if (typeof peer.mode === 'string') nav.mode = peer.mode;
  nav.multiplayerDead = peer.mode === 'dead' || peer.health <= 0 || peer.shipHealth <= 0;
  nav.travel = reviveTravel(peer.travel);
  nav.multiplayerTravel = nav.travel;
  if (peer.travel || peer.travelTarget != null || hard) nav.travelTarget = peer.travelTarget ?? null;
  if (nav.multiplayerDead) { nav.keys?.clear?.(); nav.velocity?.set?.(0, 0, 0); }
  return true;
}

function publicState(account = null) {
  return {
    connected: false, account, ownId: null, players: [], maxPlayers: MAX_PLAYERS,
    hangar: null, inventory: null, commerce: null, health: null, doors: null, drops: [], error: null,
    stationFrame: null, hub: null, defense: [],
  };
}

function serialTarget(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (value.toArray) return value.toArray();
  if (value.point?.toArray) return { id: value.id ?? null, point: value.point.toArray() };
  if (typeof value === 'object') return JSON.parse(JSON.stringify(value));
  return value;
}

/** Same-origin authenticated WebSocket client. Cookies ride the handshake;
 * credentials and reset tokens are never copied into the socket URL or storage.
 */
export class MultiplayerClient {
  constructor({ url = websocketURL(), WebSocketImpl = globalThis.WebSocket, requestTimeout = 10000, now = () => performance.now() } = {}) {
    this.url = url; this.WebSocketImpl = WebSocketImpl; this.requestTimeout = requestTimeout; this.now = now;
    this.state = publicState(); this.socket = null; this.sequence = 0; this.requestSequence = 0;
    this.listeners = new Set(); this.eventListeners = new Set(); this.pending = new Map();
    this.nav = null; this.station = null; this.remotePlayers = null; this.lastPad = {};
    this.accumulator = 0; this.mouseYaw = 0; this.mousePitch = 0; this.keyFire = false; this.pointerFire = false;
    this.restoreMethods = new Map(); this.cleanup = [];
  }

  get connected() { return this.state.connected; }
  subscribe(listener) { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  onEvent(listener) { this.eventListeners.add(listener); return () => this.eventListeners.delete(listener); }
  _publish(patch) {
    this.state = { ...this.state, ...patch };
    if (this.nav) this.nav.multiplayer = this.state;
    for (const listener of this.listeners) listener(this.state);
  }
  _emit(event) { for (const listener of this.eventListeners) listener(event); }

  connect(account) {
    if (this.socket?.readyState === OPEN && this.connected) return Promise.resolve(this.state);
    if (!this.WebSocketImpl) return Promise.reject(new Error('This browser does not provide WebSocket support.'));
    this.disconnect({ preserveAccount: true });
    this._publish({ ...publicState(account), account, error: null });
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.url); this.socket = socket;
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return; settled = true; socket.close?.(4000, 'Welcome timeout'); reject(new Error('The multiplayer server did not answer.'));
      }, this.requestTimeout);
      const fail = error => {
        if (settled) return; settled = true; clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error('The multiplayer connection failed.'));
      };
      socket.addEventListener('message', event => {
        if (this.socket !== socket) return;
        const message = this._message(event.data);
        if (message?.type === 'welcome' && !settled) {
          settled = true; clearTimeout(timeout);
          this.connected ? resolve(this.state) : reject(new Error(this.state.error || 'The server rejected this build.'));
        }
      });
      socket.addEventListener('error', () => fail(new Error('The multiplayer connection failed.')));
      socket.addEventListener('close', event => {
        clearTimeout(timeout); if (!settled) fail(new Error(event.reason || 'The multiplayer connection closed.'));
        if (this.socket === socket) {
          const wasConnected = this.connected; this.socket = null; this._rejectPending('The multiplayer connection closed.'); this._clearWorld();
          this._publish({ connected: false, ownId: null, players: [], hangar: null, inventory: null, commerce: null, health: null, error: event.reason || 'Connection lost.' });
          if (wasConnected) { if (this.nav) { this.nav.enabled = false; this.nav.keys?.clear?.(); } this._emit({ type: 'event', event: 'disconnect', message: event.reason || 'Multiplayer connection lost.' }); }
        }
      });
    });
  }

  disconnect({ preserveAccount = true } = {}) {
    const socket = this.socket; this.socket = null;
    if (socket && socket.readyState < 2) socket.close(1000, 'Left multiplayer');
    this._rejectPending('Left multiplayer.'); this._clearWorld();
    this._publish(publicState(preserveAccount ? this.state.account : null));
  }

  _clearWorld() {
    this.remotePlayers?.sync?.([], null);
    this.station?.setMultiplayerState?.(null);
    this.nav?.onStationHubState?.(null);
  }

  _message(raw) {
    let message;
    try { message = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); }
    catch { return null; }
    if (!message || typeof message !== 'object') return null;
    if (message.type === 'welcome') {
      if (message.seed !== WORLD_SEED || (message.version != null && message.version !== MULTIPLAYER_VERSION)) {
        this.socket?.close?.(4001, 'Build mismatch'); this._publish({ error: 'Server world does not match this build.' }); return message;
      }
      const patch = {
        connected: true, ownId: message.id, maxPlayers: message.maxPlayers ?? MAX_PLAYERS,
        players: Array.isArray(message.players) ? message.players : [], inventory: message.inventory ?? null, commerce: message.commerce ?? null,
        health: message.health ?? message.inventory?.health ?? null, doors: message.doors ?? null,
        hangar: message.hangar ?? null, stationFrame: message.stationFrame ?? null, hub: message.hub ?? null, defense: message.defense ?? [],
        drops: Array.isArray(message.drops) ? message.drops : [], error: null,
      };
      this._publish(patch); this._applyWorld(message, true); return message;
    }
    if (message.type === 'state') {
      const patch = {
        players: Array.isArray(message.players) ? message.players : this.state.players,
        inventory: message.inventory ?? this.state.inventory, commerce: message.commerce ?? this.state.commerce, health: message.health ?? message.inventory?.health ?? this.state.health,
        doors: message.doors ?? this.state.doors, hangar: message.hangar === undefined ? this.state.hangar : message.hangar,
        stationFrame: message.stationFrame ?? this.state.stationFrame, hub: message.hub ?? this.state.hub, defense: message.defense ?? this.state.defense,
        drops: Array.isArray(message.drops) ? message.drops : this.state.drops,
      };
      this._publish(patch); this._applyWorld(message, false); return message;
    }
    if (message.type === 'ack') {
      const request = this.pending.get(message.requestId);
      if (request) { clearTimeout(request.timeout); this.pending.delete(message.requestId); message.ok ? request.resolve(message) : request.reject(new Error(message.error || 'Server rejected the request.')); }
      return message;
    }
    if (message.type === 'event') { if(message.event==='stationHub')this.nav?.onStationHubEvent?.(message);this._emit(message); return message; }
    if (message.type === 'revoked') {
      this.disconnect({ preserveAccount: false });
      this._publish({ error: message.error || 'Your multiplayer session ended.' });
      return message;
    }
    return message;
  }

  _applyWorld(message, snap) {
    const players = Array.isArray(message.players) ? message.players : this.state.players;
    const own = players.find(player => player.id === this.state.ownId);
    if (own && this.nav) applyAuthoritativePeer(this.nav, own, { snap });
    this.remotePlayers?.sync?.(players, this.state.ownId);
    this.station?.setMultiplayerState?.({ doors: message.doors ?? this.state.doors, hangar: message.hangar === undefined ? this.state.hangar : message.hangar, frame: message.stationFrame ?? this.state.stationFrame, physicsFrame: own?.physicsFrame ?? null, hub: message.hub ?? this.state.hub, defense: message.defense ?? this.state.defense });
    this.nav?.onStationHubState?.(message.hub ?? this.state.hub);
  }

  _rejectPending(reason) {
    for (const request of this.pending.values()) { clearTimeout(request.timeout); request.reject(new Error(reason)); }
    this.pending.clear();
  }
  _send(message) {
    if (this.socket?.readyState !== OPEN) return false;
    this.socket.send(JSON.stringify(message)); return true;
  }
  action(action, target) { return this._send({ type: 'action', action, ...(target === undefined ? {} : { target: serialTarget(target) }) }); }
  request(action, fields = {}) {
    if (this.socket?.readyState !== OPEN || !this.connected) return Promise.reject(new Error('Join multiplayer before sending that request.'));
    const requestId = `${++this.requestSequence}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(requestId); reject(new Error('The server did not confirm the request.')); }, this.requestTimeout);
      this.pending.set(requestId, { resolve, reject, timeout });
      if (!this._send({ type: 'request', requestId, action, ...fields })) { clearTimeout(timeout); this.pending.delete(requestId); reject(new Error('The multiplayer connection is unavailable.')); }
    });
  }
  requestHangar() { return this.request('hangar'); }
  cancelHangar() { return this.request('cancelHangar'); }
  transfer(fields) { return this.request('transfer', fields); }
  drop(fields) { return this.request('drop', fields); }
  pickup(id) { return this.request('pickup', { id }); }
  equip(fields) { return this.request('equip', fields); }
  respawn() { return this.request('respawn'); }
  captureLook(yaw, pitch) {
    if (!this.connected) return;
    if (Number.isFinite(yaw)) this.mouseYaw += yaw;
    if (Number.isFinite(pitch)) this.mousePitch += pitch;
  }

  attach({ nav, station = null, remotePlayers = null } = {}) {
    this.detach(); this.nav = nav; this.station = station; this.remotePlayers = remotePlayers;
    if (!nav) return this;
    nav.multiplayer = this.state;
    const originalPoll = nav.gamepad.poll.bind(nav.gamepad);
    nav.gamepad.poll = options => { const result = originalPoll(options); this.lastPad = result; return result; };
    this.cleanup.push(() => { nav.gamepad.poll = originalPoll; });
    const actions = new Map([
      ['toggleGear', ['gear']], ['toggleLights', ['lights']], ['togglePower', ['power']], ['toggleFlightAssist', ['assist']], ['toggleCombatMode', ['combat']],
      ['landOrLaunch', ['land']], ['embark', ['interact']], ['toggleEVA', ['eva']], ['brake', ['brake']],
      ['cancelTravel', ['cancelTravel']], ['beginTravel', ['target', () => nav.travelTarget]],
      ['beginFreeTravel', ['travel']],
    ]);
    for (const [name, [action, target]] of actions) {
      if (typeof nav[name] !== 'function') continue;
      const original = nav[name]; const wrapper = (...args) => {
        if(this.connected&&name==='embark'&&!nav.stationHubTransit&&nav.cargoAction?.())return true;
        // The local target adapter owns charge/availability. Do not let the
        // legacy network command bypass its explicit targeted-drive gate.
        if (this.connected && nav.targeting && (name === 'beginTravel' || (name === 'beginFreeTravel' && nav.targeting.hasTarget))) return nav.targeting.engage();
        return this.connected ? this.action(action, target?.(...args)) : original.apply(nav, args);
      };
      this.restoreMethods.set(name, { original, wrapper }); nav[name] = wrapper;
    }
    if (typeof nav.updateTravel === 'function') {
      const name = 'updateTravel', original = nav[name];
      const wrapper = (...args) => this.connected ? undefined : original.apply(nav, args);
      this.restoreMethods.set(name, { original, wrapper }); nav[name] = wrapper;
    }
    const mouse = event => {
      if (!this.connected || !nav.enabled || globalThis.document?.querySelector?.('dialog[open]')) return;
      if (nav.locked) { this.mouseYaw += -event.movementX * .0018; this.mousePitch += -event.movementY * .0018; }
    };
    const keydown = event => { if (event.code === 'KeyT' && !event.repeat && !event.target?.closest?.('input,textarea,dialog')) this.keyFire = true; };
    const keyup = event => { if (event.code === 'KeyT') this.keyFire = false; };
    const pointerdown = event => { if (event.button === 0 && (nav.locked || event.target?.closest?.('.ship-trigger,.mining-trigger'))) this.pointerFire = true; };
    const pointerup = () => { this.pointerFire = false; };
    const neutral = () => { this.keyFire = false; this.pointerFire = false; this.mouseYaw = 0; this.mousePitch = 0; if (this.connected) this._sendInput(cleanInput()); };
    document.addEventListener('mousemove', mouse); document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
    document.addEventListener('pointerdown', pointerdown); window.addEventListener('pointerup', pointerup); window.addEventListener('blur', neutral); document.addEventListener('visibilitychange', neutral);
    this.cleanup.push(() => { document.removeEventListener('mousemove', mouse); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('pointerdown', pointerdown); window.removeEventListener('pointerup', pointerup); window.removeEventListener('blur', neutral); document.removeEventListener('visibilitychange', neutral); });
    return this;
  }

  detach() {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    if (this.nav) for (const [name, { original, wrapper }] of this.restoreMethods) if (this.nav[name] === wrapper) this.nav[name] = original;
    this.restoreMethods.clear();
    if (this.nav) delete this.nav.multiplayer;
    this.nav = null; this.station = null; this.remotePlayers = null;
  }

  _sendInput(input) { this._send({ type: 'input', input, sequence: ++this.sequence }); }
  update(dt) {
    if (!this.connected || !this.nav) return;
    this.accumulator += Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (this.accumulator < SEND_INTERVAL) return;
    this.accumulator %= SEND_INTERVAL;
    const input = navigationInput(this.nav, this.lastPad, { mouseYaw: this.mouseYaw, mousePitch: this.mousePitch, fire: this.keyFire || this.pointerFire });
    if(this.nav.carryingCargo)input.fire=false;
    this.mouseYaw = 0; this.mousePitch = 0; this._sendInput(input);
  }

  dispose() { this.disconnect({ preserveAccount: false }); this.detach(); this.listeners.clear(); this.eventListeners.clear(); }
}
