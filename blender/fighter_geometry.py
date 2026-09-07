"""Small reusable hard-surface mesh helpers; public coordinates are metres, Y up."""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector

def xyz(p): return (p[0], -p[2], p[1])

def parent(obj, root):
    if root is not None:
        bpy.context.view_layer.update()
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world
    return obj

def empty(name, pos=(0,0,0), root=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = xyz(pos)
    return parent(o, root)

def finish(o, name, mat, bevel=0, root=None, smooth=False):
    o.name = name
    if mat: o.data.materials.append(mat)
    if bevel:
        m = o.modifiers.new('Manufactured edge', 'BEVEL'); m.width=bevel; m.segments=2
        m = o.modifiers.new('Panel normals', 'WEIGHTED_NORMAL'); m.keep_sharp=True
    if smooth:
        for p in o.data.polygons: p.use_smooth=True
    return parent(o,root)

def mesh(name, points, faces, mat, bevel=0, root=None, smooth=False, recalc=True):
    m=bpy.data.meshes.new(name); m.from_pydata([xyz(p) for p in points],[],faces);m.update()
    if recalc:
        bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
    return finish(o,name,mat,bevel,root,smooth)

def box(name,p,size,mat,bevel=.02,root=None):
    x,y,z=[s/2 for s in size]
    pts=[(p[0]+a*x,p[1]+b*y,p[2]+c*z) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,pts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(1,2,6,5),(0,4,7,3)],mat,min(bevel,min(size)*.2),root)

def rod(name,a,b,r,mat,segments=12,root=None):
    a,b=Vector(a),Vector(b);v=(b-a).normalized()
    u=v.cross(Vector((0,1,0)) if abs(v.y)<.9 else Vector((1,0,0))).normalized();w=v.cross(u)
    pts=[tuple(p+r*(math.cos(i*math.tau/segments)*u+math.sin(i*math.tau/segments)*w)) for p in (a,b) for i in range(segments)]
    n=segments
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,pts,faces,mat,0,root,True)

def panel(name,points,mat,thickness=.02,bevel=.01,root=None):
    o=mesh(name,points,[tuple(range(len(points)))],mat,0,root)
    m=o.modifiers.new('Panel stock','SOLIDIFY');m.thickness=thickness
    if bevel:
        m=o.modifiers.new('Panel edge','BEVEL');m.width=bevel;m.segments=2
        m=o.modifiers.new('Panel normals','WEIGHTED_NORMAL')
    return o

def prism(name,outline,top,bottom,mat,bevel=.015,root=None):
    n=len(outline)
    return mesh(name,[(x,y,z) for y in (bottom,top) for x,z in outline], [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat,bevel,root)

def fuselage(name,sections,mat,root=None):
    # z, half width, bottom, shoulder, crown. Octagonal chines, continuous long planes.
    pts=[]
    for z,w,low,side,top in sections:
        pts.extend([(0,top,z),(.62*w,top-.04,z),(w,side,z),(.72*w,low,z),(-.72*w,low,z),(-w,side,z),(-.62*w,top-.04,z)])
    n=7
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(sections)-1)*n,len(sections)*n))]
    faces.extend((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(len(sections)-1) for i in range(n))
    return mesh(name,pts,faces,mat,.018,root)

def annulus(name,x,y,rings,mat,root=None,n=32):
    # Ring profile is (z,radius). Both outside and inside wall can share one mesh.
    pts=[(x+r*math.cos(i*math.tau/n),y+r*math.sin(i*math.tau/n),z) for z,r in rings for i in range(n)]
    return mesh(name,pts,[(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(len(rings)-1) for i in range(n)],mat,0,root)

def cut(target,cutter):
    bpy.context.view_layer.objects.active=target
    m=target.modifiers.new('EXACT machined recess','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(cutter,do_unlink=True)

def apply(o):
    bpy.context.view_layer.objects.active=o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def unwrap(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        if o.type=='MESH':o.select_set(True)
    if not bpy.context.selected_objects:return
    bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    # Fraction is measured in the final atlas. SCALED margins wasted >90% of
    # this many-part asset and left bevel islands smaller than a texel.
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.002,margin_method='FRACTION',scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT');bpy.ops.object.select_all(action='DESELECT')
