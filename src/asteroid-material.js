import { MeshStandardMaterial, Vector3 } from 'three';

export const ASTEROID_MATERIAL_VERSION = 1;
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
  material.onBeforeCompile = shader => {
    shader.uniforms.asteroidOrigin = originUniform;
    shader.uniforms.asteroidSun = { value: sun };
    shader.uniforms.asteroidMoonRadius = { value: moonRadius };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform vec3 asteroidOrigin;uniform float asteroidMoonRadius;
      varying vec3 vAsteroidMoon;varying vec3 vAsteroidPoint;varying vec3 vAsteroidNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAsteroidPoint=position;vAsteroidNormal=normal;
        vec4 asteroidPosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          asteroidPosition=instanceMatrix*asteroidPosition;
        #endif
        vAsteroidMoon=((modelMatrix*asteroidPosition).xyz+asteroidOrigin)/asteroidMoonRadius;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 asteroidSun;varying vec3 vAsteroidMoon;varying vec3 vAsteroidPoint;varying vec3 vAsteroidNormal;
      ${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 asteroidBlend=pow(abs(normalize(vAsteroidNormal)),vec3(4.0));asteroidBlend/=max(dot(asteroidBlend,vec3(1.0)),.00001);
        float asteroidFootprint=max(length(dFdx(vAsteroidPoint)),length(dFdy(vAsteroidPoint)));
        float asteroidCoarse=asteroidTri(vAsteroidPoint,asteroidBlend,5.0);
        float asteroidMediumFade=1.0-smoothstep(.35,1.1,asteroidFootprint*31.0);
        float asteroidFineFade=1.0-smoothstep(.3,1.0,asteroidFootprint*113.0);
        float asteroidMedium=mix(.5,asteroidTri(vAsteroidPoint,asteroidBlend,31.0),asteroidMediumFade);
        float asteroidFine=mix(.5,asteroidTri(vAsteroidPoint,asteroidBlend,113.0),asteroidFineFade);
        float asteroidLayer=vAsteroidPoint.y*7.0+vAsteroidPoint.x*1.6+asteroidCoarse*.7;
        float asteroidLayerAA=max(fwidth(asteroidLayer),.003);
        float asteroidSeam=abs(sin(asteroidLayer*3.14159265));
        float asteroidFissure=(1.0-smoothstep(.018,.05+asteroidLayerAA*3.2,asteroidSeam))*(1.0-smoothstep(.10,.35,asteroidLayerAA));
        float asteroidMineral=smoothstep(.58,.84,asteroidCoarse)*(1.0-asteroidFissure);
        vec3 asteroidUndertone=mix(vec3(.76,.79,.84),vec3(1.18,1.11,.97),asteroidCoarse);
        diffuseColor.rgb*=asteroidUndertone*(.78+.34*asteroidMedium+.13*asteroidFine);
        diffuseColor.rgb*=1.0-asteroidFissure*.46;
        float asteroidHeight=(asteroidMedium-.5)*.022+(asteroidFine-.5)*.006-asteroidFissure*.015;`)
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
