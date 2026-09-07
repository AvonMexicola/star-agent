import { controlAction } from './projected-action-label.js';

/** Uses the same reach and mechanism state as the physical interaction owner. */
export function describeAtlasControl(systems, position, seated = false) {
  const lift = systems.elevator, floor = position.y - systems.eyeHeight;
  const onLift = Math.abs(position.x - lift.centre[0]) <= lift.width / 2 - systems.capsuleRadius
    && Math.abs(position.z - lift.centre[1]) <= lift.length / 2 - systems.capsuleRadius
    && Math.abs(floor - lift.y) < .2;
  const id = seated ? 'seat' : systems.interactionAt(position)
    ?? (onLift && lift.moving ? 'elevator:crew' : null);
  if (!id) return null;
  if (id === 'seat') return {
    id, target: 'Pilot station', anchor: [systems.layout.stand[0], 10.8, -20.79],
    ...controlAction('seat', seated ? 'occupied' : 'empty'),
  };
  if (id.startsWith('ramp:')) {
    const ramp = systems.ramps.find(item => id === `ramp:${item.id}`);
    const state = ramp.moving ? ramp.target === ramp.openAngle ? 'opening' : 'closing'
      : Math.abs(ramp.angle - ramp.closedAngle) < .001 ? 'closed' : 'open';
    const exterior = systems.exteriorRampCallAt?.(position);
    const [x, y, z] = ramp.control;
    return { id, target: `${ramp.id === 'front' ? 'Forward' : 'Aft'} loading ramp`,
      anchor: exterior?.anchor ?? [x, y + 1.13, z - ramp.outward * .29], ...controlAction('ramp', state) };
  }
  if (id === 'storage') return null;
  let state;
  if (lift.moving) state = lift.waitingForGates ? 'securing' : 'moving';
  else if (onLift) state = Math.abs(lift.y - lift.low) < .2 ? 'up' : 'down';
  else state = Math.abs(lift.y - floor) < .2 ? 'present' : 'call';
  return {
    id, target: onLift ? 'Crew lift' : floor < (lift.low + lift.high) / 2 ? 'Cargo deck lift' : 'Upper deck lift',
    anchor: onLift ? [lift.centre[0], lift.y + 1.13, lift.centre[1] - 1.39]
      : [lift.callPanel.centre[0], floor + lift.callPanel.touchHeight,
        lift.callPanel.centre[1] + lift.callPanel.touchOffsetZ + .025],
    ...controlAction('lift', state),
  };
}

/** No invented flight, inventory or navigation values in the inspection bay. */
export function atlasInspectionPages(systems) {
  const rampState = ramp => ramp.moving ? ramp.target === ramp.openAngle ? 'OPENING' : 'CLOSING'
    : Math.abs(ramp.angle - ramp.closedAngle) < .001 ? 'CLOSED' : 'OPEN';
  const lift = systems.elevator;
  const liftState = lift.moving ? `${lift.y.toFixed(1)} m / MOVING`
    : Math.abs(lift.y - lift.low) < .2 ? 'CARGO DECK' : 'UPPER DECK';
  return [
    { rows: [['SHIP STATUS', 'DOCKED'], ['FLIGHT CONTROL', 'NOT CONNECTED'], ['PROPULSION', 'NOT CONNECTED']], footer: 'SHIPYARD INSPECTION / FLIGHT OFFLINE' },
    { rows: [['LOCATION', 'SHIPYARD 04'], ['COURSE', 'NOT CONNECTED'], ['NAVIGATION', 'NOT CONNECTED']], footer: 'NO LIVE FLIGHT NAVIGATION IN THIS BAY' },
    { rows: [['FORWARD RAMP', rampState(systems.ramps[0])], ['AFT RAMP', rampState(systems.ramps[1])], ['CREW LIFT', liftState]], footer: lift.waitingForGates ? 'SAFETY GATES / SECURING' : 'PHYSICAL ACTUATOR STATUS' },
    { rows: [['CARGO BAY', '48 x 14.4 m'], ['DRIVE LANE', '8.0 m CLEAR'], ['MANIFEST', 'NOT CONNECTED']], footer: 'AUTHORING DIMENSIONS / NO CARGO SAVE' },
  ];
}
