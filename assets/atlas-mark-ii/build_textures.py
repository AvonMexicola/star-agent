"""Reproducible material derivatives. Albedo sources: built-in imagegen.
Normals/ORM are authored independently from periodic microstructure, never
inferred from the lighting or brightness of the generated colour image.
"""
from pathlib import Path
import subprocess, struct, zlib, json, hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(__file__).resolve().parent/'textures'
OUT=ROOT/'public/textures/atlas-mark-ii'
OUT.mkdir(parents=True,exist_ok=True)
N=1024

def png(path, rgb):
    def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    raw=b''.join(b'\x00'+row.tobytes() for row in rgb.astype(np.uint8))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',N,N,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))

for name in ['ceramic','deck']:
    subprocess.run(['magick',str(SOURCE/f'{name}-albedo-source.png'),'-resize',f'{N}x{N}!','-strip',str(OUT/f'{name}-albedo.png')],check=True)

rng=np.random.default_rng(7291)
f=np.fft.fftfreq(N)
fx,fy=np.meshgrid(f,f)
for name,rough,metal,amplitude in [('ceramic',.43,.06,.018),('deck',.69,.16,.055),('steel',.32,1,.024),('cloth',.9,0,.10)]:
    # Periodic filtered noise, no geometric panel line pretence in colour maps.
    spectrum=np.fft.fft2(rng.normal(size=(N,N)))
    radius=np.sqrt(fx*fx+fy*fy)
    height=np.fft.ifft2(spectrum*np.exp(-(radius/.14)**2)).real
    height=(height-height.mean())/height.std()
    if name=='steel':height+=.28*np.sin(2*np.pi*np.arange(N)[None,:]*192/N)
    if name=='cloth':
        u=np.arange(N)[None,:];v=np.arange(N)[:,None]
        height=.15*height+np.sin(2*np.pi*u*128/N)*np.cos(2*np.pi*v*128/N)
    dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*amplitude
    dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*amplitude
    normal=np.stack((-dx,dy,np.ones_like(dx)),axis=2)
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    png(OUT/f'{name}-normal.png',np.clip((normal*.5+.5)*255,0,255))
    orm=np.stack((np.ones_like(height),np.clip(rough+height*.025,.05,1),np.full_like(height,metal)),axis=2)
    png(OUT/f'{name}-orm.png',np.clip(orm*255,0,255))
manifest={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions':[N,N]} for p in sorted(OUT.glob('*.png'))}
(SOURCE/'derivatives.json').write_text(json.dumps({'seed':7291,'method':'periodic independent microheight normals; authored roughness/metallic; ImageMagick albedo resize','files':manifest},indent=2)+'\n')
print(json.dumps(manifest,indent=2))
