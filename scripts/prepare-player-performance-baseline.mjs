import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const ref = process.env.PLAYER_PERFORMANCE_BASE || '4706d62e92c002ce5a326c53cd8ee9ac07543645';
if (!/^[a-f0-9]{7,40}$/i.test(ref)) throw Error('PLAYER_PERFORMANCE_BASE must be a commit hash');
mkdirSync('.performance-baseline', { recursive: true });
const archive = execFileSync('git', ['archive', ref, 'src'], { maxBuffer: 16 * 1024 * 1024 });
execFileSync('tar', ['-x', '-C', '.performance-baseline'], { input: archive });
writeFileSync('.performance-baseline/commit', `${ref}\n`);
