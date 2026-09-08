import {GANNET_LAYOUT as L, GANNET_LIFT as P, GANNET_VESTIBULE} from './gannet-layout.js';
const toward = (n, target, step) => n + Math.sign(target - n) * Math.min(Math.abs(target - n), step);
const inside = (p, b) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;

/** Local mechanism/floor adapter. Integration supplies trusted guards. No player
 * pose, ship pose, navigation mode or terrain mutations occur in this class. */
export class GannetSystems {
  constructor({canMove = () => true, canOperate = () => true} = {}) {
    this.canMove = canMove; this.canOperate = canOperate;
    this.lifts = [{...P, y:P.high, target:P.high}];
    this.hatch = {progress:0, target:0}; this.powered = true; this.lastReason = '';
  }
  get lift() { return this.lifts[0]; }
  get moving() { return Math.abs(this.lift.y - this.lift.target) > 1e-6 || Math.abs(this.hatch.progress - this.hatch.target) > 1e-6; }
  get secured() { return this.lift.y >= P.high - 1e-6 && this.lift.target === P.high && this.hatch.progress <= 1e-6 && this.hatch.target === 0; }
  reject(reason) { this.lastReason = reason; return {ok:false, reason}; }
  command(action, {occupant = null} = {}) {
    if (!['open','close','lower','raise'].includes(action)) return this.reject('Unknown Gannet mechanism command.');
    if (!this.powered || !this.canOperate(action)) return this.reject('Vehicle access requires a powered, safely parked ship.');
    if (action === 'close') {
      if (this.lift.y < P.high - 1e-6 || this.lift.target !== P.high) return this.reject('Raise the vehicle elevator before closing the hatch.');
      if (!this.canMove({kind:'hatch', target:0}, occupant)) return this.reject('Clear the rear hatch before closing it.');
      this.hatch.target = 0;
    } else if (action === 'open') {
      if (!this.canMove({kind:'hatch', target:1}, occupant)) return this.reject('Clear the rear hatch before opening it.');
      this.hatch.target = 1;
    }
    else {
      if (this.hatch.progress < 1 - 1e-6 || this.hatch.target !== 1) return this.reject('Open the rear hatch fully before moving the elevator.');
      const target = action === 'raise' ? P.high : P.low;
      if (!this.canMove({...this.lift, kind:'lift', target}, occupant)) return this.reject('Move fully onto or clear of the vehicle elevator.');
      this.lift.target = target;
    }
    this.lastReason = ''; return {ok:true};
  }
  toggle(id, occupant = null) {
    return id === P.id && this.command(this.lift.target === P.high ? 'lower' : 'raise', {occupant}).ok;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !this.powered || !this.canOperate('update')) return;
    const step = Math.min(dt, .25);
    if (this.canMove({kind:'hatch', target:this.hatch.target}, null)) {
      this.hatch.progress = toward(this.hatch.progress, this.hatch.target, step / L.hatch.seconds);
    }
    if (this.hatch.progress >= 1 - 1e-6 && this.hatch.target === 1 && this.canMove({...this.lift, kind:'lift'}, null)) {
      this.lift.y = toward(this.lift.y, this.lift.target, step * P.speed);
    }
  }
  floorAt(eye, {tolerance = .55} = {}) {
    if (!eye || ![eye.x,eye.y,eye.z].every(Number.isFinite)) return null;
    const foot = eye.y - L.eyeHeight;
    if (inside(eye, P) && Math.abs(foot - this.lift.y) <= tolerance) return {y:this.lift.y, source:'gannet-lift:vehicle', lift:P.id};
    if ((inside(eye, L.interior) || inside(eye, GANNET_VESTIBULE)) && eye.z < P.minZ && Math.abs(foot - L.floorY) <= tolerance) return {y:L.floorY, source:'gannet-deck', lift:null};
    return null;
  }
  mechanismPose(gearProgress = 1) { return {gearProgress, hatchProgress:this.hatch.progress, liftY:this.lift.y}; }
}
