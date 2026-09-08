import {Quaternion, SpotLight, Vector3} from 'three';
import {FLOODLIGHT} from './floodlight-definition.js';
import {smooth} from './motion.js';

export const MAX_FLOODLIGHTS = 6;
export const MAX_FLOODLIGHT_SHADOWS = 2;
export const FLOODLIGHT_RANGE = 75;
export const floodlightFade = distance => 1 - smooth((distance - 180) / 80);
const pools = new WeakMap();
const up = new Vector3(0, 1, 0);

/** All intermediate coordinates remain JavaScript doubles. The pool subtracts
 * the camera origin before these positions reach renderer matrices. */
export function floodlightFixture(claim, piece) {
  const rotation = new Quaternion().fromArray(claim.quaternion);
  const point = offset => new Vector3(...offset).applyAxisAngle(up, piece.rotation ?? 0)
    .add(new Vector3(...piece.position)).applyQuaternion(rotation).add(new Vector3(...claim.origin));
  return {id: `${claim.id}/${piece.id}`, position: point(FLOODLIGHT.emitter), target: point(FLOODLIGHT.target)};
}

class FloodlightPool {
  constructor(scene) {
    this.scene = scene;
    this.owners = new Map();
    this.lights = Array.from({length: MAX_FLOODLIGHTS}, (_, i) => {
      const light = new SpotLight(0xffe6c9, 0, FLOODLIGHT_RANGE, .69, .48, 2);
      light.name = `Construction floodlight ${i + 1}`;
      light.visible = false;
      // The same two slots always own shadow maps: no allocation churn on a
      // camera turn, and no multiplication across settlement/player renderers.
      light.castShadow = i < MAX_FLOODLIGHT_SHADOWS;
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = .3;
      light.shadow.camera.far = FLOODLIGHT_RANGE;
      light.shadow.bias = -.00004;
      light.shadow.normalBias = .035;
      scene.add(light, light.target);
      return light;
    });
  }
  refresh(camera, origin) {
    const candidates = [...this.owners.values()].flatMap(fixtures => fixtures.map(fixture => ({
      ...fixture, distance: fixture.position.distanceTo(camera),
    }))).filter(f => f.distance < 260).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    this.lights.forEach((light, i) => {
      const fixture = candidates[i];
      light.visible = Boolean(fixture);
      light.intensity = fixture ? 5000 * floodlightFade(fixture.distance) : 0;
      light.userData.fixtureId = fixture?.id ?? null;
      if (fixture) {
        light.position.copy(fixture.position).sub(origin);
        light.target.position.copy(fixture.target).sub(origin);
      }
    });
  }
  get diagnostics() {
    return {
      max: MAX_FLOODLIGHTS, maxShadows: MAX_FLOODLIGHT_SHADOWS,
      active: this.lights.filter(l => l.visible).length,
      shadows: this.lights.filter(l => l.visible && l.castShadow).length,
      fixtures: this.lights.filter(l => l.visible).map(l => ({id: l.userData.fixtureId, intensity: l.intensity,
        position: l.position.toArray(), target: l.target.position.toArray(), shadow: l.castShadow})),
    };
  }
}

/** One shared budget per scene, regardless of how many base renderers exist. */
export function createFloodlights(scene) {
  let pool = pools.get(scene);
  if (!pool) { pool = new FloodlightPool(scene); pools.set(scene, pool); }
  const owner = Symbol('base floodlights');
  pool.owners.set(owner, []);
  let disposed = false;
  return {
    update(fixtures, camera, origin) {
      if (disposed) return;
      pool.owners.set(owner, fixtures);
      pool.camera = camera; pool.origin = origin;
      pool.refresh(camera, origin);
    },
    get diagnostics() { return pool.diagnostics; },
    dispose() {
      if (disposed) return;
      disposed = true;
      pool.owners.delete(owner);
      if (pool.owners.size) { if (pool.camera) pool.refresh(pool.camera, pool.origin); return; }
      for (const light of pool.lights) { scene.remove(light, light.target); light.dispose(); }
      pools.delete(scene);
    },
  };
}
