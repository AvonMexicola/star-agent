"""Reproducible mineral-concrete kit; original procedural authorship, no external assets.
blender --background --factory-startup --python-exit-code 1 --python blender/build_base.py
Canonical structural geometry comes from src/build/definitions.js. Game metres/Y-up.
"""
import bpy, os, json, subprocess, math, random, hashlib
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT=os.path.join(ROOT,'public/models/base');os.makedirs(OUT,exist_ok=True)
defs=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {PIECES} from './src/build/definitions.js';console.log(JSON.stringify(PIECES))"],text=True))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def mat(name,col,metal=0,rough=.7,emission=0,alpha=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,alpha);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Alpha'].default_value=alpha
 if emission:p.inputs['Emission Color'].default_value=(*col,1);p.inputs['Emission Strength'].default_value=emission
 if alpha<1:m.surface_render_method='DITHERED'
 M[name]=m
mat('MineralConcrete',(.48,.47,.43));mat('EdgeSteel',(.24,.28,.29),.65,.35);mat('DarkPolymer',(.16,.16,.16),0,.72);mat('WhiteArmour',(.8,.8,.8),.2,.45);mat('MintStatus',(.47,.86,.65),.1,.35,.7);mat('WindowGlass',(.24,.38,.35),.05,.18,alpha=.24)
# Deterministic metre-scaled form-board colour and independent fine relief textures.
N=256;random.seed(7281)
for role in ['albedo','bump']:
 im=bpy.data.images.new('Concrete_'+role,N,N);pixels=[]
 for y in range(N):
  for x in range(N):
   noise=random.random();board=(y//32)%3;grain=math.sin(x*.075+math.sin(y*.9)*3)*.018
   if role=='albedo':
    cloud=math.sin(x*.027+math.sin(y*.031))*math.sin(y*.022)*.048
    shade=.61+board*.026+grain+cloud+(noise-.5)*.095-(.09 if y%32<1 else 0)
    pixels.extend([shade*.975,shade,shade*.995,1])
   else:
    h=.5+(noise-.5)*.25-(.12 if noise<.012 else 0)-(.08 if y%32==0 else 0);pixels.extend([h,h,h,1])
 im.pixels.foreach_set(pixels);im.filepath_raw=os.path.join(OUT,'concrete-'+role+'.png');im.file_format='PNG';im.save();subprocess.run(['magick',im.filepath_raw,'-quality','88',im.filepath_raw.replace('.png','.webp')],check=True);os.remove(im.filepath_raw)
 node=M['MineralConcrete'].node_tree.nodes.new('ShaderNodeTexImage');node.image=im
 p=M['MineralConcrete'].node_tree.nodes.get('Principled BSDF')
 # Shared webp maps are attached by src/build/visuals.js; no per-piece embedded duplication.
 # Runtime attaches the independent bump map; glTF has no bump channel.
objects=[]
def box(name,lo,hi,material='MineralConcrete',bevel=.012,moving=False):
 size=[hi[i]-lo[i] for i in range(3)];p=[(hi[i]+lo[i])/2 for i in range(3)]
 bpy.ops.mesh.primitive_cube_add(size=1,location=(p[0],-p[2],p[1]));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(M[material]);o['moving']=moving
 if bevel:
  mod=o.modifiers.new('Cast edge bevel','BEVEL');mod.width=min(bevel,min(size)*.2);mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Planar local metre UV, chosen by surface normal; no stretched room-sized projection.
 uv=o.data.uv_layers.active or o.data.uv_layers.new()
 for poly in o.data.polygons:
  n=poly.normal;axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
  for li in poly.loop_indices:
   v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]/2,v[axes[1]]/2)
 # Per-corner broad casting variation and dirt at the foot; bevels catch a
 # lighter worn aggregate colour. COLOR_0 survives batching and runtime maps.
 colors=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for poly in o.data.polygons:
  for li in poly.loop_indices:
   v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
   if material=='MineralConcrete':
    seed=sum(ord(c) for c in id)*.071
    broad=math.sin(v.x*1.7+seed)*math.sin(v.y*.8+v.z*1.3)*.10
    dirt=.18*math.exp(-max(0,v.z)*4) if id not in ['floor','foundation'] else .04
    edge=.10 if poly.area<.025 else 0
    shade=max(.57,min(1.05,.91+broad-dirt+edge))
    colors.data[li].color=(shade,shade,shade,1)
   else:colors.data[li].color=(1,1,1,1)
 objects.append(o);return o
def b(name,p,size,material='MineralConcrete',bevel=.012,moving=False):return box(name,[p[i]-size[i]/2 for i in range(3)],[p[i]+size[i]/2 for i in range(3)],material,bevel,moving)
def rail(name,a,c,width=.052):
 # Bevelled rectangular rail along a line, authored in Blender local coordinates.
 aa=Vector((a[0],-a[2],a[1]));cc=Vector((c[0],-c[2],c[1]));o=b(name,[0,0,0],[width,(cc-aa).length,width],'EdgeSteel',.006);o.location=(aa+cc)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(cc-aa).to_track_quat('Z','Y');return o
manifest={'builder':'blender/build_base.py','coordinates':'metres, Y up; origin support surface, wall x width; stair rises toward -Z','source':'original deterministic scripted construction; no external imagery','pieces':{}}
for id,d in defs.items():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);objects=[]
 if id in ['mainframe','crate']:
  w,h,dep=d['footprint'][0],d['height'],d['footprint'][1]
  b('SealedBody',(0,h/2,0),(w-.035,h-.04,dep-.035),'DarkPolymer',.045)
  for sx in [-1,1]:
   b('ArmouredSide',(sx*(w/2-.055),h/2,0),(.11,h-.08,dep),'WhiteArmour',.025)
   for sz in [-1,1]:b('CornerShoe',(sx*(w/2-.09),.055,sz*(dep/2-.07)),(.18,.11,.14),'EdgeSteel',.015)
  if id=='mainframe':
   b('ConsoleBezel',(0,1.23,-dep/2+.016),(w-.25,.68,.045),'EdgeSteel')
   b('InsetDisplay',(0,1.25,-dep/2-.01),(w-.33,.54,.025),'DarkPolymer',.007)
   for i,ww in enumerate([.4,.55,.31]):b('PrintedCircuit',(ww/2-.29,1.4-i*.12,-dep/2-.027),(ww,.012,.008),'MintStatus',.002)
   for yy in [.38,.48,.58,.68]:b('VentLouvre',(0,yy,-dep/2-.006),(.62,.025,.026),'EdgeSteel',.003)
   for xx in [-.41,.41]:b('ConsoleLightDiffuser',(xx,1.28,-.375),(.018,.56,.012),'MintStatus',.003)
   b('ConsoleLightHeader',(0,1.56,-.375),(.78,.018,.012),'MintStatus',.003)
   b('ServiceCover',(0,.89,-dep/2+.002),(.71,.17,.025),'WhiteArmour')
   b('ManualSupplyLatch',(.25,.88,-dep/2-.027),(.085,.06,.04),'EdgeSteel')
  else:
   b('LidGasket',(0,.61,0),(w,.025,dep),'EdgeSteel',.005)
   b('ReinforcedLid',(0,.68,0),(w-.02,.12,dep-.02),'WhiteArmour',.028)
   for xx in [-.35,.35]:
    b('OverCentreLatch',(xx,.55,-dep/2-.01),(.12,.2,.045),'EdgeSteel')
    b('LidRail',(xx,.744,0),(.045,.012,dep-.16),'DarkPolymer',.003)
   b('CarryHandle',(0,.39,-dep/2-.02),(.32,.055,.065),'EdgeSteel')
 else:
  for i,coll in enumerate(d['colliders']):
   # Recess only the rear visible face behind the applied service kit.
   # Canonical support/collision remains in definitions.js.
   lo=list(coll['min'])
   if id=='stairs' and i==len(d['colliders'])-1:lo[2]=max(lo[2],-1.984)
   box('Structure'+str(i),lo,coll['max'],'WindowGlass' if coll.get('kind')=='glass' else 'MineralConcrete',.009 if id=='stairs' else .018)
  if id in ['wall','window','doorway']:
   # Form ties and recessed-looking seam strips define assembly and construction scale.
   for face in [-1,1]:
    for xx in [-1.65,1.65]:
     for yy in [.4,1.5,2.6]:b('FormTieCap',(xx,yy,face*.153),(.052,.052,.01),'EdgeSteel',.007)
    b('BottomSill',(0,.08,face*.156),(3.96,.055,.014),'EdgeSteel',.003)
   # White mounting shoes and a compact status dash tie cast modules to
   # the station/ship family without turning every face into white armour.
   for face in [-1,1]:
    for xx in [-1.82,1.82]:
     b('FactionMount',(xx,.34,face*.156),(.20,.42,.012),'WhiteArmour',.003)
     b('ModuleStatus',(xx,.52,face*.161),(.12,.018,.004),'MintStatus',.001)
   if id=='window':
    for xx in [-1.19,1.19]:b('GlazingMullion',(xx,1.7,0),(.055,1.42,.19),'EdgeSteel')
    for yy in [1.02,2.38]:b('GlazingSill',(0,yy,0),(2.4,.055,.19),'EdgeSteel')
   if id=='doorway':
    for xx in [-.76,.76]:b('DoorJamb',(xx,1.12,-.10),(.06,2.24,.08),'EdgeSteel')
    b('ManualTrack',(0,2.29,-.18),(3.12,.10,.09),'EdgeSteel')
    b('ThresholdLightHousing',(0,2.40,-.173),(1.30,.105,.10),'WhiteArmour',.01)
    b('ThresholdLightDiffuser',(0,2.40,-.222),(1.16,.026,.006),'MintStatus',.002)
    for xx in [-.82,.82]:b('ThresholdMarker',(xx,.16,-.153),(.026,.16,.012),'MintStatus',.002)
    for side,door in zip(['Left','Right'],d['door']):
     xx=-.37 if side=='Left' else .37
     box('DoorArmour',door['min'],door['max'],'WhiteArmour',.015,side)
     b('DoorInset',(xx,1.12,-.098),(.59,1.95,.023),'DarkPolymer',.015,side)
     b('DoorRib',(xx,1.12,-.117),(.045,1.92,.022),'EdgeSteel',.006,side)
     b('ManualPull',(xx*.4,1.05,-.15),(.045,.27,.09),'EdgeSteel',.008,side)
  elif id in ['floor','foundation']:
   for xx in [-1.93,1.93]:b('EdgeChannel',(xx,-.065,0),(.08,.10,3.98),'EdgeSteel',.006)
   for xx in [-1.72,1.72]:
    for zz in [-1.72,1.72]:
     b('CornerArmour',(xx,-.0024,zz),(.32,.008,.32),'WhiteArmour',.001)
     b('SurveyStatus',(xx,.0018,zz),(.12,.0004,.018),'MintStatus',0)
   # Expansion joints are shallow top markings inside the structural slab.
   for xx in [-1,0,1]:b('CastJoint',(xx,.0008,0),(.009,.0016,3.92),'DarkPolymer',0)
  elif id=='stairs':
   for i in range(12):
    yy=(i+1)*.25;zz=2-i/3-.025
    b('TreadNosing',(0,yy+.001,zz),(1.95,.014,.045),'EdgeSteel',.003)
   for side in [-1,1]:
    for i in [0,4,8,11]:
     yy=(i+1)*.25;zz=2-(i+.5)/3
     b('RailingPost',(side*.96,yy+.48,zz),(.052,.96,.052),'WhiteArmour',.006)
    rail('HandRail',(side*.96,1.22,1.84),(side*.96,3.98,-1.86))
    for i in [0,4,8,11]:
     yy=(i+1)*.25;zz=2-(i+.5)/3
     b('RailStatus',(side*.96,yy+.88,zz),(.054,.055,.054),'MintStatus',.003)
   # Back of a stair remains structurally solid, but service plates and
   # casting ribs explain the otherwise blank three-metre retaining face.
   for xx in [-.72,.72]:
    b('RearArmour',(xx,1.5,-1.992),(.13,2.7,.008),'WhiteArmour',.001)
   for yy in [.45,1.5,2.55]:
    b('RearServiceBand',(0,yy,-1.992),(1.28,.065,.008),'EdgeSteel',.001)
   b('RearInspectionPlate',(0,1.08,-1.992),(.50,.46,.008),'DarkPolymer',.001)
   for yy in [.99,1.08,1.17]:b('RearVent',(0,yy,-1.998),(.35,.015,.004),'EdgeSteel',.001)
   b('RearServiceStatus',(0,1.35,-1.998),(.23,.025,.004),'MintStatus',.001)
 # Batch by material and moving state, preserving the manual leaf parent.
 doorroot=None
 if id=='doorway':
  doorroot=bpy.data.objects.new('DoorPanel',None);bpy.context.collection.objects.link(doorroot)
  leafroots={}
  for side in ['Left','Right']:
   leaf=bpy.data.objects.new('DoorLeaf'+side,None);bpy.context.collection.objects.link(leaf);leaf.parent=doorroot;leafroots[side]=leaf
 for moving in [False,'Left','Right']:
  for material in M.values():
   group=[o for o in objects if o.get('moving')==moving and o.data.materials[0]==material]
   if not group:continue
   bpy.ops.object.select_all(action='DESELECT')
   for o in group:o.select_set(True)
   objects=[o for o in objects if o not in group]
   bpy.context.view_layer.objects.active=group[0]
   if len(group)>1:bpy.ops.object.join()
   o=bpy.context.object;o.name=('Leaf' if moving else id)+'_'+material.name
   bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
   if moving:o.parent=leafroots[moving]
 path=os.path.join(OUT,id+'.glb');bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',export_yup=True,export_animations=False,export_extras=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];verts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 points=[(v.x,v.z,-v.y) for v in verts]
 triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
 manifest['pieces'][id]={'triangles':triangles,'drawPrimitives':len(meshes),'bytes':os.path.getsize(path),'sha256':hashlib.sha256(open(path,'rb').read()).hexdigest(),'bounds':{'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]},'materials':sorted({m.name for o in meshes for m in o.data.materials})}
 assert triangles<=10000 and os.path.getsize(path)<=1000000,(id,triangles,os.path.getsize(path))
manifest['aggregateBytes']=sum(p['bytes'] for p in manifest['pieces'].values())
manifest['aggregateTriangles']=sum(p['triangles'] for p in manifest['pieces'].values())
with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print(json.dumps(manifest,indent=2))
