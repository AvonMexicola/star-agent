export function markerDistance(metres){
  return metres<1000?`${Math.round(metres)} m`:metres<100000?`${(metres/1000).toFixed(1)} km`:`${Math.round(metres/1000).toLocaleString('en-US')} km`;
}

/** Subtract world doubles before projection. Behind-camera targets retain their
 * left/right direction instead of mirroring through the perspective divide. */
export function projectShipMarker(position,orientation,target,{width,height,fov=52,bounds:customBounds}){
  const local=target.clone().sub(position).applyQuaternion(orientation.clone().invert());
  const distance=local.length(),scale=height/(2*Math.tan(fov*Math.PI/360));
  const paddingX=Math.min(110,width*.28),paddingY=Math.min(180,height*.28);
  const bounds=customBounds??{left:paddingX,right:width-paddingX,top:paddingY,bottom:height-paddingY};
  const cx=width/2,cy=height/2,behind=local.z>=0;
  let dx=local.x,dy=-local.y;
  if(!behind){dx=local.x*scale/Math.max(.0001,-local.z);dy=-local.y*scale/Math.max(.0001,-local.z);}
  const onScreen=!behind&&cx+dx>=bounds.left&&cx+dx<=bounds.right&&cy+dy>=bounds.top&&cy+dy<=bounds.bottom;
  if(!onScreen){
    if(Math.hypot(dx,dy)<1e-9){dx=1;dy=0;}
    const reach=Math.min(dx>0?(bounds.right-cx)/dx:dx<0?(bounds.left-cx)/dx:Infinity,dy>0?(bounds.bottom-cy)/dy:dy<0?(bounds.top-cy)/dy:Infinity);
    dx*=reach;dy*=reach;
  }
  return {x:cx+dx,y:cy+dy,angle:Math.atan2(dy,dx)*180/Math.PI,onScreen,behind,distance};
}

