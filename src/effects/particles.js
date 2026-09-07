import * as THREE from 'three';

// Preserve destination alpha: the atmosphere still needs to see the sky behind
// additive particles. All geometric effects test the scene's logarithmic depth.
export const additive = {
  transparent:true, depthWrite:false, depthTest:true, toneMapped:false,
  blending:THREE.CustomBlending, blendSrc:THREE.SrcAlphaFactor,
  blendDst:THREE.OneFactor, blendEquation:THREE.AddEquation,
  blendSrcAlpha:THREE.ZeroFactor, blendDstAlpha:THREE.OneFactor,
};
const vertexShader = `
attribute vec3 start; attribute vec3 end; attribute vec3 tint;
attribute vec4 shape;
varying vec2 vUv; varying vec3 vTint; varying vec2 vShape;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vUv=uv; vTint=tint; vShape=shape.zw;
  vec4 a=modelViewMatrix*vec4(start,1.0), b=modelViewMatrix*vec4(end,1.0);
  // Perspective changes a z-aligned trail into a radial screen streak. Use its
  // projected direction so quads retain width and winding at every heading.
  vec2 axis=b.xy/max(.05,-b.z)-a.xy/max(.05,-a.z);
  axis=length(axis)>.0001?normalize(axis):vec2(0.0,1.0);
  vec2 side=vec2(axis.y,-axis.x);
  vec4 mvPosition=mix(a,b,uv.y);
  mvPosition.xy+=side*position.x*shape.x+axis*position.y*shape.y;
  gl_Position=projectionMatrix*mvPosition;
  #include <logdepthbuf_vertex>
}`;
const fragmentShader = `
varying vec2 vUv; varying vec3 vTint; varying vec2 vShape;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  vec2 p=vUv*2.0-1.0;
  float radius=length(p), glow=exp(-radius*radius*4.8);
  float core=exp(-radius*radius*45.0);
  float mask=glow+core*1.8;
  if(vShape.y>.5 && vShape.y<1.5){
    mask=exp(-p.x*p.x*10.0)*pow(max(0.0,1.0-p.y*p.y),.5);
    core=exp(-p.x*p.x*100.0)*max(0.0,1.0-p.y*p.y);
  }
  if(vShape.y>1.5 && vShape.y<2.5){
    mask=exp(-pow((radius-.65)*20.0,2.0));core=mask*.3;
  }
  if(vShape.y>2.5){
    float edge=max(abs(p.x)*.8+abs(p.y)*.5,abs(p.y));
    mask=(1.0-smoothstep(.6,.82,edge))*(.35+.65*step(p.x+p.y*.4,.1));
    core=.12*mask;
  }
  float alpha=mask*vShape.x;
  if(alpha<.002)discard;
  gl_FragColor=vec4(vTint+vec3(core)*.7,alpha);
}`;

/** Fixed pool: CPU positions stay doubles; only camera-relative endpoints go to GPU. */
export class ParticlePool {
  constructor(scene,capacity=2048){
    this.capacity=capacity;this.cursor=0;this.count=0;this.emitted=0;
    this.slots=Array.from({length:capacity},()=>({alive:false,p:new THREE.Vector3(),v:new THREE.Vector3(),spin:new THREE.Vector3(),color:new THREE.Color(),age:0,life:1}));
    this.geometry=new THREE.InstancedBufferGeometry();
    const quad=new THREE.PlaneGeometry(1,1);
    this.geometry.index=quad.index.clone();
    for(const name of ['position','uv'])this.geometry.setAttribute(name,quad.attributes[name].clone());
    quad.dispose();
    for(const [name,size] of [['start',3],['end',3],['tint',3],['shape',4]])this.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));
    this.geometry.instanceCount=0;
    this.material=new THREE.ShaderMaterial({...additive,vertexShader,fragmentShader});
    this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.name='Pooled energy / sparks / mineral fragments';scene.add(this.mesh);
    this._tail=new THREE.Vector3();this._to=new THREE.Vector3();this._curl=new THREE.Vector3();
  }
  emit(position,velocity,{color=0x86ddff,life=.6,size=.1,kind=0,stretch=.025,drag=0,attract=false,gain=1,anchor=null,engine=false}={}){
    const p=this.slots[this.cursor];this.cursor=(this.cursor+1)%this.capacity;
    p.alive=true;p.p.copy(position);p.v.copy(velocity);p.spin.copy(velocity).normalize();p.color.set(color).multiplyScalar(gain);
    Object.assign(p,{age:0,life,size,kind,stretch,drag,attract,cameraLocal:false,fresh:true,anchor,engine});this.emitted++;
    return p;
  }
  clear(){for(const p of this.slots)p.alive=false;this.count=0;this.geometry.instanceCount=0;}
  update(dt,origin,collector){
    const a=this.geometry.attributes;let count=0;
    for(const p of this.slots){
      if(!p.alive)continue;
      const step=p.fresh?0:dt;p.fresh=false;
      p.age+=step;if(p.age>=p.life){p.alive=false;continue;}
      if(p.attract&&collector&&p.age>.12){
        this._to.copy(collector).sub(p.p);const distance=this._to.length();
        if(distance<.12){p.alive=false;continue;}
        // Curved arrival with a critically damped chase; catch a moving suit.
        const chase=7+26*p.age/p.life;
        this._curl.crossVectors(p.spin,this._to).normalize().multiplyScalar(Math.min(5,distance*6)*(1-p.age/p.life));
        this._to.multiplyScalar(chase).add(this._curl);
        p.v.lerp(this._to,1-Math.exp(-step*9));
        if(p.v.length()*step>distance)p.v.setLength(distance/Math.max(step,.00001));
      }
      if(p.anchor){const position=p.anchor();if(!position){p.alive=false;continue;}p.p.copy(position);}
      else{p.v.multiplyScalar(Math.exp(-p.drag*step));p.p.addScaledVector(p.v,step);}
      this._tail.copy(p.p).addScaledVector(p.v,-p.stretch);
      a.start.setXYZ(count,this._tail.x-origin.x,this._tail.y-origin.y,this._tail.z-origin.z);
      a.end.setXYZ(count,p.p.x-origin.x,p.p.y-origin.y,p.p.z-origin.z);
      a.tint.setXYZ(count,p.color.r,p.color.g,p.color.b);
      const t=p.age/p.life,fade=Math.min(1,(p.age+.025)*35)*Math.pow(1-t,1.2);
      const size=p.size*(p.kind===2?1+t*4:1+t*.25);
      a.shape.setXYZW(count,size,size,fade,p.kind);count++;
    }
    this.count=count;this.geometry.instanceCount=count;
    for(const attribute of Object.values(a))if(attribute.isInstancedBufferAttribute)attribute.needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
