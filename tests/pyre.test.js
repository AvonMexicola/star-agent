import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Scene,MeshStandardMaterial} from 'three';
import {PYRE_RADIUS,PYRE_POSITION,PYRE_ORBIT_RADIUS,PYRE_EPOCH,pyreFrameAt,pyreOrbitPosition,pyreSurface,pyreSurfaceBody,pyreResources,fromPyreBody,toPyreBody,pyreLandingDirection,constrainPyreStep,bakePyreMaps,VOLCANOES} from '../src/pyre-world.js';
import {generatePyrePatch,PyreTerrain} from '../src/pyre-terrain.js';
import {PYRE,bodyAt,bodyAltitude,bodySurfacePoint} from '../src/celestial.js';
import {SUN_DIRECTION,SUN_DISTANCE,cubeDirection} from '../src/world.js';
import {advanceTerrainMorph,terrainMorphValue} from '../src/terrain-lod.js';
const center=new Vector3(...PYRE_POSITION),star=new Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);

test('Pyre frame is tidal, unit length and preserves its orbital distance',()=>{
 const frame=pyreFrameAt(PYRE_EPOCH);assert.ok(Math.abs(pyreOrbitPosition(PYRE_EPOCH).distanceTo(star)-PYRE_ORBIT_RADIUS)<.00001);
 for(const axis of ['x','y','z'])assert.ok(Math.abs(Math.hypot(...frame[axis])-1)<1e-12);
 assert.ok(new Vector3(...frame.z).dot(star.clone().sub(center).normalize())>.999999);
 for(const direction of [[1,0,0],[0,1,0],[0,0,-1],pyreLandingDirection()])assert.ok(new Vector3(...fromPyreBody(...toPyreBody(...direction))).distanceTo(new Vector3(...direction))<1e-12);
});
test('canonical resource profiles remain normalized and identical at every altitude',()=>{
 const seen=new Set();
 for(let i=0;i<250;i++){
  const y=1-2*(i+.5)/250,a=i*2.39996,c=Math.sqrt(1-y*y),d=fromPyreBody(c*Math.sin(a),y,c*Math.cos(a));
  const s=pyreSurface(...d),p=pyreResources(...d);assert.deepEqual(s.resources,p);assert.ok(Math.abs(p.weights.reduce((a,b)=>a+b)-1)<1e-12);assert.ok(p.weights.every(n=>n>=0&&n<=1));seen.add(p.dominant);
  for(const altitude of [1.75,5000,900000]){
   const point=bodySurfacePoint(new Vector3(...d),PYRE,altitude);assert.equal(bodyAt(point).id,'pyre');assert.ok(Math.abs(bodyAltitude(point,PYRE)-altitude)<.00002);
   const direction=point.sub(center).normalize();const q=pyreResources(...direction.toArray());assert.equal(q.dominant,p.dominant);
  }
 }
 assert.ok(seen.has('basalt')&&seen.has('oxide'));
 const sulfur=VOLCANOES.map(v=>pyreResources(...fromPyreBody(...v.direction)).weights[2]);assert.ok(Math.max(...sulfur)>.1);
 for(const y of [-1,-.5,0,.5,1]){const z=-Math.sqrt(1-y*y),a=pyreSurfaceBody(1e-10,y,z),b=pyreSurfaceBody(-1e-10,y,z);assert.ok(Math.abs(a.height-b.height)<.01);}
});
test('flight patches and detailed maps share the true surface and local precision',()=>{
 for(const level of [3,4,8,14,17]){
  const patch=generatePyrePatch({face:4,level,ix:2**(level-1)|0,iy:2**(level-1)|0});
  assert.equal(patch.grid,level>=4&&level<=13?32:16);assert.equal(Boolean(patch.field),level>=6&&level<=13);
  for(let y=0;y<=patch.grid;y+=4)for(let x=0;x<=patch.grid;x+=4){
   const k=y*(patch.grid+1)+x,d=cubeDirection(4,-1+2/2**level*((2**(level-1)|0)+x/patch.grid),-1+2/2**level*((2**(level-1)|0)+y/patch.grid));
   const expected=new Vector3(...d).multiplyScalar(PYRE_RADIUS+pyreSurface(...d).height),actual=new Vector3(...patch.positions.slice(k*3,k*3+3)).add(new Vector3(...patch.center));
   assert.ok(actual.distanceTo(expected)<Math.max(.00002,2/2**level*PYRE_RADIUS*2**-23));
  }
 }
 const maps=bakePyreMaps(64,32);assert.equal(maps.color.length,64*32*4);assert.ok(maps.normal.some(v=>v!==128));assert.throws(()=>bakePyreMaps(2,1));
});
test('morph begins on the resident parent triangles and ends on canonical child geometry',()=>{
 const terrain=new PyreTerrain(new Scene(),new MeshStandardMaterial(),{sync:true}),parent=terrain.roots[4];
 parent.children=terrain.childrenOf(parent);const child=parent.children[0];terrain.request(child);terrain.bindParent(child,parent);
 const p=child.mesh.geometry.attributes.parentPosition,source=parent.mesh.geometry.attributes.position;
 for(let y=0;y<=child.grid;y+=2)for(let x=0;x<=child.grid;x+=2){
  const k=y*(child.grid+1)+x,j=(y/2)*(parent.grid+1)+x/2;
  const a=new Vector3(p.getX(k),p.getY(k),p.getZ(k)).add(child.center),b=new Vector3(source.getX(j),source.getY(j),source.getZ(j)).add(parent.center);
  assert.ok(a.distanceTo(b)<.06);
 }
 assert.equal(terrainMorphValue(advanceTerrainMorph(0,1,.6)),1);assert.equal(terrainMorphValue(advanceTerrainMorph(1,0,.6)),0);
 terrain.dispose();
});
test('swept Pyre contact catches high speed descent against the same floor',()=>{
 const up=new Vector3(...pyreLandingDirection()),start=bodySurfacePoint(up,PYRE,10000),end=bodySurfacePoint(up,PYRE,-1000);
 const hit=constrainPyreStep(start,end);assert.ok(hit.hit||hit.limited);
 const endHit=constrainPyreStep(bodySurfacePoint(up,PYRE,10),end);assert.equal(endHit.hit,true);assert.ok(Math.abs(bodyAltitude(endHit.point,PYRE)-3.2)<.00002);
 assert.ok(start.equals(bodySurfacePoint(up,PYRE,10000)));
});


test('lava blisters stay continuous across their seed cell boundaries',()=>{
 for(let i=0;i<250;i++){
  const y=1-2*(i+.5)/250,a=i*2.39996;
  const samples=[-1e-10,1e-10].map(e=>{const yy=y+e,c=Math.sqrt(1-yy*yy);return pyreSurfaceBody(c*Math.sin(a),yy,c*Math.cos(a)).height;});
  assert.ok(Math.abs(samples[0]-samples[1])<.01,`seed boundary ${i}`);
 }
});

test('parent morph supports both flight mesh density changes',()=>{
 const terrain=new PyreTerrain(new Scene(),new MeshStandardMaterial(),{sync:true});
 for(const level of [3,13]){
  const parent=terrain.node(4,level,0,0);terrain.request(parent);parent.children=terrain.childrenOf(parent);
  for(const child of parent.children){
   terrain.request(child);terrain.bindParent(child,parent);
   const p=child.mesh.geometry.attributes.parentPosition,source=parent.mesh.geometry.attributes.position;
   for(let y=0;y<=child.grid;y+=4)for(let x=0;x<=child.grid;x+=4){
    const px=((child.ix%2)+x/child.grid)*parent.grid/2,py=((child.iy%2)+y/child.grid)*parent.grid/2;
    const k=y*(child.grid+1)+x,j=py*(parent.grid+1)+px;
    const a=new Vector3(p.getX(k),p.getY(k),p.getZ(k)).add(child.center),b=new Vector3(source.getX(j),source.getY(j),source.getZ(j)).add(parent.center);
    assert.ok(a.distanceTo(b)<.01);
   }
  }
 }
 terrain.dispose();
});
