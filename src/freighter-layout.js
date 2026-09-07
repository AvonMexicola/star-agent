import { crossesWall } from './boarding.js';

export const FREIGHTER_LAYOUT = Object.freeze({
  flightBounds: { min: [-9.5, 0, -16], max: [9.5, 9.8, 14] },
  // The underbody is open. A single solid box would snag the pad beneath the bay.
  flightParts: [
    { min: [-6.6,3.5,-16], max: [6.6,9.8,10.4] },
    ...[-1,1].flatMap(side=>[
      { min: [side<0?-9.5:6.6,3.5,-4.2], max: [side<0?-6.6:9.5,7.1,14] },
      ...[-8,8].map(z=>({ min:[side<0?-8.5:6,.0,z-.5], max:[side<0?-6:8.5,4.4,z+2] })),
    ]),
  ],
  floorY: 4, eyeHeight: 1.75, capsuleRadius: .25,
  interior: { minX: -6, maxX: 6, minZ: -12, maxZ: 10 },
  seat: [0, 4, -10.5], seatEye: [0, 5.55, -10.5], stand: [0, 5.75, -8.8],
});
export const LIFTS = Object.freeze([
  { id: 'main', name: 'Belly elevator', node: 'MainLift', minX: -4, maxX: 4, minZ: 0, maxZ: 10, low: 0, high: 4, speed: .7, control: [0, 1] },
  { id: 'port', name: 'Port cargo lift', node: 'PortLift', minX: -5.9, maxX: -3.7, minZ: -6, maxZ: -3, low: 4, high: 7, speed: .6, control: [-4.8, -3.8] },
  { id: 'starboard', name: 'Starboard cargo lift', node: 'StarboardLift', minX: 3.7, maxX: 5.9, minZ: -6, maxZ: -3, low: 4, high: 7, speed: .6, control: [4.8, -3.8] },
]);
const inside = (p, b, margin = 0) => p.x >= b.minX + margin && p.x <= b.maxX - margin && p.z >= b.minZ + margin && p.z <= b.maxZ - margin;
const wall = (a,b,c,d) => [a-.25,b+.25,c-.25,d+.25];

/** One simulation drives render transforms, walk support and rider displacement. */
export class FreighterSystems {
  constructor() { this.lifts = LIFTS.map(def => ({ ...def, y: def.id === 'main' ? 4 : def.low, target: def.id === 'main' ? 4 : def.low })); }
  get secured() { return this.lifts.every(lift => Math.abs(lift.y - (lift.id === 'main' ? lift.high : lift.low)) < .001 && lift.target === lift.y); }
  get snapshot() { return this.lifts.map(({id,y,target}) => ({id,y,target})); }
  toggle(id, rider) {
    const lift = this.lifts.find(l => l.id === id);
    if (!lift || Math.abs(lift.y - lift.target) > .001) return false;
    if (this.canMove && !this.canMove(lift, rider)) return false;
    // A player straddling the platform edge must step fully on or off first.
    if (rider && inside(rider, lift, -.25) && !inside(rider, lift, .3)) return false;
    lift.target = lift.y === lift.low ? lift.high : lift.low;
    return true;
  }
  update(dt, rider) {
    let carry = 0;
    for (const lift of this.lifts) {
      const previous = lift.y;
      const distance = lift.target - previous;
      lift.y += Math.sign(distance) * Math.min(Math.abs(distance), Math.max(0, Math.min(dt,.1)) * lift.speed);
      if (rider && inside(rider,lift,.24) && Math.abs(rider.y - 1.75 - previous) < .12) carry += lift.y - previous;
    }
    return carry;
  }
  floorAt(p) {
    const foot = p.y - 1.75;
    for (const lift of this.lifts) if (inside(p,lift)) return Math.abs(foot-lift.y)<.3 ? lift.y : null;
    // Two elevated shelving landings adjoining the internal cargo lifts.
    if (Math.abs(p.x)>3.7 && Math.abs(p.x)<5.9 && p.z>=-8 && p.z<=-6 && foot>6.7) return 7;
    if (inside(p,FREIGHTER_LAYOUT.interior) && Math.abs(foot-4)<.3) return 4;
    return null;
  }
  constrain(previous, proposed) {
    const foot = previous.y - 1.75;
    const walls = [];
    if (foot > 3.6) {
      walls.push(wall(-6,-6,-12,10),wall(6,6,-12,10),wall(-6,6,-12,-12),wall(-6,6,10,10));
      // Solid cargo chest, with its face accessible from the central aisle.
      walls.push(wall(2.3,3.3,-8.4,-6.6));
    }
    for (const lift of this.lifts) {
      if(lift.id!=='main' && Math.abs(foot-lift.y)<.3){const x=(lift.minX+lift.maxX)/2+Math.sign(lift.minX)*.5;walls.push(wall(x-.375,x+.375,-5.55,-4.65));}
      const riding = inside(previous,lift,.1) && Math.abs(foot-lift.y)<.3;
      const moving = Math.abs(lift.target-lift.y)>.001;
      if (moving && riding || Math.abs(foot-lift.y)>.3 && foot>=lift.low-.1 || riding && lift.y!==4) {
        const {minX:a,maxX:b,minZ:c,maxZ:d}=lift;
        walls.push(wall(a,a,c,d),wall(b,b,c,d),wall(a,b,c,c));
        // Ground boarding enters through the rear edge of the lowered elevator.
        if (!(lift.id==='main' && lift.y===0 && !moving && foot<.3)) walls.push(wall(a,b,d,d));
        // Internal lift upper landing opens toward the shelf at -Z.
        if (lift.id!=='main' && lift.y===7 && !moving && foot>6.7) walls.splice(walls.length-2,1);
      }
    }
    if (foot>6.7 && !this.lifts.some(l=>inside(previous,l))) {
      const s = Math.sign(previous.x);
      walls.push(wall(s<0?-5.9:3.7,s<0?-5.9:3.7,-8,-6),wall(s<0?-3.7:5.9,s<0?-3.7:5.9,-8,-6),wall(-6,6,-8,-8));
    }
    return walls.some(w=>crossesWall(previous,proposed,w)) ? previous.clone() : proposed.clone();
  }
  interaction(p) {
    if (Math.abs(p.y-5.75)<.4 && Math.hypot(p.x,p.z+10.5)<1.8) return 'seat';
    if (Math.abs(p.y-5.75)<.4 && Math.hypot(p.x-2.1,p.z+7.5)<1.3) return 'storage';
    for (const lift of this.lifts) {
      const [x,z]=lift.control;
      if (Math.hypot(p.x-x,p.z-z)<1.5 && Math.abs(p.y-1.75-lift.y)<.35) return `lift:${lift.id}`;
      // Fixed call stations beside each landing; reachable when the platform is away.
      if (lift.id==='main' && Math.abs(p.x)<1.5 && (Math.abs(p.z+1)<1.2 && Math.abs(p.y-5.75)<.4 || Math.abs(p.z-11)<1.2 && p.y<2.1)) return 'lift:main';
      if (lift.id!=='main' && Math.abs(p.x-x)<.8 && Math.abs(p.z+6.7)<.65 && (Math.abs(p.y-5.75)<.4 || Math.abs(p.y-8.75)<.4)) return `lift:${lift.id}`;
    }
    return null;
  }
}
