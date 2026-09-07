import {MeshBasicMaterial} from 'three';
import {createStratum} from './stratum.js';
import {createGannet} from './gannet.js';
import {createShipMFDs} from './ship-mfd.js';

/** Adapt authored hulls to the same runtime presentation contract as the fleet. */
export function createMediumShip(id, systems) {
  const ship = id === 'stratum' ? createStratum() : createGannet(systems);
  const mfd = id === 'stratum' ? createShipMFDs({includeFrames:false, profile:'stratum'}) : null;
  const sourceReady = ship.readyPromise;
  ship.readyPromise = sourceReady.then(result => {
    if (!result) throw new Error(`${id} model could not be loaded.`);
    if (mfd) ship.getDisplays().forEach((mesh, i) => {
      const map = mfd.screenTextures()[i]; map.flipY = false;
      mesh.material = new MeshBasicMaterial({map, toneMapped:false});
      mesh.material.userData.unweathered = true; mesh.castShadow = mesh.receiveShadow = false;
    });
    ship.userData.assetStatus = 'ready'; return ship;
  });
  ship.setDoor = () => {};
  ship.setStorage = open => { ship.userData.storageOpen = Boolean(open); };
  const updateGear = ship.updateGear;
  ship.updateGear = (dt, deployed, progress) => {
    systems.setGear(progress, deployed); ship.userData.gearProgress = progress;
    if (id === 'stratum') ship.applyPose({gearProgress:progress, rampProgress:systems.progress});
    else updateGear(dt, deployed, progress);
  };
  if (id === 'stratum') {
    ship.update = () => ship.applyPose({gearProgress:systems.gearProgress, rampProgress:systems.progress});
    ship.updateDisplays = (dt, nav, inventory) => {
      const mining = nav.shipMiningState ?? {}, ore = mining.mass ?? 0;
      mfd.updatePages(dt, [
        {rows:[['SPEED', `${nav.speed.toFixed(1)} m/s`], ['ALTITUDE', `${Math.round(nav.altitude).toLocaleString()} m`], ['DRIVE', nav.powered ? 'ONLINE' : 'OFF']], footer:'MERIDIAN / STRATUM M-05'},
        {rows:[['BODY', nav.body.id.toUpperCase()], ['REGIME', nav.flightEnvironment.regime], ['FLIGHT ASSIST', nav.flightAssist ? 'ENGAGED' : 'UNLOCKED']], footer:'Continuous flight / metres'},
        {rows:[['CUTTER CHARGE', `${Math.round((mining.charge ?? 1) * 100)}%`], ['TWIN BEAMS', mining.beaming ? 'CUTTING' : 'STANDBY'], ['ORE BIN', `${ore.toFixed(2)} / 384 kg`]], footer:mining.reason ?? 'RT / T / hold cutter control'},
        {rows:[['SUPPLIES', `${inventory.mass('ship').toFixed(1)} / 240 kg`], ['BOARDING RAMP', systems.moving ? 'MOVING' : systems.secured ? 'SECURED' : 'DEPLOYED'], ['LANDING GEAR', nav.gearProgress >= .999 ? 'DOWN' : nav.gearProgress <= .001 ? 'STOWED' : 'MOVING']], footer:'32 SBU freight / separate ore bin'},
      ]);
    };
    ship.displayState = () => mfd.snapshot();
  }
  return ship;
}
