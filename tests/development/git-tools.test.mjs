import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {changedPaths,git} from '../../scripts/development/lib.mjs';
const branchTool=resolve('scripts/development/branches.mjs');
const checkTool=resolve('scripts/development/check.mjs'),planTool=resolve('scripts/development/plan.mjs');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'star-agent-git-'));
 git(['init','-q'],root);git(['config','user.name','Star Agent test fixture'],root);git(['config','user.email','test@example.invalid'],root);
 mkdirSync(join(root,'project/tasks'),{recursive:true});writeFileSync(join(root,'base.txt'),'base\n');
 git(['add','.'],root);git(['commit','-qm','baseline'],root);git(['branch','dev/all-features'],root);
 return root;
}
test('changed paths include committed, staged, unstaged, deleted and new files including spaces',()=>{
 const root=fixture();
 try{
  writeFileSync(join(root,'committed.txt'),'one');git(['add','.'],root);git(['commit','-qm','feature'],root);
  writeFileSync(join(root,'staged.txt'),'two');git(['add','staged.txt'],root);
  writeFileSync(join(root,'committed.txt'),'updated');rmSync(join(root,'base.txt'));
  writeFileSync(join(root,'new file.txt'),'new');
  assert.deepEqual(changedPaths(root,'dev/all-features'),['base.txt','committed.txt','new file.txt','staged.txt']);
  assert.throws(()=>changedPaths(root,'--bad-ref'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
function policyFixture(root){
 writeFileSync(join(root,'ROADMAP.md'),'# Roadmap\n\n### M0 — Contributor foundation\n');
 writeFileSync(join(root,'CONTRIBUTING.md'),'Read [the roadmap](ROADMAP.md).\n');
 writeFileSync(join(root,'project/areas.json'),JSON.stringify({version:1,fallbackOwner:'@test-owner',areas:[
  {id:'integration',name:'Integration',maintainer:null,paths:['docs/**','*.md'],contracts:['ROADMAP.md'],checks:['repository']}
 ]}));
}
test('repository CLI blocks missing links, secret file paths and escaping symlinks without reading their contents',()=>{
 const root=fixture(),outside=mkdtempSync(join(tmpdir(),'star-agent-external-'));
 const run=()=>execFileSync(process.execPath,[checkTool],{cwd:root,encoding:'utf8',stdio:'pipe'});
 try{
  policyFixture(root);assert.match(run(),/Repository checks passed/);
  writeFileSync(join(root,'CONTRIBUTING.md'),'Read [missing](not-there.md).');
  assert.throws(run,error=>error.stderr.includes('missing or outside-repo link target not-there.md'));
  writeFileSync(join(root,'CONTRIBUTING.md'),'Read [the roadmap](ROADMAP.md).');
  writeFileSync(join(root,'.env'),'PRIVATE_FIXTURE_VALUE=do-not-print');
  assert.throws(run,error=>error.stderr.includes('Environment file')&&!error.stderr.includes('do-not-print'));
  rmSync(join(root,'.env'));
  writeFileSync(join(outside,'private.md'),'[private-target](private-fixture-name.md)');
  rmSync(join(root,'CONTRIBUTING.md'));symlinkSync(join(outside,'private.md'),join(root,'CONTRIBUTING.md'));
  assert.throws(run,error=>error.stderr.includes('symlink escapes')&&!error.stderr.includes('private-fixture-name'));
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('CI planner runs full checks without a diff base and safely skips optional jobs for a known docs-only PR',()=>{
 const root=fixture(),eventDir=mkdtempSync(join(tmpdir(),'star-agent-event-'));
 try{
  policyFixture(root);git(['add','.'],root);git(['commit','-qm','policy'],root);
  const base=git(['rev-parse','HEAD'],root).trim();
  writeFileSync(join(root,'CONTRIBUTING.md'),'Updated contributor prose.');
  const event=join(eventDir,'event.json'),output=join(eventDir,'output');
  const run=name=>JSON.parse(execFileSync(process.execPath,[planTool,'--ci','--json'],{cwd:root,encoding:'utf8',
    env:{...process.env,GITHUB_EVENT_NAME:name,GITHUB_EVENT_PATH:event,GITHUB_OUTPUT:output}}));
  writeFileSync(event,JSON.stringify({before:'0'.repeat(40)}));
  let result=run('push');assert.equal(result.browser,true);assert.equal(result.multiplayer,true);
  writeFileSync(output,'');writeFileSync(event,JSON.stringify({pull_request:{base:{sha:base},title:'$(touch injected)'}}));
  result=run('pull_request');assert.equal(result.browser,false);assert.equal(result.multiplayer,false);
  assert.equal(readFileSync(output,'utf8'),'browser=false\nmultiplayer=false\n');
  assert.equal(existsSync(join(root,'injected')),false);
  result=run('workflow_dispatch');assert.equal(result.browser,true);assert.equal(result.multiplayer,true);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(eventDir,{recursive:true,force:true});}
});
test('branch inventory reports ancestry and current worktree while preserving refs and worktree state',()=>{
 const root=fixture();
 try{
  writeFileSync(join(root,'feature.txt'),'one');git(['add','.'],root);git(['commit','-qm','feature'],root);
  writeFileSync(join(root,'dirty.txt'),'uncommitted');
  const before=git(['show-ref'],root),status=git(['status','--porcelain'],root);
  const data=JSON.parse(execFileSync(process.execPath,[branchTool,'--base','dev/all-features','--json'],{cwd:root,encoding:'utf8'}));
  assert.ok(data.branches.some(b=>b.ahead===1&&b.worktree===root));assert.ok(data.branches.some(b=>b.contained));
  assert.equal(git(['show-ref'],root),before);assert.equal(git(['status','--porcelain'],root),status);
  assert.throws(()=>execFileSync(process.execPath,[branchTool,'--base','$(touch injected)'],{cwd:root,stdio:'pipe'}));
  assert.equal(existsSync(join(root,'injected')),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
