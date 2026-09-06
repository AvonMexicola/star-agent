"""Atlas authoring primitives. Public coordinates: metres, Y up, nose -Z.
Geometry is real beveled mesh; textures use metre-scale box-projected UVs.
"""
import math
import bpy
from mathutils import Vector, Matrix, Euler

DEFER_MODIFIERS = False

CONVERSION = Matrix(((1,0,0),(0,0,-1),(0,1,0)))

def xyz(p): return (p[0], -p[2], p[1])

def parent_keep(obj, parent):
    if parent is not None:
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world
    return obj

def empty(name, p=(0,0,0), parent=None):
    obj=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    obj.location=xyz(p)
    bpy.context.view_layer.update()
    return parent_keep(obj,parent)

def uv_metres(obj, scale=1):
    if obj.type!='MESH': return
    layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='MetreUV')
    obj.data.update()
    bpy.context.view_layer.update()
    normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
    for face in obj.data.polygons:
        world_normal=normal_matrix @ face.normal
        axis=max(range(3),key=lambda i:abs(world_normal[i]))
        axes=[i for i in range(3) if i!=axis]
        for li in face.loop_indices:
            p=obj.matrix_world @ obj.data.vertices[obj.data.loops[li].vertex_index].co
            layer.data[li].uv=(p[axes[0]]/scale,p[axes[1]]/scale)

def finish(obj,name,mat,bevel=0,parent=None):
    obj.name=name
    if mat is not None: obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Manufactured edge radii','BEVEL')
        mod.width=bevel;mod.segments=2;mod.limit_method='ANGLE'
        normal=obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
        normal.keep_sharp=True;normal.weight=50
        if DEFER_MODIFIERS:mod.show_viewport=False;normal.show_viewport=False
    if not DEFER_MODIFIERS:uv_metres(obj)
    return parent_keep(obj,parent)

def box(name,p,size,mat,bevel=.04,parent=None):
    # Data API avoids a scene-wide operator dependency update for every bolt,
    # cabinet and panel in a detailed ship.
    x,y,z=size[0]/2,size[2]/2,size[1]/2
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.matrix_world=Matrix.Translation(Vector(xyz(p)))
    return finish(obj,name,mat,min(bevel,min(size)*.24) if bevel else 0,parent)

def rod(name,a,b,radius,mat,vertices=12,parent=None):
    va,vb=Vector(xyz(a)),Vector(xyz(b));normal=(vb-va).normalized()
    reference=Vector((0,0,1)) if abs(normal.z)<.9 else Vector((0,1,0))
    u=normal.cross(reference).normalized();v=normal.cross(u)
    points=[tuple(centre+radius*(math.cos(2*math.pi*i/vertices)*u+math.sin(2*math.pi*i/vertices)*v)) for centre in [va,vb] for i in range(vertices)]
    faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]
    faces.extend((i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:face.use_smooth=len(face.vertices)==4
    return finish(obj,name,mat,min(.015,radius*.12),parent)

def panel(name,points,mat,thickness=.03,bevel=.02,parent=None):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([xyz(p) for p in points],[],[tuple(range(len(points)))])
    mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mod=obj.modifiers.new('Panel stock thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=0;mod.show_viewport=not DEFER_MODIFIERS
    return finish(obj,name,mat,bevel,parent)

def prism(name,points,bottom,top,mat,bevel=.04,parent=None):
    n=len(points)
    verts=[xyz((x,y,z)) for y in [bottom,top] for x,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    # Consistent normals regardless of whether planform was mirrored.
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return finish(obj,name,mat,bevel,parent)

def ring(name,p,radius,tube,mat,axis='y',parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=radius,minor_radius=tube,location=xyz(p))
    obj=bpy.context.object
    if axis=='z':obj.rotation_euler.x=math.pi/2
    if axis=='x':obj.rotation_euler.y=math.pi/2
    for face in obj.data.polygons:face.use_smooth=True
    bpy.context.view_layer.update()
    return finish(obj,name,mat,0,parent)

def rotate_game(obj,angles):
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion=(CONVERSION @ Euler(angles,'XYZ').to_matrix() @ CONVERSION.inverted()).to_quaternion()

def text(name,words,p,size,mat,rotation=(0,0,0),parent=None):
    bpy.ops.object.text_add(location=xyz(p))
    obj=bpy.context.object;obj.name=name;obj.data.body=words;obj.data.size=size
    obj.data.align_x='CENTER';obj.data.align_y='CENTER';obj.data.extrude=.0005
    obj.data.resolution_u=2;obj.data.space_character=1.1;obj.data.materials.append(mat)
    # Text starts flat on deck, baseline toward +X, glyph tops toward nose -Z.
    r=CONVERSION @ Euler(rotation,'XYZ').to_matrix() @ CONVERSION.inverted()
    obj.rotation_mode='QUATERNION';obj.rotation_quaternion=r.to_quaternion()
    bpy.ops.object.convert(target='MESH');obj=bpy.context.object
    return parent_keep(obj,parent)

def loft(name,bottom_points,top_points,bottom,top,mat,bevel=.04,parent=None):
    """Closed faceted shell between corresponding horizontal polygon rings."""
    n=len(bottom_points)
    verts=[xyz((x,bottom,z)) for x,z in bottom_points]+[xyz((x,top,z)) for x,z in top_points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return finish(obj,name,mat,bevel,parent)
