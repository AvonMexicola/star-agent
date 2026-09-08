"""Blender 5.2: reproducible handheld geometry, UVs, contact AO and editable source.

Run textures.py first, then blender -b -t 4 --python assets/handheld-tools/build.py
and node assets/handheld-tools/pack.mjs. This does not rebuild unrelated gear.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'blender'))
import build_gear as g

OUT=ROOT/'public/models/props'
SOURCE=ROOT/'assets/handheld-tools'
RX=g.rot(0,math.pi/2,0)
KINDS={'White':0,'Metal':1,'Polymer':2,'Rubber':3,'Teal':4,'Ochre':5,'Titanium':6}

def plate(name,x,y,z,width,height,tile):
    # Side plate has physical thickness; its print is 0.6 mm above the backing.
    for sign in [-1,1]:
        g.hero(name+'Backing'+str(sign),g.box_geo(width+.007,.003,height+.007,g.place((x,sign*abs(y),z))),'Titanium',.001)
        yy=sign*abs(y)+sign*.0021
        verts=[(x-width/2,yy,z-height/2),(x+width/2,yy,z-height/2),
               (x+width/2,yy,z+height/2),(x-width/2,yy,z+height/2)]
        obj=g.hero(name+str(sign),(verts,[(0,1,2,3)] if sign<0 else [(3,2,1,0)],[False]),'Label',0)
        obj['labelTile']=tile

def tractor():
    a=.14
    b=g.Batch('TractorHardware')
    g.hero('Chassis',g.span_box(-.34,.14,-.047,.047,.07,.185),'Polymer',.006)
    for s in [-1,1]:
        g.hero('FieldShell'+str(s),g.span_box(-.32,.12,s*.045,s*.058,.082,.174),'Teal',.004)
        g.hero('CeramicEdge'+str(s),g.span_box(-.32,.12,s*.047,s*.059,.175,.198),'White',.003)
        g.grooves(b,-.29,-.19,s*.059,.108,.155,4,.008,.002,'Titanium')
        g.screws(b,[(-.31,s*.06,.094),(.105,s*.06,.094),(-.31,s*.06,.185),(.105,s*.06,.185)],r=.003)
    rg=g.rot(0,g.D(-15),0)
    g.hero('Grip',g.box_geo(.036,.032,.15,g.place((.012,0,0),rg)),'Rubber',.004)
    g.grip_texture(b,.012,.016,-.06,.035,.026)
    g.hero('GripCap',g.box_geo(.04,.036,.008,g.place((.031,0,-.072),rg)),'Metal',.0015)
    g.hero('GuardFront',g.span_box(-.08,-.07,-.006,.006,-.02,.07),'Polymer',.0015)
    g.hero('GuardBottom',g.span_box(-.08,-.012,-.006,.006,-.028,-.02),'Polymer',.0015)
    g.hero('Trigger',g.box_geo(.007,.012,.04,g.place((-.04,0,.03),g.rot(0,g.D(12),0))),'Metal',.001)
    g.hero('Foregrip',g.cyl_geo(.018,.015,.10,16,g.place((-.30,0,.02))),'Rubber',.002)
    g.hero('ForegripCap',g.cyl_geo(.019,.019,.008,16,g.place((-.30,0,-.034))),'Metal',.001)
    g.hero('PowerCell',g.span_box(.14,.2,-.043,.043,.085,.19),'White',.004)
    for s in [-1,1]:
        g.hero('CellLatch'+str(s),g.span_box(.157,.185,s*.043,s*.048,.11,.16),'Titanium',.002)
    # Low rectangular capacitor instead of the cutter's cylindrical coolant tank.
    g.hero('Capacitor',g.span_box(-.24,.1,-.038,.038,.2,.249),'Polymer',.004)
    g.hero('CapacitorLid',g.span_box(-.225,.085,-.039,.039,.245,.263),'White',.003)
    for i in range(5):
        g.hero('CoolingBridge'+str(i),g.span_box(-.2+i*.047,-.188+i*.047,-.04,.04,.262,.27),'Titanium',.001,1)
    # The emitter is a visibly open three-pole induction cage, not a cutter lens.
    g.hero('InductionNeck',g.cyl_geo(.044,.056,.092,24,g.place((-.382,0,a),RX)),'Titanium',.003)
    g.hero('RearYoke',g.annulus_geo(.047,.091,24,.03,g.place((-.43,0,a),RX)),'Teal',.003,1)
    g.hero('FrontBumper',g.annulus_geo(.064,.087,24,.014,g.place((-.592,0,a),RX)),'Rubber',.002,1)
    for i in range(3):
        rot=g.place((-.51,0,a)) @ g.rot(i*2*math.pi/3,0,0)
        g.hero('Pole'+str(i),g.box_geo(.151,.036,.032,rot @ g.Matrix.Translation((0,0,.071))),'White',.004)
        g.hero('Inductor'+str(i),g.box_geo(.105,.019,.014,rot @ g.Matrix.Translation((0,0,.051))),'Titanium',.002)
        b.add(g.box_geo(.103,.009,.003,rot @ g.Matrix.Translation((0,0,.0425))),'Mint')
        for j in range(5):
            b.add(g.box_geo(.005,.038,.033,rot @ g.Matrix.Translation((-.04+j*.02,0,.071))),'Titanium')
    b.add(g.cyl_geo(.024,.021,.014,20,g.place((-.595,0,a),RX)),'Mint')
    b.add(g.cyl_geo(.012,.012,.015,16,g.place((-.592,0,a),RX)),'Glass')
    b.add(g.tube_geo([(-.25,-.037,.224),(-.33,-.067,.225),(-.396,-.074,.191),(-.426,-.064,.18)],.006,8),'Rubber')
    b.build()
    return {'muzzle':(-.6,0,a),'leftGrip':(-.3,0,.01)}

def atlas_material():
    mat=g.material('HandheldFinish', (1,1,1),1,1)
    mat['handheldFinish']=1
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bsdf=nodes['Principled BSDF']
    for name in ['basecolor','orm','normal']:
        im=bpy.data.images.load(str(SOURCE/'textures'/f'{name}.png'),check_existing=True)
        im.name='HandheldAtlas-'+name
        im.colorspace_settings.name='sRGB' if name=='basecolor' else 'Non-Color'
        tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Linear'
        if name=='basecolor':links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
        elif name=='normal':
            n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.65
            links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],bsdf.inputs['Normal'])
        else:
            channels=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],channels.inputs['Color'])
            links.new(channels.outputs['Green'],bsdf.inputs['Roughness']);links.new(channels.outputs['Blue'],bsdf.inputs['Metallic'])
    return mat

def uv_and_material(obj,atlas):
    mesh=obj.data;uv=mesh.uv_layers.new(name='FinishUV')
    label=obj.get('labelTile')
    for p in mesh.polygons:
        name=mesh.materials[p.material_index].name
        if label is not None:
            # Upright and readable from either side, with the entire plate atlas.
            xs=[mesh.vertices[mesh.loops[l].vertex_index].co.x for l in p.loop_indices]
            zs=[mesh.vertices[mesh.loops[l].vertex_index].co.z for l in p.loop_indices]
            for l in p.loop_indices:
                v=mesh.vertices[mesh.loops[l].vertex_index].co
                u=(v.x-min(xs))/(max(xs)-min(xs));w=(v.z-min(zs))/(max(zs)-min(zs))
                if p.normal.y>0:u=1-u
                h=244*(max(zs)-min(zs))/(max(xs)-min(xs))
                uv.data[l].uv=((label%4*256+6+244*u)/1024,1-(768+128-h/2+h*(1-w))/1024)
        else:
            tile=KINDS.get(name,2)
            axis=max(range(3),key=lambda i:abs(p.normal[i]))
            axes=([1,2],[0,2],[0,1])[axis]
            coords=[mesh.vertices[mesh.loops[l].vertex_index].co for l in p.loop_indices]
            center=sum(coords,Vector())/len(coords)
            # 0.8 m across one swatch: coherent fine grain on both large shells
            # and small grip parts. Per-face recentering keeps all UVs in gutters.
            offset=[math.floor(center[k]/.8)*.8 for k in axes]
            for l in p.loop_indices:
                v=mesh.vertices[mesh.loops[l].vertex_index].co
                xy=[max(.025,min(.975,.5+(v[k]-center[k])/.8)) for k in axes]
                uv.data[l].uv=((tile%4+xy[0])/4,1-(tile//4+xy[1])/4)
    for i,mat in enumerate(mesh.materials):
        if mat.name in KINDS or mat.name=='Label':mesh.materials[i]=atlas

def bake_contact(objs):
    vertices=[];faces=[]
    for obj in objs:
        off=len(vertices);vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(off+i for i in p.vertices) for p in obj.data.polygons)
    tree=BVHTree.FromPolygons(vertices,faces,all_triangles=False)
    # Short-radius geometric AO only. It cannot darken an entire side like a
    # painted studio shadow. Named emitters keep unoccluded emission.
    for obj in objs:
        mesh=obj.data
        col=mesh.color_attributes.new(name='ContactAO',type='BYTE_COLOR',domain='CORNER')
        for p in mesh.polygons:
            n=p.normal.normalized();t=n.cross(Vector((0,0,1)))
            if t.length<.01:t=n.cross(Vector((0,1,0)))
            t.normalize();b=n.cross(t)
            c=obj.matrix_world @ p.center
            shade=[]
            for l in p.loop_indices:
                v=obj.matrix_world @ mesh.vertices[mesh.loops[l].vertex_index].co
                o=v.lerp(c,.025)+n*.0005
                hits=0
                for a in range(5):
                    direction=(n*.75+t*math.cos(a*math.tau/5)*.66+b*math.sin(a*math.tau/5)*.66).normalized()
                    hit=tree.ray_cast(o,direction,.019)
                    if hit[0] is not None:hits+=1
                ao=1-hits*.047
                col.data[l].color=(ao,ao,ao,1)

def main():
    report=json.loads((SOURCE/'manifest.json').read_text())
    for item,builder in [('rifle-laser',g.build_rifle),('sidearm-pistol',g.build_pistol),('mining-laser-tool',g.build_mining),('tractor-beam-tool',tractor)]:
        if report.get(item,{}).get('builder','assets/handheld-tools/build.py')!='assets/handheld-tools/build.py':
            print('Separate articulated source:',item,report[item]['builder'],flush=True)
            continue
        g.reset_scene();g.faction_materials()
        bpy.context.preferences.filepaths.save_version=0
        for key,color in [('Teal',(.1,.25,.23)),('Ochre',(.56,.32,.07)),('Titanium',(.2,.25,.28)),('Label',(.1,.15,.14))]:g.material(key,color)
        points=builder()
        for name in ['Grip','Foregrip']:
            if name in bpy.data.objects:bpy.data.objects[name].data.materials[0]=g.MATS['Rubber']
        # Reduce decorative overexposure, keeping the actual lens readable.
        for key in ['Mint','Amber']:
            g.MATS[key].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.65 if key=='Mint' else .4
        if item=='mining-laser-tool':
            bpy.data.objects['Tank'].data.materials[0]=g.MATS['White']
            bpy.data.objects['Head'].data.materials[0]=g.MATS['Titanium']
            g.hero('HeatShield',g.annulus_geo(.067,.076,24,.017,g.place((-.405,0,.14),RX)),'Ochre',.0015,1)
            plate('CutterSerial',-.065,.061,.145,.14,.048,14)
        elif item=='rifle-laser':
            # Do not regress the fitted shoulder stock: identical piecewise fit
            # to fit-rifle-stock.mjs, now retained in the Blender source itself.
            plate('ReceiverSerial',-.016,.035,.118,.112,.029,12)
        elif item=='sidearm-pistol':
            plate('SlideSerial',-.050,.018,.049,.112,.019,13)
            for s in [-1,1]:
                g.hero('SlideCheek'+str(s),g.span_box(-.12,.045,s*.017,s*.021,.068,.077),'White',.001,1)
        else:plate('TractorSerial',-.052,.06,.132,.16,.06,15)
        # Apply booleans/bevels but preserve semantic assemblies in the .blend.
        g.select_only(g.OBJECTS);bpy.ops.object.convert(target='MESH')
        for c in g.CUTTERS:bpy.data.objects.remove(c,do_unlink=True)
        g.CUTTERS.clear()
        objs=list(g.OBJECTS)
        for obj in objs:
            if item=='rifle-laser':
                for v in obj.data.vertices:
                    if v.co.x>.035:v.co.x=.035+(v.co.x-.035)*.36
            # Recalculate outward polygon normals and normalize bevel shading.
            obj.data.update()
            mod=obj.modifiers.new('ManufacturedNormals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=45
        g.select_only(objs);bpy.ops.object.convert(target='MESH')
        atlas=atlas_material()
        for obj in objs:uv_and_material(obj,atlas)
        bake_contact(objs)
        for key in ['muzzle','leftGrip']:
            if points.get(key):
                anchor=bpy.data.objects.new(key,None);g.COLL.objects.link(anchor);anchor.location=points[key]
                anchor.empty_display_size=.025
        for im in bpy.data.images:
            if im.name.startswith('HandheldAtlas-'):im.pack()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{item}.blend'),compress=True)
        # Export batches, not hundreds of individual screw objects.
        g.OBJECTS[:]=objs;objs=g.finalize(item)
        lo,hi=g.bounds(objs)
        g.select_only(objs+[o for o in g.COLL.objects if o.type=='EMPTY'])
        bpy.ops.export_scene.gltf(filepath=str(OUT/f'{item}.glb'),export_format='GLB',export_yup=True,
          use_selection=True,export_apply=True,export_texcoords=True,export_normals=True,
          export_animations=False,export_skins=False,export_morph=False,export_extras=True,
          export_vertex_color='ACTIVE',
          export_cameras=False,export_lights=False,export_image_format='AUTO',export_materials='EXPORT')
        report[item]={'triangles':g.tri_count(objs),'drawPrimitives':len(objs),
          'bounds':{'min':g.to_gltf(Vector((lo.x,hi.y,lo.z))),'max':g.to_gltf(Vector((hi.x,lo.y,hi.z)))},
          'muzzle':g.to_gltf(points['muzzle']),'leftGrip':g.to_gltf(points['leftGrip']) if points.get('leftGrip') else None,
          'source':f'assets/handheld-tools/{item}.blend','builder':'assets/handheld-tools/build.py'}
        print('HANDHELD',item,json.dumps(report[item]),flush=True)
    (SOURCE/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':main()
