import fs from 'node:fs';
import {a,L,pose,hits} from './candidate.mjs';
import {ray,T} from './asset.mjs';
import {outputPath} from './config.mjs';

 const result={sha256:a.sha256,bytes:a.bytes,restTriangles:a.frame().triangles,method:'Actual exported double-precision triangles, joint TRS evaluated explicitly, separating-axis triangle surface tests including coplanar contacts. Discrete samples, not a continuous swept-volume certificate. Contacts are reported, not automatically treated as defects.',wheel:[],door:[],steps:[],cutters:[]};
 for(const compression of [-.22,0,.22])for(const steer of [-.52,0,.52])for(const spin of [0,Math.PI/10]){
  const f=pose({steer,spin,suspension:compression});
  for(const w of L.wheels){if(!w.front&&steer!==0)continue;const h=hits(f,w.node,m=>!m.name.startsWith('Wheel_'));result.wheel.push({id:w.id,compression,steer,spin,...h});}
 }
 for(let k=0;k<=12;k++){const door=1.65*k/12,f=pose({door});result.door.push({door,...hits(f,'CabinDoor')});}
 {const f=pose({door:1.65});result.steps.push({steps:0,...hits(f,'BoardingSteps')});}
 for(const yaw of [-.4,0,.4])for(const pitch of [-.48,0,.18]){const f=pose({yaw,pitch,suspension:.22,steer:.52});for(const c of L.cutters){const i=index(c.muzzle),m=f.world[i],start=new T.Vector3().setFromMatrixPosition(m),direction=new T.Vector3(0,0,-1).transformDirection(m);result.cutters.push({id:c.id,yaw,pitch,...hits(f,c.pivot),muzzle:start.toArray(),selfRay:ray(f,start,direction,a,-1,30)});}}
 fs.writeFileSync(outputPath('mechanisms.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({sha:result.sha256,wheel:result.wheel.filter(v=>v.pairs).map(({id,compression,steer,spin,pairs,bounds,byName})=>({id,compression,steer,spin,pairs,bounds,byName})),door:result.door.filter(v=>v.pairs).map(({door,pairs,bounds,byName})=>({door,pairs,bounds,byName})),steps:result.steps.filter(v=>v.pairs).map(({steps,pairs,bounds,byName})=>({steps,pairs,bounds,byName})),cutters:result.cutters.filter(v=>v.pairs||v.selfRay).map(({id,yaw,pitch,pairs,bounds,byName,selfRay})=>({id,yaw,pitch,pairs,bounds,byName,selfRay}))},null,2));
