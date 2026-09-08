import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion, Scene, Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { AEON, SELENE, PYRE, MIASMA, bodySurfacePoint, bodyAltitude } from '../src/celestial.js';
import { PLANET_DAY_SECONDS, ROTATION_DOMAIN_RADII, ROTATING_BODIES, PlanetRotationClock, ROTATION_EPOCH_MS,
  planetRotation, rotationFrameAt, toInertial, fromInertial, frameRelative,
  velocityBetweenFrames, frameVelocity, betweenFrames, inertialSurfacePoint } from '../src/planet-rotation.js';
import { reframeNavigation } from '../src/navigation-rotation.js';
import { planNavigationTravel, surfaceTarget } from '../src/navigation-targets.js';
import { step as flightStep } from '../src/flight-model.js';
import { PlanetRenderFrames } from '../src/planet-render-frames.js';
const near=(a,b,tolerance=1e-5)=>assert.ok(a.distanceTo(b)<tolerance,`${a.toArray()} vs ${b.toArray()}`);

test('rotation domains do not overlap and membership survives arbitrary phases',()=>{
  for(const [i,body] of ROTATING_BODIES.entries()){
    for(const other of ROTATING_BODIES.slice(i+1))assert.ok(new Vector3(...body.center).distanceTo(new Vector3(...other.center))>(body.radius+other.radius)*ROTATION_DOMAIN_RADII);
    for(const seconds of [0,900,1800,2700,3599,1e10]){
      const point=new Vector3(1,2,3).normalize().multiplyScalar(body.radius*(ROTATION_DOMAIN_RADII-.001)).add(new Vector3(...body.center));
      assert.equal(rotationFrameAt(point),body);
      assert.equal(rotationFrameAt(toInertial(point,body,seconds)),body);
    }
  }
});

test('surface anchors retain geography and submillimetre relative precision through a day at every world',()=>{
  const direction=new Vector3(.41,.22,.71).normalize();
  for(const body of [AEON,SELENE,PYRE,MIASMA]){
    const anchor=bodySurfacePoint(direction,body,8),nearby=anchor.clone().add(new Vector3(.125,.25,-.5));
    const saved=anchor.toArray(),height=bodyAltitude(anchor,body);
    for(const seconds of [0,900,1800,2700,3600,1e10]){
      const world=toInertial(anchor,body,seconds);
      near(fromInertial(world,body,seconds),anchor);
      near(frameRelative(nearby,body,anchor,body,seconds),nearby.clone().sub(anchor),1e-12);
      assert.deepEqual(anchor.toArray(),saved);
      assert.equal(bodyAltitude(anchor,body),height);
    }
    near(toInertial(anchor,body,PLANET_DAY_SECONDS),anchor);
  }
});

test('inertial arrivals sample the rotated canonical ground',()=>{
  for(const body of ROTATING_BODIES)for(const seconds of [61,900,2100]){
    const point=inertialSurfacePoint(new Vector3(.23,.1,.73),body,seconds,20_000);
    const local=fromInertial(point,body,seconds);
    assert.ok(Math.abs(bodyAltitude(local,body)-20_000)<1e-4);
  }
});

test('crossing the chart boundary preserves inertial position, heading and velocity',()=>{
  const seconds=1350;
  for(const body of ROTATING_BODIES){
    const position=new Vector3(1,.4,.7).normalize().multiplyScalar(body.radius*ROTATION_DOMAIN_RADII+1).add(new Vector3(...body.center));
    const nav={position,orientation:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.6),velocity:new Vector3(120,20,-7),shipPosition:null};
    const physical=toInertial(position,body,seconds),heading=planetRotation(body,seconds).multiply(nav.orientation);
    const velocity=velocityBetweenFrames(nav.velocity,position,body,null,seconds);
    assert.equal(reframeNavigation(nav,body,seconds),true);
    near(nav.position,physical);near(nav.velocity,velocity);
    assert.ok(nav.orientation.angleTo(heading)<1e-7);
    const reentry=nav.position.clone().sub(new Vector3(...body.center)).setLength(body.radius*ROTATION_DOMAIN_RADII-1).add(new Vector3(...body.center));
    nav.position.copy(reentry);
    const incoming=nav.velocity.clone();
    assert.equal(reframeNavigation(nav,null,seconds),true);
    near(toInertial(nav.position,body,seconds),reentry);
    near(velocityBetweenFrames(nav.velocity,nav.position,body,null,seconds),incoming);
  }
});

test('clock survives reload and can share a server phase without frame accumulation',()=>{
  let milliseconds=ROTATION_EPOCH_MS+901234;
  const first=new PlanetRotationClock({now:()=>milliseconds});
  assert.equal(first.seconds,901.234);
  assert.equal(new PlanetRotationClock({now:()=>milliseconds}).seconds,first.seconds);
  milliseconds+=120_000;first.tick();assert.equal(first.seconds,1021.234);
  first.synchronize(15);assert.equal(first.seconds,15);
  milliseconds+=1000;first.tick();assert.equal(first.seconds,16);
  assert.equal(first.synchronize(NaN),false);
});

test('drive leads a rotating surface site and arrives 20 km above its actual future terrain',()=>{
  const seconds=917,body=PYRE,direction=new Vector3(.7,.1,.5).normalize();
  const target=surfaceTarget('test-pyre','Test site',body,direction);
  // Start on the near side in inertial space, beyond the rotating chart.
  const radial=direction.clone().applyQuaternion(planetRotation(body,seconds));
  const start=radial.clone().multiplyScalar(50_000_000).add(new Vector3(...body.center));
  for(const spoolSeconds of [null,0]){
  const route=planNavigationTravel(start,target,{rotationTime:seconds,spoolSeconds});
  assert.equal(route.ok,true,route.reason);
  const arrival=seconds+route.plan.duration;
  const actual=fromInertial(route.plan.end,body,arrival);
  near(actual,bodySurfacePoint(direction,body,20_000),.001);
  assert.equal(route.plan.coordinates,'inertial');
  if(spoolSeconds===0)assert.equal(route.plan.spoolSeconds,0);
  }
  const unchanged=JSON.stringify(target);
  planNavigationTravel(start,target,{rotationTime:seconds+600});
  assert.equal(JSON.stringify(target),unchanged,'plotting does not move the authored target');
});

test('inertial flight includes rotation forces and preserves inertial attitude',()=>{
  const offset=new Vector3(AEON.radius+150_000,0,0),position=offset.clone();
  let velocity=new Vector3(),orientation=new Quaternion();
  const initial=frameVelocity(position,AEON),step=1/240,duration=10;
  for(let t=0;t<duration-1e-9;t+=step){
    const result=flightStep({velocity,orientation},{assist:false,maxSpeed:Infinity},{density:0,gravity:new Vector3(),rotationOffset:position.clone()},step);
    velocity=result.velocity;orientation=result.orientation;position.addScaledVector(velocity,step);
  }
  const physical=toInertial(position,AEON,duration),expected=offset.clone().addScaledVector(initial,duration);
  near(physical,expected,1);
  assert.ok(planetRotation(AEON,duration).multiply(orientation).angleTo(new Quaternion())<1e-7);
});

test('the camera and a hull retain their explicit chart when they straddle its boundary',()=>{
  const origin=new Vector3(AEON.radius*ROTATION_DOMAIN_RADII-1,0,0),scene=new Scene();
  const ship=new Mesh(new BoxGeometry(),new MeshBasicMaterial());ship.position.set(3,0,0);ship.userData.planetFrame=AEON.id;scene.add(ship);
  const frames=new PlanetRenderFrames();frames.update(origin,AEON,900);
  frames.apply(scene);near(ship.position,new Vector3(3,0,0));frames.restore();
  // A foreign root can be located at the arbitrary render origin and still
  // contain meshes in another chart. Its explicit tag avoids inferring a body
  // from the container's zero translation.
  const root=new Group();root.userData.planetFrame=SELENE.id;scene.add(root);
  const piece=new Mesh(new BoxGeometry(),new MeshBasicMaterial());root.add(piece);
  const anchor=bodySurfacePoint(new Vector3(1,0,0),SELENE,0);piece.position.copy(anchor).sub(origin);
  frames.apply(scene);scene.updateMatrixWorld(true);
  near(piece.getWorldPosition(new Vector3()),frameRelative(anchor,SELENE,origin,AEON,900),1e-5);
  frames.restore();near(root.position,new Vector3());assert.ok(root.quaternion.angleTo(new Quaternion())<1e-8);
  for(const mesh of [ship,piece]){mesh.geometry.dispose();mesh.material.dispose();}
});
