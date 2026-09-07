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
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'blender'))
import stratum_geometry as g
from stratum_pack import pack_geometry

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
    # Quantized, band-limited microfinish avoids texture-sized random noise.
    # It remains independent of color and has a real 4 m repeat.
    grain_soft=(grain+np.roll(grain,1,0)+np.roll(grain,-1,0)+np.roll(grain,1,1)+np.roll(grain,-1,1))/5
    rough=np.round(np.clip(.91+grain_soft*.025+weave*.028+broad*.022,.78,1)*63)/63
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
        link.new(color_map.outputs['Color'],mix.inputs[1])
        vertex=n.new('ShaderNodeVertexColor');vertex.layer_name='ContactAO'
        contact=n.new('ShaderNodeMixRGB');contact.blend_type='MULTIPLY'
        link.new(vertex.outputs['Alpha'],contact.inputs[0]);link.new(mix.outputs[0],contact.inputs[1])
        link.new(vertex.outputs['Color'],contact.inputs[2]);link.new(contact.outputs[0],p.inputs['Base Color'])
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


ivory=material('Stratum | ivory enamel',(.67,.705,.65),.68,0,.35)
structure=material('Stratum | graphite frame',(.025,.037,.039),.73,.05,.22)
petrol=material('Stratum | petrol service',(.026,.115,.116),.72,.08,.32)
metal=material('Stratum | brushed mechanisms',(.27,.32,.325),.64,.78,.60)
trim=material('Stratum | anodized trim',(.13,.17,.18),.72,.55,.42)
lining=material('Stratum | cabin composite',(.12,.16,.155),.84,.02,.35)
rubber=material('Stratum | soft interior',(.034,.045,.049),.96,0,.18)
cavity=material('Stratum | bore interior',(.005,.009,.011),.92,.08,.35)
amber=material('Stratum | amber hazard',(.94,.40,.055),.60,0,.20)
mint=material('Stratum | powered indicator',(.36,.89,.66),.40,0,0,2.0)
screen=material('Stratum | display substrate',(.004,.018,.022),.40,.08)
glass=material('Stratum | protective glazing',(.095,.20,.22),.14,.02,0,0,.26)

def hard_tube(name,x,y,rings,mat,root,segments=24,phase=0):
    """Separated machined stations with flat, deliberate axial face normals.

    Each profile transition is an authored chamfer or step. Unlike the previous
    smooth whole-profile tube, the shoulder and working throat never share a
    smoothed normal. Open at both ends unless the profile explicitly returns.
    """
    points=[(x+r*math.cos(phase+i*math.tau/segments),y+r*math.sin(phase+i*math.tau/segments),z)
            for z,r in rings for i in range(segments)]
    faces=[(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i)
           for k in range(len(rings)-1) for i in range(segments)]
    return g.mesh(name,points,faces,mat,root=root)


def fitted_panel(name,points,mat,root,margin=.05,offset=.028,thickness=.025):
    """Inset skin over a real backing panel, with a physical gasket reveal."""
    c=sum((Vector(p) for p in points),Vector())/len(points)
    n=(Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0])).normalized()
    # Hull panels face outwards/upwards. The copied pressure shell remains the
    # collision/airtight boundary; the floating skin is only a few cm outside.
    if n.dot(Vector((c.x,max(0,c.y-2.5),0)))<0:n=-n
    gasket=[tuple(c+(Vector(v)-c)*(1-margin*.78)+n*(offset-.027)) for v in points]
    g.panel(name+' fitted gasket',gasket,structure,.040,root,.006)
    p=[tuple(c+(Vector(v)-c)*(1-margin)+n*offset) for v in points]
    return g.panel(name,p,mat,thickness,root,.012)


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
        p=points if side<0 else points[::-1]
        g.panel(f'Hull lower chine {i} {side}',p,ivory if i==0 else structure,.10,static,.025)
        if i>=1:fitted_panel(f'Hull fitted lower skin {i} {side}',p,ivory,static,.040,.048,.035)
        if i>=1:
            points=[(side*wa,sa,za),(side*wb,sb,zb),(side*wb*.66,tb,zb),(side*wa*.66,ta,za)]
            p=points if side<0 else points[::-1]
            g.panel(f'Hull shoulder {i} {side}',p,structure,.09,static,.025)
            fitted_panel(f'Hull fitted shoulder skin {i} {side}',p,ivory,static,.042,.048,.035)
    if i>=1:
        p=[(-wa*.66,ta,za),(-wb*.66,tb,zb),(wb*.66,tb,zb),(wa*.66,ta,za)]
        g.panel(f'Roof center {i}',p,structure,.10,static,.018)
        fitted_panel(f'Roof fitted pressure armor {i}',p,ivory,static,.033,.060,.035)

g.box('Structural belly',[0,1.15,.32],[4.28,.25,13.56],structure,.06,static)
g.box('Walk deck',[0,1.30,.30],[4.24,.10,13.50],metal,.01,static)
g.box('Deck central runner',[0,1.345,1.10],[1.08,.009,11.80],rubber,.001,static)
g.loft('Armored nose', [(-9.00,0,.84,1.50,1.75,1.91),(-8.25,0,1.48,1.20,2.00,2.20),
                      (-6.70,0,2.22,1.04,1.75,2.12)],ivory,static)

# Raked windshield, unobstructed centre sightline and armored cheek returns.
wind=[(-1.30,2.18,-8.31),(1.30,2.18,-8.31),(1.66,3.81,-6.64),(-1.66,3.81,-6.64)]
g.panel('Forward glazing',wind[::-1],glass,.018,static,.004)
for a,b in zip(wind,wind[1:]+wind[:1]):
    g.rod('Windshield armored rim',a,b,.075,structure,static,12)
for side in [-1,1]:
    sideglass=[(side*1.39,2.19,-8.16),(side*2.26,2.24,-6.65),
               (side*2.41,3.43,-4.98),(side*1.70,3.84,-6.63)]
    g.panel(f'Side pilot glazing {side}',sideglass,glass,.018,static,.003)
    for a,b in zip(sideglass,sideglass[1:]+sideglass[:1]):g.rod('Glazing side load frame',a,b,.061,structure,static,12)
    g.panel('Pilot armored cheek',[(side*1.49,2.0,-8.25),(side*2.37,2.13,-6.70),
                                  (side*2.38,2.42,-6.10),(side*1.44,2.32,-8.19)],petrol,.05,static)

# Two extraction nacelles: a low continuous load keel, stepped forward boom
# saddle, and split upper armor around a genuinely open thermal service trough.
# The old uninterrupted pointed white shoulder has been removed completely.
for side,label in [(-1,'Port'),(1,'Starboard')]:
    g.loft('Drive structural keel '+label,
        [(-3.40,side*3.77,.65,1.94,2.45,3.00),(-1.70,side*4.13,1.14,1.92,2.62,3.28),
         (3.85,side*4.40,1.47,2.07,2.65,3.42),(6.66,side*4.40,1.08,2.04,2.78,3.40)],petrol,static)
    # Low shoe contacts the yaw bearing. Its crown stays below the moving drum;
    # the diagonal rise begins aft of the complete yaw/trunnion sweep.
    g.loft('Drive boom root shoe '+label,
        [(-4.62,side*4.35,.42,1.93,2.03,2.13),(-3.54,side*4.35,.56,1.93,2.05,2.13),
         (-2.55,side*3.87,.89,1.96,2.85,3.49),(-1.70,side*3.76,1.03,2.02,3.17,3.80)],structure,static)
    g.rod('Drive boom bearing seat '+label,[side*4.35,2.13,-4],[side*4.35,2.19,-4],.50,trim,static,24)
    g.loft('Drive forward armored saddle '+label,
        [(-3.44,side*3.98,.57,2.55,2.83,3.00),(-2.30,side*3.94,1.04,2.99,3.52,3.97),
         (-.62,side*4.06,1.30,3.12,3.80,4.23)],ivory,static)
    # Separate upper rails leave a 0.94m-wide working channel in real geometry.
    for rail_x,width in [(3.49,.41),(5.28,.45)]:
        g.loft('Drive split cowl rail '+label+str(rail_x),
            [(-.67,side*rail_x,width,3.29,3.80,4.20),(.05,side*rail_x,width,3.36,4.01,4.43),
             (3.52,side*rail_x,width,3.45,3.89,4.27),(4.27,side*rail_x,width*.86,3.34,3.58,3.77)],ivory,static)
    g.box('Drive thermal trough backing '+label,[side*4.39,3.456,1.63],[1.05,.068,4.12],cavity,.012,static)
    # Fins are exposed above the low pressure/drive body and remain visibly
    # separated. They dissipate heat from the nearby plant, not random greebles.
    for k in range(11):
        z=-.04+k*.34
        g.box('Drive heat exchanger fin '+label,[side*4.39,3.689,z],[.88,.40,.052],trim,.006,static)
    for dx in [-.56,.56]:
        g.rod('Drive thermal header '+label,[side*4.39+dx,3.52,-.31],[side*4.39+dx,3.52,3.76],.068,metal,static,12)
    # An aft pressure fairing draws the upper rails down into the nozzle collar.
    g.loft('Drive aft compression housing '+label,
        [(4.00,side*4.40,1.42,2.10,3.15,3.94),(5.44,side*4.40,1.28,2.06,3.20,3.78),
         (6.45,side*4.40,1.04,2.12,3.01,3.38)],ivory,static)
    # A smaller service cassette breaks the broad outer wall with a fitted seam.
    g.loft('Drive outboard service gasket '+label,
        [(-1.11,side*5.405,.12,2.72,3.18,3.43),(3.33,side*5.775,.10,2.76,3.20,3.44)],structure,static)
    g.loft('Drive outboard removable cassette '+label,
        [(-.94,side*5.425,.10,2.82,3.15,3.35),(3.16,side*5.792,.08,2.84,3.19,3.36)],petrol,static)
    for z in [-.67,2.89]:
        g.box('Drive service latch '+label,[side*(5.47 if z<0 else 5.76),3.12,z],[.06,.20,.13],metal,.013,static)
    # Restrained machined collar, matte protective shell, and a deep dark throat.
    hard_tube('Drive outer heat shield '+label,side*4.4,2.65,
        [(6.29,.91),(6.44,.97),(6.65,.97),(7.08,.83),(7.46,.79)],structure,static,24)
    hard_tube('Drive machined collar '+label,side*4.4,2.65,
        [(6.42,.971),(6.48,1.00),(6.61,1.00),(6.68,.956)],metal,static,32)
    hard_tube('Drive nozzle lip '+label,side*4.4,2.65,
        [(7.39,.80),(7.60,.73),(7.72,.70),(7.72,.61),(7.63,.60)],trim,static,32)
    hard_tube('Drive recessed working throat '+label,side*4.4,2.65,
        [(7.63,.60),(7.06,.50),(6.66,.435)],cavity,static,32)
    g.rod('Drive visible throat '+label,[side*4.4,2.65,6.65],[side*4.4,2.65,6.66],.43,petrol,static,28)
    # Individual external heat-shield ribs stop short of the actual open mouth.
    for angle in [math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4]:
        dx,dy=.86*math.cos(angle),.86*math.sin(angle)
        g.rod('Drive nozzle longitudinal rib '+label,[side*4.4+dx,2.65+dy,6.70],
              [side*4.4+dx*.89,2.65+dy*.89,7.30],.046,metal,static,8)
    g.empty('Nozzle_'+label,[side*4.4,2.65,7.72],root,kind='main-thruster',direction=[0,0,1],radius=.61)
    # Protected process connection follows the cabin/plant seam, with clamps.
    g.rod('Drive process feed conduit '+label,[side*2.98,3.30,-2.32],[side*3.16,3.60,3.65],.12,trim,static,14)
    for z in [-1.65,1.18,3.15]:
        g.box('Drive process conduit clamp '+label,[side*(3.0+(z+2.32)*.03),3.49,z],[.35,.18,.16],petrol,.016,static)
    g.box('Aft lifting socket '+label,[side*2.54,3.22,6.65],[.30,.30,.42],amber,.05,static)

# A low dorsal service spine makes the pressure roof read as part of the ore
# plant. It is external to the unchanged hollow pressure/standing envelope.
g.loft('Roof service spine backing', [(-1.77,0,.61,4.66,4.77,4.83),(-.96,0,.68,4.66,4.92,5.09),
        (2.29,0,.68,4.66,4.90,5.05),(4.73,0,.51,4.45,4.62,4.68)],structure,static)
def dorsal_crown(z):
    stations=[(-1.77,4.83),(-.96,5.09),(2.29,5.05),(4.73,4.68)]
    for (a,ya),(b,yb) in zip(stations,stations[1:]):
        if a<=z<=b:return ya+(yb-ya)*(z-a)/(b-a)
    raise ValueError('Dorsal lid outside supporting crown')
for za,zb in [(-1.01,.41),(.51,2.02),(2.13,3.41)]:
    topa=dorsal_crown(za)+.002;topb=dorsal_crown(zb)+.002
    g.panel('Roof removable service lid', [(-.55,topa,za),(-.55,topb,zb),(.55,topb,zb),(.55,topa,za)],petrol,.032,static,.02)
    for side in [-1,1]:
        g.box('Roof flush latch',[side*.48,(topa+topb)/2+.039,(za+zb)/2],[.072,.018,.17],metal,.005,static)
for side in [-1,1]:
    g.box('Roof maintenance tread',[side*.92,4.691,.54],[.24,.020,4.30],structure,.005,static)

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
    g.box('Berth plinth '+label,[side*1.48,1.60,-1.80],[1.22,.50,2.60],structure,.035,static)
    for z in [-2.44,-1.17]:
        g.box('Berth fitted plinth panel '+label,[side*.858,1.62,z],[.014,.29,1.17],lining,.010,static)
        g.box('Berth flush pull recess '+label,[side*.848,1.68,z],[.008,.046,.28],cavity,.007,static)
    g.box('Berth mattress welt '+label,[side*1.46,1.863,-1.80],[1.19,.055,2.46],petrol,.014,static)
    g.box('Berth mattress '+label,[side*1.46,1.94,-1.80],[1.18,.17,2.43],rubber,.065,static)
    g.box('Berth pillow '+label,[side*1.47,2.065,-2.71],[.86,.14,.40],petrol,.06,static)
    g.box('Berth task light '+label,[side*2.13,2.84,-2.63],[.035,.11,.46],mint,.014,static)
    g.box('Bin base plinth '+label,[side*1.46,1.44,3.775],[1.30,.18,1.45],structure,.025,static)
    g.box('Bin main '+label,[side*1.477,1.965,3.775],[1.266,1.05,1.45],petrol,.035,static)
    g.box('Bin lid gasket '+label,[side*1.46,2.485,3.775],[1.30,.03,1.43],structure,.006,static)
    g.box('Bin fitted sealed lid '+label,[side*1.46,2.526,3.775],[1.23,.038,1.36],ivory,.011,static)
    for z in [3.19,4.36]:
        g.box('Bin lid latch '+label,[side*.854,2.42,z],[.047,.10,.10],metal,.012,static)
    for z in [3.13,4.42]:
        g.box('Bin corner protector '+label,[side*.824,1.94,z],[.036,.91,.082],trim,.009,static)
    g.box('Bin inset access gasket '+label,[side*.828,2.03,3.775],[.022,.68,1.05],structure,.012,static)
    g.box('Bin fitted access panel '+label,[side*.810,2.03,3.775],[.015,.60,.96],lining,.011,static)
    g.box('Bin status lamp '+label,[side*.799,2.30,3.45],[.012,.025,.12],mint,.003,static)
    g.text('Bin designation '+label,'ORE / 384 KG' if side<0 else 'SUPPLIES',
           [side*.798,1.87,3.77],.085,ivory,rotation=(math.pi/2,0,-side*math.pi/2),root=static)
    g.rod('Bin grip '+label,[side*.792,2.15,3.56],[side*.792,2.15,4.00],.018,metal,static,10)
    for z in [-.04,2.44]:
        g.box('Freight end tie rail '+label,[side*1.35,1.395,z],[1.30,.07,.06],metal,.008,static)
    # Only side/end structure touches a freight bank. The 1.2x1.2x2.4m volume
    # in layout remains empty, including its upper half and door access side.
    g.box('Freight outboard rail '+label,[side*2.00,1.47,1.2],[.07,.24,2.40],amber,.012,static)
    g.box('Cabin wall lining '+label,[side*2.18,2.23,1.75],[.075,1.72,9.90],structure,.018,static)
    g.box('Cabin continuous light '+label,[side*1.72,3.75,1.08],[.055,.027,11.75],mint,.009,static)
    for z in [-3.5,-.2,2.80,5.65]:
        g.box('Cabin side rib '+label,[side*2.07,2.54,z],[.13,2.30,.10],trim,.018,static)
        g.box('Cabin rib foot bracket '+label,[side*2.05,1.53,z],[.17,.28,.21],petrol,.015,static)
    for za,zb in [(-3.38,-.31),(-.09,2.69),(2.91,5.54),(5.76,6.67)]:
        g.box('Cabin fitted wall composite '+label,[side*2.122,2.31,(za+zb)/2],[.030,1.42,zb-za],lining,.012,static)
        g.box('Cabin upper service panel '+label,[side*2.09,3.30,(za+zb)/2],[.06,.29,zb-za-.06],petrol,.010,static)

# A fitted false ceiling gives the inhabited volume its own acoustic liner.
# Its entire underside remains above the canonical 3.65m standing ceiling.
g.box('Cabin ceiling service backing',[0,3.827,1.38],[3.74,.055,10.74],structure,.012,static)
for za,zb in [(-3.93,-1.55),(-1.47,.94),(1.02,3.43),(3.51,5.66),(5.74,6.69)]:
    g.box('Cabin ceiling acoustic panel',[0,3.791,(za+zb)/2],[3.53,.026,zb-za],lining,.010,static)
for side in [-1,1]:
    for z in [-2.55,.22,2.83,5.16]:
        g.box('Cabin ceiling ventilation reveal',[side*1.32,3.773,z],[.27,.010,.50],cavity,.006,static)
        for k in range(4):
            g.box('Cabin ceiling vent vane',[side*1.32,3.765,z-.165+k*.11],[.23,.014,.025],trim,.003,static)

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
    hard_tube('Mining aft isolator '+label,x,y,
        [(z-4.16,.42),(z-4.35,.46),(z-4.44,.46)],structure,pitch,16)
    hard_tube('Mining faceted protective hood '+label,x,y,
        [(z-4.38,.49),(z-4.47,.54),(z-4.97,.54),(z-5.26,.43),(z-5.32,.42)],petrol,pitch,12,math.pi/12)
    hard_tube('Mining machined focus lip '+label,x,y,
        [(z-5.25,.432),(z-5.34,.42),(z-5.40,.38),(z-5.40,.27),(z-5.32,.27)],metal,pitch,28)
    hard_tube('Mining dark working throat '+label,x,y,
        [(z-5.32,.27),(z-4.93,.25),(z-4.71,.23),(z-4.58,.21)],cavity,pitch,28)
    g.rod('Mining recessed emitter '+label,[x,y,z-4.57],[x,y,z-4.58],.21,mint,pitch,24)
    # Two side thermal shields with visible narrow joints, contained within the
    # previous head radius and clear of the working aperture.
    for side in [-1,1]:
        g.box('Mining focus guard rail '+label,[x+side*.493,y,z-4.70],[.043,.30,.43],ivory,.012,pitch)
        g.box('Mining focus hazard '+label,[x+side*.517,y,z-4.76],[.018,.12,.21],amber,.004,pitch)
    for angle in [math.pi/2,math.pi*1.5]:
        g.rod('Mining coolant return '+label,[x+.37*math.cos(angle),y+.37*math.sin(angle),z-3.89],
              [x+.46*math.cos(angle),y+.46*math.sin(angle),z-4.47],.034,trim,pitch,8)
    g.empty(spec['muzzle'],spec['muzzlePosition'],pitch,kind='mining-muzzle',forward=[0,0,-1],toolOnly=True)

# Original fleet markings on planar, appropriate surfaces. No competitor mark.
g.text('Roof identity','STRATUM',[-1.25,4.682,.49],.36,petrol,rotation=(0,0,math.pi/2),root=static)
g.text('Roof generation','M-05  /  EXTRACTION',[1.22,4.682,.48],.15,structure,rotation=(0,0,-math.pi/2),root=static)
g.text('Rear maker','MERIDIAN',[0,3.81,7.206],.15,ivory,root=static)
g.text('Rear port ID','M-05',[-1.61,2.78,7.217],.22,petrol,root=static)

# Animation contracts are preserved as named transform nodes. Normalized poses
# are sampled by the shared pure systems adapter, so one canonical gear clock
# also works when root integrates navigation. The editable source starts parked.
for part in L['collisionParts']:
    g.empty('Collision_'+part['id'],root=root,collisionMin=part['min'],collisionMax=part['max'],kind='interior-obstacle')
for bank in L['storage']['freight']['banks']:
    g.empty(bank['id'],root=root,clearMin=bank['min'],clearMax=bank['max'],capacitySbu=16,kind='empty-freight-volume')

# Small new fittings use one real chamfer instead of two coplanar edge strips.
# The inherited clear glass, gear, ramp, MFDs and original rim stay untouched.
compact_prefixes=('Drive ','Hull fitted','Roof fitted','Roof service','Roof removable','Roof flush',
                  'Cabin fitted','Cabin upper','Cabin ceiling','Cabin rib foot','Bin ',
                  'Berth fitted','Berth flush','Berth mattress welt','Mining focus guard','Mining focus hazard')
for obj in bpy.context.scene.objects:
    if obj.name.startswith(compact_prefixes):
        for mod in obj.modifiers:
            if mod.type=='BEVEL':mod.segments=1

def bake_contact_visibility():
    """Deterministic CPU hemisphere rays against actual evaluated static meshes.

    Short (22cm) contact visibility is retained in a byte vertex color attribute,
    separate from the repeating finish maps. No lamp, camera, environment or
    directional lighting enters the bake. Dynamic mechanisms use white colors,
    so moving gear/access poses never inherit a parked static shadow.
    """
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    opaque=[];static_meshes=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj.get('displaySurface'):continue
        recipe=finish[obj.data.materials[0].name]
        if not recipe['textured']:continue
        opaque.append(obj)
        ancestor=obj.parent
        while ancestor and ancestor!=static:ancestor=ancestor.parent
        if ancestor==static:static_meshes.append(obj)
    points=[];faces=[]
    for obj in static_meshes:
        evaluated=obj.evaluated_get(depsgraph);mesh=evaluated.to_mesh()
        first=len(points);points.extend(tuple(obj.matrix_world@v.co) for v in mesh.vertices)
        faces.extend(tuple(first+i for i in p.vertices) for p in mesh.polygons)
        evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(points,faces,all_triangles=False,epsilon=0)
    directions=[]
    for i in range(12):
        r=math.sqrt((i+.5)/12);angle=i*math.pi*(3-math.sqrt(5))
        directions.append((r*math.cos(angle),r*math.sin(angle),math.sqrt(1-r*r)))
    total=0;minimum=1;darkened=0;ray_count=0
    static_set=set(static_meshes)
    for obj in opaque:
        data=obj.data
        colors=data.color_attributes.new(name='ContactAO',type='BYTE_COLOR',domain='CORNER')
        data.color_attributes.active_color=colors
        world=obj.matrix_world;normal_matrix=world.to_3x3().inverted().transposed()
        for face in data.polygons:
            normal=(normal_matrix@face.normal).normalized()
            tangent=normal.cross(Vector((0,0,1)) if abs(normal.z)<.9 else Vector((0,1,0))).normalized()
            bitangent=normal.cross(tangent)
            for li in face.loop_indices:
                value=1.0
                if obj in static_set:
                    vertex=data.vertices[data.loops[li].vertex_index].co
                    origin=world@(vertex*.985+face.center*.015)+normal*.004
                    occluded=0
                    for a,b,c in directions:
                        direction=tangent*a+bitangent*b+normal*c
                        hit=tree.ray_cast(origin,direction,.22);ray_count+=1
                        if hit[0] is not None:occluded+=max(0,1-hit[3]/.22)
                    value=1-.24*occluded/len(directions)
                colors.data[li].color=(value,value,value,1)
                total+=1;minimum=min(minimum,value);darkened+=int(value<.995)
    return {'method':'12 deterministic cosine-hemisphere CPU BVH rays per source corner; 22cm distance falloff; base-color contact visibility',
            'distanceMetres':.22,'maximumAttenuation':.24,'sourceCorners':total,'darkenedCorners':darkened,
            'rays':ray_count,'minimumLinearFactor':minimum,'dynamicMechanisms':'white; no pose-dependent bake',
            'lightingBaked':False}


contact_occlusion=bake_contact_visibility()
print('STRATUM_CONTACT_BAKE '+json.dumps(contact_occlusion),flush=True)

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
    export_image_format='AUTO',export_texcoords=True,export_normals=True,export_tangents=False,
    export_vertex_color='ACTIVE',export_all_vertex_colors=False)


def pack_glb(path):
    original=path.read_bytes();n=struct.unpack_from('<I',original,12)[0]
    before=json.loads(original[20:20+n]);nodes=before['nodes']
    parents={child:i for i,node in enumerate(nodes) for child in node.get('children',[])}
    static_index=next(i for i,node in enumerate(nodes) if node.get('name')=='Stratum_Static')
    protected=set()
    for i,node in enumerate(nodes):
        if 'mesh' not in node:continue
        ancestor=i
        while ancestor in parents and ancestor!=static_index:ancestor=parents[ancestor]
        translucent=any(before['materials'][p['material']].get('alphaMode')=='BLEND' for p in before['meshes'][node['mesh']]['primitives'])
        if ancestor!=static_index or translucent or node.get('name') in {d['node'] for d in L['displays']}:protected.add(node['mesh'])
    # Retain an unencoded export for exact post-pack geometry/UV/rig receipts.
    (ASSET/'.staging').mkdir(exist_ok=True)
    (ASSET/'.staging/stratum-unpacked.glb').write_bytes(original)
    packing=pack_geometry(path,maximum_error=.001,protected_meshes=protected)
    packing['unpackedSha256']=hashlib.sha256(original).hexdigest()
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
    manifest={'id':'stratum','version':1,'stage':'art revision 02; prior native candidate failed; revised native gate pending',
       'sha256':hashlib.sha256(output).hexdigest(),'bytes':len(output),'triangles':triangles,
       'meshCount':len(doc['meshes']),'primitiveCount':sum(len(m['primitives']) for m in doc['meshes']),
       'nodeCount':len(doc['nodes']),'source':'assets/stratum/stratum.blend','builder':'blender/build_stratum.py',
       'layout':'assets/stratum/layout.json','textureResolution':[1024,1024],
       'sourceSha256':hashlib.sha256((ASSET/'stratum.blend').read_bytes()).hexdigest(),
       'builderSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
       'geometryHelperSha256':hashlib.sha256((ROOT/'blender/stratum_geometry.py').read_bytes()).hexdigest(),
       'layoutSha256':hashlib.sha256((ASSET/'layout.json').read_bytes()).hexdigest(),
       'contactOcclusion':contact_occlusion,'packing':packing,'packingHelperSha256':hashlib.sha256((ROOT/'blender/stratum_pack.py').read_bytes()).hexdigest(),
       'budgets':{'bytes':4000000,'triangles':60000,'maxTextureSize':1024},
       'review':{'nativeRenderer':'revision 02 not run; prior candidate failed and retained',
                 'physicalGame':'root-owned integration; this asset revision not yet rendered in game',
                 'independentArt':'revision 02 pending; prior static mean 3.26, silhouette 3.4'}}
    (ASSET/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    assert triangles<=60000,triangles
    assert len(output)<=4000000,len(output)
    print('STRATUM_EXPORT '+json.dumps(manifest),flush=True)
    return manifest


manifest=pack_glb(raw)
provenance={'authoring':'Original scripted hard-surface Stratum geometry; reusable primitive convention from repository fighter_geometry.py',
    'textureSource':'Deterministic authored manufactured finish; numpy seed505; quantized band-limited roughness; no generated/downloaded/photographic inputs',
    'textureCoordinates':'Planar per-face local metre coordinates, one4m repeat. Display surfaces have unique0..1 UVs.',
    'channels':{'basecolor':'Subtle reflectance grain; no shadows/highlights','normal':'Independent bounded tangent micro-slope, not luminance-derived','orm':'R=1 (no baked AO); G=roughness variation; B=1, scaled by material metalness'},
    'contactVisibility':contact_occlusion,
    'packingSource':'Stratum-scoped adapter of existing blender/pack_rigid_geometry.py; same position/normal codec, protected moving/glass/MFD meshes and unused-UV pruning',
    'previousNativeReview':{'assetSha256':'78e9ffe41bb225a342e5765a504c15ff3ec00a94a9f2ddd0040f5500e137d827','staticMean':3.26,'silhouette':3.4,'status':'failed; retained, not superseded by CPU checks'},
    'materialRecipes':finish,'files':{},'blenderVersion':bpy.app.version_string}
for path in sorted(TEX.glob('stratum-*')):
    provenance['files'][path.name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
(TEX/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print('STRATUM_BUILD_DONE',flush=True)
