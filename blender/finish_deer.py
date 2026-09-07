"""Deer walk repair, preserving source mesh/weights/bind rig byte-for-byte.

ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_deer.py
Use -- --skip-studio for a numerical/export-only rebuild. CPU-only, no downloads.
"""
import argparse, copy, hashlib, json, math, os, struct, subprocess, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector, Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from creature_motion import source_worlds
from finish_pyrebear import load_scene, skin_points, bounds, gltf_vector

ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'assets/creatures/deer'
SOURCE=PACK/'source/deer-walking.glb'
OUTPUT=ROOT/'public/models/creatures/deer.glb'
SHA='4dcadf23be2451d7410294c99ff4fdcdad273f28302d5a96b486de46fd7c064c'
FEET=['frontleg2','R_frontleg2','backleg2','R_backleg2']
PERIOD,STRIDE,DUTY,SHOULDER=1.6,.56,.76,1.30

def read_glb(path):
    raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+size]),raw[28+size:]

def turn(arm,bone,rotation):
    world=arm.matrix_world@bone.matrix;at=world.translation
    bone.matrix=arm.matrix_world.inverted()@Matrix.Translation(at)@rotation@Matrix.Translation(-at)@world
    bpy.context.view_layer.update()

def solve(arm,chain,target,original):
    ps=[arm.matrix_world@b.head for b in chain]
    lengths=[(b-a).length for a,b in zip(ps,ps[1:])];anchor=ps[0].copy()
    solved=[p.copy() for p in ps]
    for _ in range(48):
        solved[-1]=target.copy()
        for j in range(2,-1,-1):solved[j]=solved[j+1]+(solved[j]-solved[j+1]).normalized()*lengths[j]
        solved[0]=anchor.copy()
        for j in range(3):solved[j+1]=solved[j]+(solved[j+1]-solved[j]).normalized()*lengths[j]
    for j,b in enumerate(chain[:-1]):
        at=arm.matrix_world@b.head;child=arm.matrix_world@chain[j+1].head
        rotation=(child-at).normalized().rotation_difference((solved[j+1]-solved[j]).normalized())
        turn(arm,b,rotation.to_matrix().to_4x4())
    at=arm.matrix_world@chain[-1].head;_,q,s=original.decompose()
    chain[-1].matrix=arm.matrix_world.inverted()@Matrix.LocRotScale(at,q,s)
    bpy.context.view_layer.update()
    return (at-target).length

def write_runtime(doc,binary,webp,fit,tracks,times):
    d=copy.deepcopy(doc);out=bytearray();preserved={};image_view=d['images'][0]['bufferView']
    for i,v in enumerate(d['bufferViews']):
        data=webp if i==image_view else binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        out.extend(b'\0'*(-len(out)%4));v['byteOffset']=len(out);v['byteLength']=len(data);out.extend(data)
        if i!=image_view:preserved[str(i)]=hashlib.sha256(data).hexdigest()
    d['images'][0]['mimeType']='image/webp'
    for t in d['textures']:
        source=t.pop('source');t['extensions']={'EXT_texture_webp':{'source':source}}
    mat=d['materials'][0];mat.pop('extensions',None);mat.pop('emissiveTexture',None);mat['emissiveFactor']=[0,0,0]
    mat['name']='Deer matte hide';mat['pbrMetallicRoughness'].update(metallicFactor=0,roughnessFactor=.84)
    d['extensionsUsed']=['EXT_texture_webp'];d['extensionsRequired']=['EXT_texture_webp']
    B=Matrix.Rotation(math.pi/2,4,'X');M=B.inverted()@fit@B
    wrapper={'name':'DeerRoot','children':d['scenes'][0]['nodes'][:],
             'matrix':[M[r][c] for c in range(4) for r in range(4)],
             'extras':{'units':'metres','front':'-Z','shoulderHeight':SHOULDER}}
    d['scenes'][0]['nodes']=[len(d['nodes'])];d['nodes'].append(wrapper)
    def accessor(rows,width):
        out.extend(b'\0'*(-len(out)%4));offset=len(out)
        out.extend(struct.pack('<'+'f'*(len(rows)*width),*[v for row in rows for v in row]))
        d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(out)-offset})
        a={'bufferView':len(d['bufferViews'])-1,'componentType':5126,'count':len(rows),
           'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[width]}
        if width==1:a.update(min=[rows[0][0]],max=[rows[-1][0]])
        d['accessors'].append(a);return len(d['accessors'])-1
    inp=accessor([[t] for t in times],1);anim={'name':'walk','channels':[],'samplers':[]}
    byname={n.get('name'):i for i,n in enumerate(d['nodes'])}
    for name,paths in tracks.items():
        for path,rows in paths.items():
            a=accessor(rows,4 if path=='rotation' else 3)
            anim['channels'].append({'sampler':len(anim['samplers']),'target':{'node':byname[name],'path':path}})
            anim['samplers'].append({'input':inp,'output':a,'interpolation':'LINEAR'})
    d['animations']=[anim];d['buffers'][0]['byteLength']=len(out)
    js=json.dumps(d,separators=(',',':')).encode();js+=b' '*(-len(js)%4);out+=b'\0'*(-len(out)%4)
    raw=struct.pack('<4sII',b'glTF',2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out
    OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_bytes(raw)
    check,bb=read_glb(OUTPUT)
    for i,h in preserved.items():
        v=check['bufferViews'][int(i)];assert hashlib.sha256(bb[v['byteOffset']:v['byteOffset']+v['byteLength']]).hexdigest()==h
    assert check['meshes']==doc['meshes'] and check['skins']==doc['skins']
    return preserved

def studio(arm,mesh,prefix,duration):
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12
    s.cycles.use_denoising=True;s.cycles.seed=7291;s.render.threads_mode='FIXED';s.render.threads=4
    s.render.resolution_x=800;s.render.resolution_y=700;s.render.resolution_percentage=100
    s.view_settings.view_transform='AgX';s.view_settings.exposure=0
    s.world=bpy.data.worlds.new('Neutral deer studio');s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    target=Vector((0,0,1.05))
    for pos,power in [((4,4,6),800),((-4,1,3),500),((1,-4,4),650)]:
        d=bpy.data.lights.new('Studio','AREA');d.energy=power;d.size=4
        o=bpy.data.objects.new('Studio',d);s.collection.objects.link(o);o.location=pos
        o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003))
    floor=bpy.context.object;mat=bpy.data.materials.new('Studio floor');mat.diffuse_color=(.16,.16,.16,1);floor.data.materials.append(mat)
    bpy.ops.object.camera_add();camera=bpy.context.object;s.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=3.0
    camera.location=target+Vector((4,5,1.1));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    s.render.use_stamp=True;s.render.use_stamp_note=True
    folder=PACK/'review';folder.mkdir(exist_ok=True)
    scratch=PACK/'.render-tmp';scratch.mkdir(exist_ok=True)
    os.environ['MAGICK_TEMPORARY_PATH']=str(scratch)
    for i in range(8):
        phase=i/8;f=phase*duration*s.render.fps;s.frame_set(int(f),subframe=f%1)
        s.render.stamp_note_text=f'BLENDER DEER / {prefix} / phase {phase:.3f} / NOT GAME EVIDENCE'
        temp=scratch/f'deer-{prefix}-{i:02}.png';s.render.filepath=str(temp);bpy.ops.render.render(write_still=True)
        subprocess.run(['magick',str(temp),'-quality','90',str(folder/f'{prefix}-{i:02}.webp')],check=True)
        temp.unlink()
    s.frame_set(0);camera.location=target+Vector((6,0,.2));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    s.render.stamp_note_text=f'BLENDER DEER / {prefix} SIDE / NOT GAME EVIDENCE'
    temp=scratch/f'deer-{prefix}-side.png';s.render.filepath=str(temp);bpy.ops.render.render(write_still=True)
    subprocess.run(['magick',str(temp),'-quality','90',str(folder/f'{prefix}-side.webp')],check=True)
    temp.unlink()
    # These are eight sampled poses per authored cycle, not a runtime recording.
    frames=[str(folder/f'{prefix}-{i:02}.webp') for i in range(8)]
    gif=['magick']
    for i,frame in enumerate(frames):
        delay=round((i+1)*duration/8*100)-round(i*duration/8*100)
        gif.extend(['-delay',str(delay),frame])
    subprocess.run([*gif,'-loop','0',str(folder/f'{prefix}-walk.gif')],check=True)
    subprocess.run(['magick','montage',*frames,'-tile','4x2','-geometry','320x280+2+2','-quality','90',str(folder/f'{prefix}-strip.webp')],check=True)
    scratch.rmdir()

def verify_runtime():
    """Check interpolated skin between authoring keys, independent of studio poses."""
    arm,mesh,_=load_scene(OUTPUT);scene=bpy.context.scene
    minimum=float('inf');first=None;last=None
    for i in range(193):
        f=i/192*PERIOD*scene.render.fps;scene.frame_set(int(f),subframe=f%1)
        pp=skin_points(mesh);minimum=min(minimum,min(p.z for p in pp))
        if i==0:first=pp
        if i==192:last=pp
    seam=max((a-b).length for a,b in zip(first,last))
    assert minimum>=-.002,minimum
    assert seam<.0001,seam
    record={'runtimeSHA256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
            'samples':193,'minimumInterpolatedSkinHeightMetres':minimum,
            'loopMaximumVertexDifferenceMetres':seam,
            'scope':'CPU Blender reimport, flat ground, all skinned vertices; not terrain or browser evidence'}
    (PACK/'verification.json').write_text(json.dumps(record,indent=2)+'\n')
    print('DEER_VERIFICATION',json.dumps(record))
    return record

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--skip-studio',action='store_true');ap.add_argument('--after-only',action='store_true');ap.add_argument('--verify-only',action='store_true')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.verify_only:verify_runtime();return
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SHA
    doc,binary=read_glb(SOURCE);arm,mesh,_=load_scene(SOURCE);scene=bpy.context.scene;scene.render.fps=30
    source_action=arm.animation_data.action;source_action.name='Source walk (preserved)';source_action.use_fake_user=True
    arm.animation_data.action=None;arm.animation_data.use_nla=False
    for b in arm.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update();rest=skin_points(mesh);bb=bounds(rest);lo,hi=Vector(bb['min']),Vector(bb['max'])
    chest=arm.matrix_world@arm.pose.bones['chest'].head
    # Backward-reaching antlers overlap the shoulder's X/Y band. Measure hide
    # around the chest joint, excluding high neck/antler vertices explicitly.
    hip=arm.matrix_world@arm.pose.bones['Hips'].head
    shoulder_y=sorted([chest.y,chest.y+(hip.y-chest.y)*.25])
    dorsal=[p.z for p in rest if abs(p.x-chest.x)<(hi.x-lo.x)*.2
            and shoulder_y[0]<=p.y<=shoulder_y[1]
            and p.z < chest.z+(chest.z-lo.z)*.30]
    scale=SHOULDER/(max(dorsal)-lo.z);anchor=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    fit=Matrix.Rotation(math.pi,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-anchor)
    wrap=bpy.data.objects.new('DeerRoot',None);scene.collection.objects.link(wrap)
    for o in [o for o in list(scene.objects) if o.parent is None and o!=wrap]:
        w=o.matrix_world.copy();o.parent=wrap;o.matrix_world=w
    wrap.matrix_world=fit;bpy.context.view_layer.update()
    original={b.name:b.matrix_basis.copy() for b in arm.pose.bones}
    rest_world={b.name:arm.matrix_world@b.matrix for b in arm.pose.bones};rest_points=skin_points(mesh)
    groups={g.index:g.name for g in mesh.vertex_groups};indices={name:[] for name in FEET}
    for v in mesh.data.vertices:
        for g in v.groups:
            if groups[g.group] in indices and g.weight>=.35:indices[groups[g.group]].append(v.index)
    soles={name:min(rest_points[i].z-rest_world[name].translation.z for i in ids) for name,ids in indices.items()}
    source,parents=source_worlds(doc);byname={n.get('name'):i for i,n in enumerate(doc['nodes'])}
    B=Matrix.Rotation(math.pi/2,4,'X');source_b={i:fit@B@m for i,m in source.items()}
    corrections={b.name:(arm.matrix_world@b.bone.matrix_local).inverted()@source_b[byname[b.name]] for b in arm.pose.bones}
    tracks={b.name:{'translation':[],'rotation':[],'scale':[]} for b in arm.pose.bones};samples=[];times=[];errors=[]
    # Lateral four-beat order: hind-left, fore-left, hind-right, fore-right.
    # The relaxed walk keeps at least three hooves in their support phase.
    phases={'backleg':0,'frontleg':.75,'R_backleg':.5,'R_frontleg':.25}
    for i in range(97):
        phase=i/96;frame=phase*PERIOD*scene.render.fps;scene.frame_set(int(frame),subframe=frame%1)
        for b in arm.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=original[b.name].copy()
        hips=arm.pose.bones['Hips'];hw=rest_world['Hips'].copy()
        hw.translation.z-=.035+.009*(1-math.cos(4*math.pi*phase));hw.translation.x+=.009*math.sin(2*math.pi*phase)
        hips.matrix=arm.matrix_world.inverted()@hw;bpy.context.view_layer.update()
        turn(arm,arm.pose.bones['chest'],Matrix.Rotation(.009*math.sin(2*math.pi*phase),4,'Y'))
        turn(arm,arm.pose.bones['head'],Matrix.Rotation(-.015+.009*math.sin(2*math.pi*phase+.3),4,'X'))
        for name in ['tail','tailstart','tail1','tail2','tail3']:
            turn(arm,arm.pose.bones[name],Matrix.Rotation(.016*math.sin(2*math.pi*phase-.5*len(name)),4,'Z'))
        foot_state={}
        for name in FEET:
            prefix=name[:-1];p=(phase+phases[prefix])%1;stance=p<DUTY
            if stance:y=STRIDE*(.5-p/DUTY);lift=0
            else:
                t=(p-DUTY)/(1-DUTY)
                # Cubic swing matches backward stance velocity at liftoff and
                # touchdown, avoiding a velocity snap as each hoof changes phase.
                m=-(1-DUTY)/DUTY
                y=STRIDE*(-.5+3*t*t-2*t*t*t+m*(2*t*t*t-3*t*t+t))
                lift=.075*math.sin(math.pi*t)**2
            old=rest_world[name].translation
            # Rest mesh has rear hooves already extended behind the pelvis.
            # Centre the new stride beneath each supporting shoulder/hip, so
            # its endpoints remain reachable without stretching the leg chain.
            support=rest_world[prefix].translation
            centre_y=support.y-(.05 if 'front' in prefix else .08)
            target=Vector((old.x*.82,centre_y+y,-soles[name]+lift+.002))
            chain=[arm.pose.bones[n] for n in [prefix,prefix+'0',prefix+'1',name]]
            errors.append(solve(arm,chain,target,rest_world[name]))
            for _ in range(2):
                pp=skin_points(mesh);actual=min(pp[j].z for j in indices[name]);target.z+=lift+.002-actual
                errors.append(solve(arm,chain,target,rest_world[name]))
            foot_state[name]={'stance':stance,'lift':lift,'target':gltf_vector(target)}
        bpy.context.view_layer.update();pp=skin_points(mesh)
        for name in FEET:
            foot_state[name]['soleMinimum']=min(pp[j].z for j in indices[name])
            foot_state[name]['joint']=gltf_vector(arm.matrix_world@arm.pose.bones[name].head)
        samples.append({'phase':phase,'time':phase*PERIOD,'bounds':bounds([Vector(gltf_vector(p)) for p in pp]),'feet':foot_state,
                        'hips':gltf_vector(arm.matrix_world@hips.head),'head':gltf_vector(arm.matrix_world@arm.pose.bones['head'].head)})
        for b in arm.pose.bones:
            for path in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=path,frame=frame,group=b.name)
        posed={byname[b.name]:arm.matrix_world@b.matrix@corrections[b.name] for b in arm.pose.bones}
        for b in arm.pose.bones:
            n=byname[b.name];parent=parents[n]
            m=(posed[parent] if parent in posed else source_b[parent]).inverted()@posed[n];loc,q,sc=m.decompose();v=[q.x,q.y,q.z,q.w]
            previous=tracks[b.name]['rotation']
            if previous and sum(a*b for a,b in zip(v,previous[-1]))<0:v=[-x for x in v]
            tracks[b.name]['translation'].append(list(loc));tracks[b.name]['rotation'].append(v);tracks[b.name]['scale'].append(list(sc))
        times.append(phase*PERIOD)
    action=arm.animation_data.action;action.name='walk';action.use_fake_user=True
    # glTF import used 24fps. Keep the archived source action's real one-second
    # duration when the editable project uses the authoring rate of 30fps.
    for layer in source_action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.co.x*=30/24;key.handle_left.x*=30/24;key.handle_right.x*=30/24
    imagev=doc['bufferViews'][doc['images'][0]['bufferView']];png=PACK/'source/albedo.png'
    png.write_bytes(binary[imagev.get('byteOffset',0):imagev.get('byteOffset',0)+imagev['byteLength']])
    webp=PACK/'deer-albedo.webp';subprocess.run(['magick',str(png),'-resize','1024x1024>','-quality','90',str(webp)],check=True)
    for material in mesh.data.materials:
        bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Roughness'].default_value=.84
        for socket in ['Emission Color','Emission Strength']:
            for link in list(bsdf.inputs[socket].links):material.node_tree.links.remove(link)
        bsdf.inputs['Emission Strength'].default_value=0
    scene.frame_set(0);scene.frame_end=round(PERIOD*scene.render.fps)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(PACK/'deer.blend'))
    preserved=write_runtime(doc,binary,webp.read_bytes(),fit,tracks,times)
    (PACK/'deformation-samples.json').write_text(json.dumps(samples,indent=2)+'\n')
    manifest={'id':'deer','status':'development-candidate; game and independent review pending',
      'source':{'path':str(SOURCE.relative_to(ROOT)),'bytes':SOURCE.stat().st_size,'sha256':SHA},
      'runtime':{'path':str(OUTPUT.relative_to(ROOT)),'bytes':OUTPUT.stat().st_size,'sha256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest()},
      'builder':'blender/finish_deer.py','shoulderHeightMetres':SHOULDER,'coordinates':'metres, glTF Y-up, front -Z',
      'animation':{'name':'walk','durationSeconds':PERIOD,'fourBeatDuty':DUTY,'strideMetres':STRIDE,
                   'gaitSpeedMetresPerSecond':STRIDE/(DUTY*PERIOD),'maxIKTargetError':max(errors)},
      'triangles':doc['accessors'][doc['meshes'][0]['primitives'][0]['indices']]['count']//3,
      'vertices':doc['accessors'][0]['count'],'joints':len(doc['skins'][0]['joints']),'drawPrimitives':1,
      'texture':{'maxEdge':1024,'format':'WebP','roughness':.84,'metalness':0,'emissive':0},
      'unchangedNonImageBufferViews':preserved,
      'repairs':['Original vertices, indices, normals, UVs, weights and inverse binds preserved byte-for-byte.',
                 'Generic scaled quadruped walk replaced with bind-proportion four-beat hoof-target walk.',
                 'No bone placement or weight edits: inspection did not substantiate a broken bind rig.'],
      'boundsMetres':{'min':[min(s['bounds']['min'][i] for s in samples) for i in range(3)],
                      'max':[max(s['bounds']['max'][i] for s in samples) for i in range(3)]}}
    assert manifest['runtime']['bytes']<=2_000_000 and manifest['triangles']<=20_000
    arm,mesh,_=load_scene(OUTPUT);maximum=0;runtime=[]
    for sample in samples:
        f=sample['time']*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(f),subframe=f%1)
        bb=bounds([Vector(gltf_vector(p)) for p in skin_points(mesh)])
        maximum=max(maximum,max(abs(bb[k][i]-sample['bounds'][k][i]) for k in ['min','max'] for i in range(3)));runtime.append(bb)
    manifest['animation']['reimportBoundsErrorMetres']=maximum
    manifest['animation']['minimumSkinHeightMetres']=min(b['min'][1] for b in runtime)
    assert maximum<.002,maximum
    assert max(errors)<.001,max(errors)
    stance=[f['soleMinimum'] for s in samples for f in s['feet'].values() if f['stance']]
    speed_errors=[]
    for a,b in zip(samples,samples[1:]):
        for name in FEET:
            x,y=a['feet'][name],b['feet'][name]
            if x['stance'] and y['stance']:
                speed=(y['joint'][2]-x['joint'][2])/(b['time']-a['time'])
                speed_errors.append(abs(speed-STRIDE/(DUTY*PERIOD)))
    manifest['animation'].update(stanceSoleMinimumMetres=min(stance),stanceSoleMaximumMetres=max(stance),
      maximumStanceSpeedErrorMetresPerSecond=max(speed_errors),authoredSampleCount=len(samples),
      loopBoundsErrorMetres=max(abs(samples[0]['bounds'][k][i]-samples[-1]['bounds'][k][i]) for k in ['min','max'] for i in range(3)))
    assert max(stance)<.006 and min(stance)>-.002
    for sample in samples:
        planted=[name for name in FEET if sample['feet'][name]['stance']]
        assert len(planted)>=3
    manifest['animation']['footfallOrder']=['backleg2','frontleg2','R_backleg2','R_frontleg2']
    manifest['animation']['minimumSupportHooves']=3
    (PACK/'intake.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'public/models/creatures/deer-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('DEER_RESULT',json.dumps(manifest))
    verify_runtime()
    arm,mesh,_=load_scene(OUTPUT)
    if not args.skip_studio:
        studio(arm,mesh,'after',PERIOD)
        if args.after_only:return
        # Matched material/light/camera comparison: source gait, independently
        # normalized to 1.30m dorsal withers and its cycle's lowest skin point.
        arm,mesh,_=load_scene(SOURCE);s=bpy.context.scene;duration=1.0
        source_samples=[]
        for i in range(49):
            f=i/48*duration*s.render.fps;s.frame_set(int(f),subframe=f%1)
            source_samples.append(skin_points(mesh))
        s.frame_set(0);pp=skin_points(mesh);ch=arm.matrix_world@arm.pose.bones['chest'].head;hp=arm.matrix_world@arm.pose.bones['Hips'].head
        bb=bounds(pp);low=min(p.z for sample in source_samples for p in sample)
        yy=sorted([ch.y,ch.y+(hp.y-ch.y)*.25])
        top=max(p.z for p in pp if abs(p.x-ch.x)<(bb['max'][0]-bb['min'][0])*.2 and yy[0]<=p.y<=yy[1] and p.z<ch.z+(ch.z-low)*.30)
        scale=SHOULDER/(top-low);anchor=Vector(((bb['min'][0]+bb['max'][0])/2,(bb['min'][1]+bb['max'][1])/2,low))
        w=bpy.data.objects.new('Source comparison fit',None);s.collection.objects.link(w)
        for o in [o for o in list(s.objects) if o.parent is None and o!=w]:
            wm=o.matrix_world.copy();o.parent=w;o.matrix_world=wm
        w.matrix_world=Matrix.Rotation(math.pi,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-anchor)
        for material in mesh.data.materials:
            bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Roughness'].default_value=.84
            for socket in ['Emission Color','Emission Strength']:
                for link in list(bsdf.inputs[socket].links):material.node_tree.links.remove(link)
            bsdf.inputs['Emission Strength'].default_value=0
        studio(arm,mesh,'before',duration)

if __name__=='__main__':main()
