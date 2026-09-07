import { STELLAR_THERMAL } from './stellar-thermal.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAPACITY } from './ship-inventory.js';

const mint = '#9ee7d1', dim = '#5d939c', white = '#e0efed', amber = '#f3b16d';
const titles = ['FLIGHT', 'NAVIGATION', 'SYSTEMS', 'CARGO'];
const distance = value => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value.toFixed(1)} m`;

/** Four independent, physical 16:10 screens. Update textures at 5 Hz, not every draw. */
export function createShipMFDs() {
  const group = new THREE.Group();
  group.name = 'Four rectangular multifunction displays';
  const frameFinish = new THREE.MeshStandardMaterial({ color: 0x111f26, metalness: .65, roughness: .36 });
  const screens = titles.map((title, i) => {
    const canvas = document.createElement('canvas');canvas.width = 512;canvas.height = 320;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
    const mount = new THREE.Group();mount.position.set((i - 1.5) * .52, 2.08, -4.25);mount.rotation.x = -.36;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(.504, .326, .065), frameFinish);
    mount.add(bezel);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });material.userData.unweathered = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.464, .29), material);screen.position.z = .034;
    screen.name = `MFD ${i + 1} / ${title}`;mount.add(screen);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(.010, .024, .009), bezel.material);
        key.position.set(side * .243, -.09 + k * .06, .037);mount.add(key);
      }
    }
    group.add(mount);
    return { ctx, texture, title, values: [] };
  });
  // All rigid bezels and side keys share one draw, plus one draw per screen.
  group.updateMatrixWorld(true);
  const frames = [];
  group.traverse(object => { if (object.isMesh && object.material === frameFinish) frames.push(object); });
  const geometries = frames.map(object => object.geometry.clone().applyMatrix4(object.matrixWorld));
  const frame = new THREE.Mesh(mergeGeometries(geometries), frameFinish);frame.name = 'MFD bezels and keys';
  frames.forEach(object => { object.parent.remove(object);object.geometry.dispose(); });
  geometries.forEach(geometry => geometry.dispose());group.add(frame);
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
  let accumulator = 1;
  group.update = (dt, nav, inventory, course) => {
    accumulator += dt;if (accumulator < .2) return;accumulator = 0;
    const env = nav.flightEnvironment, n = nav.normal;
    const localVelocity = nav.velocity.clone().applyQuaternion(nav.orientation.clone().invert());
    paint(screens[0], [['VELOCITY', `${nav.speed.toFixed(1)} m/s`], [nav.body.star?'PHOTOSPHERE CLEARANCE':'ALTITUDE AGL', distance(nav.altitude)], ['FLIGHT CONTROL', nav.mode === 'flight' ? nav.flightAssist ? 'ASSIST ON' : 'INERTIAL' : nav.mode.toUpperCase()]], 'V ASSIST   X BRAKE   L LAND / LAUNCH', 0);
    let bearing = 'NO COURSE';
    if (course) {
      const offset = course.point.clone().sub(nav.position).applyQuaternion(nav.orientation.clone().invert());
      const angle = Math.atan2(offset.x, -offset.z) * 180 / Math.PI;
      bearing = `${Math.abs(angle).toFixed(0)} DEG ${angle < 0 ? 'LEFT' : 'RIGHT'}`;
    }
    paint(screens[1], [['COURSE', course ? course.name.toUpperCase() : 'FREE EXPLORATION'], ['BEARING', bearing], ['POSITION', `${(Math.asin(n.y) * 180 / Math.PI).toFixed(2)} / ${(Math.atan2(n.x, n.z) * 180 / Math.PI).toFixed(2)}`]], 'SHIFT + DESTINATION TO SET COURSE', 1);
    if(nav.body.star){
      const thermal=nav.stellarThermal;
      paint(screens[2],[['SHIELD TEMPERATURE',`${Math.round(thermal.temperature-273.15)} C`],['HULL INTEGRITY',`${Math.ceil(thermal.hull)}%`],['RADIATION',thermal.temperature>=STELLAR_THERMAL.damage?'THERMAL DAMAGE':'SHIELDS HOLDING']],'SPACE + SHIFT: RETREAT FROM STAR',2);
    }else paint(screens[2], [['ENVIRONMENT', nav.body.toxic&&env.atmosphereFraction>0?'TOXIC · SUIT SEALED':env.regime], ['HATCH / RAMP', nav.doorOpen ? nav.doorProgress > .98 ? 'OPEN / DEPLOYED' : 'OPENING' : nav.doorProgress > .02 ? 'CLOSING' : 'SEALED / STOWED'], ['LOCAL VERTICAL', `${localVelocity.y.toFixed(1)} m/s`]], `ATMOSPHERE ${Math.round(env.atmosphereFraction * 100)}%   ${nav.boost ? 'BOOST' : 'NOMINAL'}`, 2);
    paint(screens[3], [['SHIP STORAGE', `${inventory.mass('ship').toFixed(1)} / ${CAPACITY.ship} kg`], ['BACKPACK', `${inventory.mass('pack').toFixed(1)} / ${CAPACITY.pack} kg`], ['ACCESS', 'STARBOARD CABIN']], 'ON FOOT: F AT THE CARGO CONTAINER', 3);
  };
  group.snapshot = () => screens.map(screen => ({ title: screen.title, values: [...screen.values] }));
  return group;
}
