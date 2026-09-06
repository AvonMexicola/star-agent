import * as THREE from 'three';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
/** Three small HDR levels. No readbacks, no full-resolution blur or dependencies. */
export class EnergyBloom {
  constructor(renderer){
    this.renderer=renderer;this.enabled=true;
    const target=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    this.levels=Array.from({length:3},()=>[target(),target()]);
    this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:null},stepSize:{value:new THREE.Vector2()},extract:{value:0}},vertexShader,fragmentShader:`
      uniform sampler2D source;uniform vec2 stepSize;uniform float extract;varying vec2 vUv;
      vec3 sampleHDR(vec2 uv){vec3 c=texture2D(source,uv).rgb;float b=max(c.r,max(c.g,c.b));
        float knee=clamp(b-1.0,0.0,1.0);float contribution=max(b-1.5,knee*knee*.5);
        return mix(c,c*max(0.0,contribution)/max(b,.0001),extract);}
      void main(){vec3 c=sampleHDR(vUv)*.227027;
        c+=(sampleHDR(vUv+stepSize*1.384615)+sampleHDR(vUv-stepSize*1.384615))*.316216;
        c+=(sampleHDR(vUv+stepSize*3.230769)+sampleHDR(vUv-stepSize*3.230769))*.070270;
        gl_FragColor=vec4(c,0.0);}`});
    this.scene=new THREE.Scene();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.quad.frustumCulled=false;this.scene.add(this.quad);this.camera=new THREE.Camera();
  }
  get textures(){return this.levels.map(pair=>pair[1].texture);}
  resize(w,h){this.levels.forEach((pair,i)=>pair.forEach(t=>t.setSize(Math.max(1,Math.ceil(w/2**(i+1))),Math.max(1,Math.ceil(h/2**(i+1))))));}
  render(source){
    if(!this.enabled)return;
    const old=this.renderer.getRenderTarget(),u=this.material.uniforms;
    this.levels.forEach(([a,b],i)=>{
      u.source.value=i?this.levels[i-1][1].texture:source;u.extract.value=i?0:1;u.stepSize.value.set(1/a.width,0);
      this.renderer.setRenderTarget(a);this.renderer.render(this.scene,this.camera);
      u.source.value=a.texture;u.extract.value=0;u.stepSize.value.set(0,1/a.height);
      this.renderer.setRenderTarget(b);this.renderer.render(this.scene,this.camera);
    });
    this.renderer.setRenderTarget(old);
  }
  dispose(){this.levels.flat().forEach(t=>t.dispose());this.material.dispose();this.quad.geometry.dispose();}
}
