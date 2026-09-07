import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createGannet} from './gannet.js';
import {GannetSystems} from './gannet-systems.js';
import {GANNET_LAYOUT as L} from './gannet-layout.js';

const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','Gannet T-06 three dimensional inspection');document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#101c24');scene.fog=new THREE.Fog('#101c24',90,200);
const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
scene.environment=pmrem.fromScene(environment,.025).texture;environment.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.035,240);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=100;
scene.add(new THREE.HemisphereLight(0xc3e4e8,0x435052,1.45));
for(const [color,intensity,position] of [[0xffe9ce,4,[9,19,-15]],[0x9bcbe5,2.1,[-15,8,2]],[0xbfffe0,2.2,[3,8,17]]]){
  const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
  if(position[1]===19){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-27,right:27,top:27,bottom:-27,near:1,far:75});light.shadow.bias=-.00012;}
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x23343b,roughness:.82,metalness:.08}));floor.rotation.x=-Math.PI/2;floor.position.y=-.018;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(80,40,0x47696d,0x2e494f);grid.position.y=-.016;grid.material.transparent=true;grid.material.opacity=.24;scene.add(grid);
const systems=new GannetSystems();const ship=createGannet(systems);scene.add(ship);
// Actual local lamps sit below authored cabin/vehicle ceiling fixtures.
for(const [z,intensity] of [[-8,10],[-3,13],[1,10],[7.5,20]]){
  const light=new THREE.PointLight(0xb9e8d8,intensity,z>4?7:5,2);light.position.set(0,z>4?4.36:3.69,z);ship.add(light);
}
const scaleHuman=new THREE.Group();scaleHuman.name='1.80 m scale reference';scaleHuman.position.set(4.8,0,12.1);
const humanMaterial=new THREE.MeshStandardMaterial({color:0xb6c6bf,roughness:.85});
function humanPart(geometry,p){const mesh=new THREE.Mesh(geometry,humanMaterial);mesh.position.set(...p);mesh.castShadow=true;scaleHuman.add(mesh);}
humanPart(new THREE.CapsuleGeometry(.17,.44,4,10),[0,1.18,0]);humanPart(new THREE.SphereGeometry(.105,12,8),[0,1.695,0]);
for(const side of [-1,1]){humanPart(new THREE.CapsuleGeometry(.075,.58,4,8),[side*.105,.40,0]);humanPart(new THREE.CapsuleGeometry(.055,.48,4,8),[side*.24,1.13,0]);}scene.add(scaleHuman);
const views={
  exterior:[[31,18,-37],[0,3,-1]],rear:[[23,12,32],[0,3,4]],side:[[35,10,3],[0,3,0]],
  top:[[0,49,0],[0,2,0]],underside:[[24,-8,29],[0,2,1]],
  bay:[[0,3.18,14.6],[0,2.6,4]],cabin:[[0,3.15,2.5],[0,2.9,-6.8]],
  cockpit:[L.seatEye,[0,2.95,-15]],
};
let selected='exterior';
function view(name){
  if(!views[name])throw new Error('Unknown Gannet view');selected=name;
  camera.fov=name==='cockpit'?52:name==='cabin'||name==='bay'?60:42;
  camera.position.set(...views[name][0]);controls.target.set(...views[name][1]);
  if(innerWidth<650&&!['cockpit','cabin','bay','underside','top'].includes(name))camera.position.sub(controls.target).multiplyScalar(1.45).add(controls.target);
  camera.updateProjectionMatrix();controls.update();floor.visible=name!=='underside';grid.visible=floor.visible;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
const status=document.querySelector('#asset-state'),mechanismStatus=document.querySelector('#mechanism-state');
document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{const result=systems.command(button.dataset.command);if(!result.ok)mechanismStatus.textContent=result.reason;}));
let gear=1,gearTarget=1;
document.querySelector('#gear').addEventListener('click',()=>{
  if(gearTarget===1&&!systems.secured){mechanismStatus.textContent='Secure the vehicle elevator and hatch before retracting gear.';return;}
  gearTarget=1-gearTarget;
  document.querySelector('#gear').setAttribute('aria-pressed',String(gearTarget===0));
  document.querySelector('#gear').textContent=gearTarget===0?'Deploy gear':'Retract gear';
});
let rover=null,roverPromise=null;
document.querySelector('#rover').addEventListener('click',async()=>{
  const button=document.querySelector('#rover');
  if(!rover){
    button.disabled=true;
    roverPromise??=new GLTFLoader().loadAsync('/models/mining-rover.glb');
    try{const gltf=await roverPromise;rover=gltf.scene;rover.rotation.y=L.rover.heading;rover.position.set(...L.rover.park);rover.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});ship.add(rover);}
    catch(error){status.textContent=`Burrow reference failed: ${error.message}`;roverPromise=null;}
    finally{button.disabled=false;}
  }else rover.visible=!rover.visible;
  button.setAttribute('aria-pressed',String(rover?.visible===true));
});
ship.readyPromise.then(()=>{status.textContent='Authored geometry loaded · visual review pending';}).catch(error=>{status.textContent=error.message;document.body.dataset.assetError=error.message;});
view('exterior');
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;renderer.setSize(innerWidth,innerHeight);view(selected);});
let last=performance.now(),readout=0;
function frame(time){
  const dt=Math.min(.1,(time-last)/1000);last=time;systems.update(dt);
  gear+=Math.sign(gearTarget-gear)*Math.min(Math.abs(gearTarget-gear),dt/L.gear.seconds);
  ship.setMechanismPose(systems.mechanismPose(gear));ship.updateInspectionDisplays(dt);
  if(rover)rover.position.y=systems.lift.y;
  readout+=dt;if(readout>.25){readout=0;if(!systems.lastReason)mechanismStatus.textContent=`Hatch ${Math.round(systems.hatch.progress*100)}% · Elevator ${systems.lift.y.toFixed(2)} m · ${systems.secured?'secured':'access open'}`;}
  controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.gannetStudio={ship,systems,view,scene,camera,renderer,controls,ready:ship.readyPromise,get rover(){return rover;}};
window.shipStudio=window.gannetStudio;
