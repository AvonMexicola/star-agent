import { Matrix4, Quaternion, Vector3 } from 'three';
import { SHIP_LAYOUT } from './boarding.js';
import { RADIUS, terrainHeight } from './world.js';

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
  const direction = point.clone().normalize();
  return RADIUS + Math.max(0, terrainHeight(direction.x, direction.y, direction.z));
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
    this.engaged=false;
    this.active=false;
    this.obstructed=false;
    this.position=new Vector3();
    this.orientation=new Quaternion();
    this.matrix=new Matrix4();
  }
  toggle(mode) {
    if(mode!=='flight'&&mode!=='landed')return false;
    this.engaged=true;
    this.external=!this.external;
    return true;
  }
  update(nav, { surfaceRadius=groundRadiusAt, clipStation }={}) {
    if(nav.mode!=='flight'&&nav.mode!=='landed')this.external=false;
    this.active=false;this.obstructed=false;
    this.position.copy(nav.position);this.orientation.copy(nav.orientation);
    if(!this.external)return;
    const attitude=nav.shipPosition ? nav.shipOrientation : nav.orientation;
    const offset=BOOM.clone().applyQuaternion(attitude);
    let desired=nav.position.clone().add(offset);
    if(clipStation)desired=clipStation(nav.position,desired,attitude);
    desired=clipTerrainCamera(nav.position,desired,surfaceRadius);
    const actualOffset=desired.clone().sub(nav.position);
    this.obstructed=actualOffset.length()+.05<offset.length();
    // Tight bays automatically show the cockpit instead of putting the camera
    // inside the hull. The selected chase view resumes when there is room.
    if(actualOffset.length()<CLEAR_DISTANCE)return;
    this.position.copy(desired);this.active=true;
    this.matrix.lookAt(actualOffset,TARGET.clone().applyQuaternion(attitude),UP.clone().applyQuaternion(attitude));
    this.orientation.setFromRotationMatrix(this.matrix);
  }
}
