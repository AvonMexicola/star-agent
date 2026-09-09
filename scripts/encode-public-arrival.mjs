// Edit one completed, continuous game take. Time compression never changes game physics.
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile),dir='test-results/arrival-capture';
const data=JSON.parse(await readFile(`${dir}/journey.json`,'utf8'));
if(data.finalMode!=='landed'||data.errors.length||data.bad.length||data.api.length)throw Error('A clean completed landing is required before producing public media.');
const markers=Object.fromEntries(data.markers.map(m=>[m.name,m.seconds]));
const sections=[
  ['recording-start','descent-start',1,'RELATIVISTIC ARRIVAL  /  1x'],
  ['descent-start','braked',6,'DESCENT  /  6x'],
  ['braked','levelled',1,'FINAL APPROACH  /  1x'],
  ['levelled','landing-assist',4,'APPROACH  /  4x'],
  ['landing-assist','touchdown',3,'LANDING  /  3x'],
  ['touchdown','recording-end',1,'TOUCHDOWN  /  1x'],
];
const filters=[`[0:v]split=${sections.length}${sections.map((_,i)=>`[s${i}]`).join('')}`];
let duration=0;
const edit=sections.map(([start,end,speed,label],i)=>{
  const from=markers[start],to=markers[end];
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)throw Error(`Missing/invalid phase: ${start}`);
  const font="font='sans-serif':fontsize=18:fontcolor=white:x=24:y=h-44:box=1:boxcolor=0x071019@0.72:boxborderw=10";
  filters.push(`[s${i}]trim=start=${from}:end=${to},setpts=(PTS-STARTPTS)/${speed},scale=1280:800,setsar=1,fps=30,drawtext=${font}:text='${label}'[v${i}]`);
  const section={from,to,speed,label,outputStart:duration};duration+=(to-from)/speed;return section;
});
filters.push(`${sections.map((_,i)=>`[v${i}]`).join('')}concat=n=${sections.length}:v=1:a=0[out]`);
await exec('ffmpeg',['-v','error','-y','-i',`${dir}/nomad-aeon-raw.webm`,'-filter_complex',filters.join(';'),'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart','site/media/nomad-aeon-arrival.mp4'],{maxBuffer:4*1024*1024});
await exec('ffmpeg',['-v','error','-y','-ss',String(markers['levelled']+.2),'-i',`${dir}/nomad-aeon-raw.webm`,'-frames:v','1','-vf','scale=1280:800','-c:v','libwebp','-quality','90','site/media/nomad-aeon-arrival.webp']);
await exec('ffmpeg',['-v','error','-y','-i','site/media/nomad-aeon-arrival.mp4','-vf',`fps=1/${duration/8},scale=480:300,tile=2x4`,'-frames:v','1',`${dir}/contact-sheet.jpg`]);
await writeFile(`${dir}/edit.json`,JSON.stringify({duration,sections:edit,source:'nomad-aeon-raw.webm',output:'site/media/nomad-aeon-arrival.mp4'},null,2));
console.log(`Encoded ${duration.toFixed(2)} s from one continuous take; speeds 1x–6x.`);
