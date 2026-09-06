/** Canonical equirectangular colour, normal and material maps in sampler coordinates. */
export function bakeSurfaceMaps(sample, radius, width = 1024, height = 512) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<2||width>2048||height>1024)throw new RangeError('Invalid surface map size');
  const data=new Uint8Array(width*height*4),color=new Uint8Array(data.length),normal=new Uint8Array(data.length),heights=new Float64Array(width*height);
  const srgb=v=>Math.round(Math.max(0,Math.min(1,v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055))*255);
  for(let row=0;row<height;row++){
    const lat=((row+.5)/height-.5)*Math.PI,y=Math.sin(lat),c=Math.cos(lat);
    for(let col=0;col<width;col++){
      const lon=((col+.5)/width-.5)*Math.PI*2,s=sample(c*Math.sin(lon),y,c*Math.cos(lon)),i=row*width+col;
      heights[i]=s.height;data.set([s.activity,s.fresh,s.sulphur,s.oxide].map(v=>Math.round(Math.min(1,v)*255)),i*4);
      color.set([...s.color.map(srgb),255],i*4);
    }
  }
  for(let row=0;row<height;row++){
    const lat=((row+.5)/height-.5)*Math.PI,sy=Math.sin(lat),cy=Math.cos(lat),south=Math.max(0,row-1),north=Math.min(height-1,row+1);
    for(let col=0;col<width;col++){
      const lon=((col+.5)/width-.5)*Math.PI*2,sl=Math.sin(lon),cl=Math.cos(lon),i=row*width+col;
      const dx=(heights[row*width+(col+1)%width]-heights[row*width+(col+width-1)%width])/Math.max(1,radius*cy*Math.PI*4/width);
      const dy=(heights[north*width+col]-heights[south*width+col])/(radius*Math.PI/height*(north-south));
      const n=[cy*sl-cl*dx+sy*sl*dy,sy-cy*dy,cy*cl+sl*dx+sy*cl*dy],l=Math.hypot(...n);
      normal.set([...n.map(v=>Math.round((v/l*.5+.5)*255)),255],i*4);
    }
  }
  return {width,height,data,color,normal};
}
