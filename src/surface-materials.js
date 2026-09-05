import * as THREE from 'three';

// A small, periodic material field. Channels hold relief, organic cover, stone
// variation and roughness, all linear data. No downloaded textures are needed.
export function createSurfaceTexture() {
  const size = 256, data = new Uint8Array(size * size * 4);
  const hash = (x, y) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 7291;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (u, v, cells) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = fx * fx * (3 - 2 * fx), b = fy * fy * (3 - 2 * fy);
    const sample = (dx, dy) => hash((ix + dx) % cells, (iy + dy) % cells);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(0, 0), sample(1, 0), a),
      THREE.MathUtils.lerp(sample(0, 1), sample(1, 1), a), b);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, k = (y * size + x) * 4;
    const broad = noise(u, v, 8), medium = noise(u, v, 32), fine = noise(u, v, 128);
    const grit = hash(x, y);
    const stone = THREE.MathUtils.smoothstep(medium, .53, .78);
    data[k] = Math.round(255 * (.38 * broad + .32 * medium + .17 * fine + .13 * grit));
    data[k + 1] = Math.round(255 * noise(u, v, 4));
    data[k + 2] = Math.round(255 * stone);
    data[k + 3] = Math.round(255 * (.65 + .3 * fine));
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const sampling = `
uniform sampler2D surfaceDetail;
varying vec3 vSurfacePoint;
vec4 surfaceSample(vec3 p, vec3 weights) {
  return texture2D(surfaceDetail, p.yz) * weights.x
       + texture2D(surfaceDetail, p.zx) * weights.y
       + texture2D(surfaceDetail, p.xy) * weights.z;
}
// Screen derivatives build a surface gradient without needing tangent UVs.
vec3 detailNormal(vec3 eyePosition, vec3 n, float height) {
  vec3 q0 = dFdx(eyePosition), q1 = dFdy(eyePosition);
  vec3 r0 = cross(q1, n), r1 = cross(n, q0);
  float determinant = dot(q0, r0);
  if (abs(determinant) < 1e-12) return n;
  vec3 gradient = sign(determinant) * (dFdx(height) * r0 + dFdy(height) * r1);
  return normalize(abs(determinant) * n - gradient);
}
`;

export function configureTerrainMaterial(material, texture, albedoUniform, albedoReady, groundTextures) {
  material.onBeforeCompile = shader => {
    shader.uniforms.surfaceDetail = { value: texture };
    shader.uniforms.groundMaterials = { value: groundTextures };
    shader.uniforms.planetAlbedo = albedoUniform;
    shader.uniforms.albedoReady = albedoReady;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 direction;\nattribute float terrainHeight;\nvarying float vGroundHeight;\nvarying vec3 vGroundNormal;\nattribute vec3 surfacePoint;\nvarying vec3 vSurfacePoint;\nvarying vec3 vPlanetDirection;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfacePoint=surfacePoint;vPlanetDirection=direction;vGroundHeight=terrainHeight;vGroundNormal=normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${sampling}
        precision highp sampler2DArray;
        uniform sampler2DArray groundMaterials;
        varying float vGroundHeight;
        varying vec3 vGroundNormal;
        vec4 groundSample(vec3 p, vec3 weights, float layer) {
          return texture(groundMaterials,vec3(p.yz,layer))*weights.x
               + texture(groundMaterials,vec3(p.zx,layer))*weights.y
               + texture(groundMaterials,vec3(p.xy,layer))*weights.z;
        }
        uniform sampler2D planetAlbedo;\nuniform float albedoReady;\nvarying vec3 vPlanetDirection;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 pd = normalize(vPlanetDirection);
        vec2 puv = vec2(atan(pd.x,pd.z)/6.28318530718+.5, asin(clamp(pd.y,-1.0,1.0))/3.14159265359+.5);
        float range = length(vViewPosition);
        float distant = smoothstep(20000.0,80000.0,range)*albedoReady;
        diffuseColor.rgb = mix(diffuseColor.rgb,texture2D(planetAlbedo,puv).rgb,distant);
        vec3 weights = pow(abs(normalize(vGroundNormal)),vec3(6.0));
        weights /= max(dot(weights,vec3(1.0)),.0001);
        float detailFade = 1.0-smoothstep(120.0,1600.0,range);
        vec4 detail = vec4(diffuseColor.rgb,.5);
        if (detailFade > .001) {
          vec4 macro = surfaceSample(pd*300.0,weights);
          float slope = 1.0-max(0.0,dot(normalize(vGroundNormal),pd));
          float organic = smoothstep(.012,.075,diffuseColor.g-diffuseColor.b);
          float snow = smoothstep(.42,.7,min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
          vec3 p = vSurfacePoint*.25;
          vec4 soil = groundSample(p,weights,0.0);
          vec4 stone = groundSample(p*.25,weights,1.0);
          vec4 moss = groundSample(p,weights,2.0);
          vec4 sand = groundSample(p,weights,3.0);
          detail=mix(soil,moss,organic*(.35+.65*smoothstep(.25,.7,macro.g*.5+surfaceSample(p*.0625,weights).g*.5)));
          float beach=1.0-smoothstep(2.0,18.0,vGroundHeight);
          sand.rgb*=mix(.42,1.0,smoothstep(.05,2.5,vGroundHeight));
          detail=mix(detail,sand,beach);
          detail=mix(detail,stone,max(smoothstep(.08,.38,slope),(.6-organic*.6)*(1.0-beach)));
          // Retain the biome's large-scale tint while resolving real material relief.
          detail.rgb=mix(detail.rgb,detail.rgb*(diffuseColor.rgb+vec3(.1))*2.0,.25);
          detail.rgb=mix(detail.rgb,diffuseColor.rgb*(.88+soil.a*.2),snow);
          diffuseColor.rgb=mix(diffuseColor.rgb,detail.rgb,detailFade*.9);
        }
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.88+detail.a*.1,detailFade);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=detailNormal(-vViewPosition,normal,detail.a*.055*detailFade);');
  };
  material.customProgramCacheKey = () => 'terrain-material-layers-v2';
}

/** Object-local wear on the merged hull and furniture, which have no UVs. */
export function weatherShip(ship, texture) {
  const materials = new Set();
  ship.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = !object.material.transparent;
    object.receiveShadow = true;
    const material = object.material;
    if(material.userData.unweathered)return;
    if(material.transparent){
      material.color.set(0xdce8ec);material.opacity=.04;material.roughness=.2;
      material.metalness=0;material.envMapIntensity=.3;return;
    }
    if (materials.has(material) || material.emissiveIntensity > .8) return;
    materials.add(material);
    material.envMapIntensity = .55;
    material.onBeforeCompile = shader => {
      shader.uniforms.surfaceDetail = { value: texture };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePoint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfacePoint=position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${sampling}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec4 wear = surfaceSample(vSurfacePoint*2.0,vec3(.333333));
          diffuseColor.rgb *= .88+wear.r*.22;
        `)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(wear.r-.5)*.2,.18,1.0);')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=detailNormal(-vViewPosition,normal,wear.r*.0015);');
    };
    material.customProgramCacheKey = () => 'hull-wear-v1';
  });
}
