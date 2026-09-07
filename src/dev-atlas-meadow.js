import { Vector3 } from 'three';
import { AEON, bodyOffset, bodySurfacePoint } from './celestial.js';
import { SEED } from './generation.js';
import { ATLAS_MEADOW_SEED } from './dev-launch-options.js';

// Seed 7291: meadow with a clear hull and a close fit across all six gear pads.
// The position always uses canonical terrain; only the initial stance is saved.
const MEADOW_DIRECTION = [0.013692585058580798, 0.6056142771291465, 0.7956405346962626];
const MEADOW_ATTITUDE = [0.45198957488735714, -0.2555944019854732, -0.15162264421697483, 0.841063314874384];

/** One explicit, fresh development scene; ordinary travel/boarding is unchanged. */
export async function placeAtlasMeadow(nav) {
  if (SEED !== ATLAS_MEADOW_SEED) throw new Error('Choose the Atlas + Burrow meadow in F2 to load its original planet seed.');
  if (nav.shipId !== 'atlas' || nav.body.id !== 'aeon' || !nav.vehicle) {
    throw new Error('The meadow start needs Atlas and Burrow on Aeon.');
  }
  nav.transit(MEADOW_DIRECTION, 35);
  nav.touchDown();
  if (nav.mode !== 'landed' || !nav.shipPosition) throw new Error('Atlas could not land in the meadow.');
  nav.shipPosition.addScaledVector(new Vector3(...MEADOW_DIRECTION), .0234348951);
  nav.shipOrientation.fromArray(MEADOW_ATTITUDE);
  nav.orientation.copy(nav.shipOrientation);
  nav.position.copy(nav.fromShipLocal(new Vector3(...nav.layout.seatEye)));

  const rover = nav.vehicle;
  const target = nav.fromShipLocal(new Vector3(40, 0, 0));
  if (!await rover.spawnSurface({ target })) throw new Error('No clear terrain beside Atlas for Burrow.');

  // Finish the existing steps/door animation before placing the initial viewer.
  async function waitFor(test, timeout, failure) {
    let elapsed = 0, previous = performance.now();
    while (!test()) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const now = performance.now();
      // The existing boarding route pauses with the game. Its setup deadline must
      // also pause when the player switches tabs or opens a menu.
      if (nav.enabled && nav.focused && !document.hidden && !document.querySelector('dialog[open]')) elapsed += Math.min(now - previous, 250);
      previous = now;
      if (elapsed > timeout) throw new Error(failure);
    }
  }
  await waitFor(() => rover.acceptInput, 60000, 'Burrow could not prepare its ground exit.');
  rover.interact();
  if (!rover.busy || rover.state.phase !== 'opening-out') throw new Error('Burrow boarding steps are obstructed.');
  await waitFor(() => !rover.occupied && !rover.busy, 30000, 'Burrow could not finish its ground exit.');

  const viewpoint = nav.fromShipLocal(new Vector3(80, 0, -45));
  nav.position.copy(bodySurfacePoint(bodyOffset(viewpoint, AEON), AEON, nav.layout.eyeHeight));
  nav.mode = 'walk';nav.insideShip = false;
  nav.jumpHeight = 0;nav.jumpVelocity = 0;
  nav.velocity.set(0, 0, 0);nav.angularVelocity.set(0, 0, 0);
  nav.keys.clear();nav.physicalKeys.clear();nav.gamepad.suspend();nav.resetSteering();
  const centre = nav.shipPosition.clone().lerp(rover.physics.state.position, .35).addScaledVector(nav.normal, 5);
  nav.orientToward(centre, nav.normal);
  document.title = 'Atlas + Burrow · Aeon meadow · Star Agent';
  nav.notify('Aeon meadow · Atlas landed, Burrow parked beside it. LS / WASD walks; X / F interacts; A / Space jumps.');
}
