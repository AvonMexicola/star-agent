import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createKestrel} from './kestrel.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import './kestrel-studio.css';
import assetURL from '../assets/kestrel/kestrel.glb?url';

const viewport=document.querySelector('#studio-viewport'),status=document.querySelector('#studio-status');
const css=getComputedStyle(document.documentElement),color=key=>new THREE.Color(css.getPropertyValue(key).trim());
const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;viewport.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Kestrel model; drag to rotate');
const scene=new THREE.Scene();scene.background=color('--studio-background');
scene.fog=new THREE.Fog(color('--studio-background'),22,70);
const camera=new THREE.PerspectiveCamera(42,1,.035,120);const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;controls.maxDistance=35;controls.minDistance=.2;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);
scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(color('--studio-sky'),color('--studio-background'),1.1));
for(const [p,intensity,tint] of [[[4,12,-7],3.2,'--studio-key'],[[-9,6,5],2.5,'--studio-sky'],[[6,5,8],1.7,'--mint']]){
 const l=new THREE.DirectionalLight(color(tint),intensity);l.position.set(...p);scene.add(l);
 if(p[1]===12){l.castShadow=true;l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-10,right:10,top:11,bottom:-11,near:.1,far:35});l.shadow.normalBias=.018;l.shadow.bias=-.00003;}
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.MeshStandardMaterial({color:color('--studio-floor').multiplyScalar(.25),roughness:.82,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.018;floor.receiveShadow=true;scene.add(floor);
const poses={exterior:[[9,6.8,-12],[0,1.2,.1]],rear:[[-9,5,14],[0,1.4,1.8]],top:[[0,27,.001],[0,1.6,0]],cockpit:[[0,2.49,-1.9],[0,1.88,-3.0]],boarding:[[-6.91,4.725,-7.05],[-.91,2.625,-2]],belly:[[10,-4,12],[0,1,0]]};
let viewName='exterior',asset=createKestrel({url:assetURL}),frames=0;scene.add(asset);
function fitMechanismView(name){
 if(!['top','boarding','belly'].includes(name))return;
 const rect=viewport.getBoundingClientRect(),w=rect.width,h=rect.height;
 const top=w<700?Math.min(h*.35,document.querySelector('.studio-heading').getBoundingClientRect().bottom-rect.top+20):20;
 const bottom=Math.min(h-18,document.querySelector('.studio-controls').getBoundingClientRect().top-rect.top-20);
 // Offset the perspective centre into the unobstructed part of the canvas.
 camera.setViewOffset(w,h,0,h/2-(top+bottom)/2,w,h);
 const [min,max]=name==='boarding'?[[-2.62,0,-4.1],[.8,5.25,.1]]:[[-4.5,0,-6.75],[4.5,3.2,6.75]];
 const corners=[];for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])corners.push(new THREE.Vector3(x,y,z));
 const offset=camera.position.clone().sub(controls.target);
 function fits(scale){
  camera.position.copy(controls.target).addScaledVector(offset,scale);camera.lookAt(controls.target);camera.updateMatrixWorld();
  return corners.every(v=>{const p=v.clone().project(camera),x=(p.x*.5+.5)*w,y=(.5-p.y*.5)*h;return p.z<1&&x>=18&&x<=w-18&&y>=top&&y<=bottom;});
 }
 let low=.1,high=1;while(!fits(high)&&high<20)high*=1.3;
 for(let i=0;i<18;i++){const mid=(low+high)/2;if(fits(mid))high=mid;else low=mid;}
 fits(high*1.03);controls.update();
}
function view(name){
 if(!poses[name])return;viewName=name;camera.clearViewOffset();camera.fov=name==='cockpit'?70:name==='exterior'?38:42;camera.updateProjectionMatrix();
 const [position,target]=poses[name];camera.position.set(...position);controls.target.set(...target);controls.update();
 if(viewport.clientWidth<700&&['exterior','rear','top','belly'].includes(name)){camera.position.sub(controls.target).multiplyScalar(1.85).add(controls.target);controls.update();}
 fitMechanismView(name);
 floor.visible=name!=='belly';controls.enablePan=name!=='cockpit';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
function command(key){
 const next=asset.snapshot().target[key]!==1,result=asset.command(key,next);
 document.getElementById('mechanism-status').textContent=result.ok?'':result.reason;
 if(result.ok)updateButtons();
}
function updateButtons(){
 const targets=asset.snapshot().target;
 for(const [key,on,off] of [['canopy','Close canopy','Open canopy'],['gear','Retract gear','Extend gear'],['ladder','Stow ladder','Deploy ladder']]){
  const button=document.getElementById(key+'-toggle');button.setAttribute('aria-pressed',String(targets[key]===1));button.textContent=targets[key]?on:off;
 }
}
for(const key of ['canopy','gear','ladder']){const b=document.getElementById(key+'-toggle');b.disabled=true;b.onclick=()=>command(key);}
document.getElementById('throttle').addEventListener('input',event=>asset.setThrottle(event.target.value));
document.querySelector('#turntable').onclick=e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));};
window.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select')||event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;if(/^[1-6]$/.test(event.key)){event.preventDefault();view(Object.keys(poses)[Number(event.key)-1]);}const key={c:'canopy',g:'gear',l:'ladder'}[event.key.toLowerCase()];if(key){event.preventDefault();command(key);}});
function resize(){const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(['top','boarding','belly'].includes(viewName))view(viewName);else if(width<700&&viewName==='exterior'){camera.position.set(17,12,-23);controls.update();}}
new ResizeObserver(resize).observe(viewport);view('exterior');resize();
const ready=asset.readyPromise.then(()=>{
 for(const key of ['canopy','gear','ladder'])document.getElementById(key+'-toggle').disabled=false;
 const mounts=asset.snapshot().hardpoints;
 document.getElementById('hardpoint-spec').textContent=`${mounts.length} × S${mounts[0].size} hardpoints`;
 status.hidden=true;return asset;
}).catch(error=>{status.textContent='The fighter could not load. Reload this page to retry.';throw error;});
let padIndex=null,neutral=false,previousButtons=[];
function gamepad(dt){
 const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');
 if(!pad){padIndex=null;neutral=false;previousButtons=[];return;}
 const pressed=pad.buttons.map(b=>b.pressed||b.value>.5);
 if(pad.index!==padIndex){padIndex=pad.index;neutral=false;}
 if(!neutral){neutral=!pressed.some(Boolean)&&pad.axes.every(a=>Math.abs(a)<.2);previousButtons=pressed;return;}
 const edge=i=>pressed[i]&&!previousButtons[i];
 if(edge(4)||edge(5)){const names=Object.keys(poses),i=names.indexOf(viewName);view(names[(i+(edge(5)?1:-1)+names.length)%names.length]);}
 const list=Array.from(document.querySelectorAll('.studio-controls button:not(:disabled),.studio-controls input:not(:disabled)'));
 const focused=document.activeElement,index=list.indexOf(focused);
 if(focused?.type==='range'&&(edge(14)||edge(15))){focused.value=Number(focused.value)+(edge(15) ? .1 : -.1);focused.dispatchEvent(new Event('input',{bubbles:true}));}
 else if(edge(12)||edge(13)||edge(14)||edge(15)){const step=edge(13)||edge(15)?1:-1;list[(index<0?0:(index+step+list.length)%list.length)]?.focus();}
 if(edge(0)&&index>=0)focused.click();
 if(viewName!=='cockpit'&&(Math.abs(pad.axes[2]||0)>.15||Math.abs(pad.axes[3]||0)>.15)){
  const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta-=(pad.axes[2]||0)*dt*1.4;spherical.phi=THREE.MathUtils.clamp(spherical.phi+(pad.axes[3]||0)*dt,0.12,Math.PI-.12);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
 }
 previousButtons=pressed;
}
let previous=performance.now();document.addEventListener('visibilitychange',()=>{previous=performance.now();});
renderer.setAnimationLoop(time=>{const dt=Math.min((time-previous)/1000,1);previous=time;if(document.hidden)return;gamepad(dt);asset.update(dt);controls.update(dt);renderer.render(scene,camera);frames++;});
window.kestrelStudio={ready,view,get asset(){return asset},get camera(){return camera},get renderer(){return renderer},snapshot(){const ext=renderer.getContext().getExtension('WEBGL_debug_renderer_info');return{view:viewName,frames,...asset.snapshot(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,viewport:{width:renderer.domElement.width,height:renderer.domElement.height},backend:ext?renderer.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'};}};
