"""Exportable PBR material library for Atlas Mark II."""
from pathlib import Path
import bpy

def create(root):
    out={}
    def material(key,color,metal=.0,rough=.45,texture=None,emission=0,alpha=1):
        m=bpy.data.materials.new('Atlas / '+key)
        m.diffuse_color=(*color,alpha);m.use_nodes=True
        p=m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value=(*color,alpha)
        p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
        p.inputs['Alpha'].default_value=alpha
        if emission:
            p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
        if alpha<1:
            m.surface_render_method='DITHERED'
        if texture:
            directory=Path(root)/'public/textures/atlas-mark-ii'
            colorpath=directory/f'{texture}-albedo.png'
            if colorpath.exists():
                node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(colorpath),check_existing=True)
                node.image.colorspace_settings.name='sRGB';node.extension='REPEAT';node.label='1m albedo repeat'
                m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
            n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(directory/f'{texture}-normal.png'),check_existing=True)
            n.image.colorspace_settings.name='Non-Color';n.extension='REPEAT'
            convert=m.node_tree.nodes.new('ShaderNodeNormalMap');convert.inputs['Strength'].default_value=.55
            m.node_tree.links.new(n.outputs['Color'],convert.inputs['Color']);m.node_tree.links.new(convert.outputs['Normal'],p.inputs['Normal'])
            orm=m.node_tree.nodes.new('ShaderNodeTexImage');orm.image=bpy.data.images.load(str(directory/f'{texture}-orm.png'),check_existing=True)
            orm.image.colorspace_settings.name='Non-Color';orm.extension='REPEAT'
            split=m.node_tree.nodes.new('ShaderNodeSeparateColor');m.node_tree.links.new(orm.outputs['Color'],split.inputs['Color'])
            m.node_tree.links.new(split.outputs['Green'],p.inputs['Roughness']);m.node_tree.links.new(split.outputs['Blue'],p.inputs['Metallic'])
        out[key]=m
        return m
    material('ivory',(.8,.79,.74),texture='ceramic')
    material('dark',(.035,.050,.057),metal=.35,rough=.45)
    material('steel',(.31,.36,.37),texture='steel')
    material('deck',(.16,.17,.17),texture='deck')
    material('rubber',(.017,.022,.024),rough=.86)
    material('petrol',(.025,.105,.115),metal=.3,rough=.38)
    material('cloth',(.045,.065,.071),rough=.93,texture='cloth')
    material('mint',(.47,.86,.67),emission=1.6)
    material('amber',(.9,.49,.15),emission=1.4)
    material('warning',(.58,.37,.12),rough=.52)
    material('glass',(.14,.27,.30),metal=.05,rough=.13,alpha=.12)
    material('display',(.21,.66,.49),emission=1.1)
    material('engine',(.24,.64,.76),emission=2.4)
    return out
