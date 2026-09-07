import { gearStep } from './gear-flight.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWalkableShip } from '/src/ship-walkable.js';
import { ShipInventory } from '/src/ship-inventory.js';
import { MiningStore } from '/src/mining/store.js';
import nomad from '../assets/ship/identity.json' with { type: 'json' };
import { shipManufacturer } from './ship-manufacturers.js';
import './ship-studio.css';
const manufacturer=shipManufacturer(nomad.id);
document.querySelector('.studio-header h1').innerHTML=`${nomad.name.toUpperCase()} <span>${nomad.revision}</span>`;
document.querySelector('.studio-header p').textContent=nomad.role;
document.querySelector('.studio-eyebrow').innerHTML=`<img src="${manufacturer.emblemURL}" alt="">${manufacturer.name.toUpperCase()}`;
const renderer = new THREE.WebGLRenderer({ antialias:true, logarithmicDepthBuffer:true });
renderer.setPixelRatio(devicePixelRatio);renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#131f29');scene.fog=new THREE.Fog('#131f29',35,90);
const camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.04,150);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xc3e6ff,0x4c535b,2.3));
for(const [color,intensity,position] of [[0xffe8cf,5,[3,13,-8]],[0x8bc8ff,3,[-9,7,3]],[0xd3ffdf,4,[5,5,9]]]){
 const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
 if(position[1]===13){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40});light.shadow.bias=-.00015;light.shadow.normalBias=.025;}
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x243440,roughness:.72,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
const ship=createWalkableShip({assetURL:'/models/nomad.glb'});scene.add(ship);ship.setDoor(true);
const studioValues=new Map(),storage={getItem:key=>studioValues.get(key),setItem:(key,value)=>studioValues.set(key,value)};
const inventory=new ShipInventory(storage),cargoStore=new MiningStore(storage);cargoStore.bindManifest(inventory);
const nav={gearProgress:1,gearDeployed:true,powered:true,flightEnvironment:{regime:'ATMOSPHERE',atmosphereFraction:1},normal:new THREE.Vector3(.2,.4,.89).normalize(),orientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),speed:0,altitude:2.55,mode:'landed',flightAssist:true,doorOpen:true,doorProgress:1};
const views={hardpoints:[[5.4,2.4,-6.3],[2.07,1.42,-4.03]],side:[[16,5,.5],[0,2,0]],top:[[.01,19,.01],[0,0,0]],boarding:[[0,2.75,6.6],[0,2.6,-1.4]],berth:[[.50,2.85,1.53],[-1.17,2.08,.30]],rack:[[.40,2.84,1.5],[-1.25,2.02,2.83]],chair:[[1.0,2.5,-4.0],[0,1.85,-2.65]],exterior:[[13,9,-15],[0,1.65,-.6]],rear:[[11,7,14],[0,1.8,.3]],cockpit:[[0,2.55,-2.8],[0,2.00,-4.15]],cargo:[[-.9,2.7,-.1],[1.32,1.8,1.15]]};
let currentView='exterior';
function frameTop(){
 const bounds=new THREE.Box3();ship.updateMatrixWorld(true);
 ship.traverseVisible(object=>{if(object.isMesh){object.geometry.computeBoundingBox();bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));}});
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const top=Math.max(170,document.querySelector('.studio-specs').getBoundingClientRect().bottom+24);
 const bottom=innerHeight-document.querySelector('.studio-footer').getBoundingClientRect().top+24;
 const available=Math.max(120,innerHeight-top-bottom),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const distance=Math.max(size.z/(2*tangent*available/innerHeight),size.x/(2*tangent*camera.aspect*.90))*1.08+size.y/2;
 const centerY=(top+innerHeight-bottom)/2;
 center.z-=(centerY-innerHeight/2)/innerHeight*2*distance*tangent;
 controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,distance,.001));
}
function view(name){
 currentView=name;camera.fov=name==='cockpit'?52:['boarding','berth','rack'].includes(name)?62:name==='chair'?65:44;camera.updateProjectionMatrix();
 camera.position.set(...views[name][0]);controls.target.set(...views[name][1]);
 if(['exterior','rear','side','top','hardpoints'].includes(name)&&camera.aspect<1)camera.position.sub(controls.target).multiplyScalar(1/camera.aspect).add(controls.target);
 if(name==='top')frameTop();
 controls.update();document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));
 const caption=document.getElementById('view-caption');if(caption)caption.textContent={exterior:'EXTERIOR / THREE QUARTER',rear:'REAR / DRIVE & ACCESS',boarding:'BOARDING / CONTINUOUS AISLE',cockpit:'COCKPIT / PILOT EYE',berth:'CABIN / SOLO BERTH',rack:'CARGO / LIVE MANIFEST',hardpoints:'S1 / EMPTY STANDARD FITTINGS'}[name]??name.toUpperCase();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
let open=false;document.getElementById('lid').onclick=event=>{ship.setStorage(open=!open);event.currentTarget.textContent=open?'Close storage':'Open storage';};
const doorButton=document.getElementById('door');if(doorButton)doorButton.onclick=()=>{ship.setDoor(!ship.doorOpen);doorButton.textContent=ship.doorOpen?'Close ramp':'Open ramp';};
let gearDown=true;document.getElementById('gear').onclick=event=>{gearDown=!gearDown;nav.gearDeployed=gearDown;event.currentTarget.textContent=gearDown?'Retract gear':'Deploy gear';};
view('exterior');
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);view(currentView);});
let last=performance.now();function frame(time){const dt=Math.min(.1,(time-last)/1000);last=time;nav.gearProgress=gearStep(nav.gearProgress,gearDown,dt);ship.update(dt);ship.updateDisplays(dt,nav,inventory,null);ship.updateCabin(nav,cargoStore);controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.shipStudio={ship,view,scene,camera,renderer,controls,cargoStore,ready:ship.readyPromise};
ship.readyPromise.then(()=>view(currentView));
