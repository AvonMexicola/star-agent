import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stationFinishPalette } from './station-finish-palette.js';

// One shared print sheet, one shared textile and an independent fine weave.
// Artwork supplies colour only: the textile normal response never follows its stains.
const SIZE=1024;
const TILES={west:[0,0,384,512],westGear:[0,512,384,512],east:[384,0,384,512],eastParts:[384,512,384,512],westBanner:[768,0,256,256],eastBanner:[768,256,256,256]};
for(let i=0;i<3;i++)TILES['shelf'+i]=[0,256+i*74,1024,74];
for(let i=0;i<3;i++)TILES['shelf'+(i+3)]=[0,478+i*38,1024,38];
TILES.westNote=[768,800,256,112];TILES.eastNote=[768,912,256,112];
TILES.westWordmark=[0,0,1024,128];TILES.eastWordmark=[0,128,1024,128];
let sharedPromise;

function weaveTexture(){
  const size=128,data=new Uint8Array(size*size*4);
  let seed=4819;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=205+((x+y)%4<2?19:0)+(seed>>>28),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(8,8);texture.needsUpdate=true;texture.name='Shop independent woven fibre';
  return texture;
}
function plainTexture(color){
  const c=new THREE.Color(color).convertLinearToSRGB();
  const map=new THREE.DataTexture(new Uint8Array([Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255),255]),1,1);
  map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;return map;
}
function makePrintAtlas(image,p){
  if(typeof document==='undefined')return plainTexture(p.paper);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const ctx=canvas.getContext('2d');
  const style=typeof getComputedStyle==='function'?getComputedStyle(document.documentElement):null;
  const display=style?.getPropertyValue('--station-display').trim()||'sans-serif';
  const mono=style?.getPropertyValue('--mono').trim()||'monospace';
  ctx.fillStyle=p.paper;ctx.fillRect(0,0,SIZE,SIZE);
  function text(value,x,y,size,color=p.dark,family=display,weight=600,maxWidth){
    ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${family}`;ctx.textBaseline='top';ctx.fillText(value,x,y,maxWidth);
  }
  function mark(x,y,size,color,west){
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,size*.075);ctx.beginPath();
    if(west){ctx.moveTo(x,y);ctx.lineTo(x+size,y);ctx.lineTo(x+size*.9,y+size*.65);ctx.lineTo(x+size*.5,y+size);ctx.lineTo(x+size*.1,y+size*.65);ctx.closePath();ctx.moveTo(x+size*.28,y+size*.28);ctx.lineTo(x+size*.72,y+size*.28);ctx.moveTo(x+size*.5,y+size*.3);ctx.lineTo(x+size*.5,y+size*.66);}
    else{ctx.moveTo(x,y+size*.75);ctx.lineTo(x+size*.48,y);ctx.lineTo(x+size,y+size*.75);ctx.moveTo(x+size*.17,y+size*.65);ctx.lineTo(x+size*.8,y+size*.65);ctx.moveTo(x+size*.48,y+size*.1);ctx.lineTo(x+size*.48,y+size);}
    ctx.stroke();
  }
  for(const [key,quadrant,west,alternate] of [['west',0,true,false],['westGear',1,true,true],['east',2,false,false],['eastParts',3,false,true]]){
    const [x,y,w,h]=TILES[key],ink=west?p.petrol:p.dark,accent=west?p.mint:p.ochre;
    ctx.fillStyle=p.paper;ctx.fillRect(x+3,y+3,w-6,h-6);
    ctx.fillStyle=ink;ctx.fillRect(x+8,y+8,w-16,65);
    mark(x+22,y+22,31,accent,west);
    text(west?'WATCHKEEP':'KESTREL',x+67,y+13,35,p.paper,display,700,w-87);
    text(west?'ARMORY / FIELD EQUIPMENT':'SHIPWORKS / SERVICE PARTS',x+69,y+50,10,p.paper,mono,400,w-86);
    const ax=x+15,ay=y+82,aw=w-30,ah=270;
    if(image){
      const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
      // Four deliberately isolated crops; no neighbouring campaign enters a print.
      ctx.drawImage(image,(quadrant%2)*iw/2+3,Math.floor(quadrant/2)*ih/2+3,iw/2-6,ih/2-6,ax+(aw-ah)/2,ay,ah,ah);
    }else{
      ctx.fillStyle=ink;ctx.fillRect(ax,ay,aw,ah);mark(ax+aw/2-45,ay+45,90,accent,west);
      text(west?'FIELD EQUIPMENT':'FLIGHT HARDWARE',ax+25,ay+186,25,p.paper,display,600,aw-50);
      text('AEON / RETAIL SERVICES',ax+25,ay+226,12,p.paper,mono,400,aw-50);
    }
    text(west?'KEEP YOUR':'KEEP HER',x+22,y+365,46,ink,display,700,w-44);
    text(west?'WATCH.':'FLYING.',x+22,y+407,46,ink,display,700,w-44);
    ctx.fillStyle=west?p.petrol:p.ochre;ctx.fillRect(x+22,y+461,w-44,3);
    text(alternate?(west?'EQUIP / MAINTAIN / REPEAT':'FILTERS / PARTS / PRACTICAL ADVICE'):(west?'READY FOR THE NEXT SHIFT':'CARE FOR THE SHIP THAT CARRIES YOU'),x+22,y+477,10,ink,mono,400,w-44);
    text(west?'WATCHKEEP  /  AEON CONCOURSE':'KESTREL  /  AEON CONCOURSE',x+22,y+493,8,ink,mono,400,w-44);
  }
  for(const west of [true,false]){
    const [x,y,w,h]=TILES[west?'westBanner':'eastBanner'],ink=west?p.paper:p.dark,bg=west?p.petrol:p.ochre;
    ctx.fillStyle=bg;ctx.fillRect(x+3,y+3,w-6,h-6);
    ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.strokeRect(x+12,y+12,w-24,h-24);
    mark(x+102,y+28,52,ink,west);
    text(west?'WATCHKEEP':'KESTREL',x+23,y+96,35,ink,display,700,w-46);
    text(west?'ARMORY':'SHIPWORKS',x+23,y+137,25,ink,display,600,w-46);
    text(west?'KEEP YOUR WATCH.':'KEEP HER FLYING.',x+23,y+188,12,ink,mono,400,w-46);
    text(west?'FIELD GEAR / SIDEARMS':'SHIP COMPONENTS',x+23,y+214,10,ink,mono,400,w-46);
  }
  for(const west of [true,false]){
    const [x,y,w,h]=TILES[west?'westNote':'eastNote'];ctx.fillStyle=p.paper;ctx.fillRect(x+3,y+3,w-6,h-6);
    text(west?'CARE AFTER EVERY SHIFT':'SERVICE BEFORE DEPARTURE',x+12,y+12,18,p.dark,display,600,w-24);
    text(west?'01  CHECK SEALS':'01  CHECK FILTERS',x+12,y+44,12,p.dark,mono,400,w-24);
    text(west?'02  CLEAN / STOW DRY':'02  INSPECT CONNECTIONS',x+12,y+64,12,p.dark,mono,400,w-24);
    text(west?'WATCHKEEP / FIELD NOTES':'KESTREL / WORKSHOP NOTES',x+12,y+90,9,p.dark,mono,400,w-24);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.name='Shop campaign / typography atlas';return texture;
}

function makeWordmarkAtlas(p){
  if(typeof document==='undefined')return plainTexture(p.paper);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');
  const style=typeof getComputedStyle==='function'?getComputedStyle(document.documentElement):null;
  const display=style?.getPropertyValue('--station-display').trim()||'sans-serif';
  for(const [west,y] of [[true,0],[false,128]]){
    ctx.textBaseline='middle';ctx.fillStyle=p.ivory;
    ctx.font=`700 99px ${display}`;ctx.fillText(west?'WATCHKEEP':'KESTREL',16,y+61,630);
    ctx.fillRect(670,y+30,3,67);
    ctx.font=`600 44px ${display}`;ctx.fillText(west?'ARMORY':'SHIPWORKS',697,y+49,310);
    ctx.font=`400 22px ${display}`;ctx.fillText(west?'FIELD EQUIPMENT':'SHIP COMPONENTS',697,y+91,310);
  }
  // Each category tile matches its physical fascia aspect: the long Kestrel
  // shelves must not stretch lettering six times wider than its authored shape.
  const categories=['LONG ARMS','SIDEARMS','FIELD EQUIPMENT','FILTERS / AIR','AVIONICS / SCANNERS','REPAIR / COUPLERS'];
  categories.forEach((label,i)=>{
    const [x,y,w,h]=TILES['shelf'+i],west=i<3;
    ctx.fillStyle=west?p.petrol:p.ochre;ctx.fillRect(x+3,y+3,w-6,h-6);
    ctx.fillStyle=west?p.paper:p.dark;ctx.font=`600 ${west?41:22}px ${display}`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+w/2,y+h/2,w-36);
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;texture.name='Shop rear-wall wordmarks / shelf categories';return texture;
}

/** Always resolves: failed campaign requests retain authored typography and a
 * charcoal woven fallback, without disabling the rest of the finished station. */
export function loadStationShopGraphics(){
  if(!sharedPromise)sharedPromise=(async()=>{
    const p=stationFinishPalette(),status={artwork:'fallback',carpet:'fallback'};
    const loader=new THREE.TextureLoader();
    let art=null,carpet=null;
    if(typeof document!=='undefined'){
      await document.fonts?.ready;
      const results=await Promise.allSettled([
        loader.loadAsync('/textures/station/shop-campaign-art.webp'),
        loader.loadAsync('/textures/station/shop-worn-carpet.webp'),
      ]);
      if(results[0].status==='fulfilled'){art=results[0].value;status.artwork='ready';}
      if(results[1].status==='fulfilled'){carpet=results[1].value;status.carpet='ready';}
    }
    const atlas=makePrintAtlas(art?.image,p);art?.dispose();
    carpet??=plainTexture(p.deck);carpet.name='Shop worn carpet colour';carpet.colorSpace=THREE.SRGBColorSpace;
    carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.anisotropy=8;
    const weave=weaveTexture();
    const paper=new THREE.MeshStandardMaterial({map:atlas,roughness:.96,metalness:0,bumpMap:weave,bumpScale:.0004,side:THREE.DoubleSide});
    const brand=new THREE.MeshStandardMaterial({map:makeWordmarkAtlas(p),roughness:.93,metalness:0,alphaTest:.3});
    const rug=new THREE.MeshStandardMaterial({map:carpet,vertexColors:true,roughness:1,roughnessMap:weave,bumpMap:weave,bumpScale:.0015});
    for(const [material,name] of [[paper,'Shop matte campaign paper'],[brand,'Shop painted rear-wall wordmarks'],[rug,'Shop worn woven carpet']]){
      material.name=name;material.userData={stationFinished:true,unweathered:true};
    }
    return {paper,brand,rug,status};
  })();
  return sharedPromise;
}

function tileGeometry(width,height,tile,cloth=false){
  const geometry=new THREE.PlaneGeometry(width,height,cloth?10:1,cloth?14:1);
  const uv=geometry.attributes.uv,[x,y,w,h]=TILES[tile];
  for(let i=0;i<uv.count;i++)uv.setXY(i,(x+5+uv.getX(i)*(w-10))/SIZE,1-(y+h-5-uv.getY(i)*(h-10))/SIZE);
  if(cloth){
    const position=geometry.attributes.position;
    for(let i=0;i<position.count;i++)position.setZ(i,.004*Math.sin((position.getX(i)/width+.5)*Math.PI*4)*Math.sin((position.getY(i)/height+.5)*Math.PI));
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Bake the GLB's print anchors into three shared local-metre render batches.
 * No print is a collider, shadow caster or individually allocated material. */
export function createStationShopGraphics(props,resources){
  const group=new THREE.Group();group.name='Shop retail graphics';
  group.userData.shopGraphics={...resources.status};
  const parts={paper:[],brand:[],rug:[]},placements=[];
  props.updateWorldMatrix(true,true);
  const inverseParent=props.parent?props.parent.matrixWorld.clone().invert():new THREE.Matrix4();
  function print(name,tile,size,{yaw=0,cloth=false,anchorOrientation=false,position,rotationX=0}={}){
    const anchor=props.getObjectByName(name);
    if(!anchor&&!position)return;
    let matrix;
    if(position)matrix=new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationX(rotationX)).setPosition(...position);
    else if(anchorOrientation)matrix=inverseParent.clone().multiply(anchor.matrixWorld);
    else{
      const point=anchor.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverseParent);
      matrix=new THREE.Matrix4().makeRotationY(yaw).setPosition(point);
    }
    const geometry=tileGeometry(...size,tile,cloth).applyMatrix4(matrix);
    parts[tile.endsWith('Wordmark')||tile.startsWith('shelf')?'brand':'paper'].push(geometry);
    placements.push({name,tile,size,position:new THREE.Vector3().setFromMatrixPosition(matrix).toArray()});
  }
  for(const [side,brand,main,alternate] of [[-1,'Watchkeep','west','westGear'],[1,'Kestrel','east','eastParts']]){
    const yaw=-side*Math.PI/2;
    print(brand+'WallBrand',main+'Wordmark',[5.8,.62],{yaw,position:[side*19.745,-4.94,-1]});
    print(brand+'PosterEnd',main,[1.2,1.7]);
    print(brand+'PosterGap0',alternate,[1.15,1.6],{yaw});
    print(brand+'PosterGap1',main,[1.15,1.6],{yaw});
    print(brand+'Banner',main+'Banner',[1.25,1.3],{yaw,cloth:true});
    for(let i=0;i<2;i++)print(brand+'Brochure'+i,i?alternate:main,[.148,.210],{anchorOrientation:true});
    [-7.1,5.1,-1].forEach((z,i)=>print(brand+'Shelf'+i,'shelf'+(i+(side<0?0:3)),side<0?[1.44,.09]:[2.74,.075],{yaw,position:[side<0?-19.043:18.6425,side<0?-7.62:-7.63,z]}));
    // Small practical care notes share the counter insert's scene lighting.
    print(brand+'CareNote',main+'Note',[.30,.13],{yaw,rotationX:-Math.PI/2,position:[side*12,-6.918,.35]});
    const rug=new THREE.PlaneGeometry(8.4,15.5).rotateX(-Math.PI/2).translate(side*14.2,-7.986,-1.1);
    const uv=rug.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*8.4/1.5,uv.getY(i)*15.5/1.5);
    const p=stationFinishPalette(),color=new THREE.Color(p.paper).lerp(new THREE.Color(side<0?p.petrol:p.ochre),.20);
    const colors=new Float32Array(rug.attributes.position.count*3);
    for(let i=0;i<rug.attributes.position.count;i++)color.toArray(colors,i*3);
    rug.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.rug.push(rug);
  }
  for(const [key,geometries] of Object.entries(parts)){
    if(!geometries.length)continue;
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(geometry,resources[key]);mesh.name=key==='rug'?'Detail_ShopCarpet':'Sign_Shop_'+key;
    mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.printPlacements=placements;
  return group;
}
