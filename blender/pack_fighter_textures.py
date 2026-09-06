"""Pack Blender's measured material channels into the glTF ORM convention.
Run with Blender's Python, before export_fighter.py --export.
"""
from pathlib import Path
import bpy
import numpy as np
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parent.parent
TEX=ROOT/'assets/kestrel/textures'

def pack():
    base=TEX/'meshy-basecolor.png' if (TEX/'meshy-basecolor.png').exists() else TEX/'procedural-basecolor.png'
    normal=TEX/'meshy-normal.png' if (TEX/'meshy-normal.png').exists() else TEX/'procedural-normal.png'
    rough=TEX/'meshy-roughness.png' if (TEX/'meshy-roughness.png').exists() else TEX/'procedural-roughness.png'
    metal=TEX/'meshy-metallic.png' if (TEX/'meshy-metallic.png').exists() else TEX/'procedural-metallic.png'
    def read(p):
        image=bpy.data.images.load(str(p));image.colorspace_settings.name='Non-Color'
        if list(image.size)!=[1024,1024]:image.scale(1024,1024)
        return image
    def save(image,path):image.filepath_raw=str(path);image.file_format='PNG';image.save()
    save(read(base),TEX/'kestrel-basecolor.png');save(read(normal),TEX/'kestrel-normal.png')
    pixels=np.ones((1024*1024,4),dtype=np.float32)
    for channel,path in enumerate([TEX/'procedural-ao.png',rough,metal]):
        source=read(path);data=np.empty(1024*1024*4,dtype=np.float32);source.pixels.foreach_get(data);pixels[:,channel]=data.reshape(-1,4)[:,0]
    orm=bpy.data.images.new('Kestrel ORM',1024,1024,alpha=False);orm.colorspace_settings.name='Non-Color';orm.pixels.foreach_set(pixels.reshape(-1));save(orm,TEX/'kestrel-orm.png')
    files={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in [base,normal,rough,metal,TEX/'procedural-ao.png']}
    layout=json.loads((TEX.parent/'texture-layout.json').read_text())['sha256']
    (TEX/'provenance.json').write_text(json.dumps({'version':1,'uvLayoutSha256':layout,'basecolorSource':'Meshy' if base.name.startswith('meshy') else 'Blender procedural only — Meshy pending','packedChannels':{'R':'Blender contact AO','G':rough.name,'B':metal.name},'resolution':[1024,1024],'sources':files},indent=2)+'\n')

if __name__=='__main__':pack()
