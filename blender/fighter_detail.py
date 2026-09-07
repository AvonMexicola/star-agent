"""Kestrel serviceable exterior, cockpit and deployable mechanisms.
Run only after the silhouette gate; the approved primary hull remains intact.
"""
import json,math
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
import fighter_geometry as g
from parts import hatch,vent,rivet_row,cable

ROOT=Path(__file__).resolve().parent.parent

def solid(name,color,metal=.0,rough=.4,emission=0,alpha=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,alpha)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,alpha);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Alpha'].default_value=alpha
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if alpha<1:m.surface_render_method='DITHERED'
    return m

def label(name,words,p,size,mat,rotation=(0,0,0),root=None):
    data=bpy.data.curves.new(name,'FONT');data.body=words;data.size=size;data.align_x='CENTER';data.align_y='CENTER';data.space_character=1.05;data.resolution_u=1
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=g.xyz(p);o.rotation_euler=rotation;data.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return g.parent(o,root)

def animate(o,name,seconds,closed,opened,stages=None):
    """Named NLA tracks merge each mechanism's moving subassemblies into a clip."""
    o.rotation_mode='XYZ';fps=30
    for time,rot in stages or [(0,closed),(seconds,opened)]:
        o.rotation_euler=rot;o.keyframe_insert(data_path='rotation_euler',frame=round(time*fps),group=name)
    action=o.animation_data.action;action.name=name+' / '+o.name
    # Blender exports NLA tracks with identical names as one animation.
    track=o.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(action.name,0,action);strip.action_frame_start=0;strip.action_frame_end=seconds*fps;strip.extrapolation='NOTHING'
    o.animation_data.action=None
    # The default authored pose is closed canopy, deployed gear, stowed ladder.
    track.mute=True;o.rotation_euler=opened if name=='GearDown' else closed
    o['animation']=name;o['seconds']=seconds

def translate_animation(o,name,seconds,offset):
    initial=o.location.copy()
    for frame,location in [(0,initial+Vector(g.xyz(offset))),(round(seconds*30),initial)]:
        o.location=location;o.keyframe_insert(data_path='location',frame=frame,group=name)
    action=o.animation_data.action;action.name=name+' / '+o.name
    track=o.animation_data.nla_tracks.new();track.name=name;track.strips.new(action.name,0,action);o.animation_data.action=None;track.mute=True;o.location=initial

def detail(root,hull,canopy,ivory,dark,metal,glass,mint):
    from materials import manufactured
    rubber=manufactured('Cockpit | charcoal textile',(.019,.025,.028),.0,.76,.04)
    black=solid('Cavity | shadow',(.005,.009,.011),.05,.82)
    amber=solid('Warning | amber',(.9,.36,.06),.15,.44)
    ink=solid('Decal | graphite',(.012,.025,.027),.05,.5)
    paint=manufactured('Livery | deep mint',(.10,.28,.24),.22,.4,.06)
    display=solid('MFD | unpowered',(.005,.023,.026),0,.7)
    glow=solid('Nozzle | mint core',(.467,.864,.638),.15,.32,1.8)
    # Replace the initial uniform materials with export-baked finishes.
    replacements={ivory:manufactured(ivory.name+' PBR',(.72,.76,.73),.3,.34,.15),dark:manufactured(dark.name+' PBR',(.026,.038,.040),.3,.42,.07),metal:manufactured(metal.name+' PBR',(.27,.31,.32),.8,.30,.08)}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':
            for slot in o.material_slots:
                if slot.material in replacements:slot.material=replacements[slot.material]
    ivory,dark,metal=[replacements[x] for x in (ivory,dark,metal)]
    g.apply(hull)
    # Machined cockpit opening, no hidden white hull through the pilot's knees.
    cutter=g.box('Cockpit tool',(0,2.48,-1.99),(1.18,2.1,2.91),None,.19)
    g.apply(cutter);g.cut(hull,cutter)
    cabin=g.empty('Cockpit',root=root)
    g.box('Cockpit | pressure tub',(0,1.415,-1.99),(1.10,.065,2.85),dark,.055,cabin)
    g.box('Cockpit | rear bulkhead',(0,1.73,-.59),(1.13,.61,.1),dark,.04,cabin)
    for s in [-1,1]:
        g.box('Cockpit | side liner',(s*.552,1.70,-1.97),(.046,.53,2.67),dark,.025,cabin)
        g.box('Cockpit | side console',(s*.425,1.72,-2.06),(.22,.20,1.04),dark,.04,cabin)
        for i in range(6):
            g.box('Cockpit | console key',(s*(.39+.055*(i%2)),1.831,-2.40+(i//2)*.11),(.033,.016,.054),amber if i==0 else metal,.006,cabin)
        cable('Cockpit | service loom',[(s*.50,1.52,-1.1),(s*.49,1.55,-1.8),(s*.5,1.53,-2.65)],.015,black,cabin)
    # Reclined single seat with shaped shell, pads, harness and emergency handle.
    seat=g.empty('Seat',(0,1.43,-1.94),cabin)
    g.box('Seat | pedestal',(0,1.49,-1.91),(.38,.15,.48),metal,.04,seat)
    g.box('Seat | cushion',(0,1.61,-1.99),(.50,.13,.59),rubber,.06,seat)
    back=g.panel('Seat | reclined shell',[(-.28,1.62,-1.69),(.28,1.62,-1.69),(.245,2.39,-1.38),(-.245,2.39,-1.38)],dark,.065,.034,seat)
    g.panel('Seat | back pad',[(-.21,1.69,-1.74),(.21,1.69,-1.74),(.195,2.27,-1.47),(-.195,2.27,-1.47)],rubber,.058,.026,seat)
    g.box('Seat | headrest',(0,2.33,-1.37),(.34,.20,.15),rubber,.055,seat)
    for s in [-1,1]:
        g.panel('Seat | shoulder harness',[(s*.15,2.27,-1.53),(s*.09,1.75,-1.77),(s*.035,1.72,-1.79),(s*.09,2.27,-1.54)],paint,.007,.002,seat)
        g.rod('Seat | lower rail',(s*.23,1.45,-2.3),(s*.23,1.45,-1.53),.023,metal,10,seat)
    g.box('Seat | harness latch',(0,1.74,-1.83),(.12,.07,.038),metal,.012,seat)
    g.rod('Seat | emergency handle',(-.085,1.7,-2.27),(.085,1.7,-2.27),.021,amber,10,seat)
    # Four physical 4:3 screen faces. Side pair stays below the canopy sill.
    for i,(x,y,z,w) in enumerate([(-.164,1.985,-3.14,.284),(.164,1.985,-3.14,.284),(-.414,1.76,-2.83,.232),(.414,1.76,-2.83,.232)],1):
        h=w*.75
        g.box('MFD bezel '+str(i),(x,y,z-.023),(w+.034,h+.034,.052),dark,.018,cabin)
        # Open planes have no meaningful "outside" for automatic normal repair.
        # Preserve the authored +Z-facing winding and its matching display UVs.
        screen=g.mesh('MFD_'+str(i),[(x-w/2,y-h/2,z+.008),(x+w/2,y-h/2,z+.008),(x+w/2,y+h/2,z+.008),(x-w/2,y+h/2,z+.008)],[(0,1,2,3)],display,0,cabin,recalc=False)
        screen['textureWidth']=512;screen['textureHeight']=384
        uv=screen.data.uv_layers.new(name='DisplayUV')
        for idx,xy in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[idx].uv=xy
        for j in range(4):g.box('MFD '+str(i)+' function key',(x-w*.37+j*w*.25,y-h*.5-.026,z+.006),(.025,.009,.010),metal,.002,cabin)
    g.box('Cockpit | glare shield',(0,2.14,-3.17),(.68,.047,.27),rubber,.03,cabin)
    hudmat=solid('HUD | optical glass',(.2,.6,.46),.0,.18,0,.16)
    hud=g.panel('HUD_Glass',[(-.17,2.21,-3.24),(.17,2.21,-3.24),(.17,2.45,-3.28),(-.17,2.45,-3.28)],hudmat,.006,0,cabin)
    for s in [-1,1]:g.rod('HUD | bracket',(s*.13,2.15,-3.17),(s*.13,2.22,-3.24),.009,metal,8,cabin)
    g.rod('Stick | shaft',(.35,1.81,-2.12),(.36,2.03,-2.10),.021,metal,10,cabin)
    g.box('Stick | grip',(.36,2.045,-2.1),(.066,.13,.067),rubber,.023,cabin)
    g.box('Stick | trigger',(.36,2.08,-2.143),(.035,.025,.014),amber,.006,cabin)
    g.rod('Throttle | rail',(-.425,1.84,-2.26),(-.425,1.84,-1.95),.017,metal,10,cabin)
    g.box('Throttle | grip',(-.425,1.90,-2.10),(.14,.086,.073),rubber,.02,cabin)
    for s in [-1,1]:g.box('Cockpit | rudder pedal',(s*.16,1.49,-3.18),(.16,.1,.13),metal,.018,cabin)
    label('Cockpit | identity','KESTREL  /  07',(0,2.172,-3.14),.035,mint,(0,0,0),cabin)
    # Canopy shell and seal, with an uninterrupted perimeter instead of bead-like rods.
    bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Alpha'].default_value=.29;bs.inputs['Metallic'].default_value=.22;bs.inputs['Roughness'].default_value=.16;glass.surface_render_method='DITHERED'
    for o in list(canopy.children):
        if 'sill' in o.name:bpy.data.objects.remove(o,do_unlink=True)
    for s in [-1,1]:
        cable('Canopy | perimeter seal',[(s*.035,2.04,-4.04),(s*.38,2.05,-3.48),(s*.56,2.06,-2.55),(s*.56,2.04,-1.55),(s*.36,2.03,-.72),(s*.05,2.03,-.25)],.029,dark,canopy)
    arc=[(.56*math.cos(i*math.pi/12),2.055+.81*math.sin(i*math.pi/12),-2.55) for i in range(13)]
    cable('Canopy | forward arch',arc,.022,metal,canopy)
    arc=[(.36*math.cos(i*math.pi/12),2.03+.38*math.sin(i*math.pi/12),-.72) for i in range(13)]
    cable('Canopy | rear pressure arch',arc,.035,dark,canopy)
    for s in [-1,1]:
        g.rod('Canopy | hinge axle',(s*.25,2.08,-.50),(s*.46,2.08,-.50),.062,metal,12,root)
        g.box('Canopy | amber release',(s*.58,2.052,-1.6),(.034,.03,.12),amber,.009,root)
    animate(canopy,'CanopyOpen',3,(0,0,0),(math.radians(57),0,0))
    # Surface hierarchy: actual cut seams, inlets, removable panels and cooling.
    for s,side in [(-1,'L'),(1,'R')]:
        x=s*1.26
        cowl=bpy.data.objects['Drive | lofted ceramic cowl '+side];g.apply(cowl)
        for z in [1.0,3.3,4.76]:g.cut(cowl,g.box('Cowl seam tool',(x,2.20,z),(1.8,.8,.012),None,0))
        # A short collar encloses the narrow aft cowl join flagged in review.
        g.annulus('Drive | attachment collar '+side,x,1.62,[(5.28,.58),(5.47,.60),(5.56,.57)],metal,root,32)
        # Inlets are inset into the sloped leading shoulder, with a dark throat.
        inlet=[(s*.95,1.73,-1.57),(s*1.38,1.75,-1.12),(s*1.61,1.64,-.74),(s*1.14,1.50,-1.05)]
        g.panel('Intake | recessed mouth '+side,inlet,black,.06,.028,root)
        for a,b in zip(inlet,inlet[1:]+inlet[:1]):g.rod('Intake | lip '+side,a,b,.032,metal,10,root)
        for j in range(4):g.rod('Intake | swept vane '+side,(s*(1.08+j*.09),1.67,-1.36+j*.085),(s*(1.20+j*.09),1.57,-1.13+j*.085),.014,dark,8,root)
        # Top surfaces follow the shape; broad paint areas are intentional livery.
        g.panel('Livery | wing sweep '+side,[(s*2.15,1.841,.12),(s*2.46,1.836,.56),(s*3.87,1.866,2.86),(s*3.64,1.861,2.97)],paint,.008,.002,root)
        g.panel('Livery | fin flash '+side,[(s*3.97,2.52,3.82),(s*4.40,3.155,4.49),(s*4.40,3.155,4.80),(s*4.02,2.54,4.20)],paint,.008,.002,root)
        # A dark aft flap seam is recessed into the actual airfoil.
        wing=bpy.data.objects['Wing | blended airfoil '+side];g.apply(wing)
        seam=g.box('Wing seam tool',(s*3.03,1.80,4.35),(2.48,.8,.015),None,0);g.cut(wing,seam)
        hatch('Wing | service access '+side,(s*2.67,1.832,3.23),(.44,.66),ivory,metal,dark,root)
        vent('Drive | cooling stack '+side,(x,2.287,2.38),(.50,.63),metal,black,root)
        rivet_row('Drive | captive fasteners '+side,(x-.30,2.248,3.72),(x+.30,2.248,3.72),5,metal,root)
        g.box('Wingtip | position light '+side,(s*4.30,1.85,3.45),(.045,.038,.29),mint,.006,root)
        # Deep exhaust petal walls and actuator linkage, not a flat glowing disc.
        nozzle=bpy.data.objects['Nozzle_'+side]
        for i in range(20):
            a=i*math.tau/20;da=math.tau/20*.41
            # The petal's inscribed chord and inward stock thickness both
            # clear the underlying envelope, including its aft radius .59 m.
            pts=[(x+r*math.cos(theta),1.62+r*math.sin(theta),z) for z,r in [(6.07,.695),(6.66,.620)] for theta in [a-da,a+da]]
            g.panel('Nozzle | articulated petal '+side,pts[:2]+pts[2:][::-1],dark if i%4 else metal,.018,.007,nozzle)
            if i%2==0:
                g.rod('Nozzle | actuator '+side,(x+.585*math.cos(a),1.62+.585*math.sin(a),5.57),(x+.689*math.cos(a),1.62+.689*math.sin(a),6.03),.017,metal,8,nozzle)
        g.annulus('Nozzle | internal baffle '+side,x,1.62,[(6.31,.444),(6.18,.39),(5.9,.315)],black,nozzle,32)
        # A narrow luminous liner remains visible at a rear-quarter angle;
        # the deeper disc alone is correctly occluded by the long nozzle wall.
        g.annulus('Exhaust | deep throat liner '+side,x,1.62,[(6.47,.443),(6.62,.443)],glow,nozzle,32)
        for o in nozzle.children:
            if 'deep throat' in o.name and 'liner' not in o.name:
                o.data.materials.clear();o.data.materials.append(glow)
                # The nacelle closes at z5.92; keep the visible throat aft of it.
                o.location.y-=.17
        # Hidden afterburner is explicit glTF metadata (glTF has no visibility bit).
        cone=g.annulus('AB_'+side,x,1.62,[(6.68,.39),(7.35,.25),(8.3,.002)],mint,root,20)
        # Move origin to outlet before shrinking so the zero-size mesh remains there.
        bpy.context.view_layer.update();origin=Vector(g.xyz((x,1.62,6.68)))
        for v in cone.data.vertices:v.co-=origin
        cone.location=origin;cone.scale=(0,0,0);cone['initiallyHidden']=True
        # Belly plumbing has protected runs, endpoints and clamps.
        cable('Belly | protected loom '+side,[(s*.73,1.0,.6),(s*.78,.99,1.25),(s*.83,1.02,2.6),(s*1.02,1.12,3.05)],.023,black,root)
        for z in [1.0,1.9,2.7]:g.box('Belly | loom clamp',(s*.79,1.0,z),(.14,.024,.046),metal,.005,root)
        label('Wing | registration '+side,'KESTREL',(s*2.89,1.848,3.91),.145,ink,(0,0,s*.14),root)
        label('Wing | no step '+side,'NO STEP',(s*3.29,1.84,4.23),.058,ink,(0,0,0),root)
        label('Drive | serial '+side,'07  /  KS-134',(x,2.272,3.83),.09,ink,(0,0,0),root)
        # Deliberate demarcation at the shoulder lead-in; the lip is a service seam.
        g.rod('Shoulder | pressure seam '+side,(s*.53,1.96,-3.5),(s*.76,1.91,-2.76),.008,dark,8,root)
    # Precision nose cap, secondary optical sensor and ventral hardpoint covers.
    g.cut(hull,g.box('Nose cap seam tool',(0,1.7,-5.60),(1,1,.010),None,0))
    for s in [-1,1]:
        g.panel('Nose | dielectric sensor',[(s*.34,1.84,-4.90),(s*.42,1.84,-4.42),(s*.36,1.96,-4.43),(s*.29,1.94,-4.91)],dark,.009,.006,root)
        g.rod('Nose | optical lens',(s*.365,1.847,-4.64),(s*.371,1.855,-4.64),.037,mint,12,root)
    for name in ['HP_Nose','HP_WingL','HP_WingR','HP_Belly']:
        node=bpy.data.objects[name];p=node.matrix_world.translation;p=(p.x,p.z,-p.y)
        g.box(name+' mounting plate',p,(.19,.034,.30),dark,.02,node);node['forward']=[0,0,-1];node['socketOnly']=True
    spec=json.loads((ROOT/'assets/kestrel/contract.json').read_text())
    conversion=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
    for r in spec['rcs']:
        p=Vector(r['position']);d=Vector(r['direction']);node=g.empty(r['name'],p,root)
        q=d.to_track_quat('-Z','Y').to_matrix();node.rotation_mode='QUATERNION';node.rotation_quaternion=(conversion@q@conversion.inverted()).to_quaternion();node['direction']=list(d)
        g.rod(r['name']+' housing',p-d*.032,p+d*.011,.066,metal,12,node)
        g.rod(r['name']+' throat',p+d*.012,p+d*.016,.045,black,12,node)
    # Three independent oleo strut nodes, with folded dimensions inside the hull.
    for name,x,z in [('Nose',0,-4.13),('L',-1.45,3.36),('R',1.45,3.36)]:
        gear=bpy.data.objects['Gear_'+name]
        # Keep deployed world geometry while raising the actual retracting pivot.
        children=list(gear.children);world={o:o.matrix_world.copy() for o in children};gear.location=g.xyz((x,1.74,z))
        bpy.context.view_layer.update()
        for o in children:o.matrix_world=world[o]
        for o in children:
            if o.name.startswith('Strut'):bpy.data.objects.remove(o,do_unlink=True)
        g.rod('Gear | oleo cylinder '+name,(x,1.69,z),(x,.65,z+.11),.096,dark,12,gear)
        lower_gear=g.empty('Oleo_'+name,(x,.23,z+.19),gear)
        g.rod('Gear | polished piston '+name,(x,.77,z+.10),(x,.23,z+.19),.058,metal,12,lower_gear)
        g.rod('Gear | trailing link '+name,(x,1.03,z-.32),(x,.27,z+.16),.033,metal,10,gear)
        g.rod('Gear | torque link '+name,(x+.10,.58,z+.08),(x+.10,.42,z-.055),.023,metal,8,gear)
        g.rod('Gear | torque link '+name,(x+.10,.42,z-.055),(x+.10,.28,z+.17),.023,metal,8,gear)
        g.box('Gear | shoe cap '+name,(x,.193,z+.25),(.39,.037,.58),metal,.022,gear)
        g.box('Gear | warning flash '+name,(x,.216,z+.25),(.24,.006,.24),amber,.002,gear)
        foot=g.empty('ShoeJoint_'+name,(x,.09,z+.25),lower_gear)
        for o in list(gear.children):
            if o.type=='MESH' and (o.name.startswith('Shoe '+name) or o.name in ['Gear | shoe cap '+name,'Gear | warning flash '+name]):g.parent(o,foot)
        animate(foot,'GearDown',1.2,(-math.pi/2,0,0),(0,0,0))
        translate_animation(lower_gear,'GearDown',1.2,(0,.60,0))
        g.box('Gear | bay recess '+name,(x,1.23,z-.5),(.48,.13,1.33),black,.06,root)
        gear['compressionAxis']=[0,1,0];gear['maxCompression']=.22
        animate(gear,'GearDown',1.2,(math.pi/2,0,0),(0,0,0))
    # A swing-out bridge clears the rolled shoulder before any section descends.
    # Stowed, the three panels stack horizontally along the port shoulder.
    g.box('Entry | fixed sill step',(-.75,2.17,-1.75),(.36,.05,.46),dark,.015,root)
    ladder=g.empty('Ladder',(-.90,2.25,-1.75),root)
    upper=g.empty('Ladder_Upper',(-1.74,2.38,-1.75),ladder)
    mid=g.empty('Ladder_Middle',(-1.765,1.60,-1.75),upper)
    lower=g.empty('Ladder_Lower',(-1.715,.82,-1.75),mid)
    for z in [-1.98,-1.52]:
        g.rod('Ladder | bridge rail',(-.90,2.25,z),(-1.74,2.25,z),.026,metal,10,ladder)
        g.rod('Ladder | upper knuckle',(-1.74,2.25,z),(-1.74,2.38,z),.035,metal,10,ladder)
    for x in [-.95,-1.13,-1.31,-1.49,-1.67]:
        g.box('Ladder | bridge tread',(x,2.275,-1.75),(.10,.035,.43),dark,.008,ladder)
    for node,y in [(upper,2.38),(mid,1.60),(lower,.82)]:
        for z in [-1.97,-1.53]:g.rod('Ladder | rail',(-1.74,y,z),(-1.74,y-.78,z),.022,metal,10,node)
        for t in [.25,.62,.97]:
            g.rod('Ladder | rung',(-1.74,y-.78*t,-1.97),(-1.74,y-.78*t,-1.53),.026,dark,10,node)
            g.rod('Ladder | rung tread',(-1.766,y-.78*t+.014,-1.90),(-1.766,y-.78*t+.014,-1.60),.012,amber,8,node)
        g.rod('Ladder | hinge',(-1.74,y,-2.0),(-1.74,y,-1.5),.033,metal,10,node)
    for z in [-1.97,-1.53]:g.box('Ladder | foot',(-1.74,.063,z),(.14,.126,.11),rubber,.017,lower)
    zero=(0,0,0);yaw=(0,0,math.pi/2);fold=(0,math.pi/2,0);back=(0,math.pi,0)
    # All sections unfold outboard. Offset hinge pins leave 5 cm between
    # stacked rails; reversing the clip folds the lower section first.
    animate(ladder,'LadderDown',1.8,yaw,zero,[(0,yaw),(.55,zero),(1.8,zero)])
    animate(upper,'LadderDown',1.8,fold,zero,[(0,fold),(.55,fold),(1.0,zero),(1.8,zero)])
    animate(mid,'LadderDown',1.8,back,zero,[(0,back),(1.0,back),(1.45,zero),(1.8,zero)])
    animate(lower,'LadderDown',1.8,back,zero,[(0,back),(1.45,back),(1.8,zero)])
    root['stage']='detailed-authoring-candidate'
