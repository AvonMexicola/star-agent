import * as THREE from 'three';
import { RADIUS, SUN_RADIUS, SUN_DISTANCE, SUN_DIRECTION, SUN_ANGULAR_RADIUS, clamp, smoothstep } from './world.js';
import { MOON_RADIUS, MOON_POSITION } from './moon-world.js';

// The star as a place. World positions are planet-centred doubles in metres and
// everything renders camera-relative, like every other body. See docs/sun.md.
export const SUN_NAME = 'Our star';
export const SUN_POSITION = Object.freeze(SUN_DIRECTION.map(v => v * SUN_DISTANCE));
/** Seconds for one full rotation. A ~25-day solar period compressed so spots visibly drift in a session. */
export const SUN_ROTATION_PERIOD = 600;
/** Rotation axis: perpendicular to the Aeon line of sight, as close to +Y as possible, so spots drift left→right from the standoff. */
export const SUN_AXIS = Object.freeze((() => {
  const d = new THREE.Vector3(...SUN_DIRECTION), up = new THREE.Vector3(0, 1, 0);
  return up.sub(d.multiplyScalar(up.dot(d))).normalize().toArray();
})());
/** Nothing flies closer than this (centre distance). The drive refuses and manual flight is clamped. */
export const SUN_EXCLUSION_RADII = 3;
export const SUN_EXCLUSION = SUN_RADIUS * SUN_EXCLUSION_RADII;
/** Full angle the disk subtends at the arrival standoff. */
export const SUN_STANDOFF_ANGLE = 35 * Math.PI / 180;
/** Hull heating starts here (centre distance) and reaches 1 at the exclusion sphere. */
export const SUN_HEAT_RANGE = 5_000_000_000;
/** Inside this centre distance the real sphere renders; the atmosphere-pass disk fades out over SUN_DISK_FADE. */
export const SUN_SPHERE_RANGE = 3_000_000_000;
export const SUN_DISK_FADE = Object.freeze([2_000_000_000, 3_000_000_000]);
/** Corona billboard half-extent, in stellar radii. */
export const CORONA_EXTENT = 3.2;
export const PROMINENCE_COUNT = 8;

/** Angular radius (rad) of the photosphere seen from `distance` metres (centre distance). */
export function sunAngularRadius(distance) {
  return Math.asin(clamp(SUN_RADIUS / Math.max(SUN_RADIUS, distance), 0, 1));
}
/** Centre distance at which the disk subtends `angle` (full angle). Limb rays are tangents, so sin, not tan. */
export function standoffDistance(angle = SUN_STANDOFF_ANGLE) {
  return SUN_RADIUS / Math.sin(angle / 2);
}
export const SUN_STANDOFF = standoffDistance();
/** Arrival point between Aeon and the star: the star fills 35° and Aeon is behind you. */
export function sunStandoffPoint(distance = SUN_STANDOFF) {
  return new THREE.Vector3(...SUN_POSITION).addScaledVector(new THREE.Vector3(...SUN_DIRECTION), -distance);
}
/** 0 beyond SUN_HEAT_RANGE, 1 at the exclusion sphere; inverse-square between (radiant flux). */
export function sunHeat(distance) {
  if (!Number.isFinite(distance)) return 0;
  const d = Math.max(SUN_EXCLUSION, distance);
  const flux = (SUN_EXCLUSION / d) ** 2, floor = (SUN_EXCLUSION / SUN_HEAT_RANGE) ** 2;
  return clamp((flux - floor) / (1 - floor), 0, 1);
}
/** Weight of the atmosphere-pass disk: 1 from Aeon, 0 once the sphere has taken over. */
export function sunDiskWeight(distance) { return smoothstep(SUN_DISK_FADE[0], SUN_DISK_FADE[1], distance); }
export function sunRotationAngle(elapsed) { return (elapsed / SUN_ROTATION_PERIOD) * Math.PI * 2 % (Math.PI * 2); }
/** Fast rise, slow decay light-curve for a flare site; `seed` staggers sites. Returns 0..1. */
export function flareCurve(elapsed, period = 75, seed = 0) {
  const t = (elapsed + seed * period * .618) % period, rise = 1.8, decay = 14;
  if (t < rise) return t / rise;
  return Math.exp(-(t - rise) / decay);
}

/** Keep a swept step outside the exclusion sphere. Returns {point, hit}. */
export function constrainSunStep(previous, proposed, radius = SUN_EXCLUSION) {
  const centre = new THREE.Vector3(...SUN_POSITION);
  const offset = proposed.clone().sub(centre), distance = offset.length();
  if (distance >= radius) return { point: proposed, hit: false };
  const direction = distance > 0 ? offset.divideScalar(distance) : previous.clone().sub(centre).normalize();
  if (direction.lengthSq() === 0) direction.set(...SUN_DIRECTION).negate();
  return { point: centre.addScaledVector(direction, radius), hit: true };
}

/** Fraction (0..1) of the disk not hidden behind spherical occluders, seen from `position`. */
export function sunVisibility(position, occluders = DEFAULT_OCCLUDERS) {
  const toSun = new THREE.Vector3(...SUN_POSITION).sub(position), distance = toSun.length();
  if (distance <= SUN_RADIUS) return 1;
  const direction = toSun.divideScalar(distance), sunAngle = sunAngularRadius(distance);
  let visible = 1;
  for (const occluder of occluders) {
    const toCentre = new THREE.Vector3(...occluder.center).sub(position), range = toCentre.length();
    if (range >= distance || range === 0) continue;
    if (range < occluder.radius) return 0;
    const occluderAngle = Math.asin(occluder.radius / range);
    const separation = Math.acos(clamp(toCentre.divideScalar(range).dot(direction), -1, 1));
    visible *= clamp((separation - (occluderAngle - sunAngle)) / (2 * sunAngle), 0, 1);
  }
  return visible;
}
export const DEFAULT_OCCLUDERS = [
  { name: 'Aeon', center: [0, 0, 0], radius: RADIUS },
  { name: 'Selene', center: MOON_POSITION, radius: MOON_RADIUS },
];

const noiseChunk = /* glsl */`
vec3 hash3(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float vnoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i).x,hash3(i+vec3(1,0,0)).x,f.x),mix(hash3(i+vec3(0,1,0)).x,hash3(i+vec3(1,1,0)).x,f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)).x,hash3(i+vec3(1,0,1)).x,f.x),mix(hash3(i+vec3(0,1,1)).x,hash3(i+vec3(1,1,1)).x,f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.0,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.07+vec3(13.1,7.3,-5.9);a*=.5;}return s/.9375;}
// Cellular F1/F2: bright convection cells with dark intergranular lanes. Points breathe with time.
vec2 cells(vec3 p,float t){vec3 i=floor(p),f=fract(p);float f1=8.0,f2=8.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 g=vec3(float(x),float(y),float(z));vec3 h=hash3(i+g);
    vec3 o=g+h+.14*sin(t+h*6.2831)-f;float d=dot(o,o);if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}
  return sqrt(vec2(f1,f2));}
`;

// Photosphere. Colours are linear HDR before the atmosphere pass's ACES curve. ACES clips
// above ~4, so the disk sits near 1–1.5 (granulation and hue survive) while faculae and
// flares reach 5–30 and go white; far away `brightness` lifts it to match the painted disk.
const photosphereVertex = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;varying vec3 vNormal;varying vec3 vView;
void main(){
  vDir=normalize(position);vNormal=normalize(normalMatrix*normal);
  vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;
  gl_Position=projectionMatrix*mv;
  #include <logdepthbuf_vertex>
}`;
const photosphereFragment = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float time,brightness,granuleScale;uniform vec4 flares[3];
varying vec3 vDir;varying vec3 vNormal;varying vec3 vView;
${noiseChunk}
void main(){
  #include <logdepthbuf_fragment>
  vec3 d=normalize(vDir);float mu=clamp(dot(normalize(vNormal),normalize(vView)),0.0,1.0);
  float t=time*.05;
  // Domain-warped granulation: two cellular octaves under a slow fbm churn.
  vec3 warp=vec3(fbm(d*5.0+t*.4),fbm(d*5.0+vec3(11.0)-t*.3),fbm(d*5.0+vec3(23.0)+t*.2))-.5;
  vec3 p=d*granuleScale+warp*.9;
  vec2 c=cells(p,time*.12);float granule=smoothstep(.02,.30,c.y-c.x);
  vec2 c2=cells(p*2.6+vec3(5.0),time*.2);float fine=smoothstep(.02,.32,c2.y-c2.x);
  float super=fbm(d*3.0+t);
  float bright=(.45+.55*granule)*(.75+.35*fine)*(.8+.4*super);
  // Sunspot groups in two latitude bands, rotating with the star (d is object space).
  float band=exp(-pow(d.y/.42,2.0))*(1.0-exp(-pow(d.y/.08,2.0)));
  float group=smoothstep(.50,.60,fbm(d*3.0+vec3(7.0)))*band;
  vec2 sc=cells(d*7.0+vec3(31.0),0.0);
  float penumbra=smoothstep(.50,.26,sc.x)*group,umbra=smoothstep(.30,.14,sc.x)*group;
  float fibril=.5+.5*sin(atan(d.y,d.x)*60.0+fbm(d*80.0)*12.0);
  float shade=mix(1.0,.42+.14*fibril,penumbra);shade=mix(shade,.05,umbra);
  // Faculae brighten toward the limb where the hot walls of granules become visible.
  float faculae=smoothstep(.66,.76,fbm(d*14.0+vec3(3.0)))*pow(1.0-mu,4.0)*(1.0-penumbra);
  // Eddington limb darkening, stronger in blue so the limb goes orange-red.
  vec3 limb=1.0-vec3(.56,.76,.92)*pow(1.0-mu,.8);
  // Disk centre ≈ (1.15,.66,.24): ACES keeps granulation contrast and a yellow-orange hue; faculae/flares push past white.
  vec3 color=vec3(1.35,.60,.15)*bright*shade*limb+faculae*vec3(1.0,.95,.85)*1.8*limb;
  for(int i=0;i<3;i++){float ang=acos(clamp(dot(d,flares[i].xyz),-1.0,1.0));
    float f=flares[i].w*exp(-pow(ang/.07,2.0))*(.55+.45*fbm(d*40.0+time*.6));
    color+=vec3(1.0,.92,.78)*f*28.0;}
  // Chromosphere at the extreme limb.
  color=mix(color,vec3(1.5,.28,.16)*1.6,smoothstep(.06,0.0,mu));
  gl_FragColor=vec4(color*brightness,1.0);
}`;

// Corona, chromosphere rim and prominences on one camera-facing billboard through
// the star's centre. The sphere, drawn first with depth, occludes everything inside
// its silhouette; rimRadius is where that silhouette lands on this plane.
const coronaVertex = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vP;
void main(){vP=(uv*2.0-1.0)*${CORONA_EXTENT.toFixed(2)};gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  #include <logdepthbuf_vertex>
}`;
const coronaFragment = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float time,rimRadius,coronaStrength,rotation;uniform vec4 prominences[${PROMINENCE_COUNT}];
varying vec2 vP;
${noiseChunk}
void main(){
  #include <logdepthbuf_fragment>
  float r=length(vP);float a=atan(vP.y,vP.x);float R=rimRadius;
  vec3 color=vec3(0.0);
  if(r>R*.985){
    float k=max(r,R)/R;
    // r^-2.5 falloff, streamers from low-frequency angular noise, fine radial rays.
    vec3 ring=vec3(cos(a),sin(a),0.0);
    float streamer=fbm(ring*3.0+vec3(0.0,0.0,time*.02+rotation*.5));
    float rays=pow(.5+.5*sin(a*160.0+fbm(ring*9.0+vec3(time*.03))*14.0),4.0);
    float polar=.55+.45*pow(abs(sin(a)),.5);
    float falloff=pow(k,-3.5)*(.25+1.6*pow(smoothstep(.3,.8,streamer),2.0)+.08*rays)*polar;
    falloff*=1.0-smoothstep(1.8,${CORONA_EXTENT.toFixed(2)},r);
    vec3 tint=mix(vec3(1.0,.86,.62),vec3(.78,.84,1.0),smoothstep(R,R*2.4,r));
    color+=tint*falloff*1.5*coronaStrength;
    // Chromosphere: a thin pink-red rim plus a spicule fringe.
    float rim=smoothstep(R-.006,R,r)*(1.0-smoothstep(R,R+.014,r));
    float spicules=(1.0-smoothstep(R,R+.04,r))*(.5+.5*vnoise(vec3(a*140.0,r*30.0,time*.7)));
    color+=vec3(1.4,.32,.34)*rim*3.5+vec3(1.2,.28,.24)*spicules*.7;
  }
  // Prominences: half-ellipse ribbons anchored on the limb (x along the limb, y outward).
  for(int i=0;i<${PROMINENCE_COUNT};i++){
    vec4 pr=prominences[i];if(pr.w<=0.001)continue;
    float da=a-pr.x;da=mod(da+3.14159265,6.2831853)-3.14159265;
    float x=da*R,y=r-R*.995;
    if(abs(x)>pr.y*2.2||y<-.02||y>pr.z*1.6)continue;
    float e=length(vec2(x/pr.y,y/pr.z));
    float along=atan(y/pr.z,x/pr.y);
    float plasma=fbm(vec3(along*3.0-time*.35,e*9.0,float(i)*7.0+time*.12));
    float ribbon=exp(-pow((e-1.0)/(.10+.08*plasma),2.0))*(.25+1.3*plasma);
    float glow=exp(-pow((e-1.0)/.45,2.0))*.35;
    float feet=1.0-.4*smoothstep(0.0,.4,y/pr.z);
    vec3 pc=mix(vec3(1.0,.22,.16),vec3(1.0,.72,.42),plasma*plasma);
    color+=pc*(ribbon+glow)*feet*2.8*pr.w;
  }
  gl_FragColor=vec4(color,1.0);
}`;

// Lens glare: full-screen additive quad in the main scene, so the atmosphere pass
// tone-maps it with everything else. Bloom + anamorphic streak + ghosts on the centre line.
const glareVertex = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);
  #include <logdepthbuf_vertex>
}`;
const glareFragment = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec2 sunNdc;uniform float aspect,tanHalf,angular,intensity,ghosts;
varying vec2 vUv;
void main(){
  #include <logdepthbuf_fragment>
  vec2 p=(vUv*2.0-1.0)*vec2(aspect,1.0)*tanHalf;vec2 s=sunNdc*vec2(aspect,1.0)*tanHalf;
  vec2 d=p-s;float r=length(d);float ang=max(angular,.004);
  float core=exp(-pow(r/(ang*1.5),2.0))*.8;
  float halo=ang*ang*.5/(r*r+ang*ang*.35);
  float wide=.12*ang/(r+ang*2.0);
  float streak=exp(-pow(d.y/(ang*.09),2.0))*exp(-pow(d.x/(ang*6.0),2.0))*.22;
  vec3 color=vec3(1.0,.9,.74)*(core+halo+wide)+vec3(.72,.86,1.0)*streak;
  color*=intensity;
  // Ghost discs on the line from the star through the frame centre.
  float K[3];K[0]=.42;K[1]=.95;K[2]=1.55;
  float S[3];S[0]=2.4;S[1]=4.5;S[2]=1.6;
  vec3 T[3];T[0]=vec3(.6,1.0,.8);T[1]=vec3(1.0,.72,.6);T[2]=vec3(.7,.8,1.0);
  for(int j=0;j<3;j++){vec2 g=-s*K[j];float rr=length(p-g);float Rg=ang*S[j];
    float disc=smoothstep(Rg,Rg*.82,rr)*(.35+.65*smoothstep(Rg*.3,Rg,rr));
    color+=T[j]*disc*.045*intensity*ghosts;}
  gl_FragColor=vec4(color,1.0);
}`;

let promSeed = 0x53554e;
const promRandom = () => { promSeed = (Math.imul(promSeed, 1664525) + 1013904223) >>> 0; return promSeed / 4294967296; };
/** Deterministic prominence set: limb angle, half-width along the limb (R), height (R), life cycle. */
export const PROMINENCES = Object.freeze(Array.from({ length: PROMINENCE_COUNT }, (_, i) => Object.freeze({
  angle: promRandom() * Math.PI * 2,
  span: .05 + promRandom() * .09,
  height: .05 + promRandom() * .14,
  period: 110 + promRandom() * 190,
  offset: promRandom() * 300,
  detaches: i < 2,
})));
/** Height multiplier and alpha of a prominence at `elapsed` seconds: grows, lifts, and (for detaching ones) drifts off and fades. */
export function prominenceState(prominence, elapsed) {
  const phase = ((elapsed + prominence.offset) / prominence.period) % 1;
  const alpha = smoothstep(0, .12, phase) * (1 - smoothstep(.72, 1, phase));
  const lift = prominence.detaches ? smoothstep(.4, 1, phase) * 2.2 : .25 * Math.sin(phase * Math.PI);
  return { phase, alpha, height: prominence.height * (1 + lift) };
}

export class Sun {
  constructor(scene) {
    this.scene = scene;
    this.worldPosition = new THREE.Vector3(...SUN_POSITION);
    this.axis = new THREE.Vector3(...SUN_AXIS);
    this.occluders = [...DEFAULT_OCCLUDERS];
    this.distance = SUN_DISTANCE; this.heat = 0; this.angularRadius = SUN_ANGULAR_RADIUS; this.visibility = 1;
    this.rotation = 0;
    this.photosphere = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, brightness: { value: 1 }, granuleScale: { value: 60 },
        flares: { value: Array.from({ length: 3 }, () => new THREE.Vector4(0, 0, 1, 0)) } },
      vertexShader: photosphereVertex, fragmentShader: photosphereFragment,
    });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 128, 64), this.photosphere);
    this.sphere.name = 'Star photosphere'; this.sphere.visible = false; this.sphere.frustumCulled = true;
    this.coronaMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, rimRadius: { value: 1 }, coronaStrength: { value: 1 }, rotation: { value: 0 },
        prominences: { value: Array.from({ length: PROMINENCE_COUNT }, () => new THREE.Vector4()) } },
      vertexShader: coronaVertex, fragmentShader: coronaFragment,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    });
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.coronaMaterial);
    this.corona.name = 'Star corona'; this.corona.visible = false; this.corona.renderOrder = 5;
    this.corona.scale.setScalar(SUN_RADIUS * CORONA_EXTENT);
    this.glareMaterial = new THREE.ShaderMaterial({
      uniforms: { sunNdc: { value: new THREE.Vector2() }, aspect: { value: 1 }, tanHalf: { value: .5 }, angular: { value: SUN_ANGULAR_RADIUS }, intensity: { value: 0 }, ghosts: { value: 1 } },
      vertexShader: glareVertex, fragmentShader: glareFragment,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.glare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.glareMaterial);
    this.glare.name = 'Star glare'; this.glare.frustumCulled = false; this.glare.renderOrder = 900; this.glare.visible = false;
    scene.add(this.sphere, this.corona, this.glare);
    // Flare sites live in the active latitude bands, in the star's rotating frame.
    this.flareSites = [new THREE.Vector3(.8, .3, .5), new THREE.Vector3(-.5, -.28, .8), new THREE.Vector3(.2, .34, -.9)].map(v => v.normalize());
  }
  /** Weight for the atmosphere pass's own sun disk at the current distance. */
  get diskWeight() { return sunDiskWeight(this.distance); }
  update(worldPosition, camera, dt, elapsed, { atmosphereFraction = 0 } = {}) {
    const toSun = this.worldPosition.clone().sub(worldPosition), distance = toSun.length();
    this.distance = distance; this.heat = sunHeat(distance); this.angularRadius = sunAngularRadius(distance);
    this.rotation = sunRotationAngle(elapsed);
    const near = distance < SUN_SPHERE_RANGE;
    this.sphere.visible = near; this.corona.visible = near;
    if (near) {
      this.sphere.position.copy(toSun);
      this.sphere.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.axis)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation));
      const u = this.photosphere.uniforms;
      u.time.value = elapsed;
      // Far away the disk is a few pixels: match the atmosphere disk's white so the hand-off does not pop.
      u.brightness.value = THREE.MathUtils.lerp(1, 12, smoothstep(1.5e9, SUN_SPHERE_RANGE, distance));
      for (let i = 0; i < 3; i++) u.flares.value[i].set(this.flareSites[i].x, this.flareSites[i].y, this.flareSites[i].z, flareCurve(elapsed, 75 + i * 22, i));
      this.corona.position.copy(toSun); this.corona.lookAt(0, 0, 0);
      const c = this.coronaMaterial.uniforms;
      c.time.value = elapsed; c.rotation.value = this.rotation;
      c.rimRadius.value = distance / Math.sqrt(Math.max(1, distance * distance - SUN_RADIUS * SUN_RADIUS));
      c.coronaStrength.value = THREE.MathUtils.lerp(.35, 1, smoothstep(SUN_EXCLUSION, SUN_EXCLUSION * 2.5, distance));
      for (let i = 0; i < PROMINENCE_COUNT; i++) {
        const p = PROMINENCES[i], s = prominenceState(p, elapsed);
        c.prominences.value[i].set(p.angle + this.rotation * .3, p.span, s.height, s.alpha);
      }
    }
    // Glare: star position in NDC, visibility through planet/moon occlusion, size by angular radius.
    const view = toSun.clone().applyMatrix4(camera.matrixWorldInverse);
    this.visibility = view.z < 0 ? sunVisibility(worldPosition, this.occluders) : 0;
    const g = this.glareMaterial.uniforms;
    if (this.visibility > 0) {
      const ndc = toSun.clone().project(camera);
      g.sunNdc.value.set(ndc.x, ndc.y);
      g.aspect.value = camera.aspect; g.tanHalf.value = Math.tan(camera.fov * Math.PI / 360);
      g.angular.value = this.angularRadius;
      const inFrame = 1 - smoothstep(1.15, 1.6, Math.max(Math.abs(ndc.x), Math.abs(ndc.y)));
      // A big disk lights the frame by itself: the lens veil scales down with angular size.
      g.intensity.value = this.visibility * .6 * clamp(.02 / this.angularRadius, .12, 1) * (1 - .35 * atmosphereFraction) * inFrame;
      g.ghosts.value = smoothstep(.02, .12, this.angularRadius) * .5 + .5;
    } else g.intensity.value = 0;
    this.glare.visible = g.intensity.value > .002;
  }
  dispose() {
    for (const mesh of [this.sphere, this.corona, this.glare]) { mesh.geometry.dispose(); mesh.material.dispose(); this.scene.remove(mesh); }
  }
}
