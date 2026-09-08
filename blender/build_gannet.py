"""Original Meridian Gannet T-06. CPU geometry and local static cavity authoring.

Canonical units: metres, Y up, nose -Z. Run gannet_textures.py first, this file
inside Blender, then gannet_pack.py. Outputs stage before budgeted publication.
"""
from pathlib import Path
import bpy, json, math, sys, hashlib
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import fighter_geometry as g
SOURCE=ROOT/'assets/gannet'; STAGE=SOURCE/'.staging'
layout_bytes=(SOURCE/'layout.json').read_bytes();L=json.loads(layout_bytes)
input_files=['blender/build_gannet.py','blender/fighter_geometry.py','blender/gannet_textures.py',
    'assets/gannet/layout.json',*[f'assets/gannet/textures/{name}.png' for name in ('surface-basecolor','surface-orm','surface-normal','manufacturer')]]
input_hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in input_files}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
STAGE.mkdir(parents=True,exist_ok=True)

surface=bpy.data.materials.new('Gannet / original Meridian PBR');surface.use_nodes=True
n=surface.node_tree.nodes;links=surface.node_tree.links;p=n.get('Principled BSDF')
def texture(name,linear=False):
    t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(SOURCE/'textures'/('surface-'+name+'.png')))
    if linear:t.image.colorspace_settings.name='Non-Color'
    return t
base=texture('basecolor');orm=texture('orm',True);normal=texture('normal',True)
split=n.new('ShaderNodeSeparateColor');links.new(orm.outputs['Color'],split.inputs['Color'])
# The exporter recognizes base texture × authored vertex colour. Static cavity
# AO is measured from local geometry below; moving assemblies get white only.
attr=n.new('ShaderNodeVertexColor');attr.layer_name='Col'
mix=n.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs['Factor'].default_value=1
links.new(base.outputs['Color'],mix.inputs[6]);links.new(attr.outputs['Color'],mix.inputs[7]);links.new(mix.outputs[2],p.inputs['Base Color'])
links.new(split.outputs['Green'],p.inputs['Roughness']);links.new(split.outputs['Blue'],p.inputs['Metallic'])
nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.32
links.new(normal.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])

def plain(name,color,rough=.5,metal=0,emit=0,alpha=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF')
    c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color)
    s.inputs['Base Color'].default_value=(*c,alpha);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal;s.inputs['Alpha'].default_value=alpha
    if emit:s.inputs['Emission Color'].default_value=(*c,1);s.inputs['Emission Strength'].default_value=emit
    if alpha<1:m.surface_render_method='BLENDED';m.use_transparent_shadow=False;m.use_backface_culling=False
    return m
glass=plain('Gannet pressure glazing',(.22,.39,.41),.14,.14,alpha=.19)
mint=plain('Gannet restrained mint emitters',(.60,.91,.77),.3,emit=1.15)
amber=plain('Gannet amber access emitters',(.95,.60,.21),.4,emit=.7)
ink=plain('Gannet manufacturer lettering',(.035,.073,.085),.75)
screenmat=plain('Gannet MFD placeholder / replaced with actual telemetry',(.015,.055,.062),.8)
badge=plain('Gannet / approved Meridian emblem',(1,1,1),.7,alpha=.99)
bn=badge.node_tree.nodes;bp=bn.get('Principled BSDF');bt=bn.new('ShaderNodeTexImage');bt.image=bpy.data.images.load(str(SOURCE/'textures/manufacturer.png'))
badge.node_tree.links.new(bt.outputs['Color'],bp.inputs['Base Color']);badge.node_tree.links.new(bt.outputs['Alpha'],bp.inputs['Alpha'])

root=g.empty('GannetHull');root['manufacturer']='Meridian Shipworks';root['model']='Gannet T-06';root['authoredSurface']=True
hull=g.empty('OuterHull',root=root);cabin=g.empty('Cabin',root=root)
parts=[];colliders=[]
def remember(o,tile=0,collision=True,keep=False):
    o['gannetTile']=tile;o['collision']=collision;o['preserveNode']=keep;parts.append(o);return o
def box(name,pos,size,tile=0,bevel=.025,parent=hull,mat=None,collision=True,keep=False):
    return remember(g.box(name,pos,size,mat or surface,bevel,parent),tile,collision,keep)
def rod(name,a,b,r,tile=2,parent=hull,mat=None,segments=12,collision=True):
    return remember(g.rod(name,a,b,r,mat or surface,segments,parent),tile,collision)
def panel(name,points,tile=0,thick=.05,parent=hull,mat=None,collision=True):
    return remember(g.panel(name,points,mat or surface,thick,.012,parent),tile,collision)
def prism(name,outline,top,bottom,tile=0,parent=hull,bevel=.035):
    return remember(g.prism(name,outline,top,bottom,surface,bevel,parent),tile)
def text(name,body,pos,size,parent=hull,mat=ink,rotation=(math.pi/2,0,0)):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.extrude=.0008;c.resolution_u=2;c.align_x='CENTER';c.align_y='CENTER'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=g.xyz(pos);o.rotation_euler=rotation;c.materials.append(mat);g.parent(o,parent)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return remember(o,0,False)
def loft(name,sections,tile=0,parent=hull,edge=.025,profile='octagon'):
    # Closed octagonal volumes, only used OUTSIDE the living and vehicle voids.
    pts=[]
    for z,x,w,low,high in sections:
        bevel=min(w*.25,(high-low)*.24)
        if profile=='cowl':
            h=high-low
            pts.extend([(x-w*.70,low,z),(x+w*.70,low,z),(x+w,low+h*.16,z),(x+w,low+h*.68,z),
                (x+w*.75,low+h*.89,z),(x+w*.28,high,z),(x-w*.28,high,z),(x-w*.75,low+h*.89,z),
                (x-w,low+h*.68,z),(x-w,low+h*.16,z)])
        else:pts.extend([(x-w+bevel,low,z),(x+w-bevel,low,z),(x+w,low+bevel,z),(x+w,high-bevel,z),(x+w-bevel,high,z),(x-w+bevel,high,z),(x-w,high-bevel,z),(x-w,low+bevel,z)])
    count=10 if profile=='cowl' else 8
    faces=[tuple(range(count-1,-1,-1)),tuple(range((len(sections)-1)*count,len(sections)*count))]
    faces += [(j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i) for j in range(len(sections)-1) for i in range(count)]
    return remember(g.mesh(name,pts,faces,surface,edge,parent),tile)

# Low forward prow, pressure-cell skirts and continuous shoulder armor. The
# nose volume ends ahead of the pilot; no solid fuselage fills the cabin.
loft('Faceted forward prow',[(-13,0,1.10,1.62,2.08),(-12.2,0,2.25,1.25,2.38),(-10.5,0,2.62,1.25,2.31)],0)
drive_skins={}
for side in (-1,1):
    loft('Pressure cell lower chine', [(-10.6,side*2.15,.45,1.25,2.27),(-7.7,side*2.53,.48,1.18,2.24),(1.9,side*2.76,.53,1.18,2.31),(4.5,side*3.19,.28,1.24,2.20)],0)
    # The cabin-to-drive load arms have a shallow neck ahead of the load bay.
    # Their substantial aft roots carry the fins and the roof cross-members.
    # Closed skins stay outside both living and freight clear volumes.
    loft('Swept shoulder fairing',[(-10.2,side*2.80,.48,2.04,3.16),(-7.65,side*3.43,.96,1.84,3.32),
         (-5.50,side*3.95,1.28,2.02,3.26),(-2.1,side*4.48,.83,2.35,3.29),
         (1.10,side*4.83,.53,2.67,4.07),(3.35,side*4.78,.52,2.30,4.25),
         (8.9,side*4.74,.46,2.31,4.87)],1,edge=.055)
    loft('Fore shoulder ceramic pressure guard',[(-9.96,side*2.86,.38,3.05,3.26),(-7.55,side*3.45,.94,3.11,4.16),
         (-5.40,side*3.94,1.25,3.14,4.64),(-3.65,side*4.21,1.16,3.18,4.69),
         (-2.18,side*4.46,.80,3.23,4.30)],0,edge=.055)
    loft('Aft shoulder load guard',[(1.25,side*4.85,.52,3.98,4.22),(3.40,side*4.78,.57,3.96,4.98),
         (6.10,side*4.80,.55,4.18,5.12),(8.90,side*4.74,.48,4.66,5.26),
         (9.67,side*4.77,.29,4.73,5.15)],0,edge=.045)
    # A continuous flared roof-to-shoulder fillet returns into the pressure crown
    # behind the side glass. This closes the abrupt narrow cockpit/shoulder step
    # without changing the glazing, pilot eye or occupied pressure-cell void.
    loft('Cockpit shoulder roof fillet',[(-8.95,side*2.32,.18,3.95,4.20),(-7.58,side*2.77,.55,3.89,4.38),
         (-6.44,side*3.04,.78,3.89,4.64),(-4.60,side*3.53,.69,3.97,4.65),(-3.30,side*3.94,.35,4.13,4.54)],0,edge=.045,profile='cowl')
    # A deep fore power/gear lobe and aft engine lobe join through a narrower,
    # raised service waist. This is actual primary geometry on every silhouette,
    # not a painted division across a straight full-length pontoon. Under the
    # armor, the graphite load keel ends below its skirt: no almost-coplanar
    # duplicate cowl sidewalls can show through as repeating fine streaks.
    drive=[(-8.76,side*5.56,.31,2.79,3.19),(-7.1,side*5.86,1.02,2.15,3.17),
           (-5.45,side*6.04,1.31,2.04,3.18),(-3.55,side*6.07,1.30,2.25,3.24),
           (-2.2,side*6.12,1.10,2.67,4.42),(-1.82,side*6.12,.94,2.79,4.64),
           (1.07,side*6.12,.94,2.79,4.64),(2.85,side*6.19,1.35,2.26,3.22),
           (5.65,side*6.22,1.46,2.09,3.18),(7.95,side*6.28,1.29,2.15,3.18),
           (9.22,side*6.30,1.08,2.49,3.16),(10.48,side*6.30,.92,2.78,3.22)]
    drive_skins[side]=[loft('Outboard longitudinal drive',drive,1,edge=.065)]
    cowls=[
        [(-8.48,side*5.60,.42,3.09,3.42),(-6.91,side*5.90,1.15,3.10,4.56),
         (-5.38,side*6.04,1.48,3.11,5.06),(-3.56,side*6.07,1.45,3.17,5.15),
         (-2.12,side*6.12,1.19,3.34,4.78)],
        [(1.90,side*6.17,1.15,3.22,4.82),(3.26,side*6.20,1.58,3.13,5.52),
         (5.67,side*6.22,1.58,3.11,5.44),(7.90,side*6.28,1.42,3.10,5.11),
         (9.14,side*6.30,1.13,3.11,4.74)],
    ]
    for i,sections in enumerate(cowls):drive_skins[side].append(loft(('Fore' if i==0 else 'Aft')+' drive ceramic cowl',sections,0,edge=.055,profile='cowl'))
    def drive_x(z,sections=drive):
        for a,b in zip(sections,sections[1:]):
            if a[0]<=z<=b[0]:
                t=(z-a[0])/(b[0]-a[0]);return abs(a[1])+(abs(b[1])-abs(a[1]))*t+a[2]+(b[2]-a[2])*t
        raise ValueError(z)
    def service_patch(name,zy,sections,tile=4,offset=.014,depth=.035):
        # Every actual longitudinal station gets a face edge. One broad n-gon
        # across a canted fin bridged its high point and buried part of the
        # first Art12 skin. These planar strips follow the underlying piecewise
        # profile exactly, with joined vertices and closed fitted returns.
        def clip(poly,z_limit,below):
            result=[]
            for a,b in zip(poly,poly[1:]+poly[:1]):
                inside_a=a[0]<=z_limit if below else a[0]>=z_limit
                inside_b=b[0]<=z_limit if below else b[0]>=z_limit
                if inside_a:result.append(a)
                if inside_a!=inside_b:
                    t=(z_limit-a[0])/(b[0]-a[0]);result.append((z_limit,a[1]+t*(b[1]-a[1])))
            return result
        points=[];faces=[];indices={}
        def vertex(p,rear=False):
            z,y=p;key=(round(z,8),round(y,8),rear)
            if key not in indices:
                indices[key]=len(points);points.append((side*(drive_x(z,sections)+offset-(depth if rear else 0)),y,z))
            return indices[key]
        for a,b in zip(sections,sections[1:]):
            poly=clip(clip(zy,a[0],False),b[0],True)
            if len(poly)>=3:
                faces.append(tuple(vertex(p) for p in poly));faces.append(tuple(vertex(p,True) for p in reversed(poly)))
        boundary=[]
        for a,b in zip(zy,zy[1:]+zy[:1]):
            boundary.append(a)
            stations=[s[0] for s in sections if min(a[0],b[0])<s[0]<max(a[0],b[0])]
            for z in sorted(stations,reverse=b[0]<a[0]):boundary.append((z,a[1]+(z-a[0])/(b[0]-a[0])*(b[1]-a[1])))
        for a,b in zip(boundary,boundary[1:]+boundary[:1]):faces.append((vertex(a),vertex(b),vertex(b,True),vertex(a,True)))
        return remember(g.mesh(name,points,faces,surface,.008,hull),tile)
    for sections,front,back in [(cowls[0],-5.18,-3.74),(cowls[1],3.48,5.39)]:
        # Raised access lids land in shallow fitted black gaskets. Each return
        # enters its actual cowl face; they cannot float on a constant-X plane.
        outline=[(front,3.88),(front+.16,3.71),(back-.16,3.71),(back,3.88),(back,4.41),(front,4.41)]
        service_patch('Drive maintenance lid gasket',outline,sections,3,.018,.052)
        inset=[(front+.06,3.90),(front+.19,3.78),(back-.19,3.78),(back-.06,3.90),(back-.06,4.34),(front+.06,4.34)]
        service_patch('Fitted drive maintenance cover',inset,sections,4,.045,.060)
        for z in (front+.22,back-.22):
            x=side*(drive_x(z,sections)+.051)
            rod('Drive cover captive fastener',(x-side*.016,4.16,z),(x,4.16,z),.030,2,segments=6,collision=False)
    # Actual machined pocket in the narrower service waist. Short heat blades
    # seat on the rear plate, inside the armor-lobe outline on both sides.
    g.apply(drive_skins[side][0])
    cutter=g.box('Temporary drive service pocket',(side*7.075,3.72,-.37),(.44,1.12,2.35),surface,.025)
    g.apply(cutter);g.cut(drive_skins[side][0],cutter)
    box('Drive thermal pocket rear plate',(side*6.863,3.72,-.37),(.04,1.03,2.26),3,.008)
    for z in (-1.29,-.92,-.55,-.18,.19,.56):
        box('Thermal bridge cooling blade',(side*6.97,3.72,z),(.25,.96,.105),2,.018)
    rod('Drive mint running light',(side*7.074,4.42,-1.44),(side*7.074,4.42,.71),.022,parent=hull,mat=mint,collision=False)
    # Canted clipped fins have real thickened load roots and a tapered foil,
    # rather than one triangular sheet planted on top of a box.
    loft('Stabilizer load saddle',[(3.35,side*4.79,.49,4.68,5.00),(5.65,side*4.93,.70,4.82,5.61),
         (8.30,side*5.35,.50,4.86,6.05),(9.64,side*5.38,.24,4.83,5.32)],1,edge=.055,profile='cowl')
    fin=[(4.75,side*4.96,.26,5.00,5.34),(6.10,side*5.25,.27,5.20,6.33),
         (7.65,side*5.60,.18,5.40,7.17),(8.35,side*5.68,.15,5.44,7.10),
         (9.15,side*5.62,.105,5.26,6.52),(9.75,side*5.43,.06,5.00,5.32)]
    loft('Aft vertical load stabilizer',fin,0,edge=.035)
    # A broad removable foil-service skin follows the canted external face;
    # its gasket and returns are structural, not a detached flat decoration.
    service_patch('Fin service skin gasket',[(6.42,5.73),(7.64,6.77),(8.24,6.70),(8.91,5.82),(8.31,5.62),(7.10,5.60)],fin,1,.012,.046)
    service_patch('Fin fitted composite skin',[(6.59,5.80),(7.67,6.66),(8.17,6.60),(8.75,5.87),(8.28,5.71),(7.13,5.70)],fin,4,.037,.059)
    rod('Stabilizer forward load spar',(side*4.97,5.36,4.83),(side*5.25,6.30,6.11),.060,1)
    rod('Stabilizer upper load spar',(side*5.25,6.30,6.11),(side*5.60,7.12,7.64),.041,1)
    # Flush lower gear wells with actual telescoping suspension inside the pod.
    for z in (-6.5,7.8):
        for dx in (-.78,.78):box('Gear well longitudinal wall',(side*5.45+dx,2.88,z),(.12,1.67,1.98),1)
        for dz in (-.94,.94):box('Gear well end wall',(side*5.45,2.88,z+dz),(1.48,1.67,.10),1)
        box('Gear well ceiling',(side*5.45,4.37,z),(1.50,.10,1.86),2)

# Pressure cabin: measured floor, fitted inner sidewalls, roof and windscreen.
floor_outline=[(-1.78,-10.64),(1.78,-10.64),(2.05,-9.45),(2.05,3.4),(-2.05,3.4),(-2.05,-9.45)]
# The same exact cabin floor boundary, with a 0.29 m interior grid so local
# measured cavity AO can describe fixed furniture contact without broad fades.
rows=sorted([-10.64,-9.45]+[-9.45+i*(3.4+9.45)/45 for i in range(1,46)]+[-3.80,-1.65,-.535,1.575])
# Extra lines sit just outside the real fixed plinths. A uniform grid alone
# left its nearest visible sample 15 cm away and missed the local contact.
fractions=sorted([-1+2*i/14 for i in range(15)]+[x/2.05 for x in (-1.337,-1.023,1.023,1.337)])
points=[];nx=len(fractions)-1
for y in (1.24,1.4):
    for z in rows:
        w=1.78+(2.05-1.78)*min(1,(z+10.64)/1.19)
        points.extend([(w*f,y,z) for f in fractions])
nrow=nx+1;layer=len(rows)*nrow;faces=[]
for j in range(len(rows)-1):
    for i in range(nx):
        a=j*nrow+i;b=a+1;c=a+nrow+1;d=a+nrow
        faces.extend([(a,b,c,d),(a+layer,d+layer,c+layer,b+layer)])
for i in range(nx):faces.extend([(i,i+layer,i+layer+1,i+1),((len(rows)-1)*nrow+i,(len(rows)-1)*nrow+i+1,(len(rows)-1)*nrow+i+1+layer,(len(rows)-1)*nrow+i+layer)])
for j in range(len(rows)-1):
    for i in (0,nx):a=j*nrow+i;b=a+nrow;faces.append((a,b,b+layer,a+layer))
floor=remember(g.mesh('CabinFloor',points,faces,surface,0,cabin),1,True,True)
for side in (-1,1):
    box('Cabin inner pressure wall',(side*2.10,2.65,-2.6),(.16,2.52,12.0),0,.025,cabin)
    # Recessed inner service texture breaks define real fitted panels.
    for z in (-6.7,-4.2,-1.4,1.6):
        box('Cabin wall insert',(side*2.006,2.89,z),(.018,1.15,1.82),7,.006,cabin)
        box('Cabin wall lower service rail',(side*1.99,1.69,z),(.033,.20,1.82),4,.004,cabin)
    panel('Cockpit quarter glazing',[(side*1.88,2.28,-10.62),(side*1.80,4.13,-10.10),(side*2.02,4.18,-7.6),(side*2.025,2.28,-7.6)],parent=cabin,mat=glass,thick=.016)
    rod('Pressure glazing A pillar',(side*1.90,2.25,-10.68),(side*1.80,4.17,-10.09),.052,1,cabin)
    rod('Pressure glazing waist rail',(side*1.91,2.26,-10.62),(side*2.03,2.26,-7.50),.053,1,cabin)
    rod('Upper cockpit side rail',(side*1.80,4.16,-10.1),(side*2.04,4.20,-7.5),.055,2,cabin)
panel('Forward pressure glazing',[(-1.84,2.29,-10.75),(1.84,2.29,-10.75),(1.75,4.12,-10.10),(-1.75,4.12,-10.10)],parent=cabin,mat=glass,thick=.018)
rod('Windscreen top seal',(-1.78,4.17,-10.09),(1.78,4.17,-10.09),.06,1,cabin)
rod('Windscreen lower seal',(-1.92,2.26,-10.77),(1.92,2.26,-10.77),.06,1,cabin)
loft('Faceted cockpit crown',[(-10.12,0,1.80,4.17,4.33),(-8.90,0,2.25,4.17,4.40),(-7.20,0,2.26,4.17,4.49)],0,edge=.025)
prism('Habitation crown',[(-2.26,-7.45),(2.26,-7.45),(2.45,-6.90),(2.45,2.65),(2.85,3.40),(-2.85,3.40),(-2.45,2.65),(-2.45,-6.90)],4.52,3.91,1)
for z in (-6.4,-3.7,-1.0,1.7):
    box('Ceiling liner cassette',(0,3.88,z),(3.98,.06,2.56),7,.013,cabin)
    for side in (-1,1):rod('Cabin ceiling work lamp',(side*1.60,3.825,z-.85),(side*1.60,3.825,z+.85),.024,parent=cabin,mat=mint,collision=False)
# A forward pressure-access lid and a separate aft climate/service housing
# replace the repeated ladder of identical roof panels. Both seat on the same
# closed pressure crown; none of the cabin roof or lamp geometry is moved.
prism('Forward roof pressure gasket',[(-1.82,-7.18),(1.82,-7.18),(1.95,-6.85),(1.95,-4.02),(1.64,-3.56),(-1.64,-3.56),(-1.95,-4.02),(-1.95,-6.85)],4.553,4.514,3,hull,.014)
prism('Forward roof pressure access',[(-1.75,-7.09),(1.75,-7.09),(1.85,-6.80),(1.85,-4.07),(1.60,-3.66),(-1.60,-3.66),(-1.85,-4.07),(-1.85,-6.80)],4.681,4.546,0,hull,.025)
for side in (-1,1):
    box('Pressure access hinge',(side*1.88,4.60,-6.31),(.085,.09,.62),2,.012)
    box('Pressure access captive latch',(side*1.44,4.69,-4.15),(.26,.038,.10),2,.009)
climate=loft('Crown life support housing',[(-3.33,0,1.05,4.51,4.69),(-2.77,0,1.22,4.51,4.96),
             (.98,0,1.10,4.51,4.94),(2.43,0,.77,4.51,4.72)],0,edge=.035)
g.apply(climate)
cutter=g.box('Temporary climate service well',(0,4.98,-.89),(1.32,.53,2.22),surface,.045)
g.apply(cutter);g.cut(climate,cutter)
box('Climate service well backplate',(0,4.724,-.89),(1.23,.04,2.13),1,.012)
for z in (-1.70,-1.29,-.88,-.47,-.06):
    box('Climate heat exchange louver',(0,4.80,z),(1.20,.145,.115),4,.018)
for side in (-1,1):
    # Lower removable side covers land directly on the pressure crown.
    prism('Crown side service cover',[(side*1.39,-2.67),(side*2.19,-2.32),(side*2.19,1.96),(side*1.16,2.51)],4.591,4.516,7,hull,.018)

# Wider fixed vestibule behind the cabin portal: safe route to rover's side door.
box('VestibuleFloor',(0,1.32,3.95),(5.8,.16,1.1),1,0,cabin,keep=True)
for side in (-1,1):
    box('Cabin portal side',(side*1.92,2.62,3.44),(2.12,2.44,.08),0,.018,cabin)
    box('Cabin portal jamb',(side*.875,2.60,3.40),(.05,2.40,.12),2,.006,cabin)
    box('Vestibule side wall',(side*2.975,3.0,3.95),(.15,3.2,1.10),1,.01,cabin)
box('Cabin portal lintel',(0,3.88,3.40),(1.8,.16,.13),2,.01,cabin)
box('Vestibule roof',(0,4.66,3.94),(5.92,.12,1.14),0,.015,hull)
# A fitted pressure transom bridges the cabin crown and the higher vestibule
# roof. Its underside preserves the canonical 3.8 m portal clearance.
box('Cabin roof transition transom',(0,4.21,3.39),(5.92,.82,.16),0,.008,hull)

# Rear carrier box is hollow: roof and side cargo banks are outside the NET bay.
roof=box('Vehicle bay roof',(0,4.70,7.4975),(8.48,.20,6.005),0,.02,hull)
g.apply(roof)
for side in (-1,1):
    # Two genuine roof openings expose flush work-lamp diffusers. The luminous
    # lower face is 1 mm above the reserved 4.600 m clear bay boundary.
    cutter=g.box('Temporary bay lamp roof pocket',(side*1.88,4.70,7.44),(.65,.50,.28),surface,0)
    g.cut(roof,cutter)
    for dx in (-.3125,.3125):box('Flush bay lamp side frame',(side*1.88+dx,4.7005,7.44),(.025,.199,.23),1,0,cabin)
    for dz in (-.1275,.1275):box('Flush bay lamp end frame',(side*1.88,4.7005,7.44+dz),(.65,.199,.025),1,0,cabin)
    box('Bay work lamp diffuser',(side*1.88,4.631,7.44),(.600,.060,.230),bevel=0,parent=cabin,mat=mint,collision=False)
    g.empty('CabinLight_Bay_'+('Port' if side<0 else 'Starboard'),(side*1.88,4.601,7.44),cabin)
for z in (4.78,7.1,9.7):
    box('Overhead bay reinforcement',(0,4.645,z),(5.78,.07,.17),2,.008,cabin)
    if z!=7.1:
        # Two transverse load arches return into the shoulder roots. Their
        # underside lies above the actual pressure roof and retained lamps.
        profile=[(-4.78,4.80),(-4.49,5.16),(-3.55,5.13),(-2.93,5.01),
                 (2.93,5.01),(3.55,5.13),(4.49,5.16),(4.78,4.80)]
        points=[(x,y,zz) for zz in (z-.14,z+.14) for x,y in profile];count=len(profile)
        faces=[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]
        faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        remember(g.mesh('Bay roof transverse load arch',points,faces,surface,.025,hull),1)
box('Bay roof recessed service spine',(0,4.831,7.36),(1.02,.07,4.39),1,.018)
for side in (-1,1):
    # Two longitudinal cassette covers share the load arches, with a narrow
    # accessible service spine between them. These are fitted roof structure,
    # not more broad panels stacked on the previous repeated hatch pattern.
    prism('Bay roof longitudinal cassette',[(side*.60,5.03),(side*3.44,5.03),(side*3.74,5.56),
          (side*3.63,8.88),(side*3.24,9.43),(side*.60,9.43)],4.936,4.793,0,hull,.028)
    box('Bay roof service hinge',(side*3.55,4.943,6.3),(.085,.09,.69),2,.012)
    box('Bay roof captive service latch',(side*1.01,4.956,8.65),(.31,.041,.11),2,.009)
for side in (-1,1):
    for z in (4.78,7.1,9.7):
        if z!=7.1:box('Bay roof service inset',(side*1.88,4.607,z+.34),(.65,.008,.28),4,.002,cabin)
    box('Freight bank outer wall',(side*4.17,3.00,7.74),(.12,3.30,6.48),1,.014,hull)
    box('Freight bank forward pressure closure',(side*3.56,3.0,4.46),(1.32,3.2,.08),0,.012,hull)
    box('Freight bank floor',(side*3.50,1.32,7.74),(1.20,.16,6.48),1,0,cabin)
    box('Freight bank upper closure',(side*3.51,3.98,7.74),(1.18,.12,6.48),0,.016,hull)
    # Four anchors on the OUTER wall: no posts consume the 128 SBU volume.
    for z in (4.58,6.10,7.62,9.23):
        box('Cargo restraint anchor',(side*4.13,2.05,z),(.026,.30,.13),2,.004,cabin)
    box('Rear portal jamb',(side*3.005,3.03,10.89),(.17,3.31,.20),2,.018,hull)
    rod('Rear entry lamp',(side*3.11,1.52,10.974),(side*3.11,3.68,10.974),.024,parent=hull,mat=mint,collision=False)
    box('Bay side service liner',(side*2.965,2.92,10.145),(.12,3.02,1.65),4,.016,cabin)
    # Lower guide mechanism sits beside platform edges, never on the wheel path.
    for z in (4.18,10.33):
        rod('Elevator guide column',(side*3.055,.13,z),(side*3.055,4.30,z),.064,2)
        box('Elevator guide housing',(side*3.15,2.16,z),(.13,4.16,.19),1,.014)
    g.empty('CargoGrid_'+('Port' if side<0 else 'Starboard'),L['cargo']['grids'][0 if side<0 else 1]['min'],cabin)

lift=g.empty('VehicleLift',(0,1.4,0),root)
box('LiftDeck',(0,1.32,7.75),(5.8,.16,6.5),1,0,lift,keep=True)
for side in (-1,1):
    box('Lift recessed edge reinforcement',(side*2.77,1.286,7.75),(.22,.10,6.43),2,.01,lift)
    for z in (5.15,6.80,8.45,10.1):
        box('Flush deck tie-down',(side*2.45,1.399,z),(.13,.002,.18),2,.008,lift,collision=False)
    box('Vehicle guide paint',(side*1.93,1.4005,7.70),(.05,.001,5.60),5,0,lift,collision=False)
box('Rear threshold hazard stripe',(0,1.4005,10.82),(5.45,.001,.11),5,0,lift,collision=False)
for x in (-2.75,2.75):box('Lift edge amber marker',(x,1.4005,10.96),(.16,.001,.04),bevel=0,parent=lift,mat=amber,collision=False)

# Two fixed real call panels: upper approach on the vestibule wall, lower
# approach beside the rear portal. Neither consumes the 5.8 m bay or cargo cells.
upper=g.empty('LiftCall_Upper',L['controls'][0]['position'],cabin)
box('Upper call panel housing',(2.928,2.61,4.25),(.10,.48,.30),1,.012,upper)
box('Upper call panel face',(2.874,2.61,4.25),(.010,.39,.23),4,.008,upper)
for y in (2.54,2.65):box('Upper physical call key',(2.865,y,4.25),(.018,.055,.11),2,.004,upper)
rod('Upper call panel status',(2.863,2.77,4.18),(2.863,2.77,4.32),.009,parent=upper,mat=mint,collision=False)
text('Upper access panel legend','LIFT',(2.861,2.44,4.25),.07,upper,rotation=(math.pi/2,0,-math.pi/2))
lower=g.empty('LiftCall_Lower',L['controls'][1]['position'],root)
box('Lower call panel housing',(3.31,1.0,10.95),(.40,.48,.06),1,.013,lower)
box('Lower call panel face',(3.31,1.0,10.983),(.32,.40,.006),4,.01,lower)
for x in (3.22,3.40):box('Lower physical call key',(x,.91,10.990),(.08,.08,.01),2,.005,lower)
text('Lower access panel legend','ACCESS',(3.31,1.10,10.991),.065,lower)

hatch=g.empty('RearHatch',L['hatch']['pivot'],root)
h=L['hatch']
for i in range(h['slats']):
    y=h['bottom']+h['slatHeight']*(i+.5)
    slat=g.empty('HatchSlat_'+str(i+1),(0,y,h['closedZ']),hatch)
    box('Hatch armored slat',(0,y,h['closedZ']),(5.80,h['slatHeight']-.008,h['slatDepth']),0,.012,slat)
    box('Hatch recessed slat seam',(0,y-h['slatHeight']/2+.015,h['closedZ']+.032),(5.61,.014,.005),1,.001,slat,collision=False)
# The leaves run in separate depth tracks inside a closed fixed cassette. The
# top skin leaves over 20 mm above the actual fully retracted leaf geometry.
box('Rear hatch cassette',(0,5.235,10.68),(6.16,.12,.64),1,.018)
box('Hatch cassette front pressure skin',(0,4.94,10.49),(5.92,.68,.04),1,.004)
box('Hatch cassette rear pressure skin',(0,4.94,10.990),(5.92,.68,.014),4,.003)
box('Rear cassette upper fairing',(0,5.33,10.30),(6.40,.16,1.38),0,.025)
for x in (-3.02,3.02):box('Hatch cassette track cover',(x,4.94,10.65),(.14,.68,.67),4,.012)
box('Aft registration backing',(0,5.45,10.66),(6.16,.30,.65),0,.018)
text('Gannet aft registration','GANNET  /  T-06',(0,5.445,10.99),.20)
mark=remember(g.mesh('Approved Meridian badge',[(-2.825,5.315,10.992),(-2.575,5.315,10.992),(-2.575,5.565,10.992),(-2.825,5.565,10.992)],[(0,1,2,3)],badge,0,hull,recalc=False),0,False)
uv=mark.data.uv_layers.new(name='UVMap')
for loop,coord in zip(mark.data.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=coord

# Genuine deployable four-post telescoping gear. Pads close the recessed wells;
# sleeve starts above 2.06 m and piston translates inside it when gear is up.
for gear in L['gear']['nodes']:
    x,y,z=gear['position'];leg=g.empty(gear['node'],gear['position'],root)
    # The steel shoe starts above the sole. Their former coplanar Y=0 bottom
    # faces exposed metal through rubber; total pad/gear envelope stays exact.
    box('Load foot',(x,.118,z),(1.46,.164,1.82),2,.035,leg)
    box('Foot elastomer contact',(x,.020,z),(1.30,.04,1.66),3,.01,leg)
    rod('Telescoping gear piston',(x,.24,z),(x,2.36,z),.125,2,leg,segments=16)
    rod('Fixed gear sleeve',(x,2.06,z),(x,4.20,z),.18,1,segments=16)
    rod('Sleeve retaining collar',(x,2.06,z),(x,2.18,z),.23,2,segments=16)
    box('Fixed landing-gear load saddle',(x,2.30,z),(.66,.22,.58),2,.025)
    for dz in (-.58,.58):rod('Landing pad load brace',(x,.20,z+dz),(x,.80,z),.047,2,leg)
    box('Gear service cover',(x,4.29,z),(1.00,.05,1.10),4,.018)

# Hollow engine annuli and fixed named fleet-effect anchors.
for engine in L['engines']:
    x,y,z=engine['position'];g.empty(engine['node'],engine['position'],root)
    # A hollow shroud needs an actual opening through the housing behind it.
    # The prior closed loft end cap covered the complete working throat.
    for skin in drive_skins[-1 if x<0 else 1]:
        g.apply(skin)
        cutter=g.rod('Temporary drive nozzle bore',(x,y,9.60),(x,y,10.78),.84,surface,48)
        g.cut(skin,cutter)
    remember(g.annulus('Drive graphite nozzle collar',x,y,[(9.04,1.09),(9.33,1.16),(9.70,1.15),(10.21,1.04),(10.57,.90),
                 (10.58,.806),(10.11,.73),(9.72,.66),(9.04,.69)],surface,hull,40),1)
    remember(g.annulus('Nozzle collar retaining band',x,y,[(9.40,1.171),(9.48,1.184),(9.64,1.171)],surface,hull,40),2)
    remember(g.annulus('Nozzle machined lip',x,y,[(10.55,.915),(10.63,.877),(10.65,.84),(10.65,.812),(10.57,.800)],surface,hull,40),2)
    remember(g.annulus('Recessed nozzle graphite throat',x,y,[(10.51,.807),(10.09,.706),(9.71,.648)],surface,hull,40),1)
    # The tapered drive now exposes a genuine deep chamber. Its dark rear
    # bulkhead joins the inner collar behind the stator and luminous annulus;
    # otherwise axial gaps between stators would see through the whole engine.
    rod('Recessed drive chamber bulkhead',(x,y,9.54),(x,y,9.59),.69,1,segments=40)
    remember(g.annulus('Drive luminous core',x,y,[(9.78,.65),(9.77,.56)],mint,hull,40),0,False)
    rod('Dark turbine centre',(x,y,9.70),(x,y,9.78),.22,1,segments=24)
    for i in range(12):
        a=i*math.tau/12
        rod('Engine core radial stator',(x+.25*math.cos(a),y+.25*math.sin(a),9.78),(x+.60*math.cos(a+.16),y+.60*math.sin(a+.16),9.78),.022,2,segments=6)

# Fitted cabin: seats, two berths, accessible lockers, galley and actual MFDs.
def soft_pad(name,pos,size,parent=cabin,rotation=0):
    """Closed compliant upholstery, with a rounded crown and fitted welt.

    All rings remain inside the former pad envelope. The welt is a physical
    stitched edge seated in the shoulder, not a dark painted contact shadow.
    """
    width,thickness,depth=size;rot=Matrix.Rotation(rotation,4,'X')
    def contour(scale):
        w,d=width*scale/2,depth*scale/2;r=min(w,d)*.30
        return [(cx+r*math.cos(a),cz+r*math.sin(a))
            for cx,cz,start in [(w-r,d-r,0),(-w+r,d-r,math.pi/2),(-w+r,-d+r,math.pi),(w-r,-d+r,math.pi*1.5)]
            for a in [start+i*math.pi/6 for i in range(4)]]
    def q(x,y,z):return tuple(Vector(pos)+rot@Vector((x,y,z)))
    rings=[(-.5,.86),(-.32,.98),(.10,1),(.38,.92),(.50,.72)]
    points=[q(x,y*thickness,z) for y,scale in rings for x,z in contour(scale)];count=16
    faces=[tuple(range(count-1,-1,-1)),tuple(range((len(rings)-1)*count,len(rings)*count))]
    faces += [(j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i) for j in range(len(rings)-1) for i in range(count)]
    remember(g.mesh(name,points,faces,surface,0,parent,smooth=True),6)
    edge=contour(.998);radius=.0035
    for i,(x,z) in enumerate(edge):
        xx,zz=edge[(i+1)%len(edge)]
        rod(name+' fitted welt',q(x,thickness*.10,z),q(xx,thickness*.10,zz),radius,1,parent,segments=6,collision=False)

def seat(name,x,z):
    chair=g.empty(name,(x,1.4,z),cabin)
    box('Seat pedestal',(x,1.61,z),(.46,.42,.46),2,.025,chair)
    soft_pad('Seat cushion',(x,1.94,z-.13),(.68,.18,.68),chair)
    soft_pad('Seat back',(x,2.30,z+.28),(.72,.14,.68),chair,-math.pi/2)
    soft_pad('Seat head restraint',(x,2.66,z+.25),(.40,.16,.18),chair,-math.pi/2)
    for side in (-1,1):
        box('Seat arm',(x+side*.37,2.10,z-.10),(.07,.10,.50),2,.015,chair)
        rod('Seat harness',(x+side*.15,2.58,z+.17),(x+side*.22,2.06,z-.13),.018,1,chair)
    return chair
seat('PilotChair',0,-8.4);seat('PassengerChair',1.30,-5.76)
for side in (-1,1):
    plinth=box('Berth storage plinth',(side*1.5,1.64,-2.725),(.94,.48,2.12),1,.035,cabin)
    # A real recessed toe kick leaves the end feet and lower sole in contact.
    g.apply(plinth)
    cutter=g.box('Temporary berth toe recess',(side*1.037,1.50,-2.725),(.14,.14,1.77),surface,.015)
    g.apply(cutter);g.cut(plinth,cutter)
    box('Berth fitted storage front',(side*1.025,1.74,-2.725),(.024,.21,1.92),4,.012,cabin)
    soft_pad('Rest berth mattress',(side*1.5,1.98,-2.725),(.89,.19,2.01))
    soft_pad('Rest pillow',(side*1.5,2.11,-3.42),(.75,.15,.42))
    box('Berth upper service cubby',(side*1.68,3.34,-2.7),(.52,.63,2.08),0,.026,cabin)
    box('Cubby fitted ceiling return',(side*1.74,3.753,-2.7),(.40,.224,2.04),1,.012,cabin)
    box('Berth reading lamp',(side*1.965,2.7,-3.33),(.04,.06,.24),parent=cabin,mat=mint,collision=False)
    box('Cabin equipment locker',(side*1.66,2.4,.52),(.63,1.98,2.08),0,.035,cabin)
    box('Locker floor plinth',(side*1.66,1.425,.52),(.61,.05,2.06),1,.006,cabin)
    box('Locker fitted ceiling return',(side*1.74,3.6225,.52),(.40,.485,2.04),1,.012,cabin)
    for z in (-.06,1.02):
        box('Locker petrol front',(side*1.33,2.52,z),(.03,1.56,.85),4,.015,cabin)
        rod('Locker recessed handle',(side*1.30,2.26,z-.21),(side*1.30,2.53,z-.21),.018,2,cabin)
box('Instrument support shelf',(0,2.32,-10.27),(2.83,.16,.46),1,.025,cabin)
for definition in L['mfdMounts']:
    pos=Vector(definition['position']);anchor=g.empty(definition['anchor'],pos,cabin);anchor.rotation_euler.x=definition['rotation'][0]
    # Rotation is expressed in game coordinates, transformed once into Blender.
    rot=Matrix.Rotation(definition['rotation'][0],4,'X')
    def q(x,y,z):return tuple(pos+rot@Vector((x,y,z)))
    w,h=definition['width']/2,definition['height']/2
    # This open face has an authored pilot-facing normal. Recalculating normals
    # on an isolated polygon can flip the solidify direction across the screen.
    bezel=remember(g.mesh('MFD bezel',[q(-w-.025,-h-.025,-.035),q(w+.025,-h-.025,-.035),q(w+.025,h+.025,-.035),q(-w-.025,h+.025,-.035)],[(0,1,2,3)],surface,0,cabin,recalc=False),1)
    stock=bezel.modifiers.new('Panel stock','SOLIDIFY');stock.thickness=.05;stock.offset=-1
    edge=bezel.modifiers.new('Panel edge','BEVEL');edge.width=.012;edge.segments=2
    bezel.modifiers.new('Panel normals','WEIGHTED_NORMAL')
    screen=remember(g.mesh(definition['node'],[q(-w,-h,0),q(w,-h,0),q(w,h,0),q(-w,h,0)],[(0,1,2,3)],screenmat,0,cabin,recalc=False),0,False,True)
    uv=screen.data.uv_layers.new(name='UVMap')
    for loop,coord in zip(screen.data.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=coord
    for side in (-1,1):
        for j in range(3):box('MFD hardware key',q(side*(w+.014),-.105+j*.10,.008),(.012,.021,.008),2,.002,cabin,collision=False)
for side in (-1,1):
    rod('Pilot control column',(side*.58,1.48,-8.94),(side*.58,2.11,-8.91),.032,2,cabin)
    box('Pilot control grip',(side*.58,2.15,-8.89),(.09,.20,.12),3,.015,cabin)
    box('Pilot pedal',(side*.19,1.50,-9.15),(.19,.10,.26),2,.012,cabin)
g.empty('PilotEye',L['seatEye'],root);g.empty('StandEye',L['stand'],root);g.empty('RoverPark',L['rover']['park'],root)

# Exterior identity, service fasteners and low-contrast panel boundaries.
text('Gannet bow model','GANNET', (0,2.39,-12.06),.38,rotation=(0,0,0))
for side in (-1,1):
    text('Meridian side model','MERIDIAN  /  T-06',(side*2.64,3.03,-4.40),.24,rotation=(math.pi/2,0,side*math.pi/2))
    for z in (-6.0,-3.3,-.6,2.1):
        for x in (side*2.15,side*.68):rod('Crown flush fastener',(x,4.535,z),(x,4.551,z),.030,2,segments=6,collision=False)

# Apply deterministic modifiers and UVs before any material batching. Geometry
# hierarchy and provenance survive export; raw collision pieces are measured
# before batching so a hollow room is never represented by one filled AABB.
bpy.context.view_layer.update()
for obj in parts:
    if obj.type!='MESH':continue
    g.apply(obj)
    if obj.data.materials and obj.data.materials[0]==surface:
        uv=obj.data.uv_layers.new(name='UVMap') if not obj.data.uv_layers else obj.data.uv_layers.active
        tile=int(obj['gannetTile']);tx,ty=tile%4,tile//4
        for face in obj.data.polygons:
            axis=max(range(3),key=lambda k:abs(face.normal[k]));axes=[k for k in range(3) if k!=axis]
            values=[obj.data.vertices[obj.data.loops[i].vertex_index].co for i in face.loop_indices]
            low=[min(v[k] for v in values) for k in axes];span=[max(v[k] for v in values)-low[j] for j,k in enumerate(axes)]
            for li,v in zip(face.loop_indices,values):
                a=[(v[k]-low[j])/span[j] if span[j]>1e-8 else .5 for j,k in enumerate(axes)]
                # Atlas rows are declared from the PNG top edge. Blender V
                # starts at the bottom; glTF flips it on export. Correct this
                # once here so graphite cannot silently sample amber below it.
                uv.data[li].uv=((tx+(4+248*a[0])/256)/4,1-(ty+(4+504*a[1])/512)/2)
    elif not obj.data.uv_layers:
        obj.data.uv_layers.new(name='UVMap')
    world=[obj.matrix_world@v.co for v in obj.data.vertices]
    xyz=[(v.x,v.z,-v.y) for v in world]
    if obj.get('collision'):
        low=[min(v[k] for v in xyz) for k in range(3)];high=[max(v[k] for v in xyz) for k in range(3)]
        ancestor=obj.parent
        while ancestor and ancestor not in (root,hull,cabin) and not ancestor.name.startswith(('Gear_','HatchSlat_')) and ancestor!=lift:ancestor=ancestor.parent
        colliders.append({'name':obj.name,'node':ancestor.name if ancestor else root.name,'min':low,'max':high})

def bake_static_cavity(objects):
    """Deterministic cosine-hemisphere vertex AO from actual fixed geometry.

    Short-range rays describe cavities and fixed furniture contact only. Gear,
    hatch leaves and the elevator neither cast nor receive this baked term;
    their Col values are exactly white. There is no rover, terrain, world-light
    direction or selected mechanism pose in the occluder set.
    """
    radius=.42;bias=.0035;rays=24
    def moving(obj):
        p=obj
        while p:
            if p.name=='VehicleLift' or p.name.startswith(('Gear_','HatchSlat_')):return True
            p=p.parent
        return False
    receivers=[o for o in objects if o.type=='MESH' and o.data.materials[0]==surface]
    fixed=[o for o in receivers if not moving(o)]
    verts=[];polygons=[]
    for obj in fixed:
        offset=len(verts);verts.extend(obj.matrix_world@v.co for v in obj.data.vertices)
        polygons.extend(tuple(offset+i for i in poly.vertices) for poly in obj.data.polygons)
    tree=BVHTree.FromPolygons(verts,polygons,all_triangles=False)
    directions=[]
    for i in range(rays):
        r=math.sqrt((i+.5)/rays);angle=i*math.pi*(3-math.sqrt(5))
        directions.append((r*math.cos(angle),r*math.sin(angle),math.sqrt(1-r*r)))
    summary={'method':'Deterministic cosine-hemisphere local vertex AO; actual fixed opaque mesh only',
        'radiusMetres':radius,'originBiasMetres':bias,'raysPerSample':rays,'maximumDarkening':.55,
        'exclusions':['VehicleLift','Gear_*','HatchSlat_*','glass','emitters','rover','terrain','world lights'],
        'staticObjects':len(fixed),'movingObjects':len(receivers)-len(fixed),'staticCorners':0,'movingWhiteCorners':0,'samples':0,'range':[1.,1.]}
    for obj in receivers:
        mesh=obj.data;col=mesh.color_attributes.new(name='Col',type='BYTE_COLOR',domain='CORNER')
        mesh.color_attributes.active_color=col
        if moving(obj):
            for entry in col.data:entry.color=(1,1,1,1)
            summary['movingWhiteCorners']+=len(col.data);continue
        normal_matrix=obj.matrix_world.to_3x3().inverted().transposed();cache={};values=[]
        for poly in mesh.polygons:
            # A geometric face normal avoids casting from a smoothed bevel
            # normal back into its own solid. This is AO, not a light bake.
            n=(normal_matrix@poly.normal).normalized()
            ref=Vector((1,0,0)) if abs(n.x)<.85 else Vector((0,1,0))
            u=n.cross(ref).normalized();v=n.cross(u)
            local_dirs=[u*x+v*y+n*z for x,y,z in directions]
            for li in poly.loop_indices:
                vi=mesh.loops[li].vertex_index;key=(vi,tuple(round(c,5) for c in n))
                if key not in cache:
                    origin=obj.matrix_world@mesh.vertices[vi].co+n*bias;occlusion=0
                    for direction in local_dirs:
                        hit=tree.ray_cast(origin,direction,radius)
                        if hit[0] is not None:occlusion+=max(0,1-hit[3]/radius)/rays
                    cache[key]=max(.45,1-.55*occlusion)
                value=cache[key];col.data[li].color=(value,value,value,1);values.append(value)
        summary['staticCorners']+=len(col.data);summary['samples']+=len(cache)
        summary['range'][0]=min(summary['range'][0],min(values,default=1))
        if obj.name=='CabinFloor':summary['cabinFloor']={'vertices':len(mesh.vertices),'range':[min(values),max(values)],'maximumInteriorGridMetres':.294}
    return summary

vertex_ao=bake_static_cavity(parts)

# Keep roots, moving nodes and each actual MFD/floor surface independently named.
groups={}
for obj in parts:
    if obj.type!='MESH' or obj.get('preserveNode'):continue
    groups.setdefault((obj.parent.name if obj.parent else '',obj.data.materials[0].name),[]).append(obj)
for (parentname,material),objects in sorted(groups.items()):
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=parentname+' / '+material
for obj in bpy.context.scene.objects:
    if obj.type=='MESH':obj['authoredSurface']=True
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
game=[(p.x,p.z,-p.y) for p in points]
bounds={'min':[min(p[k] for p in game) for k in range(3)],'max':[max(p[k] for p in game) for k in range(3)]}
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
if triangles>L['budgets']['triangles']:raise ValueError(f'Gannet geometry exceeds triangle budget: {triangles}')
report={'model':L['name'],'builder':'blender/build_gannet.py','layoutSha256':hashlib.sha256(layout_bytes).hexdigest(),
    'builderSha256':input_hashes['blender/build_gannet.py'],'geometryHelperSha256':input_hashes['blender/fighter_geometry.py'],'inputHashes':input_hashes,'blenderVersion':bpy.app.version_string,
    'sourceBounds':bounds,'sourceTriangles':triangles,'sourceMeshes':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),
    'vertexAmbientOcclusion':vertex_ao,
    'coordinateSystem':{'units':'metres','up':'+Y','forward':'-Z'},'collisionParts':colliders,
    'status':'Authored geometry/material checkpoint; runtime visual and physical game acceptance pending'}
(STAGE/'source-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/'gannet.blend'))
bpy.ops.export_scene.gltf(filepath=str(STAGE/'gannet.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
print('GANNET_SOURCE',json.dumps({'triangles':triangles,'meshes':len(meshes),'bounds':bounds}))
