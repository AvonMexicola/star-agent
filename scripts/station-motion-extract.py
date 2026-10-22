#!/usr/bin/env python3
"""Extract labelled 10 Hz presentation samples from a retained Playwright WebM.
QA-only resampling/thumbnail assembly; source video is never modified.
"""
import argparse, json, subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--video',required=True);p.add_argument('--start',type=float,required=True)
p.add_argument('--seconds',type=float,required=True);p.add_argument('--name',required=True)
p.add_argument('--out',default='/tmp/star-agent-shop-motion')
p.add_argument('--font',help='ImageMagick font name or font file; default resolves sans with fontconfig.')
a=p.parse_args()
font=a.font or subprocess.check_output(['fc-match','-f','%{file}','sans'],text=True).strip()
if not font:p.error('No sans font found; supply --font.')
if a.start<0 or a.seconds<=0 or not a.name.replace('-','').replace('_','').isalnum():p.error('Use a nonnegative start, positive duration and simple window name.')
out=Path(a.out)/'windows'/a.name
if out.exists():p.error('Window output already exists; choose a new --out or --name to preserve evidence.')
out.mkdir(parents=True)
frames=out/'frames';frames.mkdir(exist_ok=True)
probe=subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',a.video],check=True,capture_output=True,text=True)
cmd=['ffmpeg','-hide_banner','-loglevel','info','-threads','1','-ss',str(a.start),'-i',a.video,'-t',str(a.seconds),'-an','-vf','fps=10,showinfo','-threads','1',str(frames/'frame-%04d.png')]
with (out/'ffmpeg.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=subprocess.STDOUT)
files=sorted(frames.glob('frame-*.png'));sheets=[]
for offset in range(0,len(files),20):
    args=['magick','montage','-background','white','-fill','black','-font',font,'-pointsize','16']
    for index,path in enumerate(files[offset:offset+20],offset):
        t=a.start+index/10
        args+=['-label',f'{a.name} | {int(t//60):02d}:{t%60:04.1f} | sample {index+1}',str(path)]
    sheet=out/f'contact-{offset//20+1:02d}.png'
    args+=['-thumbnail','360x225','-tile','4x5','-geometry','360x225+4+4',str(sheet)]
    subprocess.run(args,check=True);sheets.append(str(sheet))
record={'sourceVideo':str(Path(a.video).resolve()),'ffprobe':json.loads(probe.stdout),'name':a.name,'startSeconds':a.start,'durationRequestedSeconds':a.seconds,
 'samplingHz':10,'classification':'Presentation samples from decoded WebM, selected by ffmpeg fps=10. Labels identify the 0.1 s extraction grid, not an audit of every original rendered frame.',
 'command':cmd,'frameCount':len(files),'sheets':sheets}
(out/'window.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['name','startSeconds','durationRequestedSeconds','frameCount','sheets']}))
