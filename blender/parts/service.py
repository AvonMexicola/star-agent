import bpy
from mathutils import Vector
import fighter_geometry as g

def hatch(name,p,size,skin,metal,dark,root=None):
    x,y,z=p;w,h=size
    g.box(name+' gasket',(x,y,z),(w,.02,h),dark,.045,root)
    g.box(name+' cover',(x,y+.014,z),(w-.032,.026,h-.032),skin,.035,root)
    g.box(name+' latch',(x+w*.29,y+.032,z),(w*.16,.02,h*.14),metal,.015,root)
    for s in [-1,1]:g.box(name+' hinge',(x-w*.35,y+.033,z+s*h*.30),(.07,.025,h*.12),metal,.01,root)

def vent(name,p,size,metal,dark,root=None):
    x,y,z=p;w,h=size
    g.box(name+' recess',(x,y,z),(w,.022,h),dark,.035,root)
    count=max(3,round(h/.12))
    for i in range(count):g.box(name+' louvre',(x,y+.026,z-h*.40+i*h*.8/(count-1)),(w*.86,.023,.033),metal,.008,root)

def rivet_row(name,a,b,count,material,root=None):
    """Geometry Nodes distribute cylinders along a mesh line; realized for glTF."""
    me=bpy.data.meshes.new(name);me.from_pydata([g.xyz(a),g.xyz(b)],[(0,1)],[])
    obj=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(obj)
    tree=bpy.data.node_groups.new(name+' GN','GeometryNodeTree')
    tree.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');tree.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
    ns=tree.nodes;ls=tree.links;inp=ns.new('NodeGroupInput');out=ns.new('NodeGroupOutput')
    curve=ns.new('GeometryNodeMeshToCurve');ls.new(inp.outputs['Geometry'],curve.inputs['Mesh'])
    points=ns.new('GeometryNodeCurveToPoints');points.mode='COUNT';points.inputs['Count'].default_value=count;ls.new(curve.outputs['Curve'],points.inputs['Curve'])
    cyl=ns.new('GeometryNodeMeshCylinder');cyl.inputs['Vertices'].default_value=8;cyl.inputs['Radius'].default_value=.013;cyl.inputs['Depth'].default_value=.008
    mat=ns.new('GeometryNodeSetMaterial');mat.inputs['Material'].default_value=material;ls.new(cyl.outputs['Mesh'],mat.inputs['Geometry'])
    inst=ns.new('GeometryNodeInstanceOnPoints');ls.new(points.outputs['Points'],inst.inputs['Points']);ls.new(mat.outputs['Geometry'],inst.inputs['Instance'])
    real=ns.new('GeometryNodeRealizeInstances');ls.new(inst.outputs['Instances'],real.inputs['Geometry']);ls.new(real.outputs['Geometry'],out.inputs['Geometry'])
    mod=obj.modifiers.new('Parametric rivet pitch','NODES');mod.node_group=tree
    return g.parent(obj,root)

def cable(name,points,radius,material,root=None):
    """Curve-to-mesh Geometry Nodes keep routed looms editable in the source."""
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';spl=data.splines.new('BEZIER');spl.bezier_points.add(len(points)-1)
    for pt,p in zip(spl.bezier_points,points):pt.co=g.xyz(p);pt.handle_left_type='AUTO';pt.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    tree=bpy.data.node_groups.new(name+' GN','GeometryNodeTree');tree.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');tree.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
    ns=tree.nodes;ls=tree.links;inp=ns.new('NodeGroupInput');out=ns.new('NodeGroupOutput')
    circle=ns.new('GeometryNodeCurvePrimitiveCircle');circle.inputs['Resolution'].default_value=8;circle.inputs['Radius'].default_value=radius
    tube=ns.new('GeometryNodeCurveToMesh');ls.new(inp.outputs['Geometry'],tube.inputs['Curve']);ls.new(circle.outputs['Curve'],tube.inputs['Profile Curve']);tube.inputs['Fill Caps'].default_value=True
    mat=ns.new('GeometryNodeSetMaterial');mat.inputs['Material'].default_value=material;ls.new(tube.outputs['Mesh'],mat.inputs['Geometry']);ls.new(mat.outputs['Geometry'],out.inputs['Geometry'])
    mod=obj.modifiers.new('Routed wiring loom','NODES');mod.node_group=tree
    return g.parent(obj,root)
