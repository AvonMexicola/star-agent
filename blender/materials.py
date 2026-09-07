"""Star Agent manufactured PBR library.

Procedural authoring nodes are baked before glTF export. Blender geometry owns
silhouette and recesses; neither colour noise nor textures invent geometry.
"""
import bpy

def manufactured(name,color,metallic=.3,roughness=.4,wear=.18):
    material=bpy.data.materials.new(name);material.use_nodes=True
    material.diffuse_color=(*color,1)
    tree=material.node_tree;nodes=tree.nodes;links=tree.links
    bs=nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=metallic
    group=bpy.data.node_groups.get('SA Manufactured Finish')
    if group is None:
        group=bpy.data.node_groups.new('SA Manufactured Finish','ShaderNodeTree')
        for n,t,io in [('Colour','NodeSocketColor','INPUT'),('Roughness','NodeSocketFloat','INPUT'),('Wear','NodeSocketFloat','INPUT'),('Colour','NodeSocketColor','OUTPUT'),('Roughness','NodeSocketFloat','OUTPUT'),('Normal','NodeSocketVector','OUTPUT')]:group.interface.new_socket(name=n,in_out=io,socket_type=t)
        ns=group.nodes;ls=group.links
        gi=ns.new('NodeGroupInput');go=ns.new('NodeGroupOutput')
        tex=ns.new('ShaderNodeTexNoise');tex.name='Fine paint variation';tex.inputs['Scale'].default_value=135;tex.inputs['Detail'].default_value=2;tex.inputs['Roughness'].default_value=.65
        ramp=ns.new('ShaderNodeValToRGB');ramp.name='Restrained coat mottling';ramp.color_ramp.elements[0].color=(.8,.8,.8,1);ramp.color_ramp.elements[1].color=(1,1,1,1);ls.new(tex.outputs['Fac'],ramp.inputs['Fac'])
        coat=ns.new('ShaderNodeMixRGB');coat.blend_type='MULTIPLY';coat.inputs[0].default_value=.38;ls.new(gi.outputs['Colour'],coat.inputs[1]);ls.new(ramp.outputs['Color'],coat.inputs[2])
        ao=ns.new('ShaderNodeAmbientOcclusion');ao.name='Cavity grime';ao.inputs['Distance'].default_value=.14
        cavity=ns.new('ShaderNodeMixRGB');cavity.blend_type='MULTIPLY';cavity.inputs[0].default_value=.32;ls.new(coat.outputs[0],cavity.inputs[1]);ls.new(ao.outputs['Color'],cavity.inputs[2])
        geom=ns.new('ShaderNodeNewGeometry')
        edge=ns.new('ShaderNodeValToRGB');edge.name='Convex edge wear mask';edge.color_ramp.elements[0].position=.48;edge.color_ramp.elements[1].position=.56;ls.new(geom.outputs['Pointiness'],edge.inputs['Fac'])
        amount=ns.new('ShaderNodeMath');amount.operation='MULTIPLY';ls.new(edge.outputs[0],amount.inputs[0]);ls.new(gi.outputs['Wear'],amount.inputs[1])
        wearNode=ns.new('ShaderNodeMixRGB');wearNode.name='Exposed edge highlights';ls.new(amount.outputs[0],wearNode.inputs[0]);ls.new(cavity.outputs[0],wearNode.inputs[1]);wearNode.inputs[2].default_value=(.45,.5,.49,1);ls.new(wearNode.outputs[0],go.inputs['Colour'])
        roughNoise=ns.new('ShaderNodeMath');roughNoise.operation='MULTIPLY_ADD';ls.new(tex.outputs['Fac'],roughNoise.inputs[0]);roughNoise.inputs[1].default_value=.09;ls.new(gi.outputs['Roughness'],roughNoise.inputs[2]);ls.new(roughNoise.outputs[0],go.inputs['Roughness'])
        bevel=ns.new('ShaderNodeBevel');bevel.name='Microscopic edge normal';bevel.inputs['Radius'].default_value=.006;bevel.samples=3;ls.new(bevel.outputs['Normal'],go.inputs['Normal'])
    finish=nodes.new('ShaderNodeGroup');finish.node_tree=group;finish.name='Baked manufacturing finish'
    finish.inputs['Colour'].default_value=(*color,1);finish.inputs['Roughness'].default_value=roughness;finish.inputs['Wear'].default_value=wear
    links.new(finish.outputs['Colour'],bs.inputs['Base Color']);links.new(finish.outputs['Roughness'],bs.inputs['Roughness']);links.new(finish.outputs['Normal'],bs.inputs['Normal'])
    material['bakeRecipe']='SA Manufactured Finish / cavity AO .14m, edge wear, fine coat noise'
    return material
