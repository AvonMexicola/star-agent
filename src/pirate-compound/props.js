import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildStationColliders,constrainStationSweep} from '../station-collision.js';
import {createFloodlights} from '../build/floodlights.js';
import manifest from '../../assets/pirate-props/manifest.json';
const v=a=>new T.Vector3(...a);
export function piratePropPlacements(deck){return [
 {id:'generator',position:[-10,deck,-27],width:1.8,rotation:0},
 {id:'workbench',position:[-8,deck,6],width:1.9,rotation:Math.PI},
 {id:'floodlight',position:[-3,deck,15],width:1.9,rotation:0},
 {id:'floodlight',position:[15,deck,-7],width:1.9,rotation:Math.PI},
 ...[[-9,12],[6,5],[12,14],[13,-14]].map(([x,z],i)=>({id:'crate',position:[x,deck,z],width:1.65,rotation:i*Math.PI/2})),
];}
/** User Crimson assets supply actual cover/clearance and capped work lighting. */
export class PirateProps{
 constructor(scene,layout){this.group=new T.Group();this.group.name='Crimson salvage fixtures';this.scene=scene;this.origin=v(layout.claim.origin);this.q=new T.Quaternion(...layout.claim.quaternion);this.inverse=this.q.clone().invert();this.ready=false;this.error='';this.disposed=false;this.instances=[];this.models=[];this.lights=createFloodlights(scene);this.placements=piratePropPlacements(layout.deck);scene.add(this.group);
  this.readyPromise=Promise.all(manifest.assets.map(async record=>({record,model:(await new GLTFLoader().loadAsync('/'+record.runtime.replace(/^public\//,''))).scene}))).then(entries=>{
   if(this.disposed)return;this.models=entries.map(e=>e.model);for(const spec of this.placements){const {model,record}=entries.find(e=>e.record.id===spec.id),root=model.clone(true),b=record.rawMeshBounds,scale=spec.width/(b.max[0]-b.min[0]);const holder=new T.Group();holder.position.fromArray(spec.position);holder.rotation.y=spec.rotation;root.scale.setScalar(scale);root.position.set(-(b.min[0]+b.max[0])/2*scale,-b.min[1]*scale,-(b.min[2]+b.max[2])/2*scale);if(spec.id==='floodlight')root.rotation.y=Math.PI;holder.add(root);this.group.add(holder);root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.instances.push({spec,holder,height:(b.max[1]-b.min[1])*scale});}
   // Build while the parent is in its object-local frame; no rebased GPU floats.
   this.group.position.set(0,0,0);this.group.quaternion.identity();this.tree=buildStationColliders(this.group);this.ready=true;
  }).catch(e=>{this.error=e.message;throw e;});
 }
 raycast(start,direction,range,envelope){if(!this.ready)return null;const a=start.clone().sub(this.origin).applyQuaternion(this.inverse),b=start.clone().addScaledVector(direction,range).sub(this.origin).applyQuaternion(this.inverse),bounds=new T.Box3();for(let i=0;i<8;i++){const p=envelope?new T.Vector3(...[0,1,2].map(k=>(i&(1<<k)?envelope.max:envelope.min)[k])).applyQuaternion(envelope.orientation):new T.Vector3(i&1?.004:-.004,i&2?.004:-.004,i&4?.004:-.004);bounds.expandByPoint(p.applyQuaternion(this.inverse));}const hit=constrainStationSweep(this.tree,[],a,b,bounds.min,bounds.max);if(!hit.hit)return null;const point=hit.point.applyQuaternion(this.q).add(this.origin);return {point,distance:start.distanceTo(point),normal:direction.clone().negate()};}
 update(camera,origin,enabled){this.group.position.copy(this.origin).sub(origin);this.group.quaternion.copy(this.q);this.group.visible=enabled&&camera.distanceToSquared(this.origin)<1500**2;const fixtures=[];if(this.ready&&enabled)for(const {spec,height} of this.instances.filter(i=>i.spec.id==='floodlight')){const yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),spec.rotation);const point=p=>v(p).applyQuaternion(yaw).add(v(spec.position)).applyQuaternion(this.q).add(this.origin);fixtures.push({id:`hush-crimson-${fixtures.length}`,position:point([0,height*.81,-.12]),target:point([0,0,-11])});}this.lights.update(fixtures,camera,origin);}
 dispose(){this.disposed=true;this.group.removeFromParent();this.lights.dispose();for(const root of this.models)root.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const key of ['map','normalMap','metalnessMap','roughnessMap','aoMap'])m[key]?.dispose();m.dispose();}}});}
}
