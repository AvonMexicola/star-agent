import { Box3, Matrix4, Vector3 } from 'three';
import { SHIP_LAYOUT } from './boarding.js';

// Visual heat-flux proxy q*v, in W/m². This is deliberately not a temperature
// or damage simulation. Density comes from the same flight environment as drag.
export const REENTRY = Object.freeze({ onset: 5e6, full: 1e8, heatSeconds: 1.5, coolSeconds: 8 });
export function reentryTarget(density, speed) {
  if (!Number.isFinite(density) || !Number.isFinite(speed) || density <= 0 || speed <= 0) return 0;
  const flux = .5 * density * speed ** 3;
  const t = Math.max(0, Math.min(1, (flux - REENTRY.onset) / (REENTRY.full - REENTRY.onset)));
  return t * t * (3 - 2 * t);
}
export function stepReentry(heat, density, speed, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Re-entry dt must be finite and non-negative');
  if (!Number.isFinite(heat) || heat < 0 || heat > 1) throw new RangeError('Re-entry heat must be between zero and one');
  const target = reentryTarget(density, speed);
  return target + (heat - target) * Math.exp(-dt / (target > heat ? REENTRY.heatSeconds : REENTRY.coolSeconds));
}

const vertexDeclarations = `
varying vec3 vReentryPoint;
uniform mat4 reentryToHull;
`;
const fragmentDeclarations = `
varying vec3 vReentryPoint;
uniform vec3 reentryFlowView;
uniform float reentryHeat;
uniform float reentryTime;
uniform vec3 reentryCabinMin;
uniform vec3 reentryCabinMax;
`;
const emission = `
// Hull coordinates remain object-local when the camera origin is rebased.
vec3 reentryInside = step(reentryCabinMin, vReentryPoint) * step(vReentryPoint, reentryCabinMax);
float reentryExterior = 1.0 - reentryInside.x * reentryInside.y * reentryInside.z;
float reentryFacing = pow(max(0.0, dot(normalize(normal), reentryFlowView)), 1.6);
// Slow orange incandescence with a moving, finer yellow plasma pattern at high heat.
float reentryBands = 0.5 + 0.5 * sin(vReentryPoint.x * 19.0 + sin(vReentryPoint.y * 13.0)
  + vReentryPoint.z * 5.0 + reentryTime * 14.0);
float reentryFilaments = pow(reentryBands, 8.0) * smoothstep(0.35, 0.9, reentryHeat);
vec3 reentryColour = mix(vec3(1.0, 0.07, 0.006), vec3(1.0, 0.20, 0.025), reentryHeat);
float reentryGlow = reentryHeat * reentryHeat * reentryExterior * reentryFacing;
totalEmissiveRadiance += reentryColour * reentryGlow * (3.0 + 2.0 * reentryFilaments);
`;

/** Adds emissive heating to opaque standard hull materials, composing with the
 * existing weather shader. Materials are cloned per mesh: instruments and other
 * objects sharing the originals are never modified. No added draws or geometry.
 * The conservative cabin exclusion uses the shared boarding dimensions. A future
 * authored hull can override cabinBox or mark materials userData.reentry=false.
 */
export class ReentryHeating {
  constructor(ship, { cabinBox } = {}) {
    this.ship = ship;
    this.heat = 0;
    this.time = 0;
    this.disposed = false;
    this.entries = new Map();
    this.localFlow = new Vector3(0, 0, -1);
    this.inverseHull = new Matrix4();
    this.cabin = cabinBox || new Box3(
      new Vector3(SHIP_LAYOUT.interior.minX - .15, SHIP_LAYOUT.floorY - .1, SHIP_LAYOUT.interior.minZ - .1),
      new Vector3(SHIP_LAYOUT.interior.maxX + .15, SHIP_LAYOUT.flightBounds.max[1], SHIP_LAYOUT.hatch.z + .2),
    );
    this.uniforms = {
      reentryHeat: { value: 0 }, reentryTime: { value: 0 },
      reentryFlowView: { value: new Vector3(0, 0, -1) },
      reentryCabinMin: { value: this.cabin.min.clone() }, reentryCabinMax: { value: this.cabin.max.clone() },
    };
    this.refresh();
  }

  refresh() {
    if (this.disposed) return;
    this.ship.traverse(mesh => {
      if (!mesh.isMesh || this.entries.has(mesh)) return;
      const original = mesh.material;
      const toHull = { value: new Matrix4() };
      const originals = Array.isArray(original) ? original : [original];
      const materials = originals.map(material => {
        if (!material.isMeshStandardMaterial || material.transparent || (material.emissiveIntensity > .8 && material.emissive.getHex() !== 0)
            || material.userData.reentry === false || material.userData.unweathered) return material;
        const clone = material.clone();
        const before = material.onBeforeCompile;
        const cacheKey = material.customProgramCacheKey();
        clone.onBeforeCompile = (shader, renderer) => {
          before.call(clone, shader, renderer);
          Object.assign(shader.uniforms, this.uniforms, { reentryToHull: toHull });
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\n' + vertexDeclarations)
            .replace('#include <project_vertex>', 'vReentryPoint = (reentryToHull * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + fragmentDeclarations)
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emission);
        };
        clone.customProgramCacheKey = () => cacheKey + '|reentry-v1';
        return clone;
      });
      const assigned = Array.isArray(original) ? materials : materials[0];
      mesh.material = assigned;
      this.entries.set(mesh, { original, assigned, originals, materials, toHull });
    });
  }

  // Called after ship/camera pose updates. Rendering matrices contain only local
  // positions; density and velocity stay in the double-precision simulation.
  update({ density = 0, velocity, active = true, reset = false }, dt, camera) {
    if (this.disposed) return;
    if (reset) this.heat = 0;
    this.heat = stepReentry(this.heat, active && !reset ? density : 0, velocity?.length() || 0, dt);
    this.time += Math.max(0, dt);
    this.uniforms.reentryHeat.value = this.heat;
    this.uniforms.reentryTime.value = this.time;
    this.ship.updateWorldMatrix(true, true);
    camera.updateWorldMatrix(true, false);
    if (active && velocity?.lengthSq() > 1) {
      this.localFlow.copy(velocity).transformDirection(this.inverseHull.copy(this.ship.matrixWorld).invert());
    }
    this.uniforms.reentryFlowView.value.copy(this.localFlow).transformDirection(this.ship.matrixWorld)
      .transformDirection(camera.matrixWorldInverse);
    // Walk the hierarchy only on explicit refresh (e.g. after an asset load).
    // Form mesh-to-hull matrices down the local parent chain, never by subtracting
    // two large world matrices. Animated children such as doors remain correct.
    for (const [mesh, entry] of this.entries) {
      entry.toHull.value.identity();
      for (let node = mesh; node && node !== this.ship; node = node.parent) entry.toHull.value.premultiply(node.matrix);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [mesh, entry] of this.entries) {
      if (mesh.material === entry.assigned) mesh.material = entry.original;
      entry.materials.forEach((material, i) => { if (material !== entry.originals[i]) material.dispose(); });
    }
    this.entries.clear();
  }
}
