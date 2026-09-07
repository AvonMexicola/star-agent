import {outputPath,isMain,HUMAN_ASSET,EXPECTED_HUMAN_SHA} from './config.mjs';
import fs from'node:fs';
import{T}from'./asset.mjs';
import{fromMesh,tree,query}from'./triangles.mjs';
import{a,L,pose,index,plain}from'./candidate.mjs';
const I=new T.Matrix4();
function contactPoints(t,q){const out=[],p=new T.Vector3(),bary=new T.Vector3();for(const [a,b]of[[t,q],[q,t]]){const normal=b.normal.clone().normalize(),triangle=new T.Triangle(...b.p);for(let i=0;i<3;i++){const x=a.p[i],y=a.p[(i+1)%3],d0=normal.dot(x.clone().sub(b.p[0])),d1=normal.dot(y.clone().sub(b.p[0]));if(Math.abs(d0)<1e-7){triangle.getBarycoord(x,bary);if(bary.x>=-1e-7&&bary.y>=-1e-7&&bary.z>=-1e-7)out.push(x.clone());}if(d0*d1>0||Math.abs(d0-d1)<1e-12)continue;const f=d0/(d0-d1);if(f<-1e-7||f>1+1e-7)continue;p.copy(x).lerp(y,f);triangle.getBarycoord(p,bary);if(bary.x>=-1e-7&&bary.y>=-1e-7&&bary.z>=-1e-7)out.push(p.clone());}}
 return out;
}
const result={sha256:a.sha256,method:'Explicit runtime link endpoint articulation and actual triangle intersection points. Hub mating allowance: matching own link only, carrier-local inboard X0.10..0.235, radial YZ<=0.215. No chassis-anchor contacts silently excluded.',wheel:[],link:[]};
for(const suspension of[-.22,0,.22])for(const steer of[-.52,0,.52]){
 const f=pose({suspension,steer,spin:.123}),all=f.meshes.flatMap(m=>fromMesh(m,I).map(t=>({...t,node:m.node}))),bvh=tree(all);
 for(const w of L.wheels){if(!w.front&&steer!==0)continue;const root=index(w.node),carrier=f.world[root].clone().multiply(new T.Matrix4().makeRotationX(-.123)).invert();let pairs=0,unexpected=0,noPoints=0,maxRadial=0;const byName={},examples=[];
  for(const t of all.filter(t=>a.under(t.node,root))){const qs=[];query(bvh,t,qs);for(const q of qs){if(a.under(q.node,root))continue;pairs++;const ps=contactPoints(t,q);if(!ps.length)noPoints++;const link=L.links.find(l=>a.under(q.node,index(l.node))&&l.wheel===w.id),local=ps.map(p=>p.clone().applyMatrix4(carrier)),sign=w.position[0]<0?1:-1;const ownClevis=a.under(q.node,index(w.steer||'Axle_'+w.id))&&!a.under(q.node,root);const allowed=(link||ownClevis)&&local.length&&local.every(v=>v.x*sign>=.10-1e-5&&v.x*sign<=.235+1e-5&&Math.hypot(v.y,v.z)<=.215+1e-5);for(const p of local)maxRadial=Math.max(maxRadial,Math.hypot(p.y,p.z));if(!allowed){unexpected++;byName[q.name]=(byName[q.name]||0)+1;if(examples.length<5)examples.push({name:q.name,points:ps.map(p=>p.toArray()),local:local.map(p=>p.toArray())});}}}
  result.wheel.push({id:w.id,suspension,steer,pairs,unexpected,noPoints,maxRadial,byName,examples});
 }
 for(const link of L.links){const root=index(link.node),hits={},maxDistance={},examples=[];
  for(const t of all.filter(t=>a.under(t.node,root))){const qs=[];query(bvh,t,qs);for(const q of qs){if(a.under(q.node,root)||L.wheels.some(w=>a.under(q.node,index(w.node))))continue;const ps=contactPoints(t,q);hits[q.name]=(hits[q.name]||0)+1;const distance=ps.length?Math.max(...ps.map(p=>p.distanceTo(new T.Vector3(...link.anchor)))):null;maxDistance[q.name]=Math.max(maxDistance[q.name]||0,distance||0);if(examples.length<3)examples.push({name:q.name,points:ps.slice(0,3).map(p=>p.toArray()),anchorDistance:distance});}}
  if(Object.keys(hits).length)result.link.push({node:link.node,suspension,steer,hits,maxDistance,examples});
 }
}
fs.writeFileSync(outputPath('joints.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({wheelStates:result.wheel.length,unexpected:result.wheel.filter(v=>v.unexpected),anchorAndLinkContacts:result.link.slice(0,8)},null,2));

if(result.wheel.some(v=>v.unexpected))throw Error('Unexpected sampled wheel contact; inspect joints.json. Link contacts require region review.');
