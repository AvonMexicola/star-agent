import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DoubleSide, Group, Raycaster, Scene, Vector3} from 'three';
import {readGLBGeometry} from '../tests/helpers/gltf-geometry.js';
import {createMediumShipLights} from '../src/medium-ship-lights.js';

const root = process.env.SHIP_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const output = process.env.LIGHT_REVIEW_OUT ?? '/tmp/star-agent-medium-light-check.json';
const ids = (process.env.LIGHT_REVIEW_SHIPS ?? 'gannet,stratum').split(',');
const v = p => new Vector3(...p);
const fixtures = {
  gannet: {
    count:6,
    points:[[-1.60,3.77,-7],[1.60,3.77,-4.3],[-1.60,3.77,-1],[1.60,3.77,1.7],[-1.88,4.561,7.44],[1.88,4.561,7.44]],
    targets:{pilot:[0,2.95,-8.4],standing:[0,3.15,-6.8],forwardAisle:[0,3.15,-5],berths:[0,3.15,-3.3],midAisle:[0,3.15,-1],aftAisle:[0,3.15,1],vestibule:[0,3.15,3.7],liftCall:[2.5,3.15,4.85],roverPortDoor:[2.1,3.15,7.625],aftBay:[-2,3.15,9.5],loweredLiftAccess:[2.1,1.75,7.625]},
  },
  stratum: {
    count:3,
    points:[[-1.72,3.70,-4.25],[1.72,3.70,.5],[-1.72,3.70,5.25]],
    targets:{pilot:[0,2.9,-5.8],standing:[0,3.1,-4.2],berth:[.8,2.7,-1.8],midAisle:[0,3.1,0],aftAisle:[0,3.1,2.5],oreAccess:[0,2.8,3.775],rearAisle:[0,3.1,5.5],innerPortal:[0,3.1,6.85]},
  },
};
const receipt = {scope:'Finite actual-GLB emitter attachment and direct cabin/bay light-path checks; no rendered brightness, shadows, rover occlusion, performance or visual acceptance claim.',ships:[]};
const visibleLights = tree => {const a=[];tree.traverseVisible(o=>{if(o.isPointLight)a.push(o);});return a;};
function geometrySnapshot(tree) {
  const result=[];
  tree.traverse(o=>result.push({object:o,parent:o.parent,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),geometry:o.geometry,material:o.material}));
  return result;
}
function unchanged(snapshot) {
  for(const s of snapshot){
    assert.equal(s.object.parent,s.parent);assert.deepEqual(s.object.position.toArray(),s.position);
    assert.deepEqual(s.object.quaternion.toArray(),s.quaternion);assert.deepEqual(s.object.scale.toArray(),s.scale);
    assert.equal(s.object.geometry,s.geometry);assert.equal(s.object.material,s.material);
  }
}
for (const id of ids) {
  const path = resolve(process.env[`${id.toUpperCase()}_GLB`] ?? `${root}/public/models/${id}.glb`);
  const bytes = await readFile(path), sha256=createHash('sha256').update(bytes).digest('hex');
  const {scene:model}=await readGLBGeometry(path), ship=new Group(), scene=new Scene();
  ship.name=id;ship.add(model);scene.add(ship);scene.updateMatrixWorld(true);
  // Double-sided CPU intersections catch opaque backs as well as rendered fronts.
  // This private inspection copy never changes production material/asset bytes.
  const opaque=[];
  model.traverse(o=>{if(o.isMesh){const materials=[o.material].flat();for(const m of materials)m.side=DoubleSide;if(materials.some(m=>!m.transparent))opaque.push(o);}});
  const before=geometrySnapshot(model), contract=fixtures[id], lamps=createMediumShipLights(ship,id);
  assert.equal(visibleLights(scene).length,0,'new lamps start dark before a powered ship state');
  lamps.update({shipId:id,powered:true,mode:'walk'});scene.updateMatrixWorld(true);
  const lights=visibleLights(scene);assert.equal(lights.length,contract.count);
  const details=[];
  for(let i=0;i<lights.length;i++){
    const light=lights[i], p=ship.worldToLocal(light.getWorldPosition(new Vector3()));
    assert.ok(p.distanceTo(v(contract.points[i]))<.00008,`${id} unexpected authored position ${p.toArray()}`);
    assert.equal(light.parent.isMesh,true);assert.equal(light.castShadow,false);assert.equal(light.decay,2);
    assert.ok(light.distance>0&&light.distance<=5.5);
    const upward=new Raycaster(p,v([0,1,0]),.0005,1.2).intersectObjects(opaque,false);
    assert.ok(upward.length,`${id} ${light.name} has no physical ceiling/fixture above`);
    assert.equal(upward[0].object,light.parent,`${id} ${light.name} is hidden behind ${upward[0].object.name}`);
    assert.ok(upward[0].distance>=.015&&upward[0].distance<=.06,`${id} ${light.name} is not immediately below its luminous face: ${upward[0].distance}`);
    const downward=new Raycaster(p,v([0,-1,0]),.0005,p.y-3.15).intersectObjects(opaque,false);
    assert.equal(downward.length,0,`${id} ${light.name} has an opaque ceiling/wall beneath it`);
    details.push({name:light.name,position:p.toArray(),source:light.parent.name,diffuserPoint:upward[0].point.toArray(),gap:upward[0].distance,clearDownToY:3.15,range:light.distance,intensity:light.intensity});
  }
  const targets=[];
  for(const [name,target] of Object.entries(contract.targets)){
    const point=v(target),paths=[];
    for(const light of lights){
      const p=ship.worldToLocal(light.getWorldPosition(new Vector3())),delta=point.clone().sub(p),distance=delta.length();
      if(distance>=light.distance)continue;
      const blockers=new Raycaster(p,delta.normalize(),.0005,distance-.0005).intersectObjects(opaque,false);
      paths.push({lamp:light.name,distance,clear:blockers.length===0,firstBlocker:blockers[0]?.object.name??null,firstPoint:blockers[0]?.point.toArray()??null});
    }
    assert.ok(paths.some(p=>p.clear),`${id} ${name} receives no clear in-range path: ${JSON.stringify(paths)}`);
    targets.push({name,position:target,paths});
  }
  unchanged(before);
  // Source and cached-hull visibility uses the exact traverseVisible semantics
  // used by Three's light collection, without requiring a WebGL context.
  const source=lights[0].parent;
  source.visible=false;assert.equal(visibleLights(scene).length,0);source.visible=true;
  ship.visible=false;assert.equal(visibleLights(scene).length,0);ship.visible=true;
  const sourceMaterials=[source.material].flat();
  sourceMaterials.forEach(m=>{m.visible=false;});lamps.update({shipId:id,powered:true,mode:'walk'});
  assert.equal(visibleLights(scene).length,0,'hidden emitter material cannot leave its lamps on');
  sourceMaterials.forEach(m=>{m.visible=true;});
  for(const state of [{shipId:id,powered:false,mode:'walk'},{shipId:'another-hull',powered:true,mode:'walk'},{shipId:id,powered:true,mode:'crashed'},{shipId:id,powered:true,mode:'destroyed'}]){
    lamps.update(state);assert.equal(visibleLights(scene).length,0);
  }
  lamps.update({shipId:id,powered:true,mode:'flight'});assert.equal(visibleLights(scene).length,contract.count);
  // A nontrivial hull translation and orientation cannot detach local lamps.
  ship.position.set(57,-18,30);ship.rotation.set(.3,-.7,.5);scene.updateMatrixWorld(true);
  for(let i=0;i<lights.length;i++)assert.ok(ship.worldToLocal(lights[i].getWorldPosition(new Vector3())).distanceTo(v(contract.points[i]))<.00008);
  unchanged(before);
  lamps.dispose();lamps.dispose();lamps.update({shipId:id,powered:true,mode:'flight'});
  assert.equal(visibleLights(scene).length,0);assert.ok(lights.every(l=>l.parent===null&&!l.visible));unchanged(before);
  const sourceName=id==='gannet'?'Cabin__Gannet_restrained_mint_emitters':'Stratum_Static__powered_indicator';
  model.getObjectByName(sourceName).name='missing-fixture';
  assert.throws(()=>createMediumShipLights(ship,id),/diffuser mesh is missing/);assert.equal(visibleLights(scene).length,0);
  receipt.ships.push({id,path,sha256,bytes:bytes.length,lamps:details,targets,checks:{emitterFirstHit:true,finiteRoomPaths:true,sourceVisibility:true,inactiveHullVisibility:true,powerAndSelectionGates:true,localTransform:true,originalGeometryMaterialRigIdentity:true,idempotentDisposal:true,missingSourceFailsClosed:true}});
}
await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({pass:true,ships:receipt.ships.map(s=>({id:s.id,sha256:s.sha256,lamps:s.lamps.length,targets:s.targets.length})),output},null,2));
