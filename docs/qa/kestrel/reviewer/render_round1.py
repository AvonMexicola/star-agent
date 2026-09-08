import bpy, sys, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'docs/qa/kestrel/reviewer/round-1'
OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'assets/kestrel/kestrel.blend'
before=hashlib.sha256(SRC.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SRC))
sys.path.insert(0,str(ROOT/'blender'))
import fighter_geometry as g
scene=bpy.context.scene
asset=[o for o in scene.objects if o.type=='MESH']
verts=[o.matrix_world @ v.co for o in asset for v in o.data.vertices]
def game(p):return (p.x,p.z,-p.y)
gv=[game(v) for v in verts]
info={'sourceSha256':before,'boundsGameMetres':{'min':[min(v[a] for v in gv) for a in range(3)],'max':[max(v[a] for v in gv) for a in range(3)]},'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in asset),'renderer':'Blender EEVEE','resolution':[1200,1200]}
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1200
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='Standard'
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.78,.78,.78,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.8

def material(name, color, emit=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Roughness'].default_value=.75
    if emit:
        n.inputs['Emission Color'].default_value=(*color,1)
        n.inputs['Emission Strength'].default_value=1
    return m
clay=material('REVIEWER clay',(.4,.4,.4))
for o in asset:o.data.materials.clear();o.data.materials.append(clay)
for name,pos,power,size in [('REVIEWER Key',(-7,11,-9),2300,8),('REVIEWER Fill',(8,7,4),1600,7)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    o.location=g.xyz(pos);o.rotation_euler=(Vector(g.xyz((0,1.6,0)))-o.location).to_track_quat('-Z','Y').to_euler()
person=material('REVIEWER 1.8 m datum',(.06,.06,.06))
for name,a,b,r in [('torso',(-5.35,.85,0),(-5.35,1.43,0),.16),('leg L',(-5.45,.07,0),(-5.45,.9,0),.07),('leg R',(-5.25,.07,0),(-5.25,.9,0),.07),('arm L',(-5.55,.82,0),(-5.55,1.36,0),.055),('arm R',(-5.15,.82,0),(-5.15,1.36,0),.055)]:g.rod('REVIEWER scale '+name,a,b,r,person)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.125,location=g.xyz((-5.35,1.675,0)))
bpy.context.object.name='REVIEWER scale head';bpy.context.object.data.materials.append(person)
data=bpy.data.cameras.new('REVIEWER Camera');co=bpy.data.objects.new('REVIEWER Camera',data);scene.collection.objects.link(co);scene.camera=co
views={'top-ortho':((0,28,0),(0,1.6,0),'ORTHO',16.4),'side-ortho':((26,1.6,0),(0,1.6,0),'ORTHO',16.4),'front-ortho':((0,1.6,-26),(0,1.6,0),'ORTHO',12.4),'front-quarter-30m':((18,8,-23),(0,1.6,0),'PERSP',50)}
for name,(pos,target,kind,scale) in views.items():
    co.location=g.xyz(pos);co.rotation_euler=(Vector(g.xyz(target))-co.location).to_track_quat('-Z','Y').to_euler();data.type=kind
    if kind=='ORTHO':data.ortho_scale=scale
    else:data.lens=scale
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
info['sourceUnchanged']=before==hashlib.sha256(SRC.read_bytes()).hexdigest()
(OUT/'capture-info.json').write_text(json.dumps(info,indent=2)+'\n')
print(json.dumps(info),flush=True)
