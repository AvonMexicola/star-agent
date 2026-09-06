import * as THREE from 'three';
import { stationFinishPalette } from './station-finish-palette.js';

/** Native Station preparation enables shadows on every mesh. Printed letters,
 * painted markings and transparent glazing must not become opaque shadow cards. */
export function prepareStationFinishShadows(root){
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(/^(Sign_|DeckMarkings|DeckNumber)/.test(mesh.name)||materials.some(material=>material?.transparent))mesh.castShadow=false;
  });
}

const sunDefaults=new WeakMap();
/** Spend the existing sun shadow resolution on the occupied hangar, then restore
 * the original flight frustum and bias as soon as the player leaves it. */
export function updateStationFinishSun(sun,inside){
  let state=sunDefaults.get(sun);
  if(!state){
    const camera=sun.shadow.camera;
    state={inside:null,intensity:sun.intensity,normalBias:sun.shadow.normalBias,bounds:{left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom}};
    sunDefaults.set(sun,state);
  }
  sun.intensity=inside ? .65 : state.intensity;
  if(state.inside===inside)return;
  state.inside=inside;
  Object.assign(sun.shadow.camera,inside?{left:-45,right:45,top:45,bottom:-45}:state.bounds);
  sun.shadow.normalBias=inside ? .045 : state.normalBias;
  sun.shadow.camera.updateProjectionMatrix();
}

/** One reusable local rig follows the occupied bay; no twenty-fold shadow/light cost. */
export function createStationFinishLighting(){
  const palette=stationFinishPalette(),group=new THREE.Group();group.name='Hangar service lighting';
  const lamps=[];
  const add=(name,colour,intensity,position,target,angle,shadow=false)=>{
    const light=new THREE.SpotLight(colour,intensity,42,angle,.55,2);light.name=name;
    light.position.set(...position);light.target.position.set(...target);
    light.castShadow=shadow;
    if(shadow){light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.3;light.shadow.camera.far=42;light.shadow.bias=-.00015;light.shadow.normalBias=.018;}
    group.add(light,light.target);lamps.push(light);return light;
  };
  add('Warm cargo task light',palette.warm,210,[-12,-3.4,20.9],[-12,-7,22.7],Math.PI/3);
  add('Elevator arrival light',palette.warm,160,[0,-3.2,21.7],[0,-7.5,23.8],Math.PI/3);
  add('Workbench task light',palette.warm,220,[-18.2,-3.2,15],[-18.2,-7.7,17],Math.PI/3.3);
  add('Service corner contact shadows',palette.cool,350,[-10,3,14],[-12,-8,20],Math.PI/2.8,true);
  let attached=null;
  return {group,lamps,update(station,position){
    const frame=station.ready&&station.location==='hangar'?station.active:null;
    const visible=Boolean(frame&&frame.worldPosition.distanceTo(position)<75);
    if(frame!==attached){group.removeFromParent();frame?.group.add(group);attached=frame;}
    group.visible=visible;
    for(const pod of station.pods){
      // Existing general bay lights become restrained fill beneath the local practical lamps.
      if(pod.fill)pod.fill.intensity=pod===frame&&visible ? .055 : 0;
      pod.localLights.forEach((light,i)=>{light.color.set(i===0?palette.warm:palette.cool);light.intensity=i===0?70:90;});
    }
  }};
}
