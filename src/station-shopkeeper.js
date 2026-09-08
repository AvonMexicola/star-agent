import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const SHOPKEEPER_URL='/models/characters/watchkeep-shopkeeper.glb';
export const SHOPKEEPER_IDLES=Object.freeze(['idle-04','idle-06','idle-07','idle-15']);
// Hub-local metres: behind the staff face of the x=-12 counter, facing customers.
export const SHOPKEEPER_PLACEMENT=Object.freeze({position:Object.freeze([-13.35,-8,0]),yaw:-Math.PI/2});

export const STATION_SHOPKEEPERS=Object.freeze({
  weapons:Object.freeze({name:'Watchkeep shopkeeper',url:SHOPKEEPER_URL,idles:SHOPKEEPER_IDLES,placement:SHOPKEEPER_PLACEMENT,height:1.72}),
  equipment:Object.freeze({name:'Kestrel shopkeeper',url:'/models/characters/kestrel-shopkeeper.glb',idles:Object.freeze(['idle-02','idle-03','idle-11','idle-12']),placement:Object.freeze({position:Object.freeze([13.35,-8,0]),yaw:Math.PI/2}),height:1.8}),
});

/** One full idle at a time, with a short overlap into the next supplied clip. */
export function createShopkeeperAnimator(model,clips,idles=SHOPKEEPER_IDLES){
  const ordered=idles.map(name=>clips.find(clip=>clip.name===name));
  if(ordered.some(clip=>!clip||!Number.isFinite(clip.duration)||clip.duration<1))throw new Error('Shopkeeper requires four valid idle clips');
  const mixer=new THREE.AnimationMixer(model),actions=ordered.map(clip=>mixer.clipAction(clip));
  const blend=Math.min(.65,...ordered.map(clip=>clip.duration/3));let index=0,elapsed=0,previous=null,fadeRemaining=0,transitions=0;
  actions[0].play();mixer.update(0);
  return {
    update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;
      const step=Math.min(dt,.1);elapsed+=step;
      if(previous){fadeRemaining-=step;if(fadeRemaining<=0){previous.stop();previous=null;}}
      if(elapsed>=ordered[index].duration-blend){
        const old=actions[index];index=(index+1)%actions.length;
        const next=actions[index];next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
        old.crossFadeTo(next,blend,false);previous=old;fadeRemaining=blend;elapsed=0;transitions++;
      }
      mixer.update(step);
    },
    get state(){return {currentClip:ordered[index].name,transitions,time:mixer.time,clipTime:actions[index].time,blending:Boolean(previous)};},
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);},
  };
}

function disposeModel(model){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  model.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);
    for(const material of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]){
      materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  for(const resource of [...skeletons,...geometries,...materials,...textures])resource.dispose();
}

/** Optional presentation only. No stock, damage, dialogue or network authority. */
export function createStationShopkeeper({definition=STATION_SHOPKEEPERS.weapons,loadAsset=()=>new GLTFLoader().loadAsync(definition.url)}={}){
  const group=new THREE.Group();group.name=definition.name;
  group.position.fromArray(definition.placement.position);group.rotation.y=definition.placement.yaw;group.visible=false;
  const torso=new THREE.Box3(new THREE.Vector3(-.32,0,-.28),new THREE.Vector3(.32,definition.height,.28));
  group.updateMatrix();torso.applyMatrix4(group.matrix);
  let status='idle',error=null,model=null,animator=null,disposed=false,promise=null;
  function load(){
    if(promise||disposed)return promise;
    status='loading';
    promise=Promise.resolve().then(loadAsset).then(asset=>{
      if(!asset?.scene?.isObject3D)throw new Error('Shopkeeper model is unavailable');
      if(disposed){disposeModel(asset.scene);return;}
      let meshes=0;asset.scene.traverse(node=>{if(node.isMesh)meshes++;});
      if(!meshes){disposeModel(asset.scene);throw new Error('Shopkeeper model is empty');}
      try{animator=createShopkeeperAnimator(asset.scene,asset.animations??[],definition.idles);}
      catch(failure){disposeModel(asset.scene);throw failure;}
      model=asset.scene;
      model.traverse(node=>{if(node.isMesh){node.frustumCulled=false;node.castShadow=true;node.receiveShadow=true;}});
      group.add(model);status='ready';
    }).catch(failure=>{if(!disposed){status='unavailable';error=failure.message;}});
    return promise;
  }
  return {group,
    update(dt,{visible=false,paused=false}={}){
      if(disposed)return;
      group.visible=visible;
      if(visible){load();if(!paused)animator?.update(dt);}
    },
    get readyPromise(){return promise;},
    get collisionBoxes(){return status==='ready'&&!disposed?[torso]:[];},
    get state(){return {status,error,visible:group.visible&&status==='ready',position:group.position.toArray(),...(animator?.state??{currentClip:null,transitions:0,time:0})};},
    dispose(){if(disposed)return;disposed=true;status='disposed';animator?.dispose();if(model)disposeModel(model);group.removeFromParent();group.clear();},
  };
}
