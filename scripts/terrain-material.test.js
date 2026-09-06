import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RADIUS } from '../src/world.js';
import {
  FINE_ALTITUDE,
  NOISE_CELL_PERIOD,
  OCTAVES,
  configureLandMaterial,
  createLandMaterial,
  updateLandMaterial,
} from '../src/terrain-material.js';

const shaderTemplate = () => ({
  uniforms: {},
  defines: {},
  vertexShader: `
    #include <common>
    #include <begin_vertex>
    #include <worldpos_vertex>
    #include <logdepthbuf_vertex>
  `,
  fragmentShader: `
    #include <common>
    #include <color_fragment>
    #include <roughnessmap_fragment>
    #include <normal_fragment_maps>
    #include <aomap_fragment>
    #include <logdepthbuf_fragment>
  `,
});

test('terrain material injects standard lighting inputs without removing logarithmic depth', () => {
  const material = createLandMaterial();
  const shader = shaderTemplate();
  material.onBeforeCompile(shader);

  assert.ok(material.isMeshStandardMaterial);
  assert.equal(material.vertexColors, true);
  assert.match(shader.vertexShader, /vTmWorld\s*=\s*\(modelMatrix/);
  assert.match(shader.fragmentShader, /roughnessFactor\s*=\s*tmRough/);
  assert.match(shader.fragmentShader, /normal\s*=\s*normalize\(mat3\(viewMatrix\) \* tmNormalW\)/);
  assert.match(shader.fragmentShader, /reflectedLight\.indirectDiffuse \*= tmAO/);
  assert.match(shader.fragmentShader, /& uvec3\(0x3fffff\)/);
  assert.match(shader.vertexShader, /#include <logdepthbuf_vertex>/);
  assert.match(shader.fragmentShader, /#include <logdepthbuf_fragment>/);
  assert.doesNotMatch(shader.fragmentShader, /smoothstep\(0\.965,\s*0\.885/);
  assert.doesNotMatch(shader.fragmentShader, /smoothstep\(0\.88,\s*0\.74/);
  assert.match(shader.fragmentShader, /1\.0 - smoothstep\(0\.885, 0\.965/);
  assert.match(shader.fragmentShader, /1\.0 - smoothstep\(0\.74, 0\.88/);
  material.dispose();
});

test('optional distant albedo uses the caller uniform objects and a distinct program', () => {
  const planetAlbedo = { value: new THREE.Texture() };
  const albedoReady = { value: 0.75 };
  const material = createLandMaterial({ planetAlbedo, albedoReady });
  const shader = shaderTemplate();
  material.onBeforeCompile(shader);

  assert.equal(shader.uniforms.planetAlbedo, planetAlbedo);
  assert.equal(shader.uniforms.albedoReady, albedoReady);
  assert.equal(shader.defines.TM_PLANET_ALBEDO, 1);
  assert.match(material.customProgramCacheKey(), /\+albedo$/);
  assert.match(shader.fragmentShader, /texture2D\(planetAlbedo/);
  material.dispose();
  planetAlbedo.value.dispose();
});

test('camera update keeps every noise cell exact and preserves its fractional split', () => {
  assert.ok(NOISE_CELL_PERIOD < 2 ** 24);
  assert.ok(NOISE_CELL_PERIOD * OCTAVES[0].size[0] > 200_000);
  assert.equal(FINE_ALTITUDE, 30_000);
  const material = configureLandMaterial(new THREE.MeshStandardMaterial());
  const origin = new THREE.Vector3(-0.6123456789, 0.487654321, 0.6222334455)
    .normalize().multiplyScalar(RADIUS + 123.456789);
  const sun = new THREE.Vector3(0.3, 0.4, 0.5).normalize();
  updateLandMaterial(material, { renderOrigin: origin, sunDirection: sun, time: 17.25, cameraAltitude: 91 });
  const uniforms = material.userData.tmUniforms;

  assert.ok(Math.abs(uniforms.tmCamHeight.value - 123.456789) < 1e-6);
  assert.equal(uniforms.tmAltitude.value, 91);
  assert.equal(uniforms.tmTime.value, 17.25);
  assert.deepEqual(uniforms.tmSun.value.toArray(), sun.toArray());
  assert.ok(Math.abs(uniforms.tmUp.value.length() - 1) < 1e-14);

  for (let index = 0; index < OCTAVES.length; index++) {
    const cell = uniforms.tmCell.value[index];
    const fraction = uniforms.tmFrac.value[index];
    for (const value of cell.toArray()) {
      assert.equal(Number.isInteger(value), true);
      assert.ok(value >= 0 && value < NOISE_CELL_PERIOD);
    }
    for (const value of fraction.toArray()) assert.ok(value >= 0 && value < 1);
  }

  // The finest unwrapped coordinate exceeds float's exact-integer range on
  // this planet; its wrapped cell remains exact and reconstructs modulo period.
  const finestUnwrapped = origin.clone().applyMatrix3(new THREE.Matrix3().set(0,.8,.6,-.8,.36,-.48,-.6,-.48,.64)).multiplyScalar(1 / OCTAVES[0].size[0]);
  assert.ok(finestUnwrapped.toArray().some(value => Math.abs(Math.floor(value)) >= 2 ** 24));
  const wrapped = value => ((Math.floor(value) % NOISE_CELL_PERIOD) + NOISE_CELL_PERIOD) % NOISE_CELL_PERIOD;
  assert.deepEqual(uniforms.tmCell.value[0].toArray(), finestUnwrapped.toArray().map(wrapped));
  material.dispose();
});

test('missing update inputs are harmless', () => {
  assert.doesNotThrow(() => updateLandMaterial(null));
  const material = createLandMaterial();
  const before = material.userData.tmUniforms.tmL.value;
  updateLandMaterial(material, {});
  assert.equal(material.userData.tmUniforms.tmL.value, before);
  material.dispose();
});
