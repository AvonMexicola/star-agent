import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Atmosphere } from '../src/atmosphere.js';
import { EnergyEffects } from '../src/effects/energy-effects.js';
import { RADIUS } from '../src/world.js';
import { createAsteroidGeometry } from '../src/asteroid-geometry.js';
import { createAsteroidMaterial } from '../src/asteroid-material.js';
import './lab.css';

const $=id=>document.getElementById(id),canvas=$('viewport');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.06,1e11);
const origin=new THREE.Vector3(0,0,RADIUS*4),sun=new THREE.Vector3(-.6,.5,-.7).normalize();
const atmosphere=new Atmosphere(renderer),effects=new EnergyEffects(scene),controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=80;
scene.add(new THREE.HemisphereLight(0x7bc8ff,0x17243a,1.4));
const key=new THREE.DirectionalLight(0xbdd9ff,3.2);key.position.set(-6,10,8);scene.add(key);
const rim=new THREE.DirectionalLight(0x497bd9,3);rim.position.set(5,1,-10);scene.add(rim);
const ship=new THREE.Group();scene.add(ship);
let assetReady=false;
new GLTFLoader().load('../models/nomad.glb',gltf=>{ship.add(gltf.scene);assetReady=true;},undefined,e=>console.error('Effects range ship asset',e));
const rockGeometry=createAsteroidGeometry(2,8,1);rockGeometry.scale(1.5,1.5,1.5);
const rockMaterial=createAsteroidMaterial({moonRadius:1,originUniform:{value:new THREE.Vector3(0,1e6,0)}});rockMaterial.color.set(0x9e9290);
const rock=new THREE.Mesh(rockGeometry,rockMaterial);scene.add(rock);
const emitters=new THREE.Group();scene.add(emitters);
for(const side of [-1,1]){
 const mount=new THREE.Group();mount.position.set(side*3,1.2,2);emitters.add(mount);
 const housing=new THREE.Mesh(new THREE.BoxGeometry(.65,.55,1.5),new THREE.MeshStandardMaterial({color:0x465568,metalness:.75,roughness:.3}));mount.add(housing);
 for(let i=0;i<4;i++){const collar=new THREE.Mesh(new THREE.TorusGeometry(.19,.045,8,24),new THREE.MeshStandardMaterial({color:0x203342,metalness:.8,roughness:.4}));collar.position.z=-.4-i*.16;mount.add(collar);}
 const aperture=new THREE.Mesh(new THREE.CircleGeometry(.12,24),new THREE.MeshStandardMaterial({color:0x69cfff,emissive:0x31aaff,emissiveIntensity:3}));aperture.rotation.y=Math.PI;aperture.position.z=-.92;mount.add(aperture);
}
const target=new THREE.Group();scene.add(target);
const disk=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,.5,64),new THREE.MeshStandardMaterial({color:0x253f53,metalness:.75,roughness:.4}));disk.rotation.x=Math.PI/2;target.add(disk);
for(const r of [1,2,3]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.015,6,96),new THREE.MeshStandardMaterial({color:0x58aebb,emissive:0x147081,emissiveIntensity:1.2}));ring.position.z=.27;target.add(ring);}target.position.set(0,2,-18);
// A sparse star field gives transit a stationary reference and leaves the center clear.
const starPositions=[],starColors=[];for(let i=0;i<1600;i++){const v=new THREE.Vector3(effects.random()-.5,effects.random()-.5,effects.random()-.5).normalize().multiplyScalar(5000);starPositions.push(...v.toArray());starColors.push(.15+effects.random()*.25,.25+effects.random()*.3,.5+effects.random()*.3);}
const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));stars.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));scene.add(new THREE.Points(stars,new THREE.PointsMaterial({vertexColors:true,size:1,sizeAttenuation:false})));
let mode='engines',paused=false,boost=true,power=.85,elapsed=0,last=performance.now(),shot=0,cut=0;
const descriptions={
 engines:['NOMAD / TWIN PLASMA DRIVE','Light the afterburners.','A white-hot core. Turbulent plasma. Expanding shock diamonds.'],
 mining:['FIELD TOOL / MINERAL EXTRACTION','Break it. Bring it home.','Molten sparks scatter as liberated minerals spiral into the collector.'],
 weapons:['HARDPOINTS / PULSED ENERGY','Every shot has weight.','Charged muzzle flashes, luminous bolts and cascading impact sparks.'],
 travel:['DEEP SPACE / VELOCITY FIELD','Feel the distance disappear.','Starlit particles stretch along the flight vector as speed builds.'],
};
function select(next){
 mode=next;effects.reset();shot=0;cut=0;ship.visible=mode==='engines';rock.visible=mode==='mining';target.visible=mode==='weapons';emitters.visible=mode==='weapons';
 document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===mode)));
 const [tag,title,description]=descriptions[mode];$('tag').textContent=tag;$('title').textContent=title;$('description').textContent=description;
 const views={engines:[[17,9,23],[0,2,4]],mining:[[4,2.6,7],[0,0,0]],weapons:[[10,6,15],[0,1,-9]],travel:[[0,0,0],[0,0,-1]]};
 camera.position.fromArray(views[mode][0]);controls.target.fromArray(views[mode][1]);controls.enabled=mode!=='travel';camera.lookAt(controls.target);controls.update();
}
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.scene)));
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'RESUME':'PAUSE';$('pause').setAttribute('aria-pressed',String(paused));};
$('boost').onclick=()=>{boost=!boost;$('boost').setAttribute('aria-pressed',String(boost));$('boost').querySelector('span').textContent=boost?'ON':'OFF';};
$('power').oninput=()=>{power=$('power').valueAsNumber/100;$('power-value').textContent=`${Math.round(power*100)}%`;};
$('bloom').onchange=()=>atmosphere.bloom.enabled=$('bloom').checked;
$('motion').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;effects.reducedMotion=$('motion').checked;
$('motion').onchange=()=>{effects.reducedMotion=$('motion').checked;effects.reset();};
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(24))*Math.max(1,1.3/camera.aspect)));camera.setViewOffset(innerWidth,innerHeight,innerWidth>850?-innerWidth*.1:0,0,innerWidth,innerHeight);camera.updateProjectionMatrix();const size=renderer.getDrawingBufferSize(new THREE.Vector2());atmosphere.resize(size.x,size.y);}window.addEventListener('resize',resize);resize();select('engines');
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(document.hidden)return;controls.update();
 if(!paused){
  elapsed+=dt;const world=p=>new THREE.Vector3(...p).add(origin);let mining=null;
  if(mode==='mining'){
   const t=elapsed*.4,start=world([2,-.8,3.4]),aim=world([Math.sin(t)*.4,Math.cos(t*.7)*.3,0]);
   const ray=new THREE.Raycaster(start.clone().sub(origin),aim.clone().sub(start).normalize()),hit=ray.intersectObject(rock)[0];
   if(hit){const end=hit.point.clone().add(origin),normal=hit.face.normal;
    mining={active:true,start,end,hit:true,normal};
    cut+=dt;if(cut>.13){cut=0;effects.collect(end.clone().addScaledVector(normal,.03),[.008,.005,.004],normal);}
   }
  }
  if(mode==='weapons'){
   shot+=dt;if(shot>.18){shot=0;const start=world([elapsed%1>.5?-3:3,1.2,1.06]),end=world([(effects.random()-.5)*1.8,2+(effects.random()-.5)*1.8,-17.7]);effects.fire(start,end.clone().sub(start).normalize(),{hit:{point:end,normal:new THREE.Vector3(0,0,1)},speed:90});}
  }
  effects.update(dt,{origin,camera,shipPosition:origin,shipQuaternion:new THREE.Quaternion(),flying:mode==='engines'||mode==='travel',boost:boost&&mode==='engines',throttle:power,velocity:new THREE.Vector3(0,0,mode==='travel'?-Math.pow(10,3+power*4):0),mining,collector:world([2,-.8,3.4])});
 }
 atmosphere.render(scene,camera,origin,sun,elapsed);$('particle-count').textContent=effects.state.particles;
}
requestAnimationFrame(frame);
window.effectsLab={select,get state(){return {mode,assetReady,paused,bloom:atmosphere.bloom.enabled,...effects.state};},effects,renderer,camera};
