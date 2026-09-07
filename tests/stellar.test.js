import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {SUN_RADIUS,SUN_DISTANCE,SUN_DIRECTION,RADIUS} from '../src/world.js';
import {SUN_POSITION,SUN_STANDOFF,SUN_EXCLUSION,sunAngularRadius,sunStandoffPoint,sunVisibility} from '../src/stellar-world.js';
import {createStellarThermal,stellarExposure,stepStellarThermal,stellarIncursion,STELLAR_THERMAL} from '../src/stellar-thermal.js';
import {TRAVEL_TARGETS,planTravel,sampleTravel,abortTravel} from '../src/travel-model.js';
import {Navigation} from '../src/navigation.js';
import {bodyAt} from '../src/celestial.js';
const center=new Vector3(...SUN_POSITION),outward=new Vector3(...SUN_DIRECTION).negate();
const point=clearance=>center.clone().addScaledVector(outward,SUN_RADIUS+clearance);
function setup(t){
 const oldDoc=globalThis.document,oldWindow=globalThis.window;
 const document={hidden:false,addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};
 globalThis.document=document;globalThis.window={addEventListener(){}};
 t.after(()=>{if(oldDoc)globalThis.document=oldDoc;else delete globalThis.document;if(oldWindow)globalThis.window=oldWindow;else delete globalThis.window;});
 return new Navigation({addEventListener(){}},()=>{});
}
test('stellar size is physically doubled at Aeon and grows with proximity',()=>{
 assert.equal(SUN_RADIUS,240000000);
 assert.ok(Math.abs(sunAngularRadius(SUN_DISTANCE)/Math.asin(120000000/SUN_DISTANCE)-2)<.0001);
 assert.ok(sunAngularRadius(10000000000)>sunAngularRadius(SUN_DISTANCE)*2.49);
 assert.ok(Math.abs(sunStandoffPoint().distanceTo(center)-SUN_RADIUS-500000000)<.001);
});
test('the drive stops above the star and rejects trajectories through the exclusion sphere',()=>{
 const target=TRAVEL_TARGETS.find(t=>t.id==='star');assert.equal(target.arrivalRadius,SUN_STANDOFF);assert.equal(target.exclusionRadius,SUN_EXCLUSION);
 const start=new Vector3(...SUN_DIRECTION).multiplyScalar(RADIUS*2.8),route=planTravel(start,'star');assert.ok(route.ok,route.reason);
 let previous=start;
 for(let t=0;t<=route.plan.duration;t+=.25){const state=sampleTravel(route.plan,t);assert.ok(state.position.distanceTo(center)>=SUN_STANDOFF-.001);assert.ok(state.position.distanceTo(previous)<8e7);previous=state.position;}
 assert.ok(Math.abs(sampleTravel(route.plan,Infinity).position.distanceTo(center)-SUN_STANDOFF)<.001);
 const behind=center.clone().addScaledVector(outward,-2000000000);assert.equal(planTravel(behind,'aeon').ok,false);
 assert.equal(planTravel(point(50000000),'aeon').ok,false);
 const brake=abortTravel(route.plan,route.plan.duration*.5);assert.ok(brake.end.distanceTo(center)>=SUN_STANDOFF-.001);
});
test('radiation obeys inverse-square flux and the observation point is indefinitely safe',()=>{
 assert.ok(Math.abs(stellarExposure(SUN_STANDOFF).flux/stellarExposure(SUN_STANDOFF*2).flux-4)<1e-12);
 const initial=createStellarThermal(),warm=stepStellarThermal(initial,SUN_STANDOFF,600);
 assert.equal(initial.temperature,290);assert.equal(warm.hull,100);assert.equal(warm.destroyed,false);assert.ok(warm.temperature>1000&&warm.temperature<STELLAR_THERMAL.warning);
});
test('excess radiation causes persistent hull loss, retreat cools, and destruction is terminal',()=>{
 const warm=stepStellarThermal(createStellarThermal(),SUN_STANDOFF,120),damaged=stepStellarThermal(warm,SUN_RADIUS+150000000,45);
 assert.ok(damaged.hull<100&&damaged.hull>0);assert.ok(damaged.temperature>STELLAR_THERMAL.damage);
 const cooled=stepStellarThermal(damaged,SUN_DISTANCE,150);assert.ok(cooled.temperature<400);assert.ok(cooled.hull<=damaged.hull&&cooled.hull>0);
 const destroyed=stepStellarThermal(damaged,SUN_RADIUS+150000000,120);assert.equal(destroyed.destroyed,true);assert.equal(destroyed.hull,0);
 assert.deepEqual(stepStellarThermal(destroyed,SUN_DISTANCE,600),destroyed);
});
test('thermal integration is stable across update rates and ignores paused time',()=>{
 const initial=stepStellarThermal(createStellarThermal(),SUN_STANDOFF,90),distance=SUN_RADIUS+150000000;
 const once=stepStellarThermal(initial,distance,30);let sixty=initial;
 for(let i=0;i<1800;i++)sixty=stepStellarThermal(sixty,distance,1/60);
 assert.ok(Math.abs(once.temperature-sixty.temperature)<.0001);assert.ok(Math.abs(once.hull-sixty.hull)<.2);
 assert.deepEqual(stepStellarThermal(initial,distance,0),initial);
});
test('swept lethal contact catches pass-through, starts inside, and tangency without mutating inputs',()=>{
 const a=point(500000000),b=center.clone().addScaledVector(outward,-740000000),saved=a.clone();
 const hit=stellarIncursion(a,b);assert.ok(hit);assert.ok(Math.abs(hit.distanceTo(center)-SUN_RADIUS-STELLAR_THERMAL.lethalClearance)<.001);assert.ok(a.equals(saved));
 assert.ok(stellarIncursion(center,center));assert.equal(stellarIncursion(a,a.clone().add(outward)),null);
 const r=SUN_RADIUS+STELLAR_THERMAL.lethalClearance,tangent=new Vector3().crossVectors(outward,new Vector3(0,1,0)).normalize();
 assert.ok(stellarIncursion(center.clone().addScaledVector(outward,r).addScaledVector(tangent,-r),center.clone().addScaledVector(outward,r).addScaledVector(tangent,r)));
});
test('navigation uses the star domain, blocks landing and locks a destroyed ship until recovery',t=>{
 const n=setup(t);n.transitStar();assert.equal(n.body.id,'star');assert.equal(bodyAt(n.position).id,'star');assert.equal(n.flightEnvironment.density,0);
 n.landOrLaunch();assert.equal(n.autoland,false);n.embark();assert.equal(n.mode,'flight');
 n.position.copy(point(150000000));n.updateStellarThermal(300);assert.equal(n.mode,'destroyed');const position=n.position.clone();
 n.landOrLaunch();n.embark();n.travelTarget='aeon';assert.equal(n.beginTravel(),false);n.orbit();assert.ok(n.position.equals(position));
 n.keys.add('KeyW');n.update(.1);assert.ok(n.position.equals(position));
 n.recoverFromStar();assert.equal(n.mode,'flight');assert.equal(n.body.id,'aeon');assert.equal(n.stellarThermal.hull,100);
});
test('manual motion is swept against the lethal shell before planetary collision code',t=>{
 const n=setup(t);n.transitStar();n.flightAssist=false;n.position.copy(point(20001000));n.velocity.copy(outward).multiplyScalar(-50000000);n.update(.1);
 assert.equal(n.mode,'destroyed');assert.equal(n.stellarThermal.reason,'Photosphere incursion');
 assert.ok(n.position.distanceTo(center)>=SUN_RADIUS+STELLAR_THERMAL.lethalClearance-.01);
});
test('planetary occultation hides stellar lens light on Aeon night side',()=>{
 assert.equal(sunVisibility(new Vector3(...SUN_DIRECTION).multiplyScalar(-RADIUS*2.8)),0);
 assert.equal(sunVisibility(sunStandoffPoint()),1);
});
