import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createHostileSimulation,FAUNA_SPECIES} from './hostile-simulation.js';
import {createPyrebearMedical} from './pyrebear-medical.js';
import {enumeratePyrebearSpawns,samplePyrebearHabitat} from './pyrebear-habitat.js';
import {enumerateSuloherSpawns,sampleSuloherHabitat} from './suloher-habitat.js';
import {PYRE_POSITION,toPyreBody} from '../pyre-world.js';
import {MIASMA_POSITION} from '../miasma-world.js';
import {bodyAltitude} from '../celestial.js';
import {faunaOrientation,raycastFauna,parkedShipHit} from './fauna-target.js';
import './hostile-fauna.css';

const ASSETS={pyrebear:'pyrebear',suloher:'suloher-dog'};
// Replaced from the measured manifests before an actor becomes damageable.
const DEFAULT_DIMENSIONS={pyrebear:{width:2.02,height:1.732,length:2.981},suloher:{width:1,height:1,length:2}};
const v=a=>new THREE.Vector3(...a);
export function createHostileFauna({scene,nav,loadout,seed=7291,online=()=>false,onSound=()=>{}}){
  const group=new THREE.Group();group.name='Hostile wildlife';scene.add(group);
  const medical=createPyrebearMedical({nav,loadout,enabled:()=>!online()});
  const assets=new Map(),actors=new Map(),dimensions=structuredClone(DEFAULT_DIMENSIONS);
  let disposed=false,queryClock=1,lastBody=null,shots=0,kills=0,lastHit=null,hudClock=1,hudTarget=null;
  const status=document.createElement('aside');status.id='fauna-status';status.hidden=true;
  status.innerHTML='<strong></strong><meter min="0" aria-label="Creature health"></meter><span></span>';document.body.append(status);
  const label=status.querySelector('strong'),meter=status.querySelector('meter'),detail=status.querySelector('span');
  function sampleGround(species,position){
    const center=species==='pyrebear'?PYRE_POSITION:MIASMA_POSITION,d=v(position).sub(v(center)).normalize();
    return species==='pyrebear'?samplePyrebearHabitat(toPyreBody(...d.toArray())):sampleSuloherHabitat(d.toArray());
  }
  function blocked(from,to,padding=0){
    const start=v(from),end=v(to),ray=end.clone().sub(start),range=ray.length();if(range<.001)return false;ray.divideScalar(range);
    if(parkedShipHit(nav,start,ray,range,padding)||nav.buildingRaycast?.(start,ray,range))return true;
    // Terrain occludes attacks even when both endpoints are legal standing spots.
    const steps=Math.max(1,Math.ceil(range/.5));
    for(let i=1;i<steps;i++)if(bodyAltitude(start.clone().lerp(end,i/steps),nav.body)<=0)return true;
    return false;
  }
  const simulation=createHostileSimulation({sampleGround,
    onAttack:event=>onSound({...event,point:v(event.position)}),
    canMove:(from,to,entity)=>{const up=v(entity.normal),a=v(from).addScaledVector(up,.65),b=v(to).addScaledVector(up,.65);return !blocked(a.toArray(),b.toArray(),entity.species==='pyrebear'?.8:.4);},
    lineOfSight:(from,to)=>!blocked(from,to),
    onBite:(damage,attacker)=>{const result=medical.applyBite(damage,attacker);if(result.ok)nav.notify(`${attacker.creatureName} bite · Suit ${loadout.state.health}% · Use a quick-slot medical item`);return result;},
  });
  function requestAsset(species){
    if(assets.has(species))return assets.get(species);
    const state={status:'loading',error:null,gltf:null,manifest:null};assets.set(species,state);
    const base=`${import.meta.env.BASE_URL}models/creatures/${ASSETS[species]}`;
    Promise.allSettled([new GLTFLoader().loadAsync(`${base}.glb`),fetch(`${base}-manifest.json`).then(r=>{if(!r.ok)throw Error(`Creature manifest ${r.status}`);return r.json();})]).then(results=>{
      const gltf=results[0].status==='fulfilled'?results[0].value:null;
      const failure=results.find(r=>r.status==='rejected');
      if(disposed||failure){if(gltf)disposeAsset(gltf);if(failure)throw failure.reason;return;}
      if(!gltf.animations.some(c=>c.name==='walk')||!gltf.animations.some(c=>c.name==='death')){disposeAsset(gltf);throw Error('Creature requires walk and death clips');}
      const manifest=results[1].value;state.gltf=gltf;state.manifest=manifest;state.status='ready';
      const size=manifest.dimensions??manifest.runtime?.dimensions;if(size?.height)dimensions[species]=size;
    }).catch(error=>{state.error=error.message;state.status='error';console.error(`Wildlife ${species}:`,error);});
    return state;
  }
  function createActor(entity,asset){
    const root=new THREE.Group(),model=clone(asset.gltf.scene);root.name=entity.id;root.add(model);group.add(root);
    model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=false;o.receiveShadow=true;}});
    const mixer=new THREE.AnimationMixer(model),walk=mixer.clipAction(asset.gltf.animations.find(c=>c.name==='walk')),death=mixer.clipAction(asset.gltf.animations.find(c=>c.name==='death'));
    walk.play();walk.time=(entity.phase??0)%1*walk.getClip().duration;mixer.update(0);
    death.setLoop(THREE.LoopOnce,1);death.clampWhenFinished=true;
    const actor={root,model,mixer,walk,death,dead:false,animationTime:0};actors.set(entity.id,actor);return actor;
  }
  function removeActor(id){const actor=actors.get(id);if(!actor)return;actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.model);const skeletons=new Set();actor.model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();actor.root.removeFromParent();actors.delete(id);}
  function disposeAsset(gltf){const geometries=new Set(),materials=new Set(),textures=new Set();gltf.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const x of [...geometries,...materials,...textures])x.dispose();}
  const aliveRenderable=()=>simulation.entities.filter(e=>actors.get(e.id)?.root.visible);
  function raycast(start,direction,range){return online()?null:raycastFauna(aliveRenderable(),start,direction,range,dimensions);}
  function weaponHit(hit,item){
    if(online()||!nav.enabled||nav.mode!=='walk'&&nav.mode!=='eva'||nav.insideShip||hit?.kind!=='fauna')return false;
    const damage={'rifle-laser':30,'sidearm-pistol':18}[item];if(!damage)return false;
    const entity=simulation.entities.find(e=>e.id===hit.id);if(!entity||entity.health<=0)return false;
    const before=entity.health,result=simulation.hit(hit.id,damage);shots++;lastHit={id:hit.id,damage:Math.min(before,damage),weapon:item};
    if(entity.health===0){kills++;nav.notify(`${FAUNA_SPECIES[entity.species].name} down`);}return result;
  }
  return {medical,raycast,weaponHit,
    update(dt,origin){
      const body=nav.body.id,species=body==='pyre'?'pyrebear':body==='miasma'?'suloher':null;
      group.visible=!online()&&Boolean(species);status.hidden=true;
      const paused=online()||!nav.enabled||!nav.focused||document.hidden||Boolean(document.querySelector('dialog[open]'));
      queryClock+=Math.min(dt,.25);hudClock+=Math.min(dt,.25);
      if(body!==lastBody){hudTarget=null;hudClock=1;}
      if(!online()&&species&&nav.altitude<500&&(queryClock>=1||body!==lastBody)){
        queryClock=0;requestAsset(species);
        const spawns=(species==='pyrebear'?enumeratePyrebearSpawns:enumerateSuloherSpawns)(nav.position,{seed});
        simulation.reconcile(spawns,species,nav.position.toArray());
      }else if(queryClock>=1||body!==lastBody||online()){queryClock=0;simulation.reconcile([],species,nav.position.toArray());}
      lastBody=body;
      const ready=assets.get(species)?.status==='ready';
      simulation.update(paused||!ready?0:dt,{position:nav.position.toArray(),active:ready&&!paused&&nav.mode==='walk'&&!nav.insideShip&&!nav.dockedAtStation,health:loadout.state.health});
      const ids=new Set(simulation.entities.map(e=>e.id));for(const id of actors.keys())if(!ids.has(id))removeActor(id);
      for(const entity of simulation.entities){
        const asset=assets.get(entity.species);if(asset?.status!=='ready')continue;
        const actor=actors.get(entity.id)??createActor(entity,asset),distance=v(entity.position).distanceTo(nav.position);
        actor.root.visible=entity.species===species&&distance<550;
        actor.root.position.copy(v(entity.position).sub(origin));actor.root.quaternion.copy(faunaOrientation(entity));
        if(entity.health<=0&&!actor.dead){actor.dead=true;actor.death.reset().play();actor.walk.crossFadeTo(actor.death,.12,false);}
        if(!paused){
          if(actor.dead)actor.mixer.update(Math.min(dt,.25));
          else {actor.walk.setEffectiveTimeScale(Math.max(0,(entity.speed??0)/(asset.manifest.gaitSpeed??1.4)));actor.mixer.update(Math.min(dt,.25));}
        }
        actor.root.updateMatrixWorld(true);
      }
      if(paused){hudTarget=null;hudClock=1;}
      if(!paused&&nav.mode==='walk'&&!nav.insideShip){
        // Cosmetic target visibility runs at10Hz; actual fire/impact rays remain fresh.
        if(hudClock>=.1){hudClock=0;const forward=new THREE.Vector3(0,0,-1).applyQuaternion(nav.orientation),target=raycast(nav.position,forward,160);hudTarget=target&&!blocked(nav.position.toArray(),target.point.toArray())?target.id:null;}
        let entity=simulation.entities.find(e=>e.id===hudTarget&&e.health>0);
        if(!entity)entity=simulation.entities.filter(e=>e.health>0&&e.state==='windup').sort((a,b)=>v(a.position).distanceToSquared(nav.position)-v(b.position).distanceToSquared(nav.position))[0];
        if(entity){status.hidden=false;label.textContent=FAUNA_SPECIES[entity.species].name;meter.max=FAUNA_SPECIES[entity.species].maxHealth;meter.value=entity.health;detail.textContent=entity.state==='windup'?'ATTACK INCOMING · MOVE AWAY':`${entity.health} HP · ${Math.round(v(entity.position).distanceTo(nav.position))} m`;status.dataset.attack=String(entity.state==='windup');}
      }
    },
    get state(){return {...simulation.state,entities:simulation.entities.map(e=>({...e,position:[...e.position],normal:[...e.normal]})),assets:Object.fromEntries([...assets].map(([id,a])=>[id,{status:a.status,error:a.error}])),rendered:actors.size,shots,kills,lastHit,medical:medical.state};},
    dispose(){disposed=true;for(const id of [...actors.keys()])removeActor(id);for(const a of assets.values())if(a.gltf)disposeAsset(a.gltf);group.removeFromParent();status.remove();medical.dispose();},
  };
}
