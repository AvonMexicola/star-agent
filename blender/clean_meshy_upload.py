"""Make a conservative retry file for Meshy's external-model importer.

Run with ordinary Python after export_fighter.py --prepare. Only the temporary
painting shell changes: triangle fragments without usable geometric/UV area are
excluded. Position, normal, UV and image bytes are retained verbatim, so textures
still address the authored atlas. This does not repair/re-unwrap the runtime rig
or establish why a remote Meshy job failed.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import struct

ROOT = Path(__file__).resolve().parent.parent


def clean(source, target):
    original = source.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', original)
    if (magic, version, length) != (b'glTF', 2, len(original)):
        raise ValueError('Expected a complete glTF 2 binary file')
    json_length, chunk_type = struct.unpack_from('<II', original, 12)
    if chunk_type != 0x4e4f534a:
        raise ValueError('Missing glTF JSON chunk')
    doc = json.loads(original[20:20 + json_length])
    bin_length, chunk_type = struct.unpack_from('<II', original, 20 + json_length)
    if chunk_type != 0x004e4942 or 28 + json_length + bin_length != len(original):
        raise ValueError('Expected one embedded binary chunk')
    binary = memoryview(original)[28 + json_length:]
    if any(doc.get(key) for key in ('animations', 'skins', 'cameras', 'extensionsUsed')):
        raise ValueError('The painting shell must have no rig or extensions')
    if any(len(doc.get(key, [])) != 1 for key in ('meshes', 'materials', 'images', 'buffers')):
        raise ValueError('Expected one mesh, material, image and embedded buffer')
    primitives = doc['meshes'][0]['primitives']
    if len(primitives) != 1 or primitives[0].get('mode', 4) != 4:
        raise ValueError('Expected one triangle primitive')
    primitive = primitives[0]
    if set(primitive['attributes']) != {'POSITION', 'NORMAL', 'TEXCOORD_0'}:
        raise ValueError('Expected positions, normals and exactly one UV set')

    def view_bytes(number):
        view = doc['bufferViews'][number]
        if view.get('buffer', 0) or view.get('byteStride'):
            raise ValueError('Expected a tightly packed embedded buffer view')
        start = view.get('byteOffset', 0)
        return bytes(binary[start:start + view['byteLength']])

    def read_accessor(number):
        accessor = doc['accessors'][number]
        if accessor.get('byteOffset', 0) or accessor.get('sparse'):
            raise ValueError('Expected a plain, tightly packed accessor')
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
        fmt = '<' + {5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']] * width
        raw = view_bytes(accessor['bufferView'])
        if len(raw) != accessor['count'] * struct.calcsize(fmt):
            raise ValueError('Accessor count does not match its buffer')
        return list(struct.iter_unpack(fmt, raw))

    position = read_accessor(primitive['attributes']['POSITION'])
    normals = read_accessor(primitive['attributes']['NORMAL'])
    uv = read_accessor(primitive['attributes']['TEXCOORD_0'])
    indices = [v[0] for v in read_accessor(primitive['indices'])]
    if len(position) != len(uv) or len(position) != len(normals) or len(indices) % 3:
        raise ValueError('Inconsistent vertex/triangle counts')
    if any(not math.isfinite(v) for row in position + normals + uv for v in row):
        raise ValueError('Non-finite vertex data')
    if any(v < 0 or v > 1 for row in uv for v in row):
        raise ValueError('UV coordinates outside the authored 0–1 atlas')
    if not indices or min(indices) < 0 or max(indices) >= len(position):
        raise ValueError('Invalid triangle index')

    kept, rejected = [], []
    for start in range(0, len(indices), 3):
        tri = indices[start:start + 3]
        a, b, c = [position[i] for i in tri]
        u, v = [[q[i] - a[i] for i in range(3)] for q in (b, c)]
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        area = math.sqrt(sum(n*n for n in cross)) * .5
        a, b, c = [uv[i] for i in tri]
        uv_area = abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])) * .5
        if area < 1e-12 or uv_area < 1e-12:
            rejected.append({'triangle': start//3, 'surfaceM2': area, 'uvArea': uv_area})
        else:
            kept.extend(tri)
    if not kept:
        raise ValueError('The shell has no usable triangles')

    output = copy.deepcopy(doc)
    index_accessor = output['accessors'][primitive['indices']]
    index_accessor['count'] = len(kept)
    component = {5123: 'H', 5125: 'I'}[index_accessor['componentType']]
    new_indices = struct.pack('<' + component * len(kept), *kept)
    new_binary = bytearray()
    preserved = {}
    for number, view in enumerate(output['bufferViews']):
        raw = new_indices if number == index_accessor['bufferView'] else view_bytes(number)
        if number != index_accessor['bufferView']:
            preserved[str(number)] = hashlib.sha256(raw).hexdigest()
        new_binary.extend(b'\0' * (-len(new_binary) % 4))
        view['byteOffset'], view['byteLength'] = len(new_binary), len(raw)
        new_binary.extend(raw)
    output['buffers'][0]['byteLength'] = len(new_binary)
    new_binary.extend(b'\0' * (-len(new_binary) % 4))
    encoded = json.dumps(output, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    result = (struct.pack('<4sII', b'glTF', 2, 28+len(encoded)+len(new_binary))
              + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
              + struct.pack('<II', len(new_binary), 0x004e4942) + new_binary)
    target.write_bytes(result)
    return {
        'source': source.name, 'sourceSha256': hashlib.sha256(original).hexdigest(),
        'output': target.name, 'outputSha256': hashlib.sha256(result).hexdigest(),
        'bytes': len(result), 'trianglesBefore': len(indices)//3,
        'trianglesAfter': len(kept)//3, 'excludedTriangleCount': len(rejected),
        'excludedSurfaceM2': sum(t['surfaceM2'] for t in rejected),
        'preservedBufferSha256': preserved, 'excludedTriangles': rejected,
        'scope': 'Temporary Meshy painting shell only; vertex/UV/normal/image bytes unchanged',
    }


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT/'assets/kestrel/kestrel-meshy-input.glb')
    parser.add_argument('--output', type=Path, default=ROOT/'assets/kestrel/kestrel-meshy-clean.glb')
    parser.add_argument('--report', type=Path, default=Path('/tmp/kestrel-meshy-clean.json'))
    args = parser.parse_args()
    report = clean(args.source, args.output)
    args.report.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'excludedTriangles'}, indent=2))
