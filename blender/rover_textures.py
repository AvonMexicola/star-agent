"""Original deterministic PBR swatches for Meridian's Burrow mining rover.

Run with system Python/Pillow before build_mining_rover.py. These are generated
materials, not borrowed photographs or a model-painting service.
"""
from pathlib import Path
import hashlib
import json
import math
import random
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mining-rover/textures'
OUT.mkdir(parents=True, exist_ok=True)
Image.open(ROOT/'assets/brands/meridian-shipworks/emblem.webp').convert('RGBA').save(OUT/'manufacturer.png')
EDGE = 1024
# Ivory ceramic, graphite housing, steel, recessed rubber, petrol, ochre.
PALETTE = [(218, 216, 204), (43, 54, 57), (134, 148, 150),
           (20, 27, 30), (46, 72, 80), (184, 137, 56), (159, 169, 162), (80, 88, 88)]
ROUGH = [.48, .81, .48, .9, .58, .65, .46, .74]
METAL = [.08, .08, .78, .02, .16, .16, .72, .5]
rng = random.Random(7291)
base = Image.new('RGB', (EDGE, EDGE))
orm = Image.new('RGB', (EDGE, EDGE))
normal = Image.new('RGB', (EDGE, EDGE))
bp, op, np = base.load(), orm.load(), normal.load()
for y in range(EDGE):
    for x in range(EDGE):
        tile = (y // 256) * 2 + x // 512
        u, v = (x % 512) / 511, (y % 256) / 255
        grain = rng.uniform(-1, 1)
        brush = math.sin(y * 2.19 + math.sin(x * .03)) if tile in (2, 6) else 0
        # Sparse directional scuffs and restrained edge handling variation.
        # Grain stays below the panel scale; periodic diagonal lines become
        # distracting stripes when a small swatch is stretched across a face.
        scuff = 0
        edge = max(0, 1 - min(u, 1-u, v, 1-v) * 22)
        weave = .024 * (math.sin(x * 1.57) * math.sin(y * 1.57)) if tile == 3 else 0
        factor = 1 + weave + grain * .018 + brush * .018 - edge * .035 + scuff * .045
        bp[x, y] = tuple(max(0, min(255, round(c * factor))) for c in PALETTE[tile])
        rough = max(.05, min(.98, ROUGH[tile] + grain * .025 - scuff * .07))
        op[x, y] = (255, round(rough * 255), round(METAL[tile] * 255))
        np[x, y] = (round(128 + grain * 2), round(128 + brush * 3), 255)
for name, image in [('surface-basecolor', base), ('surface-orm', orm), ('surface-normal', normal)]:
    image.save(OUT / (name + '.png'))
    image.save(OUT / (name + '.webp'), lossless=True)
records = {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
           for p in sorted(OUT.glob('*')) if p.suffix in ('.png', '.webp')}
(OUT / 'provenance.json').write_text(json.dumps({
    'source': 'Original deterministic procedural material swatches; no external imagery',
    'builder': 'blender/rover_textures.py', 'seed': 7291, 'size': [EDGE, EDGE],
    'baseColorSpace': 'sRGB', 'dataMaps': 'linear ORM and tangent-space normal',
    'files': records}, indent=2) + '\n')
print('Generated original rover PBR maps.')
