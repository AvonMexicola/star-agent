import * as THREE from 'three';
import {ROVER_LAYOUT as L} from './rover-layout.js';

const C={background:'#09181c',text:'#d8dfd8',mint:'#b6efd1',amber:'#e9b274',rail:'#517880',dim:'#6e9192',well:'#172d33'};
const PANELS=[
  {name:'RoverDisplay',rect:[0,0,640,232],role:'drive'},
  {name:'RoverCuttersDisplay',rect:[656,0,304,256],role:'cutters'},
  {name:'RoverOreDisplay',rect:[0,256,304,256],role:'ore'},
  {name:'RoverDrivePad',rect:[320,256,192,240],role:'drivePad'},
  {name:'RoverMiningPad',rect:[528,256,192,240],role:'miningPad'},
];

/** Presentation only: capacities and endurance come from the playable rover. */
export function roverReadout(state){
  const charge=THREE.MathUtils.clamp(state.charge,0,1);
  return {
    speed:Math.abs(state.speed).toFixed(1),
    direction:state.speed<-.05?'Reverse':state.speed>.05?'Forward':'Stopped',
    mode:state.busy?'Cabin moving':!state.occupied?'Standby':state.aboard?'Carrier deck':state.blocked?'Brake held':'Surface drive',
    charge:Math.round(charge*100),seconds:Math.floor(charge*L.mining.continuousSeconds+1e-7),
    active:state.beaming===2,cutters:state.beaming,
    mass:state.mass.toFixed(2),capacity:L.cargo.capacityKg,
    fill:THREE.MathUtils.clamp(state.mass/L.cargo.capacityKg,0,1),
    binFull:state.mass>=L.cargo.capacityKg-.001,
    controls:state.occupied&&!state.busy?state.controls??{}:{},
  };
}

function round(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function label(ctx,text,x,y,size=18,color=C.text,weight=500){
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px "${size>=28?'Barlow Condensed':'DM Sans'}", sans-serif`;ctx.fillText(text,x,y);
}
function rail(ctx,title,width,height){
  ctx.fillStyle=C.background;ctx.fillRect(0,0,width,height);
  round(ctx,8,8,34,height-16,[22,0,0,22],C.rail);
  round(ctx,48,8,width-56,29,[0,15,15,0],C.mint);
  label(ctx,title,59,29,17,C.background,700);
  round(ctx,14,55,21,55,10,C.amber);
  round(ctx,14,height-59,21,43,[0,0,0,12],C.mint);
}
function gauge(ctx,x,y,width,fraction,color=C.mint){
  round(ctx,x,y,width,11,5,C.well);
  if(fraction>0)round(ctx,x,y,Math.max(3,width*Math.min(fraction,1)),11,5,color);
}
function pad(ctx,x,y,w,h,text,active){
  round(ctx,x,y,w,h,Math.min(h/2,14),active?C.amber:C.rail);
  ctx.textAlign='center';label(ctx,text,x+w/2,y+h/2+6,17,C.background,700);ctx.textAlign='left';
}
function paint(ctx,role,r,w,h){
  if(role==='drive'){
    rail(ctx,'BURROW M-04',w,h);
    label(ctx,r.speed,58,117,68,C.text,600);label(ctx,'m/s',244,115,25,C.dim);
    label(ctx,r.direction,59,153,23,C.mint);
    label(ctx,r.mode,59,192,20,r.mode==='Brake held'?C.amber:C.text);
    round(ctx,337,55,3,148,1,C.rail);
    label(ctx,'CUTTER CHARGE',360,77,17,C.dim);
    label(ctx,`${r.charge}%`,360,124,38,C.mint,600);
    gauge(ctx,360,140,246,r.charge);
    label(ctx,`${r.seconds} s cutting reserve`,360,184,20,C.text);
    return;
  }
  if(role==='cutters'){
    rail(ctx,'TWIN CUTTERS',w,h);
    for(let i=0;i<2;i++){
      const x=113+i*102;
      ctx.strokeStyle=r.active?C.amber:C.mint;ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(x,94,29,0,Math.PI*2);ctx.stroke();
      ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,94,15,0,Math.PI*2);ctx.stroke();
      label(ctx,i?'R':'L',x-6,100,16,C.text);
    }
    label(ctx,r.active?'Cutting':r.binFull?'Ore bin full':'Ready',60,158,27,r.active||r.binFull?C.amber:C.mint,600);
    label(ctx,`${r.cutters} / 2 beams active`,60,191,18,C.text);
    label(ctx,'RT / T   Hold to cut',60,230,17,C.dim);
    return;
  }
  if(role==='ore'){
    rail(ctx,'ORE BIN',w,h);
    label(ctx,r.mass,60,102,41,C.text,600);
    label(ctx,`/ ${r.capacity} kg`,60,138,23,C.dim);
    gauge(ctx,60,163,222,r.fill,r.binFull?C.amber:C.mint);
    label(ctx,r.binFull?'Storage full':'Mineral storage',60,204,18,r.binFull?C.amber:C.text);
    label(ctx,'View / I   Open bins',60,232,17,C.dim);
    return;
  }
  ctx.fillStyle=C.background;ctx.fillRect(0,0,w,h);
  round(ctx,9,8,w-18,26,13,C.mint);
  label(ctx,role==='drivePad'?'DRIVE':'MINING',20,27,17,C.background,700);
  if(role==='drivePad'){
    const a=r.controls;
    pad(ctx,64,48,65,42,'FWD',a.throttle>0);
    pad(ctx,10,100,76,42,'LEFT',a.steer<0);
    pad(ctx,106,100,76,42,'RIGHT',a.steer>0);
    pad(ctx,64,152,65,42,'REV',a.throttle<0);
    label(ctx,'LS / WASD',42,226,17,C.dim);
  }else{
    pad(ctx,16,54,w-32,78,r.active?'CUTTING':'CUTTERS',r.active);
    label(ctx,`${r.seconds} s reserve`,25,164,21,C.mint);
    pad(ctx,16,186,w-32,38,'BRAKE',Boolean(r.controls.brake));
  }
}

/** One shared atlas/material serves five fitted faces; telemetry redraws at 10 Hz. */
export function createRoverDisplayFaces(model,material){
  const meshes=[];
  for(const panel of PANELS){
    const anchor=model.getObjectByName(panel.name);
    if(!anchor)throw new Error(`Missing rover panel ${panel.name}`);
    const {displayWidth:width,displayHeight:height}=anchor.userData;
    if(!(width>0&&height>0&&width<1&&height<1))throw new Error(`Invalid rover panel size ${panel.name}`);
    const geometry=new THREE.PlaneGeometry(width,height),uv=geometry.attributes.uv;
    const [x,y,w,h]=panel.rect;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*w)/1024,1-(y+(1-uv.getY(i))*h)/512);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=panel.name+'Live';mesh.position.z=.023;
    anchor.add(mesh);meshes.push(mesh);
  }
  return meshes;
}

export function createRoverDisplays(model){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  const meshes=createRoverDisplayFaces(model,material);
  let elapsed=1,last=null;
  return {
    canvas,texture,meshes,
    get readout(){return last;},
    update(dt,state){
      elapsed+=dt;if(elapsed<.1)return;elapsed=0;
      last=roverReadout(state);
      ctx.fillStyle=C.background;ctx.fillRect(0,0,canvas.width,canvas.height);
      for(const panel of PANELS){
        const [x,y,w,h]=panel.rect;
        ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);
        paint(ctx,panel.role,last,w,h);ctx.restore();
      }
      texture.needsUpdate=true;
    },
    dispose(){for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}material.dispose();texture.dispose();},
  };
}
