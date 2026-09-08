"""Validate a Meshy export against our painting shell, then import its PBR maps.

blender -b --python-exit-code 1 --python blender/import_fighter_textures.py -- --source downloaded.glb
Meshy's normalized geometry is used for verification only. The authored rig is
never replaced by the returned static mesh. Raw generated maps are retained.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import itertools
import json
import math
import struct
import sys
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT/'assets/kestrel/textures'


def load(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', data)
    if (magic, version, total) != (b'glTF', 2, len(data)):
        raise ValueError('Expected a complete glTF 2 binary')
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    binary = memoryview(data)[28+length:]

    def accessor(number):
        item = doc['accessors'][number]
        view = doc['bufferViews'][item['bufferView']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[item['type']]
        fmt = '<' + {5123: 'H', 5125: 'I', 5126: 'f'}[item['componentType']] * width
        step = view.get('byteStride', struct.calcsize(fmt))
        start = view.get('byteOffset', 0) + item.get('byteOffset', 0)
        return [struct.unpack_from(fmt, binary, start+i*step) for i in range(item['count'])]

    return data, doc, binary, accessor


def run(source):
    upload_path = ROOT/'assets/kestrel/kestrel-meshy-clean.glb'
    upload, original, _, read_original = load(upload_path)
    raw, result, binary, read_result = load(source)
    if len(result['meshes']) != 1 or len(result['materials']) != 1:
        raise ValueError('Expected one generated painting mesh/material')
    before = original['meshes'][0]['primitives'][0]
    after = result['meshes'][0]['primitives'][0]
    p = read_original(before['attributes']['POSITION'])
    uv = read_original(before['attributes']['TEXCOORD_0'])
    q = read_result(after['attributes']['POSITION'])
    generated_uv = read_result(after['attributes']['TEXCOORD_0'])
    low = [min(v[i] for v in p) for i in range(3)]
    high = [max(v[i] for v in p) for i in range(3)]
    center = [(low[i]+high[i])*.5 for i in range(3)]
    scale = max(high[i]-low[i] for i in range(3))*.5
    grid = collections.defaultdict(list)
    for vertex, texcoord in zip(p, uv):
        grid[tuple(round(c/1e-5) for c in vertex)].append(texcoord)
    errors = []
    for vertex, texcoord in zip(q, generated_uv):
        if any(not math.isfinite(v) for v in (*vertex, *texcoord)):
            raise ValueError('Non-finite Meshy data')
        key = [round((vertex[i]*scale+center[i])/1e-5) for i in range(3)]
        nearby = []
        for delta in itertools.product((-1, 0, 1), repeat=3):
            nearby.extend(grid.get(tuple(key[i]+delta[i] for i in range(3)), []))
        error = min((max(abs(texcoord[i]-other[i]) for i in range(2)) for other in nearby), default=10)
        errors.append(error)
    if not errors or max(errors) >= 2e-6:
        raise ValueError('Meshy UVs do not match the authored atlas; direct import rejected')

    raw_dir = TEX/'meshy-source'
    raw_dir.mkdir(parents=True, exist_ok=True)
    material = result['materials'][after['material']]
    pbr = material['pbrMetallicRoughness']
    channels = {'basecolor': pbr['baseColorTexture']['index'],
                'metallic-roughness': pbr['metallicRoughnessTexture']['index'],
                'normal': material['normalTexture']['index']}
    sources = {}
    for name, texture in channels.items():
        image_desc = result['images'][result['textures'][texture]['source']]
        view = result['bufferViews'][image_desc['bufferView']]
        start = view.get('byteOffset', 0)
        data = bytes(binary[start:start+view['byteLength']])
        extension = {'image/jpeg': '.jpg', 'image/png': '.png'}[image_desc['mimeType']]
        path = raw_dir/(name+extension)
        path.write_bytes(data)
        image = bpy.data.images.load(str(path), check_existing=False)
        image.colorspace_settings.name = 'Non-Color'
        resolution = list(image.size)
        image.scale(1024, 1024)

        def save(img, destination):
            img.filepath_raw = str(destination)
            img.file_format = 'PNG'
            img.save()

        if name == 'metallic-roughness':
            pixels = np.empty(1024*1024*4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            pixels = pixels.reshape(-1, 4)
            for label, channel in [('roughness', 1), ('metallic', 2)]:
                packed = np.ones_like(pixels)
                packed[:, :3] = pixels[:, channel, None]
                output = bpy.data.images.new('Meshy '+label, 1024, 1024, alpha=False)
                output.colorspace_settings.name = 'Non-Color'
                output.pixels.foreach_set(packed.reshape(-1))
                save(output, TEX/('meshy-'+label+'.png'))
        else:
            if name == 'normal':
                pixels = np.empty(1024*1024*4, dtype=np.float32)
                image.pixels.foreach_get(pixels)
                pixels = pixels.reshape(-1, 4)
                normal = pixels[:, :3]*2-1
                normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
                pixels[:, :3] = normal*.5+.5
                image.pixels.foreach_set(pixels.reshape(-1))
            save(image, TEX/('meshy-'+name+'.png'))
        sources[path.name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'resolution': resolution}
    record = {
        'version': 1, 'provider': 'Meshy', 'model': 'Meshy 7', 'requestedResolution': '2K',
        'pbrEnabled': True, 'prompt': '../meshy-prompt.txt', 'displayedCredits': 10,
        'sourceFile': source.name, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'sourceBytes': len(raw), 'uploadSha256': hashlib.sha256(upload).hexdigest(),
        'uvLayoutSha256': json.loads((TEX.parent/'texture-layout.json').read_text())['sha256'],
        'uvVerification': {'matchedVertices': len(errors), 'totalVertices': len(errors), 'maxError': max(errors),
                           'restoredPositionScale': scale, 'restoredPositionCenter': center, 'flipV': False},
        'sourceMaps': sources, 'importedResolution': [1024, 1024],
        'scope': 'Generated PBR maps only; Blender rig and authored UV layout preserved',
    }
    (raw_dir/'source.json').write_text(json.dumps(record, indent=2)+'\n')
    print('KESTREL_MESHY_IMPORT '+json.dumps(record), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    run(args.source)
