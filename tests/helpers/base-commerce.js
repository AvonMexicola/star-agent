import { Scene,Vector3,Quaternion } from 'three';
import { MiningStore } from '../../src/mining/store.js';
import { BuildSystem } from '../../src/build/system.js';
import { SELENE,bodySurfacePoint,bodySurfaceNormal } from '../../src/celestial.js';
import { MOON_LANDING_DIRECTION } from '../../src/moon-world.js';
import { LocalTrading } from '../../src/trading/local.js';
import { baseBuild } from '../../src/trading/base-site.js';
export function baseFixture(){
  const entries=new Map(),disk={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)},store=new MiningStore(disk);
  const origin=bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE),normal=bodySurfaceNormal(origin,SELENE);
  const nav={mode:'walk',insideShip:false,body:SELENE,altitude:1.75,position:origin.clone(),normal,orientation:new Quaternion(),keys:new Set(),gamepad:{suspend(){}},shipPosition:null,stationDistance:1e6};
  const build=new BuildSystem({scene:new Scene(),nav,store,render:false}),claim=build.newClaim(origin);
  const piece=(id,type,position,extra={})=>({id:`build-piece-${id}`,type,position,rotation:0,doorOpen:false,...extra});
  claim.pieces=[piece(2,'foundation-pad-medium',[0,.5,0],{landingPad:true}),piece(3,'mainframe',[14,.5,16]),piece(4,'terminal',[14,.5,12]),piece(5,'rack',[14,.5,8])];
  for(const [id,name,boxes]of [['build-core-1','Mainframe',2],['build-crate-5','Ore rack',8]])store.registerContainer({id,name,boxes});
  store.write({...store.state,build:baseBuild(claim)});
  nav.position.copy(build.toWorld(new Vector3(14,2.25,14),claim));
  const local=new LocalTrading(store);let serial=0;
  const command=m=>local.command({commandId:`test-${++serial}`,revision:local.state.revision,ship:'local-player:nomad',...m},{nav,terminal:()=>true,docked:()=>true});
  const link=()=>command({op:'base-register',claim,terminalPiece:'build-piece-4'});
  return {store,disk,build,claim,nav,local,command,link};
}
