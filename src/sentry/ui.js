import '../rover.css';
import './ui.css';
export function createSentryUI(api){
  const panel=document.createElement('aside');panel.id='sentry-panel';panel.hidden=true;
  panel.innerHTML='<div class="sentry-brand">MERIDIAN SHIPWORKS · S-04</div><strong>BURROW SENTRY</strong><p class="sentry-state" role="status"></p><meter aria-label="Laser charge" min="0" max="1" value="1"></meter><p class="sentry-hints">LS / WASD drive · LT / X brake<br>RS / arrows aim · RT / T fire · X / F exit<br>View / I backpack · 4 / camera chord chase view</p><div class="sentry-actions"><button data-action="deploy">Deploy Sentry nearby</button><button data-action="entry">Board Sentry</button><button data-action="pack">View / I · Backpack</button></div><div class="sentry-touch"><button data-hold="forward" aria-label="Drive Sentry forward">▲</button><button data-hold="left" aria-label="Steer Sentry left">◀</button><button data-hold="brake" aria-label="Brake Sentry">■</button><button data-hold="right" aria-label="Steer Sentry right">▶</button><button data-hold="reverse" aria-label="Reverse Sentry">▼</button><button data-hold="up" aria-label="Aim turret up">↑</button><button data-hold="aimLeft" aria-label="Aim turret left">←</button><button data-hold="aimRight" aria-label="Aim turret right">→</button><button data-hold="down" aria-label="Aim turret down">↓</button><button data-hold="fire">HOLD LASERS</button></div>';
  document.body.append(panel);
  const action=(name,fn)=>panel.querySelector(`[data-action="${name}"]`).onclick=fn;
  action('deploy',()=>api.deploy());action('entry',()=>api.interact());action('pack',()=>api.openCargo());
  for(const b of panel.querySelectorAll('[data-hold]')){
    b.addEventListener('pointerdown',e=>{if(!api.acceptInput)return;e.preventDefault();b.setPointerCapture(e.pointerId);api.touch.add(b.dataset.hold);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>api.touch.delete(b.dataset.hold));
  }
  return {update(){
    const state=api.state;panel.hidden=!state.visible;if(panel.hidden)return;
    panel.querySelector('.sentry-state').textContent=state.message;
    panel.querySelector('meter').value=state.current?.charge??1;
    panel.querySelector('[data-action="deploy"]').hidden=!state.canDeploy;
    panel.querySelector('[data-action="entry"]').hidden=!state.near&&!state.occupied;
    panel.querySelector('[data-action="entry"]').textContent=state.occupied?'X / F · Leave '+state.role:'X / F · Board '+(state.near?.role??'Sentry');
    panel.querySelector('[data-action="entry"]').disabled=state.busy;
    panel.querySelector('.sentry-touch').hidden=!state.occupied||state.busy;
    panel.querySelector('.sentry-hints').hidden=!state.occupied;
    panel.querySelector('[data-action="pack"]').hidden=!state.occupied;
  },dispose(){panel.remove();}};
}
