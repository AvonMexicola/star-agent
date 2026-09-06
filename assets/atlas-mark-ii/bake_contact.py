"""Deterministic local contact shading baked into glTF vertex colours.
This supplements authored PBR maps; it does not bake lights or moving-part
shadows. Ramps, lift and gates are isolated rigid groups for the bake.
"""
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def bake_contact():
    print('ATLAS: preparing contact bake',flush=True)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    moving={'RampFront','RampFrontTip','RampAft','RampAftTip','CrewElevator','LiftGateLower','LiftGateUpper'}
    def group(obj):
        while obj:
            if obj.name in moving:return obj.name
            obj=obj.parent
        return 'fixed'
    groups={}
    for obj in meshes:
        if any(m and (m.name.endswith('glass') or m.name.endswith('engine') or m.name.endswith('mint') or m.name.endswith('amber') or m.name.endswith('display')) for m in obj.data.materials):continue
        groups.setdefault(group(obj),[]).append(obj)
    samples=[]
    for i in range(12):
        r=math.sqrt((i+.5)/12);theta=i*2.399963229728653
        samples.append((r*math.cos(theta),r*math.sin(theta),math.sqrt(1-r*r)))
    count=0
    for name,objects in groups.items():
        print('ATLAS: contact group',name,len(objects),'meshes',flush=True)
        vertices=[];faces=[]
        for obj in objects:
            base=len(vertices);vertices.extend(obj.matrix_world@v.co for v in obj.data.vertices)
            faces.extend(tuple(base+i for i in p.vertices) for p in obj.data.polygons)
        tree=BVHTree.FromPolygons(vertices,faces,all_triangles=False,epsilon=.00001)
        cache={}
        for obj in objects:
            mesh=obj.data
            layer=mesh.color_attributes.get('ContactAO') or mesh.color_attributes.new(name='ContactAO',type='BYTE_COLOR',domain='CORNER')
            mesh.color_attributes.active_color=layer
            normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
            # Read normals before writing any colour: per-corner writes invalidate
            # Blender's normal cache and would recalculate the mesh every sample.
            corner_normals=[n.vector.copy() for n in mesh.corner_normals]
            colours=[]
            for i,loop in enumerate(mesh.loops):
                point=obj.matrix_world@mesh.vertices[loop.vertex_index].co
                normal=(normal_matrix@corner_normals[i]).normalized()
                key=tuple(round(v,4) for v in (*point,*normal))
                value=cache.get(key)
                if value is None:
                    reference=Vector((0,0,1)) if abs(normal.z)<.9 else Vector((0,1,0))
                    u=normal.cross(reference).normalized();v=normal.cross(u)
                    origin=point+normal*.022;occlusion=0
                    for x,y,z in samples:
                        hit=tree.ray_cast(origin,u*x+v*y+normal*z,1.15)
                        if hit[0] is not None:occlusion+=1-hit[3]/1.15
                    value=max(.58,1-.6*occlusion/len(samples));cache[key]=value
                colours.extend((value,value,value,1))
            layer.data.foreach_set('color',colours)
            count+=len(mesh.loops)
        print('ATLAS: contact shading',name,len(cache),'surface samples',flush=True)
    # Use the same attribute in the editable Blender scene and GLB materials.
    for mat in bpy.data.materials:
        if not mat.use_nodes or not any(o.data.color_attributes.get('ContactAO') and mat in list(o.data.materials) for o in meshes):continue
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
        if nodes.get('Authored contact shading'):continue
        colour=nodes.new('ShaderNodeVertexColor');colour.layer_name='ContactAO';colour.name='Authored contact shading'
        mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
        socket=p.inputs['Base Color']
        if socket.is_linked:links.new(socket.links[0].from_socket,mix.inputs[1])
        else:mix.inputs[1].default_value=socket.default_value
        links.new(colour.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],socket)
    print('ATLAS: contact shading complete',count,'corners',flush=True)

if __name__=='__main__':
    bake_contact()
