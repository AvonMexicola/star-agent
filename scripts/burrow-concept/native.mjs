// Burrow author inspection derived from the retained reviewer PBR fixture.
// Controlled instrument state is visual fixture data; actual gameplay is checked separately.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {ROOT,ASSET as CURRENT_ASSET,LAYOUT,EXPECTED_SHA,EXPECTED_HUMAN_SHA,outputPath} from '../rover-review/config.mjs';
const ASSET=process.env.BURROW_CAPTURE_ASSET||CURRENT_ASSET;
const DIAGNOSTIC=process.argv.includes('--shadow-off');
const OUT=outputPath();
const BROWSER_TMP=process.env.ROVER_BROWSER_TMP||path.join(os.tmpdir(),'rv-'+process.pid);
const PORT=Number(process.env.ROVER_REVIEW_PORT||5434);
const HASH=EXPECTED_SHA;
const HUMAN=EXPECTED_HUMAN_SHA;
const layoutRaw=await fs.readFile(LAYOUT,'utf8'),layout=JSON.parse(layoutRaw);
const sourceCommit=execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty=Boolean(execFileSync('git',['-C',ROOT,'status','--porcelain'],{encoding:'utf8'}).trim());
const layoutSHA=crypto.createHash('sha256').update(layoutRaw).digest('hex');
const bytes=await fs.readFile(ASSET);
if(crypto.createHash('sha256').update(bytes).digest('hex')!==HASH)throw Error('Candidate changed before capture');
await fs.mkdir(OUT,{recursive:true});await fs.mkdir(BROWSER_TMP,{recursive:true});
const {createServer}=await import(pathToFileURL(ROOT+'/node_modules/vite/dist/node/index.js'));
const {chromium}=await import(pathToFileURL(ROOT+'/node_modules/@playwright/test/index.mjs'));
const fixture=String.raw`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createRoverDisplays} from '/src/rover-display.js';
const L=__LAYOUT__,HASH='__HASH__',HUMAN='__HUMAN__',DIAGNOSTIC=__DIAGNOSTIC__;
const loader=new GLTFLoader();
async function load(url,expected){const raw=await(await fetch(url)).arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('Served asset hash mismatch: '+url);return loader.parseAsync(raw,new URL('.',new URL(url,location.href)).href);}
const [{scene:rover},person]=await Promise.all([load('/models/mining-rover.glb',HASH),load('/models/props/mannequin.glb',HUMAN)]);
const panels=rover.getObjectByName('RoverOreDisplay')?createRoverDisplays(rover):null;
if(panels){await document.fonts.ready;panels.update(1,{speed:0,charge:1,beaming:0,mass:0,occupied:true,busy:false,aboard:false,blocked:false,controls:{}});}
else{
  // Historical 76aa45e runtime face, reproduced at the same controlled idle
  // state for a fair same-camera comparison with the frozen candidate 11 GLB.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=224;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#091c20';ctx.fillRect(0,0,512,224);ctx.fillStyle='#b6efd1';
  ctx.font='20px monospace';ctx.fillText('MERIDIAN / BURROW',18,30);ctx.font='bold 40px monospace';ctx.fillText('0.0 m/s',18,85);
  ctx.font='23px monospace';ctx.fillText('CUT 100%',18,128);ctx.fillText('ORE 0.00 / 96 kg',18,172);
  ctx.font='15px monospace';ctx.fillText('SURFACE DRIVE / TWIN CUTTER',18,190);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const face=new T.Mesh(new T.PlaneGeometry(.55,.235),new T.MeshBasicMaterial({map:texture}));face.position.z=.008;
  rover.getObjectByName('RoverDisplay').add(face);
}
const human=person.scene,mixer=new T.AnimationMixer(human),head=human.getObjectByName('Head'),hips=human.getObjectByName('Hips');if(!head||!hips)throw Error('Human rig contract missing');
const r=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,preserveDrawingBuffer:true});r.setPixelRatio(1);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=.95;r.shadowMap.enabled=!DIAGNOSTIC;r.shadowMap.type=T.PCFSoftShadowMap;document.body.append(r.domElement);
const pmrem=new T.PMREMGenerator(r),environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
const scene=new T.Scene();scene.background=new T.Color('#18242b');scene.environment=environment;scene.environmentIntensity=.75;scene.add(rover,human);
for(const model of [rover,human])model.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=!DIAGNOSTIC;if(o.isSkinnedMesh)o.frustumCulled=false;}});
const key=new T.DirectionalLight(0xffeedb,2.6);key.position.set(-8,10,-6);key.castShadow=!DIAGNOSTIC;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:40});key.shadow.bias=-.0001;key.shadow.normalBias=.010;scene.add(key);
const fill=new T.DirectionalLight(0xc2e6f7,1);fill.position.set(8,4,7);scene.add(fill,new T.HemisphereLight(0xdde8e5,0x5c7380,.35));
const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x28383e,roughness:.8,metalness:.1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=!DIAGNOSTIC;scene.add(floor);const grid=new T.GridHelper(16,16,0x647772,0x354b51);grid.position.y=-.004;scene.add(grid);
const gl=r.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info'),backend=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
function sync(root){scene.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
function vertices(root){sync(root);const out=[],p=new T.Vector3();root.traverseVisible(o=>{if(!o.isMesh)return;for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,p);out.push(p.clone().applyMatrix4(o.matrixWorld));}});return out;}
function bounds(root){return new T.Box3().setFromPoints(vertices(root));}
const plain=b=>({min:b.min.toArray(),max:b.max.toArray()});
function humanPose(clipName,placement){human.visible=true;human.position.set(0,0,0);human.quaternion.identity();mixer.stopAllAction();const clip=person.animations.find(a=>a.name===clipName);if(!clip)throw Error('Missing human clip '+clipName);const action=mixer.clipAction(clip);action.reset().play();mixer.setTime(clip.duration*.5);sync(human);const local=bounds(human),eye=head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.09,-.08));if(placement==='seated')human.position.copy(new T.Vector3(...L.cabin.pilotEye).sub(eye));else human.position.set(-2.45,-local.min.y,.60);sync(human);const placed=bounds(human),expected=local.clone().translate(human.position);if(placed.min.distanceTo(expected.min)>1e-5||placed.max.distanceTo(expected.max)>1e-5)throw Error('Skinned human placed bounds do not match its root translation');return {clip:clipName,localPosedBounds:plain(local),placedPosedBounds:plain(placed),eye:head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.09,-.08)).toArray(),hips:hips.getWorldPosition(new T.Vector3()).toArray(),position:human.position.toArray(),method:'Actual getVertexPosition after scene.updateMatrixWorld refreshes attached skin inverse, then skeleton update; placed bounds equal local bounds plus root translation'};}
const idleProof=humanPose('idle','standing');if(Math.abs(idleProof.localPosedBounds.max[1]-idleProof.localPosedBounds.min[1]-1.8)>.015)throw Error('Human scale proof failed');
const seatedProof=humanPose('sit-idle','seated');if(seatedProof.localPosedBounds.max[1]-seatedProof.localPosedBounds.min[1]>1.45)throw Error('Human did not actually sit');
function pose(spec){rover.getObjectByName('CabinDoor').rotation.y=spec.door??0;rover.getObjectByName('BoardingSteps').rotation.z=0;const steer=spec.steer??0,suspension=spec.suspension??0;
for(const w of L.wheels){const node=rover.getObjectByName('Suspension_'+w.id);node.position.set(...w.position);node.position.y+=suspension;if(w.steer)rover.getObjectByName(w.steer).rotation.y=steer;rover.getObjectByName(w.node).rotation.x=spec.spin??0;}
for(const link of L.links){const w=L.wheels.find(w=>w.id===link.wheel),end=new T.Vector3(...link.wheelOffset).applyAxisAngle(new T.Vector3(0,1,0),w.front?steer:0).add(new T.Vector3(...w.position));end.y+=suspension;const delta=end.sub(new T.Vector3(...link.anchor)),node=rover.getObjectByName(link.node);node.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());node.scale.set(1,delta.length()/node.userData.restLength,1);}
for(const c of L.cutters)rover.getObjectByName(c.pivot).rotation.set(spec.pitch??0,spec.yaw??0,0,'YXZ');sync(rover);}
function fit(b,dir,aspect){const target=b.getCenter(new T.Vector3()),camera=new T.OrthographicCamera(-1,1,1,-1,.01,200);camera.position.copy(target).addScaledVector(new T.Vector3(...dir).normalize(),40);camera.lookAt(target);camera.updateMatrixWorld();const inv=camera.matrixWorld.clone().invert(),projected=new T.Box3();for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])projected.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(inv));const size=projected.getSize(new T.Vector3()),height=Math.max(size.y,size.x/aspect)*1.18;Object.assign(camera,{left:-height*aspect/2,right:height*aspect/2,top:height/2,bottom:-height/2});camera.updateProjectionMatrix();return{camera,target:target.toArray(),position:camera.position.toArray(),height};}
function fitShadow(){
 const points=[...vertices(rover),...(human.visible?vertices(human):[])];
 const lightDirection=key.target.position.clone().sub(key.position).normalize();
 if(floor.visible&&lightDirection.y<-.001)for(const p of points.slice())if(p.y>=floor.position.y)points.push(p.clone().addScaledVector(lightDirection,(floor.position.y-p.y)/lightDirection.y));
 key.shadow.updateMatrices(key);const box=new T.Box3().setFromPoints(points.map(p=>p.clone().applyMatrix4(key.shadow.camera.matrixWorldInverse))),c=key.shadow.camera;
 Object.assign(c,{left:box.min.x-.25,right:box.max.x+.25,bottom:box.min.y-.25,top:box.max.y+.25,near:Math.max(.1,-box.max.z-.5),far:-box.min.z+.5});c.updateProjectionMatrix();key.shadow.updateMatrices(key);
 return{left:c.left,right:c.right,bottom:c.bottom,top:c.top,near:c.near,far:c.far,bias:key.shadow.bias,normalBias:key.shadow.normalBias,mapSize:key.shadow.mapSize.toArray()};
}
window.review={ready:true,HASH,HUMAN,backend,idleProof,seatedProof,draw(spec){const width=spec.phone?390:1440,height=spec.phone?844:900;r.setSize(width,height);r.shadowMap.enabled=!DIAGNOSTIC;document.querySelector('#caption').textContent=spec.label;pose(spec);let humanRecord=null;if(spec.human){humanRecord=humanPose(spec.human==='seated'?'sit-idle':'idle',spec.human);}else human.visible=false;floor.visible=grid.visible=!spec.under;key.position.y=spec.under?-8:10;fill.position.y=spec.under?7:4;let b=bounds(rover);if(human.visible)b.union(bounds(human));if(spec.box)b=new T.Box3(new T.Vector3(...spec.box[0]),new T.Vector3(...spec.box[1]));let f;if(spec.cockpit){const camera=new T.PerspectiveCamera(66,width/height,.015,100);camera.position.set(...L.cabin.pilotEye);camera.lookAt(...(spec.lookTarget??[0,1.37,-1.67]));camera.updateMatrixWorld();f={camera,position:camera.position.toArray(),target:spec.lookTarget??[0,1.37,-1.67]};}else f=fit(b,spec.dir||[-1,.55,-1.3],width/height);const shadowFrustum=fitShadow();r.render(scene,f.camera);const shadowProof={rendererEnabled:r.shadowMap.enabled,keyCasts:key.castShadow,floorReceives:floor.receiveShadow,receivers:0};scene.traverse(o=>{if(o.isMesh&&o.receiveShadow)shadowProof.receivers++;});if(DIAGNOSTIC&&(shadowProof.rendererEnabled||shadowProof.keyCasts||shadowProof.floorReceives||shadowProof.receivers))throw Error('Shadow-off control failed');if(!DIAGNOSTIC&&(!shadowProof.rendererEnabled||!shadowProof.keyCasts||!shadowProof.floorReceives||!shadowProof.receivers))throw Error('Native shadows were disabled');const margins={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};if(!spec.box&&!spec.cockpit)for(const p of [...vertices(rover),...(human.visible?vertices(human):[])]){p.project(f.camera);margins.minX=Math.min(margins.minX,p.x);margins.maxX=Math.max(margins.maxX,p.x);margins.minY=Math.min(margins.minY,p.y);margins.maxY=Math.max(margins.maxY,p.y);}if(Number.isFinite(margins.minX)&&Math.max(Math.abs(margins.minX),Math.abs(margins.maxX),Math.abs(margins.minY),Math.abs(margins.maxY))>.94)throw Error('Overview cropping guard failed');return{spec,shadowProof,shadowFrustum,viewport:[width,height],position:f.position,target:f.target,height:f.height,bounds:plain(b),margins:Number.isFinite(margins.minX)?margins:null,human:humanRecord,drawCalls:r.info.render.calls,triangles:r.info.render.triangles,backend,scope:'Isolated native PBR asset and explicitly evaluated poses; no gameplay, live telemetry, effects, motion acceptance or FPS claim'};}};
`.replace('__LAYOUT__',JSON.stringify(layout)).replace('__HASH__',HASH).replace('__HUMAN__',HUMAN).replace('__DIAGNOSTIC__',JSON.stringify(DIAGNOSTIC));
const server=await createServer({root:ROOT,configFile:false,server:{host:'127.0.0.1',port:PORT,strictPort:true},plugins:[{name:'rover-review',resolveId(id){if(id==='/__rover_review_module')return id;},load(id){if(id==='/__rover_review_module')return fixture;}}]});
await server.listen();let browser;const report={reviewer:'Root author inspection',executor:'Root guarded native runner',panelState:'Controlled idle fixture, not gameplay evidence',sourceCommit,sourceDirty,layoutSHA,diagnostic:DIAGNOSTIC,roverSHA:HASH,humanSHA:HUMAN,images:[],messages:[],complete:false};
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',env:{...process.env,TMPDIR:BROWSER_TMP},args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage'],timeout:45000});report.browser=browser.version();const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.messages.push({type:'pageerror',text:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.messages.push({type:m.type(),text:m.text()});});await page.route('**/__rover_review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/src/fonts.css"><style>html,body{margin:0;background:#18242b;color:#dce8e2;font:14px monospace}canvas{display:block}#caption{position:absolute;top:18px;left:22px;right:22px;pointer-events:none;line-height:1.4}</style><div id="caption"></div><script type="module" src="/__rover_review_module"></script>'}));if(ASSET!==CURRENT_ASSET)await page.route('**/models/mining-rover.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:bytes}));await page.goto('http://127.0.0.1:'+PORT+'/__rover_review');await page.waitForFunction(()=>window.review?.ready,null,{timeout:90000});report.proofs=await page.evaluate(()=>({backend:review.backend,idle:review.idleProof,seated:review.seatedProof}));
const specs=DIAGNOSTIC?[
{name:'diagnostic-cockpit-shadow-off',cockpit:true,label:'DIAGNOSTIC ONLY / SAME PILOT EYE / SHADOWS DISABLED AT INITIALIZATION'},
{name:'diagnostic-rear-shadow-off',label:'DIAGNOSTIC ONLY / SAME REAR CAMERA / SHADOWS DISABLED AT INITIALIZATION',dir:[1,.55,1.3]}
]:[
{name:'01-exterior-human',human:'standing',label:'BURROW M-04 / ORIGINAL 1.8 m POSED MANNEQUIN / 1 m GRID',dir:[-1,.55,-1.3]},
{name:'02-port-seated',human:'seated',door:1.65,label:'PORT BOARDING / ACTUAL SEATED RIG / FIXED STEPS',dir:[-1,.20,-.35]},
{name:'03-cockpit',cockpit:true,label:'PILOT EYE / ASSET INTERIOR / CONTROLLED IDLE PANELS / ACTUAL GAME CHECK SEPARATE'},
{name:'04-cutter-roots',yaw:.4,pitch:-.48,steer:.52,suspension:.22,label:'CUTTER ROOTS / MAX AIM / STEER AND COMPRESSION',box:[[-1.70,.30,-2.70],[1.70,1.85,-.80]],dir:[-1,.30,-1.5]},
{name:'09-cutter-detail',label:'BURROW / PORT CUTTER CARTRIDGE / ORIGINAL MACHINED GEOMETRY',box:[[-.83,1.02,-2.59],[-.40,1.41,-1.80]],dir:[-1,.65,-1.3]},
{name:'05-articulated-underbody',steer:-.52,suspension:-.22,spin:.123,under:true,label:'ARTICULATED LINKS / FULL DROOP / ACTUAL EXPORTED GEOMETRY',dir:[-1,-.7,-1]},
{name:'06-rear',label:'SEALED MINERAL CASSETTES / REAR FENDERS',dir:[1,.55,1.3]},
{name:'08-cockpit-horizon',cockpit:true,lookTarget:[0,1.78,-3],label:'UNCHANGED PILOT EYE / HORIZON LOOK / CONTROLLED IDLE PANELS'},
{name:'07-phone',phone:true,door:1.65,label:'BURROW M-04 / PHONE ASSET FRAMING',dir:[-1,.65,-1.2]}
];for(const spec of specs){await page.setViewportSize(spec.phone?{width:390,height:844}:{width:1440,height:900});const state=await page.evaluate(s=>review.draw(s),spec);await page.screenshot({path:OUT+'/'+spec.name+'.png'});report.images.push({file:spec.name+'.png',...state});}if(report.messages.length)throw Error('Browser diagnostics: '+JSON.stringify(report.messages));report.complete=true;
}catch(error){report.failure=String(error.stack||error);throw error;}finally{await fs.writeFile(OUT+'/capture.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
