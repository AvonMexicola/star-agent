import * as THREE from 'three';
import {bodySurfacePoint,SELENE} from './celestial.js';
import {MOON_POSITION,LANDING_FRAME} from './moon-world.js';
import {RockCollision} from './mining/collision.js';

/** One physical field-storage box exercises the same base-container interface. */
export class FieldCache {
  constructor(scene,depositPosition){
    const direction=depositPosition.clone().addScaledVector(new THREE.Vector3(...LANDING_FRAME.east),7).sub(new THREE.Vector3(...MOON_POSITION)).normalize();
    this.scene=scene;this.position=bodySurfacePoint(direction,SELENE,.72);this.quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);this.inverse=this.quaternion.clone().invert();
    this.group=new THREE.Group();this.group.name='Crescent field cache';this.group.quaternion.copy(this.quaternion);scene.add(this.group);
    const paint=new THREE.MeshStandardMaterial({color:0x8e6737,roughness:.78,metalness:.2}),steel=new THREE.MeshStandardMaterial({color:0x35414b,roughness:.6,metalness:.5});
    const body=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.4,1.4),paint);body.castShadow=body.receiveShadow=true;this.group.add(body);
    for(const x of [-1.12,1.12]){const band=new THREE.Mesh(new THREE.BoxGeometry(.14,1.48,1.48),steel);band.position.x=x;band.castShadow=true;this.group.add(band);}
    const lid=new THREE.Mesh(new THREE.BoxGeometry(2.44,.09,1.44),steel);lid.position.y=.71;this.group.add(lid);
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d');
      c.fillStyle='#152229';c.fillRect(0,0,512,160);c.fillStyle='#c6e5d8';c.font='bold 37px monospace';c.fillText('CRESCENT CACHE',22,58);c.font='24px monospace';c.fillText('01 / FIELD STORAGE',22,105);c.font='18px monospace';c.fillText('BACKPACK > NEARBY STORAGE',22,137);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Mesh(new THREE.PlaneGeometry(1.75,.55),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));label.position.set(0,.05,.706);this.group.add(label);
    }
    const collisionGeometry=body.geometry.index?body.geometry.toNonIndexed():body.geometry;
    this.collision=new RockCollision(collisionGeometry.attributes.position.array);if(collisionGeometry!==body.geometry)collisionGeometry.dispose();this.grounded=false;
  }
  local(p){return p.clone().sub(this.position).applyQuaternion(this.inverse);}
  constrainWalker(a,b){
    this.grounded=false;if(a.distanceTo(this.position)>5&&b.distanceTo(this.position)>5)return {point:b,hit:false};
    const start=this.local(a),end=this.local(b),result=this.collision.sweep(start,end);result.grounded ||= end.y<=start.y+1e-5&&this.collision.groundedAt(result.point);this.grounded=result.grounded;
    return {...result,point:result.point.applyQuaternion(this.quaternion).add(this.position)};
  }
  raycast(origin,direction,range){return this.collision.raycast(this.local(origin),direction.clone().applyQuaternion(this.inverse),range);}
  constrainEVA(a,b){return this.sweepSphere(a,b,.35);}
  constrainFlight(a,b){return this.sweepSphere(a,b,10);}
  sweepSphere(a,b,radius){
    const start=this.local(a),end=this.local(b);if(new THREE.Line3(start,end).closestPointToPoint(new THREE.Vector3(),true,new THREE.Vector3()).length()>radius+3)return {point:b,hit:false};
    const lift=new THREE.Vector3(0,radius,0),result=this.collision.sweep(start.add(lift),end.add(lift),{radius,height:radius*2});
    return {...result,point:result.point.sub(lift).applyQuaternion(this.quaternion).add(this.position)};
  }
  dispose(){const materials=new Set(),geometries=new Set();this.group.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}this.scene.remove(this.group);}
  update(origin){this.group.position.copy(this.position).sub(origin);this.group.visible=this.position.distanceTo(origin)<2000;}
}
