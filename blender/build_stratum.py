"""Build Meridian Stratum M-05 from the canonical layout; no downloaded art.

blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_stratum.py
The editable .blend is saved before batching. No renderer/GPU is required.
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess
import sys
import zlib
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'blender'))
import stratum_geometry as g

ASSET=ROOT/'assets/stratum'
TEX=ASSET/'textures'
TEX.mkdir(parents=True,exist_ok=True)
(ROOT/'public/models').mkdir(parents=True,exist_ok=True)
L=json.loads((ASSET/'layout.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
bpy.context.preferences.filepaths.save_version=0


def png(path,pixels):
    pixels=np.uint8(np.clip(pixels,0,1)*255+.5)
    h,w,c=pixels.shape
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    raw=b''.join(b'\0'+pixels[y].tobytes() for y in range(h))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2 if c==3 else 6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))


def textures():
    # Four metres per repeat: 3.9mm/texel. A small separate roughness signal
    # describes sprayed enamel/brushed service surfaces, without baked lighting.
    n=1024
    y,x=np.mgrid[0:n,0:n]/n
    rng=np.random.default_rng(505)
    grain=rng.normal(0,1,(n,n))
    weave=np.sin(x*math.tau*91+np.sin(y*math.tau*3))
    broad=np.sin(x*math.tau*7)*np.sin(y*math.tau*5)
    base=np.clip(.982+grain*.004+broad*.003,.96,1)
    rough=np.clip(.86+grain*.055+weave*.035+broad*.025,.64,1)
    # True tangent surface signal with bounded slopes, unrelated to albedo.
    nx=.006*np.sin(x*math.tau*91)+.003*np.sin(y*math.tau*41)
    ny=.005*np.cos(y*math.tau*67)
    normal=np.stack((nx,ny,np.sqrt(1-nx*nx-ny*ny)),axis=2)*.5+.5
    png(TEX/'stratum-basecolor.png',np.repeat(base[:,:,None],3,axis=2))
    png(TEX/'stratum-normal.png',normal)
    png(TEX/'stratum-orm.png',np.stack((np.ones_like(x),rough,np.ones_like(x)),axis=2))
    for name in ['basecolor','normal','orm']:
        subprocess.run(['magick',str(TEX/f'stratum-{name}.png'),'-define','webp:lossless=true',str(TEX/f'stratum-{name}.webp')],check=True)
    images={}
    for name in ['basecolor','normal','orm']:
        image=bpy.data.images.load(str(TEX/f'stratum-{name}.png'),check_existing=True)
        image.colorspace_settings.name='sRGB' if name=='basecolor' else 'Non-Color'
        images[name]=image
    return images


images=textures()
finish={}


def material(name,color,rough=.5,metal=0,normal=.3,emission=0,alpha=1):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,alpha)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    p.inputs['Alpha'].default_value=alpha
    if alpha<1:
        mat.surface_render_method='DITHERED'
        p.inputs['Transmission Weight'].default_value=.16
    elif not emission:
        n=mat.node_tree.nodes
        link=mat.node_tree.links
        color_map=n.new('ShaderNodeTexImage');color_map.image=images['basecolor']
        mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
        mix.inputs[2].default_value=(*color,1)
        link.new(color_map.outputs['Color'],mix.inputs[1]);link.new(mix.outputs[0],p.inputs['Base Color'])
        bump_map=n.new('ShaderNodeTexImage');bump_map.image=images['normal']
        bump=n.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=normal
        link.new(bump_map.outputs['Color'],bump.inputs['Color']);link.new(bump.outputs[0],p.inputs['Normal'])
        orm=n.new('ShaderNodeTexImage');orm.image=images['orm']
        separate=n.new('ShaderNodeSeparateColor');link.new(orm.outputs[0],separate.inputs[0])
        multiply=n.new('ShaderNodeMath');multiply.operation='MULTIPLY';multiply.inputs[1].default_value=rough
        link.new(separate.outputs['Green'],multiply.inputs[0]);link.new(multiply.outputs[0],p.inputs['Roughness'])
        link.new(separate.outputs['Blue'],p.inputs['Metallic']) if metal==1 else None
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    finish[name]={'baseColorFactor':[*color,alpha],'roughnessFactor':rough,'metallicFactor':metal,'normalScale':normal,'textured':alpha==1 and not emission}
    return mat


ivory=material('Stratum | ivory enamel',(.76,.79,.73),.55,0,.23)
structure=material('Stratum | graphite frame',(.025,.037,.039),.73,.05,.22)
petrol=material('Stratum | petrol service',(.035,.16,.16),.62,.05,.25)
metal=material('Stratum | brushed mechanisms',(.34,.39,.40),.40,.9,.52)
rubber=material('Stratum | soft interior',(.034,.045,.049),.96,0,.18)
cavity=material('Stratum | bore interior',(.007,.013,.015),.78,.15,.3)
amber=material('Stratum | amber hazard',(.94,.40,.055),.60,0,.20)
mint=material('Stratum | powered indicator',(.36,.89,.66),.40,0,0,2.0)
screen=material('Stratum | display substrate',(.004,.018,.022),.40,.08)
glass=material('Stratum | protective glazing',(.095,.20,.22),.14,.02,0,0,.26)

root=g.empty('Stratum_M05',assetId='stratum',manufacturer='meridian-shipworks',model='Stratum M-05')
static=g.empty('Stratum_Static',root=root)
g.empty('PilotEye',L['interior']['pilotEye'],root)
g.empty('StandingEye',L['interior']['standingEye'],root)

# Hollow primary hull. The central route is an actual open volume, not a
# transparent box placed over a solid fuselage. Floor, cheeks, walls and roof
# are separate thickness-bearing panels with a visibly raked armored bow.
sections=[(-8.30,1.36,2.08,2.48),(-6.65,2.26,3.22,4.04),
          (-3.0,2.56,3.62,4.62),(2.7,2.68,3.62,4.62),
          (5.4,2.45,3.42,4.38),(7.22,2.16,3.34,3.96)]
for i in range(len(sections)-1):
    a,b=sections[i:i+2]
    za,wa,sa,ta=a;zb,wb,sb,tb=b
    for side in [-1,1]:
        # Front glazing occupies upper cheeks; solid walls begin behind cockpit.
        high_a=2.12 if i==0 else sa
        high_b=2.23 if i==0 else sb
        points=[(side*wa*.83,1.04,za),(side*wb*.83,1.04,zb),(side*wb,high_b,zb),(side*wa,high_a,za)]
        g.panel(f'Hull lower chine {i} {side}',points if side<0 else points[::-1],ivory,.10,static,.025)
        if i>=1:
            points=[(side*wa,sa,za),(side*wb,sb,zb),(side*wb*.66,tb,zb),(side*wa*.66,ta,za)]
            g.panel(f'Hull shoulder {i} {side}',points if side<0 else points[::-1],ivory,.09,static,.025)
    if i>=1:
        g.panel(f'Roof center {i}',[(-wa*.66,ta,za),(-wb*.66,tb,zb),(wb*.66,tb,zb),(wa*.66,ta,za)],ivory,.10,static,.018)

g.box('Structural belly',[0,1.15,.32],[4.28,.25,13.56],structure,.06,static)
g.box('Walk deck',[0,1.30,.30],[4.24,.10,13.50],metal,.01,static)
g.box('Deck central runner',[0,1.345,1.10],[1.08,.009,11.80],rubber,.001,static)
g.loft('Armored nose', [(-9.00,0,.84,1.50,1.75,1.91),(-8.25,0,1.48,1.20,2.00,2.20),
                      (-6.70,0,2.22,1.04,1.75,2.12)],ivory,static)

# Raked windshield, slender load-bearing mullions and armored cheek returns.
wind=[(-1.30,2.18,-8.31),(1.30,2.18,-8.31),(1.66,3.81,-6.64),(-1.66,3.81,-6.64)]
g.panel('Forward glazing',wind[::-1],glass,.018,static,.004)
for a,b in zip(wind,wind[1:]+wind[:1]):
    g.rod('Windshield armored rim',a,b,.075,structure,static,12)
g.rod('Windshield centre mullion',[0,2.18,-8.31],[0,3.81,-6.64],.037,metal,static,10)
for side in [-1,1]:
    sideglass=[(side*1.39,2.19,-8.16),(side*2.26,2.24,-6.65),
               (side*2.41,3.43,-4.98),(side*1.70,3.84,-6.63)]
    g.panel(f'Side pilot glazing {side}',sideglass,glass,.018,static,.003)
    for a,b in zip(sideglass,sideglass[1:]+sideglass[:1]):g.rod('Glazing side load frame',a,b,.061,structure,static,12)
    g.panel('Pilot armored cheek',[(side*1.49,2.0,-8.25),(side*2.37,2.13,-6.70),
                                  (side*2.38,2.42,-6.10),(side*1.44,2.32,-8.19)],petrol,.05,static)

# Extraction shoulders are continuous structural roots. They are lower in the
# forward half, leaving boom sweep/head clearance; aft roots rise into ore plant.
for side,label in [(-1,'Port'),(1,'Starboard')]:
    g.loft('Continuous extraction shoulder '+label,
        [(-5.20,side*3.16,.43,1.96,2.55,2.97),(-3.30,side*3.56,1.00,2.03,3.17,3.88),
         (.35,side*4.06,1.57,1.73,3.47,4.42),(3.85,side*4.36,1.61,2.16,3.41,4.16),
         (6.70,side*4.40,1.12,2.05,2.94,3.55)],ivory,static)
    g.loft('Outboard service fairing '+label,
        [(-2.8,side*4.12,.61,2.6,3.36,3.65),(1.15,side*5.12,.69,2.12,3.42,3.72),
         (4.65,side*5.00,.52,2.31,3.11,3.48)],petrol,static)
    # Engine profile changes continuously from faired body to open nozzle.
    g.tube('Drive tapered nozzle '+label,side*4.4,2.65,
           [(5.94,.96),(6.61,.91),(7.46,.83),(7.72,.70),(7.72,.61),(7.08,.52),(6.73,.47)],metal,static,32)
    g.tube('Drive cavity '+label,side*4.4,2.65,[(6.73,.47),(6.65,.43)],cavity,static,28)
    g.rod('Drive visible throat '+label,[side*4.4,2.65,6.65],[side*4.4,2.65,6.66],.42,petrol,static,28)
    g.empty('Nozzle_'+label,[side*4.4,2.65,7.72],root,kind='main-thruster',direction=[0,0,1],radius=.61)
    for i in range(7):
        z=.60+i*.39
        g.box('Ore radiator slot '+label,[side*5.20,3.51,z],[.46,.08,.15],structure,.013,static)
    for i in range(4):
        g.box('Processing cowl rib '+label,[side*3.83,4.17,1.0+i*.68],[1.32,.12,.11],metal,.025,static)
    g.rod('Process feed conduit '+label,[side*3.0,3.55,-2.30],[side*3.0,3.60,3.85],.13,metal,static,14)
    g.box('Aft lifting socket '+label,[side*2.54,3.22,6.65],[.30,.30,.42],amber,.05,static)

# Clear portal side piers and roof lintel; no centre sign or cassette crossing
# the ramp's rotation or its eventual walking plane.
for side in [-1,1]:
    g.box('Rear portal side '+str(side),[side*1.59,2.40,7.09],[1.10,2.70,.23],ivory,.045,static)
    g.box('Portal gasket '+str(side),[side*.985,2.44,7.05],[.054,2.18,.14],structure,.005,static)
    g.box('Portal approach light '+str(side),[side*1.03,2.78,7.23],[.035,.63,.025],mint,.004,static)
g.box('Rear portal lintel',[0,3.74,7.07],[2.13,.28,.24],structure,.04,static)
g.box('Rear overhead armor',[0,3.96,7.02],[2.45,.20,.37],ivory,.045,static)

# Interior fittings are kept outside the centre passage and modeled as actual
# volumes. Empty freight banks reserve net cargo space; no pretend cargo payout.
for side,label in [(-1,'Port'),(1,'Starboard')]:
    g.box('Berth plinth '+label,[side*1.48,1.60,-1.80],[1.27,.50,2.60],structure,.05,static)
    g.box('Berth mattress '+label,[side*1.46,1.94,-1.80],[1.18,.17,2.43],rubber,.065,static)
    g.box('Berth pillow '+label,[side*1.47,2.065,-2.71],[.86,.14,.40],petrol,.06,static)
    g.box('Berth task light '+label,[side*2.13,2.84,-2.63],[.035,.11,.46],mint,.014,static)
    g.box('Bin main '+label,[side*1.46,1.92,3.775],[1.30,1.14,1.45],petrol,.04,static)
    g.box('Bin inset access '+label,[side*.797,2.02,3.775],[.028,.66,.93],structure,.018,static)
    g.rod('Bin grip '+label,[side*.765,2.17,3.45],[side*.765,2.17,4.02],.025,metal,static,10)
    for z in [-.04,2.44]:
        g.box('Freight end tie rail '+label,[side*1.35,1.395,z],[1.30,.07,.06],metal,.008,static)
    # Only side/end structure touches a freight bank. The 1.2x1.2x2.4m volume
    # in layout remains empty, including its upper half and door access side.
    g.box('Freight outboard rail '+label,[side*2.00,1.47,1.2],[.07,.24,2.40],amber,.012,static)
    g.box('Cabin wall lining '+label,[side*2.18,2.23,1.75],[.075,1.72,9.90],structure,.018,static)
    g.box('Cabin continuous light '+label,[side*1.72,3.75,1.08],[.055,.027,11.75],mint,.009,static)
    for z in [-3.5,-.2,2.80,5.65]:
        g.box('Cabin side rib '+label,[side*2.07,2.54,z],[.13,2.30,.10],metal,.018,static)

# Pilot seat is the only terminal aisle obstruction, recorded explicitly.
g.box('Pilot pedestal',[0,1.62,-5.73],[.49,.54,.52],metal,.05,static)
g.box('Pilot cushion',[0,1.97,-5.79],[.80,.15,.69],rubber,.06,static)
g.box('Pilot seat back',[0,2.33,-5.29],[.81,.69,.10],rubber,.047,static)
g.box('Pilot headrest',[0,2.61,-5.30],[.48,.12,.12],petrol,.04,static)
for side in [-1,1]:
    g.box('Pilot hand rest',[side*.40,2.17,-5.72],[.06,.07,.41],petrol,.015,static)
    g.box('Pilot footwell',[side*.32,1.56,-6.45],[.38,.055,.58],structure,.008,static)
    g.box('Console shaped cheek',[side*1.40,2.02,-6.71],[.40,.48,.83],petrol,.055,static)
g.box('Console shallow bridge',[0,2.01,-7.0],[2.68,.25,.50],structure,.04,static)
for spec in L['displays']:
    x,y,z=spec['position'];w,h=spec['width'],spec['height'];angle=spec['rotationX']
    pivot=g.empty(spec['node']+'_Frame',[x,y,z],static)
    # Rotate around game X (=Blender X), preserving the mesh's authored origin.
    g.box(spec['node']+'_Bezel',[x,y,z-.025],[w+.072,h+.071,.048],metal,.018,pivot)
    face=g.mesh(spec['node'],[(x-w/2,y-h/2,z+.003),(x+w/2,y-h/2,z+.003),
                            (x+w/2,y+h/2,z+.003),(x-w/2,y+h/2,z+.003)],[(0,1,2,3)],screen,root=pivot)
    face['textureWidth']=512;face['textureHeight']=384
    face['page']=spec['page'];face['displaySurface']=True
    # Game rotationX maps directly to Blender rotationX.
    pivot.rotation_euler.x=angle
    uv=face.data.uv_layers.new(name='DisplayUV')
    for li,value in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=value

# A three-stage telescopic ramp: the hatch rotates while all plates are nested;
# extension follows rotation. All walk faces are <=12mm below the linear floor.
ramp=L['ramp'];rx,ry,rz=ramp['hinge'];length=ramp['segmentLength']
span=(math.hypot(ramp['run'],ry)-length)/2
ramp_root=g.empty(ramp['hingeNode'],ramp['hinge'],root,kind='boarding-ramp')
for index,name in enumerate(['Ramp_Base',*ramp['slideNodes']]):
    branch=ramp_root if index==0 else g.empty(name,ramp['hinge'],ramp_root)
    top=0
    walking_length=span-.004 if index<2 else length
    if index==2:
        g.mesh('Ramp tapered landing plate',[
            (-.95,ry,rz),(.95,ry,rz),(.95,ry,rz+walking_length),(-.95,ry,rz+walking_length),
            (-.95,ry-.08,rz),(.95,ry-.08,rz),(.95,ry-.005,rz+walking_length),(-.95,ry-.005,rz+walking_length)],
            [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],metal,root=branch)
    else:
        g.box('Ramp plate '+str(index),[0,ry-.040,rz+walking_length/2],[1.90,.08,walking_length],metal,.006,branch)
    for side in [-1,1]:
        runner_length=walking_length-.46 if index==2 else walking_length-.05
        g.box('Ramp side runner '+str(index),[side*(.91-index*.075),ry-.090,rz+runner_length/2],[.058,.055,runner_length],structure,.007,branch)
    for step in range(1,8 if index<2 else 9):
        g.box('Ramp grip '+str(index),[0,ry+top+.001,rz+step*.205],[1.69,.002,.042],rubber,.0002,branch)
    g.box('Ramp end hazard '+str(index),[0,ry+.001,rz+walking_length-.065],[1.78,.002,.07],amber,.0002,branch)
    if index:branch.location[2]-=ramp['stackDrop']*index  # Includes underside guide clearance.
g.box('Ramp outer hatch armor',[0,ry-.45,rz+1.10],[1.87,.10,2.20],petrol,.025,ramp_root)
for side in [-1,1]:
    g.rod('Ramp main trunnion',[side*.98,ry,rz],[side*1.14,ry,rz],.075,metal,static,18)
    g.rod('Ramp hinge motor',[side*1.14,ry,rz],[side*1.30,ry,rz],.145,structure,static,18)
ramp_root.rotation_euler.x=-math.pi/2

# Four independently named folding legs, actual feet and pneumatic struts.
# The foot contact plane is exactly y=0 with deployed gear. No scale-to-zero.
for leg in L['gear']['legs']:
    name=leg['node'];x,y,z=leg['pivot'];side=leg['side']
    pivot=g.empty(name,leg['pivot'],root,kind='landing-gear',side=side)
    g.rod(name+' axle',[x-.21,y,z],[x+.21,y,z],.17,metal,static,18)
    g.rod(name+' upper strut',[x,y,z],[x+side*.27,.57,z],.135,structure,pivot,14)
    g.rod(name+' piston',[x+side*.27,.70,z],[x+side*.42,.22,z],.089,metal,pivot,14)
    g.rod(name+' side brace',[x-side*.13,1.47,z+.18],[x+side*.39,.29,z+.18],.056,metal,pivot,10)
    g.box(name+' landing foot',[x+side*.42,.10,z],[.90,.20,.90],structure,.045,pivot)
    g.box(name+' tread sole',[x+side*.42,.020,z],[.79,.040,.77],rubber,.006,pivot)
    g.box(name+' identification',[x+side*.18,.83,z-.147],[.11,.30,.02],amber,.008,pivot)

# The mining head uses yaw at its load bearing root and pitch within the visible
# trunnion. The exact named muzzle sits 5cm beyond the open bore lip; no beam
# begins at ship centre or travels backwards through solid barrel geometry.
for spec in L['mining']['booms']:
    x,y,z=spec['pivot'];label='Port' if x<0 else 'Starboard'
    yaw=g.empty(spec['node'],spec['pivot'],root,kind='mining-yaw',yawLimit=L['mining']['yawLimit'])
    pitch=g.empty(spec['pitchNode'],spec['pivot'],yaw,kind='mining-pitch',pitchMin=L['mining']['pitchMin'],pitchMax=L['mining']['pitchMax'])
    g.rod('Mining yaw drum '+label,[x,y-.36,z],[x,y+.37,z],.39,metal,yaw,24)
    g.rod('Mining pitch trunnion '+label,[x-.56,y,z],[x+.56,y,z],.28,structure,pitch,22)
    for dx in [-.30,.30]:
        g.rod('Mining load rail '+label,[x+dx,y-.03,z-.25],[x+dx,y-.03,z-4.25],.12,metal,pitch,14)
    g.loft('Mining boom spine '+label,
       [(z-.15,x,.31,y-.22,y+.05,y+.26),(z-1.1,x,.41,y-.30,y+.13,y+.36),
        (z-3.76,x,.33,y-.24,y+.15,y+.29),(z-4.60,x,.43,y-.26,y+.09,y+.32)],petrol,pitch)
    for k in range(3):
        g.box('Boom armored saddle '+label,[x,y+.36,z-1.1-k*.86],[.76,.11,.31],ivory,.03,pitch)
    g.tube('Mining focus body '+label,x,y,
           [(z-4.17,.42),(z-4.52,.55),(z-5.06,.51),(z-5.40,.38),(z-5.40,.27),
            (z-4.93,.25),(z-4.71,.23)],metal,pitch,28)
    g.tube('Mining clear bore '+label,x,y,[(z-4.71,.23),(z-4.58,.21)],cavity,pitch,24)
    g.rod('Mining recessed emitter '+label,[x,y,z-4.57],[x,y,z-4.58],.21,mint,pitch,24)
    for side in [-1,1]:
        g.box('Mining focus hazard '+label,[x+side*.495,y,z-4.72],[.04,.25,.29],amber,.012,pitch)
    g.empty(spec['muzzle'],spec['muzzlePosition'],pitch,kind='mining-muzzle',forward=[0,0,-1],toolOnly=True)

# Original fleet markings on planar, appropriate surfaces. No competitor mark.
g.text('Roof identity','STRATUM',[0,4.632,.1],.56,petrol,rotation=(0,0,0),root=static)
g.text('Roof generation','M-05  /  EXTRACTION',[0,4.632,1.0],.18,structure,rotation=(0,0,0),root=static)
g.text('Rear maker','MERIDIAN',[0,3.81,7.206],.15,ivory,root=static)
g.text('Rear port ID','M-05',[-1.61,2.78,7.217],.22,petrol,root=static)

# Animation contracts are preserved as named transform nodes. Normalized poses
# are sampled by the shared pure systems adapter, so one canonical gear clock
# also works when root integrates navigation. The editable source starts parked.
for part in L['collisionParts']:
    g.empty('Collision_'+part['id'],root=root,collisionMin=part['min'],collisionMax=part['max'],kind='interior-obstacle')
for bank in L['storage']['freight']['banks']:
    g.empty(bank['id'],root=root,clearMin=bank['min'],clearMax=bank['max'],capacitySbu=16,kind='empty-freight-volume')

bpy.context.scene.world.color=(.05,.05,.05)
bpy.context.view_layer.update()
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and not obj.get('displaySurface'):
        g.planar_uv(obj)
for image in images.values():
    image.filepath='//textures/'+Path(image.filepath).name
bpy.ops.wm.save_as_mainfile(filepath=str(ASSET/'stratum.blend'))

# Export evaluated bevels with correct face normals and local metre UVs. Static
# batches are material-local; all named display meshes/pivots remain separate.
for obj in list(bpy.context.scene.objects):
    if obj.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    if obj.type=='MESH':
        g.apply(obj)
        if not obj.get('displaySurface'):g.planar_uv(obj)
        bm=__import__('bmesh').new();bm.from_mesh(obj.data)
        __import__('bmesh').ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()

# Preserve collision ownership before material batching loses per-fitting names.
# Dynamic booms, feet and the closed access cassette are measured by the Node
# rig sampler against the exact exported GLB after this build.
authored_bounds={}
drive_prefixes=('Continuous extraction shoulder','Outboard service fairing','Drive ',
                'Ore radiator','Processing cowl','Process feed conduit')
bpy.context.view_layer.update()
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    ancestor=obj.parent
    while ancestor and ancestor!=static:ancestor=ancestor.parent
    if ancestor!=static:continue
    if obj.name.startswith('Gear_') and 'axle' in obj.name:
        key='axle-'+obj.name.split(' axle')[0]
    elif obj.name.startswith(drive_prefixes):
        key='drive-port' if 'Port' in obj.name else 'drive-starboard'
    else:key='pressure-body'
    entry=authored_bounds.setdefault(key,{'id':key,'min':[float('inf')]*3,'max':[float('-inf')]*3})
    for vertex in obj.data.vertices:
        p=obj.matrix_world@vertex.co
        for axis,value in enumerate((p.x,p.z,-p.y)):
            entry['min'][axis]=min(entry['min'][axis],value);entry['max'][axis]=max(entry['max'][axis],value)
(ASSET/'authored-bounds.json').write_text(json.dumps({'source':'builder evaluated mesh vertices before material batching','parts':list(authored_bounds.values())},indent=2)+'\n')

groups={}
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH' or obj.get('displaySurface'):continue
    parent=obj.parent
    key=(parent.name if parent else '',obj.data.materials[0].name)
    groups.setdefault(key,[]).append(obj)
for (parent,matname),objects in groups.items():
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    objects[0].name=parent+'__'+matname.split('|')[-1].strip().replace(' ','_')

raw=ASSET/'stratum-export.glb'
bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',export_yup=True,
    export_apply=True,export_extras=True,export_animations=False,export_materials='EXPORT',
    export_image_format='AUTO',export_texcoords=True,export_normals=True,export_tangents=False)


def pack_glb(path):
    data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+n]);binary=data[28+n:]
    # Replace embedded source images, remove the old image byte ranges by
    # rebuilding every buffer view. All vertex/index/UV buffers remain exact.
    image_views={image['bufferView']:i for i,image in enumerate(doc.get('images',[]))}
    packed=bytearray()
    for index,view in enumerate(doc['bufferViews']):
        blob=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        if index in image_views:
            image=doc['images'][image_views[index]]
            name=image.get('name','')
            channel='normal' if 'normal' in name else 'orm' if 'orm' in name or 'Roughness' in name or 'Metallic' in name else 'basecolor'
            blob=(TEX/f'stratum-{channel}.webp').read_bytes()
            image['mimeType']='image/webp'
            image['name']='stratum-'+channel
        while len(packed)%4:packed.append(0)
        view['byteOffset']=len(packed);view['byteLength']=len(blob);packed.extend(blob)
    # glTF EXT_texture_webp is required for WebP-only textures.
    for texture in doc.get('textures',[]):
        texture.setdefault('extensions',{})['EXT_texture_webp']={'source':texture.pop('source')}
    for key in ['extensionsUsed','extensionsRequired']:
        doc[key]=sorted(set(doc.get(key,[])+['EXT_texture_webp']))
    for mat in doc.get('materials',[]):
        recipe=finish[mat['name']]
        pbr=mat.setdefault('pbrMetallicRoughness',{})
        pbr.update({k:recipe[k] for k in ['baseColorFactor','roughnessFactor','metallicFactor']})
        if 'normalTexture' in mat:mat['normalTexture']['scale']=recipe['normalScale']
    doc['buffers'][0]['byteLength']=len(packed)
    while len(packed)%4:packed.append(0)
    encoded=json.dumps(doc,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    output=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+8+len(packed))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed
    out=ROOT/'public/models/stratum.glb';out.write_bytes(output)
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    manifest={'id':'stratum','version':1,'stage':'silhouette candidate 01; native visual gate pending',
       'sha256':hashlib.sha256(output).hexdigest(),'bytes':len(output),'triangles':triangles,
       'meshCount':len(doc['meshes']),'primitiveCount':sum(len(m['primitives']) for m in doc['meshes']),
       'nodeCount':len(doc['nodes']),'source':'assets/stratum/stratum.blend','builder':'blender/build_stratum.py',
       'layout':'assets/stratum/layout.json','textureResolution':[1024,1024],
       'sourceSha256':hashlib.sha256((ASSET/'stratum.blend').read_bytes()).hexdigest(),
       'builderSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
       'geometryHelperSha256':hashlib.sha256((ROOT/'blender/stratum_geometry.py').read_bytes()).hexdigest(),
       'layoutSha256':hashlib.sha256((ASSET/'layout.json').read_bytes()).hexdigest(),
       'budgets':{'bytes':4000000,'triangles':60000,'maxTextureSize':1024},
       'review':{'nativeRenderer':'not run','physicalGame':'not integrated','independentArt':'pending'}}
    (ASSET/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    assert triangles<=60000,triangles
    assert len(output)<=4000000,len(output)
    print('STRATUM_EXPORT '+json.dumps(manifest),flush=True)
    return manifest


manifest=pack_glb(raw)
provenance={'authoring':'Original scripted hard-surface Stratum geometry; reusable primitive convention from repository fighter_geometry.py',
    'textureSource':'Deterministic authored manufactured finish; numpy seed505; no generated/downloaded/photographic inputs',
    'textureCoordinates':'Planar per-face local metre coordinates, one4m repeat. Display surfaces have unique0..1 UVs.',
    'channels':{'basecolor':'Subtle reflectance grain; no shadows/highlights','normal':'Independent bounded tangent micro-slope, not luminance-derived','orm':'R=1 (no baked AO); G=roughness variation; B=1, scaled by material metalness'},
    'materialRecipes':finish,'files':{},'blenderVersion':bpy.app.version_string}
for path in sorted(TEX.glob('stratum-*')):
    provenance['files'][path.name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
(TEX/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print('STRATUM_BUILD_DONE',flush=True)
