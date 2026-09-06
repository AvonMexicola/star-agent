"""Original AEON shop fixtures and passenger pressure elevator.

Rebuild from repository root with Blender 5.2:
  env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio \
    --python-exit-code 1 --python blender/build_station_concourse.py

Append -- --render-dir /tmp/aeon-concourse-studio for CPU Cycles QA images;
--only-elevator limits a rebuild and optional studio capture to the elevator.
--only-concourse leaves the elevator asset untouched.

Game coordinates: metres, X right/Y up/Z aft. Concourse floor Y=-8.
Elevator is local to door centre at floor height; attach at [0, floor, doorZ].
Static batches share materials; the exported scene extras contain assembly
bounds for collision and budget audits. Moving leaf groups remain independent.
No external geometry, texture, font download or decoder dependency.
"""
import json
import math
import re
import sys
import tempfile
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models'
CSS = (ROOT / 'src/style.css').read_text()
M = {}
PARTS = {}
ASSEMBLY = ''


def vec(p):
    return Vector((p[0], -p[2], p[1]))


def material(name, token, metallic, roughness, emission=0):
    color = re.search(r'--' + token + r':\s*#([0-9a-fA-F]{6})', CSS).group(1)
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    # CSS tokens are sRGB; Blender node base colours are scene-linear.
    rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    m = bpy.data.materials.new('Finish' + name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emission
    M[name] = m


def reset():
    global PARTS
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    PARTS = {}


def finish(obj, name, mat, radius=0):
    obj.name = ASSEMBLY + '_' + name
    obj.data.materials.append(M[mat])
    if radius:
        mod = obj.modifiers.new('Manufactured radius', 'BEVEL')
        mod.width = radius
        mod.segments = 2 if radius >= .02 else 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    PARTS.setdefault(ASSEMBLY, []).append(obj)
    return obj


def box(name, p, size, mat='Ivory', radius=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vec(p))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, min(radius, min(size) * .22))


def rod(name, a, b, radius, mat='Steel', sides=12):
    va, vb = vec(a), vec(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius,
        depth=(vb-va).length, location=(va+vb)/2)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (vb-va).to_track_quat('Z', 'Y')
    return finish(obj, name, mat, min(.009, radius * .13))


def profile(name, yz, x, depth, mat='Ivory', radius=.016):
    # Extrude a purposeful side silhouette along X, never a flattened image.
    count = len(yz)
    verts = [vec((xx, y, z)) for xx in (x-depth/2, x+depth/2) for y, z in yz]
    faces = [tuple(range(count-1, -1, -1)), tuple(range(count, count*2))]
    faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj, name, mat, radius)


def bolt(p, axis='x'):
    d = Vector((.01, 0, 0) if axis == 'x' else (0, 0, .01))
    rod('Captive fastener', Vector(p)-d, Vector(p)+d, .012, 'Steel', 6)


def clipped_panel(name,x,y,z,width,height,depth,clip,mat):
    outline=[(-width/2+clip,-height/2),(width/2-clip,-height/2),
        (width/2,-height/2+clip),(width/2,height/2-clip),
        (width/2-clip,height/2),(-width/2+clip,height/2),
        (-width/2,height/2-clip),(-width/2,-height/2+clip)]
    verts=[vec((x+xx,y+yy,zz))for zz in(z-depth/2,z+depth/2)for xx,yy in outline]
    faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]
    faces += [(i,(i+1)%8,(i+1)%8+8,i+8)for i in range(8)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj,name,mat,.002)


def anchor(name, p):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = vec(p)
    return obj


def counter(side):
    global ASSEMBLY
    ASSEMBLY = 'ArmoryCounter' if side < 0 else 'ComponentsCounter'
    x = side * 12
    box('Recessed toe plinth', (x, -7.87, 0), (.66, .26, 3.96), 'Dark')
    box('Cabinet carcass', (x, -7.42, 0), (.75, .82, 4.04), 'Petrol' if side<0 else 'Dark', .035)
    box('Radiused worktop', (x, -6.97, 0), (.87, .10, 4.24), 'Steel', .03)
    box('Work surface insert', (x, -6.914, -.85), (.69, .012, 1.9), 'Rubber', .004)
    for z in (-1.51, -.5, .51, 1.52):
        box('Customer panel', (x-side*.389, -7.43, z), (.045, .72, .94), 'Ivory', .012)
        box('Panel inset', (x-side*.418, -7.43, z), (.012, .42, .72), 'Petrol' if side<0 else 'Ochre', .004)
        for dz in (-.31, .31):
            bolt((x-side*.428, -7.64, z+dz))
        box('Staff drawer face', (x+side*.39, -7.27, z), (.04, .28, .91), 'Ivory')
        rod('Drawer pull', (x+side*.435, -7.26, z-.16),
            (x+side*.435, -7.26, z+.16), .016, 'Steel', 8)
    for z in (-2.04, 2.04):
        box('End bumper', (x, -7.44, z), (.83, .86, .065), 'Dark')
    box('Under-counter diffuser', (x-side*.427, -7.055, 0), (.015, .025, 3.85), 'Mint', .003)
    # A screen mounting surface, populated from real shop state by the runtime.
    rod('Terminal stem', (x, -6.92, 1.23), (x, -6.54, 1.23), .026)
    box('Terminal back', (x-side*.025, -6.53, 1.23), (.09, .38, .48), 'Dark')
    box('Terminal recess', (x-side*.075, -6.53, 1.23), (.018, .30, .4), 'Rubber', .006)
    anchor('ArmoryScreen' if side < 0 else 'ComponentsScreen', (x-side*.09, -6.53, 1.23))


def shop_architecture(side):
    global ASSEMBLY
    ASSEMBLY = 'ArmoryArchitecture' if side < 0 else 'ComponentsArchitecture'
    # A shop is a constructed inset within the larger glazed concourse, with a
    # low service canopy and a broad, unobstructed opening to the central aisle.
    for z in (-11.1, 8.6):
        box('End wall', (side*14, -6.31, z), (11.8, 3.38, .16), 'Petrol' if side<0 else 'Dark')
        box('Wall foot trim', (side*14, -7.91, z-.09), (11.8, .18, .04), 'Steel')
        for x in (9.65, 12.55, 15.45, 18.35):
            box('End-wall cassette', (side*x, -6.16, z-.10 if z>0 else z+.10), (2.82, 2.7, .045), 'Ivory')
    box('Display wall', (side*19.85, -6.26, -1.25), (.18, 3.48, 19.5), 'Dark')
    for z in (-10.85, -5.0, 2.7, 8.35):
        box('Portal column', (side*8.2, -6.12, z), (.23, 3.76, .27), 'Steel', .025)
        box('Column foot guard', (side*8.2, -7.67, z), (.28, .58, .32), 'Dark')
    box('Suspended fascia', (side*8.2, -4.24, -1.25), (.4, .44, 19.55), 'Ivory' if side<0 else 'Ochre', .025)
    box('Recessed sign field', (side*7.987, -4.23, -1.3), (.025, .31, 7.2), 'Petrol' if side<0 else 'Dark', .008)
    box('Canopy underside', (side*9.1, -4.49, -1.25), (1.95, .10, 19.55), 'Dark')
    box('Canopy light', (side*8.92, -4.55, -1.25), (.06, .025, 18.8), 'Mint', .006)
    for z in (-8.8, -4.4, 0, 4.4, 7.5):
        box('Canopy bracket', (side*9.0, -4.38, z), (1.8, .16, .06), 'Steel')
    anchor('ArmorySign' if side < 0 else 'ComponentsSign', (side*7.967, -4.23, -1.3))


def rack_frame(side, z):
    x = side*19.16
    box('Rack foot', (x, -7.94, z), (.95, .12, 3.08), 'Dark')
    box('Recessed rack backing', (x+side*.25, -6.62, z), (.12, 2.58, 3.0), 'Petrol' if side<0 else 'Dark')
    for dz in (-1.44, 1.44):
        box('Extruded upright', (x, -6.68, z+dz), (.12, 2.56, .11), 'Steel')
        for y in (-7.7, -7.2, -6.7, -6.2, -5.7):
            box('Adjustable rack slot', (x-side*.067, y, z+dz), (.014, .075, .027), 'Rubber', .001)
    box('Rack header', (x, -5.36, z), (.38, .13, 3.04), 'Ivory' if side<0 else 'Ochre')
    box('Header diffuser', (x-side*.15, -5.44, z), (.025, .02, 2.8), 'Mint', .002)
    for y in (-7.63, -6.68, -5.78):
        box('Mounting rail', (x+side*.15, y, z), (.08, .075, 2.84), 'Steel')
    return x


def display_rifle(x, z, index):
    # Original inert display silhouettes; no mechanical internals are modeled.
    profile('Contoured stock', [(-7.42,z-.10),(-7.04,z-.10),(-6.90,z+.04),
        (-7.02,z+.18),(-7.47,z+.18)], x, .11, 'Rubber')
    box('Receiver shell', (x, -6.83, z), (.16, .36, .18), 'Ivory')
    box('Receiver inset', (x+.091, -6.82, z), (.025, .22, .11), 'Dark', .005)
    profile('Angled grip', [(-6.96,z+.04),(-6.96,z+.16),(-7.20,z+.27),
        (-7.24,z+.15)], x, .10, 'Rubber', .012)
    box('Magazine', (x, -6.86, z-.17), (.11, .23, .15), 'Petrol')
    rod('Barrel', (x, -6.66, z), (x, -5.91+index*.07, z), .035, 'Dark', 12)
    box('Handguard', (x, -6.44, z), (.13, .39, .13), 'Petrol')
    for y in (-6.58, -6.49, -6.40, -6.31):
        box('Handguard relief', (x+.073, y, z), (.015, .035, .083), 'Rubber', .002)
    rod('Optic tube', (x, -6.82, z-.21), (x, -6.57, z-.21), .044, 'Dark', 12)
    box('Security clamp', (x+.13, -7.05, z), (.04, .075, .31), 'Steel')


def armory_rack(z, index):
    global ASSEMBLY
    ASSEMBLY = 'ArmoryRack' + str(index)
    x = rack_frame(-1, z)
    for i, dz in enumerate((-.88, 0, .88)):
        display_rifle(x+.04, z+dz, i)
    box('Inventory label mount', (x+.09, -7.62, z), (.045, .11, 1.5), 'Ivory')


def canister(x, y, z, height=.74, radius=.19):
    rod('Filter body', (x,y+.06,z), (x,y+height-.06,z), radius, 'Ivory', 16)
    for yy in (y+.08, y+height-.08):
        rod('Locking collar', (x,yy-.025,z), (x,yy+.025,z), radius+.027, 'Steel', 16)
    rod('Connector', (x,y+height,z), (x,y+height+.13,z), .075, 'Dark', 12)
    for dz in (-.075, .075):
        rod('Carry handle stay', (x,y+height-.02,z+dz), (x,y+height+.14,z+dz), .014, 'Steel', 8)
    rod('Carry handle', (x,y+height+.14,z-.075), (x,y+height+.14,z+.075), .019, 'Rubber', 8)


def component_rack(z, index):
    global ASSEMBLY
    ASSEMBLY = 'ComponentsRack' + str(index)
    x = rack_frame(1, z)
    for y in (-7.66, -6.53):
        box('Folded shelf', (x-.09, y, z), (.78, .065, 2.83), 'Steel')
        box('Shelf front lip', (x-.49, y+.03, z), (.045, .1, 2.83), 'Ivory')
    for dz in (-.91, 0, .91):
        canister(x-.10, -7.62, z+dz, .78, .21)
    for dz in (-.9, .9):
        box('Avionics module', (x-.08, -6.20, z+dz), (.53, .56, .66), 'Petrol', .04)
        for shift in (-.20, -.10, 0, .10, .20):
            box('Cooling fin', (x-.366, -6.20, z+dz+shift), (.06, .4, .025), 'Steel', .006)
        rod('Cable socket', (x-.04,-5.91,z+dz), (x-.04,-5.83,z+dz), .071, 'Dark', 12)


def turbine_display():
    global ASSEMBLY
    ASSEMBLY = 'DriveModuleDisplay'
    x,y,z=16.4,-7.23,-1.25
    box('Equipment stand foot',(x,-7.94,z),(1.34,.12,1.55),'Dark')
    for dz in (-.51,.51):
        profile('Cradle cheek',[(-7.90,z+dz-.075),(-7.25,z+dz-.075),
            (-7.13,z+dz+.075),(-7.90,z+dz+.075)],x,.88,'Steel')
    rod('Machined drive body',(x-.43,y,z),(x+.43,y,z),.39,'Petrol',24)
    rod('Front machined rim',(x-.52,y,z),(x-.43,y,z),.45,'Steel',24)
    rod('Recessed turbine face',(x-.528,y,z),(x-.51,y,z),.36,'Rubber',24)
    for i in range(12):
        a=i*math.tau/12
        rod('Radial rotor blade',(x-.55,y+.12*math.sin(a),z+.12*math.cos(a)),
            (x-.55,y+.31*math.sin(a+.17),z+.31*math.cos(a+.17)),.027,'Steel',6)
    rod('Rotor hub',(x-.60,y,z),(x-.54,y,z),.115,'Ivory',16)
    for dz in (-.28,.28):
        box('Upper service housing',(x,y+.31,z+dz),(.68,.19,.16),'Ivory')
    for xx in (-.29,.29):
        rod('Housing ring',(x+xx-.02,y,z),(x+xx+.02,y,z),.411,'Steel',24)


def seating(x,z,index):
    global ASSEMBLY
    ASSEMBLY='WaitingSeatBank'+str(index)
    # Three distinct 550 mm seats, 460 mm seat height, 1.05 m overall height.
    rod('Seat beam',(x-.94,-7.69,z),(x+.94,-7.69,z),.045,'Steel')
    for dx in (-.72,.72):
        rod('Upright',(x+dx,-7.93,z),(x+dx,-7.64,z),.035,'Steel')
        rod('Stable foot',(x+dx,-7.965,z-.26),(x+dx,-7.965,z+.29),.035,'Dark')
    for dx in (-.63,0,.63):
        profile('Formed seat shell',[(-7.66,z-.27),(-7.66,z+.25),(-7.02,z+.38),
            (-6.96,z+.33),(-7.60,z+.17),(-7.60,z-.27)],x+dx,.55,'Ivory',.02)
        box('Seat pad',(x+dx,-7.59,z-.045),(.49,.10,.43),'Rubber',.025)
        back=box('Upholstered back',(x+dx,-7.23,z+.255),(.49,.46,.07),'Petrol',.015)
        back.rotation_euler.x=-.15
    for dx in (-.945,-.315,.315,.945):
        rod('Arm support',(x+dx,-7.62,z+.15),(x+dx,-7.32,z+.10),.014,'Steel',8)
        rod('Armrest',(x+dx,-7.32,z-.15),(x+dx,-7.32,z+.15),.025,'Dark',10)


def directory_pylon(x,name):
    global ASSEMBLY
    ASSEMBLY=name+'Pylon'
    z=-12
    box('Anchored plinth',(x,-7.94,z),(.88,.12,.44),'Dark',.025)
    box('Recessed foot',(x,-7.78,z),(.67,.24,.32),'Steel',.025)
    clipped_panel('Cabinet carcass',x,-6.76,z,.78,2.42,.34,.12,'Ivory')
    clipped_panel('Display bezel',x,-6.59,z+.178,.67,1.76,.022,.045,'Steel')
    clipped_panel('Portrait display inset',x,-6.59,z+.194,.58,1.64,.012,.024,'Rubber')
    box('Lower service cassette',(x,-7.67,z+.178),(.61,.22,.026),'Petrol',.008)
    for dx in (-.23,.23):bolt((x+dx,-7.67,z+.198),'z')
    box('Status diffuser',(x,-5.66,z+.18),(.38,.024,.028),'Mint',.004)
    for y in (-7.61,-7.69,-7.77):
        box('Rear ventilation',(x,y,z-.177),(.44,.025,.018),'Dark',.004)
    anchor(name,(x,-6.59,z+.208))


def print_frame(name,centre,width,height,side=None):
    """A replaceable poster cassette with folded edge channels and fasteners."""
    global ASSEMBLY
    ASSEMBLY=name+'Frame'
    x,y,z=centre
    color='Petrol' if name.startswith('Watchkeep') else 'Ochre'
    if side is None:
        box('Wall backplate',(x,y,z-.028),(width+.12,height+.12,.045),'Dark')
        box('Paper backing',(x,y,z-.006),(width,height,.008),'Paper',.001)
        for sx in (-1,1):
            box('Folded side channel',(x+sx*(width/2+.028),y,z),(.055,height+.11,.045),color,.009)
            for sy in (-1,1):bolt((x+sx*(width/2+.028),y+sy*(height/2-.04),z+.025),'z')
        for sy in (-1,1):box('Top and bottom channel',(x,y+sy*(height/2+.028),z),(width+.11,.055,.045),'Steel',.009)
    else:
        box('Wall backplate',(x+side*.05,y,z),(.06,height+.12,width+.12),'Dark')
        box('Paper backing',(x+side*.006,y,z),(.008,height,width),'Paper',.001)
        for sz in (-1,1):
            box('Folded side channel',(x,y,z+sz*(width/2+.028)),(.045,height+.11,.055),color,.009)
            for sy in (-1,1):bolt((x-side*.025,y+sy*(height/2-.04),z+sz*(width/2+.028)))
        for sy in (-1,1):box('Top and bottom channel',(x,y+sy*(height/2+.028),z),(.045,.055,width+.11),'Steel',.009)
        for zz in (-width*.34,width*.34):
            rod('Hidden mounting stud',(x+side*.05,y,z+zz),(side*19.79,y,z+zz),.018,'Steel',8)
    anchor(name,centre)


def banner_hardware(side):
    global ASSEMBLY
    brand='Watchkeep' if side<0 else 'Kestrel'
    ASSEMBLY=brand+'BannerHardware'
    x,z=side*8.34,5.9
    for dz in (-.51,.51):
        rod('Suspension cable',(x,-4.43,z+dz),(x,-4.63,z+dz),.007,'Steel',8)
        box('Suspension clamp',(x,-4.62,z+dz),(.04,.08,.05),'Dark',.007)
    for y in (-4.65,-5.99):
        rod('Rolled banner rail',(x,y,z-.71),(x,y,z+.71),.019,'Steel',12)
        for dz in (-.72,.72):
            rod('End cap',(x,y,z+dz-.018),(x,y,z+dz+.018),.028,'Dark',12)
    # Runtime adds a gently rippled scene-lit print just ahead of this backing.
    box('Cloth backing',(x,-5.32,z),(.012,1.30,1.25),'Paper',0)
    anchor(brand+'Banner',(side*8.318,-5.32,z))


def oriented_box(name,centre,size,right,up,normal,mat,radius=.002):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj=bpy.context.object
    orientation=Matrix((vec(right),vec(up),vec(normal))).transposed()
    obj.rotation_mode='QUATERNION';obj.rotation_quaternion=orientation.to_quaternion()
    obj.location=vec(centre);obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat,min(radius,min(size)*.2))


def brochure_holders(side):
    global ASSEMBLY
    brand='Watchkeep' if side<0 else 'Kestrel'
    ASSEMBLY=brand+'Brochures'
    tilt=math.radians(18)
    right=Vector((0,0,side));up=Vector((side*math.sin(tilt),math.cos(tilt),0))
    normal=Vector((-side*math.cos(tilt),math.sin(tilt),0))
    game_basis=Matrix((right,up,normal)).transposed()
    conversion=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
    for i,z in enumerate((-1.5,-.95)):
        centre=Vector((side*11.82,-6.746,z))
        box('Weighted desk foot',(side*11.88,-6.898,z),(.22,.020,.195),'Dark',.003)
        for dz in (-.070,.070):
            rod('Back brace',(side*11.96,-6.884,z+dz),centre-up*.060-normal*.010+Vector((0,0,dz)),.009,'Steel',8)
        oriented_box('Folded upright',centre-normal*.009,(.178,.242,.012),right,up,normal,'Petrol' if side<0 else 'Ochre')
        oriented_box('A5 paper stack',centre,(.148,.210,.004),right,up,normal,'Paper',.0003)
        for dy in (-.108,-.113):
            oriented_box('Folded retaining lip',centre+up*dy+normal*.007,(.178,.010,.026),right,up,normal,'Steel',.001)
        for dz in (-.083,.083):
            oriented_box('Pocket side lip',centre+right*dz-up*.060+normal*.003,(.012,.092,.018),right,up,normal,'Steel',.001)
        for layer in (-.001,0,.001):
            # Individual exposed sheet edges on the outer stack edge.
            oriented_box('Paper leaf edge',centre+right*.074+normal*layer,(.001,.207,.0003),right,up,normal,'Ivory',0)
        display=anchor(brand+'Brochure'+str(i),centre+normal*.0035)
        display.rotation_mode='QUATERNION'
        display.rotation_quaternion=(conversion@game_basis@conversion.inverted()).to_quaternion()


def elevator():
    global ASSEMBLY
    ASSEMBLY='ElevatorSurround'
    for side in (-1,1):
        # Deep pockets receive the fully retracted leaves; their front cassettes
        # are solid outside the clear opening, never across the walking path.
        box('Door pocket',(side*3.24,1.57,.04),(2.26,3.14,.38),'Dark',.035)
        box('Pocket face',(side*3.24,1.57,-.173),(2.08,2.98,.055),'Ivory',.03)
        box('Recessed side panel',(side*3.24,1.55,-.211),(1.79,2.49,.022),'Petrol',.014)
        box('Jamb extrusion',(side*2.105,1.59,-.135),(.11,3.18,.30),'Steel',.012)
        box('Jamb seal',(side*2.044,1.55,-.03),(.016,3.10,.13),'Rubber',.003)
        for y in (.20,2.95):
            for dx in (-.80,.80): bolt((side*3.24+dx,y,-.230),'z')
        for y in (.38,.47,.56):
            box('Low ventilation slot',(side*3.25,y,-.23),(1.2,.035,.012),'Rubber',.003)
    box('Header housing',(0,3.37,.01),(8.78,.43,.43),'Dark',.045)
    box('Header trim',(0,3.36,-.228),(8.6,.28,.055),'Ivory',.018)
    box('Recessed destination field',(0,3.36,-.261),(3.6,.19,.015),'Rubber',.004)
    box('Door status diffuser',(0,3.155,-.19),(4.02,.028,.02),'Mint',.004)
    box('Upper guide track',(0,3.09,.085),(8.25,.065,.10),'Steel',.008)
    # Track is flush with the existing station floor: top Y=0.
    box('Flush threshold',(0,-.012,0),(4.16,.024,.34),'Steel',.004)
    for zz in (-.07,.07):
        box('Threshold guide',(0,-.0005,zz),(4.1,.001,.012),'Dark',0)
    box('Call control mount',(2.65,1.39,-.27),(.28,.58,.12),'Dark',.025)
    box('Call control bezel',(2.65,1.43,-.338),(.21,.36,.028),'Steel',.008)
    box('Call control recess',(2.65,1.45,-.358),(.15,.24,.012),'Rubber',.004)
    rod('Call button',(2.65,1.19,-.352),(2.65,1.19,-.37),.045,'Mint',16)
    anchor('ElevatorHeader',(0,3.36,-.276))
    anchor('ElevatorCallScreen',(2.65,1.45,-.368))
    ASSEMBLY='ElevatorCabin'
    for side in (-1,1):
        box('Cabin wall',(side*2.17,1.60,1.76),(.16,3.2,3.08),'Dark')
        for z in (.57,1.55,2.54):
            box('Replaceable cabin lining',(side*2.077,1.79,z),(.035,2.45,.91),'Ivory')
            box('Cabin lower kickplate',(side*2.061,.24,z),(.035,.40,.91),'Steel')
        rod('Side handrail',(side*1.99,1.02,.50),(side*1.99,1.02,2.77),.028,'Steel',12)
        for z in (.70,2.65):
            rod('Rail bracket',(side*2.08,1.02,z),(side*1.99,1.02,z),.015,'Dark',8)
    # The inherited hangar vestibule rear begins at doorZ+3.1. Keep the visible
    # cabin lining and rail in front of it; roof and side-shell depth stay 3.4 m.
    box('Cabin rear',(0,1.6,3.06),(4.5,3.2,.08),'Dark')
    for x in (-1.48,-.49,.49,1.48):
        box('Rear lining',(x,1.77,3.002),(.92,2.46,.035),'Ivory')
        box('Rear kickplate',(x,.24,3.00),(.92,.4,.025),'Steel')
    rod('Rear handrail',(-1.87,1.02,2.88),(1.87,1.02,2.88),.028,'Steel')
    for x in (-1.6,1.6):
        rod('Rear rail bracket',(x,1.02,2.88),(x,1.02,3.00),.015,'Dark',8)
    box('Cabin ceiling',(0,3.27,1.7),(4.5,.15,3.4),'Dark')
    for x in (-1.40,1.40):
        box('Ceiling diffuser',(x,3.185,1.8),(.09,.02,2.9),'Mint',.005)
    box('Internal controls',(2.027,1.47,.65),(.11,.75,.40),'Dark')
    box('Internal display recess',(1.962,1.56,.65),(.015,.41,.27),'Rubber',.004)
    anchor('ElevatorCabinScreen',(1.948,1.56,.65))
    for side,name in [(-1,'ElevatorLeafLeft'),(1,'ElevatorLeafRight')]:
        ASSEMBLY=name
        x=side*1.04
        # Recess the structural slab behind its layered front faces while the
        # complete leaf retains the exact [-.065,+.065] collision thickness.
        box('Pressure leaf',(x,1.55,.006),(2.04,3.1,.118),'Steel',.016)
        # All extra faces stay within the collision depth of the original leaf.
        clipped_panel('Inset door cassette',x,1.58,-.058,1.82,2.75,.012,.17,'Ivory')
        clipped_panel('Door recess',x+side*.32,1.59,-.064,.54,1.56,.002,.085,'Petrol')
        box('Leading edge gasket',(x-side*1.009,1.55,0),(.016,3.08,.124),'Rubber',.003)
        for yy in (.34,2.77):
            box('Reinforcing band',(x,yy,-.064),(1.87,.055,.002),'Dark',0)
        box('Vertical status inlay',(x-side*.87,1.55,-.0645),(.022,2.30,.001),'Mint',0)


def export_asset(filename, moving=None):
    moving=moving or {}
    manifest=[]
    collision_boxes=[]
    bpy.context.view_layer.update()
    for name,objects in PARTS.items():
        points=[obj.matrix_world@Vector(corner) for obj in objects for corner in obj.bound_box]
        game=[(p.x,p.z,-p.y)for p in points]
        triangles=0
        for obj in objects:
            obj.data.calc_loop_triangles()
            triangles+=len(obj.data.loop_triangles)
        manifest.append({'name':name,'bounds':{
            'min':[min(p[i]for p in game)for i in range(3)],
            'max':[max(p[i]for p in game)for i in range(3)]},'triangles':triangles})
        if triangles>10000:
            raise RuntimeError(f'Assembly {name} exceeds 10k triangles: {triangles}')
        # Measure a real standalone GLB per assembly, including its own JSON and
        # materials. Never charge the entire shared aggregate buffer to each prop.
        with tempfile.TemporaryDirectory(prefix='aeon-prop-budget-') as directory:
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:obj.select_set(True)
            audit_path=Path(directory)/'assembly.glb'
            bpy.ops.export_scene.gltf(filepath=str(audit_path),export_format='GLB',
                export_yup=True,export_apply=True,use_selection=True,export_extras=False)
            manifest[-1]['standaloneBytes']=audit_path.stat().st_size
        if manifest[-1]['standaloneBytes']>1000000:
            raise RuntimeError(f'Assembly {name} exceeds 1MB')
        if name not in moving and not name.endswith('Brochures') and not name.endswith('BannerHardware'):
            # Walls, jambs and cabin need individual solids: their enclosing AABB
            # would seal the shop or elevator interior. Furniture is a compact
            # footprint which should not be walked through between its drawers.
            if 'Architecture' in name or name in ('ElevatorSurround','ElevatorCabin'):
                for obj in objects:
                    points=[obj.matrix_world@Vector(c)for c in obj.bound_box]
                    p=[(v.x,v.z,-v.y)for v in points]
                    lo=[min(v[i]for v in p)for i in range(3)]
                    hi=[max(v[i]for v in p)for i in range(3)]
                    if min(hi[i]-lo[i]for i in range(3)) >= .025:
                        collision_boxes.append({'name':obj.name,'min':lo,'max':hi})
            else:
                collision_boxes.append({'name':name,**manifest[-1]['bounds']})
    for name,origin in moving.items():
        parent=anchor(name,origin)
        bpy.context.view_layer.update()
        for obj in PARTS[name]:
            obj.parent=parent
            obj.matrix_parent_inverse=parent.matrix_world.inverted()
    # Batch static geometry by material; moving assemblies get their own batches.
    parents=[None]+[bpy.data.objects[name]for name in moving]
    batches=[]
    for parent in parents:
        for mat in M.values():
            objects=[obj for values in PARTS.values()for obj in values
                if obj.parent==parent and obj.data.materials[0]==mat]
            if not objects:
                continue
            batches.append((parent,mat,objects))
    for parent,mat,objects in batches:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=('Static' if parent is None else parent.name)+'_'+mat.name
    bpy.context.scene['assetManifest']=json.dumps(manifest,separators=(',',':'))
    bpy.context.scene['collisionBoxes']=json.dumps(collision_boxes,separators=(',',':'))
    bpy.context.scene['coordinates']='Game metres, X right / Y up / Z aft'
    bpy.context.scene['builder']='blender/build_station_concourse.py'
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',
        export_yup=True,export_apply=True,export_extras=True)
    print('CONCOURSE_EXPORT',filename,json.dumps(manifest,separators=(',',':')))


def render_studio(kind):
    """Explicitly Blender studio evidence, never represented as game rendering."""
    global ASSEMBLY
    if '--render-dir' not in sys.argv:
        return
    directory=Path(sys.argv[sys.argv.index('--render-dir')+1])
    directory.mkdir(parents=True,exist_ok=True)
    ASSEMBLY='StudioOnly'
    is_hub=kind=='concourse'
    floor=-8 if is_hub else 0
    box('Studio ground',(0,floor-.05,0),(50,.1,44),'Dark',0)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1200
    scene.render.resolution_y=800
    scene.render.resolution_percentage=100
    scene.world.use_nodes=True
    world=scene.world.node_tree.nodes.get('Background')
    world.inputs['Color'].default_value=(.24,.28,.32,1)
    world.inputs['Strength'].default_value=.5
    target=(0,floor+1.5,0)
    for name,power,size,p in [('Key',2300,9,(1,floor+8,-4)),
        ('Fill',1600,8,(-12 if is_hub else -5,floor+6,5)),
        ('Rim',1800,7,(13 if is_hub else 5,floor+5,7))]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy=power;data.shape='DISK';data.size=size
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
        ob.location=vec(p)
        ob.rotation_euler=(vec(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    views=[('concourse',(0,-3.4,21),(0,-6.4,-1),32),
        ('armory',(-7.5,-5.3,5.5),(-16,-6.5,-4.2),32),
        ('seating',(-3.4,-6.2,7.5),(-6,-7.45,10.5),48)] if is_hub else [
        ('elevator-closed',(6.7,2.9,-8.8),(0,1.65,.3),42),
        ('elevator-open',(4.2,2.3,-7),(0,1.6,1.4),36)]
    bpy.ops.object.camera_add()
    camera=bpy.context.object;scene.camera=camera
    for name,position,look,lens in views:
        if name=='elevator-open':
            bpy.data.objects['ElevatorLeafLeft'].location.x-=2.05
            bpy.data.objects['ElevatorLeafRight'].location.x+=2.05
        camera.location=vec(position)
        camera.rotation_euler=(vec(look)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.lens=lens
        scene.render.filepath=str(directory/(name+'.png'))
        bpy.ops.render.render(write_still=True)


material('Ivory','station-ivory',.18,.46)
material('Petrol','station-petrol',.28,.45)
material('Steel','station-steel',.65,.35)
material('Dark','station-dark',.30,.55)
material('Rubber','station-rubber',0,.84)
material('Mint','mint',.0,.42,.7)
material('Ochre','station-ochre',.22,.54)
material('Paper','station-paper',0,.92)
if '--only-elevator' not in sys.argv:
    reset()
    for side in (-1,1):
        shop_architecture(side)
        counter(side)
    for i,z in enumerate((-7.1,5.1)):
        armory_rack(z,i)
        component_rack(z,i)
    armory_rack(-1.0,2)
    component_rack(-1.0,2)
    turbine_display()
    seating(-6,10.5,0)
    seating(6,10.5,1)
    directory_pylon(-5.5,'DirectoryNorth')
    directory_pylon(5.5,'DirectorySouth')
    for side,brand in [(-1,'Watchkeep'),(1,'Kestrel')]:
        print_frame(brand+'PosterEnd',(side*14.2,-6.35,-10.927),1.20,1.70)
        for i,z in enumerate((-4.05,2.05)):
            print_frame(brand+'PosterGap'+str(i),(side*19.675,-6.45,z),1.15,1.60,side)
        banner_hardware(side)
        brochure_holders(side)
    export_asset('station-concourse.glb')
    render_studio('concourse')
if '--only-concourse' not in sys.argv:
    reset()
    elevator()
    export_asset('station-elevator.glb',{'ElevatorLeafLeft':(-1.04,1.55,0),
        'ElevatorLeafRight':(1.04,1.55,0)})
    render_studio('elevator')
