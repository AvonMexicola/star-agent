import './rover.css';
import {secondaryTouchButtons} from './secondary-touch-buttons.js';
export function createRoverUI(rover){
  const panel=document.createElement('aside');panel.id='rover-panel';panel.hidden=true;
  panel.innerHTML='<div class="rover-brand">MERIDIAN SHIPWORKS <span>M-04</span></div><strong>BURROW</strong><p class="rover-state" role="status"></p><div class="rover-telemetry"><label>CUTTER CHARGE <meter min="0" max="1" value="1"></meter></label><span class="rover-ore"></span></div><p class="rover-bindings">LS / WASD · Drive & steer<br>RS / arrows · Aim · RT / T · Twin cutters<br>LT / X · Brake · X / F · Exit</p><div class="rover-actions"><button data-rover-action="entry">Board cabin</button><button data-rover-action="lift">Y / G · Atlas lift</button><button data-rover-action="cargo">View / I · Ore bins</button></div><div class="rover-touch"><div class="rover-drive"><button data-rover-hold="forward" aria-label="Drive forward">▲</button><button data-rover-hold="left" aria-label="Steer left">◀</button><button data-rover-hold="brake" aria-label="Brake rover">■</button><button data-rover-hold="right" aria-label="Steer right">▶</button><button data-rover-hold="reverse" aria-label="Reverse rover">▼</button></div><div class="rover-aim"><button data-rover-hold="up" aria-label="Aim cutters up">↑</button><button data-rover-hold="aimLeft" aria-label="Aim cutters left">←</button><button data-rover-hold="aimRight" aria-label="Aim cutters right">→</button><button data-rover-hold="down" aria-label="Aim cutters down">↓</button></div><button class="rover-mine" data-rover-hold="mine">HOLD<br>TWIN CUTTERS</button></div>';
  document.body.append(panel);
  secondaryTouchButtons(panel, '[data-rover-action]');
  for(const button of panel.querySelectorAll('[data-rover-hold]')){
    const key=button.dataset.roverHold;
    button.addEventListener('pointerdown',e=>{if(!rover.acceptInput)return;e.preventDefault();button.setPointerCapture(e.pointerId);rover.touch.add(key);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>rover.touch.delete(key));
  }
  panel.querySelector('[data-rover-action="entry"]').onclick=()=>rover.interact();
  panel.querySelector('[data-rover-action="lift"]').onclick=()=>rover.toggleLift();
  panel.querySelector('[data-rover-action="cargo"]').onclick=()=>rover.openCargo();
  return {panel,update(){const s=rover.state;panel.hidden=!s.spawned||(!s.occupied&&!s.near&&!s.busy);if(panel.hidden)return;
    panel.classList.toggle('rover-seated',s.occupied);panel.querySelector('.rover-state').textContent=s.error||s.message;
    panel.querySelector('meter').value=s.charge;panel.querySelector('.rover-ore').textContent=`${s.mass.toFixed(2)} / 96 kg · ${Math.abs(s.speed).toFixed(1)} m/s`;
    panel.querySelector('.rover-telemetry').hidden=!s.occupied;panel.querySelector('.rover-bindings').hidden=!s.occupied;panel.querySelector('.rover-touch').hidden=!s.occupied;
    const entry=panel.querySelector('[data-rover-action="entry"]');entry.textContent=s.busy?(s.phase.endsWith('-in')?'Cancel entry':'Cabin access moving…'):s.occupied?'X / F · Leave cabin':'X / F · Board cabin';entry.disabled=s.busy&&!s.phase.endsWith('-in')||Math.abs(s.speed)>.2;
    const carrier=panel.querySelector('[data-rover-action="lift"]');carrier.hidden=!s.occupied||!s.aboard;carrier.textContent='Y / G · '+s.carrierControl;
    panel.querySelector('[data-rover-action="cargo"]').hidden=!s.occupied&&!s.near;
  }};
}
