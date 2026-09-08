import {PIECES} from './definitions.js';
import {BUILD_WHEEL_ORDER,radialSelection} from './radial-selection.js';

const LABELS={foundation:'Foundation',wall:'Wall',doorway:'Doorway',window:'Window',floor:'Floor / roof',stairs:'Stairs',crate:'Storage',mainframe:'Mainframe'};
// Original line icons, using the same construction silhouettes as the kit.
const ICONS={foundation:'M3 14 12 9 21 14 12 19Z M3 14v4l9 5 9-5v-4 M12 19v4',floor:'M3 11 12 6 21 11 12 16Z M3 11v2l9 5 9-5v-2',wall:'M4 21V3h16v18Z M4 9h16 M4 15h16 M12 3v6 M9 9v6 M15 15v6',doorway:'M4 21V3h16v18 M9 21V8h6v13 M4 21h5 M15 21h5',window:'M4 21V3h16v18Z M8 8h8v8H8Z',stairs:'M3 21h18 M3 21v-5h6v-5h6V6h6v15 M3 11 19 2',crate:'M3 7h18v14H3Z M2 3h20v4H2Z M9 10h6v3H9Z M6 17h12',mainframe:'M6 2h12v20H6Z M8 5h8v7H8Z M8 16h8 M8 19h8'};
Object.assign(ICONS,{
 'foundation-strut':'M2 5h20v4H2Z M4 9l14 14h4L8 9 M18 9v14',
 'ceiling-light':'M3 3h18v3H3Z M6 6v3h12V6 M12 13v8 M5 12 2 17 M19 12l3 5',
 'roof-flat':'M2 8h20v6H2Z M4 14v8 M20 14v8',
 'roof-edge':'M2 8h12q8 0 8 8H2Z M4 16v6 M20 16v6',
 'roof-corner':'M2 14q0-8 8-8h5q7 0 7 8H2Z M4 14v8 M20 14v8',
 'roof-triangle':'M12 3 23 19H1Z M12 8 18 17H6Z',
 'roof-quarter':'M2 22V2q20 0 20 20Z M6 18V7q11 2 11 11Z',
 'solar-array':'M3 6h18v12H3Z M3 10h18 M3 14h18 M9 6v12 M15 6v12 M6 18v4 M18 18v4',
 'wind-turbine':'M12 8v16 M12 8 7 2H5v3l7 3 M12 8l8-2 2 2-2 2-8-2 M12 8l-3 8H6v-3Z',
 battery:'M4 5h16v18H4Z M9 2h6v3 M13 8 9 14h5l-3 6',
 'uranium-generator':'M4 3h16v20H4Z M8 8h8v8H8Z M12 8v8 M8 12h8',
 'helium-generator':'M2 5h20v18H2Z M6 10h4v8H6Z M14 10h4v8h-4Z',
 'foundation-triangle':'M3 18 12 3 21 18Z M3 18v4h18v-4', 'floor-triangle':'M3 19 12 3 21 19Z M3 19v2h18v-2',
 'foundation-quarter':'M3 21V3A18 18 0 0 1 21 21Z M3 21v3h18v-3', 'floor-quarter':'M3 21V3A18 18 0 0 1 21 21Z',
 'wall-quarter':'M3 21V5Q12 0 21 5V21Q12 16 3 21 M3 12Q12 7 21 12', 'window-quarter':'M3 21V5Q12 0 21 5V21Q12 16 3 21 M6 9Q12 6 18 9V16Q12 13 6 16Z',
 'foundation-ramp':'M3 21 21 8v13Z M3 21h18',rack:'M3 2h18v22H3Z M3 8h18 M3 14h18 M3 20h18 M12 2v18',terminal:'M3 3h18v14H3Z M6 6h12v8H6Z M6 17v4h12v-4 M3 23h18',
 'hangar-door':'M2 23V3h20v20h-3V7H5v16Z M5 10h14',
});
const ns='http://www.w3.org/2000/svg';
const polar=(r,a)=>[300+r*Math.sin(a),300-r*Math.cos(a)];
function segment(i){const a=i*Math.PI/4-Math.PI/8+.018,b=(i+1)*Math.PI/4-Math.PI/8-.018,p=polar(291,a),q=polar(291,b),r=polar(151,b),s=polar(151,a);return `M${p} A291 291 0 0 1 ${q} L${r} A151 151 0 0 0 ${s} Z`;}
export function createBuildRadial({selected='mainframe',onChoose,formatCost,order=BUILD_WHEEL_ORDER}){
  const root=document.createElement('div');root.className='build-wheel';root.setAttribute('role','group');root.setAttribute('aria-label','Building pieces · point the left stick, then press A');
  const art=document.createElementNS(ns,'svg');art.setAttribute('viewBox','0 0 600 600');art.setAttribute('aria-hidden','true');art.classList.add('build-wheel-art');root.append(art);
  const centre=document.createElement('div');centre.className='build-wheel-centre';centre.innerHTML='<span class="build-eyebrow">SELECT PIECE</span><strong></strong><p></p><small>A / Enter · Choose</small>';root.append(centre);
  const paths=[],buttons=[];let index=order.indexOf(selected);if(index<0)index=0;
  function highlight(next){index=next;root.dataset.selected=order[index];paths.forEach((path,i)=>path.classList.toggle('selected',i===index));buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));const piece=PIECES[order[index]];centre.querySelector('strong').textContent=piece.label;centre.querySelector('p').textContent=formatCost(piece.cost);}
  for(const [i,id]of order.entries()){
    const path=document.createElementNS(ns,'path');path.setAttribute('d',segment(i));art.append(path);paths.push(path);
    const b=document.createElement('button');b.type='button';b.className='build-wheel-piece';b.dataset.controllerKey=`build-piece-${id}`;b.setAttribute('aria-label',`${PIECES[id].label} · ${formatCost(PIECES[id].cost)}`);
    if(i===index)b.dataset.controllerFocus='';
    const a=i*Math.PI/4;b.style.left=`${50+36.8*Math.sin(a)}%`;b.style.top=`${50-36.8*Math.cos(a)}%`;
    const icon=document.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 24 26');icon.setAttribute('aria-hidden','true');const line=document.createElementNS(ns,'path');line.setAttribute('d',ICONS[id]??ICONS[PIECES[id].category==='wall'?'wall':PIECES[id].category==='utility'?'crate':'floor']);icon.append(line);
    const label=document.createElement('span');label.textContent=LABELS[id]??PIECES[id].label.replace('foundation','base').replace('Quarter-circle','Curved').replace(' · Nomad',' S').replace(' · Atlas',' M');b.append(icon,label);b.addEventListener('focus',()=>highlight(i));b.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')b.focus({preventScroll:true});});b.addEventListener('click',()=>onChoose(id));root.append(b);buttons.push(b);
  }
  highlight(index);
  return {element:root,navigate(ui){const next=radialSelection(ui.stickX,ui.stickY,index);return next===null?null:buttons[next];}};
}
