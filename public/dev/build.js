import { THREE } from '/src/trees.js';
import { createBuildVisual, setDoorOpen } from '/src/build/visuals.js';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,logarithmicDepthBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(.065,.085,.10);
scene.add(new THREE.HemisphereLight(0xcfe3ff,0x45403a,2));
const sun=new THREE.DirectionalLight(0xfff1dc,3);sun.position.set(-8,16,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:50});sun.shadow.normalBias=.02;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.MeshStandardMaterial({color:new THREE.Color(.12,.14,.15),roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.62;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.05,150);camera.position.set(14,11,18);camera.lookAt(0,1,0);
const params=new URLSearchParams(location.search),only=params.get('only');
const kit=only?[[only,0,0,0,Math.PI]]:[['foundation',-5,0,-3],['wall',-5,0,-5],['window',-7,0,-3,Math.PI/2],['doorway',-5,0,-1],['foundation',0,0,-3],['stairs',0,0,-3],['floor',0,3,-7],['foundation',5,0,-3],['mainframe',4,0,-3,Math.PI],['crate',5.7,0,-3,Math.PI],['floor',-5,0,4],['wall',0,0,4],['window',5,0,4]];
for(const [id,x,y,z,rotation=0] of kit){const obj=await createBuildVisual(id);obj.position.set(x,y,z);obj.rotation.y=rotation;scene.add(obj);if(id==='doorway')setDoorOpen(obj,1);}
if(only){ground.position.y=only==='foundation'?-.6:0;camera.position.set(6,4,7);camera.lookAt(0,1,0);if(only==='mainframe'){camera.position.set(3,2.6,4);camera.lookAt(-.4,.9,0);}}
const human=new THREE.Group();const material=new THREE.MeshStandardMaterial({color:0xb6efd1,roughness:.6});
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,1.15,4,8),material);body.position.y=.8;human.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),material);head.position.y=1.66;human.add(head);human.position.set(only?-2:3.3,0,only?0:-1.5);scene.add(human);
window.__buildStudio={renderer,scene,camera,ready:true};
function render(){renderer.render(scene,camera);document.querySelector('#caption').textContent=`Mineral-concrete kit · 4 m modules / 3 m storeys · 1.80 m reference · ${renderer.info.render.calls} draws / ${renderer.info.render.triangles.toLocaleString()} triangles`;requestAnimationFrame(render);}render();
