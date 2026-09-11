"""Original Meridian field builder. Blender CPU geometry; existing handheld PBR.

blender -b -t 4 --python assets/builder-tool/build.py
node assets/builder-tool/pack.mjs
"""
import bpy, math, sys, json, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/builder-tool'
STAGE = OUT / '.staging'
STAGE.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('handheld_finish', ROOT / 'assets/handheld-tools/build.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
g = h.g
g.reset_scene()
bpy.context.preferences.filepaths.save_version = 0
g.faction_materials()
for key, color in [('Teal', (.1,.25,.23)), ('Ochre', (.56,.32,.07)), ('Titanium', (.2,.25,.28))]:
    g.material(key, color)
g.MATS['Mint'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .55
g.MATS['Amber'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .3
b = g.Batch('CaptiveHardware')

# The origin remains the established palm centre. A short work head, not a rifle.
g.hero('SealedReceiver', g.span_box(-.128,.068,-.04,.04,.036,.107), 'Polymer', .006, 3)
for sign in [-1,1]:
    g.hero('CeramicCheek'+str(sign), g.span_box(-.115,.051,sign*.04,sign*.047,.046,.098), 'White', .004, 3)
    g.hero('ServiceInset'+str(sign), g.span_box(-.097,.01,sign*.047,sign*.049,.056,.081), 'Teal', .002)
    g.hero('CartridgeLock'+str(sign), g.span_box(.025,.054,sign*.047,sign*.052,.061,.081), 'Ochre', .002)
    g.screws(b, [(-.105,sign*.049,.088),(.043,sign*.049,.088),(-.105,sign*.049,.053)], r=.0024, mat='Titanium')
    for i in range(4):
        b.add(g.span_box(-.087+i*.017,-.081+i*.017,sign*.049,sign*.050,.059,.076), 'Titanium')

grip = g.rot(0,g.D(-12),0)
g.hero('PalmGrip', g.box_geo(.035,.032,.133,g.place((.008,0,-.005),grip)), 'Rubber', .004, 3)
g.grip_texture(b,.01,.016,-.055,.027,.026,cols=3,rows=6)
g.hero('BatteryFoot', g.box_geo(.05,.042,.016,g.place((.022,0,-.073),grip)), 'Titanium', .003)
g.hero('BatteryRelease',g.span_box(.04,.046,-.012,.012,-.076,-.064),'Ochre',.001)
g.hero('FingerGuardFront',g.span_box(-.058,-.049,-.007,.007,-.029,.038),'Polymer',.002)
g.hero('FingerGuardBase',g.span_box(-.055,-.007,-.007,.007,-.034,-.026),'Polymer',.002)
g.hero('ConfirmPaddle',g.box_geo(.009,.02,.038,g.place((-.03,0,.015),g.rot(0,g.D(12),0))),'Metal',.002)

# The recessed square lens is surrounded by an open metal bezel and two bumpers.
g.hero('ProjectorNeck',g.span_box(-.158,-.12,-.038,.038,.045,.103),'Titanium',.003)
for sign in [-1,1]:
    g.hero('HeadBumper'+str(sign),g.span_box(-.207,-.138,sign*.033,sign*.047,.051,.101),'White',.004,3)
    g.hero('GuardInset'+str(sign),g.span_box(-.187,-.153,sign*.047,sign*.049,.064,.086),'Ochre',.001)
g.hero('OpticalRecess',g.span_box(-.184,-.151,-.031,.031,.049,.103),'Polymer',.002)
g.hero('LensMountTop',g.span_box(-.194,-.18,-.033,.033,.095,.103),'Titanium',.001)
g.hero('LensMountBottom',g.span_box(-.194,-.18,-.033,.033,.049,.057),'Titanium',.001)
for sign in [-1,1]:
    g.hero('LensMountSide'+str(sign),g.span_box(-.194,-.18,sign*.026,sign*.033,.055,.097),'Titanium',.001)
g.hero('ProjectorGlass',g.span_box(-.188,-.183,-.025,.025,.058,.094),'Glass',.001)
b.add(g.span_box(-.189,-.188,-.019,.019,.074,.078),'Mint')
b.add(g.span_box(-.1895,-.189,-.002,.002,.062,.090),'Mint')
for i in range(3):
    g.hero('HeatBridge'+str(i),g.span_box(-.13+i*.016,-.124+i*.016,-.032,.032,.108,.119),'Titanium',.001)

# Rear-facing screen tilted toward the user's eye, with no divider in its face.
u = math.sqrt(.5)
screen_basis = Matrix(((0,-u,u,0),(1,0,0,0),(0,u,u,0),(0,0,0,1)))
screen_centre = Vector((.037,0,.118))
screen_transform = Matrix.Translation(screen_centre) @ screen_basis
g.hero('ScreenBack',g.box_geo(.086,.055,.011,screen_transform),'Polymer',.003,3)
for sign in [-1,1]:
    g.hero('ScreenRail'+str(sign),g.box_geo(.004,.052,.005,screen_transform @ Matrix.Translation((sign*.041,0,.0055))),'Titanium',.001)
    g.hero('ScreenLip'+str(sign),g.box_geo(.079,.004,.005,screen_transform @ Matrix.Translation((0,sign*.025,.0055))),'White',.001)
g.hero('StatusRecess',g.box_geo(.076,.043,.001,screen_transform @ Matrix.Translation((0,0,.0058))),'Glass',0)
b.build()

g.select_only(g.OBJECTS)
bpy.ops.object.convert(target='MESH')
objs=list(g.OBJECTS)
for obj in objs:
    obj.data.update()
    mod=obj.modifiers.new('ManufacturedNormals','WEIGHTED_NORMAL')
    mod.keep_sharp=True
    mod.weight=45
g.select_only(objs)
bpy.ops.object.convert(target='MESH')
atlas=h.atlas_material()
for obj in objs:h.uv_and_material(obj,atlas)
h.bake_contact(objs)
for name, transform in [
    ('muzzle',Matrix.Translation((-.191,0,.076))),
    # glTF rebases empty local axes too. Our runtime PlaneGeometry uses +Z,
    # which corresponds to Blender -Y; compensate without rotating its centre.
    ('screen',screen_transform @ Matrix.Translation((0,0,.0065)) @ g.rot(-math.pi/2,0,0)),
    ('rightGrip',Matrix.Identity(4)),
]:
    anchor=bpy.data.objects.new(name,None)
    g.COLL.objects.link(anchor)
    anchor.matrix_world=transform
    anchor.empty_display_size=.012
for im in bpy.data.images:
    if im.name.startswith('HandheldAtlas-'):im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'builder-tool.blend'),compress=True)
g.OBJECTS[:]=objs
objs=g.finalize('builder-tool')
lo,hi=g.bounds(objs)
g.select_only(objs+[o for o in g.COLL.objects if o.type=='EMPTY'])
bpy.ops.export_scene.gltf(filepath=str(STAGE/'builder-tool.glb'),export_format='GLB',export_yup=True,
    use_selection=True,export_apply=True,export_texcoords=True,export_normals=True,
    export_animations=False,export_skins=False,export_morph=False,export_extras=True,
    export_vertex_color='ACTIVE',export_cameras=False,export_lights=False,
    export_image_format='AUTO',export_materials='EXPORT')
entry={'name':'builder-tool','builder':'assets/builder-tool/build.py','source':'assets/builder-tool/builder-tool.blend',
    'provenance':'Original Blender geometry; existing original handheld PBR atlases. No generated or borrowed image.',
    'units':'metres','up':'+Y','barrel':'-X','origin':'Right palm; sidearm calibration',
    'bounds':{'min':g.to_gltf(Vector((lo.x,hi.y,lo.z))),'max':g.to_gltf(Vector((hi.x,lo.y,hi.z)))},
    'muzzle':[-.191,.076,0],'screenMetres':[.076,.043],'sourceTriangles':g.tri_count(objs)}
(STAGE/'manifest.json').write_text(json.dumps(entry,indent=2)+'\n')
print('BUILDER',json.dumps(entry),flush=True)
