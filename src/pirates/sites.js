import * as THREE from 'three';
import {AEON,SELENE,bodySurfacePoint,bodySurfaceNormal} from '../celestial.js';
import {terrainHeight} from '../world.js';

export const PIRATE_ROLES=Object.freeze({
 'aeon-leader':{name:'Red Wake captain',role:'leader',health:120,speed:1.6,range:25,attackRange:65,damage:7,aim:1.35,reload:3.2,burst:3},
 'aeon-raider':{name:'Red Wake raider',role:'raider',health:90,speed:2.5,range:14,attackRange:34,damage:5,aim:1.15,reload:3.4,burst:2},
 'aeon-flanker':{name:'Red Wake scout',role:'flanker',health:75,speed:2.8,range:19,attackRange:50,damage:4,aim:1.05,reload:2.8,burst:2},
 'selene-leader':{name:'Vacuum Jackal captain',role:'leader',health:150,speed:1.3,range:29,attackRange:70,damage:9,aim:1.55,reload:3.8,burst:2},
 'selene-adjutant':{name:'Vacuum Jackal adjutant',role:'flanker',health:105,speed:2.1,range:23,attackRange:55,damage:6,aim:1.3,reload:3.2,burst:2},
});
const configs=[
 {id:'aeon-pirates',body:AEON,name:'Red Wake salvage camp',description:'A captain holds the yard while a raider closes in and a scout flanks. Break their sight lines and watch the amber aim warning.',direction:[.013597990268841662,.6051666666666666,.795982663263594],offset:1400,models:['aeon-leader','aeon-raider','aeon-flanker']},
 {id:'selene-pirates',body:SELENE,name:'Vacuum Jackal cache',description:'Armoured scavengers defend a lunar cache. Their captain fires slow, heavy bursts; the adjutant moves between cover.',direction:[1,0,0],offset:900,models:['selene-leader','selene-adjutant']},
];
/** A site is a tangent frame only. Every floor contact samples the real body. */
export function createPirateSites(){return configs.map(config=>{
 const up=new THREE.Vector3(...config.direction).normalize();
 const east=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),up).normalize();
 const back=new THREE.Vector3().crossVectors(east,up).normalize();
 // Search for a gentle, dry clearing; never flatten or substitute terrain.
 let selected=null,best=Infinity;
 for(let i=0;i<180;i++){
  const d=up.clone().addScaledVector(east,(config.offset+(i%15)*60)/config.body.radius).addScaledVector(back,Math.floor(i/15)*60/config.body.radius).normalize();
  if(config.body===AEON&&terrainHeight(...d.toArray())<12)continue;
  const center=bodySurfacePoint(d,config.body),heights=[];
  for(const x of [-35,0,35])for(const z of [-45,0,45]){const p=center.clone().addScaledVector(east,x).addScaledVector(back,z);const ground=bodySurfacePoint(p.sub(new THREE.Vector3(...config.body.center)).normalize(),config.body);heights.push(ground.sub(center).dot(d));}
  const relief=Math.max(...heights)-Math.min(...heights);if(relief<best){best=relief;selected=d;}if(relief<1.2)break;
 }
 if(!selected)throw Error('No dry pirate site');
 const origin=bodySurfacePoint(selected,config.body),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),selected).normalize(),rear=new THREE.Vector3().crossVectors(right,selected).normalize();
 const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,selected,rear));
 const site={...config,bodyId:config.body.id,direction:selected.toArray(),origin:origin.toArray(),up:selected.toArray(),right:right.toArray(),back:rear.toArray(),rotation:rotation.toArray(),relief:best};
 site.ground=(x,z,clearance=0)=>{const p=origin.clone().addScaledVector(right,x).addScaledVector(rear,z).sub(new THREE.Vector3(...config.body.center)).normalize();return bodySurfacePoint(p,config.body,clearance);};
 site.local=p=>{const v=p.clone().sub(origin);return {x:v.dot(right),y:v.dot(selected),z:v.dot(rear)};};
 site.normal=(x,z)=>bodySurfaceNormal(site.ground(x,z),config.body);
 site.approach=site.ground(0,65,35);site.cache=site.ground(0,-8);
 // Waist-height salvage barriers: genuine geometry and matching blockers.
 site.cover=[{x:-10,z:1,w:5,d:1.6,h:1.08},{x:10,z:-5,w:5,d:1.6,h:1.08},{x:0,z:-15,w:6,d:1.8,h:1.25},{x:-18,z:-13,w:2,d:4,h:1.65},{x:19,z:10,w:2,d:4,h:1.65}];
 return site;
});}
