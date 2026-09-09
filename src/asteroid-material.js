import { Matrix3 } from 'three';
import { MeshStandardMaterial, Vector3 } from 'three';

export const ASTEROID_MATERIAL_VERSION = 2;
const SURFACE_GLSL = `
float asteroidHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float asteroidNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(asteroidHash(i),asteroidHash(i+vec2(1.0,0.0)),f.x),mix(asteroidHash(i+vec2(0.0,1.0)),asteroidHash(i+vec2(1.0)),f.x),f.y);}
float asteroidTri(vec3 p,vec3 blend,float frequency){p*=frequency;return dot(vec3(asteroidNoise(p.yz),asteroidNoise(p.zx),asteroidNoise(p.xy)),blend);}
vec3 asteroidBump(vec3 position,vec3 n,float height,float facing){
  vec3 sx=normalize(dFdx(position)),sy=normalize(dFdy(position));
  vec3 a=cross(sy,n),b=cross(n,sx);float determinant=dot(sx,a)*facing;
  vec3 gradient=sign(determinant)*(dFdx(height)*a+dFdy(height)*b);
  return normalize(max(abs(determinant),.00001)*n-gradient);
}
`;

/** Standard lighting, depth and instance tints remain intact. All rock detail is
 * evaluated in object coordinates, so rebasing the floating origin never swims a texture. */
export function createAsteroidMaterial({ originUniform = { value: new Vector3() }, sunDirection = [0, 1, 0], moonRadius } = {}) {
  if (!Number.isFinite(moonRadius) || moonRadius <= 0) throw new RangeError('A positive moon radius is required');
  const sun = sunDirection?.isVector3 ? sunDirection.clone() : new Vector3(...sunDirection);
  if (!Number.isFinite(sun.lengthSq()) || sun.lengthSq() < 1e-12) throw new RangeError('A finite sun direction is required');
  sun.normalize();
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, metalness: .10, envMapIntensity: .22 });
  material.userData.asteroidSun=sun;
  material.userData.asteroidFrameInverse={value:new Matrix3()};
  material.onBeforeCompile = shader => {
    shader.uniforms.asteroidFrameInverse=material.userData.asteroidFrameInverse;
    shader.uniforms.asteroidOrigin = originUniform;
    shader.uniforms.asteroidSun = { value: sun };
    shader.uniforms.asteroidMoonRadius = { value: moonRadius };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform vec3 asteroidOrigin;uniform float asteroidMoonRadius;uniform mat3 asteroidFrameInverse;
      varying vec3 vAsteroidMoon;varying vec3 vAsteroidPoint;varying vec3 vAsteroidNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAsteroidPoint=position;vAsteroidNormal=normal;
        vec4 asteroidPosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          asteroidPosition=instanceMatrix*asteroidPosition;
        #endif
        vAsteroidMoon=(asteroidFrameInverse*(modelMatrix*asteroidPosition).xyz+asteroidOrigin)/asteroidMoonRadius;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 asteroidSun;varying vec3 vAsteroidMoon;varying vec3 vAsteroidPoint;varying vec3 vAsteroidNormal;
      ${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 asteroidBlend=pow(abs(normalize(vAsteroidNormal)),vec3(4.0));asteroidBlend/=max(dot(asteroidBlend,vec3(1.0)),.00001);
        float asteroidFootprint=max(length(dFdx(vAsteroidPoint)),length(dFdy(vAsteroidPoint)));
        float asteroidCoarse=asteroidTri(vAsteroidPoint,asteroidBlend,4.7);
        float asteroidMediumFade=1.0-smoothstep(.35,1.1,asteroidFootprint*23.0);
        float asteroidFineFade=1.0-smoothstep(.3,1.0,asteroidFootprint*97.0);
        float asteroidMedium=mix(.5,asteroidTri(vAsteroidPoint,asteroidBlend,23.0),asteroidMediumFade);
        float asteroidFine=mix(.5,asteroidTri(vAsteroidPoint,asteroidBlend,97.0),asteroidFineFade);
        float asteroidFault=asteroidTri(vAsteroidPoint+vec3(7.3,2.1,-4.6),asteroidBlend,8.3);
        float asteroidCrackSignal=asteroidFault-.51+(asteroidCoarse-.5)*.42;
        float asteroidCrackAA=max(fwidth(asteroidCrackSignal),.002);
        float asteroidBreaks=smoothstep(.44,.68,asteroidTri(vAsteroidPoint+vec3(-3.2,9.4,1.8),asteroidBlend,3.3));
        float asteroidFissure=(1.0-smoothstep(.009,.028+asteroidCrackAA,abs(asteroidCrackSignal)))*asteroidBreaks*(1.0-smoothstep(.08,.2,asteroidCrackAA));
        float asteroidMineral=smoothstep(.62,.86,asteroidCoarse)*(1.0-asteroidFissure);
        float asteroidLuminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(vec3(asteroidLuminance)*vec3(.90,.98,1.06),diffuseColor.rgb,.20);
        vec3 asteroidUndertone=mix(vec3(.83,.87,.94),vec3(1.12,1.13,1.11),asteroidCoarse);
        diffuseColor.rgb*=asteroidUndertone*(.40+.82*asteroidCoarse+.37*asteroidMedium+.17*asteroidFine);
        diffuseColor.rgb*=1.0-asteroidFissure*.32;
        float asteroidHeight=(asteroidCoarse-.5)*.065+(asteroidMedium-.5)*.075+(asteroidFine-.5)*.018-asteroidFissure*.026;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(.94-asteroidMineral*.14+(asteroidMedium-.5)*.13,.73,.99);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor=clamp(.055+asteroidMineral*.095,0.0,.16);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal=asteroidBump(-vViewPosition,normal,asteroidHeight,faceDirection);`)
      .replace('#include <opaque_fragment>', `
        float asteroidAlong=dot(vAsteroidMoon,asteroidSun),asteroidMiss=length(vAsteroidMoon-asteroidAlong*asteroidSun);
        float asteroidEclipse=asteroidAlong<0.0?.045+.955*smoothstep(.99,1.025,asteroidMiss):1.0;
        outgoingLight*=asteroidEclipse*(1.0-asteroidFissure*.16);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `geological-asteroid-material-v${ASTEROID_MATERIAL_VERSION}`;
  return material;
}
