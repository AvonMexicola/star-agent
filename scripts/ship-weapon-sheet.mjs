// Isolated visual fixture: real exported kit and native Three PBR, not gameplay evidence.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.SHIP_WEAPON_SHEET_OUTPUT??'/tmp/star-agent-ship-weapons';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5412,strictPort:true},plugins:[{name:'weapon-sheet-fixture',resolveId(id){if(id==='/__weapon-sheet-module')return id;},load(id){if(id==='/__weapon-sheet-module')return 'import * as THREE from "three";import {loadShipWeaponKit} from "/src/ship-weapons.js";import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";window.sheet={THREE,loadShipWeaponKit,RoomEnvironment};';}}]});
await server.listen();let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1536,height:1152},deviceScaleFactor:1}),messages=[];
 page.on('pageerror',e=>messages.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text());});
 await page.route('**/__weapon-sheet',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;background:#151b21;color:#d5ddd6;font-family:monospace}canvas{display:block}.label{position:absolute;font-size:15px;letter-spacing:1px}header{position:absolute;top:18px;left:24px;font-size:20px}small{color:#99aaa6;font-size:11px}</style><header>MERIDIAN SHIPWORKS / ENERGY WEAPONS<br><small>Original exported gun kit · common camera scale · metres</small></header><script type="module" src="/__weapon-sheet-module"></script>'}));
 await page.goto('http://127.0.0.1:5412/__weapon-sheet');await page.waitForFunction(()=>window.sheet);
 const state=await page.evaluate(async()=>{
  const {THREE,loadShipWeaponKit,RoomEnvironment}=window.sheet,kit=await loadShipWeaponKit();
  const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(new RoomEnvironment(),.04).texture;renderer.setScissorTest(true);
  const counts=[];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
   const type=['pulse','laser','void'][col],size=row+1,scene=new THREE.Scene();scene.background=new THREE.Color(row%2?'#171f25':'#1b242b');scene.environment=env;scene.environmentIntensity=.7;
   const model=kit.variants.get(type+'-s'+size).clone(true);scene.add(model);
   const key=new THREE.DirectionalLight(0xffecd4,3);key.position.set(-3,5,-2);scene.add(key);
   const fill=new THREE.DirectionalLight(0xbdeaff,1.3);fill.position.set(3,2,3);scene.add(fill);
   const camera=new THREE.PerspectiveCamera(34,512/350,.01,1000);camera.position.set(3.5,3.0,-6.5);camera.lookAt(0,.35,-1.55);
   const x=col*512,y=innerHeight-100-(row+1)*350;renderer.setViewport(x,y,512,350);renderer.setScissor(x,y,512,350);renderer.render(scene,camera);
   const label=document.createElement('div');label.className='label';label.style.cssText='left:'+(x+24)+'px;top:'+(100+row*350+15)+'px';label.textContent=['COBALT PULSE','SOLAR LANCE','SINGULARITY'][col]+' / S'+size;document.body.append(label);
   counts.push({type,size,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
  }
  const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {counts,backend:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 });
 await page.screenshot({path:output+'/weapon-sheet.png'});await writeFile(output+'/weapon-sheet.json',JSON.stringify({browser:browser.version(),...state,messages},null,2));
 if(messages.length)throw new Error(messages.join('\n'));
 console.log(JSON.stringify(state));
}finally{await browser?.close();await server.close();}
