"""Original deterministic Meridian Gannet PBR swatches, no external imagery.
System Python/Pillow. These maps contain material response only. Separate short-
range static vertex AO is measured from actual geometry by build_gannet.py.
"""
from pathlib import Path
import hashlib, json, math
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/gannet/textures'
PALETTE = [(216,224,214),(39,51,57),(133,150,153),(22,29,32),
           (42,79,85),(190,139,62),(69,83,81),(151,164,158)]
ROUGH = [.63,.82,.54,.91,.68,.72,.96,.82]
METAL = [.03,.02,.86,.01,.12,.02,0,.02]

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    edge = 1024
    base, orm, normal = (Image.new('RGB',(edge,edge)) for _ in range(3))
    bp, op, np = base.load(), orm.load(), normal.load()
    for y in range(edge):
        for x in range(edge):
            tile=(y//512)*4+x//256
            u,v=(x%256)/255,(y%512)/511
            grain=(((x*73+y*151+(x*y)%191)%17)-8)/8
            edgewear=max(0,1-min(u,1-u,v,1-v)*28)
            # Fine stochastic roughness only. Coherent scanline normals became
            # long visible stripes when projected over metre-scale armor.
            # Geometry supplies the service joints, bevels and relief.
            factor=1+grain*.003-edgewear*.012
            bp[x,y]=tuple(round(max(0,min(255,c*factor))) for c in PALETTE[tile])
            op[x,y]=(255,round((ROUGH[tile]+grain*.006)*255),round(METAL[tile]*255))
            np[x,y]=(128,128,255)
    for name,image in [('surface-basecolor',base),('surface-orm',orm),('surface-normal',normal)]:
        image.save(OUT/(name+'.png'))
        image.save(OUT/(name+'.webp'),lossless=True)
    Image.open(ROOT/'assets/brands/meridian-shipworks/emblem.webp').convert('RGBA').save(OUT/'manufacturer.png')
    files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.iterdir()) if p.suffix in ('.png','.webp')}
    (OUT/'provenance.json').write_text(json.dumps({'source':'Original deterministic procedural PBR swatches; reused approved Meridian emblem only',
        'builder':'blender/gannet_textures.py','layout':'4 columns × 2 rows from PNG top; deterministic face projection, Blender V inverted once, four-pixel margins',
        'size':[edge,edge],'baseColorSpace':'sRGB','dataMaps':'linear ORM and tangent normal',
        'ambientOcclusion':'ORM red is white. Separate geometry-derived static vertex AO is authored by build_gannet.py; moving assemblies remain white.',
        'files':files},indent=2)+'\n')
    print('Gannet source PBR maps generated.')

if __name__=='__main__': build()
