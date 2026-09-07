const srgb=value=>Math.round(Math.max(0,Math.min(1,value<=.0031308?value*12.92:1.055*value**(1/2.4)-.055))*255);

/** Sample the collision heightfield more finely than its mesh. A shared halo
 * provides metre-correct relief normals and slope-aware colour between vertices.
 * Absolute positions remain CPU doubles; only unit normals and colour reach GL. */
export function generatePatchSurface({face,level,ix,iy,radius,directionAt,sample,colorAt}) {
  const grid=64,width=grid+1,stride=grid+3,size=2/2**level,u0=-1+ix*size,v0=-1+iy*size;
  const samples=[];
  for(let y=-1;y<=grid+1;y++)for(let x=-1;x<=grid+1;x++){
    const direction=directionAt(face,u0+size*x/grid,v0+size*y/grid),value=sample(...direction);
    samples.push({direction,value,position:direction.map(v=>v*(radius+value.height))});
  }
  const at=(x,y)=>samples[(y+1)*stride+x+1];
  const color=new Uint8Array(width*width*4),normal=new Uint8Array(color.length);
  for(let y=0;y<=grid;y++)for(let x=0;x<=grid;x++){
    const {direction:d,value}=at(x,y),left=at(x-1,y).position,right=at(x+1,y).position,bottom=at(x,y-1).position,top=at(x,y+1).position;
    const a=right.map((v,i)=>v-left[i]),b=top.map((v,i)=>v-bottom[i]);
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot=n.reduce((sum,v,i)=>sum+v*d[i],0),length=Math.hypot(...n)*Math.sign(dot);
    const slope=Math.acos(Math.min(1,Math.abs(dot/length)));
    const rgb=colorAt?colorAt(...d,value.height,slope):value.color,k=(y*width+x)*4;
    for(let axis=0;axis<3;axis++){
      color[k+axis]=srgb(rgb[axis]);normal[k+axis]=Math.round((n[axis]/length*.5+.5)*255);
    }
    color[k+3]=normal[k+3]=255;
  }
  return {width,color,normal};
}
