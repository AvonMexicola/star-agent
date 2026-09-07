// Small, dependency-free binary glTF utilities for the character build and audit.
import { readFileSync, writeFileSync } from 'node:fs';

const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const COMPONENT = {
  5121: [1, 'readUInt8', 'writeUInt8'], 5123: [2, 'readUInt16LE', 'writeUInt16LE'],
  5125: [4, 'readUInt32LE', 'writeUInt32LE'], 5126: [4, 'readFloatLE', 'writeFloatLE'],
};
const align = value => (value + 3) & ~3;

export class AvatarGLB {
  constructor(path) {
    const bytes = readFileSync(path);
    if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw Error(`Invalid GLB: ${path}`);
    for (let offset = 12; offset < bytes.length;) {
      const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
      const chunk = bytes.subarray(offset + 8, offset + 8 + size);
      if (type === 0x4e4f534a) this.json = JSON.parse(chunk.toString('utf8').trim());
      if (type === 0x004e4942) this.binary = Buffer.from(chunk);
      offset += 8 + size;
    }
    if (!this.json || !this.binary) throw Error(`Missing GLB chunks: ${path}`);
  }

  rows(index) {
    const accessor = this.json.accessors[index], view = this.json.bufferViews[accessor.bufferView];
    const [bytes, read] = COMPONENT[accessor.componentType], width = WIDTH[accessor.type];
    const start = (view?.byteOffset || 0) + (accessor.byteOffset || 0), stride = view?.byteStride || bytes * width;
    const rows = Array.from({ length: accessor.count }, (_, row) =>
      Array.from({ length: width }, (_, column) => view ? this.binary[read](start + row * stride + column * bytes) : 0));
    if (accessor.sparse) {
      const sparse = accessor.sparse, [indexBytes, indexRead] = COMPONENT[sparse.indices.componentType];
      const indices = (this.json.bufferViews[sparse.indices.bufferView].byteOffset || 0) + (sparse.indices.byteOffset || 0);
      const values = (this.json.bufferViews[sparse.values.bufferView].byteOffset || 0) + (sparse.values.byteOffset || 0);
      for (let i = 0; i < sparse.count; i++) {
        const row = this.binary[indexRead](indices + i * indexBytes);
        for (let c = 0; c < width; c++) rows[row][c] = this.binary[read](values + (i * width + c) * bytes);
      }
    }
    return rows;
  }

  addView(bytes, metadata = {}) {
    const offset = align(this.binary.length);
    this.binary = Buffer.concat([this.binary, Buffer.alloc(offset - this.binary.length), bytes]);
    return this.json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...metadata }) - 1;
  }

  addRows(rows, type, componentType = 5126) {
    const [bytes, , write] = COMPONENT[componentType], width = WIDTH[type];
    const data = Buffer.alloc(rows.length * width * bytes);
    const min = Array(width).fill(Infinity), max = Array(width).fill(-Infinity);
    rows.forEach((row, i) => row.forEach((value, j) => {
      if (!Number.isFinite(value)) throw Error('Non-finite character data');
      data[write](value, (i * width + j) * bytes);
      min[j] = Math.min(min[j], value); max[j] = Math.max(max[j], value);
    }));
    return this.json.accessors.push({ bufferView: this.addView(data), componentType, count: rows.length, type, min, max }) - 1;
  }

  addSparseRows(rows, type) {
    const selected = rows.map((row, i) => row.some(v => Math.abs(v) > 1e-7) ? i : -1).filter(i => i >= 0);
    const values = this.addRows(selected.map(i => rows[i]), type);
    const indices = this.addRows(selected.map(i => [i]), 'SCALAR', rows.length > 65535 ? 5125 : 5123);
    const source = this.json.accessors[values];
    return this.json.accessors.push({ componentType: 5126, count: rows.length, type,
      min: source.min.map(v => Math.min(v, 0)), max: source.max.map(v => Math.max(v, 0)),
      sparse: { count: selected.length,
        indices: { bufferView: this.json.accessors[indices].bufferView, componentType: this.json.accessors[indices].componentType },
        values: { bufferView: source.bufferView } } }) - 1;
  }

  image(index) {
    const image = this.json.images[index], view = this.json.bufferViews[image.bufferView];
    return this.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  }

  /** Copy an animation from the same rig exported in a separate Meshy batch. */
  importAnimation(source, animation) {
    const copy = structuredClone(animation), nodes = this.json.nodes;
    for (const channel of copy.channels) {
      const name = source.json.nodes[channel.target.node].name;
      channel.target.node = nodes.findIndex(node => node.name === name);
      if (channel.target.node < 0) throw Error(`Animation bone missing from target: ${name}`);
    }
    const copied = new Map();
    for (const sampler of copy.samplers) for (const key of ['input', 'output']) {
      const index = sampler[key];
      if (!copied.has(index)) copied.set(index, this.addRows(source.rows(index), source.json.accessors[index].type));
      sampler[key] = copied.get(index);
    }
    this.json.animations.push(copy);
    return copy;
  }

  /** Keep only referenced accessors and views, removing discarded source images/tracks. */
  compact() {
    const accessors = [], views = [], chunks = [], accessorMap = new Map(), viewMap = new Map();
    let length = 0;
    const view = index => {
      if (viewMap.has(index)) return viewMap.get(index);
      const old = this.json.bufferViews[index], offset = align(length);
      chunks.push(Buffer.alloc(offset - length), this.binary.subarray(old.byteOffset || 0, (old.byteOffset || 0) + old.byteLength));
      length = offset + old.byteLength;
      const result = views.push({ ...old, buffer: 0, byteOffset: offset }) - 1;
      viewMap.set(index, result); return result;
    };
    const accessor = index => {
      if (accessorMap.has(index)) return accessorMap.get(index);
      const old = this.json.accessors[index];
      const copy = { ...old };
      if (old.bufferView !== undefined) copy.bufferView = view(old.bufferView);
      if (old.sparse) copy.sparse = { ...old.sparse,
        indices: { ...old.sparse.indices, bufferView: view(old.sparse.indices.bufferView) },
        values: { ...old.sparse.values, bufferView: view(old.sparse.values.bufferView) } };
      const result = accessors.push(copy) - 1;
      accessorMap.set(index, result); return result;
    };
    for (const mesh of this.json.meshes || []) for (const primitive of mesh.primitives) {
      for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = accessor(primitive.attributes[key]);
      if (primitive.indices !== undefined) primitive.indices = accessor(primitive.indices);
      for (const target of primitive.targets || []) for (const key of Object.keys(target)) target[key] = accessor(target[key]);
    }
    for (const mesh of this.json.meshes || []) if (mesh.extras?.shadowIndices !== undefined) mesh.extras.shadowIndices = accessor(mesh.extras.shadowIndices);
    for (const skin of this.json.skins || []) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = accessor(skin.inverseBindMatrices);
    for (const animation of this.json.animations || []) for (const sampler of animation.samplers) {
      sampler.input = accessor(sampler.input); sampler.output = accessor(sampler.output);
    }
    for (const image of this.json.images || []) image.bufferView = view(image.bufferView);
    this.json.accessors = accessors; this.json.bufferViews = views;
    this.binary = Buffer.concat(chunks);
    return this;
  }

  bytes({ materials = true } = {}) {
    const json = structuredClone(this.json);
    if (!materials) {
      for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) delete primitive.material;
      delete json.materials; delete json.textures; delete json.images; delete json.samplers;
      delete json.extensionsUsed; delete json.extensionsRequired;
    }
    json.buffers = [{ byteLength: this.binary.length }];
    const encoded = Buffer.from(JSON.stringify(json)), jsonLength = align(encoded.length), binLength = align(this.binary.length);
    const output = Buffer.alloc(28 + jsonLength + binLength);
    output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
    output.writeUInt32LE(jsonLength, 12); output.writeUInt32LE(0x4e4f534a, 16);
    output.fill(0x20, 20, 20 + jsonLength); encoded.copy(output, 20);
    output.writeUInt32LE(binLength, 20 + jsonLength); output.writeUInt32LE(0x004e4942, 24 + jsonLength);
    this.binary.copy(output, 28 + jsonLength);
    return output;
  }
  save(path) { writeFileSync(path, this.bytes()); }
}
