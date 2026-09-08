import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3,Quaternion} from 'three';
import {terminalIdentity} from '../src/trading/terminal-identity.js';
import {terminalPieceFrame,terminalFrames,TERMINAL_SCREEN} from '../src/trading/terminal-frames.js';
import {createTerminalProjections,nearbyProjections,PROJECTION_LIMIT,PROJECTION_RANGE} from '../src/trading/terminal-projection.js';
const canvasFactory=()=>({getContext:()=>new Proxy({measureText:s=>({width:s.length*24})},{get:(o,k)=>k in o?o[k]:()=>{}})});
const frame=(id,x=0)=>({id,name:'Test exchange',network:'Settlement exchange',role:'Local supplies',status:'Ready to connect',available:true,position:new Vector3(x,1.96,0),quaternion:new Quaternion()});
test('terminal identity uses public labels and truthful closed/power state, never private balances',()=>{
 const s={account:{credits:9876},terminals:[{id:'shop',name:'Copper landing',base:{open:false,storage:{secret:{stock:99}}}}]};
 assert.equal(terminalIdentity(s,'shop').status,'Shop closed');assert.equal(terminalIdentity(s,'shop',{powered:false}).status,'Power offline');assert.equal(terminalIdentity(s,'settlement-selene').name,'Stillwater Exchange');assert.equal(terminalIdentity(s,'').name,'Cargo operations');
 assert.doesNotMatch(JSON.stringify(terminalIdentity(s,'shop')),/9876|secret|99/);
});
test('console projection respects authored rotation and planet-centre double precision',()=>{
 const claim={origin:[25_000_000_000,1_592_750,-9],quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.2).toArray()},piece={position:[-2,.123,-22],rotation:Math.PI};
 const f=terminalPieceFrame(claim,piece),local=f.position.clone().sub(new Vector3(...claim.origin)).applyQuaternion(new Quaternion(...claim.quaternion).invert()).sub(new Vector3(...piece.position));
 assert.ok(local.distanceTo(new Vector3(0,TERMINAL_SCREEN.offset[1],-TERMINAL_SCREEN.offset[2]))<.00001);
 const front=new Vector3(0,0,1).applyQuaternion(f.quaternion).applyQuaternion(new Quaternion(...claim.quaternion).invert());assert.ok(front.distanceTo(new Vector3(0,0,1))<1e-8);
});
test('nearby display budget excludes distant consoles and keeps the nearest six',()=>{
 const frames=Array.from({length:12},(_,i)=>frame(String(i),i*4));const selected=nearbyProjections(frames,new Vector3());assert.equal(selected.length,PROJECTION_LIMIT);assert.deepEqual(selected.map(f=>f.id),['0','1','2','3','4','5']);assert.equal(nearbyProjections([frame('far',PROJECTION_RANGE+1)],new Vector3()).length,0);
});
test('display resources upload on changes only, float-origin correctly and dispose on distance/logout',()=>{
 const scene=new Scene(),projection=createTerminalProjections(scene,{canvasFactory}),position=new Vector3(25_000_000_000,0,0),f=frame('one');f.position.add(position);
 projection.update([f],position,position);assert.equal(projection.state.count,1);assert.equal(projection.state.uploads,1);assert.equal(projection.state.draws,2);assert.deepEqual(scene.children[0].position.toArray(),[0,1.96,0]);
 projection.update([f],position,position.clone().add(new Vector3(.125,0,0)));assert.equal(projection.state.uploads,1);assert.equal(scene.children[0].position.x,-.125);
 projection.update([f],position,position,'one');assert.equal(projection.state.uploads,2);
 let disposed=0;const screen=scene.children[0].children[0];screen.material.map.addEventListener('dispose',()=>disposed++);screen.material.addEventListener('dispose',()=>disposed++);
 projection.update([],position,position);assert.equal(scene.children.length,0);assert.equal(projection.state.count,0);assert.equal(disposed,2);projection.dispose();projection.dispose();
});
test('closed shop keeps visible notice, unpowered projection turns off and does not glow',()=>{
 const scene=new Scene(),p=createTerminalProjections(scene,{canvasFactory}),f={...frame('closed'),available:false,status:'Shop closed'};p.update([f],new Vector3(),new Vector3());assert.equal(scene.children[0].visible,true);f.status='Power offline';p.update([f],new Vector3(),new Vector3());assert.equal(scene.children[0].visible,false);assert.equal(p.state.draws,0);p.dispose();
});
test('active settlement frames are removed when settlement availability is withdrawn',()=>{
 const claim={id:'world',origin:[0,0,0],quaternion:[0,0,0,1]},layout={id:'settlement-selene',claim,terminalPiece:{position:[-2,0,-22],rotation:Math.PI}},settlements={claims:[claim],layouts:[layout]},args={snapshot:{terminals:[]},settlements,station:null,baseActive:()=>{throw Error('not a registered base');}};
 assert.equal(terminalFrames(args).length,1);settlements.claims=[];assert.equal(terminalFrames(args).length,0);
});

test('unlinked local base terminals project their own name and obey base power',()=>{
 const claim={id:'claim-1',name:'Rockhaven',origin:[0,0,0],quaternion:[0,0,0,1],pieces:[{id:'piece-1',type:'terminal',position:[0,0,0]}]};
 const frames=terminalFrames({snapshot:{terminals:[]},localClaims:[claim],claimPowered:()=>false});assert.equal(frames.length,1);assert.equal(frames[0].name,'Rockhaven');assert.equal(frames[0].status,'Power offline');assert.equal(frames[0].available,false);
});
