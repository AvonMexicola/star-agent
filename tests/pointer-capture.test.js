import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as THREE from 'three';

// Exercise the actual entry/picking/drag closures without creating a renderer.
// The optional source path is only for replaying a preserved pre-fix main.js.
const mainURL = process.env.POINTER_CAPTURE_SOURCE
  ? pathToFileURL(resolve(process.env.POINTER_CAPTURE_SOURCE))
  : new URL('../src/main.js', import.meta.url);
const main = fs.readFileSync(mainURL, 'utf8');
const navigation = fs.readFileSync(new URL('../src/navigation.js', import.meta.url), 'utf8');
function between(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing actual-source boundary: ${start}`);
  return source.slice(a, b);
}
function actualLine(source, start) {
  const lines = source.split('\n').filter(line => line.trimStart().startsWith(start));
  assert.equal(lines.length, 1, `Expected one actual-source line: ${start}`);
  return lines[0];
}
const enterSource = between(main, '  function enterPlayerInterface(){', '  nav.onTakeControl=');
const captureAndDragSource = between(main, '  const mfdRaycaster=', "  const help=$('help-dialog');");
const closeHelpSource = actualLine(main, 'function closeHelp(){');
const helpFlySource = actualLine(main, "$('help-fly').addEventListener('click',");
const launchRegistration = main.match(/launch\.querySelector\('button'\)\.addEventListener\('click',capture\);/g);
assert.equal(launchRegistration?.length, 1, 'Kestrel launch must retain its real capture registration');
const navCaptureSource = actualLine(navigation, 'capture(){');

class Target {
  listeners = new Map();
  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback); this.listeners.set(type, listeners);
  }
  emit(type, fields = {}) {
    // These are CPU event-shaped objects, not trusted browser input receipts.
    const event = {type, target: this, ...fields};
    for (const callback of this.listeners.get(type) ?? []) callback(event);
    return event;
  }
}
const click = (fields = {}) => ({clientX: 30, clientY: 40, button: 0,
  pointerType: 'mouse', sourceCapabilities: null, detail: 1, ...fields});
const touch = (fields = {}) => click({pointerType: 'touch', sourceCapabilities: {firesTouchEvents: true}, ...fields});

function fixture(options = {}) {
  const calls = {locks: 0, mfd: 0, picks: 0, enter: 0, helpClosed: 0, look: [], sharedLook: [], notifications: []};
  const elements = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, new Target()); return elements.get(id); };
  const canvas = $('viewport'), body = new Target(), document = new Target(), window = new Target();
  const classes = new Set(), chrome = [{inert: false}, {inert: false}, {inert: false}];
  body.classList = {contains: name => classes.has(name), add(name) { classes.add(name); calls.enter++; }};
  document.body = body; document.hidden = false; document.pointerLockElement = null;
  document.querySelectorAll = selector => { assert.equal(selector, '.topbar,.mission-panel,.statusbar'); return chrome; };
  document.querySelector = selector => { assert.equal(selector, 'dialog[open]'); return help.open ? help : null; };
  canvas.getBoundingClientRect = () => ({left: 10, top: 20, width: 800, height: 600});
  canvas.setPointerCapture = () => {};
  canvas.requestPointerLock = () => {
    calls.locks++; document.pointerLockElement = canvas; nav.locked = true;
    document.emit('pointerlockchange');
  };
  const nav = {canvas, powered: true, mode: 'flight', enabled: true, focused: true, locked: false,
    controllerActive: false, notify: message => calls.notifications.push(message),
    look: (yaw, pitch) => calls.look.push([yaw, pitch]), ...options.nav};
  const help = $('help-dialog'); help.open = !!options.helpOpen;
  help.close = () => { help.open = false; calls.helpClosed++; };
  const launchButton = $('kestrel-begin'), launch = {querySelector(selector) { assert.equal(selector, 'button'); return launchButton; }};
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 800 / 600, .08, 100);
  camera.updateMatrixWorld(true);
  const ship = new THREE.Group(), actionFrame = new THREE.Group();
  actionFrame.position.set(0, 0, -3); actionFrame.userData.action = () => { calls.mfd++; };
  // A genuine plane and Three ray intersection exercise the real parent-action
  // lookup. No stub decides whether an MFD was consumed.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial());
  actionFrame.add(screen); ship.add(actionFrame); scene.add(ship); scene.updateMatrixWorld(true);
  const context = vm.createContext({THREE, $, canvas, scene, camera, ship, nav, document, window, help, launch,
    transiting: !!options.transiting, opening: options.opening ?? null,
    multiplayer: {captureLook: (yaw, pitch) => calls.sharedLook.push([yaw, pitch])},
    MutationObserver: class { observe() {} }});
  vm.runInContext(`${enterSource}\nnav.onTakeControl=enterPlayerInterface;\nnav.capture=({${navCaptureSource}}).capture.bind(nav);\n${captureAndDragSource}\n${closeHelpSource}\n${helpFlySource}\n${launchRegistration[0]}\nglobalThis.subject={capture,activateMFD,canDrag,mfdRaycaster};`, context);
  const raycaster = context.subject.mfdRaycaster;
  const setFromCamera = raycaster.setFromCamera.bind(raycaster);
  raycaster.setFromCamera = (...args) => { calls.picks++; return setFromCamera(...args); };
  function drag(dx, pointerId = 2) {
    canvas.emit('pointerdown', {button: 0, pointerId, pointerType: 'touch', clientX: 156, clientY: 270.08});
    canvas.emit('pointermove', {pointerId, pointerType: 'touch', clientX: 156 + dx, clientY: 270.08});
    canvas.emit('pointerup', {pointerId, pointerType: 'touch', clientX: 156 + dx, clientY: 270.08});
    canvas.emit('lostpointercapture', {pointerId, pointerType: 'touch'});
  }
  return {calls, nav, $, canvas, help, context, chrome, classes, drag, ...context.subject};
}
function entered(f) {
  assert.equal(f.classes.has('player-active'), true, 'Input must still enter the player interface');
  assert.ok(f.chrome.every(element => element.inert), 'Landing chrome must become inert');
}
function unlocked(f) {
  assert.equal(f.calls.locks, 0, 'Touch must not request pointer lock');
  assert.equal(f.nav.locked, false); entered(f);
}

test('native receipt shape: small touch click cannot disable the following real drag closure', () => {
  const f = fixture(); f.drag(6);
  assert.deepEqual(f.calls.look, [[-.012, -0]]);
  f.canvas.emit('click', touch({clientX: 162, clientY: 270.08}));
  const before = f.calls.look.length; f.drag(80, 3);
  assert.equal(f.calls.look.length, before + 1, 'The second touch gesture must still reach nav.look');
  assert.deepEqual(f.calls.look.at(-1), [-.16, -0]);
  assert.deepEqual(f.calls.sharedLook, f.calls.look); unlocked(f);
});

test('touch provenance works independently for modern and legacy click shapes', () => {
  for (const event of [touch({sourceCapabilities: null}), touch({sourceCapabilities: {firesTouchEvents: false}}),
    click({pointerType: undefined, sourceCapabilities: {firesTouchEvents: true}}),
    click({sourceCapabilities: {firesTouchEvents: true}})]) {
    const f = fixture(); f.canvas.emit('click', event); unlocked(f);
  }
});

test('mouse capture remains available on desktop and hybrid touch-capable devices', () => {
  for (const event of [click(), click({sourceCapabilities: {firesTouchEvents: false}})]) {
    const f = fixture(); f.canvas.emit('click', event);
    assert.equal(f.calls.locks, 1); assert.equal(f.nav.locked, true); entered(f);
  }
});

test('keyboard activation and intentional no-event calls retain capture without MFD coordinate errors', () => {
  for (const event of [undefined, null, {type: 'keydown', code: 'Enter'},
    {type: 'click', detail: 0, pointerType: '', clientX: 0, clientY: 0}]) {
    const f = fixture(); assert.doesNotThrow(() => f.capture(event));
    assert.equal(f.calls.locks, 1); assert.equal(f.calls.mfd, 0); entered(f);
  }
});

test('missing, nonfinite and nonnumeric coordinates cannot accidentally activate a display', () => {
  for (const point of [{}, {clientX: NaN, clientY: 320}, {clientX: 410, clientY: Infinity}, {clientX: '410', clientY: 320}]) {
    const f = fixture(); f.capture({...point, pointerType: 'touch'});
    assert.equal(f.calls.picks, 0, 'An absent or invalid point must not reach the real raycaster');
    assert.equal(f.calls.mfd, 0); unlocked(f);
  }
});

test('transit, disabled navigation and active opening still reject background capture', () => {
  for (const options of [{transiting: true}, {nav: {enabled: false}}, {opening: {active: true}}]) {
    for (const event of [click(), touch()]) {
      const f = fixture(options); f.capture(event);
      assert.equal(f.calls.locks, 0); assert.equal(f.calls.enter, 0); assert.equal(f.calls.mfd, 0);
    }
  }
});

test('the real Navigation.capture crashed-state guard is preserved', () => {
  const f = fixture({nav: {mode: 'crashed'}}); f.capture(click());
  assert.equal(f.calls.locks, 0); entered(f);
});

test('actual Three MFD triangle hits consume touch and mouse before interface/capture', () => {
  for (const event of [click(), touch(), click({pointerType: undefined, sourceCapabilities: {firesTouchEvents: true}})]) {
    const f = fixture(); f.canvas.emit('click', {...event, clientX: 410, clientY: 320});
    assert.equal(f.calls.picks, 1);
    assert.equal(f.calls.mfd, 1, 'A hit must invoke the real ancestor action');
    assert.equal(f.calls.locks, 0); assert.equal(f.calls.enter, 0);
  }
});

test('MFD power, movement-mode and dialog picking guards remain intact', () => {
  for (const options of [{nav: {powered: false}}, {nav: {mode: 'walk'}}, {helpOpen: true}]) {
    const f = fixture(options); f.capture(touch({clientX: 410, clientY: 320}));
    assert.equal(f.calls.picks, 0); assert.equal(f.calls.mfd, 0); unlocked(f);
  }
});

test('Help Fly forwards modern and legacy touch provenance through the actual registered callback', () => {
  for (const event of [touch(), click({pointerType: undefined, sourceCapabilities: {firesTouchEvents: true}})]) {
    const f = fixture({helpOpen: true, nav: {enabled: false}}); f.$('help-fly').emit('click', event);
    assert.equal(f.calls.helpClosed, 1); assert.equal(f.help.open, false); assert.equal(f.nav.enabled, true); unlocked(f);
  }
});

test('Help Fly still resumes mouse and keyboard control, but cannot resume during transit', () => {
  for (const event of [click(), {pointerType: '', detail: 0, clientX: 0, clientY: 0}]) {
    const f = fixture({helpOpen: true, nav: {enabled: false}}); f.$('help-fly').emit('click', event);
    assert.equal(f.calls.helpClosed, 1); assert.equal(f.calls.locks, 1); entered(f);
  }
  const blocked = fixture({helpOpen: true, nav: {enabled: false}, transiting: true});
  blocked.$('help-fly').emit('click', touch());
  assert.equal(blocked.nav.enabled, false); assert.equal(blocked.calls.enter, 0); assert.equal(blocked.calls.locks, 0);
});

test('Begin and Kestrel launch registrations preserve touch identity and mouse capture', () => {
  for (const id of ['begin-button', 'kestrel-begin']) {
    const f = fixture(); f.$(id).emit('click', touch()); unlocked(f);
    const mouse = fixture(); mouse.$(id).emit('click', click()); assert.equal(mouse.calls.locks, 1); entered(mouse);
  }
});

test('repeated eligible entry keeps the real interface transition idempotent', () => {
  const f = fixture(); f.capture(touch()); f.capture(touch());
  assert.equal(f.calls.enter, 1); unlocked(f);
});
