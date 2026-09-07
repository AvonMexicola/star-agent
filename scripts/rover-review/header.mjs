import {outputPath,isMain,HUMAN_ASSET,EXPECTED_HUMAN_SHA} from './config.mjs';
import fs from 'node:fs';
import {a,pose,index,plain} from './candidate.mjs';
import {components} from './components.mjs';
import {T,ray} from './asset.mjs';
import {fromMesh,tree,query} from './triangles.mjs';
const rest=pose(),cs=new Map(rest.meshes.map(m=>[m.node,components(m)])),contacts=[];
for(const angle of[0,.1375,.55]){
 const f=pose({door:angle}),ts=f.meshes.flatMap(m=>fromMesh(m,new T.Matrix4()).map(t=>({...t,node:m.node}))),bvh=tree(ts.filter(t=>!a.under(t.node,index('CabinDoor')))),pairs=new Map();
 for(const t of ts.filter(t=>a.under(t.node,index('CabinDoor')))){const qs=[];query(bvh,t,qs);for(const q of qs){const mc=cs.get(t.node).triTo[t.index],sc=cs.get(q.node).triTo[q.index],key=t.node+':'+mc.triangles[0]+':'+q.node+':'+sc.triangles[0];if(!pairs.has(key))pairs.set(key,{moving:{name:t.name,bounds:plain(mc.bounds)},static:{name:q.name,bounds:plain(sc.bounds)},pairs:0});pairs.get(key).pairs++;}}
 contacts.push({angle,contacts:[...pairs.values()]});
}
const rays=[],ys=[.55,.75,1,1.25,1.34,1.36,1.5,1.8,2.1,2.3,2.34,2.35,2.355,2.359],zs=[-1.5,-1.2,-.9,-.71,-.69,-.68,-.67,-.665,-.66,-.65,-.64,-.63,-.6,-.4,0,.3,.4,.42,.45,.46,.465,.47,.48,.5,.55,.6,.63,.64,.645,.65,.66,.67];
for(const y of ys)for(const z of zs){
 // Ray origins remain inside the wide cell and behind the sloping forward
 // pressure boundary. Start beside the seat so it cannot mask a shell hole.
 if(y<1.36&&z<-.63)continue;
 if(y>=1.36&&z< -1.60+.45*(y-1.36)/1.045+.025)continue;
 for(const side of[-1,1]){const start=new T.Vector3(side*.76,y,z),hit=ray(rest,start,new T.Vector3(side,0,0),a,-1,.22);rays.push({start:start.toArray(),side,hit});}
}
const output={sha:a.sha256,contacts,rays,samples:rays.length,escapes:rays.filter(r=>!r.hit),scope:'Closed-cabin lateral ray grid, including low side skins, window dividers, rear strips and headers. Rays start at X±.76 beside the seat, use known interior plan regions, and seek shell within22cm outward. This is a discrete gap diagnostic, not a continuous watertight mesh or pressure simulation proof.'};
fs.writeFileSync(outputPath('header.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({sha:a.sha256,samples:output.samples,escapeCount:output.escapes.length,escapes:output.escapes.map(r=>({side:r.side,y:r.start[1],z:r.start[2]}))},null,2));

if(output.samples!==762||output.escapes.length)throw Error('Finite side-shell diagnostic failed; inspect header.json');
