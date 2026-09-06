import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOrbitalSurface } from '../src/orbital-surface-data.js';
import { generatePatch, terrainHeight, cubeDirection, RADIUS } from '../src/world.js';
import { generateMoonPatch } from '../src/moon-terrain.js';
import { moonSurface, MOON_RADIUS } from '../src/moon-world.js';
import { terrainGridForLevel } from '../src/terrain-resolution.js';
import { patchSurfaceMaterial, patchSurfaceUV } from '../src/patch-surface.js';
import { MeshStandardMaterial } from 'three';
import { setPlanetSeed, DEFAULT_SEED } from '../src/generation.js';

const directionAt=(x,y,w,h)=>{
  const lat=((y+.5)/h-.5)*Math.PI,lon=((x+.5)/w-.5)*Math.PI*2;
  return [Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];
};
const fromSRGB=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;

for(const body of ['aeon','selene'])test(`${body} orbital maps preserve canonical geography, outward relief and pole continuity`,()=>{
  const width=128,height=64,maps=generateOrbitalSurface({body,width,height});
  assert.deepEqual(maps,generateOrbitalSurface({body,width,height}));
  let relief=0,low=0,high=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=(y*width+x)*4,d=directionAt(x,y,width,height);
    const sample=body==='selene'?moonSurface(...d):{height:terrainHeight(...d)};
    const encodedHeight=Math.round(Math.max(0,Math.min(1,.5+sample.height/256))*255);
    assert.equal(maps.normal[k+3],encodedHeight,'height mask belongs to the collision source');
    const n=[0,1,2].map(a=>maps.normal[k+a]/255*2-1),length=Math.hypot(...n);
    assert.ok(Math.abs(length-1)<.007,'quantized normals stay unit length');
    const dot=n.reduce((sum,v,a)=>sum+v*d[a],0)/length;
    assert.ok(dot>0,'normal faces away from the body centre');
    relief+=1-dot;low+=encodedHeight===0;high+=encodedHeight===255;
    if(sample.color)for(let a=0;a<3;a++)assert.ok(Math.abs(fromSRGB(maps.color[k+a]/255)-sample.color[a])<.005,'sRGB storage recovers the linear geological colour');
    assert.equal(maps.color[k+3],255);
  }
  assert.ok(relief>.0001,'normal map contains measured relief, not only a radial sphere');
  assert.ok(low>0&&high>0,'both lowlands and highlands survive encoding');
  // Check the seam's longitudinal slope against collision queries on both
  // sides of the wrap, including the short physical spacing near the poles.
  const radius=body==='aeon'?RADIUS:MOON_RADIUS;
  const query=d=>body==='aeon'?terrainHeight(...d):moonSurface(...d).height;
  for(const y of [0,17,height-1])for(const x of [0,width-1]){
    const d=directionAt(x,y,width,height),lon=((x+.5)/width-.5)*Math.PI*2;
    const east=[Math.cos(lon),0,-Math.sin(lon)];
    const dx=2*radius*Math.hypot(d[0],d[2])*Math.PI*2/width;
    const slope=(query(directionAt((x+1)%width,y,width,height))-query(directionAt((x+width-1)%width,y,width,height)))/dx;
    const k=(y*width+x)*4,n=[0,1,2].map(a=>maps.normal[k+a]/255*2-1);
    const measured=-n.reduce((sum,v,a)=>sum+v*east[a],0)/n.reduce((sum,v,a)=>sum+v*d[a],0);
    assert.ok(Math.abs(measured-slope)<.015,'wrapped normals describe the measured canonical slope');
  }
});

test('orbital maps follow the selected planet seed',()=>{
  const original=generateOrbitalSurface({width:32});
  try{
    setPlanetSeed(48291);
    assert.notDeepEqual(generateOrbitalSurface({width:32}).color,original.color);
  }finally{setPlanetSeed(DEFAULT_SEED);}
  assert.deepEqual(generateOrbitalSurface({width:32}),original);
});

for(const [body,generate,radius,heightAt] of [
  ['aeon',generatePatch,RADIUS,(d)=>terrainHeight(...d)],
  ['selene',generateMoonPatch,MOON_RADIUS,(d)=>moonSurface(...d).height],
])test(`${body} dense flight meshes retain the canonical floor and coarse/fine shared vertices`,()=>{
  for(const level of [4,9,13,14]){
    const tile={face:4,level,ix:Math.floor(2**level*.45),iy:Math.floor(2**level*.57)};
    const coarse=generate({...tile,grid:16}),dense=generate({...tile,grid:32});
    assert.equal(dense.positions.length/3,33*33+4*33);
    assert.equal(dense.indices.length,32*32*6+4*32*6,'all four skirts remain');
    for(const index of dense.indices)assert.ok(index<dense.positions.length/3);
    for(let y=0;y<=16;y++)for(let x=0;x<=16;x++){
      const i=(y*17+x)*3,j=(y*2*33+x*2)*3;
      for(let a=0;a<3;a++)assert.equal(dense.positions[j+a],coarse.positions[i+a]);
      const d=cubeDirection(tile.face,-1+(tile.ix+x/16)*2/2**level,-1+(tile.iy+y/16)*2/2**level);
      for(let a=0;a<3;a++)assert.ok(Math.abs(dense.center[a]+dense.positions[j+a]-d[a]*(radius+heightAt(d)))<.01);
    }
    for(const values of [dense.positions,dense.normals,dense.colors])assert.ok(values.every(Number.isFinite));
  }
  assert.throws(()=>generate({face:0,level:4,ix:1,iy:1,grid:256}));
});

test('flight density is bounded and orbital allocation rejects invalid requests',()=>{
  assert.equal(terrainGridForLevel(3),16);assert.equal(terrainGridForLevel(4),32);
  assert.equal(terrainGridForLevel(13),32);assert.equal(terrainGridForLevel(14),16);
  for(const request of [{width:8192},{width:3},{height:1},{body:'unknown'}])assert.throws(()=>generateOrbitalSurface(request));
});

for(const [body,generate] of [['aeon',generatePatch],['selene',generateMoonPatch]])test(`${body} flight map boundaries and texture ownership stay stable`,()=>{
  const tile={face:4,level:10,ix:410,iy:540,grid:32,surfaceDetail:true};
  const a=generate(tile).field,b=generate({...tile,ix:tile.ix+1}).field;
  assert.equal(a.width,65);
  for(let y=0;y<a.width;y++)for(const name of ['color','normal']){
    const i=(y*a.width+64)*4,j=y*a.width*4;
    assert.deepEqual(a[name].slice(i,i+4),b[name].slice(j,j+4),'neighbouring fields share colour and relief texels');
  }
  const uv=patchSurfaceUV(32,65);
  assert.ok(Math.abs(uv[0]-.5/65)<1e-7);
  assert.ok(Math.abs(uv[32*2]-64.5/65)<1e-7);
  assert.ok(uv.every(v=>v>0&&v<1),'skirts also sample inside the texture border');
  const base=new MeshStandardMaterial(),material=patchSurfaceMaterial(base,a);
  let released=0;for(const texture of [material.map,material.normalMap])texture.addEventListener('dispose',()=>released++);
  assert.equal(material.color,base.color,'eclipse tint remains shared');
  material.dispose();base.dispose();assert.equal(released,2,'eviction releases both owned textures');
});
