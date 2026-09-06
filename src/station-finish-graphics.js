import * as THREE from 'three';
import {stationFinishPalette} from './station-finish-palette.js';

// One small print set per loaded station, shared by all twenty cloned berths.
// Coordinates are game-local metres, with the aft wall facing -Z. These meshes
// deliberately use Sign_/Detail names: paper and frame trim add no floor bumps.
const ATLAS = Object.freeze({freight:[0,0,640,960],safety:[672,0,352,440],inspection:[672,472,352,220],serial:[672,724,352,160]});
const UNIT_BOX = new THREE.BoxGeometry(1,1,1);
let shared;

function colourTexture(texture){
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function printMaterial(map){
  const material=new THREE.MeshStandardMaterial({map,color:'white',roughness:.88,metalness:0});
  material.name='StationPrintLaminate';material.userData.unweathered=true;return material;
}
function fallbackTexture(){
  const texture=new THREE.DataTexture(new Uint8Array([216,207,182,255]),1,1);texture.needsUpdate=true;return colourTexture(texture);
}
function atlasTexture(){
  if(typeof document==='undefined')return fallbackTexture();
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
  const ctx=canvas.getContext('2d');
  if(!ctx)return fallbackTexture();
  const texture=colourTexture(new THREE.CanvasTexture(canvas));texture.name='StationSharedPrintAtlas';
  const draw=()=>{
    const css=typeof getComputedStyle==='function'?getComputedStyle(document.documentElement):null;
    const p=stationFinishPalette();p.ink=p.petrol;
    const mono=css?.getPropertyValue('--mono').trim()||'monospace';
    const display=css?.getPropertyValue('--station-display').trim()||'sans-serif';
    const text=(copy,x,y,size=24,font=display,colour=p.ink)=>{ctx.fillStyle=colour;ctx.font=`600 ${size}px ${font}`;ctx.fillText(copy,x,y);};
    const rect=(x,y,w,h,colour)=>{ctx.fillStyle=colour;ctx.fillRect(x,y,w,h);};
    const line=(points,colour,width=3)=>{ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
    ctx.clearRect(0,0,1024,1024);ctx.textBaseline='alphabetic';ctx.textAlign='left';
    rect(0,0,640,960,p.paper);rect(20,20,600,920,p.ink);
    text('AEON',46,120,94,undefined,p.paper);text('ORBITAL FREIGHT',48,163,34,undefined,p.ochre);
    line([[48,185],[592,185]],p.muted,2);
    // Original flat screen-print illustration: orbital transfer lanes around a
    // cargo pallet. Precise service copy stays authored rather than generated.
    ctx.save();ctx.beginPath();ctx.rect(30,208,580,478);ctx.clip();
    ctx.fillStyle=p.muted;ctx.beginPath();ctx.arc(468,351,120,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.ink;ctx.beginPath();ctx.arc(435,327,118,0,Math.PI*2);ctx.fill();
    for(const [x,y] of [[70,238],[163,321],[310,247],[553,229],[553,467],[94,467]])rect(x,y,3,3,p.paper);
    ctx.strokeStyle=p.ochre;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(329,433,322,77,-.47,0,Math.PI*2);ctx.stroke();
    const cargo=(x,y,w,h)=>{
      rect(x,y,w,h,p.paper);rect(x+7,y+8,w-14,h-16,p.muted);
      for(let dx=18;dx<w-12;dx+=24)rect(x+dx,y+10,3,h-20,p.ink);
      rect(x+10,y+17,w-20,7,p.ochre);rect(x+w-39,y+h-35,24,14,p.paper);
      rect(x,y+h-4,w,4,p.ink);
    };
    cargo(88,470,216,110);cargo(316,470,230,110);cargo(204,348,216,110);
    rect(72,590,486,16,p.paper);rect(99,606,80,24,p.ochre);rect(452,606,80,24,p.ochre);
    line([[64,654],[576,654]],p.muted,2);ctx.restore();
    text('FROM YOUR HOLD.',48,745,53,undefined,p.paper);text('TO THE HORIZON.',48,809,53,undefined,p.paper);
    text('STORE / TRANSFER / EXPLORE',48,872,20,mono,p.ochre);
    text('FREIGHT SERVICES  •  AEON ORBITAL',48,912,15,mono,p.paper);

    // Safety notice: a load-restraint diagram, never a luminous UI substitute.
    rect(672,0,352,440,p.paper);rect(672,0,352,66,p.ochre);
    text('SECURE YOUR LOAD',690,46,33);
    rect(733,144,230,122,p.ink);rect(744,156,208,96,p.muted);
    for(const x of [774,900])rect(x,130,12,148,p.ochre);
    rect(721,277,255,14,p.ink);rect(742,291,37,18,p.ink);rect(919,291,37,18,p.ink);
    line([[716,119],[748,98],[936,98],[969,119]],p.ink,3);
    text('01  LOCK THE RESTRAINTS',692,347,17,mono);
    text('02  KEEP AISLES CLEAR',692,380,17,mono);
    text('03  CHECK BEFORE FLIGHT',692,413,17,mono);

    rect(672,472,352,220,p.paper);rect(672,472,352,43,p.ink);
    text('SERVICE / INSPECTION',690,502,24,undefined,p.paper);
    text('AEON FACILITIES   /   04',690,544,16,mono);
    text('CHECKED  _____________',690,577,17,mono);
    text('TECH ID  _____________',690,611,17,mono);
    text('ISOLATE BEFORE SERVICE',690,657,20,undefined,p.ink);
    rect(690,667,304,4,p.ochre);
    rect(672,724,352,160,p.paper);text('AEON // EQUIPMENT',687,758,23);
    for(let i=0;i<70;i++){const width=1+(i*13%4);rect(688+i*4.4,780,width,45,p.ink);}
    text('AX-2048 / STATION PROPERTY',688,856,15,mono);
    texture.needsUpdate=true;
  };
  draw();
  // Canvas textures are still readable with the local fallback while optional
  // web fonts load. No network font is required for gameplay or texture creation.
  document.fonts?.ready.then(draw).catch(()=>{});
  return texture;
}
function resources(){
  if(shared)return shared;
  const atlas=atlasTexture();
  // Display the authored freight print immediately, including when the optional
  // Selene image cannot load. This clone shares the atlas source pixels and only
  // changes its sampling rectangle to fit the full poster UVs.
  const seleneFallback=atlas.clone();
  seleneFallback.repeat.set(640/1024,960/1024);seleneFallback.offset.set(0,64/1024);
  seleneFallback.needsUpdate=true;
  const palette=stationFinishPalette();
  const steel=new THREE.MeshStandardMaterial({color:palette.steel,roughness:.43,metalness:.78});
  const backing=new THREE.MeshStandardMaterial({color:palette.dark,roughness:.82,metalness:.12});
  steel.name='StationPrintFrame';backing.name='StationPrintBacking';
  steel.userData.unweathered=backing.userData.unweathered=true;
  shared={selene:printMaterial(seleneFallback),atlas:printMaterial(atlas),steel,backing,planes:new Map()};
  const resource=shared;
  resource.ready=typeof document==='undefined'?Promise.resolve(false):new THREE.TextureLoader()
    .loadAsync('/textures/station/poster-selene.webp')
    .then(texture=>{
      resource.selene.map=colourTexture(texture);resource.selene.needsUpdate=true;
      seleneFallback.dispose();return true;
    })
    .catch(()=>false); // Keep the complete freight artwork; never reject readiness.
  return shared;
}
function printGeometry(key,width,height){
  const r=resources(),cacheKey=`${key}:${width}:${height}`;
  if(r.planes.has(cacheKey))return r.planes.get(cacheKey);
  const geometry=new THREE.PlaneGeometry(width,height);
  if(ATLAS[key]){
    const [x,y,w,h]=ATLAS[key],uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*w)/1024,1-(y+(1-uv.getY(i))*h)/1024);
  }
  r.planes.set(cacheKey,geometry);return geometry;
}

export function createStationFinishGraphics(){
  const r=resources(),group=new THREE.Group();group.name='Sign_StationFinishedPrints';
  // Kept outside userData so Object3D.clone's JSON copy remains plain data.
  group.readyPromise=r.ready;
  const frames=[],backs=[];
  const box=(list,size,position)=>list.push({size,position});
  const poster=(key,x,y,z,width,height,title)=>{
    // Five centimetre metal surround with a recessed, matte laminated print.
    box(backs,[width+.11,height+.11,.065],[x,y,z+.036]);
    for(const dx of [-1,1])box(frames,[.036,height+.1,.054],[x+dx*(width/2+.031),y,z]);
    for(const dy of [-1,1])box(frames,[width+.1,.036,.054],[x,y+dy*(height/2+.031),z]);
    for(const dx of [-1,1])for(const dy of [-1,1])box(frames,[.075,.027,.020],[x+dx*(width/2-.07),y+dy*(height/2-.016),z-.016]);
    const mesh=new THREE.Mesh(printGeometry(key,width,height),key==='selene'?r.selene:r.atlas);
    mesh.name=`Sign_Print_${title}`;mesh.position.set(x,y,z-.006);mesh.rotation.y=Math.PI;mesh.receiveShadow=true;group.add(mesh);
  };
  poster('selene',-5.1,-5.72,25.15,1.12,1.68,'Selene');
  poster('freight',-7.05,-5.72,25.15,1.12,1.68,'AeonFreight');
  // Keep clear of the original cargo backing cabinet, whose edge is at x=-9.
  poster('safety',-8.3,-5.9,25.15,.70,.875,'CargoSafety');
  poster('inspection',-4.95,-7.10,25.15,.32,.20,'Inspection');
  poster('serial',-7.03,-7.08,25.15,.32,.145,'EquipmentSerial');
  const dummy=new THREE.Object3D();
  for(const [name,items,material] of [['Frame',frames,r.steel],['Backing',backs,r.backing]]){
    const mesh=new THREE.InstancedMesh(UNIT_BOX,material,items.length);mesh.name=`Detail_Print${name}`;
    items.forEach(({size,position},i)=>{dummy.position.set(...position);dummy.scale.set(...size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.prints={count:5,textureFiles:['/textures/station/poster-selene.webp'],sharedAtlasSize:1024};
  return group;
}
