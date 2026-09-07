import {outputPath,isMain,HUMAN_ASSET,EXPECTED_HUMAN_SHA} from './config.mjs';
import fs from 'node:fs';
import {a,L,pose,index,plain} from './candidate.mjs';
import {T,ray} from './asset.mjs';
import {components} from './components.mjs';
import {fromMesh,tree,query} from './triangles.mjs';
const I=new T.Matrix4(),f=pose(),all=f.meshes.flatMap(m=>components(m).all.map(c=>({...c,m,centre:c.bounds.getCenter(new T.Vector3())})));
const part=p=>all.map(c=>({c,d:c.centre.distanceTo(new T.Vector3(...p))})).sort((a,b)=>a.d-b.d)[0].c;
const ts=c=>fromMesh({...c.m,indices:c.triangles.flatMap(i=>c.m.indices.slice(3*i,3*i+3))},I);
function count(a,b){const tr=tree(ts(b));let count=0;for(const t of ts(a)){const qs=[];query(tr,t,qs);count+=qs.length;}return count;}
const brackets=[-1,1].map(s=>part([s*.75,1.4105,-1.6675])),gasket=part([0,1.33,-1.66]),lamps=[-1,1].map(s=>part([s*.72,1.5,-1.69])),bvh=tree(brackets.flatMap(ts)),states=[];
for(const yaw of[-.4,0,.4])for(const pitch of[-.48,0,.18]){
 const f=pose({yaw,pitch});for(const c of L.cutters){let contacts=0;for(const m of f.meshes.filter(m=>a.under(m.node,index(c.pivot))))for(const t of fromMesh(m,I)){const qs=[];query(bvh,t,qs);contacts+=qs.length;}
 const matrix=f.world[index(c.muzzle)],origin=new T.Vector3().setFromMatrixPosition(matrix),direction=new T.Vector3(0,0,-1).transformDirection(matrix);
 states.push({id:c.id,yaw,pitch,bracketContacts:contacts,selfRay:ray(f,origin,direction,a,-1,30)});
 }
}
const output={sha:a.sha256,attachments:brackets.map((b,i)=>({side:i===0?'port':'starboard',bounds:plain(b.bounds),bracketToGasketPairs:count(b,gasket),bracketToLampPairs:count(b,lamps[i])})),cutterStates:states};
fs.writeFileSync(outputPath('lamps.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));

if(output.attachments.some(v=>!v.bracketToGasketPairs||!v.bracketToLampPairs)||states.some(v=>v.bracketContacts||v.selfRay))throw Error('Lamp/aim diagnostic failed; inspect lamps.json');
