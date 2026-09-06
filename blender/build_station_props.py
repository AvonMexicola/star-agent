"""Original AEON manufactured service props. Blender 4+/5+, no external assets.

All authoring coordinates are GAME metres: X right, Y up, Z aft; deck Y=-8.
Export uses Blender's standard glTF Y-up conversion exactly once. Rebuild:
  blender --background --factory-startup -noaudio --python-exit-code 1 \
    --python blender/build_station_props.py -- --render docs/qa/hangar-props-corner.png
The aggregate is attached to the hero pod BEFORE collider construction. Existing
merged workbenches remain: this kit adds drawers and dressing to one of them.
"""
import argparse, json, math, os, sys
import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--out', default='public/models/station-props.glb')
args.add_argument('--manifest', default='assets/station/props-manifest.json')
args.add_argument('--render')
args.add_argument('--view', choices=['corner','gallery'], default='corner')
opts=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}; GROUPS={}; current=''

def material(name, color, metal=0, rough=.5, emission=None):
    m=bpy.data.materials.new({'DarkSteel':'FinishDark'}.get(name,'Finish'+name));m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    M[name]=m
material('Petrol',(.045,.13,.16),.45,.43)
material('Ivory',(.61,.62,.54),.25,.5)
material('Ochre',(.62,.33,.075),.4,.46)
material('Steel',(.29,.34,.35),.82,.32)
material('DarkSteel',(.055,.068,.075),.7,.43)
material('Rubber',(.018,.023,.025),0,.8)
material('Red',(.46,.035,.018),.2,.4)
material('WarmLight',(1,.65,.3),0,.3,2)
material('Glass',(.10,.20,.22),.15,.22)
M['Glass'].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.14
M['Glass'].diffuse_color=(.10,.20,.22,.14)
M['Glass'].surface_render_method='DITHERED'

def vec(p):return Vector((p[0],-p[2],p[1]))
def register(ob, name, mat):
    ob.name=current+'_'+name;ob.data.materials.append(M[mat]);GROUPS.setdefault(current,[]).append(ob);return ob

def bevel(ob,width=.025,segments=2):
    if width:
        mod=ob.modifiers.new('Manufactured edge radius','BEVEL');mod.width=width;mod.segments=1 if width<=.018 else segments
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
        ob.data.update()
    return ob

def box(name,p,size,mat='Petrol',radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=vec(p));ob=bpy.context.object
    ob.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return register(bevel(ob,min(radius,min(size)*.25)),name,mat)

def rod(name,a,b,r,mat='Steel',vertices=12):
    va,vb=vec(a),vec(b);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(vb-va).length,location=(va+vb)/2)
    ob=bpy.context.object;ob.rotation_mode='QUATERNION';ob.rotation_quaternion=(vb-va).to_track_quat('Z','Y')
    bevel(ob,min(r*.15,.01) if r>.02 else 0,1);return register(ob,name,mat)

def text(name,body,p,size=.065,mat='Ivory',facing='aft'):
    bpy.ops.object.text_add(location=vec(p));ob=bpy.context.object;ob.data.body=body;ob.data.size=size;ob.data.align_x='CENTER';ob.data.extrude=.0005
    # Face game -Z, or game +X for side-wall service fronts.
    ob.rotation_euler=(math.pi/2,0,math.pi if facing=='aft' else math.pi/2)
    bpy.ops.object.convert(target='MESH');return register(bpy.context.object,name,mat)

def screw(p,axis='z',r=.012):
    delta=Vector((0,0,.012) if axis=='z' else (.012,0,0));point=Vector(p)
    rod('CaptiveFastener',point-delta,point+delta,r,'Steel',6)

def case(x,y,z,w=1.4,h=.65,d=.8,color='Petrol'):
    # Base centre supplied on ground; seam is a real inset rubber gasket.
    box('CaseShell',(x,y+h*.49,z),(w,h*.94,d),color,.065)
    box('CaseGasket',(x,y+h*.77,z),(w+.013,.026,d+.013),'Rubber',.01)
    box('CaseLid',(x,y+h*.89,z),(w+.008,h*.20,d+.008),color,.055)
    for sx in [-1,1]:
        for sz in [-1,1]:
            box('CornerProtector',(x+sx*(w/2-.055),y+h*.47,z+sz*(d/2-.045)),(.13,h*.91,.115),'DarkSteel',.04)
    for sx in [-.31,.31]:
        for sz in [-1,1]:
            box('LatchPocket',(x+sx*w,y+h*.70,z+sz*(d/2+.012)),(.15,.24,.035),'Rubber',.014)
            box('OverCentreLatch',(x+sx*w,y+h*.72,z+sz*(d/2+.036)),(.105,.16,.03),'Steel',.012)
            rod('LatchPivot',(x+sx*w-.058,y+h*.78,z+sz*(d/2+.057)),(x+sx*w+.058,y+h*.78,z+sz*(d/2+.057)),.012,'DarkSteel',8)
    for sz in [-1,1]:
        zz=z+sz*(d/2+.05)
        for sx in [-1,1]:rod('HandleMount',(x+sx*.17,y+h*.43,zz),(x+sx*.17,y+h*.54,zz),.024)
        rod('RecessedCarryHandle',(x-.17,y+h*.43,zz),(x+.17,y+h*.43,zz),.032,'Rubber')
    for dx in [-w*.25,w*.25]:box('LidStrengtheningRib',(x+dx,y+h+.018,z),(.035,.033,d*.69),'DarkSteel',.01)
    box('ConsignmentPlate',(x,y+h*.20,z-d/2-.016),(.29,.13,.009),'Ivory',.006)
    # A deliberately small manufactured barcode, no invented text raster.
    for i in range(11):box('TrackingCode',(x-.105+i*.02,y+h*.20,z-d/2-.023),(.007 if i%3 else .011,.075,.003),'DarkSteel',0)

current='CargoDolly'
x,z=-18.8,17.9
box('LoadDeck',(x,-7.60,z),(2.05,.15,1.35),'Ochre',.045)
box('DeckGrip',(x,-7.51,z),(1.83,.025,1.13),'Rubber',.015)
for sx in [-1,1]:
    for sz in [-1,1]:
        wx,wz=x+sx*.77,z+sz*.44
        box('CasterFork',(wx,-7.74,wz),(.11,.30,.24),'Steel',.016)
        rod('Wheel',(wx-.095,-7.80,wz),(wx+.095,-7.80,wz),.19,'Rubber',16)
        rod('WheelHub',(wx-.105,-7.80,wz),(wx+.105,-7.80,wz),.071,'Steel',12)
    rod('PushHandleUpright',(x+sx*.81,-7.55,z+.58),(x+sx*.81,-6.3,z+.76),.036,'Steel')
rod('PushHandle',(x-.81,-6.3,z+.76),(x+.81,-6.3,z+.76),.044,'Rubber')
for sx in [-1,1]:box('CornerBumper',(x+sx*.98,-7.59,z),(.13,.14,1.27),'DarkSteel',.04)
case(x,-7.49,z-.05,1.67,.69,.98,'Ivory');case(x+.09,-6.79,z-.02,1.45,.58,.86,'Petrol')

current='StrappedPallet'
x,z=18.8,17.9
for dx in [-.78,0,.78]:box('ForkRunner',(x+dx,-7.89,z),(.25,.22,1.42),'DarkSteel',.025)
for dz in [-.55,0,.55]:box('PalletCrossmember',(x,-7.74,z+dz),(2.2,.13,.21),'Ochre',.024)
for dx in [-.9,-.45,0,.45,.9]:box('PalletDeck',(x+dx,-7.63,z),(.37,.09,1.5),'Ivory',.018)
case(x,-7.58,z,2.02,1.42,1.26,'Ivory')
for dx in [-.57,.57]:
    box('CargoStrapTop',(x+dx,-6.11,z),(.073,.025,1.31),'Ochre',.005)
    for side in [-1,1]:box('CargoStrapDrop',(x+dx,-6.85,z+side*.66),(.073,1.49,.024),'Ochre',.005)
    box('RatchetBody',(x+dx,-6.91,z-.705),(.12,.24,.055),'DarkSteel',.018)
    rod('RatchetHandle',(x+dx-.048,-6.82,z-.75),(x+dx+.048,-6.82,z-.75),.023,'Steel')

current='BenchDress'
x,z=-18.6,14
# Existing countertop top is -6.71. Thin bevelled overlay seats directly on it.
box('WorkSurface',(x,-6.69,z),(2.50,.06,3.70),'Steel',.025)
for dz in [-1.12,1.12]:
    box('DrawerCarcass',(x,-7.37,z+dz),(2.05,1.1,1.08),'Petrol',.045)
    box('ToeKick',(x+.05,-7.92,z+dz),(1.9,.11,.96),'DarkSteel',.015)
    for i in range(3):
        yy=-7.02-i*.29
        box('DrawerReveal',(x+1.039,yy,z+dz),(.025,.268,.982),'Rubber',.008)
        box('DrawerFront',(x+1.065,yy,z+dz),(.052,.24,.94),'Petrol',.018)
        for dd in [-.27,.27]:rod('DrawerPullMount',(x+1.105,yy,z+dz+dd),(x+1.18,yy,z+dz+dd),.019)
        rod('DrawerPull',(x+1.18,yy,z+dz-.27),(x+1.18,yy,z+dz+.27),.025,'Steel')
# Recognisable swivel vice: base, anvil, opposing jaws and threaded slide.
vx,vz=x+.72,z-.52
rod('ViceSwivelBase',(vx,-6.65,vz),(vx,-6.54,vz),.22,'DarkSteel',20)
box('ViceBody',(vx,-6.38,vz),(.30,.33,.46),'Petrol',.045)
box('ViceSlide',(vx,-6.31,vz-.07),(.20,.10,.65),'Steel',.02)
for dz in [-.28,.13]:
    box('ViceJaw',(vx,-6.11,vz+dz),(.44,.25,.10),'DarkSteel',.02)
    box('ViceJawFace',(vx,-6.075,vz+dz+.056),(.42,.13,.018),'Steel',.005)
rod('ViceScrew',(vx,-6.31,vz-.5),(vx,-6.31,vz+.22),.044,'Steel',12)
rod('ViceTommyBar',(vx-.22,-6.31,vz-.51),(vx+.22,-6.31,vz-.51),.025,'Steel')
for side in [-1,1]:rod('ViceHandleStop',(vx+side*.22,-6.31,vz-.535),(vx+side*.22,-6.31,vz-.485),.037,'DarkSteel')
# Toolboard is offset in front of original flat teal backing (game x=-19.75).
box('ToolboardInset',(-19.42,-5.91,z),(.055,1.34,3.42),'DarkSteel',.016)
for yy in [-6.49,-5.33]:
    for dz in [-1.60,1.60]:rod('BoardStandoff',(-19.72,yy,z+dz),(-19.40,yy,z+dz),.035,'Steel',10)
for row in range(6):
    for col in range(12):rod('PegHole',(-19.384,-6.44+row*.20,z-1.53+col*.27),(-19.379,-6.44+row*.20,z-1.53+col*.27),.017,'Rubber',6)
# Spanners built as visibly forked heads, each hung vertically.
for i in range(5):
    zz=z-1.1+i*.39;yy=-5.48; length=.37+i*.055
    rod('SpannerStem',(-19.33,yy,zz),(-19.33,yy-length,zz),.026,'Steel',8)
    box('SpannerShoulder',(-19.33,yy+.022,zz),(.045,.09,.15),'Steel',.009)
    for side in [-1,1]:box('SpannerJaw',(-19.33,yy+.087,zz+side*.057),(.045,.12,.035),'Steel',.008)
    rod('ToolHook',(-19.41,yy-.04,zz),(-19.28,yy-.04,zz),.011,'Ochre',8)
# Task light over work, backed by manufactured shade and supports.
for dz in [-1.58,1.58]:rod('LampBracket',(-19.63,-5.15,z+dz),(-18.96,-5.04,z+dz),.023,'Steel')
box('TaskLightShade',(-19.06,-5.04,z),(.70,.11,3.42),'Petrol',.045)
box('TaskLightDiffuser',(-19.00,-5.105,z),(.45,.018,3.10),'WarmLight',.015)
# Parts tray with raised edge; bolts and a dismantled motor assembly.
box('PartsTray',(-18.10,-6.63,z+.90),(.53,.05,.63),'Ochre',.013)
for dz in [-.29,.29]:box('TrayRim',(-18.10,-6.58,z+.90+dz),(.53,.065,.026),'Ochre',.005)
for dx in [-.25,.25]:box('TrayRim',(-18.10+dx,-6.58,z+.90),(.026,.065,.60),'Ochre',.005)
for i in range(4):rod('LooseFastener',(-18.24+i*.085,-6.59,z+.79),(-18.24+i*.085,-6.59,z+.92),.018,'Steel',6)
rod('ServiceMotor',(-18.80,-6.39,z+.9),(-18.80,-6.39,z+1.4),.23,'DarkSteel',16)
for dz in [.95,1.03,1.11,1.19,1.27]:rod('CoolingFin',(-18.80,-6.39,z+dz),(-18.80,-6.39,z+dz+.026),.25,'Steel',16)
rod('MotorShaft',(-18.80,-6.39,z+1.41),(-18.80,-6.39,z+1.60),.047,'Steel',12)

current='FireCabinet'
x,z=5.5,25.15
box('CabinetBack',(x,-6.15,z+.09),(.80,1.65,.12),'DarkSteel',.035)
for sx in [-1,1]:box('CabinetSide',(x+sx*.405,-6.15,z-.08),(.065,1.68,.38),'Ivory',.02)
for sy in [-1,1]:box('CabinetLip',(x,-6.15+sy*.80,z-.09),(.84,.07,.38),'Ivory',.02)
rod('ExtinguisherBottle',(x,-6.82,z-.085),(x,-5.75,z-.085),.19,'Red',20)
rod('BottleShoulder',(x,-5.78,z-.085),(x,-5.68,z-.085),.13,'Red',16)
rod('Valve',(x,-5.72,z-.085),(x,-5.52,z-.085),.048,'Steel',12)
box('SqueezeHandle',(x,-5.51,z-.085),(.29,.04,.065),'DarkSteel',.015)
box('BottleLabel',(x,-6.22,z-.28),(.24,.30,.014),'Ivory',.008)
rod('Gauge',(x+.09,-5.67,z-.15),(x+.09,-5.67,z-.22),.065,'Steel',12)
for a,b in [((x+.14,-5.62,z-.1),(x+.27,-5.82,z-.1)),((x+.27,-5.82,z-.1),(x+.27,-6.65,z-.1))]:rod('RetainedHose',a,b,.029,'Rubber')
box('RetentionBand',(x,-6.52,z-.29),(.43,.052,.04),'DarkSteel',.015)
box('EmergencyPlaque',(x,-5.13,z-.03),(.77,.22,.04),'Red',.008)
text('FireLabel','FIRE', (x,-5.17,z-.058),.12)

current='TerminalTrim'
x=-12
# Maintain runtime screen visible region: x ± .86, y=-6.28 ± .56, z=22.69.
for side in [-1,1]:
    box('ScreenBezel',(x+side*.93,-6.28,22.65),(.13,1.38,.18),'Petrol',.035)
    for yy in [-6.85,-5.71]:screw((x+side*.93,yy,22.55))
for yy in [-6.94,-5.62]:box('ScreenBezel',(x,yy,22.65),(1.90,.12,.18),'Petrol',.035)
box('KeyboardSurround',(x,-6.83,22.12),(1.72,.038,.37),'Petrol',.027)
for i in range(3):
    for j in range(12):box('RecessedKey',(x-.68+j*.11,-6.799,22.0+i*.075),(.08,.015,.05),'DarkSteel',.004)
box('ReaderHousing',(-10.88,-6.31,22.66),(.27,.56,.17),'Ochre',.024)
box('ReaderSlot',(-10.88,-6.38,22.565),(.19,.03,.018),'Rubber',.004)
box('ReaderIndicator',(-10.88,-6.16,22.56),(.07,.07,.018),'WarmLight',.006)
box('ServicePanel',(x,-7.45,21.976),(1.40,.70,.025),'Petrol',.02)
for xx in [-.61,.61]:
    for yy in [-7.73,-7.16]:screw((x+xx,yy,21.955))
for yy in [-7.57,-7.50,-7.43]:box('VentInset',(x,yy,21.957),(.62,.022,.008),'Rubber',.002)

current='ElevatorJamb'
for side in [-1,1]:
    x=side*2.25
    box('JambSeal',(x,-6.39,22.30),(.12,3.24,.30),'Rubber',.025)
    box('JambCover',(x+side*.09,-6.39,22.25),(.18,3.24,.38),'DarkSteel',.035)
    box('JambInset',(x+side*.10,-6.39,22.05),(.08,2.60,.035),'Ivory',.015)
    for yy in [-7.76,-5.02]:screw((x+side*.10,yy,22.025))
box('LintelTrim',(0,-4.71,22.27),(4.90,.20,.40),'Petrol',.045)
box('LintelTaskLight',(0,-4.83,22.25),(3.98,.028,.16),'WarmLight',.012)
# No floor threshold, no elevator door leaves, no collider across the opening.


# Fitted skins for two original source stacks; original collision volumes remain.
# The dolly and pallet have been moved clear of these existing, measured boxes.
def storage_skin(x, y, z, w, h, d, color):
    # The source box supplies the core. Thin shells, gaskets and hardware supply
    # real manufacturing joints without adding another solid overlapping block.
    for side in [-1,1]:
        box('SideSkin',(x+side*(w/2+.013),y+h/2,z),(.026,h-.07,d-.07),color,.008)
        box('EndSkin',(x,y+h/2,z+side*(d/2+.013)),(w-.07,h-.07,.026),color,.008)
        box('LongitudinalSeal',(x+side*(w/2+.027),y+h*.77,z),(.018,.022,d-.06),'Rubber',.004)
        box('CrossSeal',(x,y+h*.77,z+side*(d/2+.027)),(w-.06,.022,.018),'Rubber',.004)
    box('StackLid',(x,y+h+.017,z),(w-.02,.034,d-.02),color,.012)
    box('StackTopGasket',(x,y+h-.024,z),(w+.035,.042,d+.035),'Rubber',.006)
    for sx in [-1,1]:
        for sz in [-1,1]:
            box('VerticalRail',(x+sx*(w/2-.025),y+h/2,z+sz*(d/2-.025)),(.15,h+.018,.15),'DarkSteel',.022)
            for yy in [y+.14,y+h-.12]:
                # Compact hexagonal captive bolts on both front/back rail faces.
                screw((x+sx*(w/2-.025),yy,z+sz*(d/2+.056)),r=.017)
    for sz in [-1,1]:
        for dx in [-w*.28,w*.28]:
            zz=z+sz*(d/2+.05)
            box('LatchRecess',(x+dx,y+h*.76,zz),(.16,.24,.036),'Rubber',.012)
            box('RetainingLatch',(x+dx,y+h*.77,zz+sz*.023),(.11,.18,.032),'Steel',.012)
    # Side panels face the clear service aisle; carry pulls are genuine U forms.
    inward=-1 if x>0 else 1
    xx=x+inward*(w/2+.074)
    for dz in [-d*.31,d*.31]:
        box('HandleRecess',(xx,y+h*.40,z+dz),(.022,.23,.47),'Rubber',.007)
        for end in [-1,1]:rod('HandleBracket',(xx,y+h*.4,z+dz+end*.16),(xx+inward*.065,y+h*.4,z+dz+end*.16),.025,'Steel',10)
        rod('StackCarryHandle',(xx+inward*.065,y+h*.4,z+dz-.16),(xx+inward*.065,y+h*.4,z+dz+.16),.028,'Steel',10)
    for offset in [-w*.27,w*.27]:box('LidRib',(x+offset,y+h+.045,z),(.08,.05,d*.72),'DarkSteel',.012)

for side in [-1,1]:
    current='LeftStorage' if side<0 else 'RightStorage'
    storage_skin(side*19.1,-8,20,2.2,1.6,2.2,'Petrol')
    storage_skin(side*18.9,-6.4,19.8,1.6,.9,1.6,'Ivory')

# Shallow operations gallery fitted over the old luminous window strip. The root
# runtime darkens ControlGlass; opaque backing here masks its coarse old consoles.
current='OperationsGallery'
box('GalleryBack',(0,2.01,24.345),(24.0,2.88,.04),'DarkSteel',.008)
box('GalleryLowBack',(0,1.015,24.01),(24.0,1.03,.06),'DarkSteel',.008)
for yy in [.43,3.57]:box('WindowTransom',(0,yy,24.02),(24.28,.20,.48),'Petrol',.035)
box('WindowSill',(0,.36,23.96),(24.30,.12,.38),'Steel',.025)
for xx in [-12,-8,-4,0,4,8,12]:
    box('WindowMullion',(xx,2.0,24.04),(.12,3.10,.45),'DarkSteel',.025)
    box('MullionCap',(xx,2.0,23.796),(.074,3.04,.022),'Steel',.007)
    for yy in [.64,3.32]:screw((xx,yy,23.777),r=.016)
for xx in [-10,-6,-2,2,6,10]:
    box('ConsoleCarcass',(xx,1.10,23.965),(1.62,.54,.068),'Petrol',.014)
    box('ConsoleDisplayBezel',(xx,1.22,23.942),(1.22,.44,.044),'Steel',.009)
    box('ConsoleDarkFace',(xx,1.22,23.917),(1.14,.36,.012),'Rubber',.004)
    box('ConsoleControlRail',(xx,.86,23.931),(1.64,.08,.09),'Steel',.012)
    # Chair backs and a narrow head rest form quiet staffed-control-room silhouettes.
    box('OperatorSeatBack',(xx+1.15,1.61,24.15),(.52,.74,.19),'Rubber',.08)
    box('OperatorHeadrest',(xx+1.15,2.11,24.13),(.36,.20,.15),'Rubber',.045)
    rod('OperatorSeatStem',(xx+1.15,.98,24.2),(xx+1.15,1.48,24.2),.042,'Steel')
    for yy in [2.83,2.91,2.99]:box('VentSlot',(xx,yy,24.27),(2.2,.028,.035),'Rubber',.006)
box('OperationsPlaque',(0,3.65,23.79),(5.86,.30,.08),'DarkSteel',.012)
# Six single-surface panes: no doubled transparency, and excluded from collisions.
for index,(left,right) in enumerate(zip([-12,-8,-4,0,4,8],[-8,-4,0,4,8,12])):
    points=[vec((left+.065,.54,23.86)),vec((right-.065,.54,23.86)),vec((right-.065,3.46,23.86)),vec((left+.065,3.46,23.86))]
    mesh=bpy.data.meshes.new('OperationsGlass');mesh.from_pydata(points,[],[(0,3,2,1)]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for loop,coord in zip(mesh.loops,[(0,0),(0,1),(1,1),(1,0)]):uv.data[loop.index].uv=coord
    ob=bpy.data.objects.new('OperationsGlass',mesh);bpy.context.collection.objects.link(ob);register(ob,'GlassPane','Glass')

bpy.context.view_layer.update()
manifest={'version':1,'generator':'blender/build_station_props.py','coordinates':'game X right, Y up, Z aft; floor Y=-8; identity placement','asset':'/models/station-props.glb','lod':'hero only; shared geometry/materials across all pods','integration':'Attach glTF scene to station hero root before shared collider build. Existing merged workbenches remain; BenchDress overlays one counter. Do not copy into LOD. All assemblies are decorative, existing terminal/elevator interactions remain runtime-owned.','assemblies':[]}
for name,objects in GROUPS.items():
    points=[ob.matrix_world@Vector(c) for ob in objects for c in ob.bound_box]
    game=[Vector((p.x,p.z,-p.y)) for p in points]
    manifest['assemblies'].append({'name':name,'bounds':{'min':[round(min(p[i] for p in game),4) for i in range(3)],'max':[round(max(p[i] for p in game),4) for i in range(3)]},'triangles':sum(len(p.vertices)-2 for ob in objects for p in ob.data.polygons),'sourceParts':len(objects)})
# One batch per material: eight opaque batches and one shared glazing batch.
for key,mat in M.items():
    objects=[ob for ob in bpy.context.scene.objects if ob.type=='MESH' and mat in list(ob.data.materials)]
    if not objects:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name='Detail_OperationsGlass' if key=='Glass' else 'StationProps_'+key
    # Bake transforms in authoring frame; UVs from mesh primitives are retained.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Smooth bevel faces while keeping broad manufactured faces planar.
    for poly in ob.data.polygons:poly.use_smooth=False
os.makedirs(os.path.dirname(opts.out),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(opts.out),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
manifest['triangles']=sum(a['triangles'] for a in manifest['assemblies'])
manifest['bytes']=os.path.getsize(opts.out);manifest['materials']=len(M);manifest['drawPrimitives']=len([o for o in bpy.context.scene.objects if o.type=='MESH'])
os.makedirs(os.path.dirname(opts.manifest),exist_ok=True)
with open(opts.manifest,'w') as file:json.dump(manifest,file,indent=2);file.write('\n')
print(json.dumps(manifest,indent=2))
if opts.render:
    # QA composition, explicitly a Blender studio view rather than game evidence.
    current='QA'
    box('Deck',(-17,-8.1,16),(12,.20,14),'DarkSteel',0)
    box('Wall',(-20.85,-4.7,16),(.20,6.6,14),'Ivory',0)
    # Original host bench shape, solely to show dressing in its real context.
    box('HostCounter',(-18.6,-6.8,14),(2.5,.18,3.7),'DarkSteel',.01)
    box('HostToolboard',(-19.75,-6,14),(.2,1.5,3.6),'Petrol',.01)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.cycles.use_denoising=True;scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.world.color=(.18,.18,.18)
    for name,power,size,pos in [('Key',1600,5,(-15,-2,16)),('Fill',900,5,(-12,-4,11)),('Rim',1100,3,(-19,-3,22))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=vec(pos);ob.rotation_euler=(vec((-18.5,-6.8,17))-ob.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=vec((-12.3,-4.0,22.9)));camera=bpy.context.object
    camera.rotation_euler=(vec((-18.7,-6.5,16.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=41;scene.camera=camera
    if opts.view=='gallery':
        camera.location=vec((0,1.7,5));camera.rotation_euler=(vec((0,2,24))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=26;scene.render.resolution_x=1600;scene.render.resolution_y=620
        data=bpy.data.lights.new('Gallery softbox','AREA');data.energy=2600;data.shape='RECTANGLE';data.size=18;data.size_y=5
        ob=bpy.data.objects.new('Gallery softbox',data);scene.collection.objects.link(ob);ob.location=vec((0,5,16));ob.rotation_euler=(vec((0,2,24))-ob.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.abspath(opts.render);os.makedirs(os.path.dirname(opts.render),exist_ok=True);bpy.ops.render.render(write_still=True)
