import {PIECES} from './definitions.js';
import {BUILD_WHEEL_ORDER,radialSelection} from './radial-selection.js';

const LABELS={foundation:'Foundation',wall:'Wall',doorway:'Doorway',window:'Window',floor:'Floor / roof',stairs:'Stairs',crate:'Storage',mainframe:'Mainframe'};
// Original line icons, using the same construction silhouettes as the kit.
const ICONS={foundation:'M3 14 12 9 21 14 12 19Z M3 14v4l9 5 9-5v-4 M12 19v4',floor:'M3 11 12 6 21 11 12 16Z M3 11v2l9 5 9-5v-2',wall:'M4 21V3h16v18Z M4 9h16 M4 15h16 M12 3v6 M9 9v6 M15 15v6',doorway:'M4 21V3h16v18 M9 21V8h6v13 M4 21h5 M15 21h5',window:'M4 21V3h16v18Z M8 8h8v8H8Z',stairs:'M3 21h18 M3 21v-5h6v-5h6V6h6v15 M3 11 19 2',crate:'M3 7h18v14H3Z M2 3h20v4H2Z M9 10h6v3H9Z M6 17h12',mainframe:'M6 2h12v20H6Z M8 5h8v7H8Z M8 16h8 M8 19h8'};
const ns='http://www.w3.org/2000/svg';
const polar=(r,a)=>[300+r*Math.sin(a),300-r*Math.cos(a)];
function segment(i){const a=i*Math.PI/4-Math.PI/8+.018,b=(i+1)*Math.PI/4-Math.PI/8-.018,p=polar(291,a),q=polar(291,b),r=polar(151,b),s=polar(151,a);return `M${p} A291 291 0 0 1 ${q} L${r} A151 151 0 0 0 ${s} Z`;}
export function createBuildRadial({selected='mainframe',onChoose,formatCost}){
  const root=document.createElement('div');root.className='build-wheel';root.setAttribute('role','group');root.setAttribute('aria-label','Building pieces · point the left stick, then press A');
  const art=document.createElementNS(ns,'svg');art.setAttribute('viewBox','0 0 600 600');art.setAttribute('aria-hidden','true');art.classList.add('build-wheel-art');root.append(art);
  const centre=document.createElement('div');centre.className='build-wheel-centre';centre.innerHTML='<span class="build-eyebrow">SELECT PIECE</span><strong></strong><p></p><small>A / Enter · Choose</small>';root.append(centre);
  const paths=[],buttons=[];let index=BUILD_WHEEL_ORDER.indexOf(selected);if(index<0)index=0;
  function highlight(next){index=next;root.dataset.selected=BUILD_WHEEL_ORDER[index];paths.forEach((path,i)=>path.classList.toggle('selected',i===index));buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));const piece=PIECES[BUILD_WHEEL_ORDER[index]];centre.querySelector('strong').textContent=piece.label;centre.querySelector('p').textContent=formatCost(piece.cost);}
  for(const [i,id]of BUILD_WHEEL_ORDER.entries()){
    const path=document.createElementNS(ns,'path');path.setAttribute('d',segment(i));art.append(path);paths.push(path);
    const b=document.createElement('button');b.type='button';b.className='build-wheel-piece';b.dataset.controllerKey=`build-piece-${id}`;b.setAttribute('aria-label',`${PIECES[id].label} · ${formatCost(PIECES[id].cost)}`);
    if(i===index)b.dataset.controllerFocus='';
    const a=i*Math.PI/4;b.style.left=`${50+36.8*Math.sin(a)}%`;b.style.top=`${50-36.8*Math.cos(a)}%`;
    const icon=document.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 24 26');icon.setAttribute('aria-hidden','true');const line=document.createElementNS(ns,'path');line.setAttribute('d',ICONS[id]);icon.append(line);
    const label=document.createElement('span');label.textContent=LABELS[id];b.append(icon,label);b.addEventListener('focus',()=>highlight(i));b.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')b.focus({preventScroll:true});});b.addEventListener('click',()=>onChoose(id));root.append(b);buttons.push(b);
  }
  highlight(index);
  return {element:root,navigate(ui){const next=radialSelection(ui.stickX,ui.stickY,index);return next===null?null:buttons[next];}};
}
