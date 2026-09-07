// Finite actual-asset delta diagnostic. It does not author or alter geometry.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readAsset, ray, T} from '../../../../scripts/rover-review/asset.mjs';
import {ASSET, LAYOUT, outputPath} from '../../../../scripts/rover-review/config.mjs';

const beforeFile = process.env.ROVER_BEFORE_GLB;
const beforeLayout = process.env.ROVER_BEFORE_LAYOUT;
if (!beforeFile || !beforeLayout) throw Error('Set ROVER_BEFORE_GLB and ROVER_BEFORE_LAYOUT to the retained baseline.');
const before = readAsset('before', beforeFile), after = readAsset('after', ASSET);
const beforeFrame = before.frame(), afterFrame = after.frame();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const failures = [];
const check = (value, reason) => { if (!value) failures.push(reason); return Boolean(value); };
const cyclic = rows => [0,1,2].map(i => [rows[i],rows[(i+1)%3],rows[(i+2)%3]].join('|')).sort()[0];
const add = (bag, key, data) => { const entry=bag.get(key);if(entry)entry.count++;else bag.set(key,{count:1,...data}); };
function triangles(asset, frame) {
  const bag=new Map(), plain=new Map(), glazing=new Map();
  for(const mesh of frame.meshes){
    const node=asset.j.nodes[mesh.node],p=asset.j.meshes[node.mesh].primitives;
    if(p.length!==1)throw Error('This diagnostic requires one primitive per measured mesh.');
    const primitive=p[0],attrs=Object.fromEntries(Object.entries(primitive.attributes).map(([name,id])=>[name,asset.access(id)]));
    const material=asset.j.materials[primitive.material];
    const prefix=mesh.name+'|'+material.name+'|';
    for(let i=0;i<mesh.indices.length;i+=3){
      const ids=mesh.indices.slice(i,i+3),positions=ids.map(id=>mesh.vertices[id].toArray());
      const record={node:mesh.name,material:material.name,positions};
      const corners=ids.map(id=>JSON.stringify(Object.keys(attrs).sort().map(name=>[name,attrs[name][id]])));
      add(bag,prefix+cyclic(corners),record);
      add(plain,prefix+cyclic(positions.map(p=>JSON.stringify(p))),record);
      if(material.alphaMode==='BLEND'&&material.name.startsWith('Pressure glazing'))add(glazing,prefix+cyclic(corners),record);
    }
  }
  return {bag,plain,glazing};
}
function delta(a,b){const removed=[],added=[];let identical=0;
  for(const key of new Set([...a.keys(),...b.keys()])){
    const x=a.get(key),y=b.get(key),n=x?.count??0,m=y?.count??0;identical+=Math.min(n,m);
    if(n>m)removed.push({...x,count:n-m});if(m>n)added.push({...y,count:m-n});
  }
  return {identical,removedCount:removed.reduce((n,v)=>n+v.count,0),addedCount:added.reduce((n,v)=>n+v.count,0),removed,added};
}
const a=triangles(before,beforeFrame),b=triangles(after,afterFrame);
const world=delta(a.plain,b.plain),attributes=delta(a.bag,b.bag),glazing=delta(a.glazing,b.glazing);
const allowed=new T.Box3(new T.Vector3(-.027,1.32,-1.691),new T.Vector3(.027,2.38,-1.128));
check(world.removedCount===44&&world.addedCount===0,'World delta is not exactly the isolated 44-triangle strut removal.');
check(attributes.removedCount===44&&attributes.addedCount===0,'Other triangle-corner attributes changed (normals/UVs/positions).');
check(world.removed.every(t=>t.positions.every(p=>allowed.containsPoint(new T.Vector3(...p)))),'A removed triangle lies outside the central strut.');
check(glazing.removedCount===0&&glazing.addedCount===0,'A pressure glazing triangle or corner attribute changed.');
const layoutIdentical=check(fs.readFileSync(beforeLayout).equals(fs.readFileSync(LAYOUT)),'Canonical rover layout changed.');
const nodesIdentical=check(same(before.j.nodes,after.j.nodes),'Named hierarchy, pivots, transforms or extras changed.');
const materialsIdentical=check(same(before.j.materials,after.j.materials),'Material definition changed.');
check(same(before.j.scenes,after.j.scenes)&&same(before.j.animations,after.j.animations)&&same(before.j.skins,after.j.skins),'Scene membership or animation/skin contract changed.');
check(same(beforeFrame.bounds.min.toArray(),afterFrame.bounds.min.toArray())&&same(beforeFrame.bounds.max.toArray(),afterFrame.bounds.max.toArray()),'Rest bounds changed.');
function images(file,asset){const bytes=fs.readFileSync(file),base=28+bytes.readUInt32LE(12);return asset.j.images.map(image=>{const view=asset.j.bufferViews[image.bufferView],start=base+(view.byteOffset??0);return {mimeType:image.mimeType,bytes:view.byteLength,sha256:hash(bytes.subarray(start,start+view.byteLength))};});}
const texturesBefore=images(beforeFile,before),texturesAfter=images(ASSET,after);
check(same(texturesBefore,texturesAfter)&&same(before.j.textures,after.j.textures)&&same(before.j.samplers,after.j.samplers),'Embedded maps or texture bindings changed.');
const layout=JSON.parse(fs.readFileSync(LAYOUT)),eye=new T.Vector3(...layout.cabin.pilotEye);
function filteredFrame(asset,frame,transparent){return {...frame,meshes:frame.meshes.filter(mesh=>{const p=asset.j.meshes[asset.j.nodes[mesh.node].mesh].primitives[0],material=asset.j.materials[p.material];return (material.alphaMode==='BLEND')===transparent;})};}
const opaqueBefore=filteredFrame(before,beforeFrame,false),opaqueAfter=filteredFrame(after,afterFrame,false),glassAfter=filteredFrame(after,afterFrame,true),rays=[];
for(let i=0;i<20;i++){
  const y=1.50+i*.04,z=-1.66+(y-1.36)*.49/.965,target=new T.Vector3(0,y,z),direction=target.clone().sub(eye).normalize(),far=eye.distanceTo(target)+.065;
  const blockedBefore=ray(opaqueBefore,eye,direction,before,-1,far),blockedAfter=ray(opaqueAfter,eye,direction,after,-1,far),pane=ray(glassAfter,eye,direction,after,-1,far);
  rays.push({target:target.toArray(),before:blockedBefore,after:blockedAfter,pane});
}
check(rays.every(r=>r.before&&!r.after&&r.pane),'A sampled central sightline is not newly unobstructed through the retained pane.');
const result={pass:!failures.length,failures,beforeSHA:before.sha256,afterSHA:after.sha256,beforeBytes:before.bytes,afterBytes:after.bytes,trianglesBefore:beforeFrame.triangles,trianglesAfter:afterFrame.triangles,world,attributes:{identical:attributes.identical,removed:attributes.removedCount,added:attributes.addedCount},glazing:{identical:glazing.identical,removed:glazing.removedCount,added:glazing.addedCount},layoutIdentical,nodesIdentical,materialsIdentical,texturesBefore,texturesAfter,restBounds:{min:afterFrame.bounds.min.toArray(),max:afterFrame.bounds.max.toArray()},rays,method:'Winding-preserving exact decoded world and per-node triangle-corner multisets; no rounding. Twenty finite actual triangle rays from canonical pilot eye; transparent pane retained.',scope:'CPU geometry/attribute/rig delta and limited central sightline proof. No GPU, shader, native image, structural load or whole-game acceptance claim.'};
fs.writeFileSync(outputPath('windscreen-delta.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,world:{identical:world.identical,removed:world.removedCount,added:world.addedCount},rays:rays.length},null,2));
if(failures.length)process.exitCode=1;
