import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWalkableShip } from '/src/ship-walkable.js';
import { ShipInventory } from '/src/ship-inventory.js';
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
 if(position[1]===13){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40});light.shadow.bias=-.0002;}
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x243440,roughness:.72,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
const ship=createWalkableShip({assetURL:'/models/nomad.glb'});scene.add(ship);ship.setDoor(true);
const inventory=new ShipInventory();
const nav={flightEnvironment:{regime:'ATMOSPHERE',atmosphereFraction:1},normal:new THREE.Vector3(.2,.4,.89).normalize(),orientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),speed:0,altitude:2.55,mode:'landed',flightAssist:true,doorOpen:true,doorProgress:1};
const views={exterior:[[13,9,-15],[0,1.65,-.6]],rear:[[11,7,14],[0,1.8,.3]],cockpit:[[0,2.55,-2.8],[0,2.00,-4.15]],cargo:[[-.9,2.7,-.1],[1.32,1.8,1.15]]};
function view(name){camera.fov=name==='cockpit'?52:44;camera.updateProjectionMatrix();camera.position.set(...views[name][0]);controls.target.set(...views[name][1]);controls.update();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
let open=false;document.getElementById('lid').onclick=()=>ship.setStorage(open=!open);
view('exterior');
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let last=performance.now();function frame(time){const dt=Math.min(.1,(time-last)/1000);last=time;ship.update(dt);ship.updateDisplays(dt,nav,inventory,null);controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.shipStudio={ship,view,ready:ship.readyPromise};
