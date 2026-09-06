import * as THREE from 'three';
import { RADIUS, terrainHeight, moisture, hash } from './world.js';

const CAPACITY=85000, SPACING=1.1, MARGIN=20, UP=new THREE.Vector3(0,1,0);
/** Cheap crossed clusters: 18 tapered blades encoded in one reusable alpha mask.
 * The source is deterministic; no network textures or per-blade scene objects. */
function grassTexture(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle='white';
  for(let i=0;i<18;i++){
    const x=4+hash(i,0,8791)*120,h=45+hash(i,1,8791)*78,lean=(hash(i,2,8791)-.5)*28;
    c.beginPath();c.moveTo(x-2.2,128);c.quadraticCurveTo(x+lean*.2,128-h*.6,x+lean,128-h);
    c.quadraticCurveTo(x+lean*.3+2,128-h*.55,x+2.2,128);c.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
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
export class DistantMeadow {
  constructor(scene,vegetation){
    this.vegetation=vegetation;this.origin=new THREE.Vector3();this.last=new THREE.Vector3(Infinity,Infinity,Infinity);
    this.distance=80;this.density=.75;this.cache=new Map();this.pending=null;this.clearing=null;
    this.uniforms={fieldEye:{value:new THREE.Vector3()},fieldTime:{value:0},fieldRange:{value:80}};
    this.texture=grassTexture();this.geometry=clusterGeometry();
    this.material=new THREE.MeshStandardMaterial({map:this.texture,alphaTest:.32,side:THREE.DoubleSide,roughness:1});
    this.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 fieldEye; uniform float fieldTime; varying float fieldDistance;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vec3 root=instanceMatrix[3].xyz; fieldDistance=length(root-fieldEye);
          transformed.x+=sin(fieldTime*1.8+root.x*.42+root.z*.29)*.09*position.y*position.y;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float fieldRange; varying float fieldDistance;')
        .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
          float cover=smoothstep(6.0,10.0,fieldDistance)*(1.0-smoothstep(fieldRange*.78,fieldRange,fieldDistance));
          float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
          if(noise>cover)discard;`)
        .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal*=faceDirection;')
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.45,1.0,vMapUv.y);');
    };
    this.material.customProgramCacheKey=()=> 'distant-meadow-v1';
    this.mesh=new THREE.InstancedMesh(this.geometry,this.material,CAPACITY);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.receiveShadow=true;this.mesh.castShadow=false;this.mesh.name='Distant instanced meadow';scene.add(this.mesh);
    this.stats={range:80,density:.75,clusters:0,pending:0,rebuilds:0,visible:false};
  }
  configure({grassDistance,grassDensity}){
    if(this.distance===grassDistance&&this.density===grassDensity)return;
    this.distance=grassDistance;this.density=grassDensity;this.uniforms.fieldRange.value=grassDistance;
    this.last.set(Infinity,Infinity,Infinity);this.pending=null;
    Object.assign(this.stats,{range:grassDistance,density:grassDensity});
  }
  update(position,origin,time){
    const up=position.clone().normalize(),height=terrainHeight(...up.toArray()),altitude=position.length()-RADIUS-height;
    this.mesh.visible=Math.abs(up.y)<.78&&height>12&&height<2200&&altitude>-.5&&altitude<this.distance;
    this.stats.visible=this.mesh.visible;if(!this.mesh.visible)return;
    const clearing=this.vegetation.exclusionPosition?.toArray().join('/')??null;
    if(!this.pending&&(position.distanceToSquared(this.last)>8**2||clearing!==this.clearing)){
      this.last.copy(position);this.clearing=clearing;
      this.pending={iterator:this.vegetation.scatterRecords(up,this.distance+MARGIN,SPACING,4819),cache:new Map(),
        origin:up.clone().multiplyScalar(RADIUS+height),matrices:new Float32Array(CAPACITY*16),colors:new Float32Array(CAPACITY*3),count:0};
    }
    if(this.pending){
      const job=this.pending,start=performance.now();let count=0,done=false;
      const p=new THREE.Vector3(),q=new THREE.Quaternion(),yaw=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4(),color=new THREE.Color();
      // Enumeration, terrain sampling and matrix preparation all share this
      // frame budget. Retain the old mesh until the complete replacement is ready.
      while(count<512&&(count<8||performance.now()-start<2)){
        const next=job.iterator.next();if(next.done){done=true;break;}
        const r=next.value;count++;
        if(hash(r.col,r.row,5913)>this.density||this.vegetation.isExcluded(r.x,r.y,r.z))continue;
        const key=`${r.col}/${r.row}`;let value=this.cache.get(key);
        if(!value)value={...r,h:terrainHeight(r.x,r.y,r.z),wet:THREE.MathUtils.clamp((moisture(r.x,r.y,r.z)-.28)/.2,0,1)};
        job.cache.set(key,value);
        if(value.h<=12||value.h>=2200||job.count>=CAPACITY)continue;
        const v=value;p.set(v.x,v.y,v.z);q.setFromUnitVectors(UP,p);yaw.setFromAxisAngle(UP,v.a*Math.PI*2);q.multiply(yaw);
        p.multiplyScalar(RADIUS+v.h-.035).sub(job.origin);scale.set(1,(.3+v.a*.32)*(.8+v.wet*.2),1);matrix.compose(p,q,scale);
        matrix.toArray(job.matrices,job.count*16);
        color.setRGB(.20+v.wet*.12+v.b*.1,.27+v.wet*.18+v.b*.12,.045+(1-v.wet)*.1+v.b*.025);color.toArray(job.colors,job.count*3);job.count++;
      }
      this.stats.pending=done?0:1;
      if(done){this.publish(job);this.pending=null;}
    }
    this.uniforms.fieldEye.value.copy(position).sub(this.origin);this.uniforms.fieldTime.value=time;
    this.mesh.position.copy(this.origin).sub(origin);
  }
  publish(job){
    this.origin.copy(job.origin);this.cache=job.cache;
    const count=job.count;
    this.mesh.instanceMatrix.array=job.matrices;this.mesh.instanceMatrix.clearUpdateRanges();this.mesh.instanceMatrix.addUpdateRange(0,count*16);this.mesh.instanceMatrix.needsUpdate=true;
    if(!this.mesh.instanceColor)this.mesh.instanceColor=new THREE.InstancedBufferAttribute(job.colors,3);
    else this.mesh.instanceColor.array=job.colors;
    this.mesh.instanceColor.clearUpdateRanges();this.mesh.instanceColor.addUpdateRange(0,count*3);this.mesh.instanceColor.needsUpdate=true;
    this.mesh.count=count;
    this.stats.clusters=count;this.stats.rebuilds++;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.geometry.dispose();this.material.dispose();this.texture.dispose();}
}
