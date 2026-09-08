import {CanvasTexture,SRGBColorSpace,Group,Mesh,PlaneGeometry,MeshStandardMaterial} from 'three';
import {printById} from './catalog.js';

// Exact paths from assets/brands/meridian-shipworks/emblem.svg; original accepted identity.
export const MERIDIAN_PATHS=[
 'M49 82A94 94 0 0 1 118 35L116 49A80 80 0 0 0 61 89Z',
 'M207 82A94 94 0 0 0 138 35L140 49A80 80 0 0 1 195 89Z',
 'M41 101A94 94 0 0 0 118 221L116 207A80 80 0 0 1 53 110Z',
 'M215 101A94 94 0 0 1 138 221L140 207A80 80 0 0 0 203 110Z',
 'M128 8L143 106L128 115L113 106Z','M16 66L128 119L240 66L128 158Z',
 'M73 124L102 146L113 195L73 171Z','M183 124L154 146L143 195L183 171Z','M118 158L128 167L138 158L128 248Z',
];
const textures=new Map();
const polygon=(ctx,points)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
function emblem(ctx,print,x,y,size){
 ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/256,size/256);ctx.fillStyle=print.ink;ctx.strokeStyle=print.ink;ctx.lineWidth=10;
 switch(print.symbol){
  case 'meridian':for(const path of MERIDIAN_PATHS)ctx.fill(new Path2D(path));break;
  case 'terraces':for(let i=0;i<4;i++)polygon(ctx,[[28+i*22,204-i*43],[228-i*22,204-i*43],[228-i*22,222-i*43],[28+i*22,222-i*43]]);break;
  case 'orbits':for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(128,128,108,30+i*29,-Math.PI/5,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.arc(128,128,16,0,Math.PI*2);ctx.fill();break;
  case 'furnace':polygon(ctx,[[128,10],[234,208],[22,208]]);ctx.fillStyle=print.paper;polygon(ctx,[[128,64],[190,184],[66,184]]);ctx.fillStyle=print.ink;ctx.fillRect(48,228,160,14);ctx.fillRect(112,130,32,40);break;
  case 'strata':for(let i=0;i<4;i++)polygon(ctx,[[24,40+i*48],[128,70+i*48],[232,25+i*48],[232,43+i*48],[128,88+i*48],[24,58+i*48]]);break;
  case 'skull':
   ctx.beginPath();ctx.arc(128,113,103,-Math.PI*.8,Math.PI*.8);ctx.stroke();
   polygon(ctx,[[72,65],[128,40],[184,65],[196,133],[164,166],[160,203],[96,203],[92,166],[60,133]]);
   ctx.fillStyle=print.paper;polygon(ctx,[[79,108],[119,121],[105,147],[79,138]]);polygon(ctx,[[177,108],[137,121],[151,147],[177,138]]);polygon(ctx,[[128,146],[142,171],[114,171]]);for(let i=0;i<3;i++)ctx.fillRect(108+i*18,184,7,23);break;
  case 'airlock':ctx.strokeRect(36,38,68,180);ctx.strokeRect(152,38,68,180);ctx.fillRect(75,120,14,30);ctx.fillRect(167,120,14,30);ctx.beginPath();ctx.moveTo(115,90);ctx.lineTo(140,128);ctx.lineTo(115,166);ctx.stroke();break;
  case 'helmet':ctx.beginPath();ctx.arc(128,116,90,Math.PI,Math.PI*2);ctx.lineTo(218,193);ctx.lineTo(181,230);ctx.lineTo(75,230);ctx.lineTo(38,193);ctx.closePath();ctx.stroke();ctx.strokeRect(62,112,132,62);ctx.fillRect(87,211,82,9);break;
 }
 ctx.restore();
}
function text(ctx,value,x,y,size,width){ctx.font=`700 ${size}px sans-serif`;ctx.fillText(value,x,y,width);}
export function drawFactionPrint(ctx,id){
 const p=printById(id);if(!p)throw Error('Unknown faction print');
 ctx.fillStyle=p.paper;ctx.fillRect(0,0,512,768);
 ctx.fillStyle=p.ink;ctx.fillRect(24,24,464,5);ctx.font='16px monospace';ctx.fillText('FIELD EDITION  /  01',28,55);ctx.textAlign='right';ctx.fillText('SA',484,55);ctx.textAlign='center';
 for(let i=0;i<2;i++)text(ctx,p.wordmark[i],256,116+i*55,i?38:54,464);
 emblem(ctx,p,256,354,245);
 ctx.strokeStyle=p.ink;ctx.lineWidth=2;ctx.strokeRect(23,215,466,279);ctx.fillStyle=p.ink;
 text(ctx,p.motto,256,552,25,452);ctx.font='15px monospace';ctx.fillText(p.detail,256,586,456);
 ctx.fillRect(28,622,456,2);ctx.font='17px monospace';ctx.fillText(p.id==='crimson'?'HONOUR THE PACT  /  RESPECT THE PERIMETER':p.id==='airlock'||p.id==='helmet'?'SAFETY NOTICE  /  EXTERIOR ACCESS':'SURFACE OPERATIONS  /  AUTHORIZED FACILITY',256,661,450);
 // Printed registration ticks and a restrained ink texture, deterministic on every device.
 for(let i=0;i<24;i++)ctx.fillRect(28+i*19,700,i%3===0?8:3,25);
 ctx.globalAlpha=.055;for(let i=0;i<900;i++){const x=(i*137+19)%512,y=(i*277+31)%768;ctx.fillRect(x,y,1,2);}ctx.globalAlpha=1;ctx.textAlign='left';
}
function retainPrint(id){
 let entry=textures.get(id);
 if(!entry){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;drawFactionPrint(canvas.getContext('2d'),id);const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.anisotropy=4;entry={map,refs:0};textures.set(id,entry);}
 entry.refs++;return entry.map;
}
function releasePrint(id){const entry=textures.get(id);if(entry&&--entry.refs===0){entry.map.dispose();textures.delete(id);}}
export const printResources=()=>({textures:textures.size,references:[...textures.values()].reduce((sum,e)=>sum+e.refs,0),estimatedBytes:[...textures.values()].length*512*768*4*4/3});

/** Rigid screen-printed enamel, 17 mm clear of the measured wall envelope on both faces.
 * No collider or light: this thin surface decoration cannot obstruct an entrance. */
export function createWallPrint(id){
 const print=printById(id);if(!print)return null;
 const group=new Group();group.name=`Faction print · ${print.label}`;
 const geometry=new PlaneGeometry(1.4,2.1),material=new MeshStandardMaterial({map:retainPrint(id),roughness:.88,metalness:.04});
 material.name='FactionEnamelPrint';
 for(const side of [-1,1]){const mesh=new Mesh(geometry,material);mesh.name=`Rigid print ${side>0?'front':'rear'}`;mesh.position.set(0,1.55,.181*side);mesh.rotation.y=side<0?Math.PI:0;mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);}
 return {group,geometry,material,id,dispose(){geometry.dispose();material.dispose();releasePrint(id);}};
}
export function drawPadIdentity(ctx,id){
 const print=printById(id);if(!print)return;
 ctx.save();ctx.fillStyle=print.paper;ctx.fillRect(235,100,554,118);ctx.fillStyle=print.ink;ctx.textAlign='left';text(ctx,print.wordmark.join(' '),345,151,31,413);ctx.font='18px monospace';ctx.fillText('KEEP LANDING AREA CLEAR',345,186,413);emblem(ctx,print,289,158,84);ctx.restore();
}
