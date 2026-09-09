import test from 'node:test';import assert from 'node:assert/strict';
import {BoxGeometry,Vector3} from 'three';
import {RockCollision} from '../src/mining/collision.js';
import {createPirateNaturalObstacles} from '../src/pirates/obstacles.js';
import {createPirateSites} from '../src/pirates/sites.js';
import {setPlanetSeed} from '../src/generation.js';
function fixture(){
 const geometry=new BoxGeometry(2,3,2).translate(0,1.5,0).toNonIndexed(),collision=new RockCollision(geometry.attributes.position.array);
 const rock={ready:true,grounded:true},landmark={grounded:false,raycast:()=>null,constrain:(a,b)=>{landmark.grounded=true;return {point:b,hit:false};}};
 const mining={ground:rock,regionalRocks:new Map([['edited',rock]]),fieldCache:{raycast:()=>null},landmarks:landmark,stones:{raycast:()=>null},readyRaycast:(a,d,r)=>collision.raycast(a,d,r),constrainWalker:(a,b)=>{rock.grounded=false;return collision.sweep(a,b);}};
 return {mining,rock,landmark,obstacles:createPirateNaturalObstacles(mining)};
}
test('actual rock triangles block NPC sight, shots and standing-capsule movement',()=>{
 const {obstacles,rock,landmark}=fixture(),a=new Vector3(-3,1.75,0),b=new Vector3(3,1.75,0),direction=b.clone().sub(a).normalize();
 assert.equal(obstacles.raycast(a,direction,6).distance,2);
 assert.equal(obstacles.canWalk(a,b),false);
 assert.equal(obstacles.canWalk(a.clone().setZ(4),b.clone().setZ(4)),true);
 assert.equal(rock.grounded,true);assert.equal(landmark.grounded,false,'NPC queries preserve the player jump contact');
});
test('unpromoted stones and non-mineable landmarks occlude without changing mining aim',()=>{
 const {mining,obstacles}=fixture();let excluded;
 mining.target='player-selected-rock';mining.stones.raycast=(a,d,r,set)=>{excluded=set;return {distance:1.5};};mining.landmarks.raycast=()=>({distance:1});
 assert.equal(obstacles.raycast(new Vector3(-3,1,0),new Vector3(1,0,0),6).distance,1);
 assert.ok(excluded.has('edited'));assert.equal(mining.target,'player-selected-rock');
});
test('Selene ship and ramp approach avoids the steep ground that stranded the first route',()=>{
 setPlanetSeed(7291);const site=createPirateSites().find(s=>s.bodyId==='selene'),up=new Vector3(...site.up);
 for(let x=-15;x<=15;x+=3)for(let z=50;z<=90;z+=3)assert.ok(site.normal(x,z).dot(up)>Math.cos(5*Math.PI/180),`steep approach at ${x},${z}`);
 assert.ok(site.relief<6);assert.ok(site.ground(0,65,35).distanceTo(site.approach)<1e-8);
});
