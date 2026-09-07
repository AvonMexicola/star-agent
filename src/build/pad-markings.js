import {CanvasTexture,SRGBColorSpace} from 'three';
const textures=new Map();
/** Original painted landing graphic, drawn in metres so H/lines keep their aspect. */
export function padMarkingTexture(def){
 const [w,l]=def.footprint,key=`${w}/${l}/${def.padSize}`;if(textures.has(key))return textures.get(key);
 const canvas=document.createElement('canvas');canvas.width=Math.round(1024*w/l);canvas.height=1024;const ctx=canvas.getContext('2d'),scale=1024/l;
 ctx.fillStyle='#333d42';ctx.fillRect(0,0,canvas.width,canvas.height);
 // Fine deterministic aggregate; bounded, shared once for each pad size.
 let seed=7183;for(let i=0;i<18000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%canvas.width;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%canvas.height;ctx.fillStyle=i%2?'#3a4449':'#2b353a';ctx.fillRect(x,y,1+(i%3),1);}
 ctx.scale(scale,scale);ctx.translate(w/2,l/2);ctx.strokeStyle='#f3f4ec';ctx.fillStyle='#f3f4ec';ctx.lineWidth=.18;
 const x=w/2-.85,z=l/2-.85,gap=2.3;
 for(const sx of [-1,1])for(const sz of [-1,1]){ctx.beginPath();ctx.moveTo(sx*gap,sz*z);ctx.lineTo(sx*x,sz*z);ctx.lineTo(sx*x,sz*gap);ctx.stroke();}
 const ring=Math.min(w,l)*.30;ctx.lineWidth=.16;ctx.beginPath();for(let i=0;i<=8;i++){const a=Math.PI/8+i*Math.PI/4,px=Math.cos(a)*ring,pz=Math.sin(a)*ring;if(i)ctx.lineTo(px,pz);else ctx.moveTo(px,pz);}ctx.closePath();ctx.stroke();
 const h=Math.min(w,l)*.34,hw=h*.7,bar=h*.15;ctx.fillRect(-hw/2,-h/2,bar,h);ctx.fillRect(hw/2-bar,-h/2,bar,h);ctx.fillRect(-hw/2,-bar/2,hw,bar);
 for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(-.8,sign*(l/2-1.15));ctx.lineTo(0,sign*(l/2-2));ctx.lineTo(.8,sign*(l/2-1.15));ctx.stroke();}
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold .65px monospace';ctx.fillText(`${def.padSize} / ${def.padSize==='S'?'NOMAD':def.padSize==='M'?'ATLAS':'HEAVY'}`,0,l/2-3);ctx.font='.42px monospace';ctx.fillText(`${w} × ${l} M`,0,-l/2+2.8);
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;textures.set(key,texture);return texture;
}
