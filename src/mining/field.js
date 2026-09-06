import * as THREE from 'three';
import {MineableRock} from './rock.js';
import {createDensity} from './volume.js';
import {asteroidField,ringRock} from '../ring-world.js';
import {MOON_POSITION} from '../moon-world.js';
import {FieldCache} from '../inventory-cache.js';

/** Bounded live excavation domains over the deterministic ring population. */
export class MiningField {
  constructor(scene,storage,rings){
    this.scene=scene;this.rings=rings;this.ground=new MineableRock(scene,storage);this.store=this.ground.store;
    this.fieldCache=new FieldCache(scene,this.ground.position);
    this.cache=new Map();this.active=this.ground;this.target=null;this.spaceMode=false;
  }
  get position(){return this.active.position;}
  get error(){return this.active.error;}
  get pending(){return this.active.pending;}
  get budget(){return this.active.budget;}
  set budget(value){this.ground.budget=value;for(const rock of this.cache.values())rock.budget=value;}
  get grounded(){return this.ground.grounded||this.fieldCache.grounded;}
  get targetName(){return this.spaceMode?(this.active.descriptor?.name??'Ring survey'):'Crescent deposit';}
  update(origin){
    const center=new THREE.Vector3(...MOON_POSITION),candidates=this.rings.local.filter(r=>r.mineable).map(r=>({r,d:new THREE.Vector3(...r.position).add(center).distanceTo(origin)})).sort((a,b)=>a.d-b.d);
    this.spaceMode=this.rings.local.length>0;
    const wanted=new Set(candidates.slice(0,2).filter(c=>c.d<90).map(c=>c.r.id));
    for(const [id,rock] of this.cache){if(!wanted.has(id)&&!rock.pending){rock.dispose();this.cache.delete(id);this.store.releaseRock?.(rock.rockId);}}
    // Only two live worker volumes. Saved distant rocks stay suppressed in the
    // instance LOD, so a pristine shell never grows back over a saved cavity.
    for(const {r,d} of candidates.slice(0,2)){
      if(d>90||this.cache.has(r.id)||this.cache.size>=2)continue;
      const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.rotation));
      const rock=new MineableRock(this.scene,null,{store:this.store,rockId:r.key,position:new THREE.Vector3(...r.position).add(center),quaternion,initialField:createDensity((x,y,z)=>asteroidField(x,y,z,r.family)),space:true});
      rock.descriptor=r;this.cache.set(r.id,rock);
    }
    this.rings.hiddenIds.clear();
    for(const key of Object.keys(this.store.state.rocks??{}))if(key.startsWith('selene-ring-v1-'))this.rings.hiddenIds.add(Number(key.slice(15)));
    for(const [id,rock] of this.cache){rock.update(origin);if(rock.ready)this.rings.hiddenIds.add(id);}
    this.active=this.spaceMode&&candidates.length?(this.cache.get(candidates[0].r.id)??this.ground):this.ground;
    this.ground.update(origin);this.fieldCache.update(origin);
  }
  raycast(origin,direction,range=8){
    let nearest=null;for(const rock of [this.ground,...this.cache.values()]){
      const hit=rock.raycast(origin,direction,range);if(hit&&(!nearest||hit.distance<nearest.distance))nearest={...hit,rock};
    }
    if(nearest){
      const ray=new THREE.Ray(origin,direction),center=new THREE.Vector3(...MOON_POSITION);
      for(const r of this.rings.local){
        if(r.id===nearest.rock.descriptor?.id||this.cache.get(r.id)?.ready||this.rings.hiddenIds.has(r.id))continue;
        const point=ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(...r.position).add(center),r.size*1.95),new THREE.Vector3());
        if(point&&point.distanceTo(origin)<nearest.distance){nearest=null;break;}
      }
    }
    this.target=nearest?.rock??null;return nearest;
  }
  onMine(data,direction){(data.target??this.target)?.onMine(data,direction);}
  constrainWalker(a,b){const ground=this.ground.constrainWalker(a,b),cache=this.fieldCache.constrainWalker(a,ground.point);return cache.hit?cache:ground;}
  constrainEVA(a,b){return this.constrainSpace(a,b,.35);}
  constrainFlight(a,b){const ground=this.ground.constrainFlight(a,b);if(ground.hit)return ground;const cache=this.fieldCache.constrainFlight(a,b);return cache.hit?cache:this.constrainSpace(a,b,10);}
  constrainSpace(previous,proposed,radius){
    let point=proposed.clone(),hit=false;const center=new THREE.Vector3(...MOON_POSITION);
    for(const r of this.rings.local){
      const edited=this.cache.get(r.id);
      if(edited?.ready){const result=radius<1?edited.constrainEVA(previous,point):edited.constrainFlight(previous,point);if(result.hit){point=result.point;hit=true;}continue;}
      if(this.rings.hiddenIds.has(r.id))continue;
      // Unpromoted populations use a conservative bounding sphere. The active
      // editable rock switches to the actual carved triangle collision.
      const c=new THREE.Vector3(...r.position).add(center),start=previous.clone().sub(c),step=point.clone().sub(previous),reach=r.size*1.95+radius;
      const aa=step.lengthSq(),bb=start.dot(step),cc=start.lengthSq()-reach*reach;
      if(aa<1e-12)continue;const disc=bb*bb-aa*cc;if(disc<0||bb>=0)continue;
      const t=(-bb-Math.sqrt(disc))/aa;if(t<0||t>1)continue;
      point.copy(previous).addScaledVector(step,Math.max(0,t-.001));hit=true;
    }
    return {point,hit};
  }
  get state(){return {...this.ground.state,space:this.spaceMode,targetName:this.targetName,activeRock:this.active.rockId,activeRevision:this.active.snapshot.revision,activePosition:this.active.position.toArray(),spaceRocks:[...this.cache.values()].map(r=>({id:r.rockId,...r.state}))};}
  dispose(){this.fieldCache.dispose();this.ground.dispose();for(const rock of this.cache.values())rock.dispose();}
}

export function ringSurveyPoint(){const rock=ringRock(5);return new THREE.Vector3(...rock.position).add(new THREE.Vector3(...MOON_POSITION));}
