import * as THREE from 'three';

export function createLighting(renderer, scene) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 650 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00015;
  sun.shadow.normalBias = .16;
  scene.add(sun, sun.target);
  const ambient = new THREE.HemisphereLight(0xc4ddf4, 0x393326, .4);
  scene.add(ambient);

  // A prefiltered sky/ground environment gives metal something to reflect.
  // It supplies lighting only; the existing atmosphere still renders the sky.
  const data = new Float32Array(128 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const h = Math.cos(y / 63 * Math.PI), k = (y * 128 + x) * 4;
    const horizon = Math.exp(-Math.abs(h) * 7);
    const color = h > 0 ? [.16 + horizon * .25, .26 + horizon * .24, .42 + horizon * .18] : [.055, .049, .038];
    data.set([...color, 1], k);
  }
  const sky = new THREE.DataTexture(data, 128, 64, THREE.RGBAFormat, THREE.FloatType);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(sky);
  scene.environment = environment.texture;
  scene.environmentIntensity = .45;
  pmrem.dispose(); sky.dispose();
  const rotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  return {
    sun, ambient,
    update(normal, sunDirection, altitude) {
      sun.position.copy(sunDirection).multiplyScalar(320);
      sun.target.position.set(0, 0, 0);
      ambient.position.copy(normal);
      const daylight = THREE.MathUtils.smoothstep(normal.dot(sunDirection), -.12, .35);
      ambient.intensity = .08 + .35 * daylight * Math.exp(-altitude / 60000);
      scene.environmentIntensity = .04 + .4 * daylight * Math.exp(-altitude / 90000);
      rotation.setFromUnitVectors(up, normal);
      scene.environmentRotation.setFromQuaternion(rotation);
      sun.castShadow = altitude < 1500;
    },
    dispose() { environment.dispose(); sun.shadow.dispose(); },
  };
}
