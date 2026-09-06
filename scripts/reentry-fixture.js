import * as THREE from 'three';
import { createWalkableShip } from '../src/ship-walkable.js';
import { createSurfaceTexture, weatherShip } from '../src/surface-materials.js';
import { ReentryHeating } from '../src/reentry.js';

const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b12);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.08,125e9);
camera.position.set(13,7,-19);camera.lookAt(0,1,0);
scene.add(new THREE.HemisphereLight(0xa5c6df,0x101318,1.3));
const sun=new THREE.DirectionalLight(0xffe1ba,2);sun.position.set(-5,10,-10);scene.add(sun);
const ship=createWalkableShip();scene.add(ship);
// Exercise shader composition even for the fallback's default-black emissive
// materials, which the older weather helper otherwise skips by intensity alone.
ship.traverse(mesh=>{if(mesh.isMesh && mesh.material.emissive?.getHex()===0)mesh.material.emissiveIntensity=0;});
const texture=createSurfaceTexture();weatherShip(ship,texture);
const heating=new ReentryHeating(ship),velocity=new THREE.Vector3(0,0,-3000);
function render(state){
  heating.heat=0;heating.time=0;
  if(state!=='cold')for(let i=0;i<360;i++)heating.update({density:1.225,velocity},1/60,camera);
  if(state==='cooled')for(let i=0;i<60;i++)heating.update({density:0,velocity},1,camera);
  heating.update({density:0,velocity},0,camera);
  document.getElementById('label').textContent=`NOMAD · ${state.toUpperCase()} HULL`;
  renderer.render(scene,camera);
  const pixels=new Uint8Array(innerWidth*innerHeight*4),gl=renderer.getContext();
  gl.readPixels(0,0,innerWidth,innerHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let red=0,green=0;for(let i=0;i<pixels.length;i+=4){red+=pixels[i];green+=pixels[i+1];}
  return {heat:heating.heat,red,green,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
window.reentryFixture={render,renderer};render('cold');
