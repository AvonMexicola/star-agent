import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createShipMFDs} from './ship-mfd.js';
import {mountGeometrySlot} from './weapon-mounts.js';
import {shipHandling} from './ship-handling.js';

const CLIPS={canopy:'CanopyOpen',gear:'GearDown',ladder:'LadderDown'};
function afterburnerMaterial(tint){
 return new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{tint:{value:tint}},
  vertexShader:`
   varying float burn;varying vec3 viewNormal;varying vec3 eye;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){
    burn=clamp(position.z/1.62,0.0,1.0);viewNormal=normalize(normalMatrix*normal);
    vec4 mvPosition=modelViewMatrix*vec4(position,1.0);eye=-mvPosition.xyz;
    gl_Position=projectionMatrix*mvPosition;
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`
   uniform vec3 tint;varying float burn;varying vec3 viewNormal;varying vec3 eye;
   #include <common>
   #include <logdepthbuf_pars_fragment>
   void main(){
    #include <logdepthbuf_fragment>
    float fade=1.0-smoothstep(0.0,1.0,burn);
    float rim=pow(1.0-abs(dot(normalize(viewNormal),normalize(eye))),0.6);
    float cells=0.8+0.2*cos(burn*31.4);
    gl_FragColor=vec4(mix(tint,vec3(1.0),fade*0.35),fade*cells*(0.045+0.19*rim));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
}
/** Asset-only adapter. It owns visual mechanisms, with no flight/boarding teleport. */
export function createKestrel({url,flight=false}={}){
 if(!url)throw new Error('createKestrel requires the exported GLB URL.');
 const root=new THREE.Group();root.name=flight?'Meridian Kestrel':'Kestrel inspection assembly';
 root.userData.assetStatus='loading';root.userData.manufacturer='Meridian Shipworks';
 const values={canopy:0,gear:1,ladder:0},targets={...values};let mixer,asset,core,coreTint,actions={},throttle=.15,ready=false;
 const white=new THREE.Color(1,1,1),hardpoints=[];
 const mfd=createShipMFDs({height:384,profile:flight?'kestrel-flight':'kestrel'}),textures=mfd.screenTextures();
 const nav={flightEnvironment:{regime:'STUDIO',atmosphereFraction:0},normal:new THREE.Vector3(0,1,0),orientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),speed:0,altitude:.9,mode:'inspection',flightAssist:true,doorOpen:false,doorProgress:0,previewThrottle:throttle};
 nav.previewProgress=values;nav.previewTargets=targets;
 function evaluate(){for(const key of Object.keys(actions))actions[key].time=values[key]*actions[key].getClip().duration;mixer?.update(0);}
 root.readyPromise=new GLTFLoader().loadAsync(url).then(gltf=>{
  asset=gltf.scene;root.add(asset);mixer=new THREE.AnimationMixer(asset);
  asset.traverse(node=>{
   if(!node.name.startsWith('HP_')||node.userData.kind!=='weapon')return;
   const slot=mountGeometrySlot(node.userData.size);
   hardpoints.push({node:node.name,size:slot.size,mount:node.userData.mount,installedWeapon:node.userData.installedWeapon??null});
  });
  for(const [key,name] of Object.entries(CLIPS)){
   const clip=THREE.AnimationClip.findByName(gltf.animations,name);if(!clip)throw new Error(`Kestrel missing animation ${name}`);
   const action=mixer.clipAction(clip);action.play();action.paused=true;action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;actions[key]=action;
  }
  asset.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.userData.initiallyHidden||o.name.startsWith('AB_'))o.visible=false;}});
  for(let i=0;i<4;i++){
   const screen=asset.getObjectByName(`MFD_${i+1}`);if(!screen?.isMesh)throw new Error(`Kestrel missing MFD_${i+1}`);
   textures[i].flipY=false;screen.material=new THREE.MeshBasicMaterial({map:textures[i],toneMapped:false});screen.castShadow=false;screen.receiveShadow=false;
  }
  const hud=asset.getObjectByName('HUD_Glass');if(hud)hud.castShadow=false;
  asset.traverse(o=>{if(o.isMesh&&o.material.transparent)o.castShadow=false;});
  core=asset.getObjectByName('EngineCores');coreTint=core.material.emissive.clone();
  // Keep the dormant liner dark enough that emitted mint defines low thrust.
  // The final white-hot range comes from emission, not bright diffuse lighting.
  core.material.color.multiplyScalar(.18);
  const burn=afterburnerMaterial(coreTint.clone());
  for(const side of ['L','R']){const cone=asset.getObjectByName('AB_'+side);cone.material=burn;cone.castShadow=false;cone.receiveShadow=false;}
  evaluate();ready=true;root.userData.assetStatus='ready';root.userData.gearAssemblies=3;root.update(0);return root;
 }).catch(error=>{
  root.userData.assetStatus='error';root.userData.assetError=error.message;throw error;
 });
 root.command=(mechanism,on)=>{
  if(!ready||!(mechanism in targets))return{ok:false,reason:'The fighter is still loading.'};
  if(mechanism==='ladder'&&on&&(values.gear<.999||values.canopy<.999||targets.gear!==1||targets.canopy!==1))return{ok:false,reason:'Extend the gear and open the canopy before deploying the ladder.'};
  if(mechanism==='canopy'&&!on&&(values.ladder>.001||targets.ladder!==0))return{ok:false,reason:'Stow the ladder before closing the canopy.'};
  if(mechanism==='gear'&&!on&&(values.ladder>.001||targets.ladder!==0||values.canopy>.001||targets.canopy!==0))return{ok:false,reason:'Stow the ladder and close the canopy before retracting the gear.'};
  targets[mechanism]=on?1:0;return{ok:true};
 };
 root.setThrottle=value=>{throttle=THREE.MathUtils.clamp(Number(value)||0,0,1);};
 root.update=dt=>{
  if(!ready)return;dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,1);
  for(const key of flight?[]:Object.keys(values)){
   const delta=targets[key]-values[key],step=dt/actions[key].getClip().duration;
   values[key]+=Math.sign(delta)*Math.min(Math.abs(delta),step);
  }
  evaluate();nav.doorOpen=targets.canopy===1;nav.doorProgress=values.canopy;nav.previewThrottle=throttle;if(!flight)mfd.update(dt,nav,{mass:()=>0},null);
  if(core){core.material.emissive.copy(coreTint).lerp(white,Math.pow(throttle,1.6)*.84);core.material.emissiveIntensity=.22+2.6*throttle;}
  for(const side of ['L','R']){
   const cone=asset.getObjectByName('AB_'+side);if(cone){cone.visible=throttle>.72;cone.scale.set(1,1,Math.max(.01,(throttle-.72)/.28));}
  }
 };
 // Flight navigation owns the mechanism clocks. The 1.2 s source gear clip is
 // sampled at normalized progress from the game's shared 1.8 s gear policy.
 root.syncFlight=live=>{
  if(!flight)return;
  const access=live.kestrelAccess;
  values.canopy=access?.canopy??0;values.ladder=access?.ladder??0;values.gear=live.gearProgress;
  targets.canopy=access?.open?1:0;targets.ladder=targets.canopy;targets.gear=live.gearDeployed?1:0;
  root.setThrottle(live.powered&&live.mode==='flight'?Math.min(1,(live.engineAcceleration?.length()??0)/shipHandling('kestrel').thrust):0);
 };
 root.setDoor=()=>{};root.setStorage=()=>{};
 root.updateGear=(dt,deployed,progress)=>{if(flight){values.gear=progress;targets.gear=deployed?1:0;root.userData.gearProgress=progress;evaluate();}};
 root.updateDisplays=(dt,live,inventory,course)=>mfd.update(dt,live,inventory,course);
 root.displayState=()=>mfd.snapshot();
 root.snapshot=()=>({ready,progress:{...values},target:{...targets},throttle,displays:mfd.snapshot(),hardpoints:hardpoints.map(mount=>({...mount}))});
 root.getNode=name=>asset?.getObjectByName(name);
 root.dispose=()=>{
  mixer?.stopAllAction();const geos=new Set(),mats=new Set(),maps=new Set(textures);
  for(const tree of [asset,mfd])tree?.traverse(o=>{if(o.isMesh){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const value of Object.values(m))if(value?.isTexture)maps.add(value);}}});
  geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());root.clear();
 };
 return root;
}
