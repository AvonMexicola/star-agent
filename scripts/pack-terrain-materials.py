"""Pack downloaded ambientCG 1K-JPG archives into two opaque 512px-layer atlases.

Usage: python3 scripts/pack-terrain-materials.py /path/to/archives
Requires ImageMagick 7; uses only Python's standard library. No runtime tools needed.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/materials/terrain'
SOURCES = [('Ground048', 'soil'), ('Rock030', 'cliff'), ('Ground037', 'moss'), ('Ground054', 'sand'), ('Grass004', 'grass'), ('Ground028', 'leaf-litter'), ('Gravel001', 'gravel'), ('Snow010A', 'snow')]


def magick(*args):
    subprocess.run(['magick', *map(str, args)], check=True)


def pack(archives):
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    with tempfile.TemporaryDirectory(prefix='terrain-pack-') as directory:
        temp = Path(directory)
        colors, normals = [], []
        for asset, role in SOURCES:
            archive = archives / f'{asset}.zip'
            with zipfile.ZipFile(archive) as source:
                # Extract only the known maps, never paths supplied by an archive.
                paths = {}
                for channel in ['Color', 'NormalGL', 'Roughness']:
                    name = f'{asset}_1K-JPG_{channel}.jpg'
                    paths[channel] = temp / name
                    if name in source.namelist():
                        paths[channel].write_bytes(source.read(name))
                    elif channel == 'Roughness' and asset == 'Gravel001':
                        # This source supplies no roughness map. Use a declared
                        # matte scalar, not a fabricated photographic channel.
                        magick('-size', '1024x1024', 'xc:gray(94%)', paths[channel])
                    else:
                        raise ValueError(f'Missing source map: {name}')
            color, normal = temp / f'{role}-color.png', temp / f'{role}-normal.png'
            magick(paths['Color'], '-resize', '512x512!', '-strip', '-define', 'png:color-type=2', color)
            # RG = OpenGL normal XY, B = linear roughness. Z is reconstructed.
            # Keep alpha opaque: canvas decoding must not premultiply material data.
            magick('(', paths['NormalGL'], '-resize', '512x512!', '-channel', 'R', '-separate', ')',
                   '(', paths['NormalGL'], '-resize', '512x512!', '-channel', 'G', '-separate', ')',
                   '(', paths['Roughness'], '-resize', '512x512!', '-colorspace', 'Gray', ')',
                   '-channel', 'RGB', '-combine', '-strip', '-define', 'png:color-type=2', normal)
            colors.append(color)
            normals.append(normal)
            records.append({'id': asset, 'role': role, 'source': f'https://ambientcg.com/a/{asset}',
                            'download': f'https://ambientcg.com/get?file={asset}_1K-JPG.zip',
                            'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                            **({'roughnessFallback': .94} if asset == 'Gravel001' else {})})
        for name, layers in [('albedo', colors), ('normal-roughness', normals)]:
            magick(*layers, '-append', '-strip', '-define', 'png:color-type=2', OUT / f'{name}.png')
    manifest = {'license': 'CC0-1.0', 'licenseUrl': 'https://docs.ambientcg.com/license/',
                'author': 'ambientCG / Lennart Demes', 'layerSize': 512,
                'layers': records, 'packing': {'albedo.png': 'sRGB RGB; opaque',
                    'normal-roughness.png': 'linear OpenGL normal XY in RG, roughness in B; opaque'},
                'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                          for p in sorted(OUT.glob('*.png'))}}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest['files'], indent=2))


if __name__ == '__main__':
    pack(Path(sys.argv[1]))
