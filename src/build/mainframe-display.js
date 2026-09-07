import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

/** A small live display over the authored console face; ownership/supply data
 * comes from the saved claim, never a decorative mock telemetry feed. */
export function updateMainframeDisplay(model,claim){
  let display=model.userData.statusDisplay;
  if(!display){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
    const mesh=new Mesh(new PlaneGeometry(.7,.44),new MeshBasicMaterial({map:texture,toneMapped:false}));
    mesh.name='Mainframe live authority display';mesh.rotation.y=Math.PI;mesh.position.set(0,1.25,-.392);model.add(mesh);
    const style=getComputedStyle(document.documentElement);
    display=model.userData.statusDisplay={canvas,texture,mesh,sourceMaterial:mesh.material,key:'',background:style.getPropertyValue('--dialog-solid').trim(),mint:style.getPropertyValue('--mint').trim(),text:style.color,font:style.getPropertyValue('--mono').trim()};
  }
  const key=`${claim.name}:${claim.pieces.length}:${claim.useBuffer}`;if(display.key===key)return;
  display.key=key;const ctx=display.canvas.getContext('2d');ctx.fillStyle=display.background;ctx.fillRect(0,0,512,320);
  ctx.fillStyle=display.mint;ctx.font=`bold 42px ${display.font}`;ctx.fillText('MAINFRAME',28,58);
  ctx.font=`23px ${display.font}`;ctx.fillText(claim.name.toUpperCase().slice(0,29),28,100);
  ctx.fillStyle=display.text;ctx.font=`28px ${display.font}`;ctx.fillText('LOCAL OWNER',28,162);ctx.fillText(`${claim.radius} M / ${claim.pieces.length} MODULES`,28,205);
  ctx.fillStyle=display.mint;ctx.fillText(claim.useBuffer?'SUPPLY LINK ON':'SUPPLY LINK OFF',28,270);display.texture.needsUpdate=true;
}
