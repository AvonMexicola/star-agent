import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { rockFormationHeight } from '../src/rock-formations.js';
import { constrainTerrainStep } from '../src/terrain-contact.js';
const radius=340000,seed=0x4d494153;
const direction=(u,v)=>new Vector3(u/radius,v/radius,1).normalize();
const height=(d,s=seed)=>rockFormationHeight(...d.toArray(),radius,s);

test('rock fields reconstruct from seed, vary between seeds and retain open ground',()=>{
 const a=[],b=[];let peak=0,open=0,boulders=0;
 for(let u=-300;u<=300;u+=5)for(let v=-300;v<=300;v+=5){
  const d=direction(u,v),h=height(d);a.push(h);b.push(height(d,719));
  assert.ok(h>=0&&h<50);peak=Math.max(peak,h);if(h===0)open++;if(h>.7&&h<5)boulders++;
 }
 assert.ok(peak>20);assert.ok(open>a.length*.5);assert.ok(boulders>100);assert.notDeepEqual(a,b);
 const replay=[];for(let u=-300;u<=300;u+=5)for(let v=-300;v<=300;v+=5)replay.push(height(direction(u,v)));
 assert.deepEqual(a,replay);
});

test('formation support is continuous across lattice cells, poles and longitude',()=>{
 for(const axis of [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,1,1]]){
  const up=new Vector3(...axis).normalize(),east=new Vector3(Math.abs(up.y)<.9?0:1,Math.abs(up.y)<.9?1:0,0).cross(up).normalize();
  for(let distance=-300;distance<=300;distance+=.8){
   const a=up.clone().addScaledVector(east,distance/radius).normalize(),b=up.clone().addScaledVector(east,(distance+.001)/radius).normalize();
   assert.ok(Math.abs(height(a)-height(b))<.02,'no cell seam or discontinuous rock edge');
  }
 }
});

test('swept contact catches a seeded outcrop even with both endpoints above the floor',()=>{
 let best={h:0};
 for(let u=-250;u<=250;u+=5)for(let v=-250;v<=250;v+=5){const d=direction(u,v),h=height(d);if(h>best.h)best={h,u,v};}
 const altitude=best.h*.45,start=direction(best.u-85,best.v).multiplyScalar(radius+altitude),end=direction(best.u+85,best.v).multiplyScalar(radius+altitude);
 const body={radius,position:[0,0,0],maxHeight:50,sample:(x,y,z)=>({height:rockFormationHeight(x,y,z,radius,seed)})};
 assert.ok(altitude>height(start.clone().normalize())+1);assert.ok(altitude>height(end.clone().normalize())+1);
 const saved=end.clone(),hit=constrainTerrainStep(start,end,body,1);
 assert.ok(hit.hit);assert.ok(hit.t>0&&hit.t<1);assert.ok(Math.abs(hit.point.length()-radius-height(hit.point.clone().normalize())-1)<1e-6);assert.ok(saved.equals(end));
});
