import {PIRATE_ROLES} from './sites.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const copy=p=>({x:p.x,z:p.z});
/** Deterministic 60Hz squad tactics in a metre-scale camp frame. Callbacks own
 * canonical ground, solid cover, sight lines and the health transaction. */
export function createPirateSquad(site,{canMove=()=>true,visible=()=>true,onShot=()=>{},onDamage=()=>true}={}){
 const entities=site.models.map((model,i)=>({id:`${site.id}:${model}`,model,...PIRATE_ROLES[model],maxHealth:PIRATE_ROLES[model].health,x:(i-1)*12,z:-4-i*5,home:{x:(i-1)*12,z:-4-i*5},heading:0,state:'patrol',crouching:false,speedNow:0,side:i%2?1:-1,clock:i*.7,cooldown:2+i*.35,rounds:0,target:null,alert:false,hits:0,shotSerial:0,animation:'walk'}));
 let accumulator=0,time=0,kills=0,shots=0,damage=0;
 function hit(id,amount){
  const e=entities.find(e=>e.id===id);if(!e||e.health<=0||!Number.isFinite(amount)||amount<=0)return {ok:false};
  const applied=Math.min(e.health,amount);e.health-=applied;e.hits++;e.clock=0;e.speedNow=0;e.state=e.health<=0?'dead':'stagger';e.animation=e.health<=0?'death':'take-damage';
  if(e.health<=0)kills++;
  for(const member of entities)if(member.health>0)member.alert=true;
  return {ok:true,killed:e.health<=0,damage:applied};
 }
 function move(e,target,speed,dt){
  const dx=target.x-e.x,dz=target.z-e.z,len=Math.hypot(dx,dz);e.speedNow=0;if(len<.25)return;
  const angle=Math.atan2(dx,dz),step=Math.min(speed*dt,len);
  for(const offset of [0,.65,-.65,1.2,-1.2]){
   const next={x:e.x+Math.sin(angle+offset)*step,z:e.z+Math.cos(angle+offset)*step};
   if(distance(next,{x:0,z:0})>52||!canMove(e,next))continue;
   if(entities.some(other=>other!==e&&other.health>0&&distance(other,next)<.8))continue;
   e.moveX=-(next.x-e.x)*Math.cos(e.heading)+(next.z-e.z)*Math.sin(e.heading);e.moveZ=(next.x-e.x)*Math.sin(e.heading)+(next.z-e.z)*Math.cos(e.heading);e.x=next.x;e.z=next.z;e.speedNow=step/dt;return;
  }
 }
 function step(dt,player){
  time+=dt;
  for(const e of entities){
   if(e.health<=0)continue;
   e.clock+=dt;e.cooldown=Math.max(0,e.cooldown-dt);e.speedNow=0;
   const range=distance(e,player),los=visible(e,player,e.crouching);
   if(player.active&&range<48&&los)e.alert=true;
   const engaged=player.active&&player.health>0&&range<85&&e.alert&&distance(player,{x:0,z:0})<105;
   if(e.state==='stagger'&&e.clock<.38)continue;
   if(!engaged){e.crouching=false;e.state='patrol';const target={x:e.home.x+Math.sin(time*.18+e.side)*4,z:e.home.z+Math.cos(time*.18+e.side)*3};move(e,target,.75,dt);e.heading=Math.atan2(target.x-e.x,target.z-e.z);e.animation=e.speedNow>.1?'walk':'idle';e.rounds=0;continue;}
   if(e.state==='reload'&&e.clock<e.reload){e.crouching=e.role==='leader';e.animation='reload-rifle';continue;}
   if(e.state==='reload'){e.rounds=0;e.clock=0;e.state='engage';}
   e.heading=Math.atan2(player.x-e.x,player.z-e.z);
   if(e.state==='aim'){
    e.animation='aim-rifle';
    if(!los){e.state='engage';e.clock=0;continue;}
    if(e.clock<e.aim)continue;
    // Aim point is locked at the start of the windup. Moving laterally can dodge.
    const start={x:e.x,z:e.z,y:(e.y??0)+(e.crouching?1.05:1.45)},target=e.target;
    const vx=target.x-start.x,vz=target.z-start.z,vy=target.y-start.y,length=Math.hypot(vx,vy,vz);
    const t=clamp(((player.x-start.x)*vx+(player.z-start.z)*vz+(player.y-start.y)*vy)/(length*length),0,1.2);
    const separation=Math.hypot(player.x-(start.x+vx*t),player.z-(start.z+vz*t));
    const rayHeight=start.y+vy*t,hitPlayer=separation<.34&&rayHeight>player.y-(player.crouching?1.03:1.62)&&rayHeight<player.y+.12&&visible(e,player,e.crouching);
    const unobstructed=onShot({entity:e,start,target:{...target},hit:hitPlayer})!==false;shots++;e.shotSerial++;
    if(hitPlayer&&unobstructed){const result=onDamage(e.damage,e);if(result!==false&&result?.ok!==false)damage+=e.damage;}
    e.rounds++;e.cooldown=.55;e.clock=0;e.state=e.rounds>=e.burst?'reload':'engage';e.animation='fire-rifle';continue;
   }
   e.crouching=e.role==='leader'&&(range<e.range+8||e.health<e.maxHealth*.5);
   if(los&&range<e.range+7&&e.cooldown<=0){e.state='aim';e.clock=0;e.target={x:player.x,z:player.z,y:player.y-.3};e.animation='aim-rifle';continue;}
   e.state=e.role==='flanker'?'flank':e.role==='leader'?'hold':'advance';
   const dx=e.x-player.x,dz=e.z-player.z,len=Math.hypot(dx,dz)||1;
   const lateral=e.role==='flanker'?e.side*13:Math.sin(time*.45+e.side)*3;
   const desired={x:player.x+dx/len*e.range+dz/len*lateral,z:player.z+dz/len*e.range-dx/len*lateral};
   move(e,desired,e.crouching?.85:e.speed,dt);
   e.animation=e.speedNow<.1?(e.crouching?'crouch-idle':'aim-rifle'):(e.crouching?'crouch-walk':e.role==='flanker'?'strafe-left':e.speedNow>2.2?'run':'walk');
  }
 }
 return {entities,hit,update(dt,player){
  if(!player||!Number.isFinite(dt)||dt<=0||player.paused)return;
  accumulator+=Math.min(dt,.1);while(accumulator>=1/60){step(1/60,player);accumulator-=1/60;}
 },get state(){return {time,kills,shots,damage,cleared:entities.every(e=>e.health<=0),entities:entities.map(e=>({...e,home:copy(e.home),target:e.target?{...e.target}:null}))};}};
}
