import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MIASMA_POSITION, MIASMA_RADIUS, miasmaSurface } from './miasma-world.js';
import { scatterMinerals } from './mineral-fragments.js';

const CENTER=new THREE.Vector3(...MIASMA_POSITION),UP=new THREE.Vector3(0,1,0);
export const FLORA_SPECIES=Object.freeze(['alien-tree-bulb','alien-tree-spire','giant-mushroom-cluster','puffball-plant']);
const HEIGHTS=[12,18,4,.9],RANGES=[140,140,105,48],CAPACITIES=[128,96,192,96];
const hash=(x,y,s)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^s;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
/** Canonical, stable colonies: large silhouettes among mineral-rich ground, with
 * smaller fungi and pods between them. Ship clearance includes the model canopy. */
export function floraCandidates(up,shipLocal=null){
  const candidates=[];
  scatterMinerals(up,(d,col,row,a,b)=>{
    const surface=miasmaSurface(...d.toArray()),colony=.5+.5*Math.sin(d.x*MIASMA_RADIUS/85+Math.sin(d.z*MIASMA_RADIUS/110))*Math.sin(d.y*MIASMA_RADIUS/97);
    if(hash(col,row,6101)>.28+colony*.6)return;
    const pick=hash(col,row,7311),species=pick<.18?0:pick<.30?1:pick<.64?2:3;
    const size=(species<2?.55:.75)+hash(col,row,2713)*.5,point=d.clone().multiplyScalar(MIASMA_RADIUS+surface.height);
    if(d.distanceTo(up)*MIASMA_RADIUS>RANGES[species]+8)return;
    if(shipLocal&&point.distanceTo(shipLocal)<22+(species<2?6:2)*size)return;
    const east=new THREE.Vector3().crossVectors(Math.abs(d.y)<.9?UP:new THREE.Vector3(1,0,0),d).normalize(),north=new THREE.Vector3().crossVectors(d,east);
    const height=(axis,sign)=>miasmaSurface(...d.clone().addScaledVector(axis,sign/MIASMA_RADIUS).normalize().toArray()).height;
    const dx=(height(east,1)-height(east,-1))*.5,dy=(height(north,1)-height(north,-1))*.5;
    if(Math.hypot(dx,dy)>(species<2?.18:.4))return;
    const normal=d.clone().addScaledVector(east,-dx).addScaledVector(north,-dy).normalize();
    candidates.push({id:`${col}/${row}`,species,size,point:point.toArray(),normal:normal.toArray(),yaw:b*Math.PI*2,phase:a*100});
  },{spacing:11,range:148,density:.68,seed:9137});
  return candidates;
}
function animateMaterial(material,eye,time,height,range,depth=false){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{floraEye:eye,floraTime:time});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform vec3 floraEye;uniform float floraTime;attribute float floraPhase;varying float floraRange;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        floraRange=length(instanceMatrix[3].xyz-floraEye);
        float bend=pow(clamp(position.y/${height.toFixed(1)},0.0,1.0),2.0);
        transformed.x+=sin(floraTime*.85+floraPhase+position.y*.35)*bend*${(height*.012).toFixed(4)};
        transformed.z+=cos(floraTime*.63+floraPhase)*bend*${(height*.008).toFixed(4)};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float floraRange;')
      .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        float coverage=1.0-smoothstep(${(range*.76).toFixed(1)},${range.toFixed(1)},floraRange);
        if(coverage<=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))))discard;`);
    if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      // Preserve the authored textures; only their mint-green details luminesce.
      float mint=smoothstep(.015,.12,diffuseColor.g-max(diffuseColor.r*.94,diffuseColor.b*.94));
      totalEmissiveRadiance+=diffuseColor.rgb*mint*.32;`);
  };
  material.customProgramCacheKey=()=>`miasma-flora-${height}-${range}-${depth}-v1`;
}
export class MiasmaFlora {
  constructor(parent){
    this.group=new THREE.Group();this.group.name='Miasma alien flora';this.group.visible=false;parent.add(this.group);
    this.eye={value:new THREE.Vector3()};this.time={value:0};this.anchor=new THREE.Vector3();this.last=new THREE.Vector3(Infinity,0,0);
    this.assets=[];this.loading=false;this.loaded=false;this.errors=[];this.counts=[0,0,0,0];this.disposed=false;this.clearing=null;
  }
  async load(){
    if(this.loading||this.disposed)return;this.loading=true;const loader=new GLTFLoader();
    await Promise.all(FLORA_SPECIES.map(async(name,species)=>{
      try{
        const {scene}=await loader.loadAsync(`/models/props/${name}.glb`);scene.updateMatrixWorld(true);
        scene.traverse(source=>{if(!source.isMesh)return;
          const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),material=source.material.clone();
          geometry.setAttribute('floraPhase',new THREE.InstancedBufferAttribute(new Float32Array(CAPACITIES[species]),1));
          material.envMapIntensity=.08;material.roughness=Math.max(.6,material.roughness);animateMaterial(material,this.eye,this.time,HEIGHTS[species],RANGES[species]);
          const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:material.side});animateMaterial(depth,this.eye,this.time,HEIGHTS[species],RANGES[species],true);
          const mesh=new THREE.InstancedMesh(geometry,material,CAPACITIES[species]);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=depth;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.name=name;this.assets.push({species,mesh,depth});
          if(!this.disposed)this.group.add(mesh);
          source.geometry.dispose();source.material.dispose();
        });
      }catch(error){this.errors.push(`${name}: ${String(error)}`);console.warn(`Miasma flora unavailable: ${name}`,error);}
    }));
    this.loaded=true;this.last.set(Infinity,0,0);if(this.disposed)this.release();
  }
  update(position,origin,altitude,elapsed,shipPosition){
    this.time.value=elapsed;this.group.visible=altitude>=0&&altitude<145;
    if(altitude<2500&&!this.loading)this.load();
    if(!this.group.visible||!this.loaded)return;
    const local=position.clone().sub(CENTER),up=local.clone().normalize(),clearing=shipPosition?.toArray().join('/')??null;
    if(local.distanceToSquared(this.last)>36||clearing!==this.clearing){
      this.last.copy(local);this.clearing=clearing;this.anchor.copy(up).multiplyScalar(MIASMA_RADIUS+miasmaSurface(...up.toArray()).height);this.counts.fill(0);
      const q=new THREE.Quaternion(),yaw=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4();
      for(const plant of floraCandidates(up,shipPosition?.clone().sub(CENTER))){
        const i=this.counts[plant.species];if(i>=CAPACITIES[plant.species])continue;
        q.setFromUnitVectors(UP,new THREE.Vector3(...plant.normal));q.multiply(yaw.setFromAxisAngle(UP,plant.yaw));scale.setScalar(plant.size);
        const point=new THREE.Vector3(...plant.point).addScaledVector(new THREE.Vector3(...plant.normal),-.06).sub(this.anchor);matrix.compose(point,q,scale);
        for(const asset of this.assets)if(asset.species===plant.species){asset.mesh.setMatrixAt(i,matrix);asset.mesh.geometry.attributes.floraPhase.setX(i,plant.phase);}
        this.counts[plant.species]++;
      }
      for(const {species,mesh} of this.assets){mesh.count=this.counts[species];mesh.instanceMatrix.needsUpdate=true;mesh.geometry.attributes.floraPhase.needsUpdate=true;}
    }
    this.eye.value.copy(local).sub(this.anchor);this.group.position.copy(this.anchor).add(CENTER).sub(origin);
  }
  get state(){return {loaded:this.loaded,visible:this.group.visible,counts:[...this.counts],errors:[...this.errors]};}
  release(){const textures=new Set();for(const {mesh,depth} of this.assets){for(const value of Object.values(mesh.material))if(value?.isTexture)textures.add(value);mesh.geometry.dispose();mesh.material.dispose();depth.dispose();mesh.dispose();}for(const texture of textures)texture.dispose();this.assets=[];this.group.clear();}
  dispose(){this.disposed=true;this.release();this.group.removeFromParent();}
}
