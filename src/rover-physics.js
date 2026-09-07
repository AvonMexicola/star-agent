import * as THREE from 'three';
import { ROVER_LAYOUT } from './rover-layout.js';

const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1);
const STEP=1/120,MAX_FRAME=.25,EPS=.00001;
const clamp=THREE.MathUtils.clamp;
const approach=(value,target,amount)=>value+clamp(target-value,-amount,amount);
const input=value=>Number.isFinite(value)?clamp(value,-1,1):0;
function vector(value){return value?.isVector3?value.clone():Array.isArray(value)?new THREE.Vector3(...value):new THREE.Vector3(value?.x,value?.y,value?.z);}
function finite(value){return [value.x,value.y,value.z].every(Number.isFinite);}
function rotation(value){const q=value?.isQuaternion?value.clone():new THREE.Quaternion(...(value??[0,0,0,1]));if(!q.toArray().every(Number.isFinite)||q.lengthSq()<1e-12)throw new TypeError('Invalid rover quaternion');return q.normalize();}

/** Whole vehicle bounds include all steering and suspension poses. The authored
 * hull width describes straight wheels; turned tyres extend beyond that width. */
export function roverSweptBounds(layout=ROVER_LAYOUT){
  const min=[...layout.bounds.min],max=[...layout.bounds.max];
  const r=layout.wheelRadius,w=layout.wheelWidth/2,limit=layout.driving.wheelSteerLimit;
  for(const wheel of layout.wheels){
    const turn=wheel.front?limit:0;
    const xAngle=Math.min(turn,Math.atan2(r,w)),zAngle=Math.min(turn,Math.atan2(w,r));
    const xExtent=w*Math.cos(xAngle)+r*Math.sin(xAngle),zExtent=r*Math.cos(zAngle)+w*Math.sin(zAngle);
    const extent=[xExtent,r+layout.driving.suspensionTravel,zExtent];
    for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],wheel.position[axis]-extent[axis]);max[axis]=Math.max(max[axis],wheel.position[axis]+extent[axis]);}
  }
  return {min,max};
}

/** Eight double-precision world corners of the conservative complete assembly. */
export function roverFootprint(position,quaternion,{layout=ROVER_LAYOUT}={}){
  const {min,max}=roverSweptBounds(layout),corners=[];
  for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])corners.push(new THREE.Vector3(x,y,z).applyQuaternion(quaternion).add(position));
  return corners;
}

/** Containment only, not a support query. Platform frame uses its supplied world
 * position/quaternion, X/Z limits and optional local ceiling. The full assembly
 * must clear its edges/ceiling; contact with the actual floor is owned by support.
 * Example Atlas frame: {position,quaternion,minX:-4,maxX:4,minZ:0,maxZ:10,ceiling:9.2}.
 */
export function roverFitsPlatform(position,quaternion,platform,{layout=ROVER_LAYOUT,margin=layout.atlas.clearanceMargin}={}){
  if(!Number.isFinite(margin)||margin<0)throw new RangeError('Invalid platform margin');
  const origin=platform.position??new THREE.Vector3(),inverse=(platform.quaternion??new THREE.Quaternion()).clone().invert();
  return roverFootprint(position,quaternion,{layout}).every(corner=>{
    corner.sub(origin).applyQuaternion(inverse);
    return corner.x>=platform.minX+margin-EPS&&corner.x<=platform.maxX-margin+EPS&&corner.z>=platform.minZ+margin-EPS&&corner.z<=platform.maxZ-margin+EPS&&corner.y<=(platform.ceiling??Infinity)-margin+EPS;
  });
}

/** Grounded kinematic four-wheel driving; no terrain, gravity or airborne floor
 * is invented here. All positions stay JS doubles. sampleSupport(worldPoint)
 * returns {point:Vector3,normal:Vector3,source} or null; referenceUp(worldPoint)
 * supplies gravity-up (radial on a body, the carrier's up on a deck). Its default
 * is the initial orientation's up, appropriate only for a fixed planar frame.
 * constrain({previous,proposed,previousCorners,corners,layout,dt}) receives both
 * complete poses and swept-envelope corners. false/{blocked:true} vetoes the
 * entire substep; true/undefined accepts it. The caller owns obstacle sweeps.
 *
 * step(dt,{throttle,steer,brake,active}) uses signed throttle and right-positive
 * steering. state.steer is right-positive radians; front wheel.steer is the
 * actual local-Y rig angle (negative for right). wheel.spin rotates local X;
 * suspension is local-Y metres from the authored wheel centre.
 * State is read-only to callers; use setPose for placement/carrier motion.
 */
export function createRoverPhysics({position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),layout=ROVER_LAYOUT,sampleSupport,referenceUp,constrain=()=>true}={}){
  if(typeof sampleSupport!=='function')throw new TypeError('Rover requires canonical sampleSupport');
  if(layout.wheels.length!==4)throw new TypeError('Rover requires four canonical wheels');
  const initialRotation=rotation(quaternion),initialUp=UP.clone().applyQuaternion(initialRotation);
  const gravity=referenceUp??(()=>initialUp),drive=layout.driving;
  const state={position:vector(position),quaternion:initialRotation,speed:0,steer:0,active:false,supported:false,blocked:false,reason:'placed',distance:0,droppedTime:0,
    wheels:layout.wheels.map(wheel=>({id:wheel.id,steer:0,spin:0,suspension:0,contact:null,normal:null,source:null}))};
  if(!finite(state.position))throw new TypeError('Invalid rover position');
  const localFeet=layout.wheels.map(wheel=>new THREE.Vector3(...wheel.position).addScaledVector(UP,-layout.wheelRadius));
  let accumulator=0;
  function upAt(point){const up=vector(gravity(point.clone()));return finite(up)&&up.lengthSq()>1e-12?up.normalize():null;}
  function failure(reason){state.speed=0;state.blocked=true;state.reason=reason;return false;}
  function groundPose(proposed){
    let pose={position:proposed.position.clone(),quaternion:proposed.quaternion.clone()},samples=[];
    // Two local plane fits settle pitch/roll without smoothing through a wall or
    // moving the rover toward an unsupported future pose.
    for(let pass=0;pass<2;pass++){
      samples=[];
      for(let index=0;index<4;index++){
        const probe=localFeet[index].clone().applyQuaternion(pose.quaternion).add(pose.position),hit=sampleSupport(probe.clone());
        if(!hit?.point||!hit.normal)return {reason:'unsupported'};
        const point=vector(hit.point),normal=vector(hit.normal),up=upAt(point);
        if(!finite(point)||!finite(normal)||normal.lengthSq()<1e-12||!up)return {reason:'unsupported'};
        normal.normalize();if(normal.dot(up)<Math.cos(drive.maxSlope)-1e-8)return {reason:'slope'};
        const previous=state.wheels[index].contact??localFeet[index].clone().applyQuaternion(state.quaternion).add(state.position);
        if(Math.abs(point.clone().sub(previous).dot(up))>drive.maxStep+EPS)return {reason:'step'};
        samples.push({point,normal,source:hit.source});
      }
      const side=(front,right)=>samples[layout.wheels.findIndex(wheel=>Boolean(wheel.front)===front&&(wheel.position[0]>0)===right)].point;
      const right=side(true,true).clone().sub(side(true,false)).add(side(false,true).clone().sub(side(false,false)));
      const forward=side(true,false).clone().sub(side(false,false)).add(side(true,true).clone().sub(side(false,true)));
      const up=right.clone().cross(forward),gravityUp=upAt(pose.position);
      if(up.lengthSq()<1e-12||!gravityUp)return {reason:'unsupported'};
      up.normalize();if(up.dot(gravityUp)<Math.cos(drive.maxSlope)-1e-8)return {reason:'slope'};
      const heading=FORWARD.clone().applyQuaternion(proposed.quaternion).projectOnPlane(up);
      if(heading.lengthSq()<1e-12)return {reason:'slope'};
      heading.normalize();const axis=heading.clone().cross(up).normalize();
      pose.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,up,heading.negate())).normalize();
      let height=0;
      for(let index=0;index<4;index++)height+=samples[index].point.clone().sub(pose.position).sub(localFeet[index].clone().applyQuaternion(pose.quaternion)).dot(up)/4;
      pose.position.addScaledVector(up,height);
    }
    const up=UP.clone().applyQuaternion(pose.quaternion),suspension=samples.map((sample,index)=>sample.point.clone().sub(pose.position).sub(localFeet[index].clone().applyQuaternion(pose.quaternion)).dot(up));
    if(suspension.some(value=>Math.abs(value)>drive.suspensionTravel+EPS))return {reason:'suspension'};
    return {...pose,samples,suspension};
  }
  function advance(dt,controls){
    state.steer=approach(state.steer,controls.steer*drive.wheelSteerLimit,drive.wheelSteerLimit*4*dt);
    for(let index=0;index<4;index++)state.wheels[index].steer=layout.wheels[index].front?-state.steer:0;
    const beforeSpeed=state.speed,target=controls.throttle*(controls.throttle>=0?drive.forwardSpeed:drive.reverseSpeed);
    const braking=controls.brake>0||target===0||beforeSpeed*target<0;
    const nextSpeed=controls.brake>0?approach(beforeSpeed,0,drive.braking*controls.brake*dt):approach(beforeSpeed,target,(braking?drive.braking:drive.acceleration)*dt);
    const distance=(beforeSpeed+nextSpeed)*.5*dt,yaw=-distance*Math.tan(state.steer)/layout.wheelbase,up=UP.clone().applyQuaternion(state.quaternion);
    const previous={position:state.position.clone(),quaternion:state.quaternion.clone()};
    const proposed={position:previous.position.clone(),quaternion:new THREE.Quaternion().setFromAxisAngle(up,yaw).multiply(previous.quaternion)};
    const direction=FORWARD.clone().applyQuaternion(previous.quaternion).applyAxisAngle(up,yaw*.5);
    const arc=Math.abs(yaw)>1e-8?Math.sin(yaw*.5)/(yaw*.5):1;
    proposed.position.addScaledVector(direction,distance*arc);
    const grounded=groundPose(proposed);if(grounded.reason)return failure(grounded.reason);
    const candidate={position:grounded.position,quaternion:grounded.quaternion};
    const result=constrain({previous,proposed:candidate,previousCorners:roverFootprint(previous.position,previous.quaternion,{layout}),corners:roverFootprint(candidate.position,candidate.quaternion,{layout}),layout,dt});
    if(result===false||result?.blocked)return failure('collision');
    state.position.copy(candidate.position);state.quaternion.copy(candidate.quaternion);state.speed=nextSpeed;state.supported=true;state.blocked=false;state.reason='grounded';
    state.distance+=Math.abs(state.position.clone().sub(previous.position).dot(direction));
    for(let index=0;index<4;index++){
      const wheel=state.wheels[index],sample=grounded.samples[index];
      if(Math.abs(distance)>1e-12){
        const prior=wheel.contact??localFeet[index].clone().applyQuaternion(previous.quaternion).add(previous.position);
        const rolling=FORWARD.clone().applyAxisAngle(UP,wheel.steer).applyQuaternion(state.quaternion);
        const travel=sample.point.clone().sub(prior).dot(rolling);
        wheel.spin=THREE.MathUtils.euclideanModulo(wheel.spin-travel/layout.wheelRadius+Math.PI,Math.PI*2)-Math.PI;
      }
      wheel.suspension=grounded.suspension[index];wheel.contact=sample.point;wheel.normal=sample.normal;wheel.source=sample.source;
    }
    return true;
  }
  return {state,
    step(dt,{throttle=0,steer=0,brake=0,active=true}={}){
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid rover dt');
      state.active=Boolean(active);
      if(!active){state.speed=0;state.blocked=false;state.reason='inactive';accumulator=0;return state;}
      const elapsed=Math.min(dt,MAX_FRAME);state.droppedTime+=dt-elapsed;accumulator+=elapsed;
      const steps=Math.floor((accumulator+1e-12)/STEP);accumulator=Math.max(0,accumulator-steps*STEP);
      const controls={throttle:input(throttle),steer:input(steer),brake:brake===true?1:clamp(input(brake),0,1)};
      for(let i=0;i<steps;i++)if(!advance(STEP,controls)){accumulator=0;break;}
      return state;
    },
    /** Explicit carrier/placement transform. No terrain snapping or motion runs
     * here. preserveMotion carries contact positions/normals rigidly as well as
     * keeping speed, wheel spin, steering and suspension. Default resets them. */
    setPose(position,quaternion,{preserveMotion=false}={}){
      const nextPosition=vector(position),nextRotation=rotation(quaternion);
      if(!finite(nextPosition))throw new TypeError('Invalid rover position');
      if(preserveMotion){
        const delta=nextRotation.clone().multiply(state.quaternion.clone().invert());
        for(const wheel of state.wheels){wheel.contact?.sub(state.position).applyQuaternion(delta).add(nextPosition);wheel.normal?.applyQuaternion(delta).normalize();}
      }else{
        state.speed=0;state.steer=0;state.supported=false;state.blocked=false;state.reason='placed';state.distance=0;
        for(const wheel of state.wheels)Object.assign(wheel,{steer:0,spin:0,suspension:0,contact:null,normal:null,source:null});
      }
      state.position.copy(nextPosition);state.quaternion.copy(nextRotation);if(!preserveMotion)accumulator=0;return state;
    },
  };
}
