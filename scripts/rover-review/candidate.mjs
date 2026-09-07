import fs from 'node:fs';
import {readAsset,ray,T} from './asset.mjs';
import {tri,tree,query,fromMesh} from './triangles.mjs';
import {ASSET,LAYOUT,EXPECTED_SHA} from './config.mjs';
const a=readAsset('rover',ASSET);
const L=JSON.parse(fs.readFileSync(LAYOUT));
if(a.sha256!==EXPECTED_SHA)throw Error('Frozen candidate identity changed');
const rest=structuredClone(a.j.nodes),index=name=>a.j.nodes.findIndex(n=>n.name===name),identity=new T.Matrix4();
export function pose({door=0,steps=0,steer=0,spin=0,suspension=0,yaw=0,pitch=0}={}){
 a.j.nodes.forEach((n,i)=>{for(const k of ['translation','rotation','scale','matrix']){if(rest[i][k])n[k]=rest[i][k].slice();else delete n[k];}});
 const rot=(name,x,y,z,order='XYZ')=>{a.j.nodes[index(name)].rotation=new T.Quaternion().setFromEuler(new T.Euler(x,y,z,order)).toArray();};
 rot('CabinDoor',0,door,0);rot('BoardingSteps',0,0,steps);
 for(const w of L.wheels){const n=a.j.nodes[index('Suspension_'+w.id)];n.translation[1]+=typeof suspension==='number'?suspension:suspension[w.id]??0;if(w.steer)rot(w.steer,0,steer,0);rot(w.node,spin,0,0);}
 for(const link of L.links){const w=L.wheels.find(w=>w.id===link.wheel),angle=w.front?steer:0,off=new T.Vector3(...link.wheelOffset).applyAxisAngle(new T.Vector3(0,1,0),angle),end=new T.Vector3(...w.position).add(off);end.y+=typeof suspension==='number'?suspension:suspension[w.id]??0;const delta=end.sub(new T.Vector3(...link.anchor)),n=a.j.nodes[index(link.node)];n.rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()).toArray();n.scale=[1,delta.length()/n.extras.restLength,1];}
 for(const c of L.cutters)rot(c.pivot,pitch,yaw,0,'YXZ');
 return a.frame();
}
function meshes(frame,root){const i=index(root);return frame.meshes.filter(m=>a.under(m.node,i));}
const plain=b=>({min:b.min.toArray(),max:b.max.toArray()});
function hits(frame,root,filter=()=>true){
 const moving=meshes(frame,root),other=frame.meshes.filter(m=>!a.under(m.node,index(root))&&filter(m));
 const ts=other.flatMap(m=>fromMesh(m,identity)),bvh=tree(ts);let pairs=0;const examples=[],byName={},bounds=new T.Box3();
 for(const m of moving)for(const t of fromMesh(m,identity)){const qs=[];query(bvh,t,qs);pairs+=qs.length;for(const q of qs){byName[q.name]=(byName[q.name]||0)+1;bounds.union(t.box.clone().intersect(q.box));if(examples.length<8)examples.push({moving:m.name,static:q.name,movingTriangle:t.index,staticTriangle:q.index,overlap:plain(t.box.clone().intersect(q.box))});}}
 return {pairs,byName,bounds:pairs?plain(bounds):null,examples};
}
export {a,L,index,meshes,hits,plain};
