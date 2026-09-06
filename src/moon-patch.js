import { cubeDirection, MOON_RADIUS, moonSurface } from './world.js';
import { validateTerrainGrid } from './terrain-resolution.js';
import { generatePatchSurface } from './patch-surface-data.js';

export const MOON_GRID=16;
const normalized=(x,y,z)=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};

/** Body-local patch offsets are computed in doubles before conversion to float.
 * A one-cell halo shares height samples between vertices and their normals. */
export function generateMoonPatch({face,level,ix,iy,grid=MOON_GRID,surfaceDetail=false}) {
  validateTerrainGrid(grid);
  const size=2/2**level,u0=-1+ix*size,v0=-1+iy*size;
  const d=cubeDirection(face,u0+size/2,v0+size/2),centerRadius=MOON_RADIUS+moonSurface(...d).height,center=d.map(v=>v*centerRadius);
  const count=(grid+1)**2+4*(grid+1),positions=new Float32Array(count*3),normals=new Float32Array(count*3),directions=new Float32Array(count*3),points=new Float32Array(count*3),colors=new Float32Array(count*3),surface=new Float32Array(count*2);
  const stride=grid+3,samples=[];
  for(let y=-1;y<=grid+1;y++)for(let x=-1;x<=grid+1;x++){
    const d=cubeDirection(face,u0+size*x/grid,v0+size*y/grid),sample=moonSurface(...d);
    samples.push({d,sample,p:d.map(v=>v*(MOON_RADIUS+sample.height)),normal:null});
  }
  const at=(x,y)=>samples[(y+1)*stride+x+1];
  const write=(index,x,y,skirt=0)=>{
    const data=at(x,y),{d,sample,p}=data;
    if(!data.normal){
      const left=at(x-1,y).p,right=at(x+1,y).p,bottom=at(x,y-1).p,top=at(x,y+1).p;
      const a=right.map((v,i)=>v-left[i]),b=top.map((v,i)=>v-bottom[i]);
      let normal=normalized(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]);
      if(normal.reduce((sum,v,i)=>sum+v*d[i],0)<0)normal=normal.map(v=>-v);
      data.normal=normal;
    }
    surface[index*2]=sample.height;surface[index*2+1]=sample.frost;
    for(let axis=0;axis<3;axis++){
      const value=p[axis]-d[axis]*skirt-center[axis],k=index*3+axis;
      colors[k]=sample.color[axis];positions[k]=value;directions[k]=d[axis];normals[k]=data.normal[axis];
      points[k]=value+((center[axis]%256)+256)%256;
    }
  };
  for(let y=0;y<=grid;y++)for(let x=0;x<=grid;x++)write(y*(grid+1)+x,x,y);
  const indices=[];
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const a=y*(grid+1)+x,b=a+1,c=a+grid+1;indices.push(a,b,c,b,c+1,c);}
  const edges=[Array.from({length:grid+1},(_,i)=>i),Array.from({length:grid+1},(_,i)=>i*(grid+1)+grid),Array.from({length:grid+1},(_,i)=>grid*(grid+1)+grid-i),Array.from({length:grid+1},(_,i)=>(grid-i)*(grid+1))];
  let next=(grid+1)**2;
  for(const edge of edges){const start=next;for(const index of edge)write(next++,index%(grid+1),Math.floor(index/(grid+1)),Math.max(.15,size*MOON_RADIUS*.18));for(let i=0;i<grid;i++)indices.push(edge[i],start+i,edge[i+1],edge[i+1],start+i,start+i+1);}
  const field=surfaceDetail?generatePatchSurface({face,level,ix,iy,radius:MOON_RADIUS,directionAt:cubeDirection,sample:moonSurface}):null;
  return {center,positions,normals,directions,points,colors,surface,indices:new Uint16Array(indices),field};
}
