import './graphics-settings.css';
export const GRAPHICS_KEY='star-agent.graphics.v1';
export const GRASS_DISTANCES=[40,80,160];
export const GRASS_DENSITIES=[.5,.75,1];
export function sanitizeGraphics(value={}) {
  return {grassDistance:GRASS_DISTANCES.includes(value?.grassDistance)?value.grassDistance:80,
    grassDensity:GRASS_DENSITIES.includes(value?.grassDensity)?value.grassDensity:.75,
    resolution:['auto',.6,.8,1].includes(value?.resolution)?value.resolution:'auto'};
}
export function createGraphicsSettings({nav,onChange,storage}) {
  let current;try{current=sanitizeGraphics(JSON.parse(storage?.getItem(GRAPHICS_KEY)??'{}'));}catch{current=sanitizeGraphics();}
  const dialog=document.createElement('dialog');dialog.id='graphics-settings';
  dialog.setAttribute('aria-labelledby','graphics-title');
  dialog.innerHTML='<div class="graphics-top"><h2 id="graphics-title">Graphics</h2><button type="button" data-controller-close aria-label="Close graphics">×</button></div><p>Adjust the view for your computer. Changes apply immediately.</p><div class="graphics-options"></div><p class="graphics-note">Detailed grass bends near your feet. Distant grass uses simpler clusters and fades into the terrain. Longer views and higher density use more GPU time.</p><p class="graphics-save" role="status"></p>';
  document.body.append(dialog);
  function apply(){let saved=true;try{storage?.setItem(GRAPHICS_KEY,JSON.stringify(current));saved=Boolean(storage);}catch{saved=false;}onChange({...current});render();dialog.querySelector('.graphics-save').textContent=saved?'Settings saved on this device.':'Settings apply for this session; browser storage is unavailable.';}
  function option(key,label,values,format){
    const button=document.createElement('button');button.type='button';button.dataset.controllerKey=key;
    button.addEventListener('click',()=>{current[key]=values[(values.indexOf(current[key])+1)%values.length];apply();});
    button._label=()=>`${label}: ${format(current[key])} · Change`;dialog.querySelector('.graphics-options').append(button);
  }
  option('grassDistance','Grass distance',GRASS_DISTANCES,v=>`${v} m`);
  option('grassDensity','Grass density',GRASS_DENSITIES,v=>`${Math.round(v*100)}%`);
  option('resolution','Render resolution',['auto',.6,.8,1],v=>v==='auto'?'Automatic':`${Math.round(v*100)}%`);
  const first=dialog.querySelector('.graphics-options button');first.dataset.controllerFocus='';
  function render(){for(const button of dialog.querySelectorAll('.graphics-options button'))button.textContent=button._label();}
  dialog.querySelector('[data-controller-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{nav.keys.clear();nav.enabled=true;nav.gamepad.suspend();});
  render();onChange({...current});
  return {get state(){return {...current};},open(){if(!nav.enabled||nav.openingActive||document.querySelector('dialog[open]'))return;nav.keys.clear();nav.toolTrigger=0;nav.enabled=false;nav.gamepad.suspend();if(document.pointerLockElement)document.exitPointerLock();dialog.showModal();first.focus();}};
}
