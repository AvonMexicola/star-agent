import * as THREE from 'three';
/** The existing Nomad two-leaf ramp and segmented hatch, driven by the peer's
 * authoritative progress. Geometry uses the same boarding.js floor dimensions. */
export function createRemoteCargoAccess(hull){
 const root=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0x80958b,metalness:.65,roughness:.55}),warning=new THREE.MeshStandardMaterial({color:0xe5b357,metalness:.3,roughness:.6});
 const box=(parent,p,size,mat=metal)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...p);m.receiveShadow=true;m.castShadow=true;parent.add(m);return m;};
 const ramp=new THREE.Group(),leaf=new THREE.Group(),slats=[];root.add(ramp);const length=Math.hypot(3.2,1);ramp.position.set(0,1,4);leaf.position.set(0,-.12,length/2);ramp.add(leaf);
 if(hull==='nomad'){
  box(ramp,[0,-.055,length/4],[1.8,.11,length/2-.012]);box(leaf,[0,.065,length/4],[1.8,.11,length/2-.012]);
  for(const side of [-1,1]){box(ramp,[side*.847,.008,length/4],[.045,.016,length/2-.06],warning);box(leaf,[side*.847,.128,length/4],[.045,.016,length/2-.06],warning);}
  for(let i=0;i<6;i++)slats.push(box(root,[0,1+(i+.5)*2.5/6,4.015],[1.8,2.5/6-.012,.1]));
 }
 return {root,hull,update(peer){root.visible=hull==='nomad';const p=Math.max(0,Math.min(1,peer.doorProgress??0)),e=p*p*(3-2*p),raise=Math.max(0,(e-.2)/.8);slats.forEach((s,i)=>{s.position.y=THREE.MathUtils.lerp(1+(i+.5)*2.5/6,3.725,raise);s.position.z=4.015-i*.105*Math.min(1,e/.2);});ramp.rotation.x=THREE.MathUtils.lerp(-Math.PI/2,Math.atan2(1,3.2),e);leaf.rotation.x=Math.PI*(1-e);},dispose(){root.traverse(o=>o.geometry?.dispose());metal.dispose();warning.dispose();root.removeFromParent();}};
}
