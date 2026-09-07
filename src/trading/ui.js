import { TRADE_RESOURCES,resourceById } from './model.js';
import { SBU_SIZES,capacitySBU,usedSBU } from '../cargo/grid.js';
import { POST_COST } from './sites.js';
import './trading.css';
/** Fixed views, three rows per page; all choices have controller buttons. */
export function createTradingUI(api,nav){
  const dialog=document.createElement('dialog');dialog.id='trading-dialog';dialog.setAttribute('aria-labelledby','trading-title');
  dialog.innerHTML=`<header><div><h2 id="trading-title">Cargo & trade</h2><p class="trade-place"></p></div><button data-close aria-label="Close cargo and trade">✕</button></header><nav class="trade-tabs" aria-label="Cargo views"></nav><div class="trade-summary"></div><div class="trade-selection"></div><main class="trade-content"></main><footer><p class="trade-feedback" role="status"></p><div class="trade-pages"></div><small>D-pad / stick: choose · A: confirm · B: close · Only 1 SBU can be carried</small></footer>`;
  document.body.append(dialog);let view='buy',page=0,size=1,shipId='',terminal='',busy=false,message='',source='pack';
  const $=s=>dialog.querySelector(s);
  const button=(label,key,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.dataset.controllerKey=key;b.disabled=disabled;b.onclick=fn;return b;};
  const select=(list,current,fn,prefix)=>{const wrap=document.createElement('div');wrap.className='trade-choices';for(const o of list){const b=button(o.label,`${prefix}-${o.id}`,()=>{fn(o.id);render();},o.disabled);b.setAttribute('aria-pressed',String(o.id===current));wrap.append(b);}return wrap;};
  async function run(fields){if(busy)return;const focusKey=document.activeElement?.dataset?.controllerKey;busy=true;message='Saving transaction…';render();try{const result=await api.command({...fields,ship:shipId,terminal,source});message=result.message??'Transaction saved.';}catch(e){message=e.message;}finally{busy=false;render();if(focusKey)dialog.querySelector(`[data-controller-key="${CSS.escape(focusKey)}"]:not(:disabled)`)?.focus({preventScroll:true});}}
  async function tractor(){if(busy)return;busy=true;try{await api.tractor.equip();dialog.close();}catch(e){message=e.message;}finally{busy=false;if(dialog.open)render();}}
  function render(){
    const focused=document.activeElement?.dataset?.controllerKey,s=api.snapshot(),ships=s.ships;
    if(!ships.some(h=>h.id===shipId))shipId=ships.find(h=>h.hull===nav.shipId&&h.owner===s.owner)?.id??ships[0]?.id??'';
    const ship=ships.find(h=>h.id===shipId),t=s.terminals.find(t=>t.id===terminal),own=t?.owner===s.owner,near=api.atTerminal(terminal),dock=ship&&api.docked(ship,terminal);
    $('.trade-place').textContent=terminal?terminal.startsWith('station:')?'Aeon Orbital · Freight exchange':t?.name??'Trading pad':'Approach a trade terminal to buy or sell';
    $('.trade-summary').textContent=`${s.account?.credits??0} CR available · ${ship?.hull??'No ship'} ${usedSBU(ship?.crates??[])} / ${capacitySBU(ship?.hull)} SBU${s.account?.carried?' · Hands: 1 SBU '+s.account.carried.resource:''}`;
    const tabs=$('.trade-tabs');tabs.replaceChildren();for(const [id,label] of [['buy','Buy'],['cargo','Cargo'],['pack','Pack ore'],['stock','My shop'],['build','Build']]){const b=button(label,`view-${id}`,()=>{view=id;page=0;message='';render();});b.setAttribute('aria-pressed',String(view===id));tabs.append(b);}
    const selection=$('.trade-selection');selection.replaceChildren();
    if(view!=='build'){
      const chosen=ship?`${ship.hull}${ship.owner!==s.owner?' · Other pilot':''}`:'No ship';
      selection.append(button(`Ship: ${chosen} · change`,'choose-ship',()=>{shipId=ships[(ships.findIndex(h=>h.id===shipId)+1)%ships.length]?.id??'';page=0;render();},ships.length<2));
      if(s.online&&ship?.owner===s.owner&&ship.hull!==nav.shipId&&nav.dockedAtStation)selection.append(button('Call this ship to berth','call-cargo-ship',async()=>{try{await api.callShip(ship.hull);message='Ship called to berth.';}catch(e){message=e.message;}render();},busy));
      if(view==='buy'||view==='pack'||view==='stock')selection.append(select(SBU_SIZES.map(n=>({id:n,label:`${n}`})),size,n=>{size=n;},'size'));
    }
    const content=$('.trade-content');content.replaceChildren();let totalPages=1;
    if(view==='buy'||view==='pack'){
      totalPages=Math.ceil(TRADE_RESOURCES.length/3);page=Math.min(page,totalPages-1);
      if(view==='pack'){const sources=api.sources();selection.append(button(`Source: ${sources.find(x=>x.id===source)?.name??source} · change`,'choose-source',()=>{source=sources[(sources.findIndex(x=>x.id===source)+1)%sources.length]?.id??'pack';render();},sources.length<2));}
      for(const res of TRADE_RESOURCES.slice(page*3,page*3+3)){
        const row=document.createElement('article'),text=document.createElement('div'),title=document.createElement('h3');title.textContent=res.name;text.append(title);
        const note=document.createElement('p');note.textContent=view==='pack'?`${api.loose(source,res.id).toFixed(1)} kg loose · ${res.kgPerSBU*size} kg to pack`:`${t?.prices[res.id]??res.buy} CR / SBU${t?' · '+(t.stock[res.id]??0)+' SBU in stock':''}`;text.append(note);
        row.append(text,button(view==='pack'?`Pack ${size} SBU`:`Buy ${size} · ${(t?.prices[res.id]??res.buy)*size} CR`,`purchase-${res.id}`,()=>run({op:view==='pack'?'pack':'buy',resource:res.id,sbu:size}),busy||!near||!dock||(own&&view==='buy')));content.append(row);
      }
      if(!near||!dock){const p=document.createElement('p');p.className='trade-reason';p.textContent=!near?'Walk to the terminal to trade.':'Land the selected ship at this terminal’s pad first.';content.append(p);}
    }else if(view==='cargo'){
      selection.append(button('Equip tractor beam','equip-tractor',tractor,busy||!['walk','eva'].includes(nav.mode)||Boolean(s.account?.carried)));
      const crates=ship?.crates??[];totalPages=Math.max(1,Math.ceil(crates.length/3));page=Math.min(page,totalPages-1);
      for(const c of crates.slice(page*3,page*3+3)){
        const row=document.createElement('article'),text=document.createElement('div'),title=document.createElement('h3');title.textContent=`${c.sbu} SBU · ${resourceById(c.resource).name}`;text.append(title);
        const sub=document.createElement('p');sub.textContent=`${c.grid} · ${c.sbu*16} kg packed resources`;text.append(sub);const actions=document.createElement('div');actions.className='trade-row-actions';
        actions.append(c.sbu===1?button('Carry',`take-${c.id}`,()=>run({op:'take',crate:c.id}),busy||Boolean(s.account?.carried)||!api.canTake(ship,c)):button('Tractor beam',`tractor-${c.id}`,tractor,busy||Boolean(s.account?.carried)||!['walk','eva'].includes(nav.mode)));
        if(near&&dock&&ship.owner===s.owner){actions.append(button(own?'List for sale':'Sell',`sell-${c.id}`,()=>run({op:own?'stock':'sell',crate:c.id,resource:c.resource,sbu:c.sbu}),busy||Boolean(t&&!own)));}
        row.append(text,actions);content.append(row);
      }
      if(!crates.length){const p=document.createElement('p');p.textContent='Cargo grid empty. Buy a shipment or pack your mined resources at a terminal.';content.append(p);}
      if(s.account?.carried)selection.append(button('Stow carried crate','stow',()=>run({op:'stow'}),busy||!ship||!api.canStow(ship)));
    }else if(view==='stock'){
      if(!own){const p=document.createElement('p');p.textContent='Visit your own trading pad. List cargo from the Cargo view, then set its selling price here.';content.append(p);}
      else{totalPages=Math.ceil(TRADE_RESOURCES.length/3);page=Math.min(page,totalPages-1);for(const res of TRADE_RESOURCES.slice(page*3,page*3+3)){
        const row=document.createElement('article'),text=document.createElement('div');text.textContent=`${res.name} · ${t.stock[res.id]??0} SBU · ${t.prices[res.id]??res.buy} CR / SBU`;
        const actions=document.createElement('div');actions.className='trade-row-actions trade-stock-actions';for(const delta of [-5,5])actions.append(button(`${delta>0?'+':''}${delta} CR`,`price-${res.id}-${delta}`,()=>run({op:'price',resource:res.id,price:Math.max(1,(t.prices[res.id]??res.buy)+delta)}),busy||!near));
        actions.append(button(`Withdraw ${size}`,`withdraw-${res.id}`,()=>run({op:'withdraw',resource:res.id,sbu:size}),busy||!near||!dock||(t.stock[res.id]??0)<size));row.append(text,actions);content.append(row);
      }}
    }else{
      const p=document.createElement('p');p.textContent=`Build a trade terminal with a 36 × 36 m landing pad for ${POST_COST} CR. Stand on flat ground and look toward the site. The pad centre will be 22 m ahead. Four pads per owner; keep 100 m between sites.`;content.append(p);
      content.append(button(`Build terminal & pad · ${POST_COST} CR`,'deploy-trade',async()=>{if(busy)return;busy=true;try{message=(await api.deploy()).message;}catch(e){message=e.message;}finally{busy=false;render();}},busy||nav.mode!=='walk'||nav.insideShip||nav.dockedAtStation));
      const small=document.createElement('p');small.textContent=s.online?'Shared stock and credits save on the server. Visitors can buy while the owner is away.':'Solo cargo saves with your mining inventory. Join Comms to build a shared trading pad.';content.append(small);
    }
    const pages=$('.trade-pages');pages.replaceChildren(button('Previous','previous-page',()=>{page--;render();},page<=0),document.createTextNode(` ${page+1} / ${totalPages} `),button('Next','next-page',()=>{page++;render();},page>=totalPages-1));
    $('.trade-feedback').textContent=message|| (s.online?'Server cargo ledger':'Cargo saved with this browser’s mining inventory');
    if(focused)dialog.querySelector(`[data-controller-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }
  $('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{nav.keys.clear();nav.gamepad.suspend();nav.enabled=!document.querySelector('dialog[open]');nav.canvas.focus({preventScroll:true});});
  return {dialog,render,get open(){return dialog.open;},openView(next='buy',id=api.nearestTerminal()){
    if(document.querySelector('dialog[open]')||nav.openingActive)return false;view=next;terminal=id??'';shipId='';page=0;message='';
    nav.keys.clear();nav.gamepad.suspend();nav.enabled=false;if(document.pointerLockElement)document.exitPointerLock();render();dialog.showModal();return true;
  },dispose(){dialog.remove();}};
}
