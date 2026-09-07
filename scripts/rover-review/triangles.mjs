// Read-only actual exported triangle intersection audit. No rendering/import edits.
import {readAsset,matrixFor,ray,matrixInfo,T} from './asset.mjs';
const EPS=1e-8;
const v=a=>new T.Vector3(...a);
const plain=b=>({min:b.min.toArray(),max:b.max.toArray()});
function tri(a,b,c,meta={}){
 const edges=[b.clone().sub(a),c.clone().sub(b),a.clone().sub(c)];
 return {p:[a,b,c],edges,normal:edges[0].clone().cross(edges[1]),box:new T.Box3().setFromPoints([a,b,c]),...meta};
}
function intersect(a,b){
 if(!a.box.intersectsBox(b.box))return false;
 const axes=[a.normal,b.normal];
 for(const ea of a.edges)for(const eb of b.edges)axes.push(ea.clone().cross(eb));
 // These in-plane axes handle parallel/copanar triangles as well.
 for(const e of a.edges)axes.push(a.normal.clone().cross(e));
 for(const e of b.edges)axes.push(b.normal.clone().cross(e));
 for(const axis of axes){const length=axis.length();if(length<1e-12)continue;axis.multiplyScalar(1/length);let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const p of a.p){const q=p.dot(axis);amin=Math.min(amin,q);amax=Math.max(amax,q);}for(const p of b.p){const q=p.dot(axis);bmin=Math.min(bmin,q);bmax=Math.max(bmax,q);}if(amax<bmin-EPS||bmax<amin-EPS)return false;}
 return true;
}
function tree(ts){const box=new T.Box3();for(const t of ts)box.union(t.box);if(ts.length<=16)return {box,ts};const size=box.getSize(new T.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';ts.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const mid=Math.floor(ts.length/2);return {box,a:tree(ts.slice(0,mid)),b:tree(ts.slice(mid))};}
function query(node,t,out){if(!node.box.intersectsBox(t.box))return;if(node.ts){for(const q of node.ts)if(intersect(t,q))out.push(q);}else{query(node.a,t,out);query(node.b,t,out);}}
function fromMesh(mesh,matrix){const pts=mesh.vertices.map(p=>p.clone().applyMatrix4(matrix)),ts=[];for(let i=0;i<mesh.indices.length;i+=3){const t=tri(...mesh.indices.slice(i,i+3).map(j=>pts[j]),{name:mesh.name,index:i/3});if(t.normal.lengthSq()>1e-20)ts.push(t);}return ts;}
function rootTriangles(asset,frame,root,matrix=new T.Matrix4()){
 const inverse=frame.world[root].clone().invert(),m=matrix.clone().multiply(inverse);
 return frame.meshes.filter(mesh=>asset.under(mesh.node,root)).flatMap(mesh=>fromMesh(mesh,m));
}
function against(frame,gunTree,asset,exclude=-1,filter=()=>true){
 const hits=[];let pairs=0,shipTriangles=0;
 for(const mesh of frame.meshes){if(asset.under(mesh.node,exclude)||!filter(mesh)||!gunTree.box.intersectsBox(mesh.bounds))continue;let count=0;const witnesses=[];
  for(let k=0;k<mesh.indices.length;k+=3){const t=tri(...mesh.indices.slice(k,k+3).map(j=>mesh.vertices[j]),{name:mesh.name,index:k/3});if(t.normal.lengthSq()<1e-20)continue;const qs=[];query(gunTree,t,qs);if(qs.length){count++;pairs+=qs.length;if(witnesses.length<2)witnesses.push({shipTriangle:k/3,shipVertices:t.p.map(p=>p.toArray()),gunTriangles:qs.slice(0,2).map(q=>({name:q.name,index:q.index,vertices:q.p.map(p=>p.toArray())}))});}}
  if(count){shipTriangles+=count;hits.push({name:mesh.name,triangles:count,witnesses});}
 }
 return {trianglePairs:pairs,shipTriangles,hits};
}
export {tri,intersect,tree,query,fromMesh,rootTriangles,against};
