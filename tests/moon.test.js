import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Scene, MeshBasicMaterial } from 'three';
import { MOON_RADIUS, MOON_POSITION, MOON_DISTANCE, MOON_MAX_HEIGHT, CRATERS, moonSurface, moonAltitude, moonApproach, constrainMoonStep } from '../src/moon-world.js';
import { bodyAltitude, bodySurfacePoint, bodySurfaceNormal, SELENE } from '../src/celestial.js';
import { generateMoonPatch, MoonTerrain, MOON_GRID } from '../src/moon-terrain.js';
import { FlightAudio } from '../src/audio.js';
import { RADIUS, SUN_DISTANCE, cubeDirection } from '../src/world.js';

const center=new Vector3(...MOON_POSITION),perimeter=MOON_RADIUS+MOON_MAX_HEIGHT;
test('lunar scale, approach and relief stay clear of Aeon and the terrain bounds',()=>{
  assert.ok(Math.abs(center.length()-MOON_DISTANCE)<1e-8);
  assert.ok(MOON_DISTANCE-MOON_RADIUS>RADIUS*10);
  assert.ok(moonAltitude(moonApproach())>MOON_RADIUS*2);
  for(let i=0;i<2000;i++){
    const y=1-2*(i+.5)/2000,angle=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),d=[r*Math.cos(angle),y,r*Math.sin(angle)];
    const sample=moonSurface(...d);
    assert.deepEqual(sample,moonSurface(...d));
    assert.ok(sample.height<MOON_MAX_HEIGHT&&sample.height>-MOON_RADIUS*.1);
    assert.ok(sample.albedo>=.065&&sample.albedo<=.27);
  }
  assert.equal(CRATERS.length,96);
});

test('lunar relief is continuous at the longitude seam and poles',()=>{
  for(const y of [-1,-.999,-.5,0,.5,.999,1]){
    const x=-Math.sqrt(1-y*y),a=moonSurface(x,y,1e-10),b=moonSurface(x,y,-1e-10);
    assert.ok(Math.abs(a.height-b.height)<.001);
    assert.ok(Math.abs(a.albedo-b.albedo)<1e-5);
  }
});

test('swept lunar collision stops fast crossings with both endpoints outside',()=>{
  const previous=center.clone().add(new Vector3(0,0,perimeter*4));
  const proposed=center.clone().add(new Vector3(0,0,-perimeter*4));
  const start=previous.clone(),end=proposed.clone(),hit=constrainMoonStep(previous,proposed);
  assert.equal(hit.hit,true);assert.ok(hit.point.z>center.z);
  assert.ok(Math.abs(bodyAltitude(hit.point,SELENE)-3.2)<1e-7);
  assert.ok(previous.equals(start)&&proposed.equals(end));
});

test('terrain bounds allows tangential and outward travel and resolves invalid starts',()=>{
  const point=center.clone().add(new Vector3(0,0,perimeter+1));
  assert.equal(constrainMoonStep(point,point.clone()).hit,false);
  assert.equal(constrainMoonStep(point,point.clone().add(new Vector3(0,0,100))).hit,false);
  assert.equal(constrainMoonStep(point,point.clone().add(new Vector3(100,0,0))).hit,false);
  const hit=constrainMoonStep(center,center.clone().add(new Vector3(1,0,0)));
  assert.ok(Number.isFinite(hit.point.length()));
  assert.ok(Math.abs(bodyAltitude(hit.point,SELENE)-3.2)<1e-7);
  const far=new Vector3(0,0,SUN_DISTANCE);
  assert.equal(constrainMoonStep(far,far.clone().add(new Vector3(0,1,0))).hit,false);
});

test('crater centres are depressed relative to the raised rims',()=>{
  const crater=CRATERS[0],normal=new Vector3(...crater.direction),tangent=new Vector3().crossVectors(normal,new Vector3(0,1,0)).normalize();
  const rim=normal.clone().multiplyScalar(Math.cos(crater.radius)).addScaledVector(tangent,Math.sin(crater.radius));
  assert.ok(moonSurface(...rim.toArray()).height>moonSurface(...normal.toArray()).height+crater.depth*.5);
});


test('fine lunar geometry agrees with collision terrain after astronomical origin rebasing',()=>{
  for(const face of [0,2,4]){
    const level=17,ix=65431,iy=65679,patch=generateMoonPatch({face,level,ix,iy});
    const origin=bodySurfacePoint(new Vector3(...cubeDirection(face,-1+(ix+.5)*2/2**level,-1+(iy+.5)*2/2**level)),SELENE,1.75);
    for(let y=0;y<=MOON_GRID;y+=4)for(let x=0;x<=MOON_GRID;x+=4){
      const i=(y*(MOON_GRID+1)+x)*3;
      const local=new Vector3(...patch.positions.slice(i,i+3));
      const reconstructed=new Vector3(...patch.center).add(center).sub(origin).add(local).add(origin);
      assert.ok(Math.abs(bodyAltitude(reconstructed,SELENE))<.00001,'rendered terrain matches the walking floor');
    }
  }
});

test('lunar surface normals follow terrain slopes and neighbouring patches share their edge',()=>{
  const a=generateMoonPatch({face:4,level:15,ix:13000,iy:18000}),b=generateMoonPatch({face:4,level:15,ix:13001,iy:18000});
  for(let y=0;y<=MOON_GRID;y++){
    const point=(patch,x)=>new Vector3(...patch.positions.slice((y*(MOON_GRID+1)+x)*3,(y*(MOON_GRID+1)+x)*3+3)).add(new Vector3(...patch.center));
    assert.ok(point(a,MOON_GRID).distanceTo(point(b,0))<.00001);
  }
  const point=bodySurfacePoint(new Vector3(.45,.22,.87),SELENE),normal=bodySurfaceNormal(point,SELENE);
  assert.ok(Math.abs(normal.length()-1)<1e-10);
  assert.ok(normal.dot(point.clone().sub(center).normalize())>.8);
});


test('lunar streaming retains complete coverage during descent and releases its geometry',()=>{
  const scene=new Scene(),material=new MeshBasicMaterial(),terrain=new MoonTerrain(scene,material);
  const position=bodySurfacePoint(new Vector3(.45,.22,.87),SELENE,1.75);
  for(let frame=0;frame<12;frame++){
    terrain.update(position,position);
    assert.ok(scene.children.some(mesh=>mesh.visible),'descent always has rendered terrain');
    for(const node of terrain.nodes.values())if(node.children?.some(child=>child.mesh?.visible))
      assert.ok(node.children.every(child=>child.mesh),'a partial child set never replaces its parent');
  }
  let disposed=0;for(const mesh of scene.children)mesh.geometry.addEventListener('dispose',()=>disposed++);
  const count=scene.children.length;terrain.dispose();material.dispose();
  assert.equal(disposed,count);assert.equal(scene.children.length,0);
});


test('airless exploration silences wind while retaining cockpit engine sound',()=>{
  const audio=new FlightAudio(),parameter=()=>({value:NaN,setTargetAtTime(value){this.value=value;}});
  assert.equal(audio.context,null,'sound remains opt-in');
  audio.context={currentTime:0};audio.enabled=true;
  for(const key of ['hum','overtoneGain','wind'])audio[key]={gain:parameter()};
  for(const key of ['engine','overtone','windFilter'])audio[key]={frequency:parameter()};
  audio.update({mode:'flight',speed:100,altitude:10,airless:true});
  assert.equal(audio.wind.gain.value,0);assert.ok(audio.hum.gain.value>0);
  audio.update({mode:'walk',airless:true});assert.equal(audio.wind.gain.value,0);assert.equal(audio.hum.gain.value,0);
  audio.update({mode:'walk',airless:false});assert.ok(audio.wind.gain.value>0,'Aeon ambience returns');
});
