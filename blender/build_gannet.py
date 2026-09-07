"""Original Meridian Gannet T-06. CPU geometry authoring, no renderer/bake.

Canonical units: metres, Y up, nose -Z. Run gannet_textures.py first, this file
inside Blender, then gannet_pack.py. Outputs stage before budgeted publication.
"""
from pathlib import Path
import bpy, json, math, sys, hashlib
from mathutils import Vector, Matrix
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
links.new(base.outputs['Color'],p.inputs['Base Color']);links.new(split.outputs['Green'],p.inputs['Roughness']);links.new(split.outputs['Blue'],p.inputs['Metallic'])
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
def loft(name,sections,tile=0,parent=hull):
    # Closed octagonal volumes, only used OUTSIDE the living and vehicle voids.
    pts=[]
    for z,x,w,low,high in sections:
        bevel=min(w*.25,(high-low)*.24)
        pts.extend([(x-w+bevel,low,z),(x+w-bevel,low,z),(x+w,low+bevel,z),(x+w,high-bevel,z),(x+w-bevel,high,z),(x-w+bevel,high,z),(x-w,high-bevel,z),(x-w,low+bevel,z)])
    faces=[tuple(range(7,-1,-1)),tuple(range((len(sections)-1)*8,len(sections)*8))]
    faces += [(j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(len(sections)-1) for i in range(8)]
    return remember(g.mesh(name,pts,faces,surface,.025,parent),tile)

# Low forward prow, pressure-cell skirts and continuous shoulder armor. The
# nose volume ends ahead of the pilot; no solid fuselage fills the cabin.
loft('Faceted forward prow',[(-13,0,1.10,1.62,2.08),(-12.2,0,2.25,1.25,2.38),(-10.5,0,2.62,1.25,2.31)],0)
for side in (-1,1):
    loft('Pressure cell lower chine', [(-10.6,side*2.15,.45,1.25,2.27),(-7.7,side*2.53,.48,1.18,2.24),(1.9,side*2.76,.53,1.18,2.31),(4.5,side*3.19,.28,1.24,2.20)],0)
    loft('Swept shoulder fairing',[(-10.2,side*2.80,.48,2.04,3.60),(-6.4,side*3.81,1.40,1.84,4.46),(1.8,side*4.95,.80,2.01,4.80),(8.7,side*4.73,.46,2.05,5.08)],0)
    # A single long drive housing and its joined haunch, not repeated boxes.
    loft('Outboard longitudinal drive', [(-8.3,side*5.6,.50,2.09,3.87),(-5.8,side*6.05,1.39,2.04,4.99),(1.0,side*6.23,1.57,2.04,5.27),(8.95,side*6.30,1.35,2.10,5.20),(10.55,side*6.3,1.04,2.58,4.86)],4)
    panel('Drive crown ceramic cap',[(side*5.12,5.02,-5.7),(side*6.18,5.27,1.0),(side*7.44,4.98,5.6),(side*7.32,4.97,8.6),(side*5.21,5.13,8.6)],0,.08)
    # Short blended upper fins explain the tall transport outline.
    panel('Aft vertical load stabilizer',[(side*4.54,4.68,3.1),(side*4.46,6.71,6.35),(side*4.63,7.18,8.05),(side*4.99,5.04,10.40)],4,.13)
    panel('Stabilizer ceramic leading edge',[(side*4.54,4.75,3.25),(side*4.46,6.71,6.35),(side*4.63,7.13,7.95),(side*4.65,6.14,6.55)],0,.045)
    # Flush lower gear wells with actual telescoping suspension inside the pod.
    for z in (-6.5,7.8):
        for dx in (-.78,.78):box('Gear well longitudinal wall',(side*5.45+dx,2.88,z),(.12,1.67,1.98),1)
        for dz in (-.94,.94):box('Gear well end wall',(side*5.45,2.88,z+dz),(1.48,1.67,.10),1)
        box('Gear well ceiling',(side*5.45,4.37,z),(1.50,.10,1.86),2)
    # Side service inset: gasket, nested face and shallow physical radiator ribs.
    for z in (-3.9,-1.2,1.5,4.2,6.9):
        box('Drive service gasket',(side*7.70,3.70,z),(.035,.92,1.95),1,.009)
        box('Drive service cover',(side*7.723,3.70,z),(.028,.83,1.84),4,.01)
        for dz in (-.63,-.31,0,.31,.63):box('Recessed service cooling fin',(side*7.748,3.70,z+dz),(.02,.66,.036),2,.002)
    rod('Drive mint running light',(side*7.76,4.51,-.7),(side*7.76,4.51,2.9),.024,parent=hull,mat=mint,collision=False)

# Pressure cabin: measured floor, fitted inner sidewalls, roof and windscreen.
floor_outline=[(-1.78,-10.64),(1.78,-10.64),(2.05,-9.45),(2.05,3.4),(-2.05,3.4),(-2.05,-9.45)]
floor=prism('CabinFloor',floor_outline,1.4,1.24,1,cabin,bevel=0);floor['preserveNode']=True
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
rod('Central windscreen mullion',(0,2.27,-10.76),(0,4.16,-10.09),.043,1,cabin)
rod('Windscreen top seal',(-1.78,4.17,-10.09),(1.78,4.17,-10.09),.06,1,cabin)
rod('Windscreen lower seal',(-1.92,2.26,-10.77),(1.92,2.26,-10.77),.06,1,cabin)
prism('Faceted cockpit crown',[(-1.80,-10.12),(1.80,-10.12),(2.25,-8.90),(2.26,-7.20),(-2.26,-7.20),(-2.25,-8.90)],4.33,4.17,0)
prism('Habitation crown',[(-2.26,-7.45),(2.26,-7.45),(2.45,-6.90),(2.45,2.65),(2.85,3.40),(-2.85,3.40),(-2.45,2.65),(-2.45,-6.90)],4.52,3.91,0)
for z in (-6.4,-3.7,-1.0,1.7):
    box('Ceiling liner cassette',(0,3.88,z),(3.98,.06,2.56),7,.013,cabin)
    for side in (-1,1):rod('Cabin ceiling work lamp',(side*1.60,3.825,z-.85),(side*1.60,3.825,z+.85),.024,parent=cabin,mat=mint,collision=False)
    box('Crown inset panel',(0,4.529,z),(3.78,.024,2.32),4,.018)

# Wider fixed vestibule behind the cabin portal: safe route to rover's side door.
box('VestibuleFloor',(0,1.32,3.95),(5.8,.16,1.1),1,0,cabin,keep=True)
for side in (-1,1):
    box('Cabin portal side',(side*1.92,2.62,3.44),(2.12,2.44,.08),0,.018,cabin)
    box('Cabin portal jamb',(side*.875,2.60,3.40),(.05,2.40,.12),2,.006,cabin)
    box('Vestibule side wall',(side*2.975,3.0,3.95),(.15,3.2,1.10),1,.01,cabin)
box('Cabin portal lintel',(0,3.88,3.40),(1.8,.16,.13),2,.01,cabin)
box('Vestibule roof',(0,4.66,3.94),(5.92,.12,1.14),0,.015,hull)

# Rear carrier box is hollow: roof and side cargo banks are outside the NET bay.
box('Vehicle bay roof',(0,4.70,7.41),(8.48,.20,5.83),0,.02,hull)
for side in (-1,1):
    for z in (4.78,7.1,9.7):
        box('Overhead bay reinforcement',(0,4.645,z),(5.78,.07,.17),2,.008,cabin)
        box('Bay roof service inset',(side*1.88,4.607,z+.34),(.65,.008,.28),4,.002,cabin)
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
for x in (-2.75,2.75):box('Lift edge amber marker',(x,1.40,10.96),(.16,.024,.04),parent=lift,mat=amber,collision=False)

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
box('Rear hatch cassette',(0,5.20,10.68),(6.16,.12,.64),1,.018)
box('Rear cassette upper fairing',(0,5.33,10.30),(6.40,.16,1.38),0,.025)
for x in (-3.02,3.02):box('Hatch cassette track cover',(x,4.92,10.65),(.14,.50,.67),4,.012)
box('Aft registration backing',(0,5.45,10.66),(6.16,.30,.65),0,.018)
text('Gannet aft registration','GANNET  /  T-06',(0,5.445,10.99),.20)
mark=remember(g.mesh('Approved Meridian badge',[(-2.825,5.315,10.992),(-2.575,5.315,10.992),(-2.575,5.565,10.992),(-2.825,5.565,10.992)],[(0,1,2,3)],badge,0,hull,recalc=False),0,False)
uv=mark.data.uv_layers.new(name='UVMap')
for loop,coord in zip(mark.data.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=coord

# Genuine deployable four-post telescoping gear. Pads close the recessed wells;
# sleeve starts above 2.06 m and piston translates inside it when gear is up.
for gear in L['gear']['nodes']:
    x,y,z=gear['position'];leg=g.empty(gear['node'],gear['position'],root)
    box('Load foot',(x,.1,z),(1.46,.20,1.82),2,.035,leg)
    box('Foot elastomer contact',(x,.020,z),(1.30,.04,1.66),3,.01,leg)
    rod('Telescoping gear piston',(x,.24,z),(x,2.36,z),.125,2,leg,segments=16)
    rod('Fixed gear sleeve',(x,2.06,z),(x,4.20,z),.18,1,segments=16)
    rod('Sleeve retaining collar',(x,2.06,z),(x,2.18,z),.23,2,segments=16)
    for dz in (-.58,.58):rod('Landing pad load brace',(x,.20,z+dz),(x,.80,z),.047,2,leg)
    box('Gear service cover',(x,4.29,z),(1.00,.05,1.10),4,.018)

# Hollow engine annuli and fixed named fleet-effect anchors.
for engine in L['engines']:
    x,y,z=engine['position'];g.empty(engine['node'],engine['position'],root)
    remember(g.annulus('Drive ceramic nozzle shroud',x,y,[(9.76,1.02),(10.46,1.05),(10.64,.96),(10.65,.82),(10.12,.78),(9.76,.79)],surface,hull,40),0)
    remember(g.annulus('Recessed nozzle metal throat',x,y,[(10.56,.83),(10.11,.72),(9.72,.66)],surface,hull,40),2)
    remember(g.annulus('Drive luminous core',x,y,[(9.78,.65),(9.77,.56)],mint,hull,40),0,False)
    rod('Dark turbine centre',(x,y,9.70),(x,y,9.78),.22,1,segments=24)
    for i in range(12):
        a=i*math.tau/12
        rod('Engine core radial stator',(x+.25*math.cos(a),y+.25*math.sin(a),9.78),(x+.60*math.cos(a+.16),y+.60*math.sin(a+.16),9.78),.022,2,segments=6)

# Fitted cabin: seats, two berths, accessible lockers, galley and actual MFDs.
def seat(name,x,z):
    chair=g.empty(name,(x,1.4,z),cabin)
    box('Seat pedestal',(x,1.61,z),(.46,.42,.46),2,.025,chair)
    box('Seat cushion',(x,1.94,z-.13),(.68,.18,.68),3,.045,chair)
    box('Seat back',(x,2.30,z+.28),(.72,.68,.14),6,.05,chair)
    box('Seat head restraint',(x,2.66,z+.25),(.40,.18,.16),3,.025,chair)
    for side in (-1,1):
        box('Seat arm',(x+side*.37,2.10,z-.10),(.07,.10,.50),2,.015,chair)
        rod('Seat harness',(x+side*.15,2.58,z+.17),(x+side*.22,2.06,z-.13),.018,1,chair)
    return chair
seat('PilotChair',0,-8.4);seat('PassengerChair',1.30,-5.76)
for side in (-1,1):
    box('Berth storage plinth',(side*1.5,1.64,-2.725),(.94,.48,2.12),4,.035,cabin)
    box('Rest berth mattress',(side*1.5,1.98,-2.725),(.89,.19,2.01),6,.055,cabin)
    box('Rest pillow',(side*1.5,2.11,-3.42),(.75,.15,.42),7,.045,cabin)
    box('Berth upper service cubby',(side*1.68,3.34,-2.7),(.52,.63,2.08),0,.026,cabin)
    box('Berth reading lamp',(side*1.965,2.7,-3.33),(.04,.06,.24),parent=cabin,mat=mint,collision=False)
    box('Cabin equipment locker',(side*1.66,2.4,.52),(.63,1.98,2.08),0,.035,cabin)
    for z in (-.06,1.02):
        box('Locker petrol front',(side*1.33,2.52,z),(.03,1.56,.85),4,.015,cabin)
        rod('Locker recessed handle',(side*1.30,2.26,z-.21),(side*1.30,2.53,z-.21),.018,2,cabin)
box('Instrument support shelf',(0,2.32,-10.08),(2.83,.16,.46),1,.025,cabin)
for definition in L['mfdMounts']:
    pos=Vector(definition['position']);anchor=g.empty(definition['anchor'],pos,cabin);anchor.rotation_euler.x=definition['rotation'][0]
    # Rotation is expressed in game coordinates, transformed once into Blender.
    rot=Matrix.Rotation(definition['rotation'][0],4,'X')
    def q(x,y,z):return tuple(pos+rot@Vector((x,y,z)))
    w,h=definition['width']/2,definition['height']/2
    bezel=panel('MFD bezel',[q(-w-.025,-h-.025,-.035),q(w+.025,-h-.025,-.035),q(w+.025,h+.025,-.035),q(-w-.025,h+.025,-.035)],1,.05,cabin)
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
                uv.data[li].uv=((tx+(4+248*a[0])/256)/4,(ty+(4+504*a[1])/512)/2)
    elif not obj.data.uv_layers:
        obj.data.uv_layers.new(name='UVMap')
    world=[obj.matrix_world@v.co for v in obj.data.vertices]
    xyz=[(v.x,v.z,-v.y) for v in world]
    if obj.get('collision'):
        low=[min(v[k] for v in xyz) for k in range(3)];high=[max(v[k] for v in xyz) for k in range(3)]
        ancestor=obj.parent
        while ancestor and ancestor not in (root,hull,cabin) and not ancestor.name.startswith(('Gear_','HatchSlat_')) and ancestor!=lift:ancestor=ancestor.parent
        colliders.append({'name':obj.name,'node':ancestor.name if ancestor else root.name,'min':low,'max':high})

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
    'coordinateSystem':{'units':'metres','up':'+Y','forward':'-Z'},'collisionParts':colliders,
    'status':'Authored geometry/material checkpoint; runtime visual and physical game acceptance pending'}
(STAGE/'source-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/'gannet.blend'))
bpy.ops.export_scene.gltf(filepath=str(STAGE/'gannet.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
print('GANNET_SOURCE',json.dumps({'triangles':triangles,'meshes':len(meshes),'bounds':bounds}))
