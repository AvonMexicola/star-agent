import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStratum } from './stratum.js';
import { createStratumInspectionState } from './stratum-systems.js';
import { STRATUM_LAYOUT as L } from './stratum-layout.js';
import manifest from '../assets/stratum/manifest.json' with { type: 'json' };
import './stratum-studio.css';

const viewport=document.getElementById('viewport'),status=document.getElementById('status');
const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x21333a);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
viewport.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Original Stratum M-05 model; drag to rotate');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.03,250),controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.4;controls.maxDistance=100;controls.autoRotateSpeed=.6;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
scene.environment=environment.texture;scene.environmentIntensity=.60;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xd3eef6,0x15252a,.80));
for(const [position,intensity,color] of [[[12,22,-18],3.1,0xfff4df],[[-20,8,-2],1.5,0xc2e1f5],[[2,13,18],1.3,0xb6efd1]]){
  const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
  if(position[1]===22){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:65});light.shadow.normalBias=.016;light.shadow.bias=-.00003;}
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x18272d,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(50,50,0x496365,0x30474b);grid.position.y=-.01;grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
const human=new THREE.Group(),reference=new THREE.MeshStandardMaterial({color:0xc5b57c,roughness:.66});
for(const [geometry,position] of [[new THREE.CapsuleGeometry(.17,.48,4,10),[0,1.18,0]],[new THREE.SphereGeometry(.12,12,8),[0,1.68,0]],
  ...[-1,1].flatMap(side=>[[new THREE.CapsuleGeometry(.075,.61,4,8),[side*.10,.40,0]],[new THREE.CapsuleGeometry(.055,.50,4,8),[side*.24,1.18,0]]])]){
  const mesh=new THREE.Mesh(geometry,reference);mesh.position.set(...position);mesh.castShadow=true;human.add(mesh);
}
human.position.set(6.9,0,3);scene.add(human);
const ship=createStratum(),clock=createStratumInspectionState();scene.add(ship);
const poses={
  exterior:{position:[19,12,-24],target:[0,2,0]},
  rear:{position:[-16,9,23],target:[0,2,3]},
  side:{position:[27,6,0],target:[0,2,0]},
  top:{position:[0,36,.001],target:[0,2,0]},
  belly:{position:[18,-12,20],target:[0,2,1]},
  cockpit:{position:L.interior.pilotEye,target:[0,2.7,-8.3],inside:true},
  cabin:{position:[0,3.1,6.6],target:[0,2.55,-3.7],inside:true},
  bores:{position:[9.5,5.0,-14.5],target:[3.8,2.55,-8.2],detail:true},
};
let activeView='exterior',frames=0,lastTime=performance.now(),lastDisplayTime=0;
function fitView(){
  const preset=poses[activeView];if(preset.inside||preset.detail)return;
  const w=viewport.clientWidth,h=viewport.clientHeight;
  // Keep full moving bounds inside the actual unobscured canvas at all sizes.
  const limits=[[-6.5,-.25,-10],[7.3,5.6,12.3]],corners=[];
  for(const x of [limits[0][0],limits[1][0]])for(const y of [limits[0][1],limits[1][1]])for(const z of [limits[0][2],limits[1][2]])corners.push(new THREE.Vector3(x,y,z));
  const offset=camera.position.clone().sub(controls.target);
  function fits(scale){camera.position.copy(controls.target).addScaledVector(offset,scale);camera.lookAt(controls.target);camera.updateMatrixWorld();return corners.every(v=>{const p=v.clone().project(camera);return p.z<1&&Math.abs(p.x)<1-28/w&&p.y<1-65/h&&p.y>-1+20/h;});}
  let lo=.05,hi=1;while(!fits(hi)&&hi<30)hi*=1.3;
  for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}fits(hi*1.025);controls.update();
}
function view(name){
  const preset=poses[name];if(!preset)return;activeView=name;
  camera.fov=preset.inside?72:42;camera.updateProjectionMatrix();camera.position.set(...preset.position);controls.target.set(...preset.target);controls.enablePan=!preset.inside;controls.update();fitView();
  floor.visible=grid.visible=name!=='belly';human.visible=!preset.inside&&!preset.detail&&document.getElementById('human-toggle').getAttribute('aria-pressed')==='true';
  document.getElementById('view-label').textContent=`${name} / ${preset.inside?'authored eye position':preset.detail?'detail view':'1m grid · 1.8m reference'}`;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
}
function command(part){
  if(ship.snapshot().assetStatus!=='ready')return;
  const result=clock.command(part,!clock.snapshot().target[part]);
  document.getElementById('mechanism-status').textContent=result.ok?'Asset motion only · gameplay integration pending':result.reason;
  for(const [name,on,off] of [['gear','Retract gear','Extend gear'],['ramp','Close ramp','Deploy ramp']]){const b=document.getElementById(name+'-toggle');b.textContent=clock.snapshot().target[name]?on:off;b.setAttribute('aria-pressed',String(Boolean(clock.snapshot().target[name])));}
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
for(const part of ['gear','ramp'])document.getElementById(part+'-toggle').addEventListener('click',()=>command(part));
document.getElementById('turntable').onclick=event=>{controls.autoRotate=!controls.autoRotate;event.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));};
document.getElementById('human-toggle').onclick=event=>{const enabled=event.currentTarget.getAttribute('aria-pressed')!=='true';event.currentTarget.setAttribute('aria-pressed',String(enabled));human.visible=enabled&&!poses[activeView].inside&&!poses[activeView].detail;};
window.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target.closest('input,textarea,select'))return;
  if(/^[1-8]$/.test(event.key)){event.preventDefault();view(Object.keys(poses)[Number(event.key)-1]);}
  const part={g:'gear',r:'ramp'}[event.key.toLowerCase()];if(part){event.preventDefault();command(part);}
});
const displays=[];
function prepareDisplays(){
  const originalMaterials=new Set();
  for(const mesh of ship.getDisplays()){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;
    const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
    originalMaterials.add(mesh.material);mesh.material=material;displays.push({mesh,canvas,context:canvas.getContext('2d'),texture});
  }
  for(const material of originalMaterials)material.dispose();
}
function updateDisplays(time){
  if(time-lastDisplayTime<150)return;lastDisplayTime=time;const s=ship.snapshot();
  const pages=[['AIRFRAME',`GEAR ${Math.round(s.gearProgress*100)}%`,s.secured?'ACCESS SECURED':'ACCESS OPEN'],['ACCESS',`RAMP ${Math.round(s.rampProgress*100)}%`,s.rampReady?'DEPLOYED':'TRANSITION / STOWED'],['EXTRACTION',`YAW ${Number(document.getElementById('yaw').value).toFixed(2)}`,`ELEV ${Number(document.getElementById('pitch').value).toFixed(2)}`],['ALLOCATION','ORE BIN 384 kg','FREIGHT 32 SBU']];
  displays.forEach((d,i)=>{const c=d.context;c.fillStyle='#07191e';c.fillRect(0,0,512,384);c.fillStyle='#b6efd1';c.font='24px monospace';c.fillText('M-05 / INSPECTION',24,40);c.fillStyle='#739b9c';c.fillRect(24,57,464,2);c.font='bold 40px monospace';c.fillStyle='#d8eee6';c.fillText(pages[i][0],24,119);c.font='28px monospace';c.fillText(pages[i][1],24,189);c.fillText(pages[i][2],24,242);c.fillStyle='#b0a36d';c.font='18px monospace';c.fillText('ASSET STUDIO · NO LIVE GAMEPLAY',24,343);d.texture.needsUpdate=true;});
}
let padIndex=null,padNeutral=false,previousButtons=[];
function neutral(){padNeutral=false;previousButtons=[];}
window.addEventListener('blur',neutral);document.addEventListener('visibilitychange',()=>{neutral();lastTime=performance.now();});
function gamepad(dt){
  if(!document.hasFocus()){neutral();return;}
  const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');
  if(!pad){padIndex=null;neutral();return;}
  const pressed=pad.buttons.map(b=>b.pressed||b.value>.5);
  if(pad.index!==padIndex){padIndex=pad.index;neutral();}
  if(!padNeutral){padNeutral=!pressed.some(Boolean)&&pad.axes.every(a=>Math.abs(a)<.2);previousButtons=pressed;return;}
  const edge=i=>pressed[i]&&!previousButtons[i],list=Array.from(document.querySelectorAll('.controls button:not(:disabled),.controls input:not(:disabled)'));
  if(edge(4)||edge(5)){const names=Object.keys(poses),index=names.indexOf(activeView);view(names[(index+(edge(5)?1:-1)+names.length)%names.length]);}
  const focused=document.activeElement,index=list.indexOf(focused);
  if(focused?.type==='range'&&(edge(14)||edge(15))){focused.value=Number(focused.value)+(edge(15) ? .01 : -.01);focused.dispatchEvent(new Event('input',{bubbles:true}));}
  else if(edge(12)||edge(13)||edge(14)||edge(15)){const step=edge(13)||edge(15)?1:-1;list[index<0?0:(index+step+list.length)%list.length]?.focus();}
  if(edge(0)&&index>=0)focused.click();
  if(!poses[activeView].inside&&(Math.abs(pad.axes[2]||0)>.15||Math.abs(pad.axes[3]||0)>.15)){
    const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);s.theta-=(pad.axes[2]||0)*dt;s.phi=THREE.MathUtils.clamp(s.phi+(pad.axes[3]||0)*dt,.10,Math.PI-.10);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
  }
  previousButtons=pressed;
}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();view(activeView);}
new ResizeObserver(resize).observe(viewport);view('exterior');resize();
const ready=ship.readyPromise.then(systems=>{
  if(!systems){status.textContent='The authored ship could not load. Reload to retry. No partial hull is shown.';return null;}
  status.hidden=true;prepareDisplays();document.querySelectorAll('.mechanisms :disabled').forEach(b=>b.disabled=false);
  document.getElementById('budget').textContent=`${manifest.triangles.toLocaleString()} tri · ${(manifest.bytes/1e6).toFixed(2)} MB · 1024 WebP`;return systems;
});
renderer.setAnimationLoop(time=>{
  const dt=Math.max(0,Math.min((time-lastTime)/1000,.1));lastTime=time;if(document.hidden)return;
  gamepad(dt);const state=clock.update(dt),yaw=Number(document.getElementById('yaw').value),pitch=Number(document.getElementById('pitch').value);
  ship.applyPose({...state,aim:[{yaw,pitch},{yaw:-yaw,pitch}]});updateDisplays(time);controls.update();renderer.render(scene,camera);frames++;
});
window.stratumStudio={ready,asset:ship,camera,renderer,view,snapshot(){const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{...ship.snapshot(),view:activeView,frames,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,assetSha256:manifest.sha256,viewport:[viewport.clientWidth,viewport.clientHeight],drawingBuffer:[renderer.domElement.width,renderer.domElement.height],backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',scope:'asset studio only; flight/mining integration pending'};}};
