import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devLaunchOptions,devLaunchURL,DEV_SHIPS,DEV_LOCATIONS} from '../src/dev-launch-options.js';
import {testFlightStorage} from '../src/test-flight.js';

test('public entry ignores local launch parameters; invalid choices fall back safely',()=>{
  assert.equal(devLaunchOptions('?dev=1&ship=atlas&start=star',false),null);
  assert.deepEqual(devLaunchOptions('?dev=1&ship=unknown&start=missing',true),{ship:'nomad',location:'hangar',autoStart:false});
});
test('every local ship and destination survives a shareable URL without dropping its seed',()=>{
  for(const ship of DEV_SHIPS)for(const location of DEV_LOCATIONS){
    const url=new URL(devLaunchURL('http://127.0.0.1:5178/?seed=7291',{ship:ship.id,location:location.id}));
    assert.equal(url.searchParams.get('seed'),'7291');
    assert.deepEqual(devLaunchOptions(url.search,true),{ship:ship.id,location:location.id,autoStart:true});
  }
  assert.throws(()=>devLaunchURL('https://example.test/',{ship:'bad',location:'hangar'}));
});
test('test progress is isolated for each launch',()=>{
  const first=testFlightStorage(),second=testFlightStorage();first.setItem('fleet','atlas');
  assert.equal(first.getItem('fleet'),'atlas');assert.equal(second.getItem('fleet'),null);
});
test('leaving the exterior overview launches the requested location and retains the reviewed shell',()=>{
  const url=new URL(devLaunchURL('http://127.0.0.1:5178/?dev=1&seed=7291&stationExterior=1&exteriorView=overview',{ship:'nomad',location:'hangar'}));
  assert.equal(url.searchParams.has('exteriorView'),false);
  assert.equal(url.searchParams.get('stationExterior'),'1');
  assert.equal(devLaunchOptions(url.search,true).location,'hangar');
});
