import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const ROOT=path.resolve(process.env.ROVER_REVIEW_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
export const ASSET=path.join(ROOT,'public/models/mining-rover.glb');
export const LAYOUT=path.join(ROOT,'assets/mining-rover/layout.json');
export const HUMAN_ASSET=path.join(ROOT,'public/models/props/mannequin.glb');
export const EXPECTED_SHA=process.env.ROVER_EXPECTED_SHA||'0ce536332a9e1b29d89d29981e510739c975cd739514cfe1e9e0b810120617fb';
export const EXPECTED_HUMAN_SHA='8a46b5b09f0659661a0e4373db159f9b87d43136144e118e908265f45ba6a52d';
export function outputPath(name=''){
 if(!process.env.ROVER_REVIEW_OUT)throw Error('Set ROVER_REVIEW_OUT to an external evidence directory.');
 const out=path.resolve(process.env.ROVER_REVIEW_OUT);
 if(out===ROOT||out.startsWith(ROOT+path.sep))throw Error('Generated review evidence must stay outside the repository.');
 fs.mkdirSync(out,{recursive:true});return path.join(out,name);
}
export const isMain=url=>Boolean(process.argv[1]&&url===pathToFileURL(path.resolve(process.argv[1])).href);
