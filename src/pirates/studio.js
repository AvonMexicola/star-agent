import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Character} from '../character.js';
import {Equipment,loadSocketCalibration} from '../equipment.js';
const guide=new URLSearchParams(location.search).has('guide');
const ids=guide?['lizzy']:['aeon-leader','aeon-raider','aeon-flanker','selene-leader','selene-adjutant'];
const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#253139');const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,100);camera.position.set(0,2.6,-10.5);camera.lookAt(0,1,0);
scene.add(new THREE.HemisphereLight(0xd9eaff,0x515250,2));const key=new THREE.DirectionalLight(0xffe7cc,3.2);key.position.set(-3,5,-5);scene.add(key);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x435054,roughness:.85}));floor.rotation.x=-Math.PI/2;scene.add(floor);const grid=new THREE.GridHelper(20,20,0x546b70,0x546166);grid.position.y=.002;scene.add(grid);
const actors=[],sockets=await loadSocketCalibration();
for(const [i,id] of ids.entries()){
 const c=new Character(scene,{url:`/models/${guide?'guides':'pirates'}/${id}.glb`,modelYaw:Math.PI,placeholder:false});await c.readyPromise;c.setWorldPose(new THREE.Vector3((i-(ids.length-1)/2)*1.8,0,0),new THREE.Quaternion());c.placeCameraRelative(new THREE.Vector3());
 const e=guide?null:new Equipment(c,scene,{rig:'player-expedition',sockets});if(e){await e.equip('rifle-laser');e.holster(true);e.vfx.visible=false;}
 actors.push({id,c,e,raw:null});document.getElementById('labels').insertAdjacentHTML('beforeend',`<span>${id}</span>`);
}
const motion=document.getElementById('motion'),armed=document.getElementById('armed');
if(guide){camera.position.set(0,1.65,-3.1);camera.lookAt(0,1,0);motion.innerHTML=['idle','walk','run','wave'].map(n=>`<option>${n}</option>`).join('');armed.disabled=true;}
function play(){for(const a of actors){a.c.mixer.stopAllAction();a.raw=a.c.actions[motion.value]?.getClip();if(a.raw){const action=a.c.mixer.clipAction(a.raw);action.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat,Infinity).play();}}}
motion.onchange=play;armed.onchange=play;play();let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;for(const a of actors){a.c.mixer.update(dt);a.c.object.updateMatrixWorld(true);if(a.e){a.e.setRenderOrigin(new THREE.Vector3());a.e.holster(!armed.checked);if(armed.checked)a.e.aimHeld(new THREE.Vector3(0,0,-1));a.e.update(dt,{firing:false});a.e.vfx.visible=false;}}renderer.render(scene,camera);}requestAnimationFrame(frame);
window.pirateStudio={actors,renderer,scene,camera,get state(){return {ready:actors.length===ids.length,motion:motion.value,metrics:{...renderer.info.render},errors:actors.map(a=>a.c.error).filter(Boolean)}}};
