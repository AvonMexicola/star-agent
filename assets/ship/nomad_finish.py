"""Bake original procedural manufacturing finishes to two shared 1024px atlases.

CPU Cycles emission bakes retain paint variation, cavity shading and per-material
roughness/metalness. No generated service, downloaded art or runtime API is used.
"""
import math
import bpy


def bake_finish(objects, name):
    objects = [o for o in objects if o.type == 'MESH' and o.data.materials
               and o.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value < .1]
    if not objects: return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    scene = bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
    scene.render.threads_mode='FIXED';scene.render.threads=8
    scene.render.bake.margin=4;scene.render.bake.use_clear=True
    copied, outputs = {}, []
    for obj in objects:
        original=obj.data.materials[0]
        if original not in copied:
            mat=original.copy();mat.name=f'{name} bake / {original.name}';copied[original]=mat
            nodes, links=mat.node_tree.nodes, mat.node_tree.links
            p=nodes.get('Principled BSDF');out=nodes.get('Material Output')
            noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=155;noise.inputs['Detail'].default_value=2
            colour=nodes.new('ShaderNodeMixRGB');colour.blend_type='MULTIPLY';colour.inputs[0].default_value=.18
            colour.inputs[1].default_value=p.inputs['Base Color'].default_value;links.new(noise.outputs['Fac'],colour.inputs[2])
            ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.10;ao.samples=8
            cavity=nodes.new('ShaderNodeMixRGB');cavity.blend_type='MULTIPLY';cavity.inputs[0].default_value=.24
            links.new(colour.outputs[0],cavity.inputs[1]);links.new(ao.outputs['Color'],cavity.inputs[2])
            geo=nodes.new('ShaderNodeNewGeometry')
            wear=nodes.new('ShaderNodeValToRGB');wear.color_ramp.elements[0].position=.52;wear.color_ramp.elements[1].position=.67
            links.new(geo.outputs['Pointiness'],wear.inputs[0])
            amount=nodes.new('ShaderNodeMath');amount.operation='MULTIPLY';amount.inputs[1].default_value=.11;links.new(wear.outputs[0],amount.inputs[0])
            edge=nodes.new('ShaderNodeMixRGB');links.new(amount.outputs[0],edge.inputs[0]);links.new(cavity.outputs[0],edge.inputs[1]);edge.inputs[2].default_value=(.46,.49,.45,1)
            rough=nodes.new('ShaderNodeMath');rough.operation='MULTIPLY_ADD';rough.use_clamp=True
            rough.inputs[1].default_value=.16;rough.inputs[2].default_value=max(0,p.inputs['Roughness'].default_value-.065);links.new(noise.outputs['Fac'],rough.inputs[0])
            orm=nodes.new('ShaderNodeCombineColor');orm.mode='RGB';orm.inputs[0].default_value=1;links.new(rough.outputs[0],orm.inputs[1]);orm.inputs[2].default_value=p.inputs['Metallic'].default_value
            emission=nodes.new('ShaderNodeEmission');links.new(emission.outputs[0],out.inputs['Surface'])
            target=nodes.new('ShaderNodeTexImage');nodes.active=target
            outputs.append((mat,emission,edge.outputs[0],orm.outputs[0],target))
        obj.data.materials[0]=copied[original]
    images=[]
    for pass_id in range(2):
        image=bpy.data.images.new(f'{name} / '+('albedo' if pass_id==0 else 'roughness-metalness'),width=1024,height=1024,alpha=False)
        image.colorspace_settings.name='sRGB' if pass_id==0 else 'Non-Color'
        for mat,emission,colour,orm,target in outputs:
            target.image=image;mat.node_tree.nodes.active=target
            mat.node_tree.links.new(colour if pass_id==0 else orm,emission.inputs['Color'])
        print(f'NOMAD: baking {image.name}',flush=True)
        bpy.ops.object.bake(type='EMIT');image.pack();images.append(image)
    material=bpy.data.materials.new(f'Nomad / {name} manufactured PBR');material.use_nodes=True
    nodes,links=material.node_tree.nodes,material.node_tree.links;p=nodes.get('Principled BSDF')
    base=nodes.new('ShaderNodeTexImage');base.image=images[0];links.new(base.outputs['Color'],p.inputs['Base Color'])
    orm=nodes.new('ShaderNodeTexImage');orm.image=images[1]
    separate=nodes.new('ShaderNodeSeparateColor');separate.mode='RGB';links.new(orm.outputs['Color'],separate.inputs[0])
    links.new(separate.outputs[1],p.inputs['Roughness']);links.new(separate.outputs[2],p.inputs['Metallic'])
    material['recipe']='Original baked fine coat variation, cavity AO, convex wear, roughness and metalness'
    for obj in objects:obj.data.materials.clear();obj.data.materials.append(material)
    # Material replacement allows one draw per rigid parent and each cargo box.
    groups={}
    for obj in objects:groups.setdefault(obj.parent,[]).append(obj)
    for meshes in groups.values():
        if len(meshes)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:obj.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();meshes[0].name=f'Nomad {name} / rigid batch'


def finish_nomad(cabin, chair, lid):
    interior=set([cabin,chair,lid])
    def cabin_part(obj):
        while obj:
            if obj in interior:return True
            obj=obj.parent
        return False
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bake_finish([o for o in meshes if cabin_part(o)],'cabin')
    # Recollect live scene objects after the first consolidation.
    bake_finish([o for o in bpy.context.scene.objects if o.type=='MESH' and not cabin_part(o)],'hull')
