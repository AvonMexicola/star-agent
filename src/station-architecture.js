import * as THREE from 'three';
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
export function sign(parent,text,position,width=4,height=1,yaw=Math.PI){
  // Geometry construction also works in Node for collision/layout tests.
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*height/width);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#10252e';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#d7b374';ctx.fillRect(0,0,12,canvas.height);ctx.fillStyle='#d8eee8';
  ctx.font=`600 ${Math.min(canvas.height*.32,70)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  text.split('\n').forEach((line,i,lines)=>ctx.fillText(line,512,canvas.height*(i+.5)/lines.length,940));
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}));
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

export function createHub(){
  const group=new THREE.Group();group.name='Central concourse';
  const floor=-8;
  block(group,[44,.5,38],[0,floor-.25,0],dark,'HubFloor');
  block(group,[8,.5,38],[-18,1.5,0],dark,'HubCeiling');
  block(group,[8,.5,38],[18,1.5,0],dark,'HubCeiling');
  // Panoramic side windows have low sills and a solid, transparent collision plane.
  const glass=new THREE.MeshStandardMaterial({color:0x8da9b1,transparent:true,opacity:.035,metalness:0,roughness:.2,side:THREE.DoubleSide,depthWrite:false});
  glass.userData.unweathered=true;
  block(group,[28,.15,38],[0,1.5,0],glass,'HubSkylight');
  for(const z of [-18,-9,0,9,18])block(group,[44,.45,.4],[0,1.5,z],ochre);
  for(const x of [-22,22]){
    block(group,[.4,2,38],[x,floor+1,0],steel);
    block(group,[.15,7,38],[x,floor+5.5,0],glass);
    for(const z of [-18,-9,0,9,18])block(group,[.5,9,.5],[x,floor+4.5,z],ochre);
  }
  for(const z of [-19,19]){
    block(group,[44,9,.5],[0,floor+4.5,z],steel);
    for(const x of [-17,-11,11,17])block(group,[4,6,.3],[x,floor+4,z-.4*Math.sign(z)],dark);
  }
  for(const x of [-18,18])for(const z of [-10,1,10]){
    block(group,[3,.5,4],[x,floor+.6,z],ochre);
    block(group,[.4,1.4,4],[x+Math.sign(x)*1.3,floor+1.2,z],dark);
  }
  for(const x of [-14,14]){
    block(group,[.12,.08,31],[x,floor+.02,-1],glow,'HubLights');
    block(group,[.25,.12,30],[x,1.1,-1],glow,'HubLights');
  }
  block(group,[8,1.15,2.5],[0,floor+.575,-7],dark);
  block(group,[8.2,.10,2.7],[0,floor+1.18,-7],steel);
  sign(group,'AEON ORBITAL\nCENTRAL CONCOURSE',[0,-2,-18.69],10,2.5,0);
  sign(group,'HANGARS 01–10    /    NORTH\nHANGARS 11–20    /    SOUTH',[0,-2,10],10,2);
  sign(group,'PASSENGER SERVICES / STATION DIRECTORY',[0,-7.25,-5.72],7,.45,0);
  for(const x of [-11,11]){
    sign(group,x<0?'NORTH BERTHS\n01   02   03   04   05\n06   07   08   09   10':'SOUTH BERTHS\n11   12   13   14   15\n16   17   18   19   20',[x,-4,-18.28],4,3.5,0);
    for(const z of [-14,-4,6]){
      block(group,[.12,.03,7],[x,floor+.018,z],ochre,'HubMarkings');
    }
  }
  for(const x of [-17,17]){
    sign(group,x<0?'FREIGHT SERVICES\nWAREHOUSE / 10T\nTERMINALS IN EACH BERTH':'CREW TRANSIT\nCENTRAL HUB\nELEVATORS / REAR',[x,-4,-18.28],3.5,3.5,0);
  }
  // Flush floor panels, bench supports and recessed wall grilles give the room human scale.
  for(let x=-20;x<=20;x+=4)for(let z=-16;z<=16;z+=4){
    block(group,[3.92,.006,3.92],[x,floor+.006,z],steel,'HubMarkings');
  }
  for(const x of [-18,18])for(const z of [-10,1,10]){
    for(const dz of [-1.3,1.3])block(group,[2,.45,.25],[x,floor+.225,z+dz],dark);
    for(const dz of [-1.4,-.7,0,.7,1.4])block(group,[2.7,.02,.04],[x,floor+.86,z+dz],dark,'HubDetail');
  }
  for(const z of [-18.7,18.7])for(const x of [-19,-13,-7,7,13,19]){
    for(let y=-6.7;y<-5.8;y+=.16)block(group,[3,.06,.10],[x,y,z],dark);
  }
  // Cabin geometry matches the pod entrance: walk inside before selecting a destination.
  for(const x of [-2.15,2.15])block(group,[.18,3.3,3.4],[x,floor+1.65,16],dark);
  block(group,[4.5,.25,3.4],[0,floor+3.5,16],dark);
  sign(group,'HANGAR ELEVATORS',[0,floor+4.2,14.1],5.5,.7);
  const lights=[];
  for(const z of [-10,9]){const light=new THREE.PointLight(0xdde8df,650,45,2);light.position.set(0,0,z);group.add(light);lights.push(light);}
  return {group,lights,interiorBox:new THREE.Box3(new THREE.Vector3(-22,-8,-19),new THREE.Vector3(22,1.5,19))};
}

export function createElevator(parent,z,floor=-8){
  const group=new THREE.Group();group.name='ElevatorDoor';parent.add(group);
  const leaves=[-1,1].map(side=>{
    const leaf=block(group,[2.04,3.1,.13],[side*1.04,floor+1.55,z],steel,'ElevatorDoor');
    block(leaf,[.018,.70,1.1],[-side*.44,0,-.1],ochre,'ElevatorDoorDetail');return leaf;
  });
  sign(parent,'F  /  CALL LIFT',[2.65,floor+1.7,z-.1],.75,.7);
  const lift={group,leaves,z,floor,open:false,progress:0};
  return lift;
}
export function updateElevator(lift,dt){
  lift.progress=THREE.MathUtils.clamp(lift.progress+(lift.open?1:-1)*dt*1.1,0,1);
  lift.leaves.forEach((leaf,i)=>leaf.position.x=(i===0?-1:1)*(1.04+lift.progress*2.05));
}
export function elevatorBoxes(lift){
  return lift.leaves.map(leaf=>new THREE.Box3(new THREE.Vector3(leaf.position.x-1.02,lift.floor,lift.z-.065),new THREE.Vector3(leaf.position.x+1.02,lift.floor+3.1,lift.z+.065)));
}
