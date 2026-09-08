"""Deterministic industrial yellow and exact labels on the existing authored PBR atlas.
The user reference informs geometry/palette; it is never projected onto the tool.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import shutil,subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/field-cutter/textures'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'assets/handheld-tools/textures'
im=Image.open(SOURCE/'basecolor.png').convert('RGB')
# Tile 5 is the powder-coated ochre finish. Preserve its existing surface variation.
px=im.load()
for y in range(256,512):
    for x in range(256,512):
        r,g,b=px[x,y];variation=(r+g+b)/3
        px[x,y]=(min(255,int(variation*.55+135)),min(255,int(variation*.45+84)),min(255,int(variation*.22+18)))
draw=ImageDraw.Draw(im)
fontpath=subprocess.check_output(['fc-match','-f','%{file}','JetBrains Mono'],text=True)
font=lambda size:ImageFont.truetype(fontpath,size)
draw.rectangle((512,768,767,1023),fill=(39,45,48))
draw.text((532,854),'K-17',font=font(32),fill=(199,205,201))
draw.text((533,894),'FIELD CUTTER / MK 1',font=font(13),fill=(161,170,168))
draw.line((534,920,736,920),fill=(187,143,53),width=4)
im.save(OUT/'basecolor.png');im.save(OUT/'basecolor.webp',quality=90,method=6)
for kind in ['orm','normal']:
    for ext in ['png','webp']:shutil.copyfile(SOURCE/f'{kind}.{ext}',OUT/f'{kind}.{ext}')
record={'builder':'assets/field-cutter/textures.py','source':'Original handheld atlas; bounded yellow recolour and deterministic new print',
    'reference':'User supplied mining-tool-mk1.png informs appearance only','font':Path(fontpath).name,'fontFamily':'JetBrains Mono','size':1024,
    'channels':{'basecolor':'sRGB','orm':'linear; G roughness/B metallic','normal':'linear OpenGL +Y'},
    'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.suffix in ['.png','.webp']}}
(OUT/'provenance.json').write_text(json.dumps(record,indent=2)+'\n')
