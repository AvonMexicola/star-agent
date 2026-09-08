"""Kestrel interceptor. blender -b --python blender/build_fighter.py -- --stage blockout

Design coordinates: metres, Y up, nose -Z, gear contact Y=0.
The script is the authoring source. Render helpers never enter the exported asset.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
sys.path.insert(0,str(HERE))
import fighter_geometry as g
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--stage',default='blockout');p.add_argument('--round',default='round-1');p.add_argument('--render',action='store_true');p.add_argument('--view',default='all')
ARGS=p.parse_args(args)
OUT=ROOT/'assets/kestrel';OUT.mkdir(exist_ok=True,parents=True)
QA=ROOT/'docs/qa/kestrel'/ARGS.round;QA.mkdir(exist_ok=True,parents=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=30

def mat(name,color,metal=.0,rough=.4,emission=0,alpha=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,alpha)
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,alpha);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    bs.inputs['Alpha'].default_value=alpha
    if alpha<1:m.surface_render_method='DITHERED'
    return m

ivory=mat('Armour | ceramic white',(.72,.76,.73),.3,.34)
graphite=mat('Structure | dark polymer',(.026,.038,.040),.3,.42)
metal=mat('Mechanism | brushed titanium',(.27,.31,.32),.8,.3)
glass=mat('Canopy | smoked quartz',(.043,.115,.135),.52,.15)
mint=mat('Status | mint',(.467,.864,.638),.1,.3,1.5)
root=g.empty('Kestrel');root['massKg']=9000;root['lengthMetres']=13.5;root['wingspanMetres']=9;root['fuelCapacity']=0;root['heatCapacity']=0

hull=g.fuselage('Fuselage | continuous chine',[(-6.75,.012,1.62,1.66,1.68),(-5.65,.29,1.4,1.72,1.9),(-4.15,.54,1.18,1.72,2.04),(-2.15,.73,1.0,1.75,2.08),(-.25,.82,.94,1.73,2.02),(2.25,.92,.90,1.7,2.08),(4.45,.67,1.04,1.64,1.94),(5.65,.3,1.25,1.49,1.6)],ivory,root)

# Continuous swept wing roots merge the narrow forebody into the drives.
for s,side in [(-1,'L'),(1,'R')]:
    pts=lambda p:[(s*x,z) for x,z in p]
    # Six-sided cross sections roll the shoulder down to a thin outer chine.
    shoulder=[(-3.6,.45,.55,1.46,2.00,1.72),(-2.7,.59,.87,1.28,2.06,1.69),(-.8,.64,1.75,1.15,2.10,1.70),(1.5,.65,1.96,1.10,2.13,1.75),(4.7,.47,1.94,1.16,2.03,1.77),(5.8,.33,1.70,1.29,1.77,1.66)]
    sp=[]
    for z,xi,xo,low,top,edge in shoulder:
        sp.extend([(s*xi,top,z),(s*(xi*.3+xo*.7),top-.12,z),(s*xo,edge,z),(s*(xo-.025),edge-.085,z),(s*(xi*.3+xo*.7),low+.10,z),(s*xi,low,z)])
    sf=[tuple(range(5,-1,-1)),tuple(range(30,36))]+[(k*6+i,k*6+(i+1)%6,(k+1)*6+(i+1)%6,(k+1)*6+i) for k in range(5) for i in range(6)]
    g.mesh('Shoulder | rolled chine '+side,sp,sf,ivory,.022,root)
    # Airfoil ring spans are x, leading z, trailing z, centre y, thickness.
    sections=[(.75,-2.0,5.55,1.69,.34),(1.85,-.7,5.45,1.70,.27),(3.2,1.1,4.94,1.75,.14),(4.5,2.85,4.40,1.82,.065)]
    v=[]
    for x,lead,trail,y,t in sections:
        v.extend([(s*x,y,lead),(s*x,y+t*.55,lead+.25*(trail-lead)),(s*x,y+t*.35,trail-.15*(trail-lead)),(s*x,y,trail),(s*x,y-t*.45,lead+.3*(trail-lead))])
    f=[(4,3,2,1,0),(15,16,17,18,19)]+[(k*5+i,k*5+(i+1)%5,(k+1)*5+(i+1)%5,(k+1)*5+i) for k in range(3) for i in range(5)]
    g.mesh('Wing | blended airfoil '+side,v,f,ivory,.009,root)
    # Canted tip fins grow from the trailing wing instead of floating as blocks.
    g.panel('Wingtip fin '+side,[(s*3.54,1.81,2.97),(s*4.42,3.18,4.47),(s*4.43,3.185,4.99),(s*3.69,1.80,4.72)],ivory,.036,.008,root)
    x=s*1.26
    g.fuselage('Drive | tapered nacelle '+side,[(-.45,.18,1.29,1.66,1.98),(.45,.50,1.12,1.69,2.10),(2.75,.72,.99,1.66,2.27),(4.4,.63,1.06,1.65,2.17),(5.92,.51,1.16,1.62,2.06)],graphite,root).location.x=x
    # A real loft sits outside the drive shell, broadest midway and necked aft.
    cp=[];sections=[(-.48,.16,1.99),(.55,.49,2.17),(2.75,.66,2.34),(4.25,.58,2.24),(5.43,.41,2.10)]
    for z,w,y in sections:cp.extend([(x-w,y-.20,z),(x-w*.58,y-.026,z),(x,y,z),(x+w*.58,y-.026,z),(x+w,y-.20,z)])
    cf=[(k*5+i,k*5+i+1,(k+1)*5+i+1,(k+1)*5+i) for k in range(4) for i in range(4)]
    cowl=g.mesh('Drive | lofted ceramic cowl '+side,cp,cf,ivory,.014,root)
    sol=cowl.modifiers.new('Cowl wall','SOLIDIFY');sol.thickness=.045
    noz=g.empty('Nozzle_'+side,(x,1.62,6.28),root)
    g.annulus('Exhaust | petal envelope '+side,x,1.62,[(5.76,.55),(6.1,.66),(6.65,.59),(6.75,.54),(6.75,.45),(6.1,.44),(5.82,.32)],metal,noz)
    g.rod('Exhaust | deep throat '+side,(x,1.62,5.81),(x,1.62,5.83),.31,mint,32,noz)

# Low, teardrop canopy; fore/aft taper is designed with the body, not a box on top.
canopy=g.empty('Canopy',(0,2.03,-.48),root)
cv=[];keys=[(-4.04,.035,2.04,.035),(-3.48,.38,2.05,.43),(-2.55,.56,2.06,.80),(-1.55,.56,2.04,.79),(-.72,.36,2.03,.38),(-.25,.05,2.03,.02)]
cs=[]
for k in range(len(keys)-1):
    a,b=keys[k],keys[k+1];before=keys[max(0,k-1)];after=keys[min(len(keys)-1,k+2)];dz=b[0]-a[0]
    for i in range(5):
        t=i/5;h00=2*t**3-3*t*t+1;h10=t**3-2*t*t+t;h01=-2*t**3+3*t*t;h11=t**3-t*t
        vals=[a[0]+dz*t]
        for j in range(1,4):
            m0=(b[j]-before[j])/(b[0]-before[0]);m1=(after[j]-a[j])/(after[0]-a[0]);vals.append(h00*a[j]+h10*dz*m0+h01*b[j]+h11*dz*m1)
        cs.append(vals)
cs.append(keys[-1])
for z,w,y,r in cs:
    for i in range(9):
        a=math.pi*i/8;cv.append((math.cos(a)*w,y+math.sin(a)*r,z))
cf=[(k*9+i,k*9+i+1,(k+1)*9+i+1,(k+1)*9+i) for k in range(len(cs)-1) for i in range(8)]
g.mesh('Canopy | single quartz shell',cv,cf,glass,0,canopy,True)
for s in [-1,1]:
    for a,b in zip(cs,cs[1:]):g.rod('Canopy | sill',(s*a[1],a[2],a[0]),(s*b[1],b[2],b[0]),.045,graphite,8,canopy)
g.fuselage('Spine | canopy turtleback',[(-.62,.30,1.98,2.10,2.30),(-.08,.35,1.97,2.07,2.32),(.7,.29,1.97,2.03,2.23),(1.45,.16,2.01,2.04,2.13),(2.1,.07,2.02,2.05,2.08)],ivory,root)

# Gear is separate even for the silhouette study. Pads make the ground datum explicit.
for name,x,z in [('Nose',0,-4.13),('L',-1.45,3.36),('R',1.45,3.36)]:
    gear=g.empty('Gear_'+name,(x,1.11,z),root)
    g.rod('Strut '+name,(x,1.15,z),(x,.23,z+.19),.075,metal,12,gear)
    g.box('Shoe '+name,(x,.09,z+.25),(.46,.18,.7),graphite,.04,gear)

for name,pnt in [('HP_Nose',(0,1.21,-4.98)),('HP_WingL',(-2.9,1.59,2.43)),('HP_WingR',(2.9,1.59,2.43)),('HP_Belly',(0,.91,.55)),('PilotEye',(0,2.49,-1.90))]:g.empty(name,pnt,root)

if ARGS.stage!='blockout':
    from fighter_detail import detail
    detail(root,hull,canopy,ivory,graphite,metal,glass,mint)

# A repeatable source file retains named objects; the mesh export is generated later.
bpy.context.scene.render.engine='CYCLES'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_distance=18
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kestrel.blend'))
# Keep editable Geometry Nodes and procedural finish groups in the .blend.
for o in [o for o in bpy.context.scene.objects if o.type=='CURVE']:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:g.apply(o)
g.unwrap([o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith('MFD_')])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/('kestrel-blockout.glb' if ARGS.stage=='blockout' else 'kestrel-detail.glb')),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)

if ARGS.render:
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.world.use_nodes=True;nt=scene.world.node_tree
    env=nt.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(OUT/'studio-small-09.hdr'))
    nt.links.new(env.outputs['Color'],nt.nodes.get('Background').inputs['Color']);nt.nodes.get('Background').inputs['Strength'].default_value=.45
    floor=mat('Studio floor',(.062,.073,.08),.05,.42)
    g.box('Studio floor',(0,-.06,0),(200,.1,200),floor,0)
    for name,pos,power,size in [('Key',(1,11,-5),1800,9),('Rim',(-8,7,6),2100,7),('Fill',(8,4,1),950,6)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=g.xyz(pos);o.rotation_euler=(Vector(g.xyz((0,1.3,0)))-o.location).to_track_quat('-Z','Y').to_euler()
    # Human proportion reference, never exported.
    person=mat('Scale figure',(.12,.16,.17),.05,.6)
    for name,a,b,r in [('torso',(-5.35,.85,-.4),(-5.35,1.43,-.4),.16),('leg L',(-5.45,.08,-.4),(-5.45,.9,-.4),.07),('leg R',(-5.25,.08,-.4),(-5.25,.9,-.4),.07),('arm L',(-5.55,.82,-.4),(-5.55,1.36,-.4),.055),('arm R',(-5.15,.82,-.4),(-5.15,1.36,-.4),.055)]:g.rod('Scale '+name,a,b,r,person)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.125,location=g.xyz((-5.35,1.665,-.4)));bpy.context.object.data.materials.append(person)
    cd=bpy.data.cameras.new('Review camera');co=bpy.data.objects.new('Review camera',cd);scene.collection.objects.link(co);scene.camera=co;cd.lens=50
    views={'front-quarter':(13,8,-16),'front':(0,5,-23),'side':(24,5,0),'rear-quarter':(-14,8,17),'rear':(0,5,23),'top':(0,25,.001)}
    for name,pos in views.items():
        if ARGS.view!='all' and name!=ARGS.view:continue
        cd.type='ORTHO' if name in ['top','front'] else 'PERSP';cd.ortho_scale=26 if name=='top' else 14
        co.location=g.xyz(pos);co.rotation_euler=(Vector(g.xyz((0,1.2,0)))-co.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(QA/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('KESTREL_RENDERS '+str(QA),flush=True)
