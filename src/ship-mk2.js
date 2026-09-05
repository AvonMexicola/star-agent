import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Local frame follows the three.js convention: nose at -Z, up at +Y, and the
// origin sits on the landing-gear contact plane so main.js can drop the ship
// straight onto a terrain height without any extra offset.
const LENGTH = 10.9;
const WINGSPAN = 6.98;
const HEIGHT = 3.0;
export const SHIP_STATS = { length: LENGTH, wingspan: WINGSPAN, height: HEIGHT, disembarkDistance: 18 };

const HULL_Y = 1.76;      // fuselage axis height above the pads
const GEAR_SECONDS = 0.8;
const EMPTY = {};
const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);
const ease = (t) => t * t * (3 - 2 * t);
const approach = (dt, rate) => 1 - Math.exp(-dt * rate);

// Faceted hull section running nose (-Z) to tail (+Z); `flat`/`wide` squash the
// circular profile into the elongated, slightly flattened fuselage cross section.
function tube(rNose, rTail, zNose, zTail, y = HULL_Y, segments = 12, flat = .80, wide = 1.16, open = true) {
  const geometry = new THREE.CylinderGeometry(rTail, rNose, zTail - zNose, segments, 1, open);
  geometry.rotateX(Math.PI / 2); // cylinder +Y becomes +Z, so radiusTop lands at the tail
  geometry.scale(wide, flat, 1);
  geometry.translate(0, y, (zNose + zTail) / 2);
  return geometry;
}

// Lofted slab between a root quad at x[0] and a tip quad at x[1]: wings, fins,
// pylons and panels all come from this. A unit box is remapped by corner sign so
// face winding stays outward and computeVertexNormals keeps the facets crisp.
function loft({ x, z, y, t }) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const side = position.getX(i) < 0 ? 0 : 1;
    const up = position.getY(i) < 0 ? -1 : 1;
    const aft = position.getZ(i) < 0 ? 0 : 1;
    position.setXYZ(i, x[side], y[side] + up * t[side], z[side][aft]);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function slab(width, height, depth, x, y, z) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

/** Procedural single-seat spacecraft. Nothing is loaded; every part is a
 * primitive merged per material into a handful of draw calls. */
export class Ship {
  constructor(options = {}) {
    const accent = options.accent ?? 0xb6efd1;
    this.object = new THREE.Group();
    this.object.name = 'Player spacecraft';
    this.body = new THREE.Group(); // hover bob lives here so main.js owns object.position
    this.object.add(this.body);

    this.length = LENGTH;
    this.wingspan = WINGSPAN;
    this.height = HEIGHT;

    this.time = 0;
    this.throttle = 0;
    this.boostMix = 0;
    this.gear = 1;
    this.gearTarget = 1;
    this.legs = [];
    this.exhausts = [];
    this.materials = [];
    this._color = new THREE.Color();
    this._idle = new THREE.Color(0x2f7d6a);
    this._hot = new THREE.Color(accent);
    this._boost = new THREE.Color(0x9ad4ff);

    const material = (spec) => {
      const created = new THREE.MeshStandardMaterial({ envMapIntensity: 0, ...spec });
      this.materials.push(created);
      return created;
    };
    this.hullMaterial = material({ color: options.hull ?? 0x2a2f36, metalness: .75, roughness: .42 });
    this.panelMaterial = material({ color: 0x3b434e, metalness: .72, roughness: .52 });
    this.darkMaterial = material({ color: 0x161a20, metalness: .58, roughness: .70 });
    this.accentMaterial = material({ color: accent, metalness: .30, roughness: .34, emissive: accent, emissiveIntensity: .15 });
    this.gearMaterial = material({ color: 0x565f69, metalness: .86, roughness: .34 });
    this.glassMaterial = material({ color: 0x0b1a20, metalness: .10, roughness: .08, emissive: 0x17323c, emissiveIntensity: .35 });
    this.glowMaterial = material({ color: 0x05080a, metalness: 0, roughness: .5, emissive: accent, emissiveIntensity: 1 });
    this.exhaustMaterial = material({
      color: 0x000000, metalness: 0, roughness: 1, emissive: accent, emissiveIntensity: 2,
      transparent: true, opacity: .35, depthWrite: true, side: THREE.DoubleSide,
    });

    const batches = new Map();
    const add = (material, ...geometries) => {
      let list = batches.get(material);
      if (!list) batches.set(material, list = []);
      for (const geometry of geometries) if (geometry) list.push(geometry);
    };

    this.buildHull(add);
    this.buildCanopy(add);
    this.buildWings(add);
    this.buildEngines(add);
    this.buildDetails(add);

    for (const [mat, list] of batches) {
      const merged = list.length > 1 ? mergeGeometries(list) : list[0];
      if (list.length > 1) for (const geometry of list) geometry.dispose();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.body.add(mesh);
    }

    this.buildGear();
    this.buildExhausts();

    // Pilot eye, roughly where the canopy bubble is deepest.
    this.cockpit = new THREE.Object3D();
    this.cockpit.name = 'Cockpit eye';
    this.cockpit.position.set(0, 2.30, -2.35);
    this.body.add(this.cockpit);

    // Disembark spot: outside the starboard flank, on the contact plane.
    this.hatch = new THREE.Object3D();
    this.hatch.name = 'Hatch';
    this.hatch.position.set(2.5, 0, 0.55);
    this.object.add(this.hatch);

    if (options.engineLight) {
      this.engineLight = new THREE.PointLight(accent, 0, 26, 2);
      this.engineLight.position.set(0, HULL_Y, 5.4);
      this.body.add(this.engineLight);
    } else {
      this.engineLight = null;
    }

    this.update(0, { landed: true, throttle: 0 });
  }

  buildHull(add) {
    add(this.hullMaterial,
      tube(.12, .82, -5.9, -3.8, HULL_Y, 12, .80, 1.16, false),
      tube(.82, 1.02, -3.8, -1.5),
      tube(1.02, 1.08, -1.5, 1.8),
      tube(1.08, .88, 1.8, 4.0),
      tube(.88, .60, 4.0, 5.0, HULL_Y, 12, .80, 1.16, false));

    // Raised dorsal spine and a ventral keel strake break up the tube silhouette.
    add(this.panelMaterial,
      tube(.34, .24, .1, 4.4, 2.42, 6, .52, 1.7, false),
      tube(.40, .30, -1.6, 3.6, 1.02, 6, .34, 1.55, false));

    // Waist stripe: a flattened shell that only breaks the surface along the flanks.
    add(this.accentMaterial,
      tube(.83, 1.05, -3.5, 2.4, 1.95, 12, .055, 1.22, false),
      tube(.44, .54, -4.75, -4.45, HULL_Y, 12, .80, 1.20, false));
  }

  buildCanopy(add) {
    // Collar the glass sits in, then the bubble itself.
    add(this.panelMaterial, tube(.58, .70, -3.55, -.45, 2.28, 10, .48, .98, false));

    const glass = new THREE.SphereGeometry(1, 26, 13, 0, Math.PI * 2, 0, Math.PI * .56);
    glass.scale(.62, .58, 1.55);
    glass.translate(0, 2.42, -2.0);
    add(this.glassMaterial, glass);

    // Frame rails along the canopy waist plus a nose-deck lip.
    add(this.accentMaterial,
      slab(.055, .10, 2.85, .60, 2.42, -2.0),
      slab(.055, .10, 2.85, -.60, 2.42, -2.0),
      slab(1.02, .06, .09, 0, 2.44, -3.52));
  }

  buildWings(add) {
    for (const side of [1, -1]) {
      const wing = loft({
        x: [1.05 * side, 3.40 * side],
        z: [[-1.10, 2.40], [1.15, 2.75]],
        y: [1.55, 1.95],
        t: [.16, .06],
      });
      const strake = loft({ // leading-edge root extension blending into the hull
        x: [.55 * side, 1.60 * side],
        z: [[-3.10, -.90], [-1.55, .10]],
        y: [1.62, 1.58],
        t: [.11, .05],
      });
      add(this.hullMaterial, wing, strake);

      // Wingtip fin: built horizontally, stood upright, then canted outboard.
      const fin = loft({ x: [0, .90], z: [[1.25, 2.72], [1.90, 2.66]], y: [0, 0], t: [.075, .028] });
      fin.rotateZ(Math.PI / 2 - side * .16);
      fin.translate(3.30 * side, 1.93, 0);
      add(this.panelMaterial, fin);

      // Upper-surface accent flash near the tip.
      add(this.accentMaterial, loft({
        x: [2.10 * side, 3.34 * side],
        z: [[.60, 1.30], [1.55, 2.05]],
        y: [1.86, 2.02],
        t: [.028, .020],
      }));
    }

    // Modest dorsal stabiliser; kept below the canopy so total height stays 3 m.
    const tail = loft({ x: [0, .34], z: [[3.05, 4.85], [3.55, 4.70]], y: [0, 0], t: [.085, .035] });
    tail.rotateZ(Math.PI / 2);
    tail.translate(0, 2.62, 0);
    add(this.panelMaterial, tail);
  }

  buildEngines(add) {
    for (const side of [1, -1]) {
      const x = 1.62 * side;
      const nacelle = [
        tube(.44, .60, .90, 1.70, 1.62, 14, 1, 1, false),
        tube(.60, .58, 1.70, 4.15, 1.62, 14, 1, 1),
        tube(.58, .70, 4.15, 4.62, 1.62, 14, 1, 1),
      ];
      for (const geometry of nacelle) geometry.translate(x, 0, 0);
      add(this.panelMaterial, ...nacelle);

      // Pylon tying the nacelle back into the fuselage.
      add(this.hullMaterial, loft({
        x: [1.10 * side, 1.62 * side],
        z: [[1.40, 3.60], [1.55, 3.75]],
        y: [1.74, 1.66],
        t: [.13, .30],
      }));

      // Dark intake throat and a cooling-vent strip on the nacelle spine.
      const throat = tube(.40, .40, .86, 1.05, 1.62, 14, 1, 1, true);
      throat.translate(x, 0, 0);
      add(this.darkMaterial, throat);
      add(this.glowMaterial, slab(.10, .05, 1.5, x - .22, 2.20, 2.6), slab(.10, .05, 1.5, x + .22, 2.20, 2.6));

      // Exhaust ring at the nozzle lip.
      const ring = new THREE.TorusGeometry(.47, .065, 8, 24);
      ring.translate(x, 1.62, 4.60);
      add(this.glowMaterial, ring);
    }
  }

  buildDetails(add) {
    // Manoeuvring thruster nubs: four lateral, two dorsal, two ventral.
    const nubs = [];
    const lateral = (x, y, z) => {
      const geometry = new THREE.CylinderGeometry(.115, .145, .13, 8);
      geometry.rotateZ(Math.PI / 2);
      geometry.translate(x, y, z);
      return geometry;
    };
    const vertical = (x, y, z) => {
      const geometry = new THREE.CylinderGeometry(.105, .135, .12, 8);
      geometry.translate(x, y, z);
      return geometry;
    };
    for (const side of [1, -1]) {
      nubs.push(lateral(1.02 * side, 1.92, -3.25), lateral(.98 * side, 1.44, -2.85));
      nubs.push(vertical(.70 * side, 2.56, 3.10), vertical(.60 * side, .96, -2.35));
    }
    add(this.darkMaterial, ...nubs);

    // Ventral/starboard hatch: recessed panel plus a mint outline, built flat in
    // the YZ plane then rolled onto the flank.
    const roll = -.42, hx = 1.10, hy = 1.36, hz = .55;
    const place = (geometry) => { geometry.rotateZ(roll); geometry.translate(hx, hy, hz); return geometry; };
    add(this.darkMaterial, place(slab(.07, 1.30, 1.80, .02, 0, 0)));
    add(this.accentMaterial,
      place(slab(.05, .055, 1.86, .05, .66, 0)),
      place(slab(.05, .055, 1.86, .05, -.66, 0)),
      place(slab(.05, 1.32, .055, .05, 0, .90)),
      place(slab(.05, 1.32, .055, .05, 0, -.90)));

    // Sensor blister and a couple of dorsal greeble plates.
    const blister = new THREE.SphereGeometry(.17, 10, 7);
    blister.scale(1, .7, 1.6);
    blister.translate(0, 1.06, -4.15);
    add(this.darkMaterial, blister);
    add(this.panelMaterial,
      slab(.70, .08, .46, .52, 2.50, 1.35),
      slab(.70, .08, .46, -.52, 2.50, 1.35),
      slab(.34, .09, .90, 0, 2.62, -.05));
  }

  buildGear() {
    // Nose leg plus two main legs under the nacelle pylons. Each leg is its own
    // group so retraction is a single position lerp straight up into the hull.
    for (const [x, z, top] of [[0, -3.05, 1.14], [1.58, 2.45, 1.02], [-1.58, 2.45, 1.02]]) {
      const pad = new THREE.CylinderGeometry(.23, .29, .11, 12);
      pad.translate(0, .055, 0);
      const ankle = new THREE.SphereGeometry(.125, 8, 6);
      ankle.translate(0, .16, 0);
      const strut = new THREE.CylinderGeometry(.072, .092, top - .16, 8);
      strut.translate(0, (.16 + top) / 2, 0);
      const collar = new THREE.CylinderGeometry(.145, .175, .20, 10);
      collar.translate(0, top - .10, 0);
      const merged = mergeGeometries([pad, ankle, strut, collar]);
      for (const geometry of [pad, ankle, strut, collar]) geometry.dispose();
      const mesh = new THREE.Mesh(merged, this.gearMaterial);
      mesh.castShadow = true;
      const group = new THREE.Group();
      group.name = 'Landing leg';
      group.position.set(x, 0, z);
      group.add(mesh);
      this.body.add(group);
      this.legs.push({ group, travel: top - .06 });
    }
  }

  buildExhausts() {
    // Separate meshes so throttle can scale the plume disc without touching geometry.
    for (const side of [1, -1]) {
      const disc = new THREE.CircleGeometry(.50, 24);
      const mesh = new THREE.Mesh(disc, this.exhaustMaterial);
      mesh.position.set(1.62 * side, 1.62, 4.58);
      this.body.add(mesh);
      this.exhausts.push(mesh);
    }
  }

  setGear(deployed) {
    this.gearTarget = deployed ? 1 : 0;
  }

  /** state = { throttle 0..1, boost, landed, gearDeployed, speed } */
  update(dt = 0, state) {
    const s = state || EMPTY;
    const step = clamp(dt, 0, .25);
    this.time += step;

    const landed = !!s.landed;
    this.gearTarget = (s.gearDeployed === undefined ? landed : !!s.gearDeployed) ? 1 : 0;
    if (this.gear !== this.gearTarget) {
      const delta = step / GEAR_SECONDS;
      this.gear = this.gearTarget > this.gear
        ? Math.min(this.gearTarget, this.gear + delta)
        : Math.max(this.gearTarget, this.gear - delta);
    }
    const extended = ease(this.gear);
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      leg.group.position.y = (1 - extended) * leg.travel;
      leg.group.visible = extended > .012;
    }

    const target = clamp(s.throttle ?? 0, 0, 1);
    this.throttle += (target - this.throttle) * approach(step, 6);
    this.boostMix += ((s.boost ? 1 : 0) - this.boostMix) * approach(step, 5);

    const hot = this.throttle;
    const boost = this.boostMix;
    this._color.copy(this._idle).lerp(this._hot, hot).lerp(this._boost, boost * (.35 + hot * .65));
    const glow = .35 + hot * 3.6 + boost * hot * 2.4;
    this.glowMaterial.emissive.copy(this._color);
    this.glowMaterial.emissiveIntensity = glow;
    this.exhaustMaterial.emissive.copy(this._color);
    this.exhaustMaterial.emissiveIntensity = glow * 1.3;
    this.exhaustMaterial.opacity = clamp(.20 + hot * .74, 0, 1);
    const flicker = 1 + Math.sin(this.time * 31) * .022 * hot;
    const scale = (.52 + hot * .60 + boost * hot * .26) * flicker;
    for (let i = 0; i < this.exhausts.length; i++) this.exhausts[i].scale.set(scale, scale, 1);
    if (this.engineLight) this.engineLight.intensity = glow * 2.5;

    // Idle hover: a couple of centimetres of drift while airborne and coasting.
    const amount = landed ? 0 : (1 - hot) * .014;
    this.body.position.y = Math.sin(this.time * 1.6) * amount + Math.sin(this.time * 2.7) * amount * .45;
  }

  dispose() {
    this.object.traverse((node) => { if (node.isMesh) node.geometry.dispose(); });
    for (const material of this.materials) material.dispose();
    this.object.removeFromParent();
  }
}

/** Drop-in factory matching main.js: returns the Group, ready to add to the
 * scene. The instance hangs off userData.ship, and group.update(dt, state)
 * forwards to it so animating the ship is optional. */
export function createShip(options = {}) {
  const ship = new Ship(options);
  const group = ship.object;
  group.userData.ship = ship;
  group.update = (dt, state) => ship.update(dt, state);
  group.dispose = () => ship.dispose();
  return group;
}
