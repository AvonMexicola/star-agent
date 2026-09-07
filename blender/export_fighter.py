"""Bake, preserve UVs for Meshy, and export the named Kestrel assemblies.

blender -b assets/kestrel/kestrel.blend --python blender/export_fighter.py -- --prepare
blender -b /tmp/kestrel-uv.blend --python blender/export_fighter.py -- --export

The intermediate .blend is local build state. Source geometry and Meshy input
retain a recorded UV hash, so downloaded textures cannot silently remap a hull.
"""
import bpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent;sys.path.insert(0,str(HERE))
import fighter_geometry as g
OUT=ROOT/'assets/kestrel';TEX=OUT/'textures';TEX.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []

def hardpoint_contract(doc):
    """Size and outward mating frames, without moving the protective covers.

    Source empties sit at cover centres. The finished mating plane is the
    underside face, 17 mm lower; local +Y points down and -Z stays forward.
    Child local transforms compensate, leaving every visible vertex unchanged.
    glTF extras can represent an empty installedWeapon as null (Blender ID
    properties cannot), so the final socket metadata is written here.
    """
    contract=json.loads((OUT/'contract.json').read_text())
    def matrix(node):
        if 'matrix' in node:return Matrix([node['matrix'][i::4] for i in range(4)])
        x,y,z,w=node.get('rotation',[0,0,0,1])
        return Matrix.Translation(Vector(node.get('translation',[0,0,0]))) @ Quaternion((w,x,y,z)).to_matrix().to_4x4() @ Matrix.Diagonal(Vector([*node.get('scale',[1,1,1]),1]))
    def assign(node,value):
        for key in ['translation','rotation','scale']:node.pop(key,None)
        node['matrix']=[float(value[row][column]) for column in range(4) for row in range(4)]
    for name in contract['hardpoints']:
        node=next(n for n in doc['nodes'] if n.get('name')==name)
        old=matrix(node)
        turn=Matrix.Diagonal(Vector([-1,-1,1,1]))
        new=old @ Matrix.Translation(Vector((0,-.017,0))) @ turn
        compensation=new.inverted() @ old
        for child in node.get('children',[]):assign(doc['nodes'][child],compensation @ matrix(doc['nodes'][child]))
        assign(node,new)
        node.setdefault('extras',{}).update({'kind':'weapon','size':contract['hardpointSize'],'mount':'fixed','installedWeapon':None,'forward':[0,0,-1],'socketOnly':True})

def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']
def selected(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    if objects:bpy.context.view_layer.objects.active=objects[0]

def bake_targets():
    return [o for o in meshes() if not o.name.startswith(('MFD_','AB_')) and not any(s.material and (s.material.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value<1 or s.material.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value>0) for s in o.material_slots)]

def bake(objects,channel):
    image=bpy.data.images.new('Kestrel '+channel,1024,1024,alpha=False)
    image.generated_color=(.5,.5,1,1) if channel=='normal' else (1,1,1,1) if channel=='ao' else (0,0,0,1)
    image.colorspace_settings.name='sRGB' if channel=='basecolor' else 'Non-Color'
    materials=set(s.material for o in objects for s in o.material_slots if s.material)
    restores=[]
    for mat in materials:
        nt=mat.node_tree;node=nt.nodes.new('ShaderNodeTexImage');node.image=image;node.name='Bake target '+channel;nt.nodes.active=node
        if channel not in ('normal','ao'):
            bs=nt.nodes.get('Principled BSDF');socket=bs.inputs[{'basecolor':'Base Color','roughness':'Roughness','metallic':'Metallic'}[channel]]
            emission=nt.nodes.new('ShaderNodeEmission');emission.name='Temporary export bake'
            if socket.is_linked:nt.links.new(socket.links[0].from_socket,emission.inputs['Color'])
            else:
                value=socket.default_value;emission.inputs['Color'].default_value=tuple(value) if hasattr(value,'__len__') else (value,value,value,1)
            output=nt.nodes.get('Material Output');old=output.inputs['Surface'].links[0].from_socket;nt.links.new(emission.outputs[0],output.inputs['Surface']);restores.append((nt,old,output,emission))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.bake.margin=2;scene.render.bake.use_clear=False;scene.render.bake.use_selected_to_active=False
    selected(objects);print('KESTREL_BAKE '+channel,flush=True)
    bpy.ops.object.bake(type='NORMAL' if channel=='normal' else 'AO' if channel=='ao' else 'EMIT')
    for nt,old,output,emission in restores:nt.links.new(old,output.inputs['Surface']);nt.nodes.remove(emission)
    image.filepath_raw=str(TEX/('procedural-'+channel+'.png'));image.file_format='PNG';image.save()
    return image

def prepare():
    for o in [o for o in bpy.context.scene.objects if o.type=='CURVE']:
        selected([o]);bpy.ops.object.convert(target='MESH')
    for o in meshes():g.apply(o)
    objects=bake_targets();g.unwrap(objects)
    # Stable bytes describe actual vertices, loops and shared packed UV layout.
    layouts=[]
    for o in sorted(objects,key=lambda x:x.name):
        layouts.append({'name':o.name,'vertices':[list(v.co) for v in o.data.vertices],'uv':[list(v.uv) for v in o.data.uv_layers.active.data]})
    digest=hashlib.sha256(json.dumps(layouts,separators=(',',':')).encode()).hexdigest()
    (OUT/'texture-layout.json').write_text(json.dumps({'version':1,'sha256':digest,'objects':len(objects),'coordinates':'UV0, nonoverlapping global smart project, 1024 square'},indent=2)+'\n')
    # Bake one joined duplicate. The UVs/material assignments remain identical,
    # while Cycles avoids rebuilding its bake scene once for every small part.
    duplicates=[]
    for obj in objects:
        o=obj.copy();o.data=obj.data.copy();bpy.context.collection.objects.link(o);o.matrix_world=obj.matrix_world.copy();o.animation_data_clear();duplicates.append(o)
    selected(duplicates);bpy.ops.object.join();upload=bpy.context.object;upload.name='Kestrel_TextureShell'
    world=upload.matrix_world.copy();upload.parent=None;upload.matrix_world=world
    hidden={o:o.hide_render for o in objects}
    for o in objects:o.hide_render=True
    upload.hide_render=False
    images={channel:bake([upload],channel) for channel in ['basecolor','roughness','metallic','normal','ao']}
    for o,value in hidden.items():o.hide_render=value
    # Export one mesh with one material for Meshy's Keep Original Texture and UV.
    mat=bpy.data.materials.new('Kestrel baked appearance');mat.use_nodes=True;nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
    node=nt.nodes.new('ShaderNodeTexImage');node.image=images['basecolor'];nt.links.new(node.outputs['Color'],bs.inputs['Base Color'])
    upload.data.materials.clear();upload.data.materials.append(mat)
    for f in upload.data.polygons:f.material_index=0
    selected([upload]);bpy.ops.export_scene.gltf(filepath=str(OUT/'kestrel-meshy-input.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=True)
    bpy.data.objects.remove(upload,do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath='/tmp/kestrel-uv.blend')
    print('KESTREL_TEXTURE_READY '+digest,flush=True)

def pbr_material():
    mat=bpy.data.materials.new('Kestrel | baked manufactured PBR');mat.use_nodes=True
    nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
    def texture(name,colour):
        image=bpy.data.images.load(str(TEX/name));image.colorspace_settings.name='sRGB' if colour else 'Non-Color';image.pack()
        node=nt.nodes.new('ShaderNodeTexImage');node.image=image;return node
    albedo=texture('kestrel-basecolor.png',True);nt.links.new(albedo.outputs['Color'],bs.inputs['Base Color'])
    orm=texture('kestrel-orm.png',False);sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(orm.outputs['Color'],sep.inputs['Color']);nt.links.new(sep.outputs['Green'],bs.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
    # Exporter's documented occlusion node socket provides glTF's occlusion map.
    group=bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
    if not any(s.name=='Occlusion' for s in group.interface.items_tree):group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    node=nt.nodes.new('ShaderNodeGroup');node.node_tree=group;nt.links.new(sep.outputs['Red'],node.inputs['Occlusion'])
    normal=texture('kestrel-normal.png',False);nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(normal.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    return mat

def export():
    bpy.context.scene.render.fps=30
    objects=bake_targets();mat=pbr_material();root=bpy.data.objects['Kestrel']
    for o in objects:
        o.data.materials.clear();o.data.materials.append(mat)
        for poly in o.data.polygons:poly.material_index=0
    # Batch only rigid geometry under the same transform; preserve all sockets
    # and animated parents, optical surfaces and independently driven meshes.
    owners={'Kestrel','Cockpit','Canopy','Gear_Nose','Gear_L','Gear_R','Ladder','Ladder_Middle','Ladder_Lower','Nozzle_L','Nozzle_R'}
    owners.update(o.name for o in bpy.context.scene.objects if o.animation_data)
    owners.update(o.name for o in bpy.context.scene.objects if o.type=='EMPTY' and o.name.startswith(('HP_','RCS_')))
    batches={}
    cores=[]
    for o in meshes():
        if o.name.startswith(('MFD_','AB_')) or o.name=='HUD_Glass':continue
        if 'deep throat' in o.name:cores.append(o);continue
        parent=o.parent
        while parent is not None and parent.name not in owners:parent=parent.parent
        parent=parent or root
        material=o.data.materials[0] if o.data.materials else None
        batches.setdefault((parent,material),[]).append(o)
    for (owner,material),group in batches.items():
        selected(group);bpy.ops.object.join();obj=bpy.context.object;world=obj.matrix_world.copy();obj.parent=owner;obj.matrix_world=world;obj.name=owner.name+' / '+('PBR' if material==mat else material.name)
    if cores:
        selected(cores);bpy.ops.object.join();core=bpy.context.object;world=core.matrix_world.copy();core.parent=root;core.matrix_world=world;core.name='EngineCores'
    # Keep the default display UVs independent of the shared baked hull atlas.
    for o in meshes():
        if o.name.startswith('MFD_'):o.data.uv_layers.active_index=0
    selected(list(bpy.context.scene.objects))
    output=OUT/'kestrel.glb'
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_image_format='WEBP',export_image_quality=88,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='NLA_TRACK',export_force_sampling=True)
    data=output.read_bytes();import struct
    json_length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_length]);hardpoint_contract(doc)
    payload=json.dumps(doc,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
    remainder=data[20+json_length:]
    data=struct.pack('<4sIII4s',b'glTF',2,20+len(payload)+len(remainder),len(payload),b'JSON')+payload+remainder
    output.write_bytes(data)
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives'])
    manifest={'version':1,'id':'kestrel','source':'blender/build_fighter.py','authoring':'assets/kestrel/kestrel.blend','contract':'assets/kestrel/contract.json','triangles':triangles,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'meshes':len(doc['meshes']),'materials':len(doc['materials']),'textures':len(doc.get('images',[])),'animations':[a['name'] for a in doc.get('animations',[])],'status':'review-candidate'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    bpy.ops.wm.save_as_mainfile(filepath='/tmp/kestrel-runtime.blend')
    print('KESTREL_MANIFEST '+json.dumps(manifest),flush=True)
    if triangles>60000 or len(data)>4000000:raise RuntimeError('Kestrel exceeds its hard ship budget')

if '--prepare' in ARGS:prepare()
if '--export' in ARGS:export()
