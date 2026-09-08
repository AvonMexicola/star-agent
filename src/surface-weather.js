import * as THREE from 'three';
import { biomeAt, moisture } from './world.js';

const GRID = 25, EXTENT = 1536;
const PERIOD = 65536, PARTICLE_BOX = 192, PARTICLES = 768;
const wrap = (value, period) => ((value % period) + period) % period;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const PROFILES = Object.freeze({
  aeon: { name: 'meadow mist', height: 95, density: .0018, range: 1400, color: [.46, .62, .69], wind: 1.8, motes: .52 },
  pyre: { name: 'volcanic ash', height: 145, density: .0021, range: 1400, color: [.62, .36, .19], wind: 5.4, motes: .72 },
  miasma: { name: 'toxic ground wisps', height: 115, density: .0034, range: 1400, color: [.43, .55, .17], wind: 2.6, motes: .66 },
  selene: { name: 'surface dust', height: 4.5, density: .0035, range: 650, color: [.47, .43, .36], wind: .35, motes: .32 },
});

export function surfaceWeatherProfile(body, direction, height) {
  const base = PROFILES[body];
  if (!base) return null;
  if (body !== 'aeon') return { ...base };
  const biome = biomeAt(...direction, height), wet = moisture(...direction);
  if (biome === 'POLAR ICE') return { ...base, name: 'ice spindrift', height: 32, density: .00085, motes: .35 };
  if (biome === 'ALPINE HIGHLANDS') return { ...base, name: 'highland haze', density: .0009, motes: .12 };
  return { ...base, name: biome === 'TEMPERATE FOREST' ? 'woodland mist' : base.name,
    density: base.density * (.55 + wet), motes: base.motes * (.4 + wet) };
}

/** A coarse cache of the canonical terrain, used ONLY to place aerosols above
 * the surface. It never supplies geometry, collision or a second ground plane.
 * All samples and origin subtraction happen in JS doubles before GPU packing. */
export function createWeatherField(body, position) {
  const radial = position.clone().sub(new THREE.Vector3(...body.center));
  const up = radial.clone().set(...radial.toArray().map(v => Math.round(v / 32) * 32)).normalize();
  const anchor = up.clone().multiplyScalar(body.radius + body.height(...up.toArray()));
  const east = new THREE.Vector3().crossVectors(Math.abs(up.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), up).normalize();
  const north = up.clone().cross(east), data = new Float32Array(GRID * GRID);
  return { body, anchor, up, east, north, data, cursor: 0, size: GRID, extent: EXTENT };
}

// Concentrate the same 625 samples around the player: 10.7 m spacing near the
// centre, becoming coarser toward the 1.5 km edge. Close boulders no longer lift
// an entire 128 m cell of mist above otherwise flat ground.
export function weatherGridOffset(index) {
  const p = index / ((GRID - 1) / 2) - 1;
  return Math.sign(p) * p * p * EXTENT;
}

export function sampleWeatherField(field, count = 64) {
  const { body, anchor, up, east, north, data } = field, point = new THREE.Vector3();
  const end = Math.min(data.length, field.cursor + count);
  for (; field.cursor < end; field.cursor++) {
    const x = weatherGridOffset(field.cursor % GRID);
    const y = weatherGridOffset(Math.floor(field.cursor / GRID));
    point.copy(anchor).addScaledVector(east, x).addScaledVector(north, y).normalize();
    point.multiplyScalar(body.radius + body.height(...point.toArray())).sub(anchor);
    data[field.cursor] = point.dot(up);
  }
  return field.cursor === data.length;
}

// Shared between the volume composite and the particles. The phase is wrapped
// at an exact common period of both noise octaves, so origin changes do
// not make the mist swim. Height texture coordinates include texel centres.
export const weatherUniformShader = `
uniform sampler2D weatherGround;
uniform vec3 weatherCamera, weatherUp, weatherEast, weatherNorth;
uniform vec3 weatherPhase, weatherDrift, weatherColor;
uniform float weatherStrength, weatherHeight, weatherDensity, weatherRange;
uniform float weatherTime, weatherDay, weatherNear;
vec3 weatherLocal(vec3 p) { return vec3(dot(p,weatherEast),dot(p,weatherNorth),dot(p,weatherUp)); }
float weatherFloor(vec2 p) {
  vec2 grid=sign(p)*sqrt(abs(p)/${EXTENT.toFixed(1)});
  vec2 uv=((grid+1.0)*${((GRID - 1) / 2).toFixed(1)}+.5)/${GRID.toFixed(1)};
  return texture2D(weatherGround,uv).r;
}
`;

export const surfaceWeatherShader = `
${weatherUniformShader}
vec3 surfaceWeather(vec3 color,vec3 rd,float sceneMetres) {
  if(weatherStrength<.001) return color;
  float end=min(sceneMetres,weatherRange);
  if(end<=weatherNear) return color;
  float transmittance=1.0;
  vec3 light=vec3(0.0);
  float forward=pow(max(0.0,dot(rd,sunDirection)),8.0);
  vec3 illumination=weatherColor*(.025+weatherDay*(.9+forward*.8));
  float previous=weatherNear;
  // Quadratic intervals keep close wisps resolved without marching the sky.
  for(int i=0;i<14;i++) {
    float fraction=float(i+1)/14.0;
    float next=weatherNear+(end-weatherNear)*fraction*fraction;
    float stepLength=next-previous, distance=(previous+next)*.5;
    previous=next;
    vec3 point=weatherCamera+rd*distance, local=weatherLocal(point);
    if(max(abs(local.x),abs(local.y))>${(EXTENT - 128).toFixed(1)}) continue;
    float height=local.z-weatherFloor(local.xy);
    if(height<=0.0 || height>=weatherHeight*2.0) continue;
    vec3 p=weatherPhase+point-weatherDrift;
    float broad=texture(cloudNoise,p/4096.0).r;
    float detail=texture(cloudNoise,p/1024.0+vec3(.17,.41,.08)).r;
    float billow=smoothstep(.34,.65,broad*.65+detail*.35);
    float profile=exp(-height/(weatherHeight*.42))*smoothstep(0.0,2.0,height)
      *(1.0-smoothstep(weatherHeight,weatherHeight*2.0,height));
    float density=weatherDensity*profile*(.07+billow*(.65+detail*.7));
    density*=1.0-smoothstep(weatherRange*.68,weatherRange,distance);
    float alpha=1.0-exp(-density*stepLength*weatherStrength);
    light+=transmittance*alpha*illumination;
    transmittance*=1.0-alpha;
  }
  return color*transmittance+light;
}
`;

export class SurfaceWeather {
  constructor(scene, atmosphere, { enabled = true } = {}) {
    this.enabled = enabled;
    const empty = new Uint16Array(GRID * GRID);
    this.ground = new THREE.DataTexture(empty, GRID, GRID, THREE.RedFormat, THREE.HalfFloatType);
    this.ground.minFilter = this.ground.magFilter = THREE.LinearFilter;
    this.ground.needsUpdate = true;
    this.uniforms = {
      weatherGround: { value: this.ground }, weatherCamera: { value: new THREE.Vector3() },
      weatherUp: { value: new THREE.Vector3(0, 1, 0) }, weatherEast: { value: new THREE.Vector3(1, 0, 0) },
      weatherNorth: { value: new THREE.Vector3(0, 0, 1) }, weatherPhase: { value: new THREE.Vector3() },
      weatherDrift: { value: new THREE.Vector3() }, weatherColor: { value: new THREE.Vector3() },
      weatherStrength: { value: 0 }, weatherHeight: { value: 1 }, weatherDensity: { value: 0 },
      weatherRange: { value: 1 }, weatherTime: { value: 0 }, weatherDay: { value: 0 }, weatherNear: { value: 1 },
      particleCameraPhase: { value: new THREE.Vector3() }, particleDrift: { value: new THREE.Vector3() },
      particleOpacity: { value: 0 }, particleFocal: { value: 500 },
    };
    Object.assign(atmosphere.material.uniforms, this.uniforms);
    let seed = 0x61a75e;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const positions = new Float32Array(PARTICLES * 3), sizes = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) {
      positions.set([random() * PARTICLE_BOX, random() * PARTICLE_BOX, random() * PARTICLE_BOX], i * 3);
      sizes[i] = .025 + random() * .055;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('moteSize', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        ${weatherUniformShader}
        uniform vec3 particleCameraPhase,particleDrift;
        uniform float particleFocal,particleOpacity;
        attribute float moteSize;
        varying float vOpacity;
        void main() {
          vec3 drift=particleDrift+weatherUp*sin(weatherTime*.45+position.x)*.6;
          vec3 offset=mod(position+drift-particleCameraPhase+${(PARTICLE_BOX / 2).toFixed(1)},${PARTICLE_BOX.toFixed(1)})-${(PARTICLE_BOX / 2).toFixed(1)};
          float distance=length(offset);
          vec3 local=weatherLocal(weatherCamera+offset);
          float height=local.z-weatherFloor(local.xy);
          vOpacity=particleOpacity*weatherStrength*smoothstep(weatherNear+2.0,weatherNear+7.0,distance)*(1.0-smoothstep(35.0,75.0,distance));
          vOpacity*=smoothstep(.15,1.2,height)*(1.0-smoothstep(weatherHeight*.4,weatherHeight,height));
          vec4 mvPosition=modelViewMatrix*vec4(offset,1.0);
          gl_Position=projectionMatrix*mvPosition;
          float pixels=moteSize*particleFocal/max(.1,-mvPosition.z);
          gl_PointSize=clamp(pixels,1.0,5.0);
          vOpacity*=min(1.0,pixels*pixels);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 weatherColor;
        uniform float weatherDay;
        varying float vOpacity;
        void main() {
          float r=length(gl_PointCoord-.5)*2.0;
          float alpha=(1.0-smoothstep(.05,1.0,r))*vOpacity;
          if(alpha<.002) discard;
          gl_FragColor=vec4(weatherColor*(.06+weatherDay*1.7),alpha);
          #include <logdepthbuf_fragment>
        }`,
    });
    this.particles = new THREE.Points(geometry, material);
    this.particles.name = 'Local pollen, ash and surface dust';
    this.particles.frustumCulled = false;
    this.particles.visible = false;
    scene.add(this.particles);
    this.local = new THREE.Vector3(); this.wind = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this._state = { enabled, body: null, profile: null, ready: false, strength: 0 };
  }

  update(position, body, sunDirection, elapsed, dt, { sheltered = false, cabin = false, focal = 500 } = {}) {
    const u = this.uniforms;
    this.local.copy(position).sub(new THREE.Vector3(...body.center));
    const radius = this.local.length(), direction = this.local.clone().normalize();
    // High flight/space does no canonical grid work and adds no particle draw.
    const candidate = PROFILES[body.id] && radius - body.radius < 16000;
    const fieldDistance = field => {
      if (field?.body.id !== body.id) return Infinity;
      if (this.local.dot(field.up) <= 0) return Infinity;
      this.offset.copy(this.local).sub(field.anchor);
      return this.offset.addScaledVector(field.up, -this.offset.dot(field.up)).length();
    };
    let clearance = Infinity, target = 0;
    if (this.enabled && candidate && !sheltered) {
      const height = body.height(...direction.toArray()); clearance = radius - body.radius - height;
      if (clearance < 1550) {
        const stale = !this.field || this.field.body.id !== body.id;
        const moved = !stale && fieldDistance(this.field) > 96;
        if (!this.pending && (stale || moved)) this.pending = createWeatherField(body, position);
        if (this.pending && fieldDistance(this.pending) > 384) this.pending = createWeatherField(body, position);
        if (this.pending && sampleWeatherField(this.pending)) {
          this.field = this.pending; this.pending = null;
          this.ground.image.data = Uint16Array.from(this.field.data, THREE.DataUtils.toHalfFloat);
          this.ground.needsUpdate = true;
          const f = this.field;
          u.weatherUp.value.copy(f.up); u.weatherEast.value.copy(f.east); u.weatherNorth.value.copy(f.north);
          u.weatherPhase.value.set(...f.anchor.toArray().map(v => wrap(v, PERIOD)));
        }
        if (fieldDistance(this.field) < 384) target = 1 - smooth(650, 1500, clearance);
        this.profile = surfaceWeatherProfile(body.id, direction.toArray(), height);
      }
    }
    // Abrupt transits must never carry the previous planet's fog into space or a cabin.
    if (!candidate || sheltered || this._state.body !== body.id || !this.enabled || fieldDistance(this.field) > 384) u.weatherStrength.value = 0;
    else u.weatherStrength.value += (target - u.weatherStrength.value) * (1 - Math.exp(-Math.max(0, dt) * 2));
    const profile = this.profile;
    if (this.field?.body.id === body.id && profile) {
      u.weatherCamera.value.copy(this.local).sub(this.field.anchor);
      u.weatherColor.value.fromArray(profile.color); u.weatherHeight.value = profile.height;
      u.weatherDensity.value = profile.density; u.weatherRange.value = profile.range;
      u.weatherNear.value = cabin ? 5 : .6;
      u.weatherTime.value = elapsed;
      u.weatherDay.value = smooth(-.12, .2, direction.dot(sunDirection));
      // Tangential transport; Selene's small drift represents lofted dust, not air or wind physics.
      this.wind.copy(this.field.east).multiplyScalar(profile.wind).addScaledVector(this.field.north, profile.wind * .37);
      u.weatherDrift.value.set(...this.wind.toArray().map(v => wrap(v * elapsed, PERIOD)));
      u.particleDrift.value.set(...this.wind.toArray().map(v => wrap(v * elapsed, PARTICLE_BOX)));
      u.particleCameraPhase.value.set(...this.local.toArray().map(v => wrap(v, PARTICLE_BOX)));
      u.particleOpacity.value = profile.motes;
      u.particleFocal.value = focal;
    }
    this.particles.visible = u.weatherStrength.value > .005 && clearance < (profile?.height ?? 0) + 90;
    this._state = { enabled: this.enabled, body: body.id, profile: target > 0 ? profile?.name : null,
      ready: fieldDistance(this.field) < 384, strength: u.weatherStrength.value, particles: this.particles.visible ? PARTICLES : 0 };
  }

  get state() { return { ...this._state }; }
  dispose() {
    this.enabled = false; this.uniforms.weatherStrength.value = 0;
    this.pending = this.field = null;
    this.particles.removeFromParent(); this.particles.geometry.dispose(); this.particles.material.dispose(); this.ground.dispose();
  }
}
