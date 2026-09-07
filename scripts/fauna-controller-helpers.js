async function frames(page,count=3){await page.evaluate(async count=>{for(let i=0;i<count;i++)await new Promise(r=>requestAnimationFrame(r));},count);}
async function pad(page,axes=[0,0,0,0],buttons={}){await page.evaluate(({axes,buttons})=>{window.faunaPad.axes=axes;for(const[i,value]of Object.entries(buttons))window.faunaPad.buttons[i]={pressed:value>.5,value};},{axes,buttons});await frames(page);}
async function tap(page,i){await pad(page,undefined,{[i]:1});await pad(page,undefined,{[i]:0});await frames(page);}
async function state(page){return page.evaluate(()=>window.starAgent.state);}
async function walkLocal(page,x,z,tolerance=.15){
 const deadline=Date.now()+45000;
 while(Date.now()<deadline){
  const move=await page.evaluate(({x,z})=>{const n=window.starAgent.navigation,p=n.toShipLocal(),desired=p.clone().set(x-p.x,0,z-p.z),distance=desired.length();desired.normalize();const inverse=n.shipOrientation.clone().invert(),f=p.clone().set(0,0,-1).applyQuaternion(n.orientation).applyQuaternion(inverse),r=p.clone().set(1,0,0).applyQuaternion(n.orientation).applyQuaternion(inverse);f.y=r.y=0;f.normalize();r.normalize();const speed=Math.min(.8,Math.max(.25,distance));return{distance,axes:[desired.dot(r)*speed,-desired.dot(f)*speed,0,0]};},{x,z});
  if(move.distance<tolerance){await pad(page);return;}await pad(page,move.axes);
 }
 throw Error(`Controller cannot reach local ${x},${z}; ${JSON.stringify((await state(page)).shipLocal)}`);
}
async function aim(page,id){
 for(let i=0;i<180;i++){
  const error=await page.evaluate(id=>{const n=window.starAgent.navigation,e=window.starAgent.state.fauna.entities.find(e=>e.id===id),height=e.species==='pyrebear'?.9:e.species==='aeon-grazer'?1.1:e.species==='aeon-amphibian'?.4:.5,target=n.position.clone().fromArray(e.position).addScaledVector(n.position.clone().fromArray(e.normal),height).sub(n.position).applyQuaternion(n.orientation.clone().invert());return[Math.atan2(target.x,-target.z),Math.atan2(target.y,Math.hypot(target.x,target.z))];},id);
  if(Math.abs(error[0])<.012&&Math.abs(error[1])<.012){await pad(page);return;}
  const axis=v=>Math.sign(v)*Math.min(.8,.12+Math.abs(v)*1.7);await pad(page,[0,0,axis(error[0]),axis(-error[1])]);
 }
 throw Error('Right-stick aim did not converge');
}
async function approach(page,id,range){
 const deadline=Date.now()+90000;
 while(Date.now()<deadline){
  const m=await page.evaluate(({id,range})=>{const n=window.starAgent.navigation,e=window.starAgent.state.fauna.entities.find(e=>e.id===id),desired=n.position.clone().fromArray(e.position).sub(n.position).projectOnPlane(n.normal),distance=desired.length();desired.normalize();const f=n.position.clone().set(0,0,-1).applyQuaternion(n.orientation).projectOnPlane(n.normal).normalize(),r=n.position.clone().set(1,0,0).applyQuaternion(n.orientation).projectOnPlane(n.normal).normalize();return{distance,axes:[desired.dot(r)*.85,-desired.dot(f)*.85,0,0]};},{id,range});
  if(m.distance<range){await pad(page);return;}await pad(page,m.axes);await frames(page,6);
 }
 throw Error('Controller approach timed out');
}

export {frames,pad,tap,state,walkLocal,aim,approach};
