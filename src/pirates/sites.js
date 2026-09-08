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
 let selected=null,best=Infinity,selectedRelief=Infinity;
 const lunar=config.body===SELENE,columns=lunar?25:15;
 for(let i=0;i<(lunar?600:180);i++){
  const d=up.clone().addScaledVector(east,(config.offset+(i%columns)*60)/config.body.radius).addScaledVector(back,Math.floor(i/columns)*60/config.body.radius).normalize();
  if(config.body===AEON&&terrainHeight(...d.toArray())<12)continue;
  const center=bodySurfacePoint(d,config.body),heights=[];
  const ground=(x,z)=>bodySurfacePoint(center.clone().addScaledVector(east,x).addScaledVector(back,z).sub(new THREE.Vector3(...config.body.center)).normalize(),config.body);
  for(const x of [-35,0,35])for(const z of lunar?[-45,0,45,65,90]:[-45,0,45])heights.push(ground(x,z).sub(center).dot(d));
  const relief=Math.max(...heights)-Math.min(...heights);let slope=0;
  // The lunar camp can look flat while its approach lands on a small, steep
  // formation. Sample the complete hull/ramp/walking apron, not just the yard.
  if(lunar&&relief<=8)for(let x=-15;x<=15;x+=3)for(let z=50;z<=90;z+=3)slope=Math.max(slope,Math.acos(Math.min(1,bodySurfaceNormal(ground(x,z),config.body).dot(d)))*180/Math.PI);
  const score=lunar?(relief>8?1000+relief:relief+slope*2):relief;
  if(score<best){best=score;selected=d;selectedRelief=relief;}
  if(lunar?relief<6&&slope<5:relief<1.2)break;
 }
 if(!selected)throw Error('No dry pirate site');
 const origin=bodySurfacePoint(selected,config.body),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),selected).normalize(),rear=new THREE.Vector3().crossVectors(right,selected).normalize();
 const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,selected,rear));
 const site={...config,bodyId:config.body.id,direction:selected.toArray(),origin:origin.toArray(),up:selected.toArray(),right:right.toArray(),back:rear.toArray(),rotation:rotation.toArray(),relief:selectedRelief};
 site.ground=(x,z,clearance=0)=>{const p=origin.clone().addScaledVector(right,x).addScaledVector(rear,z).sub(new THREE.Vector3(...config.body.center)).normalize();return bodySurfacePoint(p,config.body,clearance);};
 site.local=p=>{const v=p.clone().sub(origin);return {x:v.dot(right),y:v.dot(selected),z:v.dot(rear)};};
 site.normal=(x,z)=>bodySurfaceNormal(site.ground(x,z),config.body);
 site.approach=site.ground(0,65,35);site.cache=site.ground(0,-8);
 // Waist-height salvage barriers: genuine geometry and matching blockers.
 site.cover=[{x:-10,z:1,w:5,d:1.6,h:1.08},{x:10,z:-5,w:5,d:1.6,h:1.08},{x:0,z:-15,w:6,d:1.8,h:1.25},{x:-18,z:-13,w:2,d:4,h:1.65},{x:19,z:10,w:2,d:4,h:1.65}];
 return site;
});}
