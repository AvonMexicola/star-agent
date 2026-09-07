import * as THREE from 'three';

// One local CC0 set, shared by all four worlds and their material clones.
let shared = null;
export function rockTextureState() {
  return { ready: shared?.ready.value === 1, error: shared?.error ?? null };
}
export function acquireRockTextures() {
  if (shared) { shared.users++; return shared; }
  const placeholder = (data, space = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(new Uint8Array(data), 1, 1);
    texture.colorSpace = space; texture.needsUpdate = true; return texture;
  };
  const state = { users: 1, disposed: false, error: null, ready: { value: 0 },
    albedo: { value: placeholder([96, 96, 96, 255], THREE.SRGBColorSpace) },
    normal: { value: placeholder([128, 128, 255, 255]) },
    roughness: { value: placeholder([220, 220, 220, 255]) } };
  shared = state;
  if (typeof document !== 'undefined') {
    const loader = new THREE.TextureLoader(), pending = [];
    const jobs = ['albedo', 'normal', 'roughness'].map(async channel => {
      const texture = await loader.loadAsync(`/materials/outcrops/${channel}.jpg`);
      pending.push(texture);
      if (texture.image.width !== 1024 || texture.image.height !== 1024) throw new Error(`Invalid rock ${channel} dimensions`);
      texture.colorSpace = channel === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 8; texture.needsUpdate = true;
      return { channel, texture };
    });
    // Publish atomically; failed or late loads cannot replace a disposed set.
    Promise.allSettled(jobs).then(results => {
      const failed = results.find(result => result.status === 'rejected');
      if (state.disposed || failed) {
        for (const texture of pending) texture.dispose();
        if (failed && !state.disposed) { state.error = String(failed.reason); console.warn('Rock maps unavailable; retaining base materials.', failed.reason); }
        return;
      }
      for (const { value: { channel, texture } } of results) { state[channel].value.dispose(); state[channel].value = texture; }
      state.ready.value = 1;
    });
  }
  return state;
}
export function releaseRockTextures(state) {
  if (--state.users > 0) return;
  state.disposed = true;
  for (const channel of ['albedo', 'normal', 'roughness']) state[channel].value.dispose();
  if (shared === state) shared = null;
}

const fragment = `
  uniform sampler2D rockAlbedoMap;uniform sampler2D rockNormalMap;uniform sampler2D rockRoughnessMap;
  uniform float rockMapsReady;uniform vec3 rockTint;
  varying vec3 vRockPoint;varying vec3 vRockGeometricNormal;varying float vRockRelief;
  float rockMask;vec3 rockGradient;vec3 rockBaseNormal;
  vec4 rockTri(sampler2D tex,vec3 p,vec3 w){
    return texture2D(tex,p.yz)*w.x+texture2D(tex,p.zx)*w.y+texture2D(tex,p.xy)*w.z;
  }
  // Convert the three tangent normals to surface gradients, then project onto
  // the real geometric tangent plane. A neutral normal map leaves it unchanged.
  vec3 rockGradientAt(vec3 p,vec3 w){
    vec3 x=texture2D(rockNormalMap,p.yz).xyz*2.0-1.0;
    vec3 y=texture2D(rockNormalMap,p.zx).xyz*2.0-1.0;
    vec3 z=texture2D(rockNormalMap,p.xy).xyz*2.0-1.0;
    return vec3(0,x.x,x.y)/max(x.z,.35)*w.x
      +vec3(y.y,0,y.x)/max(y.z,.35)*w.y+vec3(z.x,z.y,0)/max(z.z,.35)*w.z;
  }
`;

/** Overlay only canonical rock relief, including flat caps. Texture coordinates
 * are the existing CPU-rebased 256 m phase; 2/8/64 m periods divide it exactly. */
export function attachRockMaterial(material, { pointAttribute, tint = [1, 1, 1] }) {
  const maps = acquireRockTextures(), previous = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, { rockAlbedoMap: maps.albedo, rockNormalMap: maps.normal,
      rockRoughnessMap: maps.roughness, rockMapsReady: maps.ready, rockTint: { value: new THREE.Vector3(...tint) } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float rockRelief;varying float vRockRelief;varying vec3 vRockPoint;varying vec3 vRockGeometricNormal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvRockRelief=rockRelief;vRockPoint=${pointAttribute};vRockGeometricNormal=normal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragment}`)
      // After the body's soil colour/roughness code; before lighting evaluates.
      .replace('#include <metalnessmap_fragment>', `
        rockMask=smoothstep(.06,.65,vRockRelief)*rockMapsReady*(1.0-smoothstep(3000.0,9000.0,length(vViewPosition)));
        rockGradient=vec3(0);rockBaseNormal=normalize(vRockGeometricNormal);
        #ifdef USE_NORMALMAP_OBJECTSPACE
          rockBaseNormal=normalize(texture2D(normalMap,vNormalMapUv).xyz*2.0-1.0);
        #endif
        if(rockMask>.001){
          vec3 w=pow(abs(rockBaseNormal),vec3(4.0));w/=max(dot(w,vec3(1.0)),.0001);
          vec3 p=vRockPoint/8.0;
          vec3 stone=rockTri(rockAlbedoMap,p,w).rgb;
          float macro=rockTri(rockAlbedoMap,vRockPoint/64.0,w).r;
          stone*=.8+macro*1.2;
          float fine=1.0-smoothstep(35.0,220.0,length(vViewPosition));
          float micro=rockTri(rockAlbedoMap,vRockPoint/2.0,w).g;
          stone*=mix(1.0,.8+micro*1.3,fine*.45);
          diffuseColor.rgb=mix(diffuseColor.rgb,stone*rockTint*diffuse,rockMask);
          roughnessFactor=mix(roughnessFactor,clamp(rockTri(rockRoughnessMap,p,w).r,.55,.98),rockMask);
          float normalFade=1.0-smoothstep(350.0,1800.0,length(vViewPosition));
          rockGradient=(rockGradientAt(p,w)*.85+rockGradientAt(vRockPoint/2.0,w)*fine*.23)*normalFade;
        }
        #include <metalnessmap_fragment>`)
      // Soil bump has already run. Replace it on rock instead of layering the
      // same cracked earth normal over the new stone texture.
      .replace('#include <emissivemap_fragment>', `
        if(rockMask>.001){
          vec3 rockN=normalize(rockBaseNormal+rockGradient-rockBaseNormal*dot(rockGradient,rockBaseNormal));
          normal=normalize(mix(normal,mat3(viewMatrix)*rockN,rockMask));
        }
        #include <emissivemap_fragment>`);
  };
  material.customProgramCacheKey = () => `${cacheKey}-outcrop-pbr-v1`;
  let disposed = false;
  return () => { if (!disposed) { disposed = true; releaseRockTextures(maps); } };
}
