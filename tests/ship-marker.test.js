import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {projectShipMarker,markerDistance} from '../src/ship-marker-projection.js';
const view={width:1440,height:900,fov:52},origin=new Vector3(),orientation=new Quaternion();
test('ship beacon projects ahead and preserves left/right for targets behind the player',()=>{
  const ahead=projectShipMarker(origin,orientation,new Vector3(0,0,-100),view);
  assert.equal(ahead.x,720);assert.equal(ahead.y,450);assert.equal(ahead.onScreen,true);
  for(const z of [-100,0,100])for(const x of [-1000,1000]){
    const p=projectShipMarker(origin,orientation,new Vector3(x,0,z),view);
    assert.equal(p.onScreen,false);assert.equal(p.behind,z>=0);
    assert.ok(Math.abs(p.x-(x<0?110:1330))<1e-9);assert.equal(p.y,450);
  }
  const behind=projectShipMarker(origin,orientation,new Vector3(0,0,100),view);
  assert.equal(behind.x,1330);assert.equal(behind.behind,true);
});
test('beacon remains bounded on phone and desktop at camera-plane and polar singularities',()=>{
  for(const viewport of [view,{width:390,height:844,fov:52},{width:844,height:390,fov:52}]){
    for(const target of [new Vector3(),new Vector3(0,100,0),new Vector3(0,-100,0),new Vector3(100,300,100),new Vector3(-100,-300,-.0000001)]){
      const p=projectShipMarker(origin,orientation,target,viewport);
      assert.ok([p.x,p.y,p.angle,p.distance].every(Number.isFinite));
      assert.ok(p.x>=0&&p.x<=viewport.width);assert.ok(p.y>=0&&p.y<=viewport.height);
    }
  }
});
test('ship bearing follows suit yaw and roll and is stable at interplanetary coordinates',()=>{
  const turn=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2),target=new Vector3(-100,0,0);
  assert.ok(Math.abs(projectShipMarker(origin,turn,target,view).x-720)<1e-9);
  const roll=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2);
  assert.ok(projectShipMarker(origin,roll,new Vector3(10,0,-100),view).y>450);
  const distant=new Vector3(25e9,-25e9,25e9),offset=new Vector3(14.25,3.5,-100.75);
  const near=projectShipMarker(origin,orientation,offset,view),far=projectShipMarker(distant,orientation,distant.clone().add(offset),view);
  assert.deepEqual(far,near);
});
test('distance labels cover a nearby ramp and a distant ship without scientific notation',()=>{
  assert.equal(markerDistance(24.4),'24 m');assert.equal(markerDistance(1250),'1.3 km');assert.equal(markerDistance(25000000),'25,000 km');
});
