"""Read GLB metadata and calculate proposed voxel budgets; no asset conversion.
Usage: python3 scripts/research/audit-mining-assets.py /path/to/props
Counts are stored mesh geometry, not scene-instance totals or topology validation.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

root = Path(sys.argv[1])
assets = []
for name in ['boulder-cracked', 'boulder-layered', 'rock-arch', 'crystal-cluster']:
    path = root / (name + '.glb')
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20+size])
    triangles = 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4, 'only triangle lists counted'
            accessor = primitive.get('indices', primitive['attributes']['POSITION'])
            triangles += doc['accessors'][accessor]['count'] // 3
    assets.append(dict(name=name, bytes=len(data), storedMeshTriangles=triangles,
                       materials=len(doc.get('materials', [])),
                       sha256=hashlib.sha256(data).hexdigest(),
                       topologyValidated=False))
report = dict(assets=assets, calculations=dict(
    cellsPerChunk=32**3, cornerSamples=33**3,
    densityFloat32Bytes=33**3*4, materialUint8PerCellBytes=32**3,
    densityAndMaterialKiB=(33**3*4+32**3)/1024,
    densityWithOneSampleHaloAndMaterialKiB=(35**3*4+32**3)/1024,
    denseOneKmCubeAtQuarterMetreDensityGB=(1000/.25)**3*4/1e9),
    note='Arithmetic and GLB metadata only; no runtime mining benchmark or topology test.')
print(json.dumps(report, indent=2))
