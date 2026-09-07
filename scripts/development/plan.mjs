import {readFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {repoRoot,argumentsFor,changedPaths,eventBase,classify} from './lib.mjs';
try{
  const args=argumentsFor(process.argv.slice(2),['--base','--json','--ci']),root=repoRoot();
  const registry=JSON.parse(readFileSync(resolve(root,'project/areas.json'),'utf8'));
  const base=args.base??(args.ci?eventBase(process.env.GITHUB_EVENT_PATH):null);
  const plan=classify(changedPaths(root,base),registry);
  // A dispatch or first push has no trustworthy diff base: run the full baseline.
  if(args.ci&&(!base||process.env.GITHUB_EVENT_NAME==='workflow_dispatch')){
    plan.browser=true;plan.multiplayer=true;
    plan.checks=[...new Set([...plan.checks,'unit','build','browser','multiplayer','database'])].sort();
  }
  if(args.ci&&process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`browser=${plan.browser}\nmultiplayer=${plan.multiplayer}\n`);
  if(args.json)console.log(JSON.stringify(plan,null,2));
  else {
    console.log(`Changed paths: ${plan.paths.length}\nAreas: ${plan.areas.join(', ')||'documentation/unmapped'}\nSuggested checks: ${plan.checks.join(', ')}`);
    console.log('Read: '+(plan.contracts.join(', ')||'CONTRIBUTING.md and QUALITY.md'));
    if(plan.unclassified.length)console.log('Unclassified paths need manual review: '+plan.unclassified.join(', '));
    console.log('This is a plan, not a test result. Use docs/development/testing.md; add checks for actual risk and shared dependencies.');
  }
}catch(error){console.error('Could not plan checks: '+error.message);process.exitCode=1;}
