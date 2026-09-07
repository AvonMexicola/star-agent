"""Watchkeep merchant: shared skin/geometry, four preserved Meshy idle clips.

ALSOFT_DRIVERS=null blender -b --python-exit-code 1 \
  --python blender/finish_watchkeep_shopkeeper.py -- [--skip-renders]

Standalone Blender authoring/validation; no hosted services or runtime edits.
"""
import argparse,copy,hashlib,json,math,struct,subprocess,sys,zipfile,bisect
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Vector,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'assets/characters/watchkeep-shopkeeper'
OUT=ROOT/'public/models/characters/watchkeep-shopkeeper.glb'
ARCHIVE_SHA='d35196badb125d4b74080cf42271cb119c5e0747a80c0c29a35036b5c9f64b1b'
LABELS=['15','4','6','7']
FEET=['LeftFoot','LeftToeBase','RightFoot','RightToeBase']


def identity(path):
    data=path.read_bytes();return {'path':str(path.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def read_glb(path):
    blob=path.read_bytes();assert blob[:4]==b'glTF'
    n=struct.unpack_from('<I',blob,12)[0]
    return json.loads(blob[20:20+n]),blob[28+n:]

def write_glb(path,doc,binary):
    doc['buffers'][0]['byteLength']=len(binary)
    text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*(-len(text)%4)
    binary=bytes(binary)+b'\0'*(-len(binary)%4)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary)

def view_bytes(doc,binary,index):
    view=doc['bufferViews'][index];start=view.get('byteOffset',0)
    return binary[start:start+view['byteLength']]

def rows(doc,binary,index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
    stride=v.get('byteStride',struct.calcsize(fmt)*width)
    return [struct.unpack_from('<'+fmt*width,binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*stride) for i in range(a['count'])]

def append_view(doc,binary,blob):
    binary.extend(b'\0'*(-len(binary)%4));index=len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(blob)})
    binary.extend(blob);return index

def append_accessor(doc,binary,values,width,component=5126):
    fmt={5126:'f',5125:'I',5123:'H'}[component]
    flat=[x for row in values for x in row]
    index=len(doc['accessors']);view=append_view(doc,binary,struct.pack('<'+fmt*len(flat),*flat))
    doc['accessors'].append({'bufferView':view,'componentType':component,'count':len(values),
        'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[width],
        'min':[min(row[i]for row in values)for i in range(width)],'max':[max(row[i]for row in values)for i in range(width)]})
    return index

def ensure_source():
    archive=PACK/'source/source-animation-pack.zip';assert identity(archive)['sha256']==ARCHIVE_SHA
    intake=json.loads((PACK/'source/intake-inspection.json').read_text())
    with zipfile.ZipFile(archive) as pack:
        for entry in intake['entries']:
            target=PACK/'source'/Path(entry['archivePath']).name
            raw=pack.read(entry['archivePath']);assert hashlib.sha256(raw).hexdigest()==entry['sha256']
            if not target.exists():target.write_bytes(raw)
            else:assert target.read_bytes()==raw


def combined_source():
    files=[PACK/f'source/Meshy_AI_Crimson_Outrider_biped_Animation_Idle_{label}_withSkin.glb'for label in LABELS]
    base,raw=read_glb(files[0]);binary=bytearray(raw);base=copy.deepcopy(base)
    original=copy.deepcopy(base);base['animations'][0]['name']='idle-15'
    receipts=[]
    for label,path in zip(LABELS,files):
        doc,data=read_glb(path)
        assert doc['nodes']==original['nodes'] and doc['skins']==original['skins'] and doc['meshes']==original['meshes']
        for a,b in zip(doc['bufferViews'][:8],original['bufferViews'][:8]):
            assert data[a.get('byteOffset',0):a.get('byteOffset',0)+a['byteLength']]==raw[b.get('byteOffset',0):b.get('byteOffset',0)+b['byteLength']]
        clip=doc['animations'][0];duration=max(max(x[0]for x in rows(doc,data,s['input']))for s in clip['samplers'])
        receipts.append({'name':f'idle-{int(label):02d}','duration':duration,'source':identity(path)})
        if label=='15':continue
        clip=copy.deepcopy(clip);clip['name']=f'idle-{int(label):02d}'
        accessors={};views={}
        for sampler in clip['samplers']:
            for key in ['input','output']:
                old=sampler[key]
                if old not in accessors:
                    a=copy.deepcopy(doc['accessors'][old]);old_view=a['bufferView']
                    if old_view not in views:views[old_view]=append_view(base,binary,view_bytes(doc,data,old_view))
                    a['bufferView']=views[old_view];accessors[old]=len(base['accessors']);base['accessors'].append(a)
                sampler[key]=accessors[old]
        base['animations'].append(clip)
    return base,binary,receipts

def load_scene(path):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.scene.render.threads_mode='FIXED';bpy.context.scene.render.threads=4
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'and any(m.type=='ARMATURE'for m in o.modifiers)]
    assert len(meshes)==1
    for o in bpy.context.scene.objects:
        if o.type=='MESH'and o not in meshes:o.hide_render=True
    return arm,meshes[0]

def activate(name):
    for obj in bpy.context.scene.objects:
        ad=obj.animation_data
        if not ad:continue
        found=[s for t in ad.nla_tracks for s in t.strips if t.name==name or s.action.name==name]
        if found:ad.action=found[0].action;ad.action_slot=found[0].action_slot;ad.use_nla=False
        elif ad.action and ad.action.name==name:ad.use_nla=False
        else:ad.action=None;ad.use_nla=False
    bpy.context.scene.frame_set(0)

def frame(time):
    value=time*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(value),subframe=value%1)

def points(mesh):
    deps=bpy.context.evaluated_depsgraph_get();obj=mesh.evaluated_get(deps);data=obj.to_mesh()
    try:return [obj.matrix_world@v.co for v in data.vertices]
    finally:obj.to_mesh_clear()

def bounds(ps):
    # Blender Z-up to glTF Y-up.
    a=np.asarray([[p.x,p.z,-p.y]for p in ps]);return {'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist()}

def union(samples):
    return {'min':[min(s['bounds']['min'][i]for s in samples)for i in range(3)],'max':[max(s['bounds']['max'][i]for s in samples)for i in range(3)]}

def sample(arm,mesh,name,duration,hz=30):
    activate(name);count=math.ceil(duration*hz)+1;result=[]
    for i in range(count):
        time=duration*i/(count-1);frame(time);ps=points(mesh)
        result.append({'time':time,'bounds':bounds(ps),'hipsBlender':list(arm.matrix_world@arm.pose.bones['Hips'].head)})
    frame(0);return result

def optimize(mesh,doc,binary):
    primitive=doc['meshes'][0]['primitives'][0]
    source=np.asarray(rows(doc,binary,primitive['attributes']['POSITION']))
    local=np.asarray([list(v.co)for v in mesh.data.vertices]);assert len(source)==len(local)
    conversion=np.linalg.lstsq(np.column_stack([source,np.ones(len(source))]),local,rcond=None)[0]
    residual=np.max(np.abs(np.column_stack([source,np.ones(len(source))])@conversion-local))
    assert residual<1e-4, f'Source/Blender vertex correspondence failed {residual}'
    matrix=np.eye(4);matrix[:3,:]=conversion.T;inverse=np.linalg.inv(matrix)
    uv_layer=mesh.data.uv_layers.active
    source_uv=rows(doc,binary,primitive['attributes']['TEXCOORD_0'])
    direct=max(abs(uv_layer.data[loop.index].uv[1]-source_uv[loop.vertex_index][1])for loop in mesh.data.loops)
    flipped=max(abs((1-uv_layer.data[loop.index].uv[1])-source_uv[loop.vertex_index][1])for loop in mesh.data.loops)
    flip_uv=flipped<direct;assert min(direct,flipped)<1e-5
    originals=[v.co.copy()for v in mesh.data.vertices]
    original_faces=[tuple(p.vertices)for p in mesh.data.polygons]
    protect=mesh.vertex_groups.new(name='Authoring detail protection')
    group_names={g.index:g.name for g in mesh.vertex_groups}
    protected=[]
    for v in mesh.data.vertices:
        weight=sum(g.weight for g in v.groups if group_names[g.group] in ['Head','head_end','headfront','LeftHand','RightHand'])
        if weight>.35:protect.add([v.index],1,'REPLACE');protected.append(v.index)
    bpy.context.view_layer.objects.active=mesh;mesh.select_set(True)
    modifier=mesh.modifiers.new('Merchant budget / protect face and hands','DECIMATE')
    modifier.ratio=19700/31170;modifier.use_collapse_triangulate=True
    modifier.vertex_group=protect.name;modifier.invert_vertex_group=True;modifier.vertex_group_factor=10
    bpy.ops.object.modifier_move_to_index(modifier=modifier.name,index=0)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh.data.calc_loop_triangles();triangles=len(mesh.data.loop_triangles);print('TRIANGLES',triangles,'protected',len(protected));assert triangles<=20000
    bvh=BVHTree.FromPolygons([v.co for v in mesh.data.vertices],[tuple(p.vertices)for p in mesh.data.polygons])
    errors=[bvh.find_nearest(p)[3]for p in originals]
    protected_errors=[errors[i]for i in protected]
    names=[doc['nodes'][i]['name']for i in doc['skins'][0]['joints']];joint_index={name:i for i,name in enumerate(names)}
    groups={g.index:g.name for g in mesh.vertex_groups}
    attributes={key:[] for key in ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']};indices=[];unique={};discard=[]
    for tri in mesh.data.loop_triangles:
        for loop_index in tri.loops:
            loop=mesh.data.loops[loop_index];v=mesh.data.vertices[loop.vertex_index]
            normal=mesh.data.corner_normals[loop_index].vector;uv=mesh.data.uv_layers.active.data[loop_index].uv
            key=(v.index,tuple(normal),tuple(uv))
            if key not in unique:
                unique[key]=len(attributes['POSITION'])
                pos=inverse@np.asarray([*v.co,1]);n=matrix[:3,:3].T@np.asarray(normal);n/=np.linalg.norm(n)
                influences=sorted([(joint_index[groups[g.group]],g.weight)for g in v.groups if groups[g.group]in joint_index and g.weight>0],key=lambda x:x[1],reverse=True)
                discard.append(sum(w for j,w in influences[4:]));influences=influences[:4];total=sum(w for j,w in influences);assert total>0
                js=[j for j,w in influences];ws=[w/total for j,w in influences]
                attributes['POSITION'].append(pos[:3].tolist());attributes['NORMAL'].append(n.tolist());attributes['TEXCOORD_0'].append([uv.x,1-uv.y if flip_uv else uv.y]);attributes['JOINTS_0'].append(js+[0]*(4-len(js)));attributes['WEIGHTS_0'].append(ws+[0]*(4-len(ws)))
            indices.append([unique[key]])
    report={'sourceTriangles':31170,'runtimeTriangles':triangles,'runtimeVertices':len(unique),'protectedSourceVertices':len(protected),'sourceBlenderCorrespondenceMax':float(residual),'restSurfaceErrorLocalMax':max(errors),'restSurfaceErrorLocalP95':float(np.percentile(errors,95)),'protectedRestSurfaceErrorLocalMax':max(protected_errors),'maxDiscardedSkinWeight':max(discard),'uvVFlipForGltf':flip_uv,'sourceToBlenderMesh':matrix.tolist()}
    assert max(discard)<.08,report
    return attributes,indices,report


def relaxed_arm_tracks(doc,binary,clips):
    """Author glTF joint rotations in Blender mathutils, preserving bind transforms.

    Forward is source +Z before the outer half-turn. Only rest portions are
    corrected; intentional raised/reaching arms smoothly retain source tracks.
    """
    parents={child:i for i,n in enumerate(doc['nodes']) for child in n.get('children',[])}
    names={n.get('name'):i for i,n in enumerate(doc['nodes'])}
    def quat(v):return Quaternion((v[3],v[0],v[1],v[2]))
    def smooth(a,b,x):
        u=max(0,min(1,(x-a)/(b-a)));return u*u*(3-2*u)
    receipts=[]
    for clip in clips:
        anim=next(a for a in doc['animations']if a['name']==clip['name'])
        tracks={}
        for ch in anim['channels']:
            sampler=anim['samplers'][ch['sampler']]
            tracks[(ch['target']['node'],ch['target']['path'])]=(rows(doc,binary,sampler['input']),rows(doc,binary,sampler['output']))
        def pose(t):
            translations=[Vector(n.get('translation',[0,0,0]))for n in doc['nodes']]
            rotations=[quat(n.get('rotation',[0,0,0,1]))for n in doc['nodes']]
            scales=[Vector(n.get('scale',[1,1,1]))for n in doc['nodes']]
            for (i,path),(times,values) in tracks.items():
                k=max(0,min(len(times)-2,bisect.bisect_right([x[0]for x in times],t)-1));u=max(0,min(1,(t-times[k][0])/max(1e-12,times[k+1][0]-times[k][0])))
                if path=='rotation':rotations[i]=quat(values[k]).slerp(quat(values[k+1]),u)
                elif path=='translation':translations[i]=Vector(values[k]).lerp(Vector(values[k+1]),u)
                elif path=='scale':scales[i]=Vector(values[k]).lerp(Vector(values[k+1]),u)
            def world(i):
                local=Matrix.LocRotScale(translations[i],rotations[i],scales[i]);return world(parents[i])@local if i in parents else local
            return rotations,world
        times=[[clip['duration']*i/math.ceil(clip['duration']*30)]for i in range(math.ceil(clip['duration']*30)+1)]
        corrected={names[side+joint]:[]for side in ['Left','Right']for joint in ['Shoulder','Arm','ForeArm']}
        strengths=[]
        for time in times:
            rotations,world=pose(time[0]);chest=world(names['Spine']).to_quaternion()
            for side,sign in [('Left',1),('Right',-1)]:
                shoulder=names[side+'Shoulder'];upper=names[side+'Arm'];fore=names[side+'ForeArm'];hand=names[side+'Hand']
                original_height=(world(hand).translation-world(upper).translation).dot(chest@Vector((0,1,0)))
                strength=1-smooth(-.28,-.08,original_height);strengths.append(strength)
                for bone,child,direction in [(shoulder,upper,(sign,-.10,.15)),(upper,fore,(sign*.18,-1,.10)),(fore,hand,(sign*.20,-1,.28))]:
                    before=world(bone);current=world(child).translation-before.translation
                    target=(chest@Vector(direction)).normalized()
                    desired=current.normalized().rotation_difference(target)@before.to_quaternion()
                    parentq=world(parents[bone]).to_quaternion() if bone in parents else Quaternion()
                    local=parentq.inverted()@desired
                    rotations[bone]=rotations[bone].slerp(local,strength)
                # Forearm pronation relaxes the palms toward the thighs. The
                # elbow-to-wrist axis keeps both joint positions unchanged.
                axis=(world(hand).translation-world(fore).translation).normalized()
                desired=Quaternion(axis,-sign*math.radians(60)*strength)@world(fore).to_quaternion()
                rotations[fore]=world(parents[fore]).to_quaternion().inverted()@desired
            for i,values in corrected.items():
                q=rotations[i].normalized()
                if values and q.dot(quat(values[-1]))<0:q.negate()
                values.append([q.x,q.y,q.z,q.w])
        changed=[]
        for ch in anim['channels']:
            i=ch['target']['node']
            if ch['target']['path']!='rotation' or i not in corrected:continue
            sampler=anim['samplers'][ch['sampler']]
            sampler['input']=append_accessor(doc,binary,times,1);sampler['output']=append_accessor(doc,binary,corrected[i],4);sampler['interpolation']='LINEAR';changed.append(doc['nodes'][i]['name'])
        receipts.append({'name':clip['name'],'correctedRotationNodes':changed,'samples':len(times),'restCorrectionStrengthRange':[min(strengths),max(strengths)]})
    (PACK/'arm-correction.json').write_text(json.dumps({'method':'Directional shoulder/upperarm/forearm retarget, 30 Hz, original bind/node transforms preserved; source high gestures retain original rotations as correction fades between hand-relative heights -0.28 and -0.08 m.','sourceForward':'+Z','restForearmAxialRollDegrees':{'Left':-60,'Right':60},'targetDirectionsChestSpace':{'shoulder':['side',-.10,.15],'upperArm':['side*0.18',-1,.10],'forearm':['side*0.20',-1,.28]},'clips':receipts},indent=2)+'\n')
    return receipts

def replace_geometry(doc,binary,attributes,indices):
    replacement={};primitive=doc['meshes'][0]['primitives'][0]
    for key,values in [*attributes.items(),('indices',indices)]:
        ai=primitive['indices']if key=='indices'else primitive['attributes'][key]
        accessor=doc['accessors'][ai];width=len(values[0]);component=5123 if key in ['indices','JOINTS_0']else 5126
        fmt='H'if component==5123 else 'f'
        replacement[accessor['bufferView']]=struct.pack('<'+fmt*(len(values)*width),*(x for row in values for x in row))
        accessor.update(componentType=component,count=len(values),min=[min(v[i]for v in values)for i in range(width)],max=[max(v[i]for v in values)for i in range(width)])
    png=PACK/'source/albedo.png';png.write_bytes(view_bytes(doc,binary,doc['images'][0]['bufferView']))
    webp=PACK/'albedo-1024.webp';subprocess.run(['magick',str(png),'-resize','1024x1024>','-quality','88',str(webp)],check=True)
    replacement[doc['images'][0]['bufferView']]=webp.read_bytes();doc['images'][0]['mimeType']='image/webp'
    for texture in doc['textures']:
        image_index=texture.pop('source');texture['extensions']={'EXT_texture_webp':{'source':image_index}}
    doc['extensionsUsed']=['EXT_texture_webp'];doc['extensionsRequired']=['EXT_texture_webp']
    for m in doc['materials']:
        m['emissiveFactor']=[0,0,0];m.pop('emissiveTexture',None);m.pop('extensions',None)
        m['pbrMetallicRoughness']['metallicFactor']=0;m['pbrMetallicRoughness']['roughnessFactor']=.72
        m['name']='Watchkeep burgundy workwear / source albedo / non-emissive'
    result=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        blob=replacement.get(i,view_bytes(doc,binary,i));result.extend(b'\0'*(-len(result)%4));view['byteOffset']=len(result);view['byteLength']=len(blob);result.extend(blob)
    return result


def dense_report(arm,mesh,clips,hz=60):
    reports=[];all_samples=[]
    for clip in clips:
        samples=sample(arm,mesh,clip['name'],clip['duration'],hz);all_samples.extend(samples)
        activate(clip['name']);frame(0);first=points(mesh);frame(clip['duration']);last=points(mesh)
        loop=max((a-b).length for a,b in zip(first,last))
        reports.append({'name':clip['name'],'duration':clip['duration'],'sampleCount':len(samples),'bounds':union(samples),'minimumGroundY':min(x['bounds']['min'][1]for x in samples),'maximumGroundY':max(x['bounds']['min'][1]for x in samples),'loopEndpointMaxVertexDistance':loop,'samples':samples})
        print('SAMPLED',clip['name'],len(samples),'ground',reports[-1]['minimumGroundY'],reports[-1]['maximumGroundY'],flush=True)
    return reports,union(all_samples)


def preservation_receipt(doc,binary,clips):
    receipt=[]
    for label in LABELS:
        source=PACK/f'source/Meshy_AI_Crimson_Outrider_biped_Animation_Idle_{label}_withSkin.glb';original,raw=read_glb(source)
        exported=next(a for a in doc['animations']if a['name']==f'idle-{int(label):02d}');before=original['animations'][0]
        assert doc['nodes'][:-1]==original['nodes'] and doc['skins']==original['skins']
        tracks=[]
        for old,new in zip(before['channels'],exported['channels']):
            assert old['target']==new['target']
            a=before['samplers'][old['sampler']];b=exported['samplers'][new['sampler']]
            assert a.get('interpolation','LINEAR')==b.get('interpolation','LINEAR')
            hashes={}
            for key in ['input','output']:
                ab=view_bytes(original,raw,original['accessors'][a[key]]['bufferView']);bb=view_bytes(doc,binary,doc['accessors'][b[key]]['bufferView']);corrected=old['target']['path']=='rotation' and original['nodes'][old['target']['node']]['name'] in [side+joint for side in ['Left','Right'] for joint in ['Shoulder','Arm','ForeArm']]
                if not corrected:assert ab==bb
                hashes[key+'SourceSha256']=hashlib.sha256(ab).hexdigest();hashes[key+'RuntimeSha256']=hashlib.sha256(bb).hexdigest()
            tracks.append({'node':original['nodes'][old['target']['node']]['name'],'path':old['target']['path'],'status':'corrected resting-arm rotation' if corrected else 'byte-identical',**hashes})
        ia=original['skins'][0]['inverseBindMatrices'];ib=doc['skins'][0]['inverseBindMatrices'];a=view_bytes(original,raw,original['accessors'][ia]['bufferView']);b=view_bytes(doc,binary,doc['accessors'][ib]['bufferView']);assert a==b
        receipt.append({'name':exported['name'],'originalChannelsUnchanged':sum(t['status']=='byte-identical'for t in tracks),'correctedChannels':sum(t['status']!='byte-identical'for t in tracks),'addedChannels':['Watchkeep_normalized_root.translation'],'inverseBindSha256':hashlib.sha256(a).hexdigest(),'tracks':tracks})
    (PACK/'source-preservation.json').write_text(json.dumps(receipt,indent=2)+'\n');return {'originalAnimationChannelsPerClip':72,'unchangedChannelsPerClip':66,'correctedRotationChannelsPerClip':6,'originalAnimationFloatBuffers':'66 channels byte-identical; six resting-arm rotation tracks intentionally corrected','originalNodesAndSkin':'identical before one outer normalization node','inverseBindBuffer':'byte-identical','geometry':'derived protected reduction; source archive unchanged'}


def crossfade_report(arm,mesh,clips):
    ordered=sorted(clips,key=lambda c:c['name']);duration=.65;reports=[]
    objects=[o for o in bpy.context.scene.objects if o.animation_data]
    def snapshot(name,time):
        activate(name);frame(time)
        return ({o.name:o.matrix_basis.copy()for o in objects},{b.name:b.matrix_basis.copy()for b in arm.pose.bones})
    def mix(a,b,u):
        at,aq,asc=a.decompose();bt,bq,bsc=b.decompose();return Matrix.LocRotScale(at.lerp(bt,u),aq.slerp(bq,u),asc.lerp(bsc,u))
    for index,old in enumerate(ordered):
        new=ordered[(index+1)%len(ordered)];samples=[]
        for step in range(40):
            u=step/39;a=snapshot(old['name'],old['duration']-duration+duration*u);b=snapshot(new['name'],duration*u)
            for o in objects:o.animation_data.action=None;o.animation_data.use_nla=False;o.matrix_basis=mix(a[0][o.name],b[0][o.name],u)
            for bone in arm.pose.bones:bone.matrix_basis=mix(a[1][bone.name],b[1][bone.name],u)
            bpy.context.view_layer.update();samples.append({'phase':u,'bounds':bounds(points(mesh))})
        reports.append({'from':old['name'],'to':new['name'],'duration':duration,'samples':samples,'minimumGroundY':min(x['bounds']['min'][1]for x in samples),'maximumGroundY':max(x['bounds']['min'][1]for x in samples),'bounds':union(samples)})
    (PACK/'crossfade-samples.json').write_text(json.dumps(reports,indent=2)+'\n')
    activate('idle-15');frame(0);return [{k:v for k,v in r.items()if k!='samples'}for r in reports]


def studio(arm,mesh,clips,review_dir=None,only=None):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.13,.15,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    target=Vector((0,0,.87))
    for pos,energy,size in [((3,4,5),650,4),((-3,1,3),400,3),((1,-3,4),500,3)]:
        d=bpy.data.lights.new('Neutral studio','AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new('Neutral studio',d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='Studio floor / not exported';mat=bpy.data.materials.new('Studio neutral floor');mat.diffuse_color=(.14,.155,.18,1);floor.data.materials.append(mat)
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.08
    scene.render.use_stamp=True;scene.render.use_stamp_note=True;scene.render.use_stamp_date=False;scene.render.use_stamp_time=False;scene.render.use_stamp_frame=False;scene.render.use_stamp_filename=False;scene.render.stamp_font_size=13
    review=review_dir or PACK/'review';review.mkdir(parents=True,exist_ok=True)
    shots=[('front-oblique','idle-15',0,(2,5,1),False),('back-oblique','idle-15',0,(-2,-5,1),False),('face-detail','idle-15',0,(1,5,.25),True)]
    shots.extend((c['name']+'-mid',c['name'],c['duration']*.5,(2,5,1),False)for c in clips)
    if only:shots=[shot for shot in shots if shot[0]in only]
    for label,name,time,direction,close in shots:
        activate(name);frame(time);target=Vector((0,0,1.49 if close else .87));cam.data.ortho_scale=.58 if close else 2.08;cam.location=target+Vector(direction);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.stamp_note_text=f'BLENDER CPU STUDIO / {name} {time:.2f}s / NOT GAME';png=review/(label+'.png');scene.render.filepath=str(png);bpy.ops.render.render(write_still=True)
        subprocess.run(['magick',str(png),'-quality','91',str(review/(label+'.webp'))],check=True);png.unlink()
    receipt={'kind':'Blender studio, not game evidence','asset':identity(OUT),'renderer':'Blender 5.2 Cycles CPU','threads':4,'samples':16,'resolution':[800,900],'images':[identity(review/(shot[0]+'.webp'))for shot in shots]}
    (review/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--skip-renders',action='store_true');parser.add_argument('--render-only',action='store_true');parser.add_argument('--verify-reproducible',action='store_true');parser.add_argument('--preview-arms',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
    if args.preview_arms:
        manifest=json.loads(OUT.with_name('watchkeep-shopkeeper-manifest.json').read_text());arm,mesh=load_scene(OUT);studio(arm,mesh,manifest['idleClips'],PACK/'arm-prototype',['front-oblique','back-oblique']);return
    if args.render_only:
        manifest=json.loads(OUT.with_name('watchkeep-shopkeeper-manifest.json').read_text());assert identity(OUT)['sha256']==manifest['asset']['sha256']
        arm,mesh=load_scene(OUT);studio(arm,mesh,manifest['idleClips']);return
    ensure_source()
    doc,binary,clips=combined_source();combined=PACK/'source/combined-idles.glb';write_glb(combined,doc,binary)
    arm,mesh=load_scene(combined);activate('idle-15')
    attributes,indices,optimization=optimize(mesh,doc,binary)
    (PACK/'optimization.json').write_text(json.dumps(optimization,indent=2)+'\n');print('OPTIMIZATION',json.dumps(optimization),flush=True)
    # Import the actual serialized reduced geometry before measuring normalization.
    binary=replace_geometry(doc,binary,attributes,indices);write_glb(PACK/'derived-reduced-source-idles.glb',doc,binary);arm_correction=relaxed_arm_tracks(doc,binary,clips);derived=PACK/'derived-unfitted.glb';write_glb(derived,doc,binary);arm,mesh=load_scene(derived);activate('idle-15');frame(0)
    first=points(mesh);b=bounds(first);height=b['max'][1]-b['min'][1];factor=1.72/height;cx=(b['min'][0]+b['max'][0])/2;cz=(b['min'][2]+b['max'][2])/2
    # Source faces +Z. A rigid Y half turn makes the runtime face -Z.
    wrapper=len(doc['nodes']);doc['nodes'].append({'name':'Watchkeep_normalized_root','children':doc['scenes'][doc.get('scene',0)]['nodes'],'rotation':[0,1,0,0],'scale':[factor]*3,'translation':[factor*cx,-factor*b['min'][1],factor*cz]});doc['scenes'][doc.get('scene',0)]['nodes']=[wrapper]
    grounding=[]
    for clip in clips:
        samples=sample(arm,mesh,clip['name'],clip['duration'],30)
        times=[[x['time']]for x in samples];translations=[[factor*cx,-factor*x['bounds']['min'][1],factor*cz]for x in samples]
        animation=next(a for a in doc['animations']if a['name']==clip['name']);sampler=len(animation['samplers'])
        animation['samplers'].append({'input':append_accessor(doc,binary,times,1),'output':append_accessor(doc,binary,translations,3),'interpolation':'LINEAR'});animation['channels'].append({'sampler':sampler,'target':{'node':wrapper,'path':'translation'}})
        grounding.append({'name':clip['name'],'sourceMinimumGround':min(x['bounds']['min'][1]for x in samples),'sourceMaximumGround':max(x['bounds']['min'][1]for x in samples),'samples':len(samples),'wrapperTranslationYRange':[min(x[1]for x in translations),max(x[1]for x in translations)]})
    if args.verify_reproducible:
        candidate=PACK/'reproducibility-check.glb';write_glb(candidate,doc,binary);assert candidate.read_bytes()==OUT.read_bytes(),'Rebuild differs from frozen runtime'
        (PACK/'reproducibility.json').write_text(json.dumps({'byteIdentical':True,'asset':identity(OUT),'exporter':identity(Path(__file__)),'sourceArchive':identity(PACK/'source/source-animation-pack.zip')},indent=2)+'\n');candidate.unlink();print('REPRODUCIBLE',identity(OUT),flush=True);return
    write_glb(OUT,doc,binary);assert OUT.stat().st_size<=2_000_000
    preservation=preservation_receipt(doc,binary,clips)
    arm,mesh=load_scene(OUT);reports,envelope=dense_report(arm,mesh,clips,60)
    transitions=crossfade_report(arm,mesh,clips)
    (PACK/'deformation-samples.json').write_text(json.dumps(reports,indent=2)+'\n')
    for report in reports:assert abs(report['minimumGroundY'])<.002 and abs(report['maximumGroundY'])<.002,report['name']
    dimensions=dict(zip(['width','height','length'],[envelope['max'][i]-envelope['min'][i]for i in range(3)]))
    manifest={'id':'watchkeep-shopkeeper','displayName':'Watchkeep shopkeeper','asset':identity(OUT),'sourceArchive':identity(PACK/'source/source-animation-pack.zip'),'idleClips':clips,'dimensions':dimensions,'boundsMetres':envelope,'triangles':optimization['runtimeTriangles'],'vertices':optimization['runtimeVertices'],'materials':1,'skins':1,'joints':24,'texture':{'format':'WebP','maximumEdge':1024,'sourceAlbedoPreserved':True},'material':{'emission':0,'metallic':0,'roughness':.72,'reason':'Remove source full-albedo self-light and default-metal error; matte mixed workwear finish'},'normalization':{'anatomicalLandmark':'Idle-15 initial head/hair crown over boot soles','targetHeightMetres':1.72,'scale':factor,'facing':'-Z','up':'+Y','sourceCenterXZ':[cx,cz],'rootTravelRemoved':False,'reason':'Closed idle loops retain authored horizontal weight shifts; only sub-centimetre sole grounding is added.'},'armCorrection':arm_correction,'grounding':grounding,'optimization':optimization,'validation':{'kind':'actual runtime GLB Blender reimport, CPU skin evaluation','samplesHz':60,'clips':[{k:v for k,v in r.items()if k!='samples'}for r in reports],'gameEvidence':False,'preservation':preservation,'crossfades':transitions}}
    OUT.with_name('watchkeep-shopkeeper-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    activate('idle-15');frame(0);bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(PACK/'watchkeep-shopkeeper.blend'))
    if not args.skip_renders:studio(arm,mesh,clips)
    print('FINAL',json.dumps({'asset':manifest['asset'],'dimensions':dimensions,'bounds':envelope,'clips':[{k:c[k]for k in ['name','duration']}for c in clips]}),flush=True)

if __name__=='__main__':main()
