import * as THREE from 'three';
import { cubeDirection, MOON_RADIUS, MOON_POSITION, moonSurface } from './world.js';

export const MOON_GRID=16,MOON_MAX_LEVEL=17;
const normalized=(x,y,z)=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};

/** Body-local patch offsets are computed in doubles before conversion to float. */
export function generateMoonPatch({face,level,ix,iy}) {
  const size=2/2**level,u0=-1+ix*size,v0=-1+iy*size;
  const d=cubeDirection(face,u0+size/2,v0+size/2),centerRadius=MOON_RADIUS+moonSurface(...d).height,center=d.map(v=>v*centerRadius);
  const count=(MOON_GRID+1)**2+4*(MOON_GRID+1),positions=new Float32Array(count*3),normals=new Float32Array(count*3),directions=new Float32Array(count*3),points=new Float32Array(count*3);
  const rockReliefs=new Float32Array(count);
  const step=Math.max(.3,Math.min(120,size*MOON_RADIUS/MOON_GRID*.35)),epsilon=step/MOON_RADIUS;
  const write=(index,u,v,skirt=0)=>{
    const d=cubeDirection(face,u,v),sample=moonSurface(...d),height=sample.height;
    rockReliefs[index]=sample.rockRelief;
    let tangent=normalized(d[2],0,-d[0]);if(!Number.isFinite(tangent[0]))tangent=[1,0,0];
    const b=[d[1]*tangent[2]-d[2]*tangent[1],d[2]*tangent[0]-d[0]*tangent[2],d[0]*tangent[1]-d[1]*tangent[0]];
    const slope=axis=>{
      const plus=normalized(...d.map((v,i)=>v+axis[i]*epsilon)),minus=normalized(...d.map((v,i)=>v-axis[i]*epsilon));
      return (moonSurface(...plus).height-moonSurface(...minus).height)/(2*step);
    };
    const a=slope(tangent),c=slope(b),normal=normalized(...d.map((v,i)=>v-tangent[i]*a-b[i]*c));
    for(let axis=0;axis<3;axis++){
      const value=d[axis]*(MOON_RADIUS+height-skirt)-center[axis],k=index*3+axis;
      positions[k]=value;directions[k]=d[axis];normals[k]=normal[axis];
      points[k]=value+((center[axis]%256)+256)%256;
    }
  };
  for(let y=0;y<=MOON_GRID;y++)for(let x=0;x<=MOON_GRID;x++)write(y*(MOON_GRID+1)+x,u0+size*x/MOON_GRID,v0+size*y/MOON_GRID);
  const indices=[];
  for(let y=0;y<MOON_GRID;y++)for(let x=0;x<MOON_GRID;x++){const a=y*(MOON_GRID+1)+x,b=a+1,c=a+MOON_GRID+1;indices.push(a,b,c,b,c+1,c);}
  const edges=[Array.from({length:MOON_GRID+1},(_,i)=>i),Array.from({length:MOON_GRID+1},(_,i)=>i*(MOON_GRID+1)+MOON_GRID),Array.from({length:MOON_GRID+1},(_,i)=>MOON_GRID*(MOON_GRID+1)+MOON_GRID-i),Array.from({length:MOON_GRID+1},(_,i)=>(MOON_GRID-i)*(MOON_GRID+1))];
  let next=(MOON_GRID+1)**2;
  for(const edge of edges){const start=next;for(const index of edge)write(next++,u0+size*(index%(MOON_GRID+1))/MOON_GRID,v0+size*Math.floor(index/(MOON_GRID+1))/MOON_GRID,Math.max(.15,size*MOON_RADIUS*.04));for(let i=0;i<MOON_GRID;i++)indices.push(edge[i],start+i,edge[i+1],edge[i+1],start+i,start+i+1);}
  return {center,positions,normals,directions,points,rockReliefs,indices:new Uint16Array(indices)};
}

export class MoonTerrain {
  constructor(scene,material){
    this.scene=scene;this.material=material;this.nodes=new Map();this.origin=new THREE.Vector3();this.local=new THREE.Vector3();this.visibleCount=0;this.maxLevel=0;
    this.roots=Array.from({length:6},(_,face)=>this.node(face,0,0,0));
    for(const node of this.roots)this.build(node);
  }
  node(face,level,ix,iy){
    const key=`${face}/${level}/${ix}/${iy}`;if(this.nodes.has(key))return this.nodes.get(key);
    const size=2/2**level,d=cubeDirection(face,-1+(ix+.5)*size,-1+(iy+.5)*size),normal=new THREE.Vector3(...d);
    const node={key,face,level,ix,iy,size,normal,surface:normal.clone().multiplyScalar(MOON_RADIUS+moonSurface(...d).height),children:null,mesh:null,lastUsed:performance.now()};
    this.nodes.set(key,node);return node;
  }
  build(node){
    if(node.mesh)return;
    const data=generateMoonPatch(node),geometry=new THREE.BufferGeometry();
    for(const [name,values] of [['position',data.positions],['normal',data.normals],['moonDirection',data.directions],['moonPoint',data.points]])geometry.setAttribute(name,new THREE.BufferAttribute(values,3));
    geometry.setAttribute('rockRelief',new THREE.BufferAttribute(data.rockReliefs,1));
    geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(data.positions.length/3*2),2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
    node.center=new THREE.Vector3(...data.center);node.mesh=new THREE.Mesh(geometry,this.material);node.mesh.name=`Selene terrain ${node.key}`;
    node.mesh.receiveShadow=true;node.mesh.castShadow=node.level>=12;node.mesh.visible=false;this.scene.add(node.mesh);
  }
  update(worldPosition,origin){
    this.origin.copy(origin);this.local.copy(worldPosition).sub(new THREE.Vector3(...MOON_POSITION));
    const radius=this.local.length(),radial=this.local.clone().normalize(),now=performance.now();
    for(const node of this.nodes.values())if(node.mesh)node.mesh.visible=false;
    let budget=8;this.visibleCount=0;this.maxLevel=0;
    const distance=node=>node.surface.distanceTo(this.local);
    const visit=node=>{
      if(node.level>1&&node.normal.dot(radial)<MOON_RADIUS/Math.max(MOON_RADIUS,radius)-node.size*1.5-.035)return;
      node.lastUsed=now;
      const split=node.level<2||(node.level<MOON_MAX_LEVEL&&distance(node)<node.size*MOON_RADIUS*1.8);
      if(split){
        if(!node.children)node.children=[this.node(node.face,node.level+1,node.ix*2,node.iy*2),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2),this.node(node.face,node.level+1,node.ix*2,node.iy*2+1),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2+1)];
        for(const child of [...node.children].sort((a,b)=>distance(a)-distance(b)))if(!child.mesh&&budget>0){this.build(child);budget--;}
        // A parent remains visible until every child has geometry, including
        // during a rapid descent or a cache miss after returning from Aeon.
        if(node.children.every(child=>child.mesh)){for(const child of [...node.children].sort((a,b)=>distance(a)-distance(b)))visit(child);return;}
      }
      if(node.mesh){node.mesh.visible=true;this.visibleCount++;this.maxLevel=Math.max(this.maxLevel,node.level);}
    };
    for(const root of [...this.roots].sort((a,b)=>distance(a)-distance(b)))visit(root);
    for(const node of this.nodes.values())if(node.mesh)node.mesh.position.copy(node.center).add(new THREE.Vector3(...MOON_POSITION)).sub(origin);
    if(this.nodes.size>900)for(const node of this.nodes.values()){
      if(node.level<=2||node.mesh?.visible||now-node.lastUsed<8000)continue;
      if(node.mesh){this.scene.remove(node.mesh);node.mesh.geometry.dispose();node.mesh=null;}
      // Keep cheap nodes so retained child references cannot point at orphaned
      // duplicate meshes after revisiting an evicted region.
    }
  }
  get ready(){return this.maxLevel>=2;}
  dispose(){for(const node of this.nodes.values())if(node.mesh){this.scene.remove(node.mesh);node.mesh.geometry.dispose();}this.nodes.clear();}
}
