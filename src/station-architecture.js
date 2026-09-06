import * as THREE from 'three';
import { createConcourse } from './station-concourse.js';
import { createPressureElevator } from './station-elevator.js';
import { stationFinishPalette } from './station-finish-palette.js';

export const POD_LAYOUT = Object.freeze(Array.from({length:20},(_,i)=>Object.freeze({
  id:i+1, offset:[((i%10)-4.5)*190,0,i<10?-520:520], yaw:i<10?0:Math.PI,
})));
export const RING_RADIUS = 1450;
export const RING_SPEED = .00045;
const boxGeometry = new THREE.BoxGeometry(1,1,1);
const steel = new THREE.MeshStandardMaterial({color:0x879699,metalness:.65,roughness:.48});
const dark = new THREE.MeshStandardMaterial({color:0x182b33,metalness:.65,roughness:.55});
const ochre = new THREE.MeshStandardMaterial({color:0xb18342,metalness:.5,roughness:.48});
const glow = new THREE.MeshStandardMaterial({color:0xabc8c1,emissive:0x9bdcca,emissiveIntensity:2});

let ringFinish;
function ringMaterials(){
  if(ringFinish)return ringFinish;
  const palette=stationFinishPalette(),paint=new THREE.Color(palette.dark),metal=new THREE.Color(palette.steel);
  // Painted habitat cladding needs diffuse response in the station's ambient
  // light. A dark, mostly metallic finish loses its surface to the black sky.
  ringFinish={
    panel:new THREE.MeshStandardMaterial({color:paint.clone().lerp(metal,.36),metalness:.08,roughness:.8,envMapIntensity:.4}),
    frame:new THREE.MeshStandardMaterial({color:metal.clone().lerp(paint,.15),metalness:.28,roughness:.62,envMapIntensity:.4}),
    spoke:new THREE.MeshStandardMaterial({color:paint.clone().lerp(metal,.48),metalness:.18,roughness:.72,envMapIntensity:.4}),
    rib:new THREE.MeshStandardMaterial({color:palette.ochre,metalness:.12,roughness:.72,envMapIntensity:.4}),
  };
  return ringFinish;
}

function ringEnvironment(renderer,scene,camera,geometry,material){
  // With an implicit scene map Three replaces material.envMapIntensity with
  // the near-zero space environment intensity. Reuse the existing PMREM
  // explicitly to retain a readable reflected/diffuse planetary fill here.
  // This remains directional scene lighting, never emissive paint, and adds
  // neither a texture nor a light. Keep the scene's changing planet-up frame.
  if(material.envMap!==scene.environment){material.envMap=scene.environment;material.needsUpdate=true;}
  material.envMapRotation.copy(scene.environmentRotation);
}

export function block(parent,size,position,material=steel,name='Structure'){
  const mesh=new THREE.Mesh(boxGeometry,material);mesh.name=name;mesh.scale.set(...size);mesh.position.set(...position);parent.add(mesh);return mesh;
}
const signMaterials=new Map();
export function sign(parent,text,position,width=4,height=1,yaw=Math.PI){
  // Keep the longest texture axis in budget and share repeated cabin graphics.
  // A small call button does not need a separate megapixel texture per berth.
  if(typeof document==='undefined')return null;
  const palette=stationFinishPalette(),extent=Math.max(width,height);
  const pixels=Math.min(1024,Math.max(128,Math.ceil(extent*256)));
  const canvasWidth=Math.max(1,Math.round(pixels*width/extent));
  const canvasHeight=Math.max(1,Math.round(pixels*height/extent));
  const key=JSON.stringify([text,canvasWidth,canvasHeight,palette.petrol,palette.mint,palette.ivory]);
  let material=signMaterials.get(key);
  if(!material){
    const canvas=document.createElement('canvas');canvas.width=canvasWidth;canvas.height=canvasHeight;
    const ctx=canvas.getContext('2d');
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    function draw(){
      ctx.fillStyle=palette.petrol;ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle=palette.mint;ctx.fillRect(0,0,Math.max(1,canvas.width*.012),canvas.height);
      ctx.fillStyle=palette.ivory;ctx.textAlign='center';ctx.textBaseline='middle';
      text.split('\n').forEach((line,i,lines)=>{
        let size=Math.min(canvas.height*.64/lines.length,150);
        ctx.font=`600 ${size}px "Space Mono", monospace`;
        size*=Math.min(1,canvas.width*.92/Math.max(1,ctx.measureText(line).width));
        ctx.font=`600 ${size}px "Space Mono", monospace`;
        ctx.fillText(line,canvas.width/2,canvas.height*(i+.5)/lines.length);
      });
      texture.needsUpdate=true;
    }
    draw();document.fonts?.ready.then(draw);
    material=new THREE.MeshBasicMaterial({map:texture});signMaterials.set(key,material);
  }
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
  plane.name='Sign_'+text.split('\n')[0];plane.position.set(...position);plane.rotation.y=yaw;parent.add(plane);return plane;
}

export function createExterior(){
  const group=new THREE.Group();group.name='Aeon orbital port';
  const hubShell=block(group,[44,9,38],[0,-3.5,0],steel,'HubShellDetail');
  // Long spine and fixed passenger bridges; rotating structures sit outside the bays.
  block(group,[2280,38,44],[0,-35,0],dark);
  block(group,[280,95,160],[0,-90,0],dark);
  for(const x of [-95,95]){
    block(group,[72,72,220],[x,-80,0],steel);
    for(const z of [-90,-60,-30,0,30,60,90])block(group,[74,7,10],[x,-39,z],ochre);
  }
  for(const pod of POD_LAYOUT){
    block(group,[14,16,480],[pod.offset[0],-23,pod.offset[2]/2],steel);
    block(group,[5,3,470],[pod.offset[0],-13,pod.offset[2]/2],ochre);
  }
  const rings=[],finish=ringMaterials();
  for(const [i,x] of [-1110,1110].entries()){
    const ring=new THREE.Group();ring.position.x=x;group.add(ring);rings.push(ring);
    const torus=new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS,26,8,192),finish.frame);
    torus.rotation.y=Math.PI/2;ring.add(torus);
    for(const dx of [-37,37]){
      const rail=new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS,3,6,192),finish.rib);rail.rotation.y=Math.PI/2;rail.position.x=dx;ring.add(rail);
    }
    const panels=new THREE.InstancedMesh(boxGeometry,finish.panel,120),windows=new THREE.InstancedMesh(boxGeometry,glow,120);
    const dummy=new THREE.Object3D(),tint=new THREE.Color();
    for(let k=0;k<120;k++){
      const a=k*Math.PI*2/120;
      dummy.position.set(0,Math.cos(a)*RING_RADIUS,Math.sin(a)*RING_RADIUS);dummy.rotation.set(a,0,0);dummy.scale.set(80,52,58);dummy.updateMatrix();panels.setMatrixAt(k,dummy.matrix);
      // Four-panel maintenance sections vary only in paint value, retaining one
      // instanced draw and the original physical panels and collision bounds.
      const value=[1,.84,1.26][Math.floor(k/4)%3];panels.setColorAt(k,tint.setRGB(value,value,value));
      dummy.position.x=i===0?41:-41;dummy.scale.set(1,8,42);dummy.updateMatrix();windows.setMatrixAt(k,dummy.matrix);
    }
    ring.add(panels,windows);
    for(let k=0;k<6;k++){
      const a=k*Math.PI/3;
      const spoke=block(ring,[12,RING_RADIUS,12],[0,Math.cos(a)*RING_RADIUS/2,Math.sin(a)*RING_RADIUS/2],finish.spoke);spoke.rotation.x=a;
      const marker=block(ring,[60,45,80],[0,Math.cos(a)*RING_RADIUS,Math.sin(a)*RING_RADIUS],finish.rib);marker.rotation.x=a;
    }
    ring.traverse(mesh=>{if(mesh.isMesh&&mesh.material!==glow)mesh.onBeforeRender=ringEnvironment;});
  }
  return {group,rings,hubShell};
}

export function createHub(){return createConcourse({sign});}
export function createElevator(parent,z,floor=-8){return createPressureElevator(parent,z,floor);}
export function updateElevator(lift,dt){
  lift.progress=THREE.MathUtils.clamp(lift.progress+(lift.open?1:-1)*dt*1.1,0,1);
  lift.leaves.forEach((leaf,i)=>leaf.position.x=(i===0?-1:1)*(1.04+lift.progress*2.05));
}
export function elevatorBoxes(lift){
  return lift.leaves.map(leaf=>new THREE.Box3(new THREE.Vector3(leaf.position.x-1.02,lift.floor,lift.z-.065),new THREE.Vector3(leaf.position.x+1.02,lift.floor+3.1,lift.z+.065)));
}
