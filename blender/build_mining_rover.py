"""Original Meridian Burrow M-04, metres / Y up / -Z forward.
Build textures with rover_textures.py; run in Blender, then pack_mining_rover.py.
Named pivots are the runtime contract; the cabin is hollow and the tyres have
an actual steering/suspension keep-out. No external model or image input.
"""
from pathlib import Path
import sys, json, math
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
import fighter_geometry as g
SOURCE=ROOT/'assets/mining-rover'; OUT=ROOT/'public/models/mining-rover.glb'
L=json.loads((SOURCE/'layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

surface=bpy.data.materials.new('Meridian / ceramic, steel, polymer PBR');surface.use_nodes=True
nodes=surface.node_tree.nodes;links=surface.node_tree.links;p=nodes.get('Principled BSDF')
def tex(name,linear=False):
    n=nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(SOURCE/'textures'/f'surface-{name}.png'))
    if linear:n.image.colorspace_settings.name='Non-Color'
    return n
base=tex('basecolor');orm=tex('orm',True);normal=tex('normal',True)
split=nodes.new('ShaderNodeSeparateColor');links.new(orm.outputs['Color'],split.inputs['Color'])
links.new(base.outputs['Color'],p.inputs['Base Color']);links.new(split.outputs['Green'],p.inputs['Roughness']);links.new(split.outputs['Blue'],p.inputs['Metallic'])
n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.35;links.new(normal.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs['Normal'])
def plain(name,colour,rough=.5,metal=0,emission=0,alpha=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF')
    c=tuple((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in colour)
    s.inputs['Base Color'].default_value=(*c,alpha);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal
    if emission:s.inputs['Emission Color'].default_value=(*c,1);s.inputs['Emission Strength'].default_value=emission
    s.inputs['Alpha'].default_value=alpha
    if alpha<1:m.surface_render_method='BLENDED';m.use_transparent_shadow=False;m.use_backface_culling=False
    return m
glass=plain('Pressure glazing / lightly smoked blue',(.28,.47,.48),.14,.12,alpha=.18)
light=plain('Meridian mint work emitters',(.71,.94,.82),.3,emission=1.5)
amber=plain('Amber mineral bay / warning',(.97,.56,.15),.4,emission=.6)
ink=plain('Marking / graphite',(.07,.10,.11),.72)
rubber=plain('Vacuum tyre / graphite elastomer',(.066,.084,.089),.91,.015)
root=g.empty('MiningRover');root['manufacturer']='Meridian Shipworks';root['model']='Burrow M-04';root['closedCabin']=True
parts=[]
def remember(o,tile=0):o['tile']=tile;parts.append(o);return o
def box(name,p,size,tile=0,bevel=.016,parent=root,mat=None):return remember(g.box(name,p,size,mat or surface,bevel,parent),tile)
def rod(name,a,b,r,tile=2,parent=root,mat=None,n=12):
    o=g.rod(name,a,b,r,mat or surface,n,parent)
    # A machined rod has flat end caps and radial side normals. Averaging its
    # caps into the side makes short metal supports look like chrome domes.
    start=Vector(g.xyz(a));axis=(Vector(g.xyz(b))-start).normalized();normals=[]
    for face in o.data.polygons:
        cap=abs(face.normal.dot(axis))>.99
        for li in face.loop_indices:
            p=o.data.vertices[o.data.loops[li].vertex_index].co-start
            normal=face.normal.copy() if cap else (p-axis*p.dot(axis)).normalized()
            normals.append(normal)
    o.data.normals_split_custom_set(normals)
    return remember(o,tile)
def panel(name,points,tile=0,thick=.035,parent=root,mat=None):return remember(g.panel(name,points,mat or surface,thick,.009,parent),tile)
def ring(name,center,profile,tile=3,axis='X',parent=root,mat=None,segments=32):
    pts=[]
    for axial,r in profile:
        for i in range(segments):
            a=i*math.tau/segments
            q=(axial,r*math.cos(a),r*math.sin(a)) if axis=='X' else (r*math.cos(a),r*math.sin(a),axial)
            pts.append(tuple(center[j]+q[j] for j in range(3)))
    faces=[(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i) for k in range(len(profile)-1) for i in range(segments)]
    o=g.mesh(name,pts,faces,mat or surface,0,parent,True)
    # Smooth around each ring, retaining the actual hard profile breaks.
    # Explicit corner normals avoid broad faceted highlights on round sleeves.
    normals=[];axis_vector=Vector((1,0,0) if axis=='X' else (0,0,1));ring_center=Vector(center)
    for face in o.data.polygons:
        fn=Vector((face.normal.x,face.normal.z,-face.normal.y))
        face_center=Vector((face.center.x,face.center.z,-face.center.y))-ring_center
        radial=face_center-axis_vector*face_center.dot(axis_vector);radial.normalize()
        nr,na=fn.dot(radial),fn.dot(axis_vector)
        for li in face.loop_indices:
            p=o.data.vertices[o.data.loops[li].vertex_index].co
            p=Vector((p.x,p.z,-p.y))-ring_center
            r=p-axis_vector*p.dot(axis_vector);r.normalize()
            n=r*nr+axis_vector*na;n.normalize();normals.append(Vector(g.xyz(n)))
    o.data.normals_split_custom_set(normals)
    return remember(o,tile)
def text(name,body,pos,size,rotation=(-math.pi/2,0,0),parent=root,mat=ink):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.extrude=.0004;c.resolution_u=2;c.align_x='CENTER';c.align_y='CENTER'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=g.xyz(pos);o.rotation_euler=rotation;c.materials.append(mat);g.parent(o,parent)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');parts.append(o);return o

# Tapered underbody leaves the complete front tyre sweep clear.
remember(g.prism('Skid keel',[(-.50,-1.82),(.50,-1.82),(.68,-.72),(.68,1.88),(-.68,1.88),(-.68,-.72)],.45,.25,surface,.035,root),1)
box('Front narrow footwell',(0,.50,-1.11),(1.10,.08,1.02),1)
box('Cabin floor',(0,.42,.005),(1.64,.08,1.43),1)
box('Rear load frame',(0,1.01,1.30),(1.70,.24,1.40),1,.035)
for s in (-1,1):
    rod('Forward load rail',(s*.72,.52,-.63),(s*.72,.52,.70),.055)
    rod('Rear rail riser',(s*.72,.52,.70),(s*.72,.96,.70),.055)
    rod('Raised rear load rail',(s*.72,.96,.70),(s*.72,.96,1.92),.055)
    box('Rear bumper corner',(s*.65,.58,2.035),(.48,.23,.13),2)
    rod('Recovery eye',(s*.48,.39,2.02),(s*.48,.39,2.10),.085,2)
# Actual articulated control links. Runtime recomputes endpoints from each hub.
for link in L['links']:
    w=next(w for w in L['wheels'] if w['id']==link['wheel']);a=Vector(link['anchor']);b=Vector(w['position'])+Vector(link['wheelOffset']);length=(b-a).length
    arm=g.empty(link['node'],a,root);arm['restLength']=length
    if link['damper']:
        rod('Damper sleeve',a,a+Vector((0,length*.65,0)),.045,1,arm)
        rod('Damper piston',a+Vector((0,length*.59,0)),a+Vector((0,length,0)),.023,2,arm)
    else:rod('Articulated suspension arm',a,a+Vector((0,length,0)),.035,2,arm)
    arm.rotation_mode='QUATERNION';arm.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector(g.xyz(b-a)))

# Four 1.04 m tyres with recessed hubs; tread never exceeds declared radius.
for w in L['wheels']:
    pos=w['position'];s=-1 if pos[0]<0 else 1
    suspension=g.empty('Suspension_'+w['id'],pos,root)
    steer=g.empty(w['steer'] or 'Axle_'+w['id'],pos,suspension)
    wheel=g.empty(w['node'],pos,steer)
    rod('Non-spinning hub clevis',(pos[0]-s*.205,pos[1],pos[2]),(pos[0]-s*.32,pos[1],pos[2]),.055,2,steer)
    profile=[(-.20,.32),(-.20,.43),(-.16,.50),(-.115,.51),(.115,.51),(.16,.50),(.20,.43),(.20,.32),(-.20,.32)]
    ring('Vacuum tyre carcass',pos,profile,3,parent=wheel,mat=rubber)
    ring('Forged wheel rim',pos,[(-.205,.22),(-.205,.32),(-.19,.355),(.19,.355),(.205,.32),(.205,.22),(-.205,.22)],2,parent=wheel)
    rod('Hub motor',(pos[0]-.208,pos[1],pos[2]),(pos[0]+.208,pos[1],pos[2]),.205,1,wheel,n=20)
    rod('Hub cap',(pos[0]+s*.208,pos[1],pos[2]),(pos[0]+s*.217,pos[1],pos[2]),.13,4,wheel,n=16)
    for i in range(20):
        a=i*math.tau/20
        # Thin chevron pads, with extrema exactly within R=.52.
        points=[]
        for x in (-.13,0,.13):
            aa=a+(.025 if x==0 else -.025)
            for da in (-.035,.035):points.append((pos[0]+x,pos[1]+.52*math.cos(aa+da),pos[2]+.52*math.sin(aa+da)))
        panel('Tread chevron',[points[i] for i in (0,2,4,5,3,1)],3,.001,wheel,mat=rubber)
    for i in range(6):
        a=i*math.tau/6
        rod('Recessed hub fastener',(pos[0]+s*.209,pos[1]+.17*math.cos(a),pos[2]+.17*math.sin(a)),(pos[0]+s*.220,pos[1]+.17*math.cos(a),pos[2]+.17*math.sin(a)),.023,2,wheel,n=6)

# Hollow pressure cell: narrow footwell, faceted upper panoramic glazing.
box('Footwell front',(0,.89,-1.59),(1.16,.80,.07),0)
for s in (-1,1):
    box('Footwell side',(s*.585,.87,-1.13),(.07,.76,.91),0)
    panel('Upper chine',[(s*.55,1.28,-1.62),(s*.86,1.32,-1.60),(s*.86,1.32,-.70),(s*.55,1.28,-.70)],4,.045)
    panel('Front quarter glazing',[(s*.86,1.36,-1.60),(s*.82,2.405,-1.15),(s*.84,2.405,-.69),(s*.86,1.36,-.69)],parent=root,mat=glass,thick=.010)
    rod('A pillar',(s*.86,1.30,-1.61),(s*.80,2.36,-1.15),.045,2)
    rod('Cabin shoulder frame',(s*.86,1.32,-1.63),(s*.86,1.32,-.69 if s<0 else .68),.043,1)
    rod('Roof rail',(s*.81,2.405,-1.10),(s*.81,2.405,.65),.045,2)
    box('Rear cabin pillar',(s*.845,1.43,.695),(.075,1.95,.075),0)
    box('Rear suspension mount',(s*.74,.665,1.70),(.10,.47,.10),2)
    # Fenders protect rear tyre crown; open front wells permit full steering.
    box('Rear wheel fender',(s*1.065,1.31,1.35),(.45,.08,1.18),0)
    # Folded outer return and inboard mounting shoulder give the crown real
    # structure without descending into the tested tyre/suspension envelope.
    box('Fender outer return',(s*1.272,1.325,1.35),(.045,.11,1.16),0,.012)
    box('Fender mounting shoulder',(s*.866,1.305,1.35),(.065,.14,1.10),1,.015)
    box('Fender mint identification',(s*1.291,1.313,1.36),(.010,.025,.36),mat=light)
box('Rear pressure bulkhead',(0,1.43,.735),(1.70,1.94,.08),0)
remember(g.prism('Upper cabin roof',[(-.78,-1.16),(.78,-1.16),(.88,-1.06),(.88,.63),(.78,.73),(-.78,.73),(-.88,.63),(-.88,-1.06)],2.48,2.36,surface,.020,root),0)
box('Roof inset service skin',(0,2.483,-.215),(1.47,.018,1.56),4,.015)
for x in (-.66,.66):
    for z in (-.88,.44):rod('Roof flush fastener',(x,2.490,z),(x,2.495,z),.021,2,n=6)
panel('Sloping forehead',[(-.87,2.365,-1.155),(.87,2.365,-1.155),(.87,2.455,-1.04),(-.87,2.455,-1.04)],0,.06)
panel('Main windscreen',[(-.80,1.36,-1.66),(.80,1.36,-1.66),(.755,2.325,-1.17),(-.755,2.325,-1.17)],mat=glass,thick=.012)
rod('Front glass lower gasket',(-.84,1.33,-1.66),(.84,1.33,-1.66),.032,3)
rod('Windscreen center mullion',(0,1.34,-1.664),(0,2.355,-1.155),.026,1)
# Starboard fixed side, port hinged opening between the axles.
panel('Starboard lower pressure skin',[(.86,.47,-.65),(.86,1.31,-.65),(.86,1.31,.67),(.86,.47,.67)],0)
panel('Starboard side glazing',[(.86,1.36,-.64),(.82,2.345,-.64),(.82,2.345,.63),(.86,1.36,.63)],mat=glass,thick=.01)
for z in (-.68,.44):box('Door jamb',(-.875,1.43,z),(.09,1.94,.055),2)
door=g.empty('CabinDoor',L['cabin']['doorHinge'],root)
box('Door lower armor',(-.872,.895,-.12),(.064,.82,1.00),0,parent=door)
panel('Door upper glazing',[(-.876,1.335,-.62),(-.827,2.345,-.62),(-.827,2.345,.38),(-.876,1.335,.38)],mat=glass,thick=.01,parent=door)
for z in (-.635,.395):rod('Door edge seal',(-.87,.475,z),(-.828,2.332,z),.022,3,door)
box('Door top seal',(-.828,2.344,-.12),(.034,.032,1.074),3,.001,parent=door)
rod('Door window sill',(-.879,1.315,-.63),(-.879,1.315,.39),.026,2,door)
box('Door latch socket',(-.913,1.12,-.44),(.034,.17,.14),1,parent=door)
rod('Door handle',(-.955,1.10,-.485),(-.955,1.10,-.395),.022,2,door)
for y in (.66,1.92):rod('Pressure door hinge',(-.98,y-.065,.46),(-.98,y+.065,.46),.042,2)
# Continuous fixed pressure frame around the moving port door and side windows.
rod('Starboard window divider',(.85,1.32,-.665),(.85,2.385,-.665),.038,2)
for s in (-1,1):rod('Rear window closure',(s*.838,1.32,.645),(s*.838,2.39,.645),.025,2)
panel('Port aft fixed glazing',[(-.86,1.36,.457),(-.82,2.36,.457),(-.82,2.36,.67),(-.86,1.36,.67)],mat=glass,thick=.01)
panel('Port aft pressure skin',[(-.86,.47,.47),(-.86,1.32,.47),(-.86,1.32,.67),(-.86,.47,.67)],0)
rod('Port aft window sill',(-.86,1.333,.47),(-.86,1.333,.69),.029,2)
box('Starboard header seal',(.827,2.348,.005),(.07,.026,1.30),3,.002)
steps=g.empty('BoardingSteps',(-.87,.46,-.1),root)
for x,y in ((-1.55,.16),(-1.19,.34),(-.94,.44)):
    box('Port boarding tread',(x,y,-.1),(.34,.045,.58),2,parent=steps)
    for z in (-.30,-.20,-.10,0,.10):box('Grip strip',(x,y+.025,z),(.30,.008,.022),3,.001,parent=steps)
for z in (-.31,.11):
    panel('Boarding step stringer',[(x,y,z) for x,y in [(-1.66,.143),(-1.37,.143),(-1.37,.323),(-1.00,.323),(-1.00,.423),(-.80,.423),(-.80,.378),(-.955,.378),(-.955,.278),(-1.325,.278),(-1.325,.098),(-1.66,.098)]],2,.035,parent=steps)
    box('Step chassis attachment',(-.825,.41,z),(.09,.10,.08),1,.008,parent=steps)

# Service armor is nested into the pressure cell, with real gasket reveal and
# fasteners. It does not change the cabin opening or the cutter sweep.
box('Front service gasket',(0,.88,-1.631),(.88,.48,.015),1,.024)
box('Front service cover',(0,.88,-1.646),(.82,.42,.018),4,.028)
for x in (-.35,.35):
    for y in (.72,1.04):rod('Front quarter-turn fastener',(x,y,-1.650),(x,y,-1.666),.018,2,n=6)
for s in (-1,1):
    side=door if s<0 else root
    base=.906 if s<0 else .863
    box('Pressure cell inset gasket',(s*base,.88,-.105),(.012,.56,.76),1,.018,parent=side)
    box('Pressure cell service skin',(s*(base+.010),.88,-.105),(.014,.49,.69),4,.016,parent=side)
    for z in (-.36,.15):box('Service panel latch',(s*(base+.020),.88,z),(.010,.11,.035),2,.004,parent=side)

# Reuse the approved production emblem, including its transparent edge. The
# source is the existing Meridian identity, not a new generated logo.
badge=bpy.data.materials.new('Meridian production emblem');badge.use_nodes=True
badge.surface_render_method='BLENDED';badge.use_transparent_shadow=False
bn=badge.node_tree.nodes;bp=bn.get('Principled BSDF');bt=bn.new('ShaderNodeTexImage')
bt.image=bpy.data.images.load(str(SOURCE/'textures/manufacturer.png'))
badge.node_tree.links.new(bt.outputs['Color'],bp.inputs['Base Color']);badge.node_tree.links.new(bt.outputs['Alpha'],bp.inputs['Alpha']);bp.inputs['Roughness'].default_value=.75
mark=g.mesh('Meridian manufacturer badge',[(.14,.74,-1.658),(-.14,.74,-1.658),(-.14,1.02,-1.658),(.14,1.02,-1.658)],[(0,1,2,3)],badge,0,root)
uv=mark.data.uv_layers.new(name='UVMap')
for loop in mark.data.loops:
    p=mark.data.vertices[loop.vertex_index].co
    uv.data[loop.index].uv=((.14-p.x)/.28,(p.z-.74)/.28)
parts.append(mark)

# Seat, footwell, yoke and consoles occupy measured space, never the entry aisle.
seatPartsStart=len(parts)
box('Seat pedestal',(.11,.69,-.11),(.41,.43,.40),1)
box('Seat cushion',(.10,.95,-.23),(.60,.15,.59),3,.032)
box('Seat back',(.10,1.30,.26),(.62,.66,.15),3,.035)
box('Seat head restraint',(.10,1.86,.06),(.35,.24,.15),1,.025)
for s in (-1,1):
    box('Seat shoulder bolster',(.10+s*.29,1.29,-.04),(.10,.53,.23),4,.022)
    rod('Harness',(.10+s*.14,1.58,-.055),(.10+s*.20,1.03,-.28),.025,5)
    box('Pedal',(.10+s*.17,.56,-1.28),(.14,.08,.24),2)
for piece in parts[seatPartsStart:]:
    if not piece.name.startswith('Pedal'):piece.location+=Vector(g.xyz((-.10,0,-.46)))
box('Instrument shelf',(0,1.24,-1.33),(1.10,.12,.39),1,.025)
box('Dashboard lower service panel',(0,1.04,-1.46),(1.10,.24,.16),4)
rod('Steering column',(.10,.88,-1.30),(.10,1.13,-1.10),.045,1)
yoke=g.empty('SteeringYoke',(.10,1.17,-1.085),root)
rod('Steering crossbar',(-.10,1.17,-1.085),(.30,1.17,-1.085),.025,2,yoke)
for x in (-.12,.32):rod('Yoke grip',(x,1.13,-1.085),(x,1.27,-1.085),.03,3,yoke)
# The live screen is inserted by runtime at this exact named surface.
screen=g.empty('RoverDisplay',(0,1.39,-1.355),root)
box('MFD surround',(0,1.39,-1.389),(.61,.29,.055),1)
box('MFD glass',(0,1.39,-1.355),(.55,.235,.008),mat=glass)
for s in (-1,1):
    for i in range(3):box('Console status lamp',(s*.39,1.312,-1.48+i*.08),(.06,.012,.026),mat=amber if i==2 else light)
box('Interior lamp',(0,2.35,.34),(.40,.012,.035),mat=light)

# Split sealed ore cassettes and service spine, readable from behind.
cargoPartsStart=len(parts)
for s in (-1,1):
    box('Mineral cassette',(s*.43,1.075,1.365),(.79,.71,1.18),4,.055)
    box('Mineral cassette lid',(s*.43,1.465,1.365),(.80,.07,1.20),0,.020)
    box('Cassette lid seal',(s*.43,1.419,1.365),(.795,.025,1.185),1,.009)
    for z in (.85,1.88):box('Cassette armored end',(s*.43,1.08,z),(.70,.58,.10),0,.030)
    for z in (.86,1.87):box('Cassette retaining latch',(s*.827,1.24,z),(.033,.16,.10),2,.010)
    for z in (.90,1.81):box('Ore cassette strap',(s*.43,1.508,z),(.75,.015,.05),2)
    box('Cassette rear armor',(s*.43,1.13,1.982),(.65,.43,.05),0)
    box('Ore status recess',(s*.43,1.18,2.014),(.41,.13,.018),1)
    box('Ore status light',(s*.43,1.18,2.029),(.27,.026,.01),mat=amber)
    rod('Cassette pull grip',(s*.43-.13,.915,2.042),(s*.43+.13,.915,2.042),.023,2)
    for z in (.99,1.18,1.37,1.56,1.75):box('Cassette side flute',(s*.841,1.04,z),(.014,.35,.035),1,.003)
box('Battery spine',(0,1.62,1.30),(.19,.23,1.30),1)
for i in range(9):box('Battery cooling fin',(0,1.765,.80+i*.115),(.17,.026,.027),2,.003)
box('Roof scanner',(0,2.48,.53),(.31,.04,.28),4)

for piece in parts[cargoPartsStart:]:
    if piece.name!='Roof scanner':piece.location+=Vector(g.xyz((0,.40,0)))

# Independent hollow mining heads. Root radii <=0.11 near the tyre sweep.
for c in L['cutters']:
    x,y,z=c['position'];pivot=g.empty(c['pivot'],(x,y,z),root)
    rod('Cutter support',(x,1.30,-1.57),(x,y,z),.072,2)
    ring('Gimbal yoke',(x,y,z),[(-.06,.072),(-.06,.108),(.055,.108),(.055,.072),(-.06,.072)],2,'Z',pivot,segments=16)
    box('Mining head receiver',(x,y,z-.24),(.20,.20,.36),0,.025,pivot)
    box('Mining head lower rail',(x,y-.108,z-.31),(.12,.035,.41),2,.006,pivot)
    ring('Emitter ceramic sleeve',(x,y,z),[(-.40,.070),(-.40,.098),(-.67,.098),(-.72,.080),(-.72,.048),(-.40,.048),(-.40,.070)],0,'Z',pivot,segments=20)
    ring('Bored emitter nozzle',(x,y,z),[(-.67,.047),(-.67,.072),(-.77,.072),(-.80,.061),(-.80,.043),(-.67,.043),(-.67,.047)],2,'Z',pivot,segments=20)
    ring('Mining aperture light',(x,y,z),[(-.782,.044),(-.782,.055),(-.791,.055),(-.791,.044),(-.782,.044)],axis='Z',parent=pivot,mat=light,segments=20)
    for s in (-1,1):box('Head cooling slit',(x+s*.106,y,z-.25),(.008,.033,.21),1,.002,pivot)
    g.empty(c['muzzle'],(x,y,z-.8),pivot)

# Restrained manufacturer plate / chevron motif, readable physical orientation.
text('Forehead identity','BURROW  M-04',(0,2.397,-1.197),.092,(math.pi/2,0,math.pi))
text('Rear manufacturer','MERIDIAN',(0,2.20,.786),.09,(math.pi/2,0,0))
text('Roof identity','M-04',(0,2.497,-.30),.29,(0,0,0))
for s in (-1,1):
    rod('Meridian rising mark',(s*.20,2.403,-1.195),(s*.06,2.466,-1.155),.011,4)
    box('Forward work lamp',(s*.72,1.50,-1.69),(.20,.045,.022),mat=light)
    rod('Work lamp bracket',(s*.78,1.34,-1.646),(s*.72,1.481,-1.689),.016,2,n=8)
    box('Rear marker',(s*.77,.63,2.09),(.11,.036,.011),mat=amber)

# Apply actual bevels, deliberate local face projection into the shared atlas.
for o in parts:
    if o.type!='MESH':continue
    for modifier in o.modifiers:
        if modifier.type=='BEVEL':modifier.segments=1
    g.apply(o)
    if o.data.materials and o.data.materials[0]==surface:
        uv=o.data.uv_layers.new(name='UVMap');tile=int(o.get('tile',0))
        for face in o.data.polygons:
            axes=sorted(range(3),key=lambda i:abs(face.normal[i]))[:2]
            pts=[o.data.vertices[o.data.loops[i].vertex_index].co for i in face.loop_indices]
            lo=[min(v[a] for v in pts) for a in axes];hi=[max(v[a] for v in pts) for a in axes]
            for li in face.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co
                u,t=[(v[a]-lo[j])/max(.00001,hi[j]-lo[j]) for j,a in enumerate(axes)]
                uv.data[li].uv=((tile%2+.025+u*.95)/2,(3-tile//2+.025+t*.95)/4)
# Join only static pieces that share a material AND a mechanism parent.
batches={}
for o in parts:
    if o.type=='MESH':batches.setdefault((o.parent,o.data.materials[0]),[]).append(o)
for (par,mat),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    o=bpy.context.object;o.name=par.name+'_'+('Glazing' if mat==glass else 'Light' if mat==light else 'Amber' if mat==amber else 'Markings' if mat==ink else 'Surface')
# Fixed anti-slip stair treads: no cabin-door sweep overlap.
bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mining-rover.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
(SOURCE/'manifest.json').write_text(json.dumps({'stage':'authored candidate; renderer and mechanism review pending','name':L['name'],'manufacturer':L['manufacturer'],'units':'metres','builder':'blender/build_mining_rover.py','textureBuilder':'blender/rover_textures.py','source':'assets/mining-rover/mining-rover.blend','provenance':'Original procedural geometry and PBR maps. Meridian family design; no external models or imagery.','layout':'assets/mining-rover/layout.json','movingParts':[w['node'] for w in L['wheels']]+['CabinDoor','Cutter_Port','Cutter_Starboard','SteeringYoke'],'limitations':['Closed geometric cabin; no pressure simulation','No independent art acceptance yet']},indent=2)+'\n')
print('Rover source and export written. Run pack_mining_rover.py.')
