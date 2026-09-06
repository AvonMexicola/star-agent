import { scatterMinerals } from '../src/mineral-fragments.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Scene,MeshStandardMaterial} from 'three';
import {PYRE_POSITION,PYRE_RADIUS,PYRE_EPOCH,PYRE_ORBIT_RADIUS,pyreFrame,pyreOrbitPosition,pyreArrivalDirection} from '../src/pyre-world.js';
import {MIASMA_POSITION,MIASMA_RADIUS,MIASMA_ORBIT_RADIUS,MIASMA_MAX_HEIGHT,MIASMA_SITES,MIASMA_TERRAIN,miasmaSurface,bakeMiasmaMaps,constrainMiasmaStep} from '../src/miasma-world.js';
import {PYRE,MIASMA,bodyAt,bodySurfacePoint,bodyAltitude} from '../src/celestial.js';
import {SUN_DIRECTION,SUN_DISTANCE,cubeDirection} from '../src/world.js';
import {planTravel,TRAVEL_TARGETS,sampleTravel} from '../src/travel-model.js';
import {generatePyrePatch,PyreTerrain} from '../src/pyre-terrain.js';
import {Navigation} from '../src/navigation.js';
const star=new Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE),pyre=new Vector3(...PYRE_POSITION),moon=new Vector3(...MIASMA_POSITION);
test('Pyre occupies quadrature and the straight Aeon approach puts daylight on the left',()=>{
 const toAeon=pyre.clone().negate().normalize(),sun=star.clone().sub(pyre).normalize(),north=new Vector3(...pyreFrame().y),right=new Vector3().crossVectors(toAeon.clone().negate(),north).normalize();
 assert.ok(Math.abs(toAeon.dot(sun))<1e-12);assert.ok(right.dot(sun)<-.999999);
 assert.ok(pyreOrbitPosition(PYRE_EPOCH).distanceTo(pyre)<.001);assert.ok(Math.abs(pyre.distanceTo(star)-PYRE_ORBIT_RADIUS)<.001);
 const start=pyre.clone().normalize().multiplyScalar(5000000),route=planTravel(start,'pyre');assert.ok(route.ok,route.reason);
 assert.ok(Math.abs(route.plan.end.distanceTo(pyre)-PYRE_RADIUS-1800000)<.001);
 assert.ok(route.plan.end.clone().sub(pyre).normalize().distanceTo(new Vector3(...pyreArrivalDirection()))<1e-10);
});
test('Miasma is a separated satellite with its own navigation domain and safe drive route',()=>{
 assert.ok(Math.abs(moon.distanceTo(pyre)-MIASMA_ORBIT_RADIUS)<.001);
 for(const site of MIASMA_SITES){const p=bodySurfacePoint(new Vector3(...site.direction),MIASMA,8);assert.equal(bodyAt(p),MIASMA);assert.ok(Math.abs(bodyAltitude(p)-8)<.00001);}
 const p=bodySurfacePoint(new Vector3(...pyreArrivalDirection()),PYRE,1800000);assert.equal(bodyAt(p),PYRE);
 const route=planTravel(p,'miasma');assert.ok(route.ok,route.reason);
 for(let t=0;t<=route.plan.duration;t+=.05){const pos=sampleTravel(route.plan,t).position;assert.ok(pos.distanceTo(moon)>MIASMA_RADIUS+40000);assert.ok(pos.distanceTo(pyre)>PYRE_RADIUS+55000);}
 assert.ok(TRAVEL_TARGETS.some(t=>t.id==='miasma'));
 const blocked=planTravel(moon.clone().addScaledVector(pyre.clone().sub(moon).normalize(),-6000000),'pyre');assert.equal(blocked.ok,false);assert.match(blocked.reason,/Miasma/);
});
test('sulphur uplands and named basins retain deterministic normalized mineral fields and bounded relief',()=>{
 const regions=new Set(),materials=new Set();
 for(let i=0;i<350;i++){
  const y=1-2*(i+.5)/350,c=Math.sqrt(1-y*y),a=i*2.39996,d=[c*Math.sin(a),y,c*Math.cos(a)],s=miasmaSurface(...d);
  assert.deepEqual(s,miasmaSurface(...d));assert.ok(s.height<MIASMA_MAX_HEIGHT&&s.height>-4000);assert.ok(s.color.every(v=>v>=0&&v<=1));
  assert.ok(Math.abs(s.resources.weights.reduce((a,b)=>a+b,0)-1)<1e-12);regions.add(s.region);materials.add(s.resources.dominant);
  const nearby=d.slice();nearby[0]+=1e-10;const n=new Vector3(...nearby).normalize();assert.ok(Math.abs(s.height-miasmaSurface(...n.toArray()).height)<.01);
 }
 assert.ok(regions.size>=4);assert.ok(materials.has('sulphur')&&materials.has('copper'));
 for(const site of MIASMA_SITES){const s=miasmaSurface(...site.direction);assert.equal(s.region,site.name);assert.equal(s.resources.dominant,'copper');}
 const maps=bakeMiasmaMaps(64,32);assert.equal(maps.color.length,8192);assert.ok(maps.normal.some(v=>v!==128));
});
test('moon patches use its own canonical surface with local Float32 precision',()=>{
 for(const level of [3,9,16]){
  const data=generatePyrePatch({face:4,level,ix:0,iy:0},MIASMA_TERRAIN),center=new Vector3(...data.center);
  for(let y=0;y<=data.grid;y+=4)for(let x=0;x<=data.grid;x+=4){
   const d=cubeDirection(4,-1+2/2**level*x/data.grid,-1+2/2**level*y/data.grid),expected=new Vector3(...d).multiplyScalar(MIASMA_RADIUS+miasmaSurface(...d).height),i=(y*(data.grid+1)+x)*3;
   assert.ok(new Vector3(...data.positions.slice(i,i+3)).add(center).distanceTo(expected)<Math.max(.00002,MIASMA_RADIUS*2/2**level*2**-23));
  }
 }
 const terrain=new PyreTerrain(new Scene(),new MeshStandardMaterial(),{body:MIASMA_TERRAIN,sync:true});
 const parent=terrain.roots[4];parent.children=terrain.childrenOf(parent);const child=parent.children[0];terrain.request(child);terrain.bindParent(child,parent);
 assert.ok(child.mesh.name.startsWith('Miasma'));assert.ok(child.mesh.geometry.attributes.parentPosition.array.every(Number.isFinite));terrain.dispose();
});
test('Miasma swept collision catches terrain and does not mutate the proposed step',()=>{
 const d=new Vector3(...MIASMA_SITES[0].direction),a=bodySurfacePoint(d,MIASMA,10),b=bodySurfacePoint(d,MIASMA,-200),saved=b.clone();
 const contact=constrainMiasmaStep(a,b);assert.ok(contact.hit);assert.ok(Math.abs(bodyAltitude(contact.point,MIASMA)-3.2)<.00001);assert.ok(b.equals(saved));
 const sweep=constrainMiasmaStep(moon.clone().addScaledVector(d,1000000),moon.clone().addScaledVector(d,-1000000));assert.ok(sweep.hit||sweep.limited);
});
test('quick transit and drive arrival agree on sunlight orientation; moon uses atmospheric flight',t=>{
 const oldDoc=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={hidden:false,addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};globalThis.window={addEventListener(){}};
 t.after(()=>{globalThis.document=oldDoc;globalThis.window=oldWindow;});
 const nav=new Navigation({addEventListener(){}},()=>{});nav.transitPyre();assert.equal(nav.body,PYRE);assert.ok(nav.sunDirection.applyQuaternion(nav.orientation.clone().invert()).x<-.99);
 nav.position.copy(pyre).normalize().multiplyScalar(5000000);nav.enabled=true;nav.travelTarget='pyre';assert.equal(nav.beginTravel(),true);nav.updateTravel(nav.travel.plan.duration);assert.equal(nav.travel,null);assert.ok(nav.sunDirection.applyQuaternion(nav.orientation.clone().invert()).x<-.99);
 nav.transitMiasma(100,MIASMA_SITES[0].direction);assert.equal(nav.body,MIASMA);assert.ok(nav.flightEnvironment.density>0);assert.equal(nav.body.toxic,true);assert.ok(Math.abs(nav.altitude-100)<.00001);
});


test('mineral fragments wrap the seam and remain deterministic near both poles',()=>{
 for(const d of [[1e-9,0,-1],[0,1,0],[0,-1,0]]){
  const center=new Vector3(...d).normalize(),collect=()=>{const found=[];scatterMinerals(center,(n,col,row)=>{assert.ok(n.distanceTo(center)*MIASMA_RADIUS<=78.00001);found.push(`${col}/${row}`);});return found;};
  const a=collect();assert.ok(a.length>500&&a.length<5000);assert.equal(new Set(a).size,a.length);assert.deepEqual(a,collect());
 }
});
