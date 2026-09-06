import * as THREE from 'three';
import { terrainMapShader, terrainMapUniforms } from './terrain-maps.js';
import { orbitalShader } from './orbital-surface.js';

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

export function configureTerrainMaterial(material, texture, albedoUniform, albedoReady, groundTextures, maps, orbital) {
  material.onBeforeCompile = shader => {
    shader.uniforms.surfaceDetail = { value: texture };
    shader.uniforms.groundMaterials = { value: groundTextures };
    shader.uniforms.planetAlbedo = albedoUniform;
    shader.uniforms.albedoReady = albedoReady;
    shader.uniforms.orbitalNormal = orbital?.normal ?? albedoUniform;
    Object.assign(shader.uniforms, terrainMapUniforms(maps));
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 direction;\nattribute float terrainHeight;\nvarying float vGroundHeight;\nvarying vec3 vGroundNormal;\nattribute vec3 surfacePoint;\nvarying vec3 vSurfacePoint;\nvarying vec3 vPlanetDirection;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfacePoint=surfacePoint;vPlanetDirection=direction;vGroundHeight=terrainHeight;vGroundNormal=normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${sampling}\n${terrainMapShader}\n${orbitalShader}
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
        #ifdef USE_NORMALMAP_OBJECTSPACE
          distant=smoothstep(120000.0,260000.0,range)*albedoReady;
        #endif
        diffuseColor.rgb = mix(diffuseColor.rgb,texture2D(planetAlbedo,puv).rgb,distant);
        vec3 groundNormal=normalize(vGroundNormal);
        #ifdef USE_NORMALMAP_OBJECTSPACE
          groundNormal=normalize(texture2D(normalMap,vNormalMapUv).xyz*2.0-1.0);
        #endif
        vec3 weights = pow(abs(groundNormal),vec3(6.0));
        weights /= max(dot(weights,vec3(1.0)),.0001);
        // Direction-based kilometre fields survive patch changes and origin
        // rebases. Actual height and slope determine snow and exposed faces.
        float slope = 1.0-max(0.0,dot(groundNormal,pd));
        float snow = smoothstep(.42,.7,min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
        vec4 regional = surfaceSample(pd*398.1875,weights);
        vec4 gullies = surfaceSample(pd*1592.75,weights);
        float regionalFade = 1.0-smoothstep(45000.0,120000.0,range);
        float exposed = smoothstep(.045,.23,slope+(.5-regional.r)*.16);
        vec3 stone = vec3(.19,.205,.22);
        if(terrainMapsReady>.5 && regionalFade>.001) {
          vec3 rock = terrainColor(pd*6221.6796875,weights,1.0);
          float mineral = dot(rock,vec3(.2126,.7152,.0722));
          stone *= .65+smoothstep(.02,.34,mineral)*.85;
        }
        float layerPhase=vGroundHeight*.035+regional.r*8.0;
        float layers=(.5+.5*sin(layerPhase))*(1.0-smoothstep(.3,2.0,fwidth(layerPhase)));
        stone*=.83+layers*.24;
        vec3 regionalColor=diffuseColor.rgb*(.78+regional.r*.3+gullies.r*.18);
        regionalColor=mix(regionalColor,stone,exposed*mix(.42,.92,snow));
        diffuseColor.rgb=mix(diffuseColor.rgb,regionalColor,regionalFade);
        float detailFade = 1.0-smoothstep(800.0,4500.0,range);
        vec4 detail = vec4(diffuseColor.rgb,.5);
        vec3 mappedGradient=vec3(0.0);
        float mappedRoughness=.96;
        if (detailFade > .001) {
          vec4 macro = surfaceSample(pd*300.0,weights);
          float slope = 1.0-max(0.0,dot(groundNormal,pd));
          float organic = smoothstep(.012,.075,diffuseColor.g-diffuseColor.b);
          float snow = smoothstep(.42,.7,min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
          vec3 p = vSurfacePoint*.25;
          if (terrainMapsReady > .5) {
            TerrainSample ground = terrainSample(p,weights,0.0);
            float growth = organic*smoothstep(.24,.65,macro.g*.6+surfaceSample(p/16.0,weights).g*.4);
            if (growth>.01) ground=terrainMix(ground,terrainSample(p,weights,2.0),growth);
            float beach=(1.0-smoothstep(3.0,26.0,vGroundHeight))*(1.0-smoothstep(.06,.2,slope));
            if (beach>.01) ground=terrainMix(ground,terrainSample(p*.5,weights,3.0),beach);
            float exposed=smoothstep(.045,.27,slope);
            exposed=max(exposed,(1.0-organic)*.24*(1.0-beach));
            if (exposed>.01) ground=terrainMix(ground,terrainSample(p*.25,weights,1.0),exposed);
            // A second, broad texture scale keeps outcrops readable in low flight.
            vec3 broad=terrainColor(vSurfacePoint/64.0,weights,1.0);
            float mineral=dot(broad,vec3(.2126,.7152,.0722));
            ground.color*=mix(.72,1.3,smoothstep(.035,.36,mineral));
            float phase=vGroundHeight*.22+macro.r*5.0;
            float band=(.5+.5*sin(phase))*(1.0-smoothstep(.3,2.0,fwidth(phase)));
            ground.color*=mix(vec3(.83,.87,.92),vec3(1.12,1.02,.87),band*exposed);
            // Preserve geographic biome colour, while steep snow faces expose rock.
            ground.color=mix(ground.color,ground.color*(diffuseColor.rgb+vec3(.15))*1.65,.18);
            float snowBreak=smoothstep(.06,.24,mineral)*smoothstep(.012,.11,slope);
            float snowCover=snow*(1.0-smoothstep(.035,.19,slope))*(1.0-snowBreak*.8);
            ground.color=mix(ground.color,vec3(.72,.81,.87)*(.73+mineral*.8),snowCover);
            float wet=(1.0-smoothstep(.15,2.8,vGroundHeight))*beach;
            ground.color*=1.0-wet*.43;
            mappedRoughness=mix(clamp(ground.roughness,.58,1.0),.38,wet);
            mappedGradient=ground.gradient*mix(.8,.18,snowCover);
            detail=vec4(ground.color,.5);
          } else {
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
          }
          diffuseColor.rgb=mix(diffuseColor.rgb,detail.rgb,detailFade*.9);
        }
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,terrainMapsReady>.5?mappedRoughness:.88+detail.a*.1,detailFade);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${orbital ? 'normal=normalize(mix(normal,orbitalViewNormal(pd),distant));' : ''}
        if(terrainMapsReady>.5) normal=terrainNormalAt(normal,mappedGradient,detailFade*(1.0-smoothstep(100.0,1100.0,range)));
        else normal=detailNormal(-vViewPosition,normal,detail.a*.055*detailFade);`);
  };
  material.customProgramCacheKey = () => `terrain-material-regional-v2-${Boolean(orbital)}`;
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
