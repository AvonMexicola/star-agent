import './ship-marker.css';
import {markerDistance,projectShipMarker} from './ship-marker-projection.js';

/** Automatic recovery beacon. Call with the current hull pose every frame so a
 * future moving-ship integration cannot leave the marker at the EVA exit point. */
export function createShipMarker({nav,camera,entryLocal,shipName='Nomad',parent=document.body}){
  let accessLabel='REAR RAMP';
  const element=document.createElement('aside');element.id='ship-marker';element.hidden=true;
  element.setAttribute('aria-label','Your ship recovery beacon');
  element.innerHTML='<span class="ship-marker-symbol" aria-hidden="true"><span class="ship-marker-diamond">◇</span><span class="ship-marker-arrow">➤</span></span><strong></strong><small></small>';
  parent.append(element);
  const title=element.querySelector('strong'),detail=element.querySelector('small'),arrow=element.querySelector('.ship-marker-arrow');
  let state={visible:false};
  return {
    setShip(values){shipName=values.shipName;entryLocal=values.entryLocal;accessLabel=values.accessLabel;},
    update(width,height){
      const visible=Boolean(nav.shipPosition)&&(!nav.insideShip||nav.roverOccupied)&&(nav.mode==='eva'||nav.mode==='walk');
      element.hidden=!visible;
      element.dataset.mode=nav.mode;
      if(!visible){state={visible:false};return;}
      const target=entryLocal.clone().applyQuaternion(nav.shipOrientation).add(nav.shipPosition);
      const projection=projectShipMarker(nav.position,nav.orientation,nav.viewPoint?.(target)??target,{width,height,fov:camera.getEffectiveFOV()});
      state={visible:true,...projection,target:target.toArray(),shipName};
      element.style.left=`${projection.x}px`;element.style.top=`${projection.y}px`;
      element.dataset.edge=String(!projection.onScreen);element.dataset.behind=String(projection.behind);
      arrow.style.transform=`rotate(${projection.angle}deg)`;
      title.textContent=`${shipName.toUpperCase()} · ${markerDistance(projection.distance)}`;
      const accessStatus=nav.freighter?.accessStatus??(nav.doorOpen?'APPROACH SLOWLY':'CLOSED');
      detail.textContent=projection.behind?'YOUR SHIP · TURN BACK':projection.distance<75?`${accessLabel} · ${accessStatus}`:'YOUR SHIP · BEACON';
      element.setAttribute('aria-label',`Your ship, ${shipName}, ${markerDistance(projection.distance)} to ${accessLabel.toLowerCase()}${projection.behind?', behind you':''}`);
    },
    get state(){return state;},
    dispose(){element.remove();},
  };
}
