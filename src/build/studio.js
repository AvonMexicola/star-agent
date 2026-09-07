import { THREE } from '/src/trees.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PIECES} from '/src/build/definitions.js';
import { createBuildVisual, setDoorOpen, setLandingPadVisual } from '/src/build/visuals.js';
import {padApproaches,padLightPositions} from '/src/build/pad-kit.js';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,logarithmicDepthBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(.065,.085,.10);
const ambient=new THREE.HemisphereLight(0xcfe3ff,0x45403a,2);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xfff1dc,3);sun.position.set(-8,16,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:50});sun.shadow.normalBias=.02;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:new THREE.Color(.12,.14,.15),roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.62;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.05,150);camera.position.set(14,11,18);camera.lookAt(0,1,0);
const params=new URLSearchParams(location.search),only=params.get('only');
const expansion=params.has('expansion');
const kit=params.has('roofkit')?[['foundation',-2,0,0],['foundation',2,0,0],['wall',-2,0,-2],['wall',2,0,-2],['floor',-2,3,0],['floor',2,3,0],['roof-edge',-2,3.006,0],['roof-corner',2,3.006,0],['ceiling-light',-2,2.82,0]]:expansion?[['foundation-quarter',-4,0,0],['window-quarter',-4,0,0],['floor-quarter',-4,3,0],['foundation',-4,0,-4],['wall',-6,0,-4,Math.PI/2],['floor',-4,3,-4],['foundation-triangle',2,0,0],['wall',2,0,-1.154700538],['floor-triangle',2,3,0],['foundation',6,0,-4],['rack',5.5,0,-4,Math.PI],['terminal',7.2,0,-4,Math.PI],['foundation-ramp',6,0,2]]:only?[[only,0,only==='ceiling-light'?2.8:0,0,PIECES[only]?.padSize?0:Math.PI]]:[['foundation',-5,0,-3],['wall',-5,0,-5],['window',-7,0,-3,Math.PI/2],['doorway',-5,0,-1],['foundation',0,0,-3],['stairs',0,0,-3],['floor',0,3,-7],['foundation',5,0,-3],['mainframe',4,0,-3,Math.PI],['crate',5.7,0,-3,Math.PI],['floor',-5,0,4],['wall',0,0,4],['window',5,0,4]];
for(const [id,x,y,z,rotation=0] of kit){const obj=await createBuildVisual({type:id,landingPad:true});obj.position.set(x,y,z);obj.rotation.y=rotation;scene.add(obj);if(id==='doorway')setDoorOpen(obj,1);}
if(only){ground.position.y=only==='foundation'?-.6:0;camera.position.set(6,4,7);camera.lookAt(0,1,0);if(only==='mainframe'){camera.position.set(3,2.6,4);camera.lookAt(-.4,.9,0);}}
if(only&&PIECES[only]?.padSize){
 const def=PIECES[only],size=def.footprint,powered=!params.has('unpowered');
 for(const part of padApproaches({type:only,position:[0,0,0],rotation:0})){const ramp=await createBuildVisual(part);ramp.position.fromArray(part.position);ramp.rotation.y=part.rotation;scene.add(ramp);}
 setLandingPadVisual(scene.children.find(o=>o.userData.pieceType===only),true,powered);
 if(params.has('night')){ambient.intensity=.1;sun.intensity=.07;scene.background.setRGB(.006,.009,.014);}
 if(powered)for(const offset of padLightPositions(...size).filter((_,i)=>i%Math.ceil(padLightPositions(...size).length/4)===0).slice(0,4)){const light=new THREE.PointLight(0xb6efd1,3,5,2);light.position.fromArray(offset);light.position.y+=.12;scene.add(light);}
 camera.far=400;camera.position.set(size[0]*.7,Math.max(...size)*.9,size[1]*.65);camera.lookAt(0,0,0);camera.updateProjectionMatrix();ground.scale.set(3,3,3);ground.position.y=-.6;
 if(params.has('ship')){const atlas=only!=='foundation-pad-small',ship=(await new GLTFLoader().loadAsync(atlas?'/models/atlas.glb':'/models/nomad.glb')).scene;if(only==='foundation-pad-large')ship.scale.setScalar(2);scene.add(ship);}
}
if(only==='ceiling-light'){camera.position.set(2,1.2,3);camera.lookAt(0,2.65,0);const ceiling=await createBuildVisual('floor');ceiling.position.y=2.98;scene.add(ceiling);const lamp=new THREE.PointLight(0xffe5bd,18,12,2);lamp.position.set(0,2.6,0);scene.add(lamp);}
if(params.has('roofkit')){camera.position.set(9,5,11);camera.lookAt(0,1.8,0);}
if(only==='wind-turbine'){camera.position.set(8,6,9);camera.lookAt(0,2.8,0);}
if(only==='hangar-door'){camera.position.set(18,10,19);camera.lookAt(0,2,0);setDoorOpen(scene.children.find(o=>o.userData.pieceType===only),params.has('open')?1:0);}
const human=new THREE.Group();const material=new THREE.MeshStandardMaterial({color:0xb6efd1,roughness:.6});
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,1.15,4,8),material);body.position.y=.8;human.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),material);head.position.y=1.66;human.add(head);human.position.set(only?-2:3.3,0,only?0:-1.5);scene.add(human);
window.__buildStudio={renderer,scene,camera,ready:true};
function render(){renderer.render(scene,camera);document.querySelector('#caption').textContent=`Mineral-concrete kit · 4 m modules / 3 m storeys · 1.80 m reference · ${renderer.info.render.calls} draws / ${renderer.info.render.triangles.toLocaleString()} triangles`;requestAnimationFrame(render);}render();
