export const HUD_MODES = Object.freeze([
  {id:'full', label:'Everything'},
  {id:'markers', label:'Markers and reticle'},
  {id:'none', label:'No HUD'},
]);

/** Presentation only: game visibility, input arming and native dialogs retain
 * their existing owners. Starting with Everything makes every fresh visit usable. */
export function createHUDDisplay({body,canvas,canChange}) {
  let index=0;
  const buttons=new Set();
  function set(next) {
    index=next;
    const mode=HUD_MODES[index];
    body.dataset.hudMode=mode.id;
    // Retain the existing screenshot hook and inventory launcher's convention.
    body.classList.toggle('photo-mode',mode.id==='none');
    for(const button of buttons){
      button.textContent=`HUD · ${mode.label}`;
      button.title=`Tab: Everything → Markers and reticle → No HUD`;
    }
    return mode.id;
  }
  const cycle=()=>set((index+1)%HUD_MODES.length);
  body.ownerDocument.addEventListener('keydown',event=>{
    if(event.code!=='Tab'||event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||!canChange())return;
    if(event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'))return;
    event.preventDefault();cycle();
  });

  // Reduced modes hide touch controls too. A two-finger tap restores Everything
  // without leaving a permanent screen overlay in the No HUD view.
  let tap=null;
  canvas.addEventListener('touchstart',event=>{
    if(index===0||!canChange()||event.touches.length!==2){tap=null;return;}
    tap={at:event.timeStamp,points:[...event.touches].map(t=>({id:t.identifier,x:t.clientX,y:t.clientY}))};
    event.preventDefault();
  },{passive:false});
  canvas.addEventListener('touchmove',event=>{
    if(tap&&[...event.touches].some(t=>{
      const start=tap.points.find(p=>p.id===t.identifier);
      return !start||Math.hypot(t.clientX-start.x,t.clientY-start.y)>12;
    }))tap=null;
  },{passive:true});
  canvas.addEventListener('touchend',event=>{
    if(!tap)return;
    if(event.touches.length===0){
      if(event.timeStamp-tap.at<400&&canChange())set(0);
      tap=null;
    }
  });
  canvas.addEventListener('touchcancel',()=>{tap=null;});
  set(0);
  return {cycle,get mode(){return HUD_MODES[index].id;},bind(button){buttons.add(button);button.addEventListener('click',cycle);set(index);}};
}
