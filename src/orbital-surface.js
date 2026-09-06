import * as THREE from 'three';
import { SEED } from './generation.js';

function texture(data, width, height, colorSpace) {
  const result = new THREE.DataTexture(data, width, height);
  result.colorSpace = colorSpace; result.wrapS = THREE.RepeatWrapping;
  result.minFilter = THREE.LinearMipmapLinearFilter; result.magFilter = THREE.LinearFilter;
  result.generateMipmaps = true; result.needsUpdate = true;
  return result;
}

/** Progressive body maps share stable uniforms. Near geometry remains usable
 * throughout generation; both colour and normal publish at the same resolution. */
export class OrbitalSurface {
  constructor(body) {
    this.body = body; this.resolution = 0; this.started = false; this.disposed = false;
    this.color = {value: texture(new Uint8Array([100,110,70,255]), 1, 1, THREE.SRGBColorSpace)};
    this.normal = {value: texture(new Uint8Array([128,128,255,128]), 1, 1, THREE.NoColorSpace)};
    this.ready = {value: 0};
  }
  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.worker = new Worker(new URL('./orbital-surface.worker.js', import.meta.url), {type:'module'});
    this.worker.onerror = error => { console.warn('Orbital detail retained at its available resolution.', error.message); this.worker.terminate(); };
    this.worker.onmessage = ({data}) => {
      if (this.disposed) return;
      if (data.done || data.error) {
        if (data.error) console.warn('Orbital detail retained at its available resolution.', data.error);
        this.worker.terminate(); return;
      }
      const color = texture(data.color, data.width, data.height, THREE.SRGBColorSpace);
      const normal = texture(data.normal, data.width, data.height, THREE.NoColorSpace);
      this.color.value.dispose(); this.normal.value.dispose();
      this.color.value = color; this.normal.value = normal;
      this.resolution = data.width; this.ready.value = 1;
    };
    this.worker.postMessage({body:this.body, seed:SEED});
  }
  dispose() {
    this.disposed = true; this.worker?.terminate(); this.color.value.dispose(); this.normal.value.dispose();
  }
}

export const orbitalShader = `
uniform sampler2D orbitalNormal;
vec2 bodyUV(vec3 d) {
  return vec2(atan(d.x,d.z)/6.28318530718+.5,asin(clamp(d.y,-1.0,1.0))/3.14159265359+.5);
}
vec3 orbitalViewNormal(vec3 d) {
  return normalize(mat3(viewMatrix)*(texture2D(orbitalNormal,bodyUV(d)).rgb*2.0-1.0));
}
`;
