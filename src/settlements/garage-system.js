import {Vector3, Quaternion, Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, SRGBColorSpace} from 'three';
import {terminalPieceFrame} from '../trading/terminal-frames.js';
import {createGarageUI} from './garage-ui.js';
import {garageBayAvailable} from './garage-policy.js';
import {SETTLEMENTS} from './catalog.js';
const UP = new Vector3(0, 1, 0), FORWARD = new Vector3(0, 0, -1);

/** Solo compound services. Navigation, construction and the existing rover own
 * movement; this service only requests a checked unoccupied vehicle placement. */
export function createGarageSystem({scene, nav, settlements, ensureRover, getRover, sentry}) {
  const sites = settlements.layouts.filter(s => s.garage && SETTLEMENTS.some(civilian => civilian.id === s.id)).map(s => ({...s, frame: terminalPieceFrame(s.claim, s.garage.terminalPiece)}));
  const active = () => nav.multiplayer?.connected ? [] : sites.filter(s => settlements.claims.some(c => c.id === s.claim.id));
  const world = (s, p) => new Vector3(...p).applyQuaternion(new Quaternion(...s.claim.quaternion)).add(new Vector3(...s.claim.origin));
  function atTerminal(site) {
    return Boolean(site && active().includes(site) && nav.mode === 'walk' && !nav.insideShip && !nav.travel && !nav.openingActive && nav.position.distanceTo(site.frame.position) < 3.3);
  }
  function target() {
    if (!nav.enabled || !nav.focused || document.querySelector('dialog[open]')) return null;
    const forward = FORWARD.clone().applyQuaternion(nav.orientation);
    return active().find(s => atTerminal(s) && s.frame.position.clone().sub(nav.position).normalize().dot(forward) > .72) ?? null;
  }
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 480;
  const c = canvas.getContext('2d'); c.fillStyle = '#142c35'; c.fillRect(0, 0, 768, 480); c.strokeStyle = '#b1d7c1'; c.lineWidth = 5; c.strokeRect(3, 3, 762, 474);
  c.fillStyle = '#b1d7c1'; c.font = '25px sans-serif'; c.fillText('VEHICLE SERVICES', 40, 65); c.fillStyle = '#edf4ed'; c.font = '58px sans-serif'; c.fillText('GARAGE', 40, 157); c.font = '26px sans-serif'; c.fillText('BURROW  /  BURROW SENTRY', 40, 217); c.fillStyle = '#a8c7c6'; c.font = '22px sans-serif'; c.fillText('Mining rover  ·  Two-crew laser rover', 40, 270);
  c.fillStyle = '#b1d7c1'; c.fillRect(40, 320, 688, 93); c.fillStyle = '#142c35'; c.font = '30px sans-serif'; c.fillText('F / X   Retrieve vehicle', 65, 379);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  const sign = new Mesh(new PlaneGeometry(1.32, .825), new MeshBasicMaterial({map: texture, toneMapped: false})); sign.name = 'Garage terminal display'; sign.visible = false; scene.add(sign);
  const touch = document.createElement('button'); touch.id = 'garage-touch'; touch.hidden = true; touch.textContent = 'F / X · Garage'; document.body.append(touch);
  let ui;
  const api = {
    atTerminal, roverState: () => getRover()?.state ?? null, sentryState: () => sentry.garageState,
    async retrieve(site, kind, stillOpen) {
      if (!atTerminal(site)) return {ok: false, message: 'Return to the garage terminal.'};
      if (!['burrow', 'sentry'].includes(kind)) return {ok: false, message: 'Choose a garage vehicle.'};
      const position = world(site, site.garage.position), quaternion = new Quaternion(...site.claim.quaternion).multiply(new Quaternion().setFromAxisAngle(UP, site.garage.rotation));
      const other = () => kind === 'burrow' ? sentry.garageState : getRover()?.state;
      if (!garageBayAvailable(position.toArray(), other())) return {ok: false, message: 'Move the other rover out of the garage bay before deploying another vehicle.'};
      const vehicle = kind === 'burrow' ? ensureRover() : sentry;
      return vehicle.deployAt({position, quaternion, validate: () => stillOpen() && atTerminal(site) && garageBayAvailable(position.toArray(), other())});
    },
    interact() {const site = target(); return site ? ui.open(site) : false;},
    get interaction() {return target() ? 'F / X · OPEN VEHICLE GARAGE' : '';},
    update(origin) {
      const nearby = active().filter(s => s.frame.position.distanceTo(nav.position) < 36).sort((a, b) => a.frame.position.distanceToSquared(nav.position) - b.frame.position.distanceToSquared(nav.position))[0];
      sign.visible = Boolean(nearby); if (nearby) {sign.position.copy(nearby.frame.position).sub(origin); sign.quaternion.copy(nearby.frame.quaternion);}
      touch.hidden = !target(); ui.update();
    },
    get state() {return {available: active().length > 0, terminal: target()?.id ?? null, open: ui.site, sites: active().map(s => ({id: s.id, name: s.name, body: s.body, position: world(s, s.garage.position).toArray(), terminal: s.frame.position.toArray(), rotation: s.garage.rotation, rampEnd: world(s, s.garage.rampEnd).toArray(), rampRows: s.garage.rampRows}))};},
    dispose() {ui.dispose(); touch.remove(); sign.removeFromParent(); sign.geometry.dispose(); sign.material.dispose(); texture.dispose();},
  };
  ui = createGarageUI(api, nav); touch.onclick = () => api.interact(); return api;
}
