/** Explicit local test starts. Normal/public entry ignores these parameters. */
export const ATLAS_MEADOW_SEED = 7291;
export const DEV_SHIPS = Object.freeze([
  {id:'nomad',name:'Nomad 02',detail:'Utility · walkable cabin, berth & cargo'},
  {id:'kestrel',name:'Kestrel',detail:'Interceptor · port ladder · energy weapons'},
  {id:'atlas',name:'Atlas',detail:'64 m freighter · loading ramps & crew lift'},
]);
export const DEV_LOCATIONS = Object.freeze([
  {id:'hangar',name:'Station hangar',detail:'Parked · boarding, cabins and departure'},
  {id:'rover-surface',name:'Burrow mining — Selene surface',detail:'Seated in the ground rover · nearby outcrop · ready to drive and mine'},
  {id:'atlas-meadow',name:'Aeon · Atlas + Burrow meadow',detail:'Landed Atlas · rover parked beside it · load up and fly',ship:'atlas',seed:ATLAS_MEADOW_SEED},
  {id:'station',name:'Station approach',detail:'Flight · docking and hull inspection'},
  {id:'coast',name:'Aeon · coast',detail:'95 m · ocean, grass and ground materials'},
  {id:'amphibian-habitat',name:'Aeon · Tideback beach',detail:'35 m · land and meet peaceful shore wildlife'},
  {id:'grazer-habitat',name:'Aeon · Mallow grassland',detail:'35 m · land and meet large friendly grazers'},
  {id:'forest',name:'Aeon · forest',detail:'95 m · trees, streaming and rock formations'},
  {id:'mountain',name:'Aeon · highlands',detail:'700 m · cliffs and terrain detail'},
  {id:'polar',name:'Aeon · polar ice',detail:'90 m · ice and snow'},
  {id:'orbit',name:'Aeon · high orbit',detail:'Spaceflight · map and relativistic drive'},
  {id:'moon',name:'Selene · landing site',detail:'180 m · lunar geology and mining'},
  {id:'ring',name:'Selene · rings',detail:'EVA · asteroids and ice mining'},
  {id:'pyre',name:'Pyre · twilight orbit',detail:'Atmosphere and volcanic world'},
  {id:'pyre-surface',name:'Pyre · surface',detail:'180 m · volcanic terrain and lava'},
  {id:'pyrebear-habitat',name:'Pyre · Pyrebear habitat',detail:'35 m · land and explore twilight basalt plains'},
  {id:'suloher-habitat',name:'Miasma · Suloher habitat',detail:'35 m · land and explore sulphur uplands'},
  {id:'miasma',name:'Miasma · approach',detail:'Sulphur clouds and toxic atmosphere'},
  {id:'miasma-surface',name:'Miasma · surface',detail:'180 m · mineral basins and regolith'},
  {id:'star',name:'Our star · observation',detail:'Stellar rendering and thermal shields'},
]);
export function devLaunchOptions(search,enabled){
  if(!enabled)return null;
  const query=new URLSearchParams(search);
  const ship=DEV_SHIPS.find(s=>s.id===query.get('ship'))?.id??'nomad';
  const location=DEV_LOCATIONS.find(s=>s.id===query.get('start'))?.id??'hangar';
  return {ship:DEV_LOCATIONS.find(s=>s.id===location)?.ship??ship,location,autoStart:query.get('dev')==='1'&&DEV_LOCATIONS.some(s=>s.id===query.get('start'))};
}
export function devLaunchURL(href,{ship,location}){
  if(!DEV_SHIPS.some(s=>s.id===ship)||!DEV_LOCATIONS.some(s=>s.id===location))throw new Error('Choose a test ship and location.');
  const preset=DEV_LOCATIONS.find(s=>s.id===location);
  ship=preset.ship??ship;
  const url=new URL(href);if(preset.seed!==undefined)url.searchParams.set('seed',String(preset.seed));url.searchParams.set('dev','1');url.searchParams.set('intro','0');url.searchParams.set('ship',ship);url.searchParams.set('start',location);
  url.searchParams.delete('exteriorView'); // The overview is a one-shot inspection start.
  url.searchParams.delete('sandbox');
  url.searchParams.delete('rover');
  url.searchParams.delete('meadow');
  if(preset.id==='atlas-meadow')url.searchParams.delete('cargo-test');
  return url.href;
}
