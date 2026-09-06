import * as THREE from 'three';
import { MIASMA_RADIUS, MIASMA_POSITION, miasmaSurface } from './miasma-world.js';
const CENTER=new THREE.Vector3(...MIASMA_POSITION),UP=new THREE.Vector3(0,1,0),TAU=Math.PI*2;
const hash=(x,y,salt)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^salt;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
/** Stable wrapped latitude rows, adapted from the Selene surface-stones work.
 * Candidate placement is independent of camera heading and remains stable on return. */
export function scatterMinerals(center,visit){
  const spacing=1.65,range=78,step=spacing/MIASMA_RADIUS,angular=(range+spacing*2)/MIASMA_RADIUS;
  const lat0=Math.asin(THREE.MathUtils.clamp(center.y,-1,1)),lon0=Math.atan2(center.x,center.z);
  for(let row=Math.floor((lat0-angular)/step);row<=Math.ceil((lat0+angular)/step);row++){
    const lat=(row+.5)*step;if(Math.abs(lat)>=Math.PI/2)continue;
    const columns=Math.max(1,Math.round(TAU*MIASMA_RADIUS*Math.cos(lat)/spacing)),delta=TAU/columns,den=Math.cos(lat0)*Math.cos(lat);
    const extent=den<1e-13?Math.PI:Math.acos(THREE.MathUtils.clamp((Math.cos(angular)-Math.sin(lat0)*Math.sin(lat))/den,-1,1));
    const reach=Math.ceil(extent/delta)+2,origin=Math.floor((lon0+Math.PI)/delta),count=Math.min(columns,reach*2+1);
    for(let i=0;i<count;i++){
      const col=((origin-reach+i)%columns+columns)%columns,a=hash(col,row,713),b=hash(col,row,1717);
      if(a>.43)continue;
      const lat=(row+.15+a/.43*.7)*step,lon=(col+.15+b*.7)*delta-Math.PI;if(Math.abs(lat)>=Math.PI/2)continue;
      const d=new THREE.Vector3(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));
      if(d.distanceTo(center)*MIASMA_RADIUS>range)continue;visit(d,col,row,a,b);
    }
  }
}
export class MineralFragments {
  constructor(parent){
    this.group=new THREE.Group();this.group.name='Miasma mineral fragments';parent.add(this.group);
    this.anchor=new THREE.Vector3();this.last=new THREE.Vector3(Infinity,0,0);this.eye={value:new THREE.Vector3()};this.count=0;this.clearing=null;
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.72,metalness:.06,flatShading:true,envMapIntensity:.08});
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
    for(const [mat,name] of [[material,'surface'],[depth,'depth']]){
      mat.onBeforeCompile=shader=>{
        shader.uniforms.fragmentEye=this.eye;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 fragmentEye;varying float fragmentRange;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\nfragmentRange=length(instanceMatrix[3].xyz-fragmentEye);');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float fragmentRange;')
          .replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nfloat cover=1.0-smoothstep(48.0,70.0,fragmentRange);if(cover<=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))))discard;');
      };
      mat.customProgramCacheKey=()=>`miasma-fragments-${name}-v1`;
    }
    this.material=material;this.depth=depth;
    this.meshes=Array.from({length:3},(_,i)=>{
      const geometry=i===1?new THREE.ConeGeometry(.32,.6,5,1):new THREE.IcosahedronGeometry(.5,i===2?1:0);
      if(i!==1)geometry.scale(1,.35+i*.06,.7);geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox.min.y,0);
      const mesh=new THREE.InstancedMesh(geometry,material,1600);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=depth;this.group.add(mesh);return mesh;
    });
  }
  update(position,origin,altitude,shipPosition){
    this.group.visible=altitude>=0&&altitude<70;if(!this.group.visible)return;
    const local=position.clone().sub(CENTER),normal=local.clone().normalize(),clearing=shipPosition?.toArray().join('/')??null;
    if(local.distanceToSquared(this.last)>36||clearing!==this.clearing){
      this.last.copy(local);this.anchor.copy(normal).multiplyScalar(MIASMA_RADIUS+miasmaSurface(...normal.toArray()).height);this.clearing=clearing;
      const counts=[0,0,0],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),yaw=new THREE.Quaternion(),scale=new THREE.Vector3(),color=new THREE.Color();
      const ship=shipPosition?.clone().sub(CENTER);
      scatterMinerals(normal,(d,col,row,a,b)=>{
        const surface=miasmaSurface(...d.toArray()),point=d.clone().multiplyScalar(MIASMA_RADIUS+surface.height);
        if(ship&&point.distanceToSquared(ship)<15**2)return;
        const variant=Math.floor(hash(col,row,8391)*3),index=counts[variant];if(index>=1600)return;
        const size=.12+hash(col,row,2131)**3*.42;
        q.setFromUnitVectors(UP,d);yaw.setFromAxisAngle(UP,b*TAU);q.multiply(yaw);scale.set(size,size,size*(.6+b*.8));
        matrix.compose(point.addScaledVector(d,-.015).sub(this.anchor),q,scale);
        const mesh=this.meshes[variant];mesh.setMatrixAt(index,matrix);
        color.fromArray(surface.color).multiplyScalar(variant===1?1.7:.55+b*.4);mesh.setColorAt(index,color);counts[variant]++;
      });
      this.count=counts.reduce((a,b)=>a+b,0);
      this.meshes.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;});
    }
    this.eye.value.copy(local).sub(this.anchor);this.group.position.copy(this.anchor).add(CENTER).sub(origin);
  }
  dispose(){for(const mesh of this.meshes){mesh.geometry.dispose();mesh.dispose();}this.material.dispose();this.depth.dispose();this.group.removeFromParent();}
}
