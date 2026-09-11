import test from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import * as T from 'three';
import {readGLBGeometry} from './helpers/gltf-geometry.js';
import {ROVER_LAYOUT as L} from '../src/rover-layout.js';
import {createRoverDisplayFaces} from '../src/rover-display.js';

const url=new URL('../public/models/mining-rover.glb',import.meta.url);
const {scene}=await readGLBGeometry(url);
scene.updateMatrixWorld(true);
const eye=new T.Vector3(...L.cabin.pilotEye);

test('the built Burrow keeps its carrying envelope, authored muzzle origins and asset budget',async()=>{
  const bounds=new T.Box3().setFromObject(scene,true);
  for(const [i,axis] of ['x','y','z'].entries()){
    assert.ok(bounds.min[axis]>=L.bounds.min[i]-.002,`${axis} min ${bounds.min[axis]}`);
    assert.ok(bounds.max[axis]<=L.bounds.max[i]+.002,`${axis} max ${bounds.max[axis]}`);
  }
  let triangles=0;scene.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(triangles<=30000,`${triangles} triangles`);
  assert.ok((await stat(url)).size<=4_000_000);
  assert.equal(scene.getObjectByName('SteeringYoke'),undefined);
  for(const cutter of L.cutters){
    const muzzle=scene.getObjectByName(cutter.muzzle);
    assert.ok(muzzle);
    const expected=new T.Vector3(...cutter.position).add(new T.Vector3(...cutter.tip));
    assert.ok(muzzle.getWorldPosition(new T.Vector3()).distanceTo(expected)<.001);
  }
});

test('twenty central pilot rays pass through continuous pressure glazing without an opaque strut',()=>{
  for(let i=0;i<20;i++){
    const y=1.50+i*.04,z=-1.66+(y-1.36)*.49/.965,target=new T.Vector3(0,y,z);
    const ray=new T.Raycaster(eye,target.clone().sub(eye).normalize(),0,eye.distanceTo(target)+.065);
    const hits=ray.intersectObject(scene,true);
    assert.ok(hits.some(h=>h.object.material.name.startsWith('Pressure glazing')),`pane at ${y}`);
    assert.equal(hits.filter(h=>!h.object.material.transparent).length,0,`opaque obstruction at ${y}`);
  }
});

test('every fitted screen centre and corner is visible from the actual pilot eye',()=>{
  const material=new T.MeshBasicMaterial(),faces=createRoverDisplayFaces(scene,material);
  scene.updateMatrixWorld(true);
  try{
    assert.equal(faces.length,5);
    for(const face of faces){
      const {width,height}=face.geometry.parameters;
      for(const [x,y] of [[0,0],[-.46,-.46],[.46,-.46],[-.46,.46],[.46,.46]]){
        const target=new T.Vector3(x*width,y*height,0).applyMatrix4(face.matrixWorld);
        const ray=new T.Raycaster(eye,target.clone().sub(eye).normalize(),0,eye.distanceTo(target)+.001);
        const hit=ray.intersectObject(scene,true).find(h=>!h.object.material.transparent);
        assert.ok(hit?.object===face,`${face.name} at ${x},${y} blocked by ${hit?.object?.name}`);
      }
    }
  }finally{for(const face of faces){face.removeFromParent();face.geometry.dispose();}material.dispose();}
});

test('the complete physical entry keeps a 12 cm eye sphere clear of the fitted cabin',()=>{
  const door=scene.getObjectByName('CabinDoor');door.rotation.y=1.65;scene.updateMatrixWorld(true);
  const triangles=[],p=new T.Vector3(),q=new T.Vector3();
  scene.traverse(o=>{
    if(!o.isMesh)return;
    const g=o.geometry,index=g.index,count=index?.count??g.attributes.position.count;
    for(let i=0;i<count;i+=3){
      const points=[0,1,2].map(k=>p.fromBufferAttribute(g.attributes.position,index?index.getX(i+k):i+k).clone().applyMatrix4(o.matrixWorld));
      const triangle=new T.Triangle(...points);triangles.push({triangle,bounds:new T.Box3().setFromPoints(points)});
    }
  });
  try{
    const route=[L.cabin.entryGround,...L.cabin.entryRoute].map(p=>new T.Vector3(...p));
    for(let segment=0;segment<route.length-1;segment++)for(let i=0;i<=24;i++){
      p.copy(route[segment]).lerp(route[segment+1],i/24);
      for(const {triangle,bounds} of triangles){
        if(bounds.distanceToPoint(p)>=.12)continue;
        triangle.closestPointToPoint(p,q);
        assert.ok(p.distanceTo(q)>=.12,`entry ${segment}/${i}: ${p.toArray()} clips at ${q.toArray()}`);
      }
    }
  }finally{door.rotation.y=0;scene.updateMatrixWorld(true);}
});
