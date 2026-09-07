import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sweepBox,constrainStationSweep} from '../../../src/station-collision.js';
const bytes=await fs.readFile(new URL('../../../assets/kestrel/kestrel.glb',import.meta.url));
const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=28+n;
function accessor(i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],k={SCALAR:1,VEC3:3,VEC4:4}[a.type];assert.equal(a.componentType,5126);return Array.from({length:a.count},(_,r)=>Array.from({length:k},(_,c)=>bytes.readFloatLE(bin+(v.byteOffset||0)+(a.byteOffset||0)+r*(v.byteStride||k*4)+c*4)));}
const anim=doc.animations.find(a=>a.name==='GearDown');
const track=(name,path)=>{const c=anim.channels.find(c=>doc.nodes[c.target.node].name===name&&c.target.path===path),s=anim.samplers[c.sampler];assert.equal(s.interpolation,'LINEAR');return {times:accessor(s.input).flat(),values:accessor(s.output)};};
const vertexPositions=node=>doc.meshes[node.mesh].primitives.flatMap(p=>accessor(p.attributes.POSITION).map(v=>v.map((n,i)=>n+(node.translation?.[i]||0))));
const thetaMaximum=Math.PI/2+1e-6;
function trigMin(y,z){let result=Math.min(y,y*Math.cos(thetaMaximum)-z*Math.sin(thetaMaximum));const theta=Math.atan2(-z,y)+Math.PI;for(const t of [theta,theta-2*Math.PI,theta+2*Math.PI])if(t>=0&&t<=thetaMaximum)result=Math.min(result,y*Math.cos(t)-z*Math.sin(t));return result;}
const gear=[];
for(const suffix of ['L','Nose','R']){
 const name='Gear_'+suffix,root=doc.nodes.find(n=>n.name===name),oleo=doc.nodes.find(n=>n.name==='Oleo_'+suffix),shoe=doc.nodes.find(n=>n.name==='ShoeJoint_'+suffix);
 const rootMesh=doc.nodes.find(n=>n.name===name+' / PBR'),oleoMesh=doc.nodes.find(n=>n.name==='Oleo_'+suffix+' / PBR'),shoeMesh=doc.nodes.find(n=>n.name==='ShoeJoint_'+suffix+' / PBR');
 const rotation=track(name,'rotation'),extension=track('Oleo_'+suffix,'translation'),counter=track('ShoeJoint_'+suffix,'rotation');
 assert.deepEqual(rotation.times,extension.times);assert.deepEqual(rotation.times,counter.times);
 const angles=rotation.values.map(q=>2*Math.atan2(q[0],q[3])),fullExtension=extension.values.at(-1)[1];
 const maximumNormError=Math.max(...rotation.values.map(q=>Math.abs(q.reduce((s,x)=>s+x*x,0)-1)));
 const minimumExtensionAngleRatio=Math.min(...angles.slice(0,-1).map((theta,i)=>(extension.values[i][1]-fullExtension)/theta));
 const minimumExtensionXRatio=Math.min(...rotation.values.slice(0,-1).map((q,i)=>(extension.values[i][1]-fullExtension)/q[0]));
 const slerpFactors=rotation.values.slice(0,-1).map((q,i)=>{const dot=q.reduce((s,x,k)=>s+x*rotation.values[i+1][k],0);assert.ok(dot>0&&1-dot*dot>Number.EPSILON);const omega=Math.acos(dot);return omega/Math.sin(omega);});
 const maximumSlerpWeightFactor=Math.max(...slerpFactors),runtimeExtensionXRatio=minimumExtensionXRatio/maximumSlerpWeightFactor;
 assert.ok(runtimeExtensionXRatio>.76);
 assert.ok(maximumNormError<2e-7);assert.ok(minimumExtensionAngleRatio>.381);assert.ok(angles.every((a,i)=>i===0||a<=angles[i-1]));
 for(let i=0;i<rotation.values.length;i++){assert.ok(rotation.values[i][1]===0);assert.ok(rotation.values[i][2]===0);assert.deepEqual(counter.values[i].map(v=>v===0?0:v),[-rotation.values[i][0],0,0,rotation.values[i][3]].map(v=>v===0?0:v));assert.equal(extension.values[i][0],0);assert.equal(extension.values[i][2],oleo.translation[2]);}
 const rootVertices=vertexPositions(rootMesh),oleoVertices=vertexPositions(oleoMesh),shoeVertices=vertexPositions(shoeMesh);
 const rigidLower=Math.min(...rootVertices.map(p=>root.translation[1]+trigMin(p[1],p[2])));
 const oleoLower=Math.min(...oleoVertices.map(p=>root.translation[1]+trigMin(p[1]+fullExtension,p[2]+oleo.translation[2])));
 const lowestShoeLocalY=Math.min(...shoeVertices.map(p=>p[1])),A=-(fullExtension+shoe.translation[1]),B=oleo.translation[2]+shoe.translation[2],contact=root.translation[1]-A+lowestShoeLocalY;
 assert.ok(rigidLower>.1);assert.ok(oleoLower>.03);assert.equal(contact,0);assert.ok(A>=1.65);assert.equal(B,.25);
 // The root and shoe quaternions are exact conjugates at each key. glTF's
 // rotation slerp preserves that relation between keys. In normalized rigid
 // rotation, the shoe minimum is A(1-cos(theta)) + d*cos(theta) - B*sin(theta),
 // with d/theta >= .381 (measured keys; .38 retained below as ample margin).
 // theta in [0,pi/4]: d*cos(theta) >= .38*theta/sqrt(2), sin(theta)<=theta.
 // theta in [pi/4,pi/2+1e-6]: A(1-cos(theta)) >=1.65*(1-1/sqrt(2));
 // the remaining negative terms are no worse than -.25-.600001e-6.
 const firstHalfSlopeMargin=.38/Math.SQRT2-.25;
 const secondHalfFloorMargin=1.65*(1-1/Math.SQRT2)-.25-.600001e-6;
 assert.ok(firstHalfSlopeMargin>0);assert.ok(secondHalfFloorMargin>.23);
 // Stronger certificate for the actual NON-normalized encoded quaternions.
 // Positive slerp weights obey A <= (1-t)F, B <= tF, F=omega/sin(omega).
 // Hence d >= .76*x throughout every interval, not just at sampled keys.
 // Their squared norm is 1+A²(e_a)+B²(e_b), so |norm²-1| <= maxError*F².
 // Exact conjugates make the composed shoe matrix (c²+s²)I in its YZ plane.
 // Thus bottom Y = 2*A*x² + d*(1-2*x²) - .5*x*w - 4*h*x²*(norm²-1).
 // Split at x=.4: the small-x linear and quadratic coefficients are positive;
 // the large-x branch has a positive constant lower bound.
 const normErrorBound=maximumNormError*maximumSlerpWeightFactor**2+1e-12;
 const ratio=Math.max(...rotation.values.map(q=>q[0]/q[3]));
 const xSquaredUpper=(1+normErrorBound)*ratio*ratio/(1+ratio*ratio);
 const maximumExtension=Math.max(...extension.values.map(v=>v[1]-fullExtension)),h=-lowestShoeLocalY;
 const smallXLinear=.76*(1-2*.4*.4)-.5*Math.sqrt(1+normErrorBound);
 const smallXQuadratic=2*A-4*h*normErrorBound;
 const largeXLower=2*A*.4*.4+Math.min(0,1-2*xSquaredUpper)*maximumExtension-.25*(1+normErrorBound)-4*h*xSquaredUpper*normErrorBound;
 assert.ok(smallXLinear>0&&smallXQuadratic>0&&largeXLower>.27);
 let actualQuaternionMinimum=Infinity,maximumConjugateProductError=0;
 for(let k=0;k<rotation.times.length-1;k++)for(let j=0;j<=100;j++){
  const t=j/100,q=[];THREE.Quaternion.slerpFlat(q,0,rotation.values[k],0,rotation.values[k+1],0,t);
  const c=1-2*q[0]*q[0],s=2*q[0]*q[3],factor=c*c+s*s,d=extension.values[k][1]*(1-t)+extension.values[k+1][1]*t-fullExtension;
  const y=root.translation[1]+(-A+d)*c-B*s+lowestShoeLocalY*factor;
  actualQuaternionMinimum=Math.min(actualQuaternionMinimum,y);maximumConjugateProductError=Math.max(maximumConjugateProductError,Math.abs(factor-1));
 }
 assert.ok(actualQuaternionMinimum>=-1e-12);
 gear.push({name,rigidRootLowerBound:rigidLower,oleoIndependentTranslationLowerBound:oleoLower,shoe:{A,B,lowestShoeLocalY,fullyDeployedContactY:contact,minimumExtensionAngleRatio,conservativeRatioUsed:.38,firstHalfSlopeMargin,secondHalfFloorMargin,maximumEncodedQuaternionNormError:maximumNormError,maximumSampledConjugateProductError:maximumConjugateProductError,actualQuaternionShoeMinAcross3601Subposes:actualQuaternionMinimum,actualRuntimeContinuousCertificate:{minimumExtensionXRatio,maximumSlerpWeightFactor,runtimeExtensionXRatio,conservativeRatioUsed:.76,normErrorBound,xSquaredUpper,smallXLinear,smallXQuadratic,largeXLower,conclusion:'All terms in the small-x bound are nonnegative; large-x lower bound is positive. Encoded quaternion scale error is included. Exact full-deployment contact is 0.'}}});
}
const floor=new THREE.Box3(new THREE.Vector3(-100,0,-100),new THREE.Vector3(100,0,100)),tree={bounds:floor,boxes:[floor]},start=new THREE.Vector3(0,2.49,0),up=new THREE.Vector3(0,2.54,0),side=new THREE.Vector3(.05,2.49,0),seat=new THREE.Vector3(0,2.49,-1.9),max=new THREE.Vector3(.25,2.105,4).sub(seat);
const sweeps=[];for(const bottom of [-.019,0])for(const [name,end]of [['up',up],['side',side]]){const min=new THREE.Vector3(-.25,bottom,-5.635).sub(seat),result=constrainStationSweep(tree,[],start,end,min,max);sweeps.push({bottom,motion:name,hit:result.hit,point:result.point.toArray()});assert.equal(result.hit,bottom<0);}
const report={assetSha256:crypto.createHash('sha256').update(bytes).digest('hex'),method:'Analytic coordinate lower bounds for rigid root/oleo meshes and synchronized counter-rotated shoes, with source track assertions. Stronger shoe certificate includes actual encoded non-unit quaternion errors and all positive-slerp interpolation weights. Original encoded quaternion transform additionally evaluated at 3601 unique subposes per gear. Actual station sweep called with a flat authored floor; no runtime edits.',gear,sweeps,recommendation:'For this rig, replace only the continuous Gear_Nose/L/R envelope minY padding with contact plane 0. Retain conservative x/z and top margins. Update aggregate flightBounds minY to 0. Preserve the original padded audit as historical broad bounds, and document why a tighter one-sided floor bound is justified. No station-wide overlap escape exception is necessary.',limits:['Future compression/deformation/gear motion changes require a new floor bound.','This is a source-geometry and floor-sweep diagnosis, not a whole station launch or browser test.']};
await fs.writeFile('/tmp/kestrel-review-gear-floor.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
