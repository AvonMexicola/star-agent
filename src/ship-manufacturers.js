import meridian from '../assets/brands/meridian-shipworks/identity.json';
import meridianEmblem from '../assets/brands/meridian-shipworks/emblem.svg?url';

/** Shared identity used by fleet, studios and the Blender authoring JSON. */
export const MERIDIAN = Object.freeze({...meridian, emblemURL: meridianEmblem});
export const shipManufacturer = id => MERIDIAN.ships.includes(id) ? MERIDIAN : null;
