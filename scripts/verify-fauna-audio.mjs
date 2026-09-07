// Run against the fauna owner's checkout without copying its unfinished runtime:
// node scripts/verify-fauna-audio.mjs /path/to/fauna-worktree
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Vector3,Quaternion} from 'three';
const root=resolve(process.argv[2]??'.');
const {createHostileSimulation}=await import(pathToFileURL(resolve(root,'src/fauna/hostile-simulation.js')));
const {GameplayAudio}=await import(pathToFileURL(resolve(root,'src/audio/gameplay.js')));
const param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
const node=()=>({gain:param(),pan:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){}});
const context={currentTime:0,state:'running',sampleRate:24000,createGain:node,createStereoPanner:node,createBufferSource:node,
  createBuffer:(_channels,length)=>({copyToChannel(pcm){assert.equal(pcm.length,length);assert.ok(pcm.every(Number.isFinite));}})};
for(const [species,sound] of [['pyrebear','pyrebear-attack'],['suloher','sulphurhound-attack']]){
  const audio=new GameplayAudio(context,{});audio.setEnabled(true);
  const nav={position:new Vector3(41,1.75,0),orientation:new Quaternion(),focused:true,enabled:true,mode:'walk'};
  const events=[],sim=createHostileSimulation({sampleGround:(_species,p)=>({position:[p[0],0,p[2]],normal:[0,1,0]}),
    onAttack:event=>{events.push(event);audio.event({...event,point:new Vector3(...event.position)},nav);}});
  sim.reconcile([{id:'test-creature',position:[40,0,0],normal:[0,1,0]}],species,[0,1.75,0]);
  const player={position:nav.position.toArray(),active:true,health:100};
  sim.update(.05,player);assert.equal(sim.entities[0].state,'windup');
  assert.equal(events.length,1);assert.equal(audio.state.attacks,1);assert.equal(audio.state.last,sound);assert.equal(sim.state.totalBites,0);
  for(let i=0;i<8;i++)sim.update(.05,player);
  assert.equal(events.length,1,'windup frames do not repeat the sound');
  audio.suspend();sim.update(0,player);assert.equal(audio.state.voices,0);assert.equal(events.length,1);
  for(let i=0;i<60;i++)sim.update(.05,player);
  assert.equal(events.length,2,'next attack emits one fresh sound');
  sim.hit('test-creature',1000);for(let i=0;i<80;i++)sim.update(.05,player);
  assert.equal(events.length,2,'dead creatures emit no attacks');audio.dispose();
  console.log(`${species}: windup → ${sound}, no frame repeats, pause and death gates pass`);
}
