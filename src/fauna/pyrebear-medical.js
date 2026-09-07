/** Offline injury/recovery adapter. Health and all cargo remain in Loadout's
 * existing atomic store. The caller owns bite distance, cooldown and pause gates;
 * enabled must be false while online, independently of those gameplay gates. */
export function createPyrebearMedical({nav,loadout,enabled=()=>true,onRecover}={}) {
  const doc=globalThis.document;
  let disposed=false,locked=false,restoreEnabled=false,dialog=null,feedback=null,message='',creatureName=null;
  const downed=()=>loadout.state.health===0;
  const allowed=()=>!disposed&&enabled();
  const result=(ok,text)=>{message=text;if(feedback)feedback.textContent=text;return {ok,message:text};};
  function clearInput(){
    nav.keys.clear();nav.toolTrigger=0;nav.boost=false;
    nav.resetSteering?.();nav.velocity?.set(0,0,0);
  }
  function ensureDialog(){
    if(!doc||dialog)return;
    dialog=doc.createElement('dialog');dialog.id='pyrebear-medical-dialog';
    dialog.setAttribute('aria-labelledby','pyrebear-medical-title');
    dialog.setAttribute('aria-describedby','pyrebear-medical-description');
    dialog.innerHTML='<div class="dialog-top"><span class="eyebrow">SUIT MEDICAL</span><button type="button" aria-label="Close medical notice" disabled title="Emergency evacuation is required to resume">×</button></div><h2 id="pyrebear-medical-title">Wildlife attack</h2><p id="pyrebear-medical-description">You are downed. Emergency evacuation to Aeon orbit · inventory retained.</p><button type="button" class="primary-button" data-controller-focus data-controller-key="pyrebear-evacuate">Emergency evacuation</button><p role="status" aria-live="polite"></p><p>D-pad selects · A confirms. Evacuate to resume exploration.</p>';
    feedback=dialog.querySelector('[role="status"]');feedback.textContent=message;
    dialog.querySelector('[data-controller-focus]').addEventListener('click',recover);
    // Escape can be cancelled, but the shared controller router calls close()
    // directly. Its close event and update fallback both retain the health gate.
    dialog.addEventListener('cancel',event=>{if(allowed()&&downed())event.preventDefault();});
    dialog.addEventListener('close',()=>{
      if(allowed()&&downed())lock();
    });
    doc.body.append(dialog);
  }
  function lock(){
    if(!locked){
      restoreEnabled=nav.enabled;locked=true;nav.gamepad?.suspend();
      if(doc?.pointerLockElement){
        try{doc.exitPointerLock?.()?.catch?.(()=>{});}catch{/* Lost pointer lock already. */}
      }
    }
    nav.enabled=false;clearInput();ensureDialog();
    if(dialog&&!dialog.open){dialog.showModal();dialog.querySelector('[data-controller-focus]').focus();}
  }
  function release(){
    if(!locked)return;
    locked=false;clearInput();nav.gamepad?.suspend();
    if(dialog?.open)dialog.close();
    nav.enabled=restoreEnabled&&!doc?.querySelector('dialog[open]');
    if(nav.enabled)nav.onTakeControl?.();
  }
  function update(){
    if(disposed)return;
    if(enabled()&&downed())lock();
    else release();
  }
  function applyBite(amount,{creatureName:attacker='Pyrebear'}={}){
    if(!allowed())return result(false,'Wildlife injury is available offline only.');
    if(!Number.isFinite(amount)||amount<=0)return result(false,'Invalid injury.');
    if(downed())return result(false,'Already downed. Emergency evacuation required.');
    const transaction=loadout.injure(amount,{bleeding:true});
    if(!transaction.ok)return result(false,transaction.message);
    creatureName=typeof attacker==='string'&&attacker.trim()?attacker.trim().slice(0,64):'Pyrebear';
    const attack=result(true,`${creatureName} attack${downed()?' · Emergency evacuation required.':''}`);
    update();return {...transaction,...attack};
  }
  function recover(){
    if(!allowed())return result(false,'Emergency evacuation is available offline only.');
    if(!downed())return result(false,'Emergency evacuation requires a downed character.');
    lock();
    // Never move the player or close the recovery UI before persistence succeeds.
    const transaction=loadout.save({...loadout.state,health:100,bleeding:false},'Emergency evacuation to Aeon orbit · inventory retained');
    if(!transaction.ok){result(false,transaction.message);update();return transaction;}
    result(true,transaction.message);
    try{if(onRecover)onRecover();else nav.orbit();}finally{release();}
    return transaction;
  }
  return {applyBite,update,recover,dispose(){
    if(disposed)return;disposed=true;
    // Removing this adapter must not revive or unlock an offline downed player.
    if(locked&&enabled()&&downed()){clearInput();nav.enabled=false;nav.gamepad?.suspend();locked=false;}
    else release();
    dialog?.remove();dialog=null;feedback=null;
  },get state(){return {downed:downed(),locked,open:Boolean(dialog?.open),health:loadout.state.health,creatureName,message};}};
}
