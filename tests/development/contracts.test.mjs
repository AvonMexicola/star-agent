import test from 'node:test';
import assert from 'node:assert/strict';
import {safePath,pathPattern,claimOverlap,validateRegistry,localLinks,hygiene,classify,argumentsFor,eventBase} from '../../scripts/development/lib.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const registry=()=>({version:1,fallbackOwner:'@maintainer',areas:[{id:'flight',name:'Flight',maintainer:null,paths:['src/navigation.js','src/flight/**'],contracts:['ARCHITECTURE.md'],checks:['unit','browser','controller']}]});
const task=(id='SA-TEST-001')=>({id,title:'A bounded test',owner:'@contributor',agent:'test',milestone:'M1',status:'active',branch:'feat/test',base:'a'.repeat(40),updated:'2026-09-07',areas:['flight'],claims:['src/flight/'],brief:'docs/briefs/test.md'});
const options={exists:()=>true,milestones:new Set(['M1'])};

test('portable claim paths reject escape/control characters but support subtree claims and spaces',()=>{
  for(const p of ['src/main.js','src/flight/','docs/My Report.md'])assert.equal(safePath(p),true,p);
  for(const p of ['../secret','/etc/passwd','src/../secret','src//thing','src\\main.js','C:/token','./src','src/\nfile','src/*'])assert.equal(safePath(p),false,p);
  assert.equal(safePath('src/**',{glob:true}),true);
});
test('area globs escape punctuation and distinguish shallow from recursive paths',()=>{
  assert.equal(pathPattern('src/*.js').test('src/navigation.js'),true);
  assert.equal(pathPattern('src/*.js').test('src/deep/thing.js'),false);
  assert.equal(pathPattern('src/**').test('src/deep/thing.js'),true);
  assert.equal(pathPattern('src/main.js').test('src/mainXjs'),false);
  assert.equal(claimOverlap('src/flight/','src/flight/model.js'),true);
  assert.equal(claimOverlap('src/flight/','src/flight-effects.js'),false);
});
test('metadata requires real ownership, existing contracts, milestone identity and valid dates',()=>{
  assert.deepEqual(validateRegistry(registry(),[task()],options),[]);
  assert.ok(validateRegistry(registry(),[{...task(),updated:'2026-02-30'}],options).some(s=>s.includes('date')));
  assert.ok(validateRegistry(registry(),[{...task(),milestone:'M99'}],options).some(s=>s.includes('milestone')));
  assert.ok(validateRegistry(registry(),[{...task(),owner:'anonymous agent',base:'main'}],options).some(s=>s.includes('owner')));
  assert.ok(validateRegistry(registry(),[task()],{...options,exists:()=>false}).some(s=>s.includes('contracts')));
  assert.ok(validateRegistry(registry(),[null],options).includes('Malformed task'));
});
test('overlapping active or blocked tasks fail even for one sponsor, while integrated claims are released',()=>{
  const second={...task('SA-TEST-002'),claims:['src/flight/model.js'],status:'blocked'};
  assert.ok(validateRegistry(registry(),[task(),second],options).some(s=>s.includes('Overlapping')));
  assert.deepEqual(validateRegistry(registry(),[task(),{...second,status:'integrated'}],options),[]);
  assert.deepEqual(validateRegistry(registry(),[task(),{...second,status:'proposed'}],options),[]);
  assert.ok(validateRegistry(registry(),[task(),task()],options).some(s=>s.includes('duplicate task')));
});
test('local link targets ignore code examples and remote URLs and decode repository paths',()=>{
  const markdown='[guide](docs/guide.md#part) ![image](<images/My%20Ship.png>) [web](https://example.com/a)\n```md\n[example](missing.md)\n```\n`[literal](no.md)`';
  assert.deepEqual(localLinks(markdown),['docs/guide.md','images/My Ship.png']);
});
test('hygiene catches risky paths and unresolved conflicts without printing file content',()=>{
  for(const p of ['node_modules/a.js','dist/a.js','test-results/trace.zip','.env','server/.env.production','key.pem','source.blend1','core.123'])assert.ok(hygiene(p).length,p);
  for(const p of ['server/.env.example','docs/qa/ship.png','assets/ship.blend','src/keyboard.js'])assert.deepEqual(hygiene(p),[],p);
  assert.ok(hygiene('src/a.js',{text:'<<<<<<< HEAD\nprivate content\n>>>>>>> feature'}).some(s=>s.includes('merge marker')));
  assert.ok(hygiene('asset.glb',{size:100*1024*1024+1}).length);
  assert.equal(hygiene('src/a.js',{text:'<<<<<<< HEAD\nprivate content'}).join('').includes('private content'),false);
});
test('check plans require browser/server work for runtime or workflow changes and retain unknown paths',()=>{
  const r=registry();
  assert.equal(classify(['docs/readme.md'],r).browser,false);
  const p=classify(['src/navigation.js'],r);assert.deepEqual(p.areas,['flight']);assert.ok(p.checks.includes('controller'));assert.equal(p.multiplayer,true);
  assert.equal(classify(['.github/workflows/checks.yml'],r).browser,true);
  assert.equal(classify(['scripts/ci-browser.config.js'],r).browser,true);
  assert.equal(classify(['playwright.config.js'],r).browser,true);
  assert.equal(classify(['tests/browser/journey.spec.js'],r).browser,true);
  assert.equal(classify(['tests/server-auth.test.js'],r).multiplayer,true);
  assert.equal(classify(['tests/remote-players.test.js'],r).multiplayer,true);
  assert.equal(classify(['scripts/development/plan.mjs'],r).multiplayer,true);
  assert.equal(classify(['scripts/development/plan.mjs'],r).browser,true);
  assert.deepEqual(classify(['unknown.dat'],r).unclassified,['unknown.dat']);
});
test('CLI options reject ambiguous flags and event parsing never treats payload prose as commands',()=>{
  assert.throws(()=>argumentsFor(['--force'],['--base']),/Unknown/);
  assert.throws(()=>argumentsFor(['--base','--json'],['--base','--json']),/Missing/);
  const dir=mkdtempSync(join(tmpdir(),'star-agent-policy-'));
  try{
    const file=join(dir,'event.json');writeFileSync(file,JSON.stringify({before:'0'.repeat(40),pull_request:{base:{sha:'b'.repeat(40)},body:'$(touch injected)'}}));
    assert.equal(eventBase(file),'b'.repeat(40));
    writeFileSync(file,JSON.stringify({before:'0'.repeat(40)}));assert.equal(eventBase(file),null);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
