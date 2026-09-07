import {setPlanetSeed} from '../src/generation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Scene,Matrix4} from 'three';
import {RADIUS,findDestinations,terrainHeight} from '../src/world.js';
import {AEON,bodySurfacePoint} from '../src/celestial.js';
import {landmarkCells,landmarkColumns,landmarkDescriptor,landmarkExcludes,nearbyLandmarks,LANDMARK_BOUND} from '../src/landmark-distribution.js';
import {createLandmarkGeometry,LANDMARK_VARIANTS} from '../src/landmark-geometry.js';
import {LandmarkRocks,createLandmarkObstacles} from '../src/landmark-rocks.js';
import {RockCollision} from '../src/mining/collision.js';
import {buildForestTile,forestTilesAround,FOREST_RECORD_STRIDE} from '../src/forest-distribution.js';
import {nearbyAeonStones} from '../src/mining/aeon-stones.js';

const site=()=>bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2);
test('landmarks reconstruct seed and cell identity without moving canonical terrain',()=>{
  setPlanetSeed(7291);const origin=site(),height=terrainHeight(...origin.clone().normalize().toArray()),list=nearbyLandmarks(origin,1600);
  assert.ok(list.length>2&&list.length<18);
  for(const d of list){
    assert.deepEqual(landmarkDescriptor(d.row,d.column),d);
    assert.equal(landmarkDescriptor(d.row,d.column+landmarkColumns(d.row)).id,d.id);
    assert.ok(d.scale>=.72&&d.scale<=1.27);assert.equal(d.mineable,false);
    assert.ok(new Vector3(0,1,0).applyQuaternion(d.quaternion).dot(d.direction)>.999999);
    assert.equal(landmarkExcludes(...d.direction.toArray()),true);
  }
  try{setPlanetSeed(7292);assert.ok(nearbyLandmarks(origin,1600).every(d=>!list.some(old=>old.id===d.id)));}
  finally{setPlanetSeed(7291);}
  assert.deepEqual(nearbyLandmarks(origin,1600),list);
  assert.equal(terrainHeight(...origin.clone().normalize().toArray()),height);
  for(const direction of [[1,0,1e-12],[1,0,-1e-12],[0,1,0],[0,-1,0]]){
    const cells=landmarkCells(new Vector3(...direction),1000);
    assert.equal(new Set(cells.map(c=>`${c.row}/${c.column}`)).size,cells.length);assert.ok(cells.length<180);
  }
});

test('large geometry has bounded LODs and genuine shelter/bridge undersides',()=>{
  for(let variant=0;variant<LANDMARK_VARIANTS;variant++){
    const g=createLandmarkGeometry(variant),p=g.attributes.position.array;
    assert.ok(g.boundingBox.max.y>60&&g.boundingBox.max.y<106);
    assert.ok(g.attributes.position.count/3<11000);
    for(let i=0;i<p.length;i+=3)assert.ok(Math.hypot(p[i],p[i+1],p[i+2])*1.27<LANDMARK_BOUND);
    const distant=createLandmarkGeometry(variant,2);assert.ok(distant.attributes.position.count<g.attributes.position.count/6);
    assert.ok(distant.boundingBox.max.distanceTo(g.boundingBox.max)<4);
    assert.deepEqual(createLandmarkGeometry(variant).attributes.position.array,p);g.dispose();distant.dispose();
  }
  for(const [variant,x,y] of [[0,30,25],[2,0,25],[4,30,20]]){
    const g=createLandmarkGeometry(variant),collision=new RockCollision(g.attributes.position.array);
    const under=new Vector3(x,y,0),upward=collision.raycast(under,new Vector3(0,1,0),90);
    assert.ok(upward&&upward.distance>5&&upward.normal.y<-.3,'an actual downward-facing roof covers the open space');
    const open=collision.sweep(new Vector3(x,y,-90),new Vector3(x,y,90));assert.equal(open.hit,false,'capsule can cross below the overhang');
    const solid=collision.sweep(new Vector3(x,50,-90),new Vector3(x,50,90));assert.equal(solid.hit,true,'the same sweep hits the visible roof');
    g.dispose();
  }
});

test('forest, grass exclusion and new loose stones leave landmark footprints clear',()=>{
  const d=nearbyLandmarks(site(),1200)[0];let count=0;
  for(const tile of forestTilesAround(d.direction,d.footprint+80)){
    const {records}=buildForestTile(tile);
    for(let i=0;i<records.length;i+=FOREST_RECORD_STRIDE){
      assert.equal(landmarkExcludes(records[i],records[i+1],records[i+2],12),false);count++;
    }
  }
  assert.ok(count>0,'surrounding woodland remains populated');
  for(const s of nearbyAeonStones(bodySurfacePoint(d.direction,AEON,2)))assert.equal(landmarkExcludes(...s.direction),false);
});

test('physical overhang queries work before visual streaming and retain local precision',()=>{
  const rocks=new LandmarkRocks(new Scene()),d=nearbyLandmarks(site(),4200).find(d=>d.variant===2||d.variant===8);
  try{
    const world=p=>p.multiplyScalar(d.scale).applyQuaternion(d.quaternion).add(d.position);
    const a=world(new Vector3(0,25,-110)),b=world(new Vector3(0,25,110));
    assert.equal(rocks.descriptors.size,0);assert.equal(rocks.constrain(a,b).hit,false);
    const roof=rocks.raycast(world(new Vector3(0,25,0)),new Vector3(0,1,0).applyQuaternion(d.quaternion),100);
    assert.equal(roof.descriptor.id,d.id);assert.ok(roof.distance>12);
    const solid=rocks.constrain(world(new Vector3(0,51,-110)),world(new Vector3(0,51,110)));
    assert.equal(solid.hit,true);assert.ok(solid.point.distanceTo(world(new Vector3(0,51,-110)))<150*d.scale);
    // A moved camera must not change geometry or upload planetary coordinates.
    for(let i=0;i<50;i++)rocks.update(a);
    const entry=rocks.entry(d.variant),mesh=entry.meshes[0],matrix=new Matrix4();assert.ok(mesh.count>0);mesh.getMatrixAt(0,matrix);
    assert.ok(new Vector3().setFromMatrixPosition(matrix).length()<580);
    const old=rocks.geometry(d.variant).attributes.position.array.slice();rocks.update(a.clone().add(new Vector3(.012,.018,-.026)));
    assert.deepEqual(rocks.geometry(d.variant).attributes.position.array,old);
  }finally{rocks.dispose();}
});

test('landmark contact composes with existing building/mining obstacles and active ship bounds',()=>{
  const identity=(a,b)=>({point:b.clone(),hit:false}),base={constrainWalker:identity,constrainEVA:identity,constrainFlight:identity,grounded:true};
  let seen;const rocks={grounded:false,constrain(a,b,options){seen=options;return {point:b,hit:true,grounded:false};}};
  const nav={layout:{eyeHeight:1.65,seatEye:[0,3,0],flightBounds:{min:[-17,-2,-30],max:[17,10,34]}}};
  const obstacles=createLandmarkObstacles(base,rocks,nav),a=new Vector3(),b=new Vector3(1,0,0);
  assert.equal(obstacles.constrainFlight(a,b).hit,true);assert.ok(seen.radius>38,'freighter collision cannot use a 10m proxy');
  assert.equal(obstacles.grounded,true);obstacles.constrainWalker(a,b);assert.equal(seen.height,1.75);
});

test('restored outpost clearings suppress both landmark rendering and physical contact',()=>{
  const d=nearbyLandmarks(site(),1200)[0],rocks=new LandmarkRocks(new Scene(),{clearings:[{position:d.position.toArray(),radius:100}]});
  try{
    for(let i=0;i<20;i++)rocks.update(d.position);
    assert.equal(rocks.descriptors.has(d.id),false);
    assert.equal(rocks.candidates(d.position,d.position.clone().add(d.direction.clone().multiplyScalar(100))).some(candidate=>candidate.id===d.id),false);
  }finally{rocks.dispose();}
});
