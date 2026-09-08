import {PointLight, Vector3} from 'three';

// Metres in the authored hull frame. These points sit just below actual mint
// diffuser surfaces, not above opaque roofs. The bay faces have named anchors
// because the Gannet's reserved vehicle volume must remain clear through Y4.6.
const SOURCES = {
  gannet: 'Cabin__Gannet_restrained_mint_emitters', // GLTFLoader's sanitized batch name.
  stratum: 'Stratum_Static__powered_indicator',
};
const LAMPS = {
  gannet: [
    {name:'CabinFore', position:[-1.60,3.77,-7.0], intensity:12, range:5},
    {name:'CabinBerths', position:[1.60,3.77,-4.3], intensity:12, range:5},
    {name:'CabinAisle', position:[-1.60,3.77,-1.0], intensity:12, range:5},
    {name:'CabinPortal', position:[1.60,3.77,1.7], intensity:12, range:5},
    {name:'BayPort', anchor:'CabinLight_Bay_Port', intensity:20, range:5.5},
    {name:'BayStarboard', anchor:'CabinLight_Bay_Starboard', intensity:20, range:5.5},
  ],
  stratum: [
    {name:'CabinFore', position:[-1.72,3.70,-4.25], intensity:12, range:5},
    {name:'CabinAisle', position:[1.72,3.70,.5], intensity:12, range:5},
    {name:'CabinAft', position:[-1.72,3.70,5.25], intensity:12, range:5},
  ],
};

/** Local powered illumination only; no asset material, rig or exposure edits. */
export function createMediumShipLights(ship, id) {
  const definitions = LAMPS[id];
  if (!definitions) throw new Error(`No cabin lamp contract for ${id}`);
  const sourceNode = ship.getObjectByName(SOURCES[id]), meshes = [];
  // Quantized glTF exports may put the actual mesh below the named batch node.
  sourceNode?.traverse(object => { if (object.isMesh) meshes.push(object); });
  if (meshes.length !== 1) throw new Error(`${id} cabin diffuser mesh is missing or ambiguous`);
  const source = meshes[0];
  // Resolve the complete contract before adding any lights to the loaded hull.
  const positions = definitions.map(definition => {
    if (definition.position) return new Vector3(...definition.position);
    const anchor = ship.getObjectByName(definition.anchor);
    if (!anchor) throw new Error(`${id} missing lamp anchor ${definition.anchor}`);
    const point = ship.worldToLocal(anchor.getWorldPosition(new Vector3()));
    point.y -= .04;
    return point;
  });
  ship.updateMatrixWorld(true);
  const lights = definitions.map((definition, index) => {
    const light = new PointLight(0xb9e8d8, definition.intensity, definition.range, 2);
    light.name = `${id}_${definition.name}_Light`;
    // A hidden diffuser or cached hull must not contribute to scene lighting.
    // Parenting to its real mesh lets Three's visible traversal enforce that.
    light.position.copy(source.worldToLocal(ship.localToWorld(positions[index])));
    light.visible = false;
    light.castShadow = false;
    source.add(light);
    return light;
  });
  let disposed = false;
  return {
    update(nav) {
      const sourceVisible = source.visible && [source.material].flat().some(material => material.visible);
      const powered = !disposed && nav.shipId === id && nav.powered === true
        && !['crashed','destroyed'].includes(nav.mode) && sourceVisible;
      for (const light of lights) light.visible = powered;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const light of lights) { light.visible = false; light.removeFromParent(); light.dispose(); }
    },
  };
}
