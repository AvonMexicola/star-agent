"""Finalize/re-export the packed Atlas authoring scene without rebuilding geometry.
Run: blender -b assets/atlas-mark-ii/atlas-mark-ii.blend --python assets/atlas-mark-ii/export_atlas.py
"""
import bpy,json,hashlib,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
import geo as g

def export_asset():
    ship=bpy.data.objects['AtlasMarkII']
    # At this point meshes have their final parent/material batch transforms.
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':g.uv_metres(obj)
    for image in bpy.data.images:
        if image.source=='FILE':image.pack()
    # Mark the complete authoring collection; QA inspection can isolate its groups.
    ship['assetVersion']=1;ship['lengthMetres']=64;ship['design']='original heavy logistics / Atlas Mark II';ship['status']='review-candidate'
    output=ROOT/'public/models/atlas-mark-ii';output.mkdir(exist_ok=True,parents=True)
    # Open the authoring file at a useful whole-ship scale.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.clip_end=1000
                area.spaces.active.region_3d.view_distance=85
                area.spaces.active.region_3d.view_location=(0,0,7)
                area.spaces.active.shading.color_type='MATERIAL'
    print('ATLAS: saving Blender source', flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'atlas-mark-ii.blend'))

    def stats():
        bpy.context.view_layer.update()
        lo=[float('inf')]*3;hi=[-float('inf')]*3;triangles=0;meshes=0
        for o in bpy.context.scene.objects:
            if o.type!='MESH':continue
            meshes+=1;dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);mesh=ev.to_mesh();mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles)
            for v in mesh.vertices:
                p=o.matrix_world@v.co;p=(p.x,p.z,-p.y)
                for a in range(3):lo[a]=min(lo[a],p[a]);hi[a]=max(hi[a],p[a])
            ev.to_mesh_clear()
        return {'triangles':triangles,'meshes':meshes,'bounds':{'min':lo,'max':hi}}

    manifest={'version':1,'source':'assets/atlas-mark-ii/build_atlas.py','layout':'assets/atlas-mark-ii/layout.json','lods':[]}
    texture_nodes=[n for mat in bpy.data.materials if mat.use_nodes for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
    full_images={n:n.image for n in texture_nodes}
    # The authoring scene multiplies ContactAO in its shader. glTF applies
    # COLOR_0 itself, so export the original PBR base colour and the explicit
    # named attribute. This avoids both double shading and node-parser fallbacks
    # that otherwise discard constant material factors in Blender 5.2.
    restore=[]
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        p=mat.node_tree.nodes.get('Principled BSDF')
        if not p:continue
        socket=p.inputs['Base Color']
        if not socket.is_linked:continue
        multiply=socket.links[0].from_node
        if multiply.type!='MIX_RGB' or multiply.blend_type!='MULTIPLY':continue
        colour=multiply.inputs[2]
        if not colour.is_linked or colour.links[0].from_node.name!='Authored contact shading':continue
        source=multiply.inputs[1]
        restore.append((mat,socket,multiply.outputs[0],tuple(socket.default_value)))
        mat.node_tree.links.remove(socket.links[0])
        if source.is_linked:mat.node_tree.links.new(source.links[0].from_socket,socket)
        else:socket.default_value=source.default_value
    for level,ratio in [(0,1),(1,.32),(2,.10)]:
        if level:
            resized={}
            for node,source in full_images.items():
                if source.name not in resized:
                    image=source.copy();image.name=source.name+f'_LOD{level}';image.scale(512 if level==1 else 256,512 if level==1 else 256);image.pack();resized[source.name]=image
                node.image=resized[source.name]
        if level:
            for o in bpy.context.scene.objects:
                if o.type=='MESH' and len(o.data.polygons)>100:
                    mod=o.modifiers.get('Distance LOD') or o.modifiers.new('Distance LOD','DECIMATE');mod.ratio=ratio
        path=output/('atlas-mark-ii.glb' if not level else f'atlas-mark-ii-lod{level}.glb')
        print('ATLAS: exporting LOD',level,flush=True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_vertex_color='NAME',export_vertex_color_name='ContactAO',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
        manifest['lods'].append({'level':level,**stats(),'file':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    for mat,socket,output_socket,default in restore:
        socket.default_value=default
        mat.node_tree.links.new(output_socket,socket)
    (HERE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('ATLAS_MANIFEST '+json.dumps(manifest))

if __name__=="__main__":export_asset()
