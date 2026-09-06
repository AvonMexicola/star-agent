import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOON_RADIUS, MOON_POSITION, moonSurface } from './moon-world.js';

const CENTER=new THREE.Vector3(...MOON_POSITION),UP=new THREE.Vector3(0,1,0),TAU=Math.PI*2;
export const STONE_LAYERS=Object.freeze([
  {name:'pebbles',spacing:.55,range:18,fade:12,buffer:21,movement:2,capacity:2400,seed:5137},
  {name:'rocks',spacing:3.6,range:100,fade:75,buffer:112,movement:8,capacity:1600,seed:7817},
]);
function hash(x,y,salt){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^salt;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}

/** Stable lunar rows, including complete polar caps and wrapped longitudes. */
export function scatterMoonStones(center,radius,spacing,seed,visit){
  const latitude=Math.asin(THREE.MathUtils.clamp(center.y,-1,1)),longitude=Math.atan2(center.x,center.z),step=spacing/MOON_RADIUS;
  const angular=(radius+spacing*2)/MOON_RADIUS;
  const first=Math.floor((latitude-angular)/step),last=Math.ceil((latitude+angular)/step);
  for(let row=first;row<=last;row++){
    const lat=(row+.5)*step;if(Math.abs(lat)>=Math.PI/2)continue;
    const columns=Math.max(1,Math.round(TAU*MOON_RADIUS*Math.cos(lat)/spacing)),columnStep=TAU/columns;
    const denominator=Math.cos(latitude)*Math.cos(lat);
    const extent=denominator<1e-13?Math.PI:Math.acos(THREE.MathUtils.clamp((Math.cos(angular)-Math.sin(latitude)*Math.sin(lat))/denominator,-1,1));
    const reach=Math.ceil(extent/columnStep)+2,originColumn=Math.floor((longitude+Math.PI)/columnStep);
    const count=Math.min(columns,reach*2+1);
    for(let i=0;i<count;i++){
      const column=((originColumn-reach+i)%columns+columns)%columns;
      const a=hash(column,row,seed),b=hash(column,row,seed+41);
      const phi=(row+.15+a*.7)*step,theta=(column+.15+b*.7)*columnStep-Math.PI;
      if(Math.abs(phi)>=Math.PI/2)continue;
      const x=Math.cos(phi)*Math.sin(theta),y=Math.sin(phi),z=Math.cos(phi)*Math.cos(theta);
      if(Math.hypot(x-center.x,y-center.y,z-center.z)*MOON_RADIUS>radius)continue;
      visit(x,y,z,column,row,a,b);
    }
  }
}

/** Chipped basalt, a flat shard and a blocky breccia fragment. */
export function stoneGeometry(variant){
  const source=new THREE.IcosahedronGeometry(.5,variant===2?2:1);
  source.deleteAttribute('normal');source.deleteAttribute('uv');
  const geometry=mergeVertices(source);source.dispose();
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const chip=.78+hash(Math.round(x*997),Math.round(y*991+z*431),variant*117+51)*.3;
    x*=chip*(variant===1?1.12:1);z*=chip*(variant===2?.72:1);
    // Low stones can be stepped over; larger terrain outcrops retain collision.
    y=(Math.min(y,.34+variant*.025)+.5)*chip*(variant===1?.25:.45);
    p.setXYZ(i,x,y,z);
  }
  geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox.min.y,0);
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  const colors=[];
  for(let i=0;i<p.count;i++){
    const shade=.58+.42*Math.min(1,p.getY(i)/Math.max(.001,geometry.boundingBox.max.y)*2.5);
    colors.push(shade,shade,shade);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
}

function stoneMaterial(grain,layer,camera){
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.96,metalness:0,envMapIntensity:0,flatShading:true});
  const apply=(shader,depth=false)=>{
    shader.uniforms.stoneEye=camera;
    shader.vertexShader='uniform vec3 stoneEye;varying float stoneDistance;varying vec3 stonePoint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      stoneDistance=length(instanceMatrix[3].xyz-stoneEye);
      stonePoint=position*vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));`);
    shader.fragmentShader='varying float stoneDistance;varying vec3 stonePoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      float coverage=1.0-smoothstep(${layer.fade.toFixed(1)},${layer.range.toFixed(1)},stoneDistance);
      if(coverage<=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))))discard;`);
    if(!depth){
      shader.uniforms.stoneGrain={value:grain};
      shader.fragmentShader='uniform sampler2D stoneGrain;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec3 weights=abs(normalize(cross(dFdx(stonePoint),dFdy(stonePoint))));weights/=max(.001,dot(weights,vec3(1.0)));
        vec3 g=texture2D(stoneGrain,stonePoint.yz*1.7).rgb*weights.x+texture2D(stoneGrain,stonePoint.xz*1.7).rgb*weights.y+texture2D(stoneGrain,stonePoint.xy*1.7).rgb*weights.z;
        diffuseColor.rgb*=.72+g.g*.48;
        float stoneRelief=g.g*.0015;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition),r0=cross(q1,normal),r1=cross(normal,q0);
        float determinant=dot(q0,r0);
        if(abs(determinant)>1e-10)normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(stoneRelief)*r0+dFdy(stoneRelief)*r1));`);
    }
  };
  material.onBeforeCompile=shader=>apply(shader);
  material.customProgramCacheKey=()=>`selene-stones-${layer.name}-v1`;
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  depth.onBeforeCompile=shader=>apply(shader,true);depth.customProgramCacheKey=()=>`selene-stones-depth-${layer.name}-v1`;
  return {material,depth};
}

export class MoonStones{
  constructor(scene,grain){
    this.layers=STONE_LAYERS.map(config=>{
      const group=new THREE.Group();group.name=`Selene surface ${config.name}`;scene.add(group);
      const camera={value:new THREE.Vector3()},materials=stoneMaterial(grain,config,camera);
      const meshes=Array.from({length:3},(_,variant)=>{
        const mesh=new THREE.InstancedMesh(stoneGeometry(variant),materials.material,config.capacity);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;
        mesh.receiveShadow=true;mesh.castShadow=config.name==='rocks';mesh.customDepthMaterial=materials.depth;
        group.add(mesh);return mesh;
      });
      return {config,group,camera,...materials,meshes,origin:new THREE.Vector3(),last:new THREE.Vector3(Infinity,Infinity,Infinity),cache:new Map(),clearing:null};
    });
    this.stats={visible:false,pebbles:0,rocks:0,rebuilds:0};
  }
  update(worldPosition,renderOrigin,shipPosition=null){
    const local=worldPosition.clone().sub(CENTER),radial=local.length();
    // Avoid sampling expensive lunar terrain from Aeon or orbit.
    const near=Math.abs(radial-MOON_RADIUS)<17000;
    const up=local.clone().normalize(),altitude=near?radial-MOON_RADIUS-moonSurface(...up.toArray()).height:Infinity;
    this.stats.visible=altitude>=-.5&&altitude<100;
    const ship=shipPosition?.clone().sub(CENTER),clearing=ship?.toArray().join('/')??null;
    for(const layer of this.layers){
      layer.group.visible=this.stats.visible&&altitude<layer.config.range;
      if(!layer.group.visible)continue;
      if(local.distanceToSquared(layer.last)>layer.config.movement**2||clearing!==layer.clearing){
        layer.last.copy(local);layer.origin.copy(up).multiplyScalar(MOON_RADIUS+moonSurface(...up.toArray()).height);
        this.rebuild(layer,up,ship);layer.clearing=clearing;
      }
      layer.camera.value.copy(local).sub(layer.origin);
      layer.group.position.copy(layer.origin).add(CENTER).sub(renderOrigin);
    }
  }
  rebuild(layer,center,ship){
    const {config}=layer,cache=new Map(),counts=[0,0,0],matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),yaw=new THREE.Quaternion();
    const point=new THREE.Vector3(),normal=new THREE.Vector3(),east=new THREE.Vector3(),north=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color();
    const direction=new THREE.Vector3();
    scatterMoonStones(center,config.buffer,config.spacing,config.seed,(x,y,z,col,row,a,b)=>{
      const patch=.5+.5*Math.sin((x*.18+y*.13)*MOON_RADIUS)*Math.sin((z*.15-y*.21)*MOON_RADIUS);
      if(hash(col,row,config.seed+121)>.32+patch*.42)return;
      const variant=Math.min(2,Math.floor(hash(col,row,config.seed+191)*3));
      if(counts[variant]>=config.capacity)return;
      const key=`${col}/${row}`;let record=layer.cache.get(key);
      if(!record){
        const sample=moonSurface(x,y,z),size=config.name==='pebbles'?.035+a*a*.14:.22+a*a*.65;
        direction.set(x,y,z);east.crossVectors(Math.abs(y)<.9?UP:new THREE.Vector3(1,0,0),direction).normalize();north.crossVectors(direction,east);
        const h=(axis,sign)=>{const n=direction.clone().addScaledVector(axis,sign*.25/MOON_RADIUS).normalize();return moonSurface(...n.toArray()).height;};
        normal.copy(direction).addScaledVector(east,-(h(east,1)-h(east,-1))/.5).addScaledVector(north,-(h(north,1)-h(north,-1))/.5).normalize();
        record={x,y,z,height:sample.height,size,normal:normal.toArray(),color:sample.color,frost:sample.frost,variant,a,b};
      }
      cache.set(key,record);
      point.set(x,y,z).multiplyScalar(MOON_RADIUS+record.height);
      if(ship&&point.distanceToSquared(ship)<(13+record.size)**2)return;
      point.addScaledVector(direction.set(x,y,z),-record.size*.045).sub(layer.origin);
      normal.fromArray(record.normal);rotation.setFromUnitVectors(UP,normal);yaw.setFromAxisAngle(UP,b*TAU);rotation.multiply(yaw);
      scale.set(record.size,record.size,record.size*(.75+b*.5));matrix.compose(point,rotation,scale);
      const mesh=layer.meshes[variant],index=counts[variant]++;mesh.setMatrixAt(index,matrix);
      const shade=.7+b*.6;
      // Local frost and mineral colours follow moonSurface; basalt fragments remain dark.
      color.fromArray(record.color).lerp(new THREE.Color(.14,.145,.15),.42).multiplyScalar(shade*(variant===0?.7:1));
      mesh.setColorAt(index,color);
    });
    layer.cache=cache;
    for(let i=0;i<3;i++){const mesh=layer.meshes[i];mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    this.stats[config.name]=counts.reduce((a,b)=>a+b,0);this.stats.rebuilds++;
  }
  dispose(){for(const layer of this.layers){for(const mesh of layer.meshes){mesh.geometry.dispose();mesh.dispose();}layer.material.dispose();layer.depth.dispose();layer.group.removeFromParent();}}
}
