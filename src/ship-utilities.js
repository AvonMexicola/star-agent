import * as THREE from 'three';
import { gearStep } from './gear-flight.js';

/** Animate the authored telescoping assemblies, retaining the conservative
 * deployed collision envelope throughout motion and for navigation safety. */
export function installLandingGear(ship) {
  let gears=[], progress=1;
  ship.readyPromise.then(model=>{model?.traverse(node=>{if(!node.isMesh&&node.name.startsWith('LandingGear_'))gears.push(node);});});
  ship.updateGear=(dt,deployed,authoritativeProgress)=>{
    progress=authoritativeProgress??gearStep(progress,deployed,dt);
    const eased=progress*progress*(3-2*progress);
    for(const node of gears)node.scale.y=.08+.92*eased;
    ship.userData.gearProgress=progress;ship.userData.gearAssemblies=gears.length;
  };
}

/** One active ship lamp and one suit lamp, in camera-relative coordinates.
 * The wide ship beam points forward/down; no extra lights per parked vessel. */
export function createUtilityLights(scene) {
  function lamp(name,intensity,distance,angle){
    const light=new THREE.SpotLight(0xd8edff,intensity,distance,angle,.65,2);
    light.name=name;light.castShadow=true;light.shadow.mapSize.set(512,512);
    light.shadow.camera.near=.15;light.shadow.camera.far=distance;light.shadow.normalBias=.035;
    light.visible=false;scene.add(light,light.target);return light;
  }
  const shipLight=lamp('Landing floodlight',150_000,220,.72),suitLight=lamp('Suit flashlight',18,32,.48);
  const point=new THREE.Vector3(),direction=new THREE.Vector3();
  return {
    update(nav,origin){
      const foot=nav.mode==='walk'||nav.mode==='eva';
      suitLight.visible=foot&&nav.flashlightOn&&!nav.openingActive;
      point.set(.32,-.12,-.35).applyQuaternion(nav.orientation).add(nav.position).sub(origin);
      suitLight.position.copy(point);direction.set(0,-.06,-1).applyQuaternion(nav.orientation);
      suitLight.target.position.copy(point).addScaledVector(direction,12);
      shipLight.visible=Boolean(nav.shipPosition||nav.mode==='flight'||nav.mode==='landed')&&nav.shipLightsOn&&nav.powered&&nav.mode!=='crashed'&&!nav.openingActive;
      const rotation=nav.shipPosition?nav.shipOrientation:nav.orientation;
      // Place the emitter just outside the opaque nose, below the sight line.
      point.set(0,nav.layout.seatEye[1]-.85,nav.layout.flightBounds.min[2]-.15);
      if(!nav.shipPosition)point.sub(new THREE.Vector3(...nav.layout.seatEye));
      point.applyQuaternion(rotation).add(nav.shipPosition??nav.position).sub(origin);
      shipLight.position.copy(point);direction.set(0,-.65,-1).normalize().applyQuaternion(rotation);
      shipLight.target.position.copy(point).addScaledVector(direction,100);
    },
    get state(){return {ship:shipLight.visible,suit:suitLight.visible};},
    dispose(){for(const light of [shipLight,suitLight]){light.removeFromParent();light.target.removeFromParent();light.dispose();}},
  };
}
