import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, ShaderLib, Vector3 } from 'three';
import { REENTRY, ReentryHeating, reentryTarget, stepReentry } from '../src/reentry.js';
import { environmentAt } from '../src/flight-model.js';
import { RADIUS } from '../src/world.js';
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('heat starts at q*v threshold, grows smoothly and saturates without infinities',()=>{
  assert.equal(reentryTarget(0,3000),0);
  assert.equal(reentryTarget(1.225,0),0);
  assert.equal(reentryTarget(1.225,100),0);
  const thresholdSpeed=Math.cbrt(2*REENTRY.onset/1.225);
  near(reentryTarget(1.225,thresholdSpeed),0);
  assert.ok(reentryTarget(1.225,thresholdSpeed+1)<.00001);
  const speed=1500;
  assert.ok(reentryTarget(.01,speed)<reentryTarget(.02,speed));
  assert.equal(reentryTarget(1.225,3000),1);
  assert.equal(reentryTarget(Number.MAX_VALUE,Number.MAX_VALUE),1);
  for(const value of [NaN,Infinity,-1])assert.equal(reentryTarget(value,3000),0);
});

test('the shared 70 km atmosphere boundary supplies no heat in vacuum',()=>{
  const density=h=>environmentAt(new Vector3(0,RADIUS+h,0),RADIUS).density;
  assert.equal(reentryTarget(density(70000),3000),0);
  assert.equal(reentryTarget(density(69999),3000),0);
  assert.ok(reentryTarget(density(45000),3000)>0);
  near(stepReentry(1,density(70000),3000,8),Math.exp(-1));
});

test('heating and cooling are invariant across constant-input simulation rates',()=>{
  const run=dt=>{
    let heat=0;
    for(let i=0;i<Math.round(6/dt);i++)heat=stepReentry(heat,1.225,3000,dt);
    const hot=heat;
    for(let i=0;i<Math.round(16/dt);i++)heat=stepReentry(heat,0,3000,dt);
    return {hot,heat};
  };
  const a=run(1/30),b=run(1/120);
  near(a.hot,b.hot);near(a.heat,b.heat);
  near(a.hot,1-Math.exp(-6/1.5));
  near(a.heat,a.hot*Math.exp(-2));
  assert.equal(stepReentry(.4,1,3000,0),.4);
  assert.throws(()=>stepReentry(.4,1,3000,-1),RangeError);
  assert.throws(()=>stepReentry(NaN,1,3000,1),RangeError);
});

test('shader composes with weathering, retains log depth and leaves shared materials alone',()=>{
  const ship=new Group(),original=new MeshStandardMaterial(),mesh=new Mesh(new BoxGeometry(),original);
  original.onBeforeCompile=shader=>{shader.fragmentShader='// weather-preserved\n'+shader.fragmentShader;};
  original.customProgramCacheKey=()=> 'weather-test';
  ship.add(mesh);
  const outside=new Mesh(mesh.geometry,original),heating=new ReentryHeating(ship);
  assert.notEqual(mesh.material,original);assert.equal(outside.material,original);
  assert.equal(mesh.material.customProgramCacheKey(),'weather-test|reentry-v1');
  const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
  mesh.material.onBeforeCompile(shader,{});
  assert.ok(shader.fragmentShader.startsWith('// weather-preserved'));
  assert.ok(shader.fragmentShader.includes('#include <logdepthbuf_fragment>'));
  assert.ok(shader.vertexShader.includes('#include <logdepthbuf_vertex>'));
  assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance += reentryColour'));
  assert.equal(shader.uniforms.reentryHeat,heating.uniforms.reentryHeat);
  const clone=mesh.material;let disposed=0;clone.addEventListener('dispose',()=>disposed++);
  heating.refresh();assert.equal(mesh.material,clone);
  heating.dispose();heating.dispose();assert.equal(mesh.material,original);assert.equal(disposed,1);
});

test('glass, instruments and explicit material opt-outs retain original materials',()=>{
  const ship=new Group(),materials=[
    new MeshStandardMaterial({transparent:true}),new MeshStandardMaterial({emissive:0x00ff00,emissiveIntensity:2}),
    new MeshStandardMaterial(),new MeshStandardMaterial(),
  ];
  materials[2].userData.reentry=false;materials[3].userData.unweathered=true;
  const mesh=new Mesh(new BoxGeometry(),materials);ship.add(mesh);
  const heating=new ReentryHeating(ship);
  materials.forEach((material,i)=>assert.equal(mesh.material[i],material));
  heating.dispose();assert.equal(mesh.material,materials);
});

test('late meshes and animated local transforms work without world-position precision loss',()=>{
  const ship=new Group();ship.position.set(25e9,1592750,-25e9);
  const heating=new ReentryHeating(ship),hinge=new Group();hinge.position.set(.2,.3,-.4);ship.add(hinge);
  const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());mesh.position.set(.01,.02,.03);hinge.add(mesh);
  heating.refresh();const camera=new PerspectiveCamera();camera.position.copy(ship.position);
  heating.update({density:1.225,velocity:new Vector3(0,0,-3000)},1,camera);
  const matrix=heating.entries.get(mesh).toHull.value;
  near(matrix.elements[12],.21);near(matrix.elements[13],.32);near(matrix.elements[14],-.37);
  const previous=matrix.clone();hinge.rotation.y=1;
  heating.update({density:0,velocity:new Vector3()},1,camera);
  assert.notDeepEqual(matrix.elements,previous.elements);
  heating.dispose();
});

test('inactive ships cool and optional transit resets heat without reheating that frame',()=>{
  const ship=new Group(),heating=new ReentryHeating(ship),camera=new PerspectiveCamera();
  const velocity=new Vector3(0,0,-3000);
  heating.update({density:1.225,velocity},6,camera);assert.ok(heating.heat>.98);
  const hot=heating.heat;
  heating.update({density:1.225,velocity,active:false},1,camera);assert.ok(heating.heat<hot);
  heating.update({density:1.225,velocity,reset:true},1,camera);assert.equal(heating.heat,0);
  heating.dispose();
});
