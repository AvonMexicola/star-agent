"""Pure CPU checks for a texture-only painting return; no Blender or service API."""
import collections
import itertools
import json
import math
import struct


def load(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', data)
    if (magic, version, total) != (b'glTF', 2, len(data)):
        raise ValueError('Expected a complete glTF 2 binary')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4e4f534a:
        raise ValueError('Missing glTF JSON chunk')
    doc = json.loads(data[20:20+length])
    binary_length, kind = struct.unpack_from('<II', data, 20+length)
    if kind != 0x004e4942 or binary_length + 28 + length != len(data):
        raise ValueError('Expected one embedded binary chunk')
    binary = memoryview(data)[28+length:]

    def accessor(number):
        item = doc['accessors'][number]
        if item.get('sparse') or item.get('normalized'):
            raise ValueError('Painting accessors must be plain, unquantized values')
        view = doc['bufferViews'][item['bufferView']]
        if view.get('buffer', 0):
            raise ValueError('Painting attributes must use the embedded buffer')
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[item['type']]
        fmt = '<' + {5123: 'H', 5125: 'I', 5126: 'f'}[item['componentType']] * width
        step = view.get('byteStride', struct.calcsize(fmt))
        start = view.get('byteOffset', 0) + item.get('byteOffset', 0)
        return [struct.unpack_from(fmt, binary, start+i*step) for i in range(item['count'])]

    return data, doc, binary, accessor


def verify_mesh(original, read_original, result, read_result):
    """Match both used position/UV corners and faces after Meshy normalization.

    Duplicate vertices/faces, index order and winding may differ because the
    returned geometry is never rendered. Every unique authored painting face
    must still be represented. A matching subset cannot authorize the full atlas.
    """
    for doc in (original, result):
        if len(doc['meshes']) != 1 or len(doc['materials']) != 1 or len(doc['meshes'][0]['primitives']) != 1:
            raise ValueError('Expected one painting mesh/material/primitive')
        if doc['meshes'][0]['primitives'][0].get('mode', 4) != 4:
            raise ValueError('Painting geometry must be triangles')
    before, after = (doc['meshes'][0]['primitives'][0] for doc in (original, result))
    p = read_original(before['attributes']['POSITION'])
    uv = read_original(before['attributes']['TEXCOORD_0'])
    q = read_result(after['attributes']['POSITION'])
    generated_uv = read_result(after['attributes']['TEXCOORD_0'])
    if not p or len(p) != len(uv) or not q or len(q) != len(generated_uv):
        raise ValueError('Inconsistent painting vertex/UV counts')
    if any(not math.isfinite(v) for rows in (p, uv, q, generated_uv) for row in rows for v in row):
        raise ValueError('Non-finite painting data')
    low = [min(v[i] for v in p) for i in range(3)]
    high = [max(v[i] for v in p) for i in range(3)]
    center = [(low[i]+high[i])*.5 for i in range(3)]
    scale = max(high[i]-low[i] for i in range(3))*.5
    if scale <= 0:
        raise ValueError('Painting shell has no extent')
    grid = collections.defaultdict(list)
    # Float32 normalization can coalesce original corners a few micrometres
    # apart. Canonicalize within the same declared matching tolerance before
    # comparing coverage, so harmless exporter rounding cannot look like loss.
    parents = list(range(len(p)))
    def identity(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index
    for index, (vertex, texcoord) in enumerate(zip(p, uv)):
        key = tuple(round(c/1e-5) for c in vertex)
        for delta in itertools.product((-1, 0, 1), repeat=3):
            for other in grid.get(tuple(key[i]+delta[i] for i in range(3)), []):
                if (max(abs(vertex[i]-p[other][i]) for i in range(3)) <= 1e-5
                        and max(abs(texcoord[i]-uv[other][i]) for i in range(2)) < 2e-6):
                    parents[identity(index)] = identity(other)
        grid[key].append(index)
    corners = [identity(index) for index in range(len(p))]
    matched, errors, position_errors = [], [], []
    for vertex, texcoord in zip(q, generated_uv):
        restored = [vertex[i]*scale+center[i] for i in range(3)]
        key = [round(c/1e-5) for c in restored]
        candidates = []
        for delta in itertools.product((-1, 0, 1), repeat=3):
            for index in grid.get(tuple(key[i]+delta[i] for i in range(3)), []):
                position_error = max(abs(restored[i]-p[index][i]) for i in range(3))
                uv_error = max(abs(texcoord[i]-uv[index][i]) for i in range(2))
                if position_error <= 1e-5 and uv_error < 2e-6:
                    score = (position_error/1e-5)**2 + (uv_error/2e-6)**2
                    candidates.append((score, index, position_error, uv_error))
        if not candidates:
            raise ValueError('Meshy position/UV does not match the authored atlas')
        _, index, position_error, uv_error = min(candidates)
        matched.append(corners[index]);errors.append(uv_error);position_errors.append(position_error)

    def faces(primitive, read, mapping):
        indices = [row[0] for row in read(primitive['indices'])]
        if not indices or len(indices) % 3 or min(indices) < 0 or max(indices) >= len(mapping):
            raise ValueError('Invalid painting triangle indices')
        used = {mapping[index] for index in indices}
        triangles = {tuple(sorted(mapping[index] for index in indices[start:start+3]))
                     for start in range(0, len(indices), 3)}
        return used, triangles, len(indices)//3

    expected_used, expected_faces, original_count = faces(before, read_original, corners)
    actual_used, actual_faces, returned_count = faces(after, read_result, matched)
    if actual_used != expected_used:
        raise ValueError(f'Painting corner coverage differs: {len(expected_used-actual_used)} missing, {len(actual_used-expected_used)} unexpected')
    if actual_faces != expected_faces:
        raise ValueError(f'Painting face coverage differs: {len(expected_faces-actual_faces)} missing, {len(actual_faces-expected_faces)} unexpected')
    return {'matchedVertices': len(q), 'totalVertices': len(q), 'maxError': max(errors),
            'maxPositionErrorM': max(position_errors), 'restoredPositionScale': scale,
            'restoredPositionCenter': center, 'flipV': False,
            'usedCorners': len(expected_used), 'uniqueTriangles': len(expected_faces),
            'originalTriangles': original_count, 'returnedTriangles': returned_count,
            'cornerToleranceM': 1e-5, 'cornerToleranceUV': 2e-6,
            'coverage': 'Bidirectional used position/UV corners and unique triangle corners; winding/index order ignored'}


def verify_material(doc, primitive):
    """Resolve only embedded maps addressing the verified, untransformed UV0."""
    material = doc['materials'][primitive['material']]
    if material.get('alphaMode', 'OPAQUE') != 'OPAQUE':
        raise ValueError('The returned painting material must be opaque')
    pbr = material['pbrMetallicRoughness']
    infos = {'basecolor': pbr['baseColorTexture'],
             'metallic-roughness': pbr['metallicRoughnessTexture'],
             'normal': material['normalTexture']}
    images = {}
    for name, info in infos.items():
        extensions = info.get('extensions', {})
        if set(extensions) - {'KHR_texture_transform'}:
            raise ValueError('Unsupported painting texture-info extension: '+name)
        transform = extensions.get('KHR_texture_transform', {})
        if (info.get('texCoord', 0) != 0 or transform.get('texCoord', 0) != 0
                or transform.get('offset', [0, 0]) != [0, 0]
                or transform.get('scale', [1, 1]) != [1, 1]
                or transform.get('rotation', 0) != 0):
            raise ValueError('Painting maps must address untransformed TEXCOORD_0: '+name)
        texture = doc['textures'][info['index']]
        if texture.get('extensions') or 'source' not in texture:
            raise ValueError('Unsupported painting texture indirection: '+name)
        image = doc['images'][texture['source']]
        if 'uri' in image or 'bufferView' not in image or image.get('mimeType') not in ('image/jpeg', 'image/png'):
            raise ValueError('Painting maps must be embedded PNG or JPEG images: '+name)
        if doc['bufferViews'][image['bufferView']].get('buffer', 0) != 0:
            raise ValueError('Painting images must use the embedded buffer: '+name)
        images[name] = image
    factors = {'baseColorFactor': pbr.get('baseColorFactor', [1, 1, 1, 1]),
               'metallicFactor': pbr.get('metallicFactor', 1),
               'roughnessFactor': pbr.get('roughnessFactor', 1),
               'normalScale': material['normalTexture'].get('scale', 1)}
    return images, {'maps': 'Untransformed TEXCOORD_0; embedded PNG/JPEG only',
                    'factors': factors,
                    'factorDisposition': 'Recorded, intentionally replaced by the authored colour/material/normal-strength recipe; the generated material itself is not imported'}
