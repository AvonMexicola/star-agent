import * as THREE from 'three';

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
  // Long spine and fixed passenger bridges; rotating structures sit outside the bays.
  block(group,[2280,38,44],[0,-35,0],dark);
  for(const pod of POD_LAYOUT){
    block(group,[14,16,480],[pod.offset[0],-23,pod.offset[2]/2],steel);
    block(group,[5,3,470],[pod.offset[0],-13,pod.offset[2]/2],ochre);
  }
  const rings=[];
  for(const [i,x] of [-1110,1110].entries()){
    const ring=new THREE.Group();ring.position.x=x;group.add(ring);rings.push(ring);
    const torus=new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS,18,8,192),steel);
    torus.rotation.y=Math.PI/2;ring.add(torus);
    for(const dx of [-23,23]){
      const rail=new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS,3,6,192),ochre);rail.rotation.y=Math.PI/2;rail.position.x=dx;ring.add(rail);
    }
    const panels=new THREE.InstancedMesh(boxGeometry,dark,120),windows=new THREE.InstancedMesh(boxGeometry,glow,120);
    const dummy=new THREE.Object3D();
    for(let k=0;k<120;k++){
      const a=k*Math.PI*2/120;
      dummy.position.set(0,Math.cos(a)*RING_RADIUS,Math.sin(a)*RING_RADIUS);dummy.rotation.set(a,0,0);dummy.scale.set(56,36,52);dummy.updateMatrix();panels.setMatrixAt(k,dummy.matrix);
      dummy.position.x=i===0?29:-29;dummy.scale.set(1,5,36);dummy.updateMatrix();windows.setMatrixAt(k,dummy.matrix);
    }
    ring.add(panels,windows);
    for(let k=0;k<6;k++){
      const a=k*Math.PI/3;
      const spoke=block(ring,[12,RING_RADIUS,12],[0,Math.cos(a)*RING_RADIUS/2,Math.sin(a)*RING_RADIUS/2],dark);spoke.rotation.x=a;
      const marker=block(ring,[60,45,80],[0,Math.cos(a)*RING_RADIUS,Math.sin(a)*RING_RADIUS],ochre);marker.rotation.x=a;
    }
  }
  return {group,rings};
}

export function createHub(){
  const group=new THREE.Group();group.name='Central concourse';
  const floor=-8;
  block(group,[44,.5,38],[0,floor-.25,0],dark,'HubFloor');
  block(group,[44,.5,38],[0,1.5,0],dark,'HubCeiling');
  // Panoramic side windows have low sills and a solid, transparent collision plane.
  const glass=new THREE.MeshStandardMaterial({color:0x8da9b1,transparent:true,opacity:.10,metalness:.1,roughness:.15,side:THREE.DoubleSide});
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
  sign(group,'AEON ORBITAL\nCENTRAL CONCOURSE',[0,-2,-18.69],13,3,0);
  sign(group,'HANGARS 01–10    /    NORTH\nHANGARS 11–20    /    SOUTH',[0,-2,10],10,2);
  sign(group,'FREIGHT • CREW • FLIGHT\n20 BERTHS / ELEVATOR AT REAR',[0,-5.8,-5.72],7,1.2,0);
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
