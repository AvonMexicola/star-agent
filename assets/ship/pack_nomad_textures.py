"""Compose UV-verified generated wear with the authored Nomad material regions.

blender -b assets/ship/nomad.blend --python-exit-code 1 --python assets/ship/pack_nomad_textures.py
Use -- --prepare to export source atlases after checking the upload's UV signature.
Only material images change. Hull topology, cabin, pivots and UVs are retained.
"""
from pathlib import Path
import hashlib
import json
import sys
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from clean_meshy_upload import verify_chain
from nomad_texture_layout import layout_signature, require_signature

ROOT=Path(__file__).resolve().parents[2]
TEX=ROOT/'assets/ship/textures'
SIZE=1024
# The source metallic atlas preserves the builder's distinct material values.
# Decode that authored ownership, then give the material its actual finish.
FINISHES={
    'ivory paint':(.48,.43,.07,.27),
    'petrol paint':(.50,.44,.05,.23),
    'titanium structure':(.65,.43,.72,.40),
    'machined alloy':(.80,.29,.88,.48),
    'orange marking':(.28,.46,.03,.12),
    'rubber':(.05,.86,.01,.12),
}

def pixels(image):
    data=np.empty(SIZE*SIZE*4,dtype=np.float32);image.pixels.foreach_get(data)
    return data.reshape(SIZE,SIZE,4)[:,:,:3]

def read(path):
    image=bpy.data.images.load(str(path),check_existing=False);image.colorspace_settings.name='Non-Color'
    if list(image.size)!=[SIZE,SIZE]:raise ValueError('Expected a 1024px derivative: '+str(path))
    data=pixels(image);bpy.data.images.remove(image);return data

def save(data,path):
    rgba=np.ones((SIZE,SIZE,4),dtype=np.float32);rgba[:,:,:3]=np.clip(data,0,1)
    image=bpy.data.images.new(path.stem,SIZE,SIZE,alpha=False);image.colorspace_settings.name='Non-Color'
    image.pixels.foreach_set(rgba.reshape(-1));image.filepath_raw=str(path);image.file_format='PNG';image.save();bpy.data.images.remove(image)

def linear(v):return np.where(v<=.04045,v/12.92,((v+.055)/1.055)**2.4)
def encoded(v):return np.where(v<=.0031308,12.92*v,1.055*np.maximum(v,0)**(1/2.4)-.055)

def box_mean(values,radius=3):
    out=values;width=radius*2+1
    for axis in (0,1):
        pads=[(0,0)]*out.ndim;pads[axis]=(radius,radius)
        extended=np.pad(out,pads,mode='edge');pads[axis]=(1,0)
        summed=np.pad(extended.cumsum(axis=axis,dtype=np.float64),pads)
        upper=[slice(None)]*out.ndim;lower=upper.copy();upper[axis]=slice(width,None);lower[axis]=slice(None,-width)
        out=(summed[tuple(upper)]-summed[tuple(lower)])/width
    return out.astype(np.float32)

def prepare():
    TEX.mkdir(parents=True,exist_ok=True)
    record_path=ROOT/'assets/ship/texture-layout.json';record=json.loads(record_path.read_text());signature=layout_signature()
    require_signature(record,signature)
    for area in ['hull','cabin']:
        for channel,ending in [('basecolor','albedo'),('orm','roughness-metalness')]:
            path=TEX/f'procedural-{area}-{channel}.png'
            # Re-extract the untouched original bake, even after a finish export.
            image=bpy.data.images.get(f'{area} / {ending}')
            if not image:raise ValueError('Missing original baked image: '+ending)
            image.filepath_raw=str(path);image.file_format='PNG';image.save()
    return record

def compose(original,orm,generated,generated_orm,generated_normal):
    base=linear(original);result=base.copy();packed=orm.copy();normal=np.dstack((np.zeros((SIZE,SIZE,2)),np.ones((SIZE,SIZE))))
    luma=np.sum(linear(generated)*np.array([.2126,.7152,.0722]),axis=2)
    ids=np.argmin(np.stack([abs(orm[:,:,2]-finish[0]) for finish in FINISHES.values()]),axis=0)
    counts={}
    for index,(name,(_,rough,metal,strength)) in enumerate(FINISHES.items()):
        mask=ids==index;counts[name]=int(mask.sum());weight=mask.astype(np.float32)
        mean=box_mean(luma*weight)/np.maximum(box_mean(weight),1e-5)
        detail=np.clip((luma-mean)/np.maximum(mean,.04),-.35,.18)
        amount=.34 if 'paint' in name else .42
        if name=='orange marking':amount=.10
        result[mask]=(base*(1+amount*detail[:,:,None]))[mask]
        packed[:,:,1][mask]=np.clip(rough+.20*(generated_orm[:,:,1]-.5),rough-.08,rough+.08)[mask]
        packed[:,:,2][mask]=np.clip(metal+.12*(generated_orm[:,:,2]-.5),max(0,metal-.05),min(1,metal+.05))[mask]
        direction=generated_normal*2-1;direction[:,:,:2]*=strength
        direction/=np.maximum(np.linalg.norm(direction,axis=2,keepdims=True),1e-6)
        normal[mask]=direction[mask]
    return encoded(result),packed,normal*.5+.5,counts

def finish_cabin():
    """Original low-amplitude woven cloth, with dielectric painted cabin panels.

    This is authored atlas detail, not generated cabin art or a height inferred
    from lighting. The original bake's metallic/roughness regions select cloth.
    """
    base=read(TEX/'procedural-cabin-basecolor.png');orm=read(TEX/'procedural-cabin-orm.png')
    cloth=(orm[:,:,2]<.04)&(orm[:,:,1]>.80)
    paint=(abs(orm[:,:,2]-.48)<.007)|(abs(orm[:,:,2]-.50)<.007)
    yy,xx=np.mgrid[:SIZE,:SIZE];u=xx*np.pi/2;v=yy*np.pi/2
    woven=np.stack((.10*np.sin(u),.10*np.sin(v),np.ones_like(u)),axis=2)
    woven/=np.linalg.norm(woven,axis=2,keepdims=True)
    normal=np.dstack((np.zeros((SIZE,SIZE,2)),np.ones((SIZE,SIZE))))
    normal[cloth]=woven[cloth]
    orm[:,:,1][cloth]=np.clip(.94+.025*np.cos(u)*np.cos(v),0,1)[cloth]
    orm[:,:,2][paint]=.06;orm[:,:,1][paint]=np.maximum(.44,orm[:,:,1][paint])
    save(base,TEX/'nomad-cabin-basecolor.png');save(orm,TEX/'nomad-cabin-orm.png');save(normal*.5+.5,TEX/'nomad-cabin-normal.png')
    attach('cabin',TEX/'nomad-cabin-basecolor.png',TEX/'nomad-cabin-orm.png',TEX/'nomad-cabin-normal.png')
    return {'source':'Original procedural bake and authored woven tangent normal','wovenPixels':int(cloth.sum()),'paintPixels':int(paint.sum()),'normalAmplitude':.10}

def attach(area,base,orm,normal):
    mat=bpy.data.materials[f'Nomad / {area} manufactured PBR'];nodes,links=mat.node_tree.nodes,mat.node_tree.links;p=nodes.get('Principled BSDF')
    for node in list(nodes):
        if node.get('nomadFinish'):
            image=node.image if node.type=='TEX_IMAGE' else None
            nodes.remove(node)
            if image and image.users==0:bpy.data.images.remove(image)
    def owned(kind):
        node=nodes.new(kind);node['nomadFinish']=True;return node
    def texture(path,space):
        image=bpy.data.images.load(str(path),check_existing=False);image.colorspace_settings.name=space;image.pack()
        node=owned('ShaderNodeTexImage');node.image=image;return node
    colour=texture(base,'sRGB');links.new(colour.outputs['Color'],p.inputs['Base Color'])
    packed=texture(orm,'Non-Color');sep=owned('ShaderNodeSeparateColor');sep.mode='RGB';links.new(packed.outputs['Color'],sep.inputs[0]);links.new(sep.outputs[1],p.inputs['Roughness']);links.new(sep.outputs[2],p.inputs['Metallic'])
    if normal:
        tex=texture(normal,'Non-Color');node=owned('ShaderNodeNormalMap');node.inputs['Strength'].default_value=1;links.new(tex.outputs['Color'],node.inputs['Color']);links.new(node.outputs['Normal'],p.inputs['Normal'])
    mat['finish']='Authored colour/material ownership with UV-verified Meshy microdetail' if area=='hull' else 'Original baked cabin finish with authored woven normal'

def pack():
    layout=json.loads((TEX.parent/'texture-layout.json').read_text())
    chain=verify_chain(TEX.parent/layout['upload'],TEX.parent/'nomad-meshy-clean.glb',layout)
    source=json.loads((TEX/'meshy-source/source.json').read_text())
    if any(source[key]!=chain[value] for key,value in [('uvLayoutSha256','uvLayoutSha256'),('uploadSha256','cleanUploadSha256'),('originalUploadSha256','originalUploadSha256')]):
        raise ValueError('Imported maps belong to a different painting upload/layout')
    for path_key,hash_key in [('prompt','promptSha256'),('jobMetadata','jobMetadataSha256')]:
        if hashlib.sha256((TEX/'meshy-source'/source[path_key]).read_bytes()).hexdigest()!=source[hash_key]:
            raise ValueError('Imported prompt/job provenance changed: '+path_key)
    for name,record in source['sourceMaps'].items():
        if hashlib.sha256((TEX/'meshy-source'/name).read_bytes()).hexdigest()!=record['sha256']:
            raise ValueError('Raw generated source map changed: '+name)
    for name,expected in source['derivatives'].items():
        if hashlib.sha256((TEX/name).read_bytes()).hexdigest()!=expected:
            raise ValueError('Imported texture derivative changed: '+name)
    layout=prepare()
    original=read(TEX/'procedural-hull-basecolor.png');orm=read(TEX/'procedural-hull-orm.png')
    generated=read(TEX/'meshy-basecolor.png');generated_orm=np.dstack((np.ones((SIZE,SIZE)),read(TEX/'meshy-roughness.png')[:,:,0],read(TEX/'meshy-metallic.png')[:,:,0]));normal=read(TEX/'meshy-normal.png')
    base,packed,normal,counts=compose(original,orm,generated,generated_orm,normal)
    for channel,data in [('basecolor',base),('orm',packed),('normal',normal)]:save(data,TEX/f'nomad-hull-{channel}.png')
    attach('hull',TEX/'nomad-hull-basecolor.png',TEX/'nomad-hull-orm.png',TEX/'nomad-hull-normal.png')
    cabin=finish_cabin()
    if layout_signature()!=layout['blenderHullLayoutSha256']:raise ValueError('Material import modified geometry or UVs')
    identity=json.loads((ROOT/'assets/ship/identity.json').read_text())
    maker=json.loads((ROOT/f'assets/brands/{identity["manufacturer"]}/identity.json').read_text())
    bpy.context.scene['shipIdentity']={**identity,'manufacturerName':maker['name']}
    files={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in TEX.glob('*.png')}
    (TEX/'provenance.json').write_text(json.dumps({'version':1,'uvLayoutSha256':layout['uvSha256'],'blenderHullLayoutSha256':layout['blenderHullLayoutSha256'],
        'recipe':'assets/ship/pack_nomad_textures.py','sourceMaps':'meshy-source/','runtimeResolution':[SIZE,SIZE],
        'sourceRecordSha256':hashlib.sha256((TEX/'meshy-source/source.json').read_bytes()).hexdigest(),
        'basecolor':'Authored colour regions plus high-pass generated wear; broad generated shading removed',
        'orm':{'R':'Original bake (1)','G':'Authored material roughness plus bounded generated variation','B':'Authored material metalness plus bounded generated variation'},
        'normal':'UV-verified Meshy tangent normal; strength depends on authored material',
        'sourceMaterialFactors':source['materialContract'],
        'materialRegions':counts,'parameters':FINISHES,'cabin':cabin,'geometryAndUVs':'unchanged','files':files},indent=2)+'\n')
    print('NOMAD_TEXTURE_PACK '+json.dumps({'regions':counts,'source':source['sourceSha256'],'uv':layout['uvSha256']}),flush=True)

if __name__=='__main__':
    if '--prepare' in sys.argv:print(json.dumps(prepare(),indent=2))
    else:
        pack()
        from pack_nomad import publish
        report=publish(ROOT,
            lambda path:bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_image_format='WEBP',export_image_quality=88,export_yup=True,export_apply=True,export_extras=True),
            lambda path:bpy.ops.wm.save_as_mainfile(filepath=str(path),copy=True,relative_remap=False))
        print(json.dumps(report,indent=2))
