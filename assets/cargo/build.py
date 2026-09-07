"""Original Meridian SBU freight kit. Metres, Y-up export. Rebuild with Blender."""
import bpy, math, os
from pathlib import Path
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=Path(__file__).resolve().parents[2];out=root/'public/models/cargo';out.mkdir(parents=True,exist_ok=True)
def mat(name,color,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
shell=mat('Freight ceramic armor',(.57,.64,.60),.3,.6);dark=mat('Recessed polymer',(.035,.052,.046),.15,.76);rail=mat('Brushed corner rails',(.25,.32,.29),.7,.32);mint=mat('Mint identification',(.48,.83,.65),.2,.42);amber=mat('Handling warnings',(.85,.43,.10),.1,.6)
def box(name,p,size,m,parent=None,bevel=.012):
 # Input game xyz; Blender xyz=(x,-z,y) exports back to game Y-up.
 bpy.ops.mesh.primitive_cube_add(size=1,location=(p[0],-p[2],p[1]));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Machined edge','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.parent=parent;return o
def empty(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def export(name,objects):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(out/name),export_format='GLB',use_selection=True,export_yup=True)
for n,cell in [(1,(1,1,1)),(2,(1,1,2)),(4,(1,2,2)),(8,(2,2,2)),(16,(2,2,4)),(32,(2,4,4)),(64,(2,4,8))]:
 w,h,d=[v*.6-.06 for v in cell];r=empty('SBU_'+str(n))
 box('Armored body',(0,h/2,0),(w-.045,h-.045,d-.045),dark,r)
 for side in [-1,1]:
  box('Side panel',(side*(w/2-.015),h/2,0),(.035,h-.15,d-.15),shell,r)
  for z in [-d/2+.025,d/2-.025]:box('Corner extrusion',(side*(w/2-.025),h/2,z),(.05,h,.05),rail,r)
  for y in [.03,h-.03]:box('Stacking rail',(side*(w/2-.03),y,0),(.06,.06,d),rail,r)
  for z in [-d/2+.09,d/2-.09]:box('Latch plate',(side*(w/2+.003),h*.58,z),(.018,.10,.06),amber,r,.004)
 for z in [-d/2+.016,d/2-.016]:
  box('End panel',(0,h/2,z),(w-.13,h-.12,.034),shell,r)
  box('Recessed lifting grip',(0,h*.67,z+math.copysign(.019,z)),(w*.45,.09,.018),dark,r,.007)
  box('Manifest plate',(0,h*.35,z+math.copysign(.025,z)),(w*.48,.13,.02),dark,r,.004)
  # Binary size markings are embossed; runtime adds a readable manifest label.
  for i in range(int(math.log2(n))+1):box('Capacity index',(w*.2-i*.034,h*.35,z+math.copysign(.039,z)),(.019,.07,.006),mint,r,.001)
 box('Top inset',(0,h-.023,0),(w-.14,.026,d-.14),shell,r)
 export(str(n)+'-sbu.glb',[r,*r.children]);export(str(n)+'-sbu-lod.glb',[r,*[o for o in r.children if o.name.startswith(('Armored body','Side panel','End panel','Top inset'))]]);bpy.data.objects.remove(r,do_unlink=True)
 # Hide earlier props from the final source viewport; exports use explicit selection.
r=empty('TradeTerminal')
box('Anchor foot',(0,.06,0),(1,.12,.75),rail,r)
box('Service pedestal',(0,.58,.07),(.48,1,.44),dark,r)
box('Armored console',(0,1.28,0),(1.08,.62,.38),shell,r)
box('Screen recess',(0,1.31,-.207),(.90,.43,.045),dark,r)
box('Screen glass',(0,1.32,-.235),(.81,.32,.015),mint,r)
for x in [-.48,.48]:box('Status rail',(x,1.31,-.22),(.023,.40,.022),amber,r)
box('Control shelf',(0,1.04,-.32),(.88,.07,.42),rail,r)
export('trade-terminal.glb',[r,*r.children])
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/cargo/freight-kit.blend'))
