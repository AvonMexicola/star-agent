import * as THREE from 'three';
import { terminalAsset } from '../cargo/visuals.js';
import { PAD_HALF,PAD_HEIGHT } from './sites.js';
import { constrainShipAttachments } from '../ship-attachment-collision.js';
/** Pad and terminal share their exact render/collision dimensions. */
export function createTradingPads(scene,getTerminals){
  const models=new Map(),material=new THREE.MeshStandardMaterial({color:0x53605b,metalness:.5,roughness:.7}),mark=new THREE.MeshStandardMaterial({color:0xb6efd1,roughness:.8});
  const local=(p,t)=>p.clone().sub(new THREE.Vector3(...t.origin)).applyQuaternion(new THREE.Quaternion(...t.quaternion).invert());
  const world=(p,t)=>p.applyQuaternion(new THREE.Quaternion(...t.quaternion)).add(new THREE.Vector3(...t.origin));
  return {
    update(origin){
      for(const t of getTerminals()){
        if(!t.origin)continue;let g=models.get(t.id);
        if(!g){g=new THREE.Group();g.name=`Trading pad ${t.id}`;scene.add(g);models.set(t.id,g);
          const deck=new THREE.Mesh(new THREE.BoxGeometry(36,PAD_HEIGHT,36),material);deck.position.y=PAD_HEIGHT/2;deck.receiveShadow=true;g.add(deck);
          for(const x of [-16,16]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(.15,.008,32),mark);stripe.position.set(x,PAD_HEIGHT+.004,0);g.add(stripe);}
          for(const z of [-16,16]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(32,.008,.15),mark);stripe.position.set(0,PAD_HEIGHT+.004,z);g.add(stripe);}
          for(const axis of ['x','z'])for(const sign of [-1,1]){const ramp=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?3.147:36,.06,axis==='z'?3.147:36),material);ramp.position.set(axis==='x'?sign*19.5:0,-.225,axis==='z'?sign*19.5:0);if(axis==='x')ramp.rotation.z=-sign*Math.atan2(.95,3);else ramp.rotation.x=sign*Math.atan2(.95,3);ramp.receiveShadow=true;g.add(ramp);}
          terminalAsset().then(m=>{m.position.set(0,PAD_HEIGHT,16);m.rotation.y=Math.PI;g.add(m);}).catch(e=>{g.userData.error=e.message;});
        }
        g.position.set(...t.origin).sub(origin);g.quaternion.set(...t.quaternion);g.visible=g.position.length()<15000;
      }
    },
    constrain(previous,proposed,eyeHeight=1.75){
      let point=proposed.clone(),hit=false,grounded=false;
      for(const t of getTerminals()){
        if(!t.origin||previous.distanceTo(new THREE.Vector3(...t.origin))>50)continue;
        const a=local(previous,t),b=local(point,t),feet=a.y-eyeHeight;
        const x=Math.abs(b.x),z=Math.abs(b.z),onDeck=x<PAD_HALF&&z<PAD_HALF,onRamp=(x<PAD_HALF&&z<21)||(z<PAD_HALF&&x<21);const floor=onDeck?PAD_HEIGHT:onRamp?PAD_HEIGHT-Math.max(x-PAD_HALF,z-PAD_HALF)*.95/3:null;
        if(floor!==null&&feet>=floor-.35&&feet<=floor+.35&&b.y-eyeHeight<=floor+.3){b.y=floor+eyeHeight;grounded=true;}
        const c=constrainShipAttachments(a,b,[{min:[-.54,PAD_HEIGHT,15.55],max:[.54,PAD_HEIGHT+1.59,16.4]}],{eyeHeight});if(c.distanceToSquared(b)>1e-9)hit=true;point=world(c,t);
      }
      return {point,hit,grounded};
    },
    floorAt(position){for(const t of getTerminals()){if(!t.origin)continue;const p=local(position,t);if(Math.abs(p.x)<PAD_HALF&&Math.abs(p.z)<PAD_HALF&&p.y>-.5&&p.y<10)return {point:world(new THREE.Vector3(p.x,PAD_HEIGHT,p.z),t),up:new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(...t.quaternion))};}return null;},
    dispose(){for(const g of models.values()){g.traverse(o=>{if(o.isMesh&&o.material===material||o.material===mark)o.geometry.dispose();});g.removeFromParent();}material.dispose();mark.dispose();},
  };
}
