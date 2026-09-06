import * as THREE from 'three';
import { RADIUS, terrainHeight, moisture, hash } from './world.js';

const CAPACITY=85000, SPACING=1.1, MARGIN=20, UP=new THREE.Vector3(0,1,0);
/** Cheap crossed clusters: 32 tapered blades encoded in one reusable colored alpha mask.
 * The source is deterministic; no network textures or per-blade scene objects. */
function grassTexture(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');
  for(let i=0;i<32;i++){
    const x=4+hash(i,0,8791)*120,h=83+hash(i,1,8791)*41,lean=(hash(i,2,8791)-.5)*28;
    const gradient=c.createLinearGradient(0,128,0,128-h);
    gradient.addColorStop(0,new THREE.Color(.42,.52,.27).getStyle());
    gradient.addColorStop(1,new THREE.Color(.80,.88,.45).getStyle());c.fillStyle=gradient;
    c.beginPath();c.moveTo(x-2.2,128);c.quadraticCurveTo(x+lean*.2,128-h*.6,x+lean,128-h);
    c.quadraticCurveTo(x+lean*.3+2,128-h*.55,x+2.2,128);c.fill();
  }
  // Supply RGB even outside the mask so minification does not average black
  // transparent texels into the blade color. Alpha still controls coverage.
  const pixels=c.getImageData(0,0,128,128).data,color=new THREE.Color();
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const i=(y*128+x)*4;if(pixels[i+3]!==0)continue;
    const t=Math.min(1,(128-y)/105);color.setRGB(.42+t*.38,.52+t*.36,.27+t*.18).convertLinearToSRGB();
    pixels[i]=Math.round(color.r*255);pixels[i+1]=Math.round(color.g*255);pixels[i+2]=Math.round(color.b*255);
  }
  const texture=new THREE.DataTexture(pixels,128,128);texture.colorSpace=THREE.SRGBColorSpace;
  texture.flipY=true;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
function clusterGeometry(){
  const positions=[],uv=[],indices=[];
  for(let i=0;i<3;i++){
    const a=i*Math.PI/3,c=Math.cos(a),s=Math.sin(a),base=positions.length/3;
    for(const [x,y,u,v] of [[-.7,0,0,0],[.7,0,1,0],[-.7,1,0,1],[.7,1,1,1]]){positions.push(x*c,y,x*s);uv.push(u,v);}
    indices.push(base,base+1,base+2,base+1,base+3,base+2);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map((_,i)=>i%3===1?1:0),3));return g;
}
function mediumGeometry(){
  const positions=[],uv=[];
  for(let blade=0;blade<5;blade++){
    const angle=blade*2.39996,c=Math.cos(angle),s=Math.sin(angle),length=.65+hash(blade,0,427)*.35;
    positions.push(c*.04-s*.04,0,s*.04+c*.04,c*.04+s*.04,0,s*.04-c*.04,c*.2,length,s*.2);
    uv.push(0,0,1,0,.5,1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map((_,i)=>i%3===1?1:0),3));return g;
}
export class DistantMeadow {
  constructor(scene,vegetation,{medium=false}={}){
    this.medium=medium;this.spacing=medium?.28:SPACING;this.margin=medium?10:MARGIN;this.capacity=medium?65000:CAPACITY;
    this.vegetation=vegetation;this.origin=new THREE.Vector3();this.previousOrigin=new THREE.Vector3();this.hadPopulation=false;this.blendStart=-1;this.last=new THREE.Vector3(Infinity,Infinity,Infinity);
    this.distance=medium?28:80;this.publishedRange=this.distance;this.previousRange=this.distance;this.density=.75;this.cache=new Map();this.pending=null;this.clearing=null;
    this.uniforms={fieldEye:{value:new THREE.Vector3()},fieldTime:{value:0},fieldRange:{value:this.distance},fieldPublishedRange:{value:this.distance},fieldUp:{value:new THREE.Vector3()},fieldResidentCenter:{value:new THREE.Vector3()},fieldResidentRadius:{value:medium?38:0},fieldPreviousCenter:{value:new THREE.Vector3()},fieldPreviousRadius:{value:0},fieldResidentBlend:{value:1}};
    this.texture=medium?null:grassTexture();this.geometry=medium?mediumGeometry():clusterGeometry();
    this.geometry.setAttribute('fieldPhase',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity),1));
    this.material=new THREE.MeshStandardMaterial({map:this.texture,alphaTest:0,side:THREE.DoubleSide,roughness:1});
    this.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 fieldEye; uniform float fieldTime; uniform vec3 fieldUp,fieldResidentCenter,fieldPreviousCenter; attribute float fieldPhase; varying float fieldDistance; varying float fieldHeight; varying float fieldSeed; varying float fieldResidentDistance; varying float fieldOwnDistance; varying float fieldPreviousDistance;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vec3 root=instanceMatrix[3].xyz; fieldDistance=length(root-fieldEye); fieldHeight=uv.y; fieldSeed=fieldPhase;
          vec3 residentDelta=root-fieldResidentCenter;
          fieldResidentDistance=length(residentDelta-fieldUp*dot(residentDelta,fieldUp));
          fieldOwnDistance=length(root-fieldUp*dot(root,fieldUp));
          vec3 previousDelta=root-fieldPreviousCenter;fieldPreviousDistance=length(previousDelta-fieldUp*dot(previousDelta,fieldUp));
          transformed.x+=sin(fieldTime*1.8+fieldPhase)*.09*position.y*position.y;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float fieldRange,fieldPublishedRange,fieldResidentRadius,fieldPreviousRadius,fieldResidentBlend; varying float fieldDistance; varying float fieldHeight; varying float fieldSeed; varying float fieldResidentDistance; varying float fieldOwnDistance; varying float fieldPreviousDistance;')
        .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
          float resident=fieldResidentRadius>0.0?1.0-smoothstep(fieldResidentRadius-8.0,fieldResidentRadius,fieldResidentDistance):0.0;
          float previousResident=fieldPreviousRadius>0.0?1.0-smoothstep(fieldPreviousRadius-8.0,fieldPreviousRadius,fieldPreviousDistance):0.0;
          resident*=mix(previousResident,1.0,fieldResidentBlend);
          float outer=smoothstep(20.0,28.0,fieldDistance);
          // The coarse parent fills unresident parts of the middle layer. Blend
          // across the retained field edge before new blades finish streaming.
          float cover=${medium?'smoothstep(6.0,10.0,fieldDistance)*(1.0-outer)*resident':'smoothstep(6.0,10.0,fieldDistance)*(1.0-(1.0-outer)*resident)*(1.0-smoothstep(fieldRange*.78,fieldRange,fieldDistance))*(1.0-smoothstep(fieldPublishedRange,fieldPublishedRange+20.0,fieldOwnDistance))'};
          float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))${medium?'':'+fieldSeed*.137'}));
          // Preserve the filtered mask's average coverage when blades become
          // subpixel. A hard alpha cutoff erased the sward in distant mipmaps.
          if(noise>cover*diffuseColor.a)discard;`)
        .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal*=faceDirection;')
        .replace('#include <color_fragment>',medium?'#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.42,.52,.27),vec3(.80,.88,.45),fieldHeight);':'#include <color_fragment>');
    };
    this.material.customProgramCacheKey=()=> medium?'medium-meadow-v2':'distant-meadow-v4';
    this.mesh=new THREE.InstancedMesh(this.geometry,this.material,this.capacity);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.receiveShadow=true;this.mesh.castShadow=false;this.mesh.name=medium?'Intermediate grass blades':'Distant instanced meadow';scene.add(this.mesh);
    this.stats={range:this.distance,density:.75,clusters:0,pending:0,rebuilds:0,visible:false};
    if(!medium)this.middle=new DistantMeadow(scene,vegetation,{medium:true});
  }
  configure({grassDistance,grassDensity}){
    if(this.middle)this.middle.configure({grassDistance:28,grassDensity});
    if(this.medium)grassDistance=28;
    if(this.distance===grassDistance&&this.density===grassDensity)return;
    this.distance=grassDistance;this.density=grassDensity;this.uniforms.fieldRange.value=grassDistance;
    this.last.set(Infinity,Infinity,Infinity);this.pending=null;
    Object.assign(this.stats,{range:grassDistance,density:grassDensity});
  }
  update(position,origin,time){
    if(this.middle){this.middle.update(position,origin,time);this.stats.middle=this.middle.stats;}
    const up=position.clone().normalize(),height=terrainHeight(...up.toArray()),altitude=position.length()-RADIUS-height;
    this.mesh.visible=Math.abs(up.y)<.78&&height>12&&height<2200&&altitude>-.5&&altitude<this.distance;
    this.stats.visible=this.mesh.visible;if(!this.mesh.visible)return;
    const clearing=this.vegetation.exclusionPosition?.toArray().join('/')??null;
    if(!this.pending&&(position.distanceToSquared(this.last)>8**2||clearing!==this.clearing)){
      this.last.copy(position);this.clearing=clearing;
      this.pending={range:this.distance,iterator:this.vegetation.scatterRecords(up,this.distance+this.margin,this.spacing,this.medium?4817:4819),cache:new Map(),
        origin:up.clone().multiplyScalar(RADIUS+height),matrices:new Float32Array(this.capacity*16),colors:new Float32Array(this.capacity*3),phases:new Float32Array(this.capacity),count:0};
      if(this.mesh.count===0)this.origin.copy(this.pending.origin);
    }
    if(this.pending){
      const job=this.pending,start=performance.now();let count=0,done=false;
      const p=new THREE.Vector3(),q=new THREE.Quaternion(),yaw=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4(),color=new THREE.Color();
      // Enumeration, terrain sampling and matrix preparation all share this
      // frame budget. Retain the old mesh until the complete replacement is ready.
      while(count<512&&(count<8||performance.now()-start<(this.medium?.8:1.2))){
        const next=job.iterator.next();if(next.done){done=true;break;}
        const r=next.value;count++;
        if(hash(r.col,r.row,5913)>this.density||this.vegetation.isExcluded(r.x,r.y,r.z))continue;
        const key=`${r.col}/${r.row}`;let value=this.cache.get(key);
        if(!value)value={...r,h:terrainHeight(r.x,r.y,r.z),wet:THREE.MathUtils.clamp((moisture(r.x,r.y,r.z)-.28)/.2,0,1)};
        job.cache.set(key,value);
        if(value.h<=12||value.h>=2200||job.count>=this.capacity)continue;
        const v=value;p.set(v.x,v.y,v.z);q.setFromUnitVectors(UP,p);yaw.setFromAxisAngle(UP,v.a*Math.PI*2);q.multiply(yaw);
        p.multiplyScalar(RADIUS+v.h-.035).sub(job.origin);const width=this.medium?.8+v.b*.6:1;scale.set(width,(.315+v.a*.33)*(.75+v.wet*.25),width);matrix.compose(p,q,scale);
        matrix.toArray(job.matrices,job.count*16);job.phases[job.count]=((v.x*.61+v.y*.23+v.z*.17)*RADIUS)%(Math.PI*2)+v.b*Math.PI*2*.35;
        color.setRGB(.20+v.wet*.12+v.b*.1,.27+v.wet*.18+v.b*.12,.045+(1-v.wet)*.1+v.b*.025);color.toArray(job.colors,job.count*3);job.count++;
      }
      this.stats.pending=done?0:1;
      if(done){this.publish(job);this.pending=null;}
    }
    this.uniforms.fieldEye.value.copy(position).sub(this.origin);this.uniforms.fieldTime.value=time;
    this.uniforms.fieldUp.value.copy(this.origin).normalize();
    this.uniforms.fieldPublishedRange.value=this.publishedRange;
    this.uniforms.fieldRange.value=Math.min(this.distance,THREE.MathUtils.lerp(this.previousRange,this.publishedRange,THREE.MathUtils.smoothstep(time-this.blendStart,0,.6)));
    const residentLayer=this.middle??this;
    this.uniforms.fieldPreviousCenter.value.copy(residentLayer.previousOrigin).sub(this.origin);
    this.uniforms.fieldPreviousRadius.value=residentLayer.hadPopulation?residentLayer.distance+residentLayer.margin:0;
    this.uniforms.fieldResidentBlend.value=THREE.MathUtils.smoothstep(time-residentLayer.blendStart,0,.6);
    if(this.middle){
      this.uniforms.fieldResidentCenter.value.copy(this.middle.origin).sub(this.origin);
      this.uniforms.fieldResidentRadius.value=this.middle.mesh.visible&&this.middle.mesh.count>0?this.middle.distance+this.middle.margin:0;
    }
    this.mesh.position.copy(this.origin).sub(origin);this.stats.pending=Number(Boolean(this.pending)||Boolean(this.middle?.pending));
  }
  publish(job){
    this.previousRange=this.publishedRange;this.publishedRange=job.range;
    this.previousOrigin.copy(this.origin);this.hadPopulation=this.mesh.count>0;this.blendStart=this.uniforms.fieldTime.value;
    this.origin.copy(job.origin);this.cache=job.cache;
    const count=job.count;
    this.mesh.instanceMatrix.array=job.matrices;this.mesh.instanceMatrix.clearUpdateRanges();this.mesh.instanceMatrix.addUpdateRange(0,count*16);this.mesh.instanceMatrix.needsUpdate=true;
    if(!this.mesh.instanceColor)this.mesh.instanceColor=new THREE.InstancedBufferAttribute(job.colors,3);
    else this.mesh.instanceColor.array=job.colors;
    this.mesh.instanceColor.clearUpdateRanges();this.mesh.instanceColor.addUpdateRange(0,count*3);this.mesh.instanceColor.needsUpdate=true;
    const phase=this.geometry.attributes.fieldPhase;phase.array=job.phases;phase.clearUpdateRanges();phase.addUpdateRange(0,count);phase.needsUpdate=true;
    this.mesh.count=count;
    this.stats.clusters=count;this.stats.rebuilds++;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.geometry.dispose();this.material.dispose();this.texture?.dispose();this.middle?.dispose();}
}
