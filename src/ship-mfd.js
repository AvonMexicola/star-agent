import { STELLAR_THERMAL } from './stellar-thermal.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAPACITY } from './ship-inventory.js';
import { itemMass } from './inventory/containers.js';

const mint = '#9ee7d1', dim = '#5d939c', white = '#e0efed', amber = '#f3b16d';
const titles = ['FLIGHT', 'NAVIGATION', 'SYSTEMS', 'CARGO'];
const distance = value => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value.toFixed(1)} m`;

/** Four independent, physical 16:10 screens. Update textures at 5 Hz, not every draw. */
export function createShipMFDs({ mounts = null, includeFrames = true, screenOffset = .034, height = 320, profile = 'nomad' } = {}) {
  if (mounts && mounts.length !== 4) throw new RangeError('A pilot MFD suite requires four mounts');
  const group = new THREE.Group();
  group.name = 'Four rectangular multifunction displays';
  const frameFinish = new THREE.MeshStandardMaterial({ color: 0x111f26, metalness: .65, roughness: .36 });
  const screenTitles=profile==='stratum'?['FLIGHT','NAVIGATION','MINING','CARGO']:profile==='kestrel'?['FLIGHT','VESSEL','SYSTEMS','DRIVE']:profile==='kestrel-flight'?['FLIGHT','NAVIGATION','SYSTEMS','VESSEL']:titles;
  const screens = screenTitles.map((title, i) => {
    const canvas = document.createElement('canvas');canvas.width = 512;canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1,0,0,height/320,0,0);
    const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
    const definition = mounts?.[i];
    const width = definition?.width ?? .464, screenHeight = definition?.height ?? .29;
    const mount = new THREE.Group();
    mount.position.fromArray(definition?.position ?? [(i - 1.5) * .52, 2.08, -4.25]);
    mount.rotation.fromArray(definition?.rotation ?? [-.36, 0, 0]);
    const bezel = includeFrames ? new THREE.Mesh(new THREE.BoxGeometry(width + .04, screenHeight + .036, .065), frameFinish) : null;
    if (bezel) mount.add(bezel);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });material.userData.unweathered = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, screenHeight), material);screen.position.z = screenOffset;
    screen.name = `MFD ${i + 1} / ${title}`;mount.add(screen);
    for (const side of includeFrames ? [-1, 1] : []) {
      for (let k = 0; k < 4; k++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(.010, .024, .009), bezel.material);
        key.position.set(side * .243, -.09 + k * .06, .037);mount.add(key);
      }
    }
    group.add(mount);
    return { ctx, texture, title, mesh: screen, values: [] };
  });
  // All rigid bezels and side keys share one draw, plus one draw per screen.
  group.updateMatrixWorld(true);
  const frames = [];
  group.traverse(object => { if (object.isMesh && object.material === frameFinish) frames.push(object); });
  const geometries = frames.map(object => object.geometry.clone().applyMatrix4(object.matrixWorld));
  const frame = geometries.length ? new THREE.Mesh(mergeGeometries(geometries), frameFinish) : null;
  if (frame) frame.name = 'MFD bezels and keys';
  frames.forEach(object => { object.parent.remove(object);object.geometry.dispose(); });
  geometries.forEach(geometry => geometry.dispose());
  if (frame) group.add(frame);else frameFinish.dispose();
  function paint(screen, rows, footer, index) {
    const { ctx, title, texture } = screen;
    screen.values = rows.map(([label, value]) => `${label}: ${value}`);
    ctx.fillStyle = '#06151d';ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#0e3038';ctx.fillRect(0, 0, 512, 54);
    ctx.font = 'bold 19px monospace';ctx.fillStyle = mint;ctx.fillText(`0${index + 1}  /  ${title}`, 22, 34);
    ctx.fillStyle = mint;ctx.fillRect(477, 24, 8, 8);
    rows.forEach(([label, value], i) => {
      const y = 89 + i * 60;
      ctx.font = '13px monospace';ctx.fillStyle = dim;ctx.fillText(label, 22, y);
      ctx.font = `${i === 0 ? 'bold 27' : '23'}px monospace`;ctx.fillStyle = i === 0 ? white : mint;ctx.fillText(value, 22, y + 29);
      ctx.strokeStyle = '#18343f';ctx.beginPath();ctx.moveTo(22, y + 40);ctx.lineTo(490, y + 40);ctx.stroke();
    });
    ctx.font = '12px monospace';ctx.fillStyle = amber;ctx.fillText(footer, 22, 297);
    // Subtle raster lines belong to the screen surface, never the viewport.
    ctx.fillStyle = '#00000012';for (let y = 56; y < 280; y += 4) ctx.fillRect(0, y, 512, 1);
    texture.needsUpdate = true;
  }
  let accumulator = 1, renderedPower = null;
  // Alternate consumers supply truthful page data without fabricating a
  // Navigation or inventory object. Production flight keeps update() below.
  group.updatePages = (dt, pages) => {
    if (pages.length !== 4) throw new RangeError('Supply four MFD pages');
    accumulator += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (accumulator < .2) return;
    accumulator = 0;
    pages.forEach((page, index) => paint(screens[index], page.rows, page.footer, index));
  };
  group.update = (dt, nav, inventory, course) => {
    const multiplayer = nav.multiplayer?.state && !Object.hasOwn(nav.multiplayer, 'connected')
      ? nav.multiplayer.state : nav.multiplayer;
    const serverInventory = multiplayer?.connected ? multiplayer.inventory : null;
    const cargoMass = id => serverInventory?.containers?.[id] ? itemMass(serverInventory.containers[id]) : inventory.mass(id);
    const cargoCapacity = id => serverInventory?.capacity?.[id] ?? inventory.capacity?.[id] ?? CAPACITY[id];
    const combat=nav.combat&&!multiplayer?.connected?nav.combat:null;
    const commsPage=Boolean(multiplayer&&(profile!=='atlas-flight'||multiplayer.connected));
    screens[2].title = combat&&['transit','engage','complete','failed'].includes(combat.phase) ? 'COMBAT' : commsPage ? 'COMMS' : 'SYSTEMS';
    if(combat?.phase==='transit')course={name:'Patrol signal',point:combat.point};
    screens[2].mesh.name = `MFD 3 / ${screens[2].title}`;
    if(combat&&screens[2].title==='COMBAT'){
      screens[2].mesh.userData.actionId='patrol';screens[2].mesh.userData.action=()=>nav.openPatrolConsole?.();
    } else if (commsPage) {
      screens[2].mesh.userData.actionId = 'comms';
      screens[2].mesh.userData.action = () => nav.openComms?.();
    } else {
      delete screens[2].mesh.userData.actionId;
      delete screens[2].mesh.userData.action;
    }
    const powered = nav.powered !== false;
    accumulator += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    // Keep the normal 5 Hz canvas budget, but show power transitions on the
    // first frame so a shutdown never leaves stale flight data on the panels.
    if (accumulator < .2 && renderedPower === powered) return;
    accumulator = 0;renderedPower = powered;
    const rawShipSpeed = Number.isFinite(nav.shipSpeed) ? nav.shipSpeed : nav.speed;
    const shipSpeed = Number.isFinite(rawShipSpeed) ? rawShipSpeed : 0;
    if (!powered) {
      const storage = `${inventory.mass('ship').toFixed(1)} / ${(inventory.capacity?.ship ?? CAPACITY.ship)} kg`;
      const pages = [
        [['MAIN POWER', 'OFF'], ['PROPULSION', 'DISABLED'], ['SHIP VELOCITY', `${shipSpeed.toFixed(1)} m/s`]],
        [['MAIN POWER', 'OFF'], ['NAVIGATION', 'STANDBY'], ['FLIGHT CONTROLS', 'UNAVAILABLE']],
        [['MAIN POWER', 'OFF'], ['PROPULSION', 'DISABLED'], ['CABIN ACCESS', 'AVAILABLE']],
        [['MAIN POWER', 'OFF'], ['SHIP STORAGE', storage], ['CARGO ACCESS', 'AVAILABLE']],
      ];
      if(profile==='kestrel-flight'){
        pages[2]=[['MAIN POWER','OFF'],['ACCESS','EMERGENCY POWER'],['DISEMBARK','LANDED / DOCKED ONLY']];
        pages[3]=[['BUILDER','MERIDIAN SHIPWORKS'],['WEAPON MOUNTS','4 × S2 / EMPTY'],['CARGO HOLD','NONE']];
      }
      pages.forEach((rows, index) => paint(screens[index], rows, 'P AT PILOT SEAT TO RESTORE POWER', index));
      return;
    }
    const env = nav.flightEnvironment, n = nav.normal;
    const velocity = nav.cabinFlight && nav.shipVelocity ? nav.shipVelocity : nav.velocity;
    const orientation = nav.cabinFlight && nav.shipOrientation ? nav.shipOrientation : nav.orientation;
    const localVelocity = velocity.clone().applyQuaternion(orientation.clone().invert());
    if(profile==='kestrel'){
      const progress=nav.previewProgress,targets=nav.previewTargets;
      const state=(key,closed,open)=>progress[key]<.001?closed:progress[key]>.999?open:targets[key]?'DEPLOYING':'STOWING';
      paint(screens[0],[['SHIP STATUS','PARKED'],['RIG CLEARANCE','0.9 m'],['CONTROLS','INSPECTION']],'DRAG TO ORBIT  /  1-6 VIEWPOINTS',0);
      paint(screens[1],[['ROLE','SINGLE-SEAT INTERCEPTOR'],['LENGTH / SPAN','13.5 / 9.0 m'],['FLIGHT SYSTEM','OFFLINE']],'MERIDIAN SHIPWORKS  /  KS-134',1);
      paint(screens[2],[['CANOPY',state('canopy','SEALED','OPEN')],['LADDER',state('ladder','STOWED','DEPLOYED')],['LANDING GEAR',state('gear','RETRACTED','DOWN')]],'C CANOPY   L LADDER   G GEAR',2);
      paint(screens[3],[['ENGINE GLOW',`${Math.round((nav.previewThrottle||0)*100)} %`],['DRY MASS','9,000 kg'],['FUEL / HEAT','NOT CONNECTED']],'SHIPWORKS INSPECTION  /  STATIC RIG',3);
      return;
    }
    const flightControl = nav.cabinFlight
      ? nav.flightAssist ? 'CABIN / ASSIST' : 'CABIN / INERTIAL'
      : nav.mode === 'flight' ? nav.flightAssist ? 'ASSIST ON' : 'INERTIAL' : nav.mode.toUpperCase();
    paint(screens[0], [['VELOCITY', `${shipSpeed.toFixed(1)} m/s`], [nav.body?.star?'PHOTOSPHERE CLEARANCE':'ALTITUDE AGL', distance(nav.altitude)], ['FLIGHT CONTROL', flightControl]], nav.controllerActive?'R3 ASSIST   LT BRAKE   Y LAND / LAUNCH':'V ASSIST   X BRAKE   B LAND / LAUNCH', 0);
    let bearing = 'NO COURSE';
    if (course) {
      const position = nav.cabinFlight && nav.shipPosition ? nav.shipPosition : nav.position;
      const offset = course.point.clone().sub(position).applyQuaternion(orientation.clone().invert());
      const angle = Math.atan2(offset.x, -offset.z) * 180 / Math.PI;
      bearing = `${Math.abs(angle).toFixed(0)} DEG ${angle < 0 ? 'LEFT' : 'RIGHT'}`;
    }
    paint(screens[1], [['COURSE', course ? course.name.toUpperCase() : 'FREE EXPLORATION'], ['BEARING', bearing], ['POSITION', `${(Math.asin(n.y) * 180 / Math.PI).toFixed(2)} / ${(Math.atan2(n.x, n.z) * 180 / Math.PI).toFixed(2)}`]], 'M MAP / AIM TO CHARGE DRIVE', 1);
    if(profile==='kestrel-flight'&&!multiplayer?.connected){
      const a=nav.kestrelAccess;
      const mechanism=(value,closed,open)=>value<.001?closed:value>.999?open:'MOVING';
      paint(screens[2],[['CANOPY',mechanism(a?.canopy??0,'SEALED','OPEN')],['LADDER',mechanism(a?.ladder??0,'STOWED','DEPLOYED')],['LANDING GEAR',mechanism(nav.gearProgress,'RETRACTED','DOWN')]],nav.controllerActive?'MENU / LANDING GEAR':'G GEAR   F DISEMBARK WHEN LANDED',2);
      if(combat&&screens[2].title==='COMBAT')paint(screens[2],[['SHIELDS',`${Math.ceil(combat.player.shield)} / ${combat.player.maxShield}`],['HULL',`${Math.ceil(combat.player.hull)} / ${combat.player.maxHull}`],['TARGET',combat.target?.label??combat.phase.toUpperCase()]],'T / RT FIRE   TAB / MENU TARGET',2);
      paint(screens[3],[['BUILDER','MERIDIAN SHIPWORKS'],['WEAPON ARRAY','ENERGY / ONLINE'],['CARGO HOLD','NONE / PILOT BACKPACK']],'KESTREL  /  SINGLE-SEAT INTERCEPTOR',3);
      return;
    }
    if(combat&&screens[2].title==='COMBAT'){
      paint(screens[2],[['SHIELDS',`${Math.ceil(combat.player.shield)} / ${combat.player.maxShield}`],['HULL',`${Math.ceil(combat.player.hull)} / ${combat.player.maxHull}`],['TARGET',combat.target?.label??combat.phase.toUpperCase()]],'T / RT FIRE   TAB / MENU TARGET',2);
    } else if (commsPage) {
      const players = Array.isArray(multiplayer.players) ? multiplayer.players.length : 0;
      const capacity = Number.isFinite(multiplayer.maxPlayers) ? ` / ${multiplayer.maxPlayers}` : '';
      const hangar = multiplayer.hangar;
      const hangarStatus = hangar ? `${hangar.id ?? 'ASSIGNED'} / ${String(hangar.status ?? 'ASSIGNED').toUpperCase()}` : 'NO ASSIGNMENT';
      const footer = !multiplayer.account ? 'OPEN ACCOUNT TO SIGN IN'
        : !multiplayer.connected ? 'OPEN COMMS TO JOIN MULTIPLAYER'
          : hangar ? 'OPEN COMMS TO REVIEW / CANCEL HANGAR' : 'OPEN COMMS TO REQUEST HANGAR';
      paint(screens[2], [['LINK', multiplayer.connected ? 'CONNECTED' : 'OFFLINE'], ['PILOTS', `${players}${capacity}`], ['HANGAR', hangarStatus]], footer, 2);
    } else if(nav.body?.star){
      const thermal=nav.stellarThermal;
      paint(screens[2],[['SHIELD TEMPERATURE',`${Math.round(thermal.temperature-273.15)} C`],['HULL INTEGRITY',`${Math.ceil(thermal.hull)}%`],['RADIATION',thermal.temperature>=STELLAR_THERMAL.damage?'THERMAL DAMAGE':'SHIELDS HOLDING']],'SPACE + SHIFT: RETREAT FROM STAR',2);
    } else if (nav.freighter?.ramps) {
      const systems=nav.freighter,lift=systems.elevator;
      const rampState=r=>r.moving?'MOVING':Math.abs(r.angle-r.closedAngle)<.001?'SEALED':'OPEN';
      paint(screens[2],[...systems.ramps.map(r=>[r.id==='front'?'FORWARD RAMP':'AFT RAMP',rampState(r)]),
        ['CREW LIFT',lift.moving?'MOVING':Math.abs(lift.y-lift.low)<.001?'CARGO DECK':'UPPER DECK']],
        `GEAR ${nav.gearProgress>=1?'DOWN':nav.gearProgress<=0?'STOWED':'MOVING'} / ${systems.secured?'READY FOR FLIGHT':'SECURE RAMPS / LIFT'}`,2);
    } else {
      paint(screens[2], [['ENVIRONMENT', nav.body?.toxic&&env.atmosphereFraction>0?'TOXIC · SUIT SEALED':env.regime], [nav.freighter?'CARGO LIFTS':'HATCH / RAMP', nav.freighter?(nav.freighter.secured?'SECURED':'DEPLOYED'):nav.doorOpen ? nav.doorProgress > .98 ? 'OPEN / DEPLOYED' : 'OPENING' : nav.doorProgress > .02 ? 'CLOSING' : 'SEALED / STOWED'], ['LOCAL VERTICAL', `${localVelocity.y.toFixed(1)} m/s`]], `ATMOSPHERE ${Math.round(env.atmosphereFraction * 100)}%   ${!nav.cabinFlight && nav.boost ? 'BOOST' : 'NOMINAL'}`, 2);
    }
    paint(screens[3], [['SHIP STORAGE', `${cargoMass('ship').toFixed(1)} / ${cargoCapacity('ship')} kg`], ['BACKPACK', `${cargoMass('pack').toFixed(1)} / ${cargoCapacity('pack')} kg`], ['ACCESS', serverInventory?'SERVER AUTHORITY':nav.freighter?'CARGO DECK':'AFT RACK / PORT']], serverInventory?'OPEN SERVER INVENTORY TO TRANSFER':'ON FOOT: F AT THE CARGO CONTAINER', 3);
  };
  group.snapshot = () => screens.map(screen => ({ title: screen.title, values: [...screen.values] }));
  // Asset studios can bind the same bounded-rate canvases to authored glTF quads.
  group.screenTextures = () => screens.map(screen=>screen.texture);
  return group;
}
