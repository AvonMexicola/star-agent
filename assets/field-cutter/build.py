"""Rebuild the two-hand K-17 cutter around the established grip and beam sockets.

python assets/field-cutter/textures.py
blender -b -t 4 --python assets/field-cutter/build.py
node assets/field-cutter/pack.mjs
"""
import bpy,math,sys,json,importlib.util
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/field-cutter'
STAGE=OUT/'.staging';STAGE.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('handheld_finish',ROOT/'assets/handheld-tools/build.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
h.SOURCE=OUT
g=h.g;g.reset_scene();g.faction_materials()
bpy.context.preferences.filepaths.save_version=0
for key,color in [('Teal',(.1,.25,.23)),('Ochre',(.56,.32,.07)),('Titanium',(.2,.25,.28)),('Label',(.1,.15,.14))]:g.material(key,color)
g.MATS['Amber'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.6
g.MATS['Mint'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.3
RX=g.rot(0,math.pi/2,0);a=.14
hardware=g.Batch('ReceiverHardware')
g.hero('GraphiteReceiver',g.span_box(-.40,.13,-.048,.048,.065,.222),'Polymer',.007,2)
for sign in [-1,1]:
    g.hero('YellowShell'+str(sign),g.span_box(-.38,.115,sign*.046,sign*.061,.079,.210),'Ochre',.005,2)
    g.hero('TopRubRail'+str(sign),g.span_box(-.35,.105,sign*.035,sign*.054,.206,.229),'Titanium',.003)
    g.hero('ArmouredSidePanel'+str(sign),g.span_box(-.27,.08,sign*.059,sign*.068,.104,.181),'Polymer',.005)
    g.grooves(hardware,-.335,-.28,sign*.063,.122,.178,3,.007,.002,'Titanium')
    g.screws(hardware,[(-.365,sign*.063,.194),(.09,sign*.063,.194),(-.25,sign*.07,.164),(.055,sign*.07,.12)],r=.003)
h.plate('K17Serial',-.084,.07,.144,.25,.055,14)
g.hero('UpperServiceRail',g.span_box(-.28,.08,-.02,.02,.225,.239),'Polymer',.003)
g.hero('BatteryCase',g.span_box(.121,.202,-.051,.051,.055,.213),'Polymer',.006,2)
g.hero('BatteryWrap',g.span_box(.153,.188,-.054,.054,.064,.205),'Ochre',.004)
for sign in [-1,1]:
    g.hero('BatteryLatch'+str(sign),g.span_box(.115,.147,sign*.052,sign*.058,.112,.154),'Titanium',.002)
grip=g.rot(0,g.D(-13),0)
g.hero('Grip',g.box_geo(.037,.034,.15,g.place((.01,0,0),grip)),'Rubber',.004,2)
g.grip_texture(hardware,.01,.017,-.06,.03,.027,cols=3,rows=6)
g.hero('GripHeel',g.box_geo(.044,.04,.011,g.place((.027,0,-.074),grip)),'Ochre',.002)
g.hero('GuardFront',g.span_box(-.095,-.082,-.01,.01,-.073,.065),'Titanium',.003)
g.hero('GuardBase',g.span_box(-.094,.025,-.011,.011,-.083,-.071),'Ochre',.003)
g.hero('Trigger',g.box_geo(.012,.018,.046,g.place((-.037,0,.028),g.rot(0,g.D(14),0))),'Ochre',.002)
g.hero('ForegripJoint',g.cyl_geo(.032,.032,.086,16,g.place((-.30,0,.07),g.rot(math.pi/2,0,0))),'Titanium',.003)
g.hero('Foregrip',g.cyl_geo(.02,.018,.12,16,g.place((-.30,0,.011))),'Rubber',.002)
g.hero('ForegripCap',g.cyl_geo(.022,.022,.011,16,g.place((-.30,0,-.052))),'Ochre',.002)
for i in range(6):hardware.add(g.annulus_geo(.019,.021,12,.002,g.place((-.30,0,-.035+i*.014))),'Polymer')
g.hero('FixedBearing',g.cyl_geo(.075,.075,.046,24,g.place((-.413,0,a),RX)),'Titanium',.002)
g.hero('BearingYellowCollar',g.annulus_geo(.073,.091,24,.013,g.place((-.413,0,a),RX)),'Ochre',.002)
g.hero('FixedOpticalShaft',g.cyl_geo(.027,.027,.16,24,g.place((-.516,0,a),RX)),'Polymer',.001)
hardware.build()
body=list(g.OBJECTS)

# Rigid front cartridge rotates around the fixed optical shaft. Its nearest
# rear face is 9 mm clear of the fixed bearing, independent of rotor angle.
g.hero('RotorBarrel',g.annulus_geo(.031,.096,24,.133,g.place((-.5185,0,a),RX)),'Titanium',.003,2)
g.hero('RotorBackBand',g.annulus_geo(.033,.103,24,.016,g.place((-.46,0,a),RX)),'Polymer',.002)
g.hero('RotorYellowBand',g.annulus_geo(.093,.101,24,.015,g.place((-.527,0,a),RX)),'Ochre',.001)
g.hero('RotorFaceRim',g.annulus_geo(.031,.10,24,.012,g.place((-.589,0,a),RX)),'Polymer',.002)
for i in range(3):
    R=g.place((-.574,0,a)) @ g.rot(i*math.tau/3,0,0)
    g.hero('OpticalPod'+str(i),g.box_geo(.04,.066,.047,R @ Matrix.Translation((0,0,.094))),'Titanium',.006,2)
    g.hero('PodRecess'+str(i),g.box_geo(.004,.045,.022,R @ Matrix.Translation((-.022,0,.097))),'Polymer',.002)
    g.hero('AmberEmitter'+str(i),g.box_geo(.003,.037,.015,R @ Matrix.Translation((-.0245,0,.097))),'Amber',.002)
    g.hero('PodVent'+str(i),g.box_geo(.058,.026,.005,R @ Matrix.Translation((.022,0,.096))),'Polymer',.001)
rotor_objects=[o for o in g.OBJECTS if o not in body]
# The beam leaves the fixed central aperture even while the outside cartridge turns.
g.hero('FixedLensRim',g.annulus_geo(.018,.027,28,.009,g.place((-.591,0,a),RX)),'Metal',.001)
g.hero('FixedLens',g.cyl_geo(.017,.017,.005,24,g.place((-.594,0,a),RX)),'Glass',.001)
g.hero('BeamEmitter',g.cyl_geo(.009,.009,.001,20,g.place((-.597,0,a),RX)),'Mint',0)

for o in g.OBJECTS:o['assembly']='rotor' if o in rotor_objects else 'body'
g.select_only(g.OBJECTS);bpy.ops.object.convert(target='MESH')
objs=list(g.OBJECTS)
for obj in objs:
    obj.data.update();mod=obj.modifiers.new('ManufacturedNormals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=45
g.select_only(objs);bpy.ops.object.convert(target='MESH')
atlas=h.atlas_material()
for obj in objs:h.uv_and_material(obj,atlas)
h.bake_contact(objs)
rotor=bpy.data.objects.new('CutterRotor',None);g.COLL.objects.link(rotor);rotor.location=(-.52,0,a)
rotor['tier']=1;rotor['axis']='X';rotor['mount']='K17-M30';rotor['fixedMuzzle']=True
bpy.context.view_layer.update()
for obj in objs:
    if obj['assembly']=='rotor':obj.parent=rotor;obj.matrix_parent_inverse=rotor.matrix_world.inverted()
for name,position in [('muzzle',(-.6,0,a)),('leftGrip',(-.3,0,.01)),('rightGrip',(0,0,0)),('HeadMount',(-.44,0,a))]:
    anchor=bpy.data.objects.new(name,None);g.COLL.objects.link(anchor);anchor.location=position;anchor.empty_display_size=.02
for im in bpy.data.images:
    if im.name.startswith('HandheldAtlas-'):im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mining-tool-mk1.blend'),compress=True)
# Batch within rigid assemblies, never through the moving head boundary.
g.select_only(objs);bpy.ops.mesh.separate(type='MATERIAL')
groups={}
for obj in [o for o in g.COLL.objects if o.type=='MESH']:
    used={p.material_index for p in obj.data.polygons};mat=obj.data.materials[next(iter(used))]
    obj.data.materials.clear();obj.data.materials.append(mat)
    groups.setdefault((obj['assembly'],mat.name),[]).append(obj)
result=[]
for (assembly,name),parts in groups.items():
    g.select_only(parts)
    if len(parts)>1:bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active;obj.name=f'{assembly}_{name}';result.append(obj)
g.select_only(result+[o for o in g.COLL.objects if o.type=='EMPTY'])
bpy.ops.export_scene.gltf(filepath=str(STAGE/'mining-laser-tool.glb'),export_format='GLB',export_yup=True,use_selection=True,
    export_apply=True,export_texcoords=True,export_normals=True,export_animations=False,export_skins=False,export_morph=False,
    export_extras=True,export_vertex_color='ACTIVE',export_cameras=False,export_lights=False,export_image_format='AUTO',export_materials='EXPORT')
lo,hi=g.bounds(result)
entry={'name':'mining-laser-tool','source':'assets/field-cutter/mining-tool-mk1.blend','builder':'assets/field-cutter/build.py',
    'reference':'assets/field-cutter/source/mining-tool-mk1.png','units':'metres','up':'+Y','barrel':'-X',
    'muzzle':[-.6,.14,0],'leftGrip':[-.3,.01,0],'headMount':[-.44,.14,0],'rotorPivot':[-.52,.14,0],
    'bounds':{'min':g.to_gltf(Vector((lo.x,hi.y,lo.z))),'max':g.to_gltf(Vector((hi.x,lo.y,hi.z)))},
    'sourceTriangles':g.tri_count(result),'sourceDraws':len(result),'tiers':'Mk1 implemented; common K17-M30 mount retained for future heads'}
(STAGE/'manifest.json').write_text(json.dumps(entry,indent=2)+'\n')
print('FIELD CUTTER',json.dumps(entry),flush=True)
