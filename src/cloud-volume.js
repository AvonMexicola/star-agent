import * as THREE from 'three';
import { hash } from './world.js';

export function createCloudNoise() {
  const size = 32, data = new Uint8Array(size ** 3);
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    data[x + size * (y + size * z)] = Math.round(hash(x + 193, y - 71, z + 307) * 255);
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

// Runs in the atmosphere composite, using its existing reconstructed scene
// depth. Cloud light is premultiplied, so sky behind soft edges remains sky.
// Samples occupy a real 2.8 km shell; pilots can fly into and above the volume.
export const cloudShader = `
precision highp sampler3D;
uniform sampler3D cloudNoise;
uniform float cloudTime;
float cloudDensity(vec3 point) {
  point=cloudFrame*point;
  float height = (length(point)-1.0)*radius;
  float layer = (height-1800.0)/2800.0;
  if(layer<=0.0 || layer>=1.0) return 0.0;
  vec3 n = normalize(point);
  vec3 drift = vec3(cloudTime*.00035,0.0,cloudTime*.00012);
  float weather = texture(cloudNoise,n*.21+vec3(.31,.07,.53)).r;
  float coverage = smoothstep(.44,.72,weather);
  if(coverage<.01) return 0.0;
  vec3 p = point*radius*.000045+drift;
  float orbital=smoothstep(20000.0,180000.0,(length(cameraPlanet)-1.0)*radius);
  float broad=texture(cloudNoise,p*.025).r*.7+texture(cloudNoise,p*.051+3.1).r*.3;
  float detail=texture(cloudNoise,p).r*.65+texture(cloudNoise,p*2.03+3.1).r*.35;
  float shape=broad+(detail-.5)*.4*(1.0-orbital);
  float profile = smoothstep(0.0,.17,layer)*(1.0-smoothstep(.45,1.0,layer));
  float body = smoothstep(.46-coverage*.18,.76-coverage*.16,shape);
  return body*coverage*profile*.0023;
}
vec4 cloudRadiance(vec3 ro,vec3 rd,float sceneDistance,float sunDot) {
  vec2 outer = sphere(ro,rd,1.0+4600.0/radius);
  if(outer.y<=0.0) return vec4(0.0);
  vec2 inner = sphere(ro,rd,1.0+1800.0/radius);
  float start=max(0.0,outer.x), end=min(sceneDistance,outer.y);
  if(inner.x>start) end=min(end,inner.x);
  else if(inner.y>0.0) start=max(start,inner.y);
  vec2 planet = sphere(ro,rd,1.0);
  if(planet.x>0.0) end=min(end,planet.x);
  if(end<=start) return vec4(0.0);
  float stepLength=(end-start)/16.0;
  float jitter=hash(vec3(floor(gl_FragCoord.xy),17.0));
  vec3 light=vec3(0.0);float transmittance=1.0;
  for(int i=0;i<16;i++) {
    vec3 p=ro+rd*(start+(float(i)+.45+jitter*.1)*stepLength);
    float density=cloudDensity(p);
    if(density>.00001) {
      float optical=density*stepLength*radius;
      float alpha=1.0-exp(-optical);
      float shadow=cloudDensity(p+sunDirection*(350.0/radius))*350.0
                 +cloudDensity(p+sunDirection*(1000.0/radius))*650.0;
      float day=smoothstep(-.08,.18,dot(normalize(p),sunDirection));
      float forward=pow(max(sunDot,0.0),12.0)*.9;
      vec3 illumination=vec3(.11,.16,.23)*(.025+.975*day)
        +vec3(1.05,.96,.83)*exp(-shadow)*day*(.8+forward);
      float haze=1.0-exp(-max(0.0,start)*radius/65000.0);
      illumination=mix(illumination,vec3(.30,.43,.58)*day,haze*.65);
      light+=transmittance*alpha*illumination;
      transmittance*=1.0-alpha;
      if(transmittance<.025) break;
    }
  }
  return vec4(light,1.0-transmittance);
}
`;
