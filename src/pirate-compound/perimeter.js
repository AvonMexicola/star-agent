import {PERIMETER as P} from './catalog.js';
/** Anti-ship policy only. No catch-up volleys after stalls or modal pauses. */
export class PiratePerimeter {
  constructor({onShot=()=>{},onWarning=()=>{}}={}){this.onShot=onShot;this.onWarning=onWarning;this.phase='idle';this.timer=0;this.shots=0;this.burst=0;this.disabled=false;this.aligned=false;this.distance=Infinity;}
  isolate(){this.disabled=true;this.phase='disabled';this.timer=0;this.burst=0;}
  update(dt,{distance,altitude,ship=false,active=true,clear=true,aligned=true}={}){
    this.distance=distance;this.aligned=aligned;
    if(this.disabled){this.phase='disabled';return;}
    if(!active){this.phase='idle';this.timer=0;this.burst=0;return;}
    if(!ship||altitude<P.minAltitude||distance>P.disengage&&this.phase!=='idle'&&this.phase!=='warning'||distance>P.warning){this.phase='idle';this.timer=0;this.burst=0;return;}
    dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    if(this.phase==='idle'){if(distance<=P.warning){this.phase='warning';this.timer=P.warningSeconds;this.onWarning();}return;}
    if(this.phase==='warning'){
      this.timer=Math.max(0,this.timer-dt);
      if(distance<P.engage&&this.timer===0&&clear&&aligned){this.phase='charge';this.timer=P.telegraphSeconds;this.burst=0;}
      return;
    }
    if(!clear||!aligned){this.phase='charge';this.timer=P.telegraphSeconds;return;}
    this.timer=Math.max(0,this.timer-dt);if(this.timer>0)return;
    if(this.phase==='rest'){this.phase='charge';this.timer=P.telegraphSeconds;this.burst=0;return;}
    if(this.phase==='charge'||this.phase==='burst'){
      this.onShot({damage:P.damage,barrel:this.shots%2});this.shots++;this.burst++;
      this.phase=this.burst>=P.burstShots?'rest':'burst';this.timer=this.phase==='rest'?P.restSeconds:P.shotInterval;
    }
  }
  get state(){return {phase:this.phase,timer:this.timer,shots:this.shots,burst:this.burst,disabled:this.disabled,distance:this.distance,aligned:this.aligned,damage:P.damage,burstDamage:P.damage*P.burstShots};}
}
