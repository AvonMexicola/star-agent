import { randomUUID } from 'node:crypto';
import * as THREE from 'three';
import { MAX_PLAYERS, MULTIPLAYER_VERSION, WORLD_SEED, cleanInput, WEAPON_RULES } from '../src/multiplayer/protocol.js';
import { itemMass, validItems } from '../src/inventory/containers.js';
import { TRAVEL_TARGETS } from '../src/travel-model.js';
import { CAPACITY, initialInventory, restoreInventory, transferInventory, quantity } from './inventory.js';
import { shoot } from './combat.js';

const STEP=1/30, LEASE_MS=180000, DROP_MS=300000;
const VECTOR_KEYS=['position','velocity','shipVelocity','angularVelocity','shipAngularVelocity'];
const BOOL_KEYS=['gearDeployed','powered','cabinFlight','insideShip','dockedAtStation','stationLift','doorOpen','shipLightsOn','flashlightOn','flightAssist','spaceParked','autoland'];
const FLOAT_KEYS=['gearProgress','doorProgress','speedScale','jumpHeight','jumpVelocity'];
const failure=(message,code)=>Object.assign(new Error(message),{code});
export function playerSnapshot(p) {
  const n=p.nav, s={id:p.id,callsign:p.account.callsign,colorIndex:p.colorIndex,mode:n.mode,body:n.body.id,shipId:n.shipId,health:p.health,shipHealth:p.shipHealth,weapon:p.weapon,aiming:Boolean(p.weapon&&(n.mode==='walk'||n.mode==='eva')),sequence:p.sequence};
  for(const k of VECTOR_KEYS)s[k]=n[k].toArray();
  for(const k of BOOL_KEYS.concat(FLOAT_KEYS))s[k]=n[k];
  s.orientation=n.orientation.toArray();s.shipOrientation=(n.mode==='flight'?n.orientation:n.shipOrientation).toArray();
  s.shipPosition=(n.shipPosition??(n.mode==='flight'?n.position.clone().sub(new THREE.Vector3(...n.layout.seatEye).applyQuaternion(n.orientation)):null))?.toArray()??null;
  s.parkedShipPosition=n.shipPosition?.toArray()??null;
  s.travel=n.travel?JSON.parse(JSON.stringify(n.travel)):null;s.travelTarget=n.travelTarget;s.crash=n.crash;
  s.physicsFrame=n.physicsFrame??null;
  s.physicsUp=s.physicsFrame?n.stationPhysics.up.toArray():null;
  return s;
}
/** One authoritative simulation. Clients send control intent, never positions or damage. */
export function createRoom({world,store,now=Date.now,autoStart=true,onError=()=>{}}) {
  const players=new Map(),joining=new Set(),reservedColors=new Map(),leases=new Map(),drops=new Map(),writes=new Map(),departing=new Map(),failedDepartures=new Map();
  let closed=false,queue=Promise.resolve(),lastSave=now(),lastTime=now(),accumulator=0,tickCount=0;
  const doors=Object.fromEntries(world.pods.map(p=>[p.id,0]));
  const send=(p,data)=>{try{p.send(data);}catch{}};
  const broadcast=data=>{for(const p of players.values())send(p,data);};
  const state=p=>({type:'state',stationFrame:world.station?{direction:world.station.direction.toArray(),orientation:world.station.baseQuaternion.toArray(),altitude:world.station.altitude}:null,players:[...players.values()].map(playerSnapshot),doors:{...doors},hangar:hangar(p),inventory:p.inventory,health:p.health,drops:[...drops.values()].filter(d=>p.nav.position.distanceTo(new THREE.Vector3(...d.position))<500).map(d=>({...d}))});
  function hangar(p){const l=leases.get(p.hangarId);if(!l)return null;const pod=world.pods[l.id-1];return {id:l.id,status:l.status,pad:pod.padWorldPosition.toArray(),approach:pod.approachWorldPosition.toArray(),expiresAt:l.expiresAt};}
  function persistent(p,inventory=p.inventory){return {version:1,inventory,health:p.health,shipHealth:p.shipHealth,weapon:p.weapon};}
  function persist(p,inventory=p.inventory,overrides={}){
    const data=structuredClone({...persistent(p,inventory),...overrides});
    const previous=writes.get(p.account.id)??Promise.resolve();
    const task=previous.catch(()=>{}).then(()=>store.savePlayerState(p.account.id,data)).catch(error=>{onError(error);throw failure('Storage unavailable. Try again.','STORAGE_UNAVAILABLE');});
    writes.set(p.account.id,task);task.finally(()=>{if(writes.get(p.account.id)===task)writes.delete(p.account.id);}).catch(()=>{});return task;
  }
  function release(p){if(p.hangarId){if(leases.get(p.hangarId)?.owner===p.id)leases.delete(p.hangarId);p.hangarId=null;}}
  function reserveSpawn(p){
    const pod=world.pods.find(pod=>pod.id===p.hangarId&&leases.get(pod.id)?.owner===p.id)
      ??world.pods.find(pod=>!leases.has(pod.id));
    if(!pod)throw new Error('All hangars are occupied.');
    p.hangarId=pod.id;
    leases.set(pod.id,{id:pod.id,owner:p.id,status:'occupied',expiresAt:now()+LEASE_MS});
    return pod.id-1;
  }
  function requestHangar(p){
    if(p.health<=0||p.shipHealth<=0)throw new Error('Respawn before requesting a hangar.');
    if(p.nav.position.distanceTo(world.center)>30000)throw new Error('Approach within 30 km to contact this station.');
    if(p.hangarId){const l=leases.get(p.hangarId);l.expiresAt=now()+LEASE_MS;return;}
    const pod=world.pods.filter(pod=>!leases.has(pod.id)).sort((a,b)=>p.nav.position.distanceToSquared(a.approachWorldPosition)-p.nav.position.distanceToSquared(b.approachWorldPosition))[0];
    if(!pod)throw new Error('All hangars are occupied.');
    p.hangarId=pod.id;leases.set(pod.id,{id:pod.id,owner:p.id,status:'approach',expiresAt:now()+LEASE_MS});
  }
  function access(p,container){
    if(container==='pack')return true;
    if(container==='station')return Boolean(p.hangarId&&p.nav.dockedAtStation&&p.nav.position.distanceTo(world.pods[p.hangarId-1].padWorldPosition)<100);
    if(container==='ship')return p.nav.mode==='flight'||p.nav.mode==='landed'||Boolean(p.nav.shipPosition&&p.nav.position.distanceTo(p.nav.shipPosition)<12);
    return false;
  }
  async function request(p,m){
    if(!players.has(p.id))return;
    p.busy=true;
    try{
      if(m.action==='hangar')requestHangar(p);
      else if(m.action==='cancelHangar'){
        if(p.nav.dockedAtStation||p.hangarId&&(world.pods[p.hangarId-1].isInsideHangar(p.nav.position)||p.nav.shipPosition&&world.pods[p.hangarId-1].isInsideHangar(p.nav.shipPosition)))throw new Error('Leave the hangar before releasing it.');
        release(p);
      }else if(m.action==='transfer'){
        if(!access(p,m.from)||!access(p,m.to))throw new Error('Move within reach of that container.');
        const next=transferInventory(p.inventory,m);await persist(p,next);p.inventory=next;
        if(p.weapon&&!next.containers.pack[p.weapon])p.weapon=null;
      }else if(m.action==='drop'){
        if(!['walk','eva'].includes(p.nav.mode)||p.health<=0)throw new Error('Leave your pilot seat before dropping items.');
        if(m.revision!==p.inventory.revision)throw new Error('Inventory changed.');
        quantity(m.item,m.quantity);
        if((p.inventory.containers.pack[m.item]??0)<m.quantity)throw new Error('Not enough items.');
        if(drops.size>=100)throw new Error('Too many loose items in this area.');
        const next=structuredClone(p.inventory);next.containers.pack[m.item]-=m.quantity;next.revision++;
        await persist(p,next);p.inventory=next;
        const id=randomUUID(),position=p.nav.position.clone().addScaledVector(p.nav.stationPhysics?.up??p.nav.normal,-1.4).toArray();
        drops.set(id,{id,item:m.item,quantity:m.quantity,position,expiresAt:now()+DROP_MS});
        if(!next.containers.pack[p.weapon])p.weapon=null;
      }else if(m.action==='pickup'){
        const d=drops.get(m.id);
        if(!d||d.expiresAt<=now()||p.health<=0||p.nav.position.distanceTo(new THREE.Vector3(...d.position))>3)throw new Error('That item is no longer within reach.');
        const next=structuredClone(p.inventory);next.containers.pack[d.item]=(next.containers.pack[d.item]??0)+d.quantity;next.revision++;
        if(!validItems(next.containers.pack)||itemMass(next.containers.pack)>CAPACITY.pack+1e-7)throw new Error('Your pack is full.');
        await persist(p,next);p.inventory=next;drops.delete(d.id);
      }else if(m.action==='equip'){
        if(m.weapon!==null&&(typeof m.weapon!=='string'||!Object.hasOwn(WEAPON_RULES,m.weapon)&&m.weapon!=='mining-laser-tool'||!p.inventory.containers.pack[m.weapon]))throw new Error('That item is not in your pack.');
        await persist(p,p.inventory,{weapon:m.weapon});p.weapon=m.weapon;
      }else if(m.action==='respawn'){
        if(p.health>0&&p.shipHealth>0&&!['crashed','destroyed'].includes(p.nav.mode))throw new Error('Your character is still alive.');
        const oldId=p.hangarId,oldLease=leases.get(oldId);
        try{
          const slot=reserveSpawn(p),nav=world.createNavigation(slot,msg=>send(p,{type:'event',event:'notice',message:msg}));
          await persist(p,p.inventory,{health:100,shipHealth:100});
          if(!players.has(p.id)){release(p);return;}
          p.health=100;p.shipHealth=100;p.nav=nav;p.spawnPod=p.hangarId;p.input=cleanInput();p.lookYaw=p.lookPitch=0;attach(p);
        }catch(error){release(p);if(players.has(p.id)){p.hangarId=oldId;if(oldLease)leases.set(oldId,oldLease);}throw error;}
      }else throw new Error('Unknown request.');
      send(p,state(p));send(p,{type:'ack',requestId:m.requestId,ok:true});
    }catch(error){send(p,{type:'ack',requestId:m.requestId,ok:false,error:error.code==='ECONNREFUSED'?'Storage unavailable. Try again.':error.message});}
    finally{p.busy=false;}
  }
  function attach(p){
    p.nav.station=world.adapter(p);p.nav.gamepad.poll=()=>({...p.input,mouseYaw:0,mousePitch:0,evaVertical:p.input.vertical,evaBrake:p.input.brake,mine:0,speed:0,scroll:0,shortcutModifier:false,used:true,ui:false,pressed:new Set()});
  }
  function action(p,m){
    if(p.busy||p.health<=0||p.shipHealth<=0)return;
    const n=p.nav;
    const actions={gear:'toggleGear',lights:'toggleLights',power:'togglePower',assist:'toggleFlightAssist',land:'landOrLaunch',interact:'embark',eva:'toggleEVA',brake:'brake',cancelTravel:'cancelTravel'};
    if(Object.hasOwn(actions,m.action))n[actions[m.action]]();
    else if(m.action==='travel')n.travel?n.cancelTravel():n.beginFreeTravel();
    else if(m.action==='target'&&TRAVEL_TARGETS.some(t=>t.id===m.target)){n.travelTarget=m.target;n.beginTravel();}
  }
  function tick(dt=STEP){
    if(closed)return;
    const t=now();
    for(const [id,d]of drops)if(d.expiresAt<=t)drops.delete(id);
    for(const p of players.values()){
      const l=leases.get(p.hangarId);
      if(l&&!p.busy){
        const pod=world.pods[l.id-1],inside=pod.isInsideHangar(p.nav.position)||p.nav.shipPosition&&pod.isInsideHangar(p.nav.shipPosition);
        if(p.nav.dockedAtStation||inside){l.status=p.nav.dockedAtStation?'occupied':'approach';l.expiresAt=t+LEASE_MS;}
        else if(l.expiresAt<=t)release(p);
      }
    }
    for(const pod of world.pods){
      const occupied=[...players.values()].some(p=>{
        if(p.nav.position.distanceToSquared(pod.padWorldPosition)>250000&&(!p.nav.shipPosition||p.nav.shipPosition.distanceToSquared(pod.padWorldPosition)>250000))return false;
        if(pod.isInsideHangar(p.nav.position)||p.nav.shipPosition&&pod.isInsideHangar(p.nav.shipPosition))return true;
        if(p.nav.shipPosition||['flight','landed','crashed'].includes(p.nav.mode)){
          const q=p.nav.shipPosition?p.nav.shipOrientation:p.nav.orientation;
          const root=p.nav.shipPosition??p.nav.position.clone().sub(new THREE.Vector3(...p.nav.layout.seatEye).applyQuaternion(q));
          const bounds=new THREE.Box3(),shape=p.nav.layout.flightBounds;
          for(let i=0;i<8;i++){
            const corner=new THREE.Vector3(...shape.min);
            for(let a=0;a<3;a++)if(i&(1<<a))corner.setComponent(a,shape.max[a]);
            bounds.expandByPoint(pod.toLocal(corner.applyQuaternion(q).add(root),corner));
          }
          const opening=new THREE.Box3(new THREE.Vector3(pod.interiorBox.min.x-1,pod.interiorBox.min.y-1,pod.openingZ-1),new THREE.Vector3(pod.interiorBox.max.x+1,pod.interiorBox.max.y+1,pod.openingZ+1));
          if(bounds.intersectsBox(opening))return true;
        }
        const local=pod.toLocal(p.nav.position,new THREE.Vector3());
        return Math.abs(local.x)<pod.interiorBox.max.x+12&&Math.abs(local.z-pod.openingZ)<18&&local.y>pod.interiorBox.min.y-5&&local.y<pod.interiorBox.max.y+5;
      });
      doors[pod.id]=Math.max(0,Math.min(1,doors[pod.id]+(leases.has(pod.id)||occupied?1:-1)*dt/3));
    }
    world.doors(doors,dt);
    for(const p of players.values()){
      if(t-p.lastInput>500)p.input=cleanInput();
      if(p.health<=0||p.shipHealth<=0){p.nav.velocity.set(0,0,0);p.nav.mode='crashed';p.input=cleanInput();continue;}
      try{
        p.nav.look(p.lookYaw,p.lookPitch);p.lookYaw=p.lookPitch=0;p.nav.beginFrame(dt);p.nav.update(dt);
        if(['crashed','destroyed'].includes(p.nav.mode)){p.health=0;p.shipHealth=0;p.nav.mode='crashed';}
        if(p.input.fire&&!p.busy){
          const event=shoot({shooter:p,players:[...players.values()],world,now:t});
          if(event)broadcast({type:'event',event:'fire',peerId:p.id,...event});
        }
      }catch(error){p.input=cleanInput();onError(error);}
    }
    tickCount++;
    if(tickCount%2===0)for(const p of players.values())send(p,state(p));
    if(t-lastSave>10000){lastSave=t;for(const p of players.values())if(!p.busy)persist(p).catch(onError);}
  }
  const timer=autoStart?setInterval(()=>{const t=now();accumulator+=Math.min(.25,(t-lastTime)/1000);lastTime=t;while(accumulator>=STEP){tick();accumulator-=STEP;}},10):null;
  timer?.unref();
  return {players,leases,drops,doors,tick,state,
    async join(account,sendFn){
      if(closed)throw failure('Server restarting.','ROOM_CLOSED');
      if(players.has(account.id)||joining.has(account.id))throw failure('This account is already connected.','ACCOUNT_CONNECTED');
      if(players.size+joining.size>=MAX_PLAYERS)throw failure('All ten player slots are occupied.','ROOM_FULL');
      joining.add(account.id);
      let pendingPlayer;
      try{
        await departing.get(account.id);
        if(failedDepartures.has(account.id)){await persist(failedDepartures.get(account.id));failedDepartures.delete(account.id);}
        await writes.get(account.id);
        const saved=await store.loadPlayerState(account.id);
        if(closed)throw failure('Server restarting.','ROOM_CLOSED');
        const used=new Set([...players.values()].map(p=>p.colorIndex).concat([...reservedColors.values()]));let slot=0;while(used.has(slot))slot++;reservedColors.set(account.id,slot);
        const p={id:account.id,account:{id:account.id,callsign:account.callsign},send:sendFn,colorIndex:slot,spawnPod:slot+1,hangarId:null,inventory:saved?restoreInventory(saved.inventory):initialInventory(),health:100,shipHealth:100,weapon:saved?.weapon??'rifle-laser',sequence:0,input:cleanInput(),lastInput:now(),lookYaw:0,lookPitch:0,lastShotAt:-Infinity,busy:false,messages:0,rateStart:now()};
        pendingPlayer=p;
        if(saved){p.health=Math.max(0,Math.min(100,Number.isFinite(saved.health)?saved.health:100));p.shipHealth=Math.max(0,Math.min(100,Number.isFinite(saved.shipHealth)?saved.shipHealth:100));}
        if(typeof p.weapon!=='string'||!p.inventory.containers.pack[p.weapon]||!Object.hasOwn(WEAPON_RULES,p.weapon)&&p.weapon!=='mining-laser-tool')p.weapon=null;
        const spawnSlot=reserveSpawn(p);p.spawnPod=p.hangarId;
        p.nav=world.createNavigation(spawnSlot,message=>send(p,{type:'event',event:'notice',message}));attach(p);await persist(p);
        if(closed)throw failure('Server restarting.','ROOM_CLOSED');
        players.set(p.id,p);
        send(p,{...state(p),type:'welcome',id:p.id,seed:WORLD_SEED,version:MULTIPLAYER_VERSION,maxPlayers:MAX_PLAYERS,colorIndex:slot});return p.id;
      }catch(error){if(pendingPlayer)release(pendingPlayer);throw error;}
      finally{joining.delete(account.id);reservedColors.delete(account.id);}
    },
    receive(id,m){
      const p=players.get(id);if(!p||!m||typeof m!=='object'||Array.isArray(m))return;
      if(now()-p.rateStart>=1000){p.rateStart=now();p.messages=0;}
      if(++p.messages>90)return;
      if(m.type==='input'){
        if(!Number.isSafeInteger(m.sequence)||m.sequence<=p.sequence)return;
        p.sequence=m.sequence;p.input=cleanInput(m.input);p.lastInput=now();
        p.lookYaw=Math.max(-.25,Math.min(.25,p.lookYaw+p.input.mouseYaw));p.lookPitch=Math.max(-.25,Math.min(.25,p.lookPitch+p.input.mousePitch));
      }else if(m.type==='action')action(p,m);
      else if(m.type==='request'&&typeof m.requestId==='string'&&m.requestId.length<=64){queue=queue.then(()=>request(p,m)).catch(onError);return queue;}
    },
    leave(id){
      const p=players.get(id);if(!p)return departing.get(id)??Promise.resolve();
      players.delete(id);release(p);
      const task=(async()=>{await queue;try{await persist(p);}catch(error){failedDepartures.set(p.account.id,p);throw error;}})();
      departing.set(p.account.id,task);
      task.finally(()=>{if(departing.get(p.account.id)===task)departing.delete(p.account.id);}).catch(onError);
      return task;
    },
    async revoke(accountId){const p=players.get(accountId);if(p){send(p,{type:'revoked'});await this.leave(p.id);}},
    async close(){if(closed)return;closed=true;clearInterval(timer);await queue;await Promise.allSettled([...departing.values()]);for(const p of players.values())await persist(p).catch(onError);await Promise.allSettled([...writes.values()]);players.clear();leases.clear();drops.clear();},
  };
}
