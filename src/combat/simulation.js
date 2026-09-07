import {Vector3,Quaternion} from 'three';
import {step as stepFlight} from '../flight-model.js';
import {shipWeaponProfile,SHIP_WEAPON_SIZES} from '../ship-weapon-profiles.js';

export const SHIP_STATS=Object.freeze({
  nomad:{hull:240,shield:180,radius:9,speed:65,turn:.65,recharge:16},
  kestrel:{hull:160,shield:140,radius:7,speed:105,turn:1.15,recharge:20},
  atlas:{hull:600,shield:360,radius:25,speed:45,turn:.35,recharge:24},
});
export const GUNS=Object.freeze(Object.fromEntries(['pulse','laser','void'].map(type=>[type,shipWeaponProfile(type,1)])));
const FORWARD=new Vector3(0,0,-1);
const NPC_DAMAGE_PER_SECOND={nomad:16,kestrel:24};
export function integrity(ship='nomad'){
  const stats=SHIP_STATS[ship]??SHIP_STATS.nomad;
  return {hull:stats.hull,shield:stats.shield,maxHull:stats.hull,maxShield:stats.shield,hitAge:99,recharge:stats.recharge};
}
export function damage(state,amount){
  if(!Number.isFinite(amount)||amount<=0||state.hull<=0)return 0;
  const absorbed=Math.min(state.shield,amount),lost=Math.min(state.hull,amount-absorbed);
  state.shield-=absorbed;state.hull-=lost;state.hitAge=0;return absorbed+lost;
}
export function recharge(state,dt){
  const before=state.hitAge;state.hitAge+=dt;
  if(state.hull>0)state.shield=Math.min(state.maxShield,state.shield+state.recharge*Math.max(0,state.hitAge-Math.max(6,before)));
}
/** Earliest segment contact, including starting inside. Positions remain doubles. */
export function segmentSphere(start,end,center,radius){
  const d=end.clone().sub(start),m=start.clone().sub(center),c=m.lengthSq()-radius*radius;
  if(c<=0)return 0;
  const a=d.lengthSq(),b=m.dot(d),disc=b*b-a*c;
  if(a<1e-12||disc<0)return null;
  const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:null;
}
export function interceptPoint(start,target,velocity,speed){
  if(!Number.isFinite(speed))return target.clone();
  const r=target.clone().sub(start),a=velocity.lengthSq()-speed*speed,b=2*r.dot(velocity),c=r.lengthSq();
  let t=0;
  if(Math.abs(a)<1e-8)t=b<0?-c/b:0;
  else{const disc=b*b-4*a*c;if(disc>=0){const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(v=>v>0);if(roots.length)t=Math.min(...roots);}}
  return target.clone().addScaledVector(velocity,Math.min(t,8));
}
/** A projectile's visible segment ends at its physical tip and cannot reach
 * behind the named muzzle before it has travelled its full visual length. */
export function projectileSpan(shot,maximum=8*(shot.profile?.effectScale??1)){
  const length=Math.max(0,Math.min(maximum,shot.travelled??0));
  return {length,position:shot.position.clone().addScaledVector((shot.velocity??shot.direction).clone().normalize(),-length*.5)};
}
export class CombatSimulation{
  constructor({onShot=()=>{},onHit=()=>{},obstruction=()=>null}={}){
    this.onShot=onShot;this.onHit=onHit;this.obstruction=obstruction;this.enemies=[];this.projectiles=[];this.player=integrity();this.shipId='nomad';this.phase='idle';this.targetId=null;this.serial=0;this.time=0;this.shots=0;this.hits=0;this.incomingHits=0;this.completed=0;
  }
  setShip(id){if(id!==this.shipId){this.shipId=id;this.player=integrity(id);}}
  accept(point,orientation){
    if(['transit','engage','complete'].includes(this.phase))return false;
    this.point=point.clone();this.heading=orientation.clone();this.enemies=[];this.projectiles=[];this.targetId=null;this.phase='transit';return true;
  }
  abort(){if(!['transit','engage'].includes(this.phase))return false;this.phase='aborted';this.enemies=[];this.projectiles=[];this.targetId=null;return true;}
  debrief(){if(this.phase!=='complete')return false;this.completed++;this.phase='debriefed';return true;}
  repair(){this.player=integrity(this.shipId);}
  spawn(){
    this.enemies=['nomad','kestrel'].map((ship,i)=>({id:`hostile-${++this.serial}`,ship,label:ship==='nomad'?'Nomad 02 · Raider':'Kestrel · Interceptor',position:new Vector3((i?1:-1)*160,i*65,-(i?400:150)).applyQuaternion(this.heading).add(this.point),previous:new Vector3(),orientation:this.heading.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI)),velocity:new Vector3(),integrity:integrity(ship),strategy:'intercept',breakTime:0,cooldown:2+i,slot:i}));
    this.phase='engage';this.targetId=this.enemies[0].id;
  }
  get living(){return this.enemies.filter(e=>e.integrity.hull>0);}
  get target(){return this.living.find(e=>e.id===this.targetId)??null;}
  cycle(){const living=this.living;if(living.length)this.targetId=living[(living.findIndex(e=>e.id===this.targetId)+1)%living.length].id;}
  fire(start,direction,weapon='pulse',wall=null,profile=null,velocity=new Vector3(),muzzlePosition=null){
    if(this.player.hull<=0)return;
    const gun=profile??shipWeaponProfile(weapon,SHIP_WEAPON_SIZES[this.shipId]??1);
    const shot=this.launch(start,direction,gun,'player',gun.kind??weapon,wall,velocity,muzzlePosition);
    if(shot)this.shots++;
    return shot;
  }
  launch(start,direction,gun,owner,weapon,wall=null,velocity=new Vector3(),muzzlePosition=null){
    if(direction.lengthSq()<1e-12||(!Number.isFinite(gun.speed)&&gun.speed!==Infinity))return null;
    if(Number.isFinite(gun.speed)&&this.projectiles.length>=128)return null;
    if(!Number.isFinite(wall?.distance)||wall.distance>gun.range)wall=null;
    const range=Math.max(0,Math.min(gun.range,wall?.distance??Infinity));
    const shot={id:++this.serial,start:start.clone(),position:start.clone(),direction:direction.clone().normalize(),speed:gun.speed,damage:gun.damage,remaining:range,travelled:0,owner,weapon,wall,profile:gun,muzzlePosition,velocity:direction.clone().normalize().multiplyScalar(Number.isFinite(gun.speed)?gun.speed:0).add(velocity)};
    if(!Number.isFinite(gun.speed)){
      if(!this.trace(shot,start.clone().addScaledVector(shot.direction,range),false))this.impactWall(shot);
    }else if(range>0)this.projectiles.push(shot);
    else this.impactWall(shot);
    this.onShot(shot);
    return shot;
  }
  impactWall(shot){
    if(!shot.wall)return;
    const point=shot.wall.point?.clone()??shot.start.clone().addScaledVector(shot.direction,Math.max(0,shot.wall.distance));
    this.onHit({point,normal:shot.wall.normal?.clone()??shot.direction.clone().negate(),shield:false,destroyed:false,entity:null,weapon:shot.weapon,profile:shot.profile});
  }
  hit(entity,shot,point){
    const state=entity==='player'?this.player:entity.integrity;
    const shield=state.shield>0,applied=damage(state,shot.damage);
    const centre=entity==='player'?this.playerPosition:entity.position;
    const normal=centre?point.clone().sub(centre).normalize():shot.direction.clone().negate();
    if(applied){if(entity==='player')this.incomingHits++;else this.hits++;this.onHit({point,normal,shield,destroyed:state.hull===0,entity,weapon:shot.weapon,profile:shot.profile});}
  }
  trace(shot,end,moving=true){
    if(shot.wall&&shot.remaining<=0)return false;
    let first=null,fraction=Infinity;
    const candidates=shot.owner==='player'?this.living:[{id:'player',position:this.playerPosition,previous:this.previousPlayer,integrity:this.player,ship:this.shipId}];
    for(const e of candidates){
      if(!e.position||e.integrity.hull<=0)continue;
      // Relative sweep handles ships crossing a projectile between frames.
      const start=moving?shot.position.clone().sub(e.previous??e.position).add(e.position):shot.position;
      const t=segmentSphere(start,end,e.position,SHIP_STATS[e.ship].radius);
      if(t!==null&&t<fraction){fraction=t;first=e;}
    }
    if(first){shot.remaining=shot.position.distanceTo(end)*fraction;this.hit(first.id==='player'?'player':first,shot,shot.position.clone().lerp(end,fraction));return true;}
    return false;
  }
  update(dt,{position,velocity,orientation,active=true}){
    if(!active||!Number.isFinite(dt)||dt<=0)return;
    // Bound simulation work after a stalled tab; gameplay never catches up with a burst.
    dt=Math.min(dt,.2);this.time+=dt;
    this.previousPlayer=this.playerPosition?.clone()??position.clone();this.playerPosition=position.clone();
    recharge(this.player,dt);
    if(this.phase==='transit'&&position.distanceTo(this.point)<1100)this.spawn();
    if(this.phase!=='engage'){this.projectiles=[];return;}
    if(this.player.hull<=0){this.phase='failed';this.projectiles=[];return;}
    for(const e of this.living){
      e.previous.copy(e.position);recharge(e.integrity,dt);const stats=SHIP_STATS[e.ship],distance=e.position.distanceTo(position);
      if(e.position.distanceTo(this.point)>6500){e.strategy='return';}
      else if(e.strategy==='return'&&e.position.distanceTo(this.point)<2000)e.strategy='intercept';
      if(e.strategy!=='return'){
        if(distance<180&&e.breakTime<=0)e.breakTime=3.5;
        e.strategy=e.breakTime>0?'break':distance<1000?'attack':'intercept';e.breakTime=Math.max(0,e.breakTime-dt);
      }
      const gun=shipWeaponProfile('pulse',SHIP_WEAPON_SIZES[e.ship]??1);
      const aim=interceptPoint(e.position,position,velocity.clone().sub(e.velocity),gun.speed);
      let desired=aim.clone().sub(e.position);
      if(e.strategy==='return')desired=this.point.clone().sub(e.position);
      if(e.strategy==='break')desired=e.position.clone().sub(position).add(new Vector3((e.slot?1:-1)*220,100,0).applyQuaternion(orientation));
      const wanted=new Quaternion().setFromUnitVectors(FORWARD,desired.normalize());e.orientation.rotateTowards(wanted,stats.turn*dt);
      const forward=FORWARD.clone().applyQuaternion(e.orientation);
      const speed=stats.speed*(e.strategy==='break'?1.35:e.strategy==='attack'?.7:1);
      e.velocity.copy(stepFlight(e,{shipId:e.ship,assist:true,targetVelocity:forward.clone().multiplyScalar(speed)},{density:0,gravity:new Vector3()},dt).velocity);e.position.addScaledVector(e.velocity,dt);
      e.cooldown-=dt;
      if(e.strategy==='attack'&&distance<1250&&forward.dot(aim.clone().sub(e.position).normalize())>.994&&e.cooldown<=0){
        // Model transforms still contain the previous render frame here. Ask
        // for the real barrel in ship-local space, then use this tick's pose.
        const pose=e.armament?.nextMuzzle?.({local:true});
        if(!pose?.position||!pose.direction||!pose.profile||pose.direction.lengthSq()<1e-12)continue;
        const start=pose.position.clone().applyQuaternion(e.orientation).add(e.position);
        const direction=pose.direction.clone().applyQuaternion(e.orientation).normalize();
        const lead=interceptPoint(start,position,velocity.clone().sub(e.velocity),pose.profile.speed).sub(start).normalize();
        // Fixed guns cannot bend their bores toward a selected target.
        if(direction.dot(lead)<=.994)continue;
        const trajectory=Number.isFinite(pose.profile.speed)?direction.clone().multiplyScalar(pose.profile.speed).add(e.velocity).normalize():direction;
        const wall=this.obstruction(start,trajectory,pose.profile.range,e);
        const shot=this.launch(start,direction,pose.profile,e.id,pose.type??pose.profile.kind??'pulse',wall,e.velocity);
        if(shot){
          e.armament.fired(pose);
          // Sized hits use the common damage profile. Pulse spacing is 1.5 s
          // for Nomad and 1.75 s for Kestrel, well below the player's fire rate
          // while still applying pressure across the pilots' attack/break passes.
          e.cooldown=Math.max(pose.profile.interval,pose.profile.damage/(NPC_DAMAGE_PER_SECOND[e.ship]??NPC_DAMAGE_PER_SECOND.nomad));
        }
      }
    }
    this.projectiles=this.projectiles.filter(shot=>{
      const speed=shot.velocity.length(),step=Math.min(shot.remaining,speed*dt),end=shot.position.clone().addScaledVector(shot.velocity,speed>0?step/speed:0);
      if(this.trace(shot,end))return false;shot.position.copy(end);shot.remaining-=step;shot.travelled+=step;
      if(shot.remaining<=0)this.impactWall(shot);
      return shot.remaining>0;
    });
    if(!this.target)this.targetId=this.living[0]?.id??null;
    if(!this.living.length){this.phase='complete';this.projectiles=[];}
    if(this.player.hull<=0){this.phase='failed';this.projectiles=[];}
  }
  get state(){return {phase:this.phase,point:this.point?.toArray()??null,player:{...this.player},targetId:this.targetId,shots:this.shots,hits:this.hits,incomingHits:this.incomingHits,completed:this.completed,projectiles:this.projectiles.length,enemies:this.enemies.map(e=>({id:e.id,ship:e.ship,position:e.position.toArray(),velocity:e.velocity.toArray(),orientation:e.orientation.toArray(),strategy:e.strategy,...e.integrity}))};}
}
