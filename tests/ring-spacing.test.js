import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {ANGULAR_CELLS,RADIAL_CELLS,VERTICAL_CELLS,ROCKS_PER_CELL,RING_POPULATION,RING_RADIUS,RING_WIDTH,RING_THICKNESS,RING_NORMAL,LEGACY_RING_POPULATION,asteroidDescriptor,asteroidDescriptorV1,cellId,ringRock,ringCellAt,nearbyAsteroids} from '../src/ring-world.js';
import {MOON_POSITION} from '../src/moon-world.js';
const descriptors=Array.from({length:RING_POPULATION},(_,id)=>asteroidDescriptor(id));
const positions=descriptors.map(d=>new Vector3(...d.position));

test('sparse v2 belt retains at least 2 km of clear space between all possible nearest neighbors, including its seam',()=>{
  assert.equal(RING_POPULATION,14336);assert.equal(ANGULAR_CELLS,2048);assert.equal(RADIAL_CELLS,7);assert.equal(VERTICAL_CELLS,1);assert.equal(ROCKS_PER_CELL,1);
  let minimum=Infinity,pair=null;
  for(let a=0;a<ANGULAR_CELLS;a++)for(let r=0;r<RADIAL_CELLS;r++){
    const id=cellId(a,r,0);
    // Any sector or row more than two cells away has >5 km center separation;
    // only this wrapped neighborhood can approach the 2 km clearance bound.
    for(let da=-2;da<=2;da++)for(let dr=-2;dr<=2;dr++){
      if(r+dr<0||r+dr>=RADIAL_CELLS)continue;const other=cellId(a+da,r+dr,0);if(other<=id)continue;
      const clearance=positions[id].distanceTo(positions[other])-1.95*(descriptors[id].size+descriptors[other].size);
      if(clearance<minimum){minimum=clearance;pair=[id,other];}
    }
  }
  assert.ok(minimum>=2000,`minimum bounding-sphere clearance ${minimum}m at ${pair}`);
});

test('v2 population contains varied large rocks and a quarter mineable survey deposits inside the nominal belt',()=>{
  const normal=new Vector3(...RING_NORMAL),families=new Set(),variants=new Set();let small=0;
  for(const d of descriptors){
    const p=positions[d.id],height=p.dot(normal),radius=p.clone().addScaledVector(normal,-height).length();
    assert.ok(Math.abs(height)+d.size*1.95<RING_THICKNESS/2);assert.ok(Math.abs(radius-RING_RADIUS)+d.size*1.95<RING_WIDTH/2);
    assert.equal(d.key,`selene-ring-v2-${d.id}`);assert.ok(d.size===1||d.size>=24&&d.size<=140);assert.equal(d.mineable,d.size===1);
    if(d.mineable)small++;else variants.add(d.variant);families.add(d.family);
    if(d.id%37===0)assert.deepEqual(d,asteroidDescriptor(d.id));
  }
  assert.equal(small,RING_POPULATION/4);assert.equal(families.size,6);assert.equal(variants.size,4);assert.ok(ringRock(5).mineable);
  assert.throws(()=>asteroidDescriptor(RING_POPULATION));
});

test('staggered v2 descriptors remain in their own streaming cells and large reaches never duplicate ids',()=>{
  const center=new Vector3(...MOON_POSITION);
  for(let id=0;id<RING_POPULATION;id+=13){
    const point=positions[id].clone().add(center),cell=ringCellAt(point);
    assert.deepEqual(cell,[Math.floor(id/RADIAL_CELLS),id%RADIAL_CELLS,0]);
    assert.ok(nearbyAsteroids(point,0).some(d=>d.id===id));
    assert.ok(nearbyAsteroids(point,2).length<=25);
  }
  for(const id of [0,3,6,RING_POPULATION-1]){
    const near=nearbyAsteroids(positions[id].clone().add(center),32);
    assert.equal(new Set(near.map(d=>d.id)).size,near.length);assert.ok(near.some(d=>d.id===id));assert.ok(near.length<=65*7);
  }
  assert.equal(nearbyAsteroids(center,2).length,0);assert.throws(()=>nearbyAsteroids(center,-1));
});

test('v1 descriptor coordinates and rotations stay bit-exact for existing mining saves',()=>{
  assert.equal(LEGACY_RING_POPULATION,20971520);
  const fixtures=[
    {id:0,position:[821358.0215551474,-244369.9612541496,-255443.16756653585],rotation:[3.418940078589005,5.590188572375387,2.2342480368273665],size:13.87505676714708,family:1},
    {id:523645,position:[781969.3885482905,-230175.73489802756,-390503.31459768437],rotation:[3.0389764507101944,5.782328984846228,4.338995316136949],size:1,family:2},
    {id:20971519,position:[839550.1366742887,-248230.2333180658,-260150.4023599483],rotation:[2.2901556441407616,1.7145857504415487,5.049729504017266],size:1,family:2},
  ];
  for(const fixture of fixtures){const d=asteroidDescriptorV1(fixture.id);assert.equal(d.key,`selene-ring-v1-${d.id}`);for(const [key,value] of Object.entries(fixture))assert.deepEqual(d[key],value);}
  assert.throws(()=>asteroidDescriptorV1(LEGACY_RING_POPULATION));
});
