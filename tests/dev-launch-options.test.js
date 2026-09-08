import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devLaunchOptions,flightEntryOptions,devLaunchURL,DEV_SHIPS,DEV_LOCATIONS} from '../src/dev-launch-options.js';
import {testFlightStorage} from '../src/test-flight.js';
import {Fleet,FLEET_KEY} from '../src/fleet.js';

test('builds without scene tools ignore launch parameters; invalid choices fall back safely',()=>{
  assert.equal(devLaunchOptions('?dev=1&ship=atlas&start=star',false),null);
  assert.deepEqual(devLaunchOptions('?dev=1&ship=unknown&start=missing',true),{ship:'nomad',location:'hangar',autoStart:false});
});
test('solo and development defaults enter the Nomad hangar introduction in a temporary session',()=>{
  for(const search of ['', '?dev=1', '?seed=7291&debug', '?ship=unknown&start=missing']){
    const entry=flightEntryOptions(search,true);
    assert.deepEqual(entry.devOptions,{ship:'nomad',location:'hangar',autoStart:false});
    assert.equal(entry.testFlight,true,'practice inventory stays separate even when the introduction runs');
    assert.equal(entry.introEnabled,true,'the opening owns the initial shoulder camera and walking spawn');
    assert.equal(entry.sandboxEnabled,false);
  }
});
test('a default scene session does not replace a saved Atlas outside the practice store',()=>{
  const saved=JSON.stringify({version:1,active:'atlas',surfaceVisited:true,unlocked:true});
  const browserStorage=testFlightStorage([[FLEET_KEY,saved]]);
  const entry=flightEntryOptions('',true);
  const practice=new Fleet(entry.testFlight?testFlightStorage():browserStorage);
  practice.active=entry.devOptions.ship;practice.record('selection');
  assert.equal(practice.active,'nomad');
  assert.equal(browserStorage.getItem(FLEET_KEY),saved);
  const normal=flightEntryOptions('',false);
  assert.equal(normal.devOptions,null,'normal and multiplayer entry do not choose a local scene');
  assert.equal(normal.testFlight,false);
  assert.equal(normal.introEnabled,true);
  assert.equal(new Fleet(browserStorage).active,'atlas');
});
test('explicit scene links retain their requested setup and skip the default opening',()=>{
  for(const ship of DEV_SHIPS)for(const location of DEV_LOCATIONS){
    const url=new URL(devLaunchURL('https://example.test/',{ship:ship.id,location:location.id}));
    const entry=flightEntryOptions(url.search,true);
    assert.equal(entry.devOptions.ship,location.ship??ship.id);
    assert.equal(entry.devOptions.location,location.id);
    assert.equal(entry.devOptions.autoStart,true);
    assert.equal(entry.testFlight,true);
    assert.equal(entry.introEnabled,false,'practice setup remains authoritative for explicit starts');
  }
  assert.equal(flightEntryOptions('?dev=1&start=hangar&intro=1',true).introEnabled,false);
  assert.equal(flightEntryOptions('?intro=0',true).introEnabled,false,'an explicit intro opt-out remains available');
  assert.equal(flightEntryOptions('?ship=atlas',true).devOptions.ship,'atlas','an explicit hull request is preserved');
  assert.equal(flightEntryOptions('?ship=atlas',true).introEnabled,false);
});
test('the entry policy preserves construction, legacy Kestrel and shared-flight boundaries',()=>{
  for(const devTools of [false,true]){
    const sandbox=flightEntryOptions('?sandbox=build',devTools);
    assert.equal(sandbox.sandboxEnabled,true);assert.equal(sandbox.introEnabled,false);
  }
  const meadow=flightEntryOptions('?dev=1&start=atlas-meadow&sandbox=build',true);
  assert.equal(meadow.atlasMeadowStart,true);assert.equal(meadow.sandboxEnabled,false);
  assert.equal(meadow.devOptions.ship,'atlas');assert.equal(meadow.introEnabled,false);
  const legacy=flightEntryOptions('?ship=kestrel',false);
  assert.equal(legacy.testFlight,true);assert.equal(legacy.introEnabled,false);
  const shared=flightEntryOptions('?dev=1&ship=atlas&start=rover-surface',false);
  assert.equal(shared.devOptions,null);assert.equal(shared.testFlight,false);assert.equal(shared.introEnabled,true);
});
test('every local ship and destination survives a shareable URL without dropping its seed',()=>{
  for(const ship of DEV_SHIPS)for(const location of DEV_LOCATIONS){
    const url=new URL(devLaunchURL('http://127.0.0.1:5178/?seed=7291',{ship:ship.id,location:location.id}));
    assert.equal(url.searchParams.get('seed'),'7291');
    assert.deepEqual(devLaunchOptions(url.search,true),{ship:location.ship??ship.id,location:location.id,autoStart:true});
  }
  assert.throws(()=>devLaunchURL('https://example.test/',{ship:'bad',location:'hangar'}));
});
test('test progress is isolated for each launch',()=>{
  const first=testFlightStorage(),second=testFlightStorage();first.setItem('fleet','atlas');
  assert.equal(first.getItem('fleet'),'atlas');assert.equal(second.getItem('fleet'),null);
});
test('ground mining is an explicit local start for every selected hull without a cargo-lift flag',()=>{
  assert.ok(DEV_LOCATIONS.some(location=>location.id==='rover-surface'&&location.name==='Burrow mining — Selene surface'));
  for(const ship of DEV_SHIPS){
    const url=new URL(devLaunchURL('http://127.0.0.1:5178/?rover=1&seed=7291',{ship:ship.id,location:'rover-surface'}));
    assert.equal(url.searchParams.has('rover'),false);
    assert.equal(url.searchParams.get('intro'),'0');
    assert.deepEqual(devLaunchOptions(url.search,true),{ship:ship.id,location:'rover-surface',autoStart:true});
    assert.equal(devLaunchOptions(url.search,false),null,'public entry cannot enable a development teleport');
  }
});
test('leaving the exterior overview launches the requested location and retains the reviewed shell',()=>{
  const url=new URL(devLaunchURL('http://127.0.0.1:5178/?dev=1&seed=7291&stationExterior=1&exteriorView=overview',{ship:'nomad',location:'hangar'}));
  assert.equal(url.searchParams.has('exteriorView'),false);
  assert.equal(url.searchParams.get('stationExterior'),'1');
  assert.equal(devLaunchOptions(url.search,true).location,'hangar');
});


test('the meadow is a complete Atlas and Burrow preset with its reviewed terrain seed',()=>{
  for(const ship of DEV_SHIPS){
    const url=new URL(devLaunchURL('http://127.0.0.1:5178/?seed=42&rover=1&meadow=1&exteriorView=overview&sandbox=build&cargo-test=1',{ship:ship.id,location:'atlas-meadow'}));
    assert.equal(url.searchParams.get('ship'),'atlas');
    assert.equal(url.searchParams.get('seed'),'7291');
    for(const key of ['rover','meadow','exteriorView','sandbox','cargo-test'])assert.equal(url.searchParams.has(key),false);
    assert.deepEqual(devLaunchOptions(url.search,true),{ship:'atlas',location:'atlas-meadow',autoStart:true});
    assert.equal(devLaunchOptions(url.search,false),null);
  }
  assert.equal(devLaunchOptions('?dev=1&start=atlas-meadow&ship=nomad',true).ship,'atlas','direct links select the required hull');
  const next=new URL(devLaunchURL('http://127.0.0.1:5178/?start=atlas-meadow&seed=7291&meadow=1',{ship:'kestrel',location:'forest'}));
  assert.deepEqual(devLaunchOptions(next.search,true),{ship:'kestrel',location:'forest',autoStart:true});
  assert.equal(next.searchParams.has('meadow'),false,'leaving the scene does not retain its old trigger');
});
