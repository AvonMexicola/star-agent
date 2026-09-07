import {padMarkingTexture} from './pad-markings.js';
import {padApproaches} from './pad-kit.js';
import { Mesh, PlaneGeometry, MeshStandardMaterial, TextureLoader, RepeatWrapping, SRGBColorSpace, EdgesGeometry, LineBasicMaterial, LineSegments, Color } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getPieceDefinition } from './definitions.js';
const loader=new GLTFLoader(), templates=new Map();
let finish;
const MINT=new Color(0xb6efd1),WARNING=new Color(0xe2bf87);

/** Per-instance fade uniforms, shared immutable geometry and texture resources.
 * Screen-door coverage keeps opaque kit surfaces in the normal depth pass. */
export function setBuildOpacity(root,opacity) {
  const state=root.userData.buildFinish??={uniform:{value:1},materials:new Map()};
  state.padPaint??={value:0};
  state.uniform.value=Math.max(0,Math.min(1,opacity));
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const prepare=source=>{
      if(source.userData.buildFadeUniform===state.uniform)return source;
      if(state.materials.has(source))return state.materials.get(source);
      const material=source.clone();
      material.userData.buildFadeUniform=state.uniform;
      const padUnderlay=root.userData.pieceType?.startsWith('foundation-pad-')&&['MineralConcrete','DarkPolymer'].includes(source.name);
      material.onBeforeCompile=shader=>{
        if(padUnderlay){
          // Replace the hidden deck/joint surface while keeping its original
          // shadow geometry. Depth-tested paint and beacon lenses remain separate.
          shader.uniforms.basePadPaint=state.padPaint;
          shader.vertexShader='varying vec2 basePadTop;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbasePadTop = vec2(transformed.y, normal.y);');
          shader.fragmentShader='uniform float basePadPaint; varying vec2 basePadTop;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif (basePadPaint > .5 && basePadTop.x > -.001 && ${source.name==='DarkPolymer'?'true':'basePadTop.y > .5'}) discard;`);
        }
        shader.uniforms.buildVisibility=state.uniform;
        shader.fragmentShader='uniform float buildVisibility;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>', `
          #include <dithering_fragment>
          float coverage = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
          if (coverage >= buildVisibility) discard;
        `);
      };
      material.customProgramCacheKey=()=>padUnderlay?`base-pad-coverage-v2-${source.name}`:'base-coverage-v1';
      state.materials.set(source,material);
      return material;
    };
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(prepare):prepare(mesh.material);
  });
}

/** Dispose instance materials only: GLTF geometry and finish textures are cached. */
export function disposeBuildVisual(root) {
  for(const material of root.userData.buildFinish?.materials.values()??[])material.dispose();
  const display=root.userData.statusDisplay;
  if(display){display.texture.dispose();display.mesh.geometry.dispose();display.sourceMaterial.dispose();}
  const markings=root.getObjectByName('LandingPadMarkings');if(markings){markings.geometry.dispose();root.userData.padMarkingMaterial?.dispose();}
  root.removeFromParent();
}
function concreteFinish() {
  return finish??=Promise.all(['albedo','bump'].map(role=>new TextureLoader().loadAsync(`/models/base/concrete-${role}.webp`))).then(([map,bumpMap])=>{
    for(const texture of [map,bumpMap]) {texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=4;}
    map.colorSpace=SRGBColorSpace;return {map,bumpMap};
  }).catch(error=>{finish=null;throw error;});
}
export async function createBuildVisual(piece) {
  const def=getPieceDefinition(piece);
  if(!def) throw new Error('Unknown building piece');
  if(!templates.has(def.id)) {
    const pending=Promise.all([loader.loadAsync(`/models/base/${def.id}.glb`),concreteFinish()]).then(([g,finish])=>{
      g.scene.traverse(o=>{ if(o.isMesh) {o.castShadow=!o.material.transparent;o.receiveShadow=true;if(o.material.name==='MineralConcrete') {Object.assign(o.material,finish,{bumpScale:.018});o.material.color.setRGB(1,1,1);o.material.needsUpdate=true;}} });
      return g.scene;
    }).catch(error=>{templates.delete(def.id);throw error;});
    templates.set(def.id,pending);
  }
  const root=(await templates.get(def.id)).clone(true);
  root.userData.pieceType=def.id;
  if(def.padSize){
    const markings=new Mesh(new PlaneGeometry(...def.footprint),new MeshStandardMaterial({map:padMarkingTexture(def),roughness:.92}));
    root.userData.padMarkingMaterial=markings.material;markings.name='LandingPadMarkings';markings.rotation.x=-Math.PI/2;markings.position.y=.005;markings.visible=Boolean(piece?.landingPad);markings.receiveShadow=true;root.add(markings);

  }
  setBuildOpacity(root,1);
  if(def.padSize)setLandingPadVisual(root,Boolean(piece?.landingPad),true);
  setDoorOpen(root,Number(piece?.doorOpen??0));
  return root;
}

/** The same authored mesh, pivots, glass and textures that placement will create. */
export async function createBuildGhost(piece) {
  const root=await createBuildVisual(piece);
  root.userData.ghostEdges=[];
  const meshes=[];root.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  for(const mesh of meshes){
    mesh.castShadow=false;mesh.receiveShadow=false;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      material.transparent=true;material.opacity=material.name==='WindowGlass'?.16:.52;
      material.depthWrite=false;
    }
    // Trim and surface joints remain textured; a restrained silhouette outline
    // makes glass openings and stair treads readable against bright terrain.
    if(mesh.material.name==='WindowGlass')continue;
    const edges=new LineSegments(new EdgesGeometry(mesh.geometry,38),new LineBasicMaterial({color:MINT,transparent:true,opacity:.48,depthWrite:false}));
    edges.name='Authored placement outline';edges.renderOrder=1;mesh.add(edges);
    root.userData.ghostEdges.push(edges);
  }
  setBuildGhostValid(root,true);
  if(getPieceDefinition(piece)?.padSize&&piece?.landingPad){root.userData.ghostParts=[];for(const p of padApproaches({...piece,position:[0,0,0],rotation:0})){const ramp=await createBuildGhost(p);ramp.position.fromArray(p.position);ramp.rotation.y=p.rotation;root.add(ramp);root.userData.ghostParts.push(ramp);}}
  return root;
}

export function setBuildGhostValid(root,valid) {
  for(const part of root.userData.ghostParts??[])setBuildGhostValid(part,valid);
  const color=valid?MINT:WARNING;
  for(const material of root.userData.buildFinish?.materials.values()??[]){
    material.color.copy(color);
    if(material.emissive){material.emissive.copy(color);material.emissiveIntensity=.48;}
  }
  for(const edge of root.userData.ghostEdges??[])edge.material.color.copy(color);
}

export function disposeBuildGhost(root) {
  for(const part of root.userData.ghostParts??[])disposeBuildGhost(part);
  for(const edge of root.userData.ghostEdges??[]){edge.geometry.dispose();edge.material.dispose();}
  disposeBuildVisual(root);
}
export function setDoorOpen(root,fraction) {
  const roller=root.getObjectByName('RollerCurtain');if(roller){const amount=Math.max(0,Math.min(1,fraction))*.96;roller.scale.y=1-amount;roller.position.y=5.39*amount;}
  const distance=Math.max(0,Math.min(1,fraction))*.8;
  const left=root.getObjectByName('DoorLeafLeft'),right=root.getObjectByName('DoorLeafRight');
  if(left)left.position.x=-distance;
  if(right)right.position.x=distance;
}

export function setBuildPowered(root,powered){
 if(root.userData.powered===powered)return;root.userData.powered=powered;
 for(const material of root.userData.buildFinish?.materials.values()??[])if(material.name==='MintStatus'||material.name==='WarmTaskLight'){
  material.userData.powerIntensity??=material.emissiveIntensity;material.emissiveIntensity=powered?material.userData.powerIntensity:material.name==='WarmTaskLight'?0:.015;
 }

}

/** White paint remains visible without electricity; only the runway lenses switch. */
export function setLandingPadVisual(root,enabled,powered){
 const markings=root.getObjectByName('LandingPadMarkings');if(markings)markings.visible=enabled;
 if(root.userData.buildFinish?.padPaint)root.userData.buildFinish.padPaint.value=enabled?1:0;
 const on=Boolean(enabled&&powered);if(root.userData.padLightsOn===on)return;root.userData.padLightsOn=on;
 for(const material of root.userData.buildFinish?.materials.values()??[])if(material.name==='LandingLens')material.emissiveIntensity=on?1.2:0;
}
