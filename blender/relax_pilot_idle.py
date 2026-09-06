"""Replace only the male pilot idle's arm rotations, preserving all other GLB bytes.

    python3 blender/relax_pilot_idle.py public/models/props/player-male.glb

The checked-in preset is sampled from the mannequin-retargeted male idle. Its
legs are deliberately excluded: the original clip has the grounded stance.
"""
import json
import math
from pathlib import Path
import struct
import sys


def slerp(a, b, t):
    dot = sum(x * y for x, y in zip(a, b))
    if dot < 0:
        b, dot = [-v for v in b], -dot
    if dot > .9995:
        out = [x + (y - x) * t for x, y in zip(a, b)]
    else:
        angle = math.acos(max(-1, min(1, dot)))
        out = [(x * math.sin((1 - t) * angle) + y * math.sin(t * angle)) / math.sin(angle)
               for x, y in zip(a, b)]
    length = math.sqrt(sum(v * v for v in out))
    return [v / length for v in out]


def relax(path):
    data = bytearray(path.read_bytes())
    magic, version, total = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and total == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20 + size])
    binary = 20 + size + 8
    assert struct.unpack_from('<I', data, binary - 4)[0] == 0x004E4942
    idle = next(a for a in gltf['animations'] if a['name'] == 'idle')
    preset = json.loads(Path(__file__).with_name('pilot-idle-arms.json').read_text())
    other_outputs = {s['output'] for a in gltf['animations'] if a is not idle for s in a['samplers']}

    def region(index, components):
        accessor = gltf['accessors'][index]
        assert accessor['componentType'] == 5126 and 'sparse' not in accessor
        assert accessor['type'] == ('SCALAR' if components == 1 else 'VEC4')
        view = gltf['bufferViews'][accessor['bufferView']]
        assert view['buffer'] == 0 and view.get('byteStride', 4 * components) == 4 * components
        return binary + view.get('byteOffset', 0) + accessor.get('byteOffset', 0), accessor['count']

    changed = set()
    for channel in idle['channels']:
        node = gltf['nodes'][channel['target']['node']]
        name = node.get('name')
        if channel['target']['path'] != 'rotation' or name not in preset['bones']:
            continue
        bone = preset['bones'][name]
        assert max(abs(a-b) for a, b in zip(node['rotation'], bone['rest'])) < 1e-4, 'Rig differs from preset'
        sampler = idle['samplers'][channel['sampler']]
        assert sampler.get('interpolation', 'LINEAR') == 'LINEAR'
        assert sampler['output'] not in other_outputs, 'Idle shares output with another animation'
        start, count = region(sampler['input'], 1)
        times = struct.unpack_from('<' + 'f' * count, data, start)
        output, output_count = region(sampler['output'], 4)
        assert count == output_count and times[-1] > times[0]
        # Map the two breathing halves to the original loop duration, closing
        # the arm pose exactly without altering the existing body's timing.
        for i, time in enumerate(times):
            phase = (time-times[0]) / (times[-1]-times[0]) * 2
            segment = min(1, int(phase))
            value = slerp(bone['rotations'][segment], bone['rotations'][segment+1], phase-segment)
            struct.pack_into('<4f', data, output+i*16, *value)
        changed.add(name)
    assert changed == set(preset['bones']), 'Missing idle arm channels'
    path.write_bytes(data)
    print(f'{path}: replaced {len(changed)} idle rotation channels; all other bytes preserved')


if __name__ == '__main__':
    relax(Path(sys.argv[1]))
