import { readFile } from 'node:fs/promises';
import { Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Node geometry/rig checks only. Production Chromium verifies image decoding. */
export async function readGLBGeometry(url) {
  const data = await readFile(url), loader = new GLTFLoader();
  loader.register(parser => {
    parser.loadTextureImage = async index => {
      const texture = new Texture();parser.associations.set(texture, { textures: index });return texture;
    };
    return { name: 'NodeGeometryInspection' };
  });
  return loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}
