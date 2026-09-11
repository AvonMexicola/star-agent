"""Original Stratum construction helpers. Public coordinates: metres, +Y up/-Z bow.

Basic mesh operations follow the project's fighter_geometry.py convention;
the hull, fitting shapes, layout and moving assemblies are authored for Stratum.
"""
import math
import bpy
import bmesh
from mathutils import Vector


def xyz(p):
    return (p[0], -p[2], p[1])


def parent(obj, root):
    if root:
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = matrix
    return obj


def empty(name, position=(0, 0, 0), root=None, **extras):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = xyz(position)
    for key, value in extras.items():
        obj[key] = value
    return parent(obj, root)


def mesh(name, points, faces, material, bevel=0, root=None, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p) for p in points], [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if material:
        data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('Machined edge radii', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = obj.modifiers.new('Manufactured face normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    if smooth:
        for face in data.polygons:
            face.use_smooth = True
    return parent(obj, root)


def box(name, position, size, material, bevel=.025, root=None):
    x, y, z = [v / 2 for v in size]
    corners = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
               (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
    points = [(position[0]+a*x, position[1]+b*y, position[2]+c*z) for a,b,c in corners]
    return mesh(name, points, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),
                              (1,2,6,5),(0,4,7,3)], material,
                min(bevel, min(size)*.20), root)


def panel(name, points, material, thickness=.04, root=None, bevel=.015):
    obj = mesh(name, points, [tuple(range(len(points)))], material, root=root)
    mod = obj.modifiers.new('Physical panel thickness', 'SOLIDIFY')
    mod.thickness = thickness
    if bevel:
        mod = obj.modifiers.new('Panel edge break', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new('Panel normals', 'WEIGHTED_NORMAL')
    return obj


def rod(name, a, b, radius, material, root=None, segments=16):
    a, b = Vector(a), Vector(b)
    axis = (b-a).normalized()
    u = axis.cross(Vector((0,1,0)) if abs(axis.y)<.9 else Vector((1,0,0))).normalized()
    v = axis.cross(u)
    points = [tuple(p+radius*(math.cos(i*math.tau/segments)*u+math.sin(i*math.tau/segments)*v))
              for p in (a,b) for i in range(segments)]
    faces = [tuple(range(segments-1,-1,-1)), tuple(range(segments,2*segments))]
    faces += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
    return mesh(name,points,faces,material,root=root,smooth=True)


def tube(name, x, y, rings, material, root=None, segments=24):
    points = [(x+r*math.cos(i*math.tau/segments),y+r*math.sin(i*math.tau/segments),z)
              for z,r in rings for i in range(segments)]
    faces = [(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i)
             for k in range(len(rings)-1) for i in range(segments)]
    return mesh(name, points, faces, material, root=root, smooth=True)


def loft(name, sections, material, root=None):
    # Deliberately shaped continuous octagonal shoulders, never an intersecting
    # row of primitive cans. Sections are z,cx,half-width,bottom,chine,crown.
    points=[]
    for z,cx,w,low,chine,top in sections:
        points += [(cx-.60*w,top,z),(cx+.60*w,top,z),(cx+w,chine,z),
                   (cx+.74*w,low,z),(cx-.74*w,low,z),(cx-w,chine,z)]
    n=6
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(sections)-1)*n,len(sections)*n))]
    faces += [(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i)
              for k in range(len(sections)-1) for i in range(n)]
    return mesh(name, points, faces, material, .035, root)


def text(name, value, position, size, material, rotation=(math.pi/2,0,0), root=None):
    # rotation is in Blender radians; lettering remains editable in the .blend.
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=value
    curve.size=size
    curve.extrude=.0008
    curve.bevel_depth=0
    curve.align_x='CENTER'
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.location=xyz(position)
    obj.rotation_euler=rotation
    curve.materials.append(material)
    return parent(obj,root)


def apply(obj):
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def planar_uv(obj, metres=4):
    """Object-local metre texture density, with explicit independent face seams.

    Repeating manufactured finishes are intentional; there is no painted atlas
    whose UV islands can overlap, and no lighting baked into albedo/normal maps.
    """
    data=obj.data
    uv=data.uv_layers.new(name='Manufactured_metres') if not data.uv_layers else data.uv_layers.active
    for face in data.polygons:
        normal=face.normal
        drop=max(range(3),key=lambda i:abs(normal[i]))
        axes=[i for i in range(3) if i!=drop]
        for li in face.loop_indices:
            p=data.vertices[data.loops[li].vertex_index].co
            uv.data[li].uv=(p[axes[0]]/metres,p[axes[1]]/metres)
