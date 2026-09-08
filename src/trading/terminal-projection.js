import {Group,Mesh,PlaneGeometry,MeshBasicMaterial,CanvasTexture,SRGBColorSpace,BufferGeometry,Float32BufferAttribute,LineSegments,LineBasicMaterial} from 'three';
import {TERMINAL_SCREEN} from './terminal-frames.js';
export const PROJECTION_LIMIT=6,PROJECTION_RANGE=36;
export function nearbyProjections(frames,position){return frames.filter(f=>f.position.distanceToSquared(position)<PROJECTION_RANGE**2).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position)).slice(0,PROJECTION_LIMIT);}

/** Bounded, camera-relative display pool. Textures upload only on identity changes. */
export function createTerminalProjections(scene,{canvasFactory=()=>document.createElement('canvas')}={}){
  const entries=new Map(),plane=new PlaneGeometry(TERMINAL_SCREEN.width,TERMINAL_SCREEN.height);
  const lines=new BufferGeometry();lines.setAttribute('position',new Float32BufferAttribute([-.22,-.68,-.10,-.58,-.4125,0,.22,-.68,-.10,.58,-.4125,0,-.58,-.4125,0,.58,-.4125,0],3));
  let uploads=0,disposed=false;
  const fonts=typeof document!=='undefined'?document.fonts:null;let fontReady=!fonts||fonts.status==='loaded';
  fonts?.ready.then(()=>{if(!disposed){fontReady=true;for(const e of entries.values())e.key='';}});
  function paint(e,f,connected){
    const key=JSON.stringify([f.name,f.role,f.status,connected,fontReady]);if(e.key===key)return;e.key=key;
    const c=e.canvas.getContext('2d');c.clearRect(0,0,1024,640);
    c.fillStyle='rgba(11,28,37,.95)';c.fillRect(8,8,1008,624);c.strokeStyle='#88c6bb';c.lineWidth=3;c.strokeRect(9.5,9.5,1005,621);
    c.fillStyle='#b6efd1';c.fillRect(10,10,7,620);c.font='500 25px "DM Sans", sans-serif';c.fillText(f.network,52,72);
    c.fillStyle=f.available?'#b6efd1':'#efc28c';c.beginPath();c.arc(952,62,8,0,Math.PI*2);c.fill();
    c.fillStyle='#edf4f1';c.font='500 62px "Barlow Condensed", sans-serif';
    const words=f.name.split(' ');let line='',y=186;
    for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>900&&line){c.fillText(line,52,y);y+=68;line=word;}else line=next;}
    c.fillText(line,52,y,900);c.font='27px "DM Sans", sans-serif';c.fillStyle='#a3c1c6';c.fillText(f.role,52,Math.min(350,y+57),900);
    c.fillStyle='#a3c1c6';c.font='25px "DM Sans", sans-serif';c.fillText(connected?'Pilot session active':f.status,52,425);
    c.fillStyle=f.available?'#b6efd1':'#efc28c';c.fillRect(52,465,920,98);c.fillStyle='#102a33';c.font='500 33px "DM Sans", sans-serif';c.fillText(connected?'Exchange connected':f.available?'F / X    Connect to exchange':'F / X    View terminal',82,527);
    c.fillStyle='#8faeb5';c.font='21px "DM Sans", sans-serif';c.fillText('Cargo • Supplies • Local trade',52,604);
    e.texture.needsUpdate=true;uploads++;
  }
  return {
    update(frames,position,origin,connectedId=''){
      if(disposed)return;const active=nearbyProjections(frames,position),ids=new Set(active.map(f=>f.id));
      for(const [id,e]of entries)if(!ids.has(id)){e.root.removeFromParent();e.texture.dispose();e.material.dispose();e.lineMaterial.dispose();entries.delete(id);}
      for(const f of active){let e=entries.get(f.id);if(!e){const canvas=canvasFactory();canvas.width=1024;canvas.height=640;const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
        const material=new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}),lineMaterial=new LineBasicMaterial({color:0xb6efd1,transparent:true,opacity:.22,depthWrite:false,toneMapped:false}),root=new Group();root.name=`Projected exchange ${f.id}`;root.add(new Mesh(plane,material));const emitter=new LineSegments(lines,lineMaterial);root.add(emitter);scene.add(root);e={root,canvas,texture,material,lineMaterial,emitter,key:''};entries.set(f.id,e);}
        e.root.position.copy(f.position).sub(origin);e.root.quaternion.copy(f.quaternion);e.emitter.visible=!f.flush;e.root.visible=f.status!=='Power offline';e.root.scale.setScalar(f.flush ? .82 : 1);paint(e,f,connectedId===f.id);
      }
    },
    get state(){return {count:entries.size,uploads,textureWidth:1024,textureHeight:640,ids:[...entries.keys()],draws:[...entries.values()].reduce((n,e)=>n+(e.root.visible?(e.emitter.visible?2:1):0),0)};},
    dispose(){disposed=true;for(const e of entries.values()){e.root.removeFromParent();e.texture.dispose();e.material.dispose();e.lineMaterial.dispose();}entries.clear();plane.dispose();lines.dispose();},
  };
}
