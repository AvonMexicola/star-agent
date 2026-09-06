import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {moonResources,moonSurface,RESOURCE_PROVINCES,MOON_RADIUS,MOON_LANDING_DIRECTION,LANDING_FRAME} from '../src/moon-world.js';
import {cubeDirection} from '../src/world.js';
import {generateMoonPatch,MOON_GRID} from '../src/moon-terrain.js';
const local=(u,v)=>new Vector3(...MOON_LANDING_DIRECTION).addScaledVector(new Vector3(...LANDING_FRAME.east),u/MOON_RADIUS).addScaledVector(new Vector3(...LANDING_FRAME.north),v/MOON_RADIUS).normalize().toArray();

test('named orbital resource provinces have wide cores with matching collectible fractions and colors',()=>{
  for(const province of RESOURCE_PROVINCES){
    const center=new Vector3(...province.direction),tangent=new Vector3().crossVectors(center,new Vector3(0,1,0)).normalize();
    for(const meters of [-35000,0,35000]){
      const direction=center.clone().addScaledVector(tangent,meters/MOON_RADIUS).normalize().toArray();
      const resource=moonResources(...direction),surface=moonSurface(...direction);
      assert.equal(resource.dominant,province.resource);assert.equal(resource.province,province.name);
      assert.deepEqual(surface.resources,resource);assert.equal(surface.resource,resource.dominant);
      assert.ok(resource.weights[province.resource==='ice'?2:1]>.85);
      assert.ok(Math.abs(resource.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
      if(province.resource==='ice')assert.ok(surface.color[2]>surface.color[0]*1.5,'ice reads blue-white');
      else assert.ok(surface.color[0]>surface.color[2]*3,'copper reads rust-red');
    }
  }
});

test('even the orbital root mesh samples each large resource field across multiple vertices',()=>{
  const counts=Object.fromEntries(RESOURCE_PROVINCES.map(p=>[p.id,0]));
  for(let face=0;face<6;face++)for(let y=0;y<=MOON_GRID;y++)for(let x=0;x<=MOON_GRID;x++){
    const d=cubeDirection(face,-1+x*2/MOON_GRID,-1+y*2/MOON_GRID),r=moonResources(...d);
    for(const p of RESOURCE_PROVINCES)if(r.province===p.name&&r.dominant===p.resource)counts[p.id]++;
  }
  for(const [id,count] of Object.entries(counts))assert.ok(count>=4,`${id} has ${count} orbital samples`);
});

test('local geological landmarks use the same dominant-resource rule as the orbital material',()=>{
  for(const [u,v,dominant] of [[-220,0,'ice'],[5400,11500,'ice'],[2600,-3400,'copper'],[-7600,-5300,'basalt']]){
    const d=local(u,v);assert.equal(moonResources(...d).dominant,dominant);assert.equal(moonSurface(...d).resource,dominant);
  }
  const basalt=moonSurface(...local(-7600,-5300));assert.ok(Math.max(...basalt.color)<.12,'basalt remains dark slate');
  for(const y of [-1,-.999,-.5,0,.5,.999,1]){
    const x=-Math.sqrt(1-y*y),a=moonResources(x,y,1e-10),b=moonResources(x,y,-1e-10);
    a.weights.forEach((n,i)=>assert.ok(Math.abs(n-b.weights[i])<1e-7));
  }
});

test('resource-color additions leave canonical relief and the landing shelf unchanged',()=>{
  const fixtures=[[[1,0,0],-1394.7719236376001],[[0,1,0],1237.7681080309915],[[0,0,1],939.5199512000491],[[-1,0,0],-1028.3357188712673],[[0,-1,0],-1995.1689189401268],[[0,0,-1],2995.1987666297655],
    [local(0,0),-716.7986014786122],[local(20,0),-716.7986014786122],[local(-220,0),-1527.6682165549526],[local(2600,-3400),-1915.311644741505],[local(5400,11500),2951.374534354154],[local(-7600,-5300),5814.414570477]];
  for(const [d,height] of fixtures)assert.equal(moonSurface(...d).height,height);
  const patch=generateMoonPatch({face:4,level:2,ix:2,iy:2});
  for(let y=0;y<=MOON_GRID;y+=4)for(let x=0;x<=MOON_GRID;x+=4){
    const index=(y*(MOON_GRID+1)+x)*3,d=cubeDirection(4,x*.5/MOON_GRID,y*.5/MOON_GRID),surface=moonSurface(...d);
    surface.color.forEach((value,i)=>assert.ok(Math.abs(patch.colors[index+i]-value)<1e-7));
  }
});
