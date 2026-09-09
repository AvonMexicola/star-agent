"""Reusable salvage cover/cache with matching unit bounds, bevels and hardware."""
import bpy,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/models/pirates';OUT.mkdir(parents=True,exist_ok=True)
def material(name,color,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;return m
def box(name,loc,size,mat,bevel=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
for id in ['barricade','salvage-cache']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 red=material('Worn oxide armour',(.19,.057,.038),.5,.6);dark=material('Graphite frame',(.055,.07,.075),.65,.43);steel=material('Exposed steel',(.23,.27,.27),.8,.36);amber=material('Amber warning paint',(.83,.37,.055),.15,.55)
 if id=='barricade':
  box('Cover solid',(0,0,.48),(.92,.88,.9),red)
  for x in [-.46,.46]:box('Edge rail',(x,0,.5),(.08,1,1),dark,.012)
  for z in [.1,.88]:box('Reinforced cross rail',(0,-.47,z),(.87,.07,.08),steel,.009)
  for x in [-.3,0,.3]:box('Front armour rib',(x,-.46,.5),(.025,.06,.63),dark,.006)
  for x in [-.34,.34]:
   box('Skid foot',(x,0,.05),(.16,1,.1),dark,.018)
   for z in [.17,.78]:box('Fastener',(x,-.492,z),(.033,.015,.028),steel,.004)
  for x in [-.3,-.15,0,.15,.3]:box('Hazard marker',(x,-.498,.875),(.075,.008,.028),amber,.001)
 else:
  box('Salvage bin',(0,0,.39),(1.25,.85,.7),dark,.05);box('Raised lid',(0,0,.78),(1.3,.91,.14),red,.035)
  for x in [-.57,.57]:
   box('Lid clamp',(x,-.46,.72),(.12,.10,.23),steel,.018)
   box('Stacking foot',(x,0,.075),(.17,.86,.15),steel,.024)
  for x in [-.35,-.12,.12,.35]:box('Cargo chevron',(x,-.435,.4),(.1,.015,.16),amber,.004)
  for x in [-.35,.35]:box('Armoured side strip',(x,-.446,.37),(.035,.028,.43),red,.006)
  light=material('Cache locator',(.25,.8,.63),.15,.35);n=light.node_tree.nodes.get('Principled BSDF');n.inputs['Emission Color'].default_value=(.18,.7,.43,1);n.inputs['Emission Strength'].default_value=1.5
  box('Locator strip',(0,-.47,.77),(.42,.022,.032),light,.008)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{id}.glb'),export_format='GLB',export_animations=False)
 print('CAMP',id,sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'),flush=True)
sys.stdout.flush();os._exit(0)
