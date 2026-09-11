import {Vector3,Quaternion} from 'three';
import {ROTATING_BODIES,betweenFrames,frameRotation,rotationFrameAt,toInertial} from '../planet-rotation.js';

export const sentryFrame=id=>ROTATING_BODIES.find(body=>body.id===id)??null;
export function sentryPoseFrame(value){
  const state=value.state??value;
  if(Object.hasOwn(state,'planetFrame'))return sentryFrame(state.planetFrame);
  const position=value.physics?.state.position??value.position;
  return rotationFrameAt(position?.isVector3?position:new Vector3(...position));
}
export function sentryPoseInFrame(pose,from,to,seconds){
  const position=pose.position.isVector3?pose.position:new Vector3(...pose.position),q=pose.quaternion.isQuaternion?pose.quaternion:new Quaternion(...pose.quaternion);
  return {position:betweenFrames(position,from,to,seconds),quaternion:frameRotation(from,to,seconds).multiply(q)};
}
/** Navigation selects its own chart at the suit position. A carried rover can
 * straddle the carrier's chart boundary without moving its riders physically. */
export function sentryPointForNavigation(point,from,nav){
  if(!nav.rotationClock)return {point:point.clone(),rotation:new Quaternion()};
  const to=rotationFrameAt(toInertial(point,from,nav.rotationTime));
  return {frame:to,point:betweenFrames(point,from,to,nav.rotationTime),rotation:frameRotation(from,to,nav.rotationTime)};
}
