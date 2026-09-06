import * as THREE from 'three';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_GENERATOR_VERSION, pyreFrame } from './pyre-world.js';
import { PyreTerrain } from './pyre-terrain.js';

/** Pyre is visible as a mesh inside this range; beyond it the atmosphere pass paints a point. */
export const PYRE_MESH_RANGE = 5e8;

// Cooled lava crust: polygonal plates separated by cracks. One tile spans 16 m
// (a divisor of the 256 m surfacePoint period). r: crack mask, g: grain,
// b: per-plate variation, a: relief (domed plates dipping into the cracks).
function crackTexture() {
  const size = 256, cells = 10, data = new Uint8Array(size * size * 4);
  const hash = (x, y, salt) => { let n = Math.imul((x + cells) % cells, 374761393) ^ Math.imul((y + cells) % cells, 668265263) ^ Math.imul(salt + 13, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * cells, v = y / size * cells, ix = Math.floor(u), iy = Math.floor(v);
    let first = 9, second = 9, nearest = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, d = Math.hypot(cx + hash(cx, cy, 1) - u, cy + hash(cx, cy, 2) - v);
      if (d < first) { second = first; first = d; nearest = hash(cx, cy, 3); } else if (d < second) second = d;
    }
    const edge = second - first;
    const crack = 1 - THREE.MathUtils.smoothstep(edge, .02, .11);
    const grain = ((Math.imul((x + y * size) ^ 73471, 1597334677) >>> 8) & 255) / 255;
    const relief = THREE.MathUtils.smoothstep(edge, 0, .35) * .7 + (1 - Math.min(1, first)) * .2 + grain * .1;
    data.set([Math.round(255 * crack), Math.round(255 * grain), Math.round(255 * nearest), Math.round(255 * relief)], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  return texture;
}

export class Pyre {
  constructor(scene, { sync = false } = {}) {
    this.scene = scene; this.worldPosition = new THREE.Vector3(...PYRE_POSITION);
    this.group = new THREE.Group(); this.group.name = 'Pyre'; scene.add(this.group);
    this.cracks = crackTexture();
    this.maps = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); this.maps.needsUpdate = true;
    this.mapsReady = { value: 0 }; this.mapsUniform = { value: this.maps };
    const f = pyreFrame(); this.frameUniform = { value: new THREE.Matrix3().set(f.x[0], f.x[1], f.x[2], f.y[0], f.y[1], f.y[2], f.z[0], f.z[1], f.z[2]) };
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, envMapIntensity: .35, side: THREE.DoubleSide });
    this.material.onBeforeCompile = shader => {
      shader.uniforms.pyreCracks = { value: this.cracks }; shader.uniforms.pyreMaps = this.mapsUniform; shader.uniforms.pyreMapsReady = this.mapsReady; shader.uniforms.pyreFrame = this.frameUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 pyreDirection;attribute vec3 pyrePoint;attribute vec4 pyreData;varying vec3 vPyreNormal;varying vec3 vPyreDirection;varying vec3 vPyrePoint;varying vec4 vPyreData;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPyreNormal=normal;vPyreDirection=pyreDirection;vPyrePoint=pyrePoint;vPyreData=pyreData;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D pyreCracks;uniform sampler2D pyreMaps;uniform float pyreMapsReady;uniform mat3 pyreFrame;
          varying vec3 vPyreNormal;varying vec3 vPyreDirection;varying vec3 vPyrePoint;varying vec4 vPyreData;
          vec4 pyTri(sampler2D t,vec3 p,vec3 w){return texture2D(t,p.yz)*w.x+texture2D(t,p.xz)*w.y+texture2D(t,p.xy)*w.z;}
          vec3 pyEmissive;float pyRough;float pyRelief;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 pyD=normalize(vPyreDirection),pyN=normalize(vPyreNormal);
          vec3 pyW=pow(abs(pyN),vec3(4.0));pyW/=dot(pyW,vec3(1.0));
          float pyRange=length(vViewPosition);
          float pyDetail=1.0-smoothstep(150.0,2600.0,pyRange);
          float pyMid=1.0-smoothstep(4000.0,40000.0,pyRange);
          vec4 pyPlates=pyTri(pyreCracks,vPyrePoint/64.0,pyW);
          vec4 pyMacro=pyTri(pyreCracks,vPyrePoint/256.0,pyW);
          // Warp the fine crust by the mid-scale grain so the cells never read as a lattice.
          vec4 pyTex=pyTri(pyreCracks,(vPyrePoint+vec3(pyPlates.g-.5,pyMacro.g-.5,pyPlates.b-.5)*5.0)/16.0,pyW);
          float pyActivity=vPyreData.x,pyFresh=vPyreData.y,pySulphur=vPyreData.z;
          vec3 pyB=pyreFrame*pyD;
          vec2 pyUv=vec2(atan(pyB.x,pyB.z)/6.28318530718+.5,asin(clamp(pyB.y,-1.0,1.0))/3.14159265359+.5);
          vec4 pyMaps=texture2D(pyreMaps,pyUv)*pyreMapsReady;
          // Mid-scale plate mottling carried to 40 km: no dead plastic band between detail and orbit.
          diffuseColor.rgb*=mix(1.0,.74+pyMacro.b*.48,pyMid*.7)*mix(1.0,.78+pyPlates.b*.44,pyMid);
          // Walking-scale crust: grain, plate tone, dark cold cracks.
          diffuseColor.rgb*=mix(1.0,.6+pyTex.g*.5+pyTex.b*.3,pyDetail);
          float pyNear=1.0-smoothstep(60.0,420.0,pyRange);
          float pyCrack=pyTex.r*(.6+.4*pyPlates.r)*smoothstep(.05,.35,pyTex.b*.6+pyPlates.b*.4);
          diffuseColor.rgb*=1.0-pyCrack*.6*pyDetail;
          // Lava: night side glows 3x, the day side is washed out by the star.
          float pyNight=1.0-smoothstep(-.06,.22,pyB.z);
          float pyStrength=mix(.7,3.2,pyNight);
          vec3 pyLava=vec3(1.0,.21,.035);
          // Which plates are still hot: activity gated per plate so only part of the crust glows.
          float pyHot=smoothstep(.22,.55,pyActivity*(.45+.55*pyPlates.b))*pyActivity;
          float pyGlow=pyCrack*pyHot*pyNear;
          // 60 m fissures carry the glow from 100 m to a few km; vertex activity beyond; the map from orbit.
          float pyMidBand=smoothstep(90.0,400.0,pyRange)*(1.0-smoothstep(2500.0,9000.0,pyRange));
          float pyMidGlow=pyPlates.r*smoothstep(.5,.85,pyMacro.b*.5+pyPlates.b*.5)*pyActivity*pyMidBand;
          float pyFar=smoothstep(3000.0,12000.0,pyRange);
          float pyField=mix(pyActivity,max(pyActivity,pyMaps.r),smoothstep(60000.0,300000.0,pyRange));
          float pyFarGlow=pyField*pyField*pyFar*.55;
          // Cooling crust between the fissures keeps a dull red heat.
          float pyEmber=pyHot*(1.0-pyCrack)*.05;
          pyEmissive=pyLava*pyStrength*(pyGlow+pyMidGlow*.9+pyFarGlow+pyEmber);
          diffuseColor.rgb+=pyLava*pyGlow*.14;
          pyRough=mix(.92,.3,pyFresh*smoothstep(.3,.8,pyPlates.b));pyRough=mix(pyRough,.72,pySulphur);
          pyRelief=(pyTex.a*.55+pyCrack*.7)*.06*pyDetail+pyPlates.a*.03*pyMid;`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=pyEmissive;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=pyRough;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec3 pyQ0=dFdx(-vViewPosition),pyQ1=dFdy(-vViewPosition);
          vec3 pyR1=cross(pyQ1,normal),pyR2=cross(normal,pyQ0);
          float pyDet=dot(pyQ0,pyR1);
          vec3 pyGrad=sign(pyDet)*(dFdx(pyRelief)*pyR1+dFdy(pyRelief)*pyR2);
          normal=normalize(max(abs(pyDet),1e-10)*normal-pyGrad);`);
    };
    this.material.customProgramCacheKey = () => `pyre-terrain-v${PYRE_GENERATOR_VERSION}`;
    this.terrain = new PyreTerrain(this.group, this.material, { sync, onMaps: data => {
      const texture = new THREE.DataTexture(data.data, data.width, data.height); texture.wrapS = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
      this.maps.dispose(); this.maps = texture; this.mapsUniform.value = texture; this.mapsReady.value = 1;
    } });
  }
  update(worldPosition, origin) {
    this.distance = worldPosition.distanceTo(this.worldPosition);
    this.group.visible = this.distance < PYRE_MESH_RANGE;
    if (this.group.visible) this.terrain.update(worldPosition, origin);
  }
  get ready() { return this.terrain.ready; }
  get state() {
    return { position: this.worldPosition.toArray(), radius: PYRE_RADIUS, distance: this.distance ?? null, visible: this.group.visible, patches: this.terrain.visibleCount, lod: this.terrain.maxLevel, pending: this.terrain.pending, builds: this.terrain.buildsLastFrame, mapsReady: this.mapsReady.value === 1, generatorVersion: PYRE_GENERATOR_VERSION };
  }
  dispose() { this.terrain.dispose(); this.cracks.dispose(); this.maps.dispose(); this.material.dispose(); this.scene.remove(this.group); }
}
