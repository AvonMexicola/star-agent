/** Startup only: prepare the current view, then hand control to the player.
 * Progress counts completed tasks, never elapsed time or guessed download bytes. */
export function blockStartupInput(target,isReady) {
  const held=new Set();
  const release=()=>{if(isReady()&&!held.size){target.removeEventListener('keydown',block,true);target.removeEventListener('keyup',up,true);target.defaultView?.removeEventListener('blur',clear);}};
  const block=event=>{
    if(!isReady()||held.has(event.code)){
      held.add(event.code);event.stopImmediatePropagation();
      if(['Space','Tab','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
    }
  };
  const up=event=>{held.delete(event.code);release();};
  const clear=()=>{held.clear();release();};
  target.addEventListener('keydown',block,true);target.addEventListener('keyup',up,true);
  target.defaultView?.addEventListener('blur',clear);
  return release;
}

export class StartupPreload {
  constructor(tasks, compile) {
    this.tasks=tasks.map(({label,promise})=>({label,done:false,error:null,promise}));
    this.compile=compile;this.phase='assets';this.ready=false;this.stableFrames=0;
    this.warmSeconds=0;this.warmFrames=0;this.error=null;
    for(const task of this.tasks)Promise.resolve(task.promise).then(()=>{task.done=true;},error=>{
      // Asset owners retain their existing procedural/orbital fallback paths.
      task.error=String(error);task.done=true;
    });
  }
  update({terrainReady,settled,dt,resizing=false}) {
    if(this.ready||this.error)return;
    if(this.phase==='assets'){
      if(!this.tasks.every(task=>task.done))return;
      this.phase='terrain';
    }
    if(this.phase==='terrain'){
      this.stableFrames=terrainReady&&settled?this.stableFrames+1:0;
      if(this.stableFrames<3)return;
      this.phase='shaders';
      Promise.resolve().then(()=>this.compile()).then(()=>{this.phase='warmup';},error=>{this.error=String(error);});
      return;
    }
    if(this.phase==='warmup'){
      this.warmSeconds+=Math.max(0,Math.min(dt,.25));this.warmFrames++;
      if(this.warmSeconds>=2&&this.warmFrames>=12&&settled&&!resizing){this.phase='ready';this.ready=true;}
    }
  }
  get state(){
    const done=this.tasks.filter(task=>task.done).length;
    const extra={assets:0,terrain:0,shaders:1,warmup:2,ready:3}[this.phase];
    const label=this.error?'Graphics preparation failed':this.phase==='assets'?this.tasks.find(task=>!task.done)?.label:
      {terrain:'Preparing the opening area',shaders:'Preparing ship and station graphics',warmup:'Checking the first view',ready:'Ready to explore'}[this.phase];
    return {phase:this.phase,ready:this.ready,label,completed:done+extra,total:this.tasks.length+3,error:this.error,
      fallbackTasks:this.tasks.filter(task=>task.error).map(task=>task.label)};
  }
}
