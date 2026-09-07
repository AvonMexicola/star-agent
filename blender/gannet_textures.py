"""Original deterministic Meridian Gannet PBR swatches, no external imagery.
System Python/Pillow. Geometry defines seams and contact; this does not pretend
to be a baked whole-ship ambient-occlusion map.
"""
from pathlib import Path
import hashlib, json, math
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/gannet/textures'
PALETTE = [(216,224,214),(39,51,57),(133,150,153),(22,29,32),
           (42,79,85),(190,139,62),(129,143,137),(167,184,180)]
ROUGH = [.45,.69,.33,.91,.56,.63,.83,.48]
METAL = [.05,.45,.91,.01,.34,.16,.02,.64]

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
            brush=math.sin(y*1.7) if tile in (2,7) else 0
            edgewear=max(0,1-min(u,1-u,v,1-v)*28)
            # Restrained variation: no painted fake seams or baked highlights.
            factor=1+grain*.008+brush*.007-edgewear*.014
            bp[x,y]=tuple(round(max(0,min(255,c*factor))) for c in PALETTE[tile])
            op[x,y]=(255,round((ROUGH[tile]+grain*.014)*255),round(METAL[tile]*255))
            np[x,y]=(128+round(grain),128+round(brush*2),255)
    for name,image in [('surface-basecolor',base),('surface-orm',orm),('surface-normal',normal)]:
        image.save(OUT/(name+'.png'))
        image.save(OUT/(name+'.webp'),lossless=True)
    Image.open(ROOT/'assets/brands/meridian-shipworks/emblem.webp').convert('RGBA').save(OUT/'manufacturer.png')
    files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.iterdir()) if p.suffix in ('.png','.webp')}
    (OUT/'provenance.json').write_text(json.dumps({'source':'Original deterministic procedural PBR swatches; reused approved Meridian emblem only',
        'builder':'blender/gannet_textures.py','layout':'4 columns × 2 rows; deterministic face projection with four-pixel margins',
        'size':[edge,edge],'baseColorSpace':'sRGB','dataMaps':'linear ORM and tangent normal','ambientOcclusion':'white; not a whole-ship bake','files':files},indent=2)+'\n')
    print('Gannet source PBR maps generated.')

if __name__=='__main__': build()
