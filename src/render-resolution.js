const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// F11 does not set fullscreenElement. Require the content and browser window
// to fill the screen, so an ordinary maximized window with chrome is excluded.
export function fullscreenViewport({element=false,width,height,outerWidth,outerHeight,screenWidth,screenHeight}) {
  return Boolean(element)||[width,height,outerWidth,outerHeight,screenWidth,screenHeight].every(v=>Number.isFinite(v)&&v>0)
    && Math.abs(width-screenWidth)<=2&&Math.abs(height-screenHeight)<=2
    && Math.abs(outerWidth-width)<=2&&Math.abs(outerHeight-height)<=2;
}

export class RenderResolution {
  constructor(){this.scale=1;this.automatic=true;this.fullscreen=false;this.pixelRatio=1;this.width=1;this.height=1;this.cooldown=0;this.recovery=0;this.qualityArea=1;this.resetMeasurements();}
  configure(preference){
    this.automatic=preference==='auto';
    this.scale=this.automatic?1:clamp(Number(preference)||1,.4,1);
    this.cooldown=3;this.recovery=0;this.qualityArea=this.width*this.height;this.resetMeasurements();
  }
  setScale(scale){this.configure(scale);}
  viewport({width,height,dpr=1,fullscreen=false}){
    const area=width*height;this.qualityArea=Math.min(this.qualityArea,area);
    const grew=area>this.qualityArea*1.2;
    const changedMode=fullscreen!==this.fullscreen;
    const ratio=clamp(dpr,1,fullscreen?2:1.25),changedDensity=ratio!==this.pixelRatio;
    this.width=Math.max(1,width);this.height=Math.max(1,height);this.fullscreen=fullscreen;this.pixelRatio=ratio;
    if(changedMode||grew||changedDensity){if(this.automatic)this.scale=1;this.qualityArea=area;}
    // Let new buffers/terrain settle before judging steady-state frame rate.
    this.cooldown=3;this.recovery=0;this.resetMeasurements();
  }
  resetMeasurements(){this.measuring=false;this.measuredFrames=0;this.measuredSeconds=0;this.recovery=0;}
  frame(dt,active){
    // Only complete uninterrupted gameplay intervals may change quality. A
    // menu's cheap RAFs or a preload stall cannot contaminate this sample.
    if(Boolean(active)!==this.measuring){this.resetMeasurements();this.measuring=Boolean(active);return false;}
    if(!active||!Number.isFinite(dt)||dt<=0)return false;
    this.measuredFrames++;this.measuredSeconds+=dt;
    if(this.measuredSeconds<2)return false;
    const fps=this.measuredFrames/this.measuredSeconds;this.measuredFrames=0;this.measuredSeconds=0;
    return this.sample(fps);
  }
  sample(fps,active=true){
    if(!this.automatic||!active||!Number.isFinite(fps)){this.recovery=0;return false;}
    if(this.cooldown>0){this.cooldown--;return false;}
    const before=this.scale,minimum=this.fullscreen?.8:.55;
    if(fps<23){this.scale=Math.max(minimum,this.scale*.85);this.recovery=0;}
    else if(fps>=50){if(++this.recovery>=3){this.scale=Math.min(1,this.scale+.1);this.recovery=0;}}
    else this.recovery=0;
    if(this.scale!==before){this.cooldown=2;return true;}
    return false;
  }
  get state(){return {automatic:this.automatic,fullscreen:this.fullscreen,scale:this.scale,pixelRatio:this.pixelRatio,
    width:Math.floor(Math.floor(this.width*this.scale)*this.pixelRatio),height:Math.floor(Math.floor(this.height*this.scale)*this.pixelRatio)};}
}
