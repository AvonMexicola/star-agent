import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { ROTATING_BODIES, betweenFrames, frameRelative, frameRotation, planetRotation, rotationFrameAt } from './planet-rotation.js';

/** Render in the observer's chart. Every terrain renderer subtracts its own
 * double-precision observer before its group is rotated into this view. */
export class PlanetRenderFrames {
  constructor() {
    this.origin = new Vector3(); this.frame = null; this.seconds = 0;
    this.restores = [];
  }
  update(origin, frame, seconds) { this.origin.copy(origin); this.frame=frame; this.seconds=seconds; }
  originFor(body) { return betweenFrames(this.origin,this.frame,body,this.seconds); }
  rotationFor(body) { return frameRotation(body,this.frame,this.seconds); }
  placeBody(group,body) { group.quaternion.copy(this.rotationFor(body)); }
  sunFor(body,sunPosition) {
    return betweenFrames(sunPosition,null,body,this.seconds).sub(this.originFor(body)).normalize();
  }
  directionTo(position,body=null) { return frameRelative(position,body,this.origin,this.frame,this.seconds).normalize(); }
  /** Existing gameplay roots use body-fixed positions minus the current origin.
   * Rebase foreign roots for drawing, then restore them before gameplay queries. */
  apply(scene,excluded=new Set()) {
    const visit=object=>{
      if(!object.visible||excluded.has(object))return;
      const tagged=Object.hasOwn(object.userData,'planetFrame');
      if(!tagged&&object.position.lengthSq()===0&&object.quaternion.equals(new Quaternion())&&!object.isMesh&&!object.isLight){
        for(const child of object.children)visit(child);
        return;
      }
      const point=object.position.clone().add(this.origin),body=tagged?ROTATING_BODIES.find(b=>b.id===object.userData.planetFrame)??null:rotationFrameAt(point);
      if(body===this.frame)return;
      this.restores.push({object,position:object.position.clone(),quaternion:object.quaternion.clone()});
      frameRelative(point,body,this.origin,this.frame,this.seconds,object.position);
      object.quaternion.premultiply(this.rotationFor(body));
    };
    for(const object of scene.children)visit(object);
  }
  restore(){
    for(const {object,position,quaternion} of this.restores){object.position.copy(position);object.quaternion.copy(quaternion);object.updateMatrixWorld(true);}
    this.restores.length=0;
  }
}

export function rotationMatrix(quaternion,target=new Matrix3()) {
  return target.setFromMatrix4(new Matrix4().makeRotationFromQuaternion(quaternion));
}

/** Orbital normals are body-fixed attributes, independent of patch translation. */
export function installPlanetMaterialFrame(material,uniform) {
  const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,...args){
    compile.call(this,shader,...args);
    shader.uniforms.planetFrameRotation=uniform;
    shader.fragmentShader='uniform mat3 planetFrameRotation;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replaceAll('mat3(viewMatrix)*','mat3(viewMatrix)*planetFrameRotation*');
  };
  material.customProgramCacheKey=()=>cacheKey+'-planet-frame-v1';
}
