"""Original manufactured-surface atlas; Python 3 + Pillow. No image inputs.

Colour is sRGB, ORM/normal are linear. Relief is an independently defined height
field, not a conversion of colour or baked lighting. Six-pixel tile gutters.
"""
from pathlib import Path
import hashlib, json, math, random, subprocess
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / 'textures'
OUT.mkdir(exist_ok=True)
N, T, SEED = 1024, 256, 7291
palette = [(204,213,205),(132,148,153),(42,53,57),(23,29,31),
           (57,107,104),(203,149,62),(78,94,102),(174,187,178)]
roughness = [.56,.31,.68,.88,.52,.59,.38,.65]
metalness = [.08,.91,.04,.01,.13,.08,.85,.16]
base, orm, normal = [Image.new('RGB',(N,N)) for _ in range(3)]
bp, op, np = base.load(), orm.load(), normal.load()
rng = random.Random(SEED)
grain_tile = [[rng.choice([-.7,0,0,.7]) for _ in range(32)] for _ in range(32)]
for tile in range(12):
    kind = tile % 8
    ox, oy = tile % 4*T, tile // 4*T
    # Quantized low-amplitude grain compresses well and stays quiet at use scale.
    h = [[0.] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            u,v = min(249,max(6,x)), min(249,max(6,y))
            grit = grain_tile[v%32][u%32]
            brush = math.sin(v*1.41)*.35 if kind in (1,6) else 0
            rubber = (math.sin(u*.55)*math.sin(v*.55))*.6 if kind==3 else 0
            h[y][x] = grit*.12 + brush + rubber
            factor = 1+grit*.014+brush*.022
            bp[ox+x,oy+y] = tuple(round(c*factor) for c in palette[kind])
            op[ox+x,oy+y] = (255,round(255*(roughness[kind]+grit*.018+brush*.014)),round(255*metalness[kind]))
    # Short contact scuffs: deliberately sparse, not a uniform dirt overlay.
    draw=ImageDraw.Draw(base)
    for i in range(8 if kind in (0,4,5,7) else 3):
        x,y=rng.randrange(15,220),rng.randrange(15,240)
        length=rng.randrange(4,15)
        draw.line((ox+x,oy+y,ox+x+length,oy+y+1), fill=tuple(min(255,c+13) for c in palette[kind]),width=1)
        for xx in range(x,min(250,x+length)):h[y][xx] -= .23
    for y in range(T):
        for x in range(T):
            dx=(h[y][min(T-1,x+1)]-h[y][max(0,x-1)])*.10
            dy=(h[min(T-1,y+1)][x]-h[max(0,y-1)][x])*.10
            inv=1/math.sqrt(1+dx*dx+dy*dy)
            np[ox+x,oy+y]=(round(127.5*(1-dx*inv)),round(127.5*(1+dy*inv)),round(127.5*(1+inv)))

font_path=subprocess.check_output(['fc-match','-f','%{file}','JetBrains Mono']).decode()
font=lambda n:ImageFont.truetype(font_path,n)
names=[('LR / 05','LASER CARBINE','COLLIMATED ENERGY'),('P / 03','ENERGY SIDEARM','SEALED POWER CELL'),
       ('MC / 08','MINERAL CUTTER','CAUTION / HOT OPTICS'),('TB / 64','CARGO TRACTOR','STANDARD BOX UNIT')]
for i,(code,title,detail) in enumerate(names):
    x,y=i*T,3*T
    d=ImageDraw.Draw(base)
    d.rectangle((x,y,x+255,y+255),fill=(28,42,44))
    d.rectangle((x+7,y+7,x+248,y+248),outline=(113,146,138),width=2)
    d.text((x+19,y+67),code,font=font(35),fill=(206,227,213))
    d.line((x+19,y+111,x+235,y+111),fill=(183,216,197),width=3)
    d.text((x+19,y+124),title,font=font(18),fill=(202,217,207))
    d.text((x+19,y+154),detail,font=font(11),fill=(170,185,178))
    for j in range(46):
        if (j*7)%11<6:d.rectangle((x+19+j*3,y+180,x+20+j*3,y+203),fill=(151,176,164))
    d.text((x+169,y+180),'SA',font=font(24),fill=(203,219,210))
    ImageDraw.Draw(orm).rectangle((x,y,x+255,y+255),fill=(255,160,20))
    ImageDraw.Draw(normal).rectangle((x,y,x+255,y+255),fill=(128,128,255))
records={}
for name,im in [('basecolor',base),('orm',orm),('normal',normal)]:
    im.save(OUT/f'{name}.png')
    # Normal and material channels retain exact values. Colour may use WebP's
    # high-quality transform; source remains lossless and independently editable.
    im.save(OUT/f'{name}.webp',lossless=name!='basecolor',quality=92,method=6)
    p=OUT/f'{name}.webp'
    records[p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(OUT/'provenance.json').write_text(json.dumps({'source':'Original procedural authored PBR and deterministic labels',
 'builder':'assets/handheld-tools/textures.py','seed':SEED,'size':[N,N],
 'font':'JetBrains Mono (system font, rendered labels only)',
 'colorSpace':{'basecolor':'sRGB','orm':'linear occlusion/roughness/metalness','normal':'linear OpenGL tangent +Y'},
 'files':records},indent=2)+'\n')
print(json.dumps(records))
