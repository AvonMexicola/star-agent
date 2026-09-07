// Reviewer-authored controlled export fixture; see docs/qa/ship-weapons/production-record.md.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const ROOT=process.cwd();
const OUT=process.env.SHIP_WEAPON_REVIEW_OUTPUT??'/tmp/star-agent-ship-weapon-review';
const HASH='308a1ebeae4b1d5119dd98f96d21cc478335a638317fde19fdc542703f9cde67';
const {createServer}=await import(pathToFileURL(ROOT+'/node_modules/vite/dist/node/index.js'));
const {chromium}=await import(pathToFileURL(ROOT+'/node_modules/@playwright/test/index.mjs'));
const bytes=await fs.readFile(ROOT+'/public/models/ship-weapons.glb');
if(crypto.createHash('sha256').update(bytes).digest('hex')!==HASH)throw Error('Candidate changed');
await fs.mkdir(OUT,{recursive:true});
const fixture=String.raw`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadShipWeaponKit,attachShipWeapons} from '/src/ship-weapons.js';
import {createKestrel} from '/src/kestrel.js';
import kestrelURL from '/assets/kestrel/kestrel.glb?url';
const raw=await(await fetch('/models/ship-weapons.glb')).arrayBuffer();
const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(v=>v.toString(16).padStart(2,'0')).join('');
if(hash!=='308a1ebeae4b1d5119dd98f96d21cc478335a638317fde19fdc542703f9cde67')throw Error('Served kit changed');
const kit=await loadShipWeaponKit(),loader=new GLTFLoader(),models={};
models.kestrel=createKestrel({url:kestrelURL,flight:true});await models.kestrel.readyPromise;
for(const [id,url] of [['nomad','/models/nomad.glb'],['atlas','/models/atlas.glb']])models[id]=(await loader.loadAsync(url)).scene;
for(const [id,model] of Object.entries(models)){model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.userData.initiallyHidden||o.name.startsWith('AB_'))o.visible=false;}});attachShipWeapons(model,id,kit);}
const human=(await loader.loadAsync('/models/props/player-male.glb')).scene;
let hb=new T.Box3().setFromObject(human);human.scale.setScalar(1.8/hb.getSize(new T.Vector3()).y);hb.setFromObject(human);human.position.y=-hb.min.y;
const r=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,preserveDrawingBuffer:true});r.setPixelRatio(1);r.setSize(1440,900);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=.95;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;document.body.append(r.domElement);
const pmrem=new T.PMREMGenerator(r),env=pmrem.fromScene(new RoomEnvironment(),.04).texture;
const gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),backend=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
function bounds(root){root.updateWorldMatrix(true,true);const b=new T.Box3();root.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return b;}
function fit(b,dir,aspect){const target=b.getCenter(new T.Vector3()),camera=new T.OrthographicCamera(-1,1,1,-1,.01,300);camera.position.copy(target).addScaledVector(new T.Vector3(...dir).normalize(),90);camera.lookAt(target);camera.updateMatrixWorld();const inv=camera.matrixWorld.clone().invert(),q=new T.Box3();for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])q.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(inv));const s=q.getSize(new T.Vector3()),h=Math.max(s.y,s.x/aspect)*1.16;camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();return {camera,target:target.toArray(),position:camera.position.toArray(),height:h};}
function lights(scene,under=false,span=25){scene.background=new T.Color('#172128');scene.environment=env;scene.environmentIntensity=.75;const key=new T.DirectionalLight(0xffefd9,2.6);key.position.set(-span,under?-span:span,span*.3);key.castShadow=true;Object.assign(key.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.1,far:span*5});key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00005;key.shadow.normalBias=.002;scene.add(key);const fill=new T.DirectionalLight(0xc2e7f4,1);fill.position.set(span*.7,under?span*.6:-span*.4,-span);scene.add(fill);scene.add(new T.HemisphereLight(0xdfe9e7,0x6d7d85,.4));}
function label(text,x=24,y=20){const el=document.createElement('div');el.className='label';el.style.left=x+'px';el.style.top=y+'px';el.textContent=text;document.body.append(el);}
function record(cameraFit,b){return {position:cameraFit.position,target:cameraFit.target,height:cameraFit.height,bounds:{min:b.min.toArray(),max:b.max.toArray()},drawCalls:r.info.render.calls,triangles:r.info.render.triangles};}
window.review={ready:true,hash,backend,draw(spec){document.querySelectorAll('.label').forEach(e=>e.remove());r.setScissorTest(false);r.setViewport(0,0,1440,900);const frames=[];
 if(spec.kind==='families'){r.setScissorTest(true);for(const [col,type] of ['pulse','laser','void'].entries()){const scene=new T.Scene(),model=kit.variants.get(type+'-s2').clone(true);model.visible=true;scene.add(model);lights(scene,false,5);const b=bounds(model),f=fit(b,[1.1,.8,-1.6],480/810);r.setViewport(col*480,0,480,810);r.setScissor(col*480,0,480,810);r.render(scene,f.camera);label(type.toUpperCase()+' / S2',col*480+24,95);frames.push({type,...record(f,b)});}}
 else {const scene=new T.Scene(),objects=new T.Group();scene.add(objects);let b;
  if(spec.kind==='scale'){for(const size of [1,2,3]){const m=kit.variants.get('pulse-s'+size).clone(true);m.visible=true;m.position.x=(size-2)*1.9;objects.add(m);}const person=human.clone(true);person.position.x=-3.35;person.position.z=.55;objects.add(person);const grid=new T.GridHelper(12,12,0x5b716e,0x33494a);grid.position.y=-.008;scene.add(grid);b=bounds(objects);}
  else {const model=models[spec.ship];model.armament.select(spec.family??'pulse');model.armament.stop();if(spec.ship==='kestrel'){model.updateGear(0,false,0);model.update(0);}objects.add(model);b=spec.box?new T.Box3(new T.Vector3(...spec.box[0]),new T.Vector3(...spec.box[1])):bounds(objects);}
  lights(scene,!!spec.under,spec.kind==='scale'?12:30);const f=fit(b,spec.dir??[-1,.6,-1.2],1440/830);r.setViewport(0,0,1440,830);r.render(scene,f.camera);frames.push(record(f,b));
 }
 label(spec.label);return {hash,backend,spec,frames,viewport:[1440,900],scope:'Reviewer-authored isolated native-PBR fixture. Actual exports/current attachment code; no gameplay or FPS claim.'};
}};
`;
const server=await createServer({root:ROOT,configFile:false,server:{host:'127.0.0.1',port:5414,strictPort:true},plugins:[{name:'review-fixture',resolveId(id){if(id==='/__review_module')return id;},load(id){if(id==='/__review_module')return fixture;}}]});
await server.listen();let browser;
const report={reviewer:'/root/kestrel_reviewer',executor:'Root hardware runner using reviewer-authored capture plan',kitSHA256:HASH,images:[],messages:[]};
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage'],timeout:45000});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>report.messages.push({type:'pageerror',text:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.messages.push({type:m.type(),text:m.text()});});
 await page.route('**/__review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;background:#172128;color:#d6e4dc;font:15px monospace}canvas{display:block}.label{position:absolute;letter-spacing:1px;pointer-events:none}</style><script type="module" src="/__review_module"></script>'}));
 await page.goto('http://127.0.0.1:5414/__review');await page.waitForFunction(()=>window.review?.ready,null,{timeout:90000});
 const views=[
 {name:'01-families',kind:'families',label:'MERIDIAN / S2 FAMILY COMPARISON / ACTUAL EXPORTED MESHES'},
 {name:'02-human-scale',kind:'scale',dir:[1,.85,-1.6],label:'COBALT PULSE / S1, S2, S3 / 1.8 m HUMAN / 1 m GRID'},
 {name:'03-kestrel-underside',ship:'kestrel',under:true,dir:[-1,-.65,-1.1],label:'KESTREL / FOUR S2 / GEAR RETRACTED / FULL ASSEMBLY'},
 {name:'04-kestrel-nose',ship:'kestrel',under:true,box:[[-.8,-.05,-8.55],[.8,2.25,-3.35]],dir:[-1,-.35,-.55],label:'KESTREL / NOSE FORK / ACTUAL SHAPED SUPPORT'},
 {name:'05-nomad-fit',ship:'nomad',family:'laser',box:[[-2.8,.9,-5.9],[-1.8,1.95,-3.65]],dir:[-1,.45,-.7],label:'NOMAD / PORT S1 SOLAR / 15 mm CONNECTOR SPACER'},
 {name:'06-atlas-roof',ship:'atlas',family:'void',box:[[-5,9.3,-9.0],[5,11.0,8.5]],dir:[1,.75,-1],label:'FLYABLE ATLAS / THREE S3 SINGULARITY / ROOF FITS'}
 ];
 for(const spec of views){const state=await page.evaluate(s=>review.draw(s),spec);await page.screenshot({path:OUT+'/'+spec.name+'.png'});report.images.push({file:spec.name+'.png',...state});}
 if(report.messages.length)throw Error('Browser diagnostics: '+JSON.stringify(report.messages));report.complete=true;
}catch(e){report.complete=false;report.failure=String(e.stack??e);throw e;}
finally{await fs.writeFile(OUT+'/capture.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
