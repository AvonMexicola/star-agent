import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {AEON,SELENE,PYRE} from '../src/celestial.js';
import {PYRE_RADIUS,PYRE_EPOCH,pyreFrameAt,setPyreEpoch,toPyreBody} from '../src/pyre-world.js';
import {constructionDepositDescriptor} from '../src/mining/construction-deposits.js';
import {withClaimAnchor,restoreBuildAnchors,validClaimAnchor} from '../src/build/anchors.js';
const epoch=1788739200000;
function pyreClaim(at=epoch){
 const frame=pyreFrameAt(at),bodyRotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...frame.x),new Vector3(...frame.y),new Vector3(...frame.z)));
 const local=new Vector3(.3,.8,.5).normalize().multiplyScalar(PYRE_RADIUS+1500),localRotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.42);
 return {id:'build-claim-1',body:'pyre',origin:local.clone().applyQuaternion(bodyRotation).add(new Vector3(...frame.position)).toArray(),quaternion:bodyRotation.multiply(localRotation).toArray(),pieces:[{id:'build-piece-2',position:[4,.3,-8],rotation:Math.PI/2}],useBuffer:true};
}
test('Pyre claims follow both orbital translation and tidal rotation on a later-page epoch',()=>{
 const original=pyreClaim(),anchored=withClaimAnchor(original,{epoch}),build={version:1,nextId:3,claims:[anchored]},before=structuredClone(build);
 const later=epoch+86400000,restored=restoreBuildAnchors(build,{epoch:later});assert.equal(restored.ok,true);
 const expected=pyreClaim(later),actual=restored.build.claims[0];
 assert.ok(new Vector3(...actual.origin).distanceTo(new Vector3(...expected.origin))<.00001);
 assert.ok(new Quaternion(...actual.quaternion).angleTo(new Quaternion(...expected.quaternion))<1e-7);
 assert.deepEqual(actual.pieces,original.pieces);assert.equal(actual.useBuffer,true);assert.deepEqual(build,before,'rehydration never mutates persisted input');
 assert.deepEqual(actual.anchor,anchored.anchor);assert.ok(new Vector3(...actual.origin).distanceTo(new Vector3(...original.origin))>1000000,'the test crosses a meaningful orbital displacement');
 const twice=restoreBuildAnchors(restored.build,{epoch:later});assert.deepEqual(twice.build,restored.build,'repeated rehydration never compounds drift');
});
test('old Pyre claims require a known original epoch; missing or malformed anchors retain original data',()=>{
 const original={claims:[pyreClaim()]},rejected=restoreBuildAnchors(original,{epoch:epoch+86400000});assert.equal(rejected.ok,false);assert.equal(rejected.build,original);
 const migrated=restoreBuildAnchors(original,{epoch:epoch+86400000,legacyPyreEpoch:epoch});assert.equal(migrated.ok,true);assert.equal(validClaimAnchor(migrated.build.claims[0]),true);
 const tagged={claims:[{...pyreClaim(),epoch}]};assert.equal(restoreBuildAnchors(tagged,{epoch:epoch+1000}).ok,true);
 for(const corrupt of [a=>{a.origin[0]=NaN;},a=>{a.quaternion=[0,0,0,0];},a=>{a.body='aeon';},a=>{a.origin=[0,0,0];}]){
  const claim=withClaimAnchor(pyreClaim(),{epoch});corrupt(claim.anchor);const build={claims:[claim]};assert.equal(restoreBuildAnchors(build,{epoch}).ok,false);assert.equal(restoreBuildAnchors(build,{epoch}).build,build);
 }
});
test('legacy static-world claims migrate without moving the local site or its pieces',()=>{
 for(const body of [AEON,SELENE]){
  const claim={body:body.id,origin:new Vector3(...body.center).add(new Vector3(0,body.radius+100,0)).toArray(),quaternion:[0,0,0,1],pieces:[{position:[4,.3,0]}]};
  const restored=restoreBuildAnchors({claims:[claim]},{epoch});assert.equal(restored.ok,true);assert.deepEqual(restored.build.claims[0].origin,claim.origin);assert.deepEqual(restored.build.claims[0].quaternion,claim.quaternion);assert.deepEqual(restored.build.claims[0].pieces,claim.pieces);
 }
 assert.deepEqual(restoreBuildAnchors(undefined),{ok:true,build:undefined});
});

test('Pyre mined-domain IDs, density seed, profile and body-fixed placement survive a changed epoch',()=>{
 const originalEpoch=PYRE_EPOCH;
 try{
  const samples=[];
  for(const at of [epoch,epoch+86400000]){
   setPyreEpoch(at);const frame=pyreFrameAt(at),body={...PYRE,center:frame.position};
   const descriptor=constructionDepositDescriptor(body,6300,300);
   const local=new Vector3(...descriptor.position.toArray()).sub(new Vector3(...frame.position));
   samples.push({id:descriptor.id,variant:descriptor.variant,weights:descriptor.resourceWeights,local:toPyreBody(...local.toArray()),anchor:withClaimAnchor({body:'pyre',origin:descriptor.position.toArray(),quaternion:descriptor.quaternion.toArray()},{epoch:at}).anchor});
  }
  assert.equal(samples[0].id,samples[1].id);assert.equal(samples[0].variant,samples[1].variant);assert.deepEqual(samples[0].weights,samples[1].weights);
  assert.ok(new Vector3(...samples[0].local).distanceTo(new Vector3(...samples[1].local))<.001,JSON.stringify(samples));
  assert.ok(new Quaternion(...samples[0].anchor.quaternion).angleTo(new Quaternion(...samples[1].anchor.quaternion))<.001);
 }finally{setPyreEpoch(originalEpoch);}
});
