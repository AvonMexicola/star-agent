import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Points, ShaderMaterial, Vector3 } from 'three';
import { MOON_POSITION, MOON_RADIUS } from './moon-world.js';
import { SUN_DIRECTION } from './world.js';
import { RING_RADIUS, RING_WIDTH, RING_THICKNESS, RING_NORMAL, randomFor } from './ring-world.js';

export const ICE_CELL_SIZE = 32;
export const ICE_PER_CELL = 5;
export const ICE_RADIUS = 104;
export const ICE_INNER_RADIUS = 12;
export const ICE_MAX_PARTICLES = 1200;
const center = new Vector3(...MOON_POSITION), normal = new Vector3(...RING_NORMAL);
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Canonical annulus/slab membership, softened only on the inside of its edges. */
export function ringIcePresence(world) {
  const p = world.clone().sub(center), height = p.dot(normal), radius = Math.sqrt(Math.max(0, p.lengthSq() - height * height));
  const radialClearance = RING_WIDTH / 2 - Math.abs(radius - RING_RADIUS);
  const verticalClearance = RING_THICKNESS / 2 - Math.abs(height);
  return smooth(0, 120, radialClearance) * smooth(0, 100, verticalClearance);
}
export function iceCellAt(world) {
  return [Math.floor((world.x - center.x) / ICE_CELL_SIZE), Math.floor((world.y - center.y) / ICE_CELL_SIZE), Math.floor((world.z - center.z) / ICE_CELL_SIZE)];
}
export function iceParticlesForCell(cell) {
  if (cell?.length !== 3 || !cell.every(Number.isSafeInteger)) throw new RangeError('Expected a three-dimensional ice cell');
  const seed = Math.imul(cell[0], 73856093) ^ Math.imul(cell[1], 19349663) ^ Math.imul(cell[2], 83492791) ^ 0x49434531;
  const random = randomFor(seed);
  return Array.from({ length: ICE_PER_CELL }, (_, index) => ({
    id: `${cell.join(':')}:${index}`,
    position: cell.map(c => (c + random()) * ICE_CELL_SIZE),
    phase: random() * Math.PI * 2,
    size: .75 + random() * .8,
    spin: .045 + random() * .06,
  }));
}
function cellNeighborhood(world) {
  const cell = iceCellAt(world), reach = Math.ceil((ICE_RADIUS + 2) / ICE_CELL_SIZE), particles = [];
  for (let x = -reach; x <= reach; x++) for (let y = -reach; y <= reach; y++) for (let z = -reach; z <= reach; z++) particles.push(...iceParticlesForCell([cell[0] + x, cell[1] + y, cell[2] + z]));
  return particles;
}
function selectParticles(world, elapsed, candidates, presence) {
  const relative = world.clone().sub(center), selected = [];
  for (const particle of candidates) {
    // Deterministic, slow motion about each world anchor; crossing a hash-cell
    // boundary or turning the camera cannot reset a flake's position or phase.
    const p = particle.position, phase = particle.phase, t = elapsed * .025;
    const position = new Vector3(p[0] + Math.sin(t + phase) * 1.2, p[1] + Math.sin(t * .73 + phase * 1.7) * .9, p[2] + Math.cos(t * .61 + phase) * 1.1);
    const distance = position.distanceTo(relative);
    if (distance >= ICE_RADIUS || distance < ICE_INNER_RADIUS) continue;
    const worldPosition = position.clone().add(center);
    const fade = presence * ringIcePresence(worldPosition) * (1 - smooth(65, ICE_RADIUS, distance)) * smooth(ICE_INNER_RADIUS, 20, distance);
    if (fade <= .001) continue;
    selected.push({ ...particle, position: worldPosition.toArray(), distance, fade });
  }
  if (selected.length > ICE_MAX_PARTICLES) selected.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  return selected.slice(0, ICE_MAX_PARTICLES);
}
export function sampleRingIce(world, elapsed = 0) {
  if (!Number.isFinite(elapsed)) throw new RangeError('Ice time must be finite');
  const presence = ringIcePresence(world);
  return presence > 0 ? selectParticles(world, elapsed, cellNeighborhood(world), presence) : [];
}

export class RingIce {
  constructor(scene) {
    this.scene = scene; this.cell = ''; this.candidates = []; this.count = 0; this.presence = 0;
    this.positions = new Float32Array(ICE_MAX_PARTICLES * 3); this.parameters = new Float32Array(ICE_MAX_PARTICLES * 4);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('iceParameters', new BufferAttribute(this.parameters, 4).setUsage(DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending,
      uniforms: { iceTime: { value: 0 }, iceSun: { value: new Vector3(...SUN_DIRECTION).normalize() }, iceSunlight: { value: 1 } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 iceParameters;
        uniform float iceTime;uniform vec3 iceSun;uniform float iceSunlight;
        varying float vIceOpacity;varying float vIceGlint;varying float vIceAngle;varying float vIceCoverage;varying float vIcePhaseLight;
        void main(){
          vec4 worldPoint=modelMatrix*vec4(position,1.0),viewPoint=viewMatrix*worldPoint;
          gl_Position=projectionMatrix*viewPoint;
          float phase=iceParameters.x,spin=phase+iceTime*iceParameters.z;
          vec3 facet=normalize(vec3(sin(spin),cos(spin*.79+phase),sin(spin*.61+phase*1.31)));
          vec3 viewDirection=normalize(cameraPosition-worldPoint.xyz),halfDirection=normalize(iceSun+viewDirection+vec3(.00001));
          vIceGlint=pow(abs(dot(facet,halfDirection)),72.0)*iceSunlight;
          vIcePhaseLight=pow(max(dot(viewDirection,-iceSun),0.0),5.0)*iceSunlight;
          vec3 sunView=(viewMatrix*vec4(iceSun,0.0)).xyz;
          vIceAngle=atan(sunView.y,sunView.x)+phase*.2;
          float diameter=clamp(iceParameters.y*60.0/max(6.0,-viewPoint.z)+vIceGlint*.9,.7,2.5);
          gl_PointSize=max(1.0,diameter);vIceCoverage=min(1.0,diameter*diameter);
          vIceOpacity=iceParameters.w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float iceSunlight;
        varying float vIceOpacity;varying float vIceGlint;varying float vIceAngle;varying float vIceCoverage;varying float vIcePhaseLight;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 p=gl_PointCoord-.5;float c=cos(vIceAngle),s=sin(vIceAngle);p=mat2(c,-s,s,c)*p;
          float facet=1.0-smoothstep(.22,.52,abs(p.x)+abs(p.y));
          float streak=(1.0-smoothstep(.035,.13,abs(p.y)))*(1.0-smoothstep(.24,.49,abs(p.x)))*vIceGlint;
          float alpha=max(facet,streak)*vIceOpacity*vIceCoverage*.74;
          if(alpha<.005)discard;
          vec3 color=vec3(.64,.81,.94)*(.035+iceSunlight*.48+vIcePhaseLight*.85+vIceGlint*5.0);
          gl_FragColor=vec4(color,alpha);
        }`,
    });
    this.points = new Points(this.geometry, this.material); this.points.name = 'Sunlit ring micro-ice'; this.points.frustumCulled = false; this.points.visible = false;
    scene.add(this.points);
  }
  update(worldOrigin, elapsed = performance.now() / 1000) {
    this.presence = ringIcePresence(worldOrigin);
    if (this.presence <= 0) { this.points.visible = false; this.count = 0; this.geometry.setDrawRange(0, 0); return; }
    const key = iceCellAt(worldOrigin).join(':');
    if (key !== this.cell) { this.cell = key; this.candidates = cellNeighborhood(worldOrigin); }
    const selected = selectParticles(worldOrigin, elapsed, this.candidates, this.presence);
    this.count = selected.length;
    for (let i = 0; i < selected.length; i++) {
      const p = selected[i];
      // Subtract doubles before writing the only GPU position buffer.
      this.positions.set([p.position[0] - worldOrigin.x, p.position[1] - worldOrigin.y, p.position[2] - worldOrigin.z], i * 3);
      this.parameters.set([p.phase, p.size, p.spin, p.fade], i * 4);
    }
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.iceParameters.needsUpdate = true;
    this.geometry.setDrawRange(0, this.count); this.points.visible = this.count > 0;
    this.material.uniforms.iceTime.value = elapsed;
    const moonPoint = worldOrigin.clone().sub(center), along = moonPoint.dot(this.material.uniforms.iceSun.value), miss = moonPoint.clone().addScaledVector(this.material.uniforms.iceSun.value, -along).length();
    this.material.uniforms.iceSunlight.value = along < 0 ? smooth(MOON_RADIUS * .995, MOON_RADIUS * 1.01, miss) : 1;
  }
  get state() { return { count: this.count, capacity: ICE_MAX_PARTICLES, radius: ICE_RADIUS, presence: this.presence, cell: this.cell, sunlight: this.material.uniforms.iceSunlight.value }; }
  dispose() { this.scene.remove(this.points); this.geometry.dispose(); this.material.dispose(); this.candidates = []; }
}
