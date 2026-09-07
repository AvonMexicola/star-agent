// Disposable memory acceptance server. Ordinary pilots use the normal berth
// spawn. Only the explicitly named Bastion combat fixtures receive initial EVA
// poses; there is no position/debug route exposed over HTTP or WebSocket.
import * as THREE from 'three';
import {createMemoryStore} from '../server/database.js';
import {createServer} from '../server/index.js';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
const store=createMemoryStore(),world=await createWorld(),publicOrigin='http://127.0.0.1:5564';
const room=createRoom({store,world,onError:error=>console.error(error)}),join=room.join;
room.join=async(account,send)=>{
 const id=await join(account,send),poses={BastionWitness:[710,48,-108],BastionTarget:[665,38,-90],BastionFriend:[665,38,-65],BastionAggressor:[665,38,-65]};
 const name=Object.keys(poses).find(prefix=>account.callsign.startsWith(prefix));
 if(name){
  const n=room.players.get(id).nav,station=world.station;
  n.mode='eva';n.dockedAtStation=false;n.insideShip=false;n.shipPosition=null;n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.travel=null;
  station.hub.toWorld(new THREE.Vector3(...poses[name]),n.position);n.orientation.copy(station.baseQuaternion);
  if(name==='BastionWitness'){
   const target=station.hub.toWorld(new THREE.Vector3(665,4,-24),new THREE.Vector3()),matrix=new THREE.Matrix4().lookAt(n.position,target,station.up);
   n.orientation.setFromRotationMatrix(matrix);room.players.get(id).weapon=null;
  }
  send(room.state(room.players.get(id)));
 }
 return id;
};
const app=await createServer({store,room,publicOrigin,secureCookies:false});await app.listen(8098);
console.log('Isolated community acceptance server ready on8098.');
let closing=false;async function close(){if(closing)return;closing=true;await app.close();}
process.once('SIGINT',()=>{void close();});process.once('SIGTERM',()=>{void close();});
