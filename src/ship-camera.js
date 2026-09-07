import { Matrix4, Quaternion, Raycaster, Vector3 } from 'three';
import { SHIP_LAYOUT } from './boarding.js';
import { bodyAltitude } from './celestial.js';

const SEAT = new Vector3(...SHIP_LAYOUT.seatEye);
const BOOM = new Vector3(0, 7, 24).sub(SEAT);
const TARGET = new Vector3(0, 1.8, -1).sub(SEAT);
const UP = new Vector3(0, 1, 0);
// A retracted camera must still be outside the complete authored ship envelope.
const CLEAR_DISTANCE = Math.hypot(...['x','y','z'].map((axis,i) => Math.max(
  Math.abs(SHIP_LAYOUT.flightBounds.min[i]-SEAT[axis]),
  Math.abs(SHIP_LAYOUT.flightBounds.max[i]-SEAT[axis]),
))) + .6;

export function groundRadiusAt(point) {
  // Express nearest-body clearance in the radial callback convention, including Selene.
  return point.length() - bodyAltitude(point);
}

/** Clip the camera boom against the shared terrain/water surface. Sampling at
 * <=1 m intervals detects intervening ridges, not only an underground endpoint.
 * Bisection finds the first crossing; camera clearance is 45 cm. No nav mutation.
 */
export function clipTerrainCamera(start, end, surfaceRadius = groundRadiusAt) {
  const offset = end.clone().sub(start), distance = offset.length();
  const point = new Vector3();
  const clear = t => {
    point.copy(start).addScaledVector(offset,t);
    return point.length() > surfaceRadius(point) + .45;
  };
  if (!clear(0)) return start.clone();
  const steps = Math.max(1, Math.ceil(distance));
  let previous = 0;
  for (let i=1;i<=steps;i++) {
    const t=i/steps;
    if (!clear(t)) {
      let low=previous,high=t;
      for(let j=0;j<12;j++) {
        const mid=(low+high)/2;
        if(clear(mid))low=mid;else high=mid;
      }
      return start.clone().addScaledVector(offset,Math.max(0,low-.02/Math.max(1,distance)));
    }
    previous=t;
  }
  return end.clone();
}

/** Key 4 belongs to the camera only outside editable controls and dialogs. */
export function isShipCameraKey(event) {
  return (event.code==='Digit4'||event.code==='Numpad4') && !event.repeat
    && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
    && !event.target?.isContentEditable
    && !event.target?.closest?.('input, textarea, select, dialog');
}

/** Chase camera is presentation only. Navigation keeps its physical pilot-eye
 * position and ship orientation. All differences are computed in JS doubles
 * before main.js uploads camera-relative GPU positions.
 */
export class ShipCamera {
  constructor() {
    this.external=false;
    this.playerExternal=false;
    this.engaged=false;
    this.active=false;
    this.obstructed=false;
    this.position=new Vector3();
    this.orientation=new Quaternion();
    this.matrix=new Matrix4();
  }
  toggle(mode) {
    if(mode==='walk'||mode==='eva'){this.playerExternal=!this.playerExternal;return true;}
    if(mode!=='flight'&&mode!=='landed')return false;
    this.engaged=true;
    this.external=!this.external;
    return true;
  }
  selected(mode) { return mode==='walk'||mode==='eva'?this.playerExternal:this.external; }
  update(nav, { surfaceRadius=groundRadiusAt, clipStation, clipShip }={}) {
    const walking=nav.mode==='walk'||nav.mode==='eva';

    this.active=false;this.obstructed=false;
    this.position.copy(nav.position);this.orientation.copy(nav.orientation);
    // The standing avatar has no reclining animation. Use the physical berth eye
    // and preserve the player's selected walking camera for when they stand.
    if(nav.berthRest||nav.berthTransition)return;
    if(!this.selected(nav.mode))return;
    const attitude=walking?nav.orientation:(nav.shipPosition ? nav.shipOrientation : nav.orientation);
    const layout=nav.layout??SHIP_LAYOUT, scale=Math.max(1,(layout.flightBounds.max[2]-layout.flightBounds.min[2])/(SHIP_LAYOUT.flightBounds.max[2]-SHIP_LAYOUT.flightBounds.min[2]));
    const offset=(walking?new Vector3(.8,.35,3.7):BOOM.clone().multiplyScalar(scale)).applyQuaternion(attitude);
    let desired=nav.position.clone().add(offset);
    if(clipStation)desired=clipStation(nav.position,desired,attitude);
    if(walking&&clipShip)desired=clipShip(nav.position,desired);
    desired=clipTerrainCamera(nav.position,desired,surfaceRadius);
    const actualOffset=desired.clone().sub(nav.position);
    this.obstructed=actualOffset.length()+.05<offset.length();
    // Tight bays automatically show the cockpit instead of putting the camera
    // inside the hull. The selected chase view resumes when there is room.
    if(actualOffset.length()<(walking?.85:CLEAR_DISTANCE*scale))return;
    this.position.copy(desired);this.active=true;
    const up=nav.mode==='walk'?playerUp(nav):UP.clone().applyQuaternion(attitude);
    // Keep the sight line beside the right shoulder instead of converging on
    // the player's torso, which would cover the central aiming reticle.
    this.matrix.lookAt(actualOffset,(walking?new Vector3(.8,-.65,-2):TARGET.clone()).applyQuaternion(attitude),up);
    this.orientation.setFromRotationMatrix(this.matrix);
  }
}

/** Match the navigation support frame on the ramp and in the cabin. */
export function playerUp(nav) {
  if(nav.mode==='eva')return UP.clone().applyQuaternion(nav.orientation);
  const grid=nav.stationPhysics;
  if(grid&&nav.mode==='walk')return grid.up.clone();
  const local=nav.toShipLocal?.();
  const bounds=nav.layout?.flightBounds;
  const supportRadius=bounds?Math.max(25,Math.hypot(...bounds.min.map((value,i)=>Math.max(Math.abs(value),Math.abs(bounds.max[i]))))+2):25;
  return local && local.length()<supportRadius ? UP.clone().applyQuaternion(nav.shipOrientation) : nav.normal.clone();
}

/** Clip against visible ship triangles in its small render frame. World-to-ship
 * subtraction happens in Navigation's double precision transform first. Hidden
 * fallback meshes and the player are never obstructions. */
export function clipShipCamera(start,end,ship,toLocal) {
  ship.updateWorldMatrix(true,true);
  const a=toLocal(start).applyMatrix4(ship.matrixWorld);
  const b=toLocal(end).applyMatrix4(ship.matrixWorld);
  const delta=b.sub(a),distance=delta.length();
  if(distance<1e-8)return end.clone();
  const ray=new Raycaster(a,delta.divideScalar(distance),0,distance+.2);
  const hit=ray.intersectObject(ship,true).find(hit=>{
    for(let node=hit.object;node;node=node.parent)if(!node.visible)return false;
    return true;
  });
  return hit?start.clone().lerp(end,Math.min(1,Math.max(0,hit.distance-.25)/distance)):end.clone();
}
