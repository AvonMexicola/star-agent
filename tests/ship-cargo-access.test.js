import test from 'node:test';
import assert from 'node:assert/strict';
import {shipCargoAccess, SHIP_CARGO_RANGE} from '../src/inventory/ship-access.js';

const point = (x=0,y=0,z=0) => ({x,y,z});
test('cargo uses the live three-dimensional 50 m boundary, including in EVA', () => {
  const nav={mode:'walk',position:point(30,40),shipPosition:point(),enabled:false};
  assert.equal(SHIP_CARGO_RANGE,50);
  assert.equal(shipCargoAccess(nav).available,true);
  nav.position.y+=.001;
  assert.equal(shipCargoAccess(nav).available,false);
  nav.mode='eva';nav.position=point(0,0,50);
  assert.equal(shipCargoAccess(nav).available,true);
  nav.shipPosition.z=-1;
  assert.equal(shipCargoAccess(nav).available,false,'moving ship revokes existing access');
});
test('cargo preserves world precision and fails closed without a valid ship', () => {
  const nav={mode:'walk',position:point(25_000_000_050.01),shipPosition:point(25_000_000_000)};
  assert.equal(shipCargoAccess(nav).available,false);
  nav.position.x-=.02;
  assert.equal(shipCargoAccess(nav).available,true);
  for(const shipPosition of [null,undefined,{},point(NaN),point(Infinity)]) {
    assert.equal(shipCargoAccess({...nav,shipPosition}).available,false);
  }
  assert.equal(shipCargoAccess({...nav,position:null}).available,false);
});
test('seated and cabin access works without a parked origin, crashed access never does', () => {
  for(const nav of [{mode:'flight'},{mode:'landed'},{mode:'walk',insideShip:true}]) {
    assert.equal(shipCargoAccess(nav).aboard,true);
    assert.equal(shipCargoAccess(nav).available,true);
  }
  assert.equal(shipCargoAccess({mode:'crashed',insideShip:true}).available,false);
  assert.equal(shipCargoAccess({mode:'unknown',position:point(),shipPosition:point()}).available,false);
});
test('a hull without a hold and a stellar-destroyed hull cannot expose cargo',()=>{
 for(const mode of ['flight','landed','walk','eva'])assert.equal(shipCargoAccess({shipId:'kestrel',mode,insideShip:true,position:point(),shipPosition:point()}).available,false);
 assert.equal(shipCargoAccess({mode:'destroyed',insideShip:true}).available,false);
});
test('a sealed rover uses actual carrier distance instead of its cabin flag', () => {
  for (const shipId of ['nomad', 'atlas']) {
    const nav = {shipId, mode: 'walk', insideShip: true, roverOccupied: true,
      position: point(30, 40), shipPosition: point()};
    assert.deepEqual(shipCargoAccess(nav), {available: true, aboard: false, distance: 50, range: 50});
    nav.position.y += .01;
    assert.equal(shipCargoAccess(nav).available, false);
    nav.position = point(2_000, 3_000, 4_000);
    assert.equal(shipCargoAccess(nav).available, false, 'parked ship cargo is unavailable from a distant rover');
    nav.shipPosition = null;
    assert.equal(shipCargoAccess(nav).available, false, 'a cabin flag cannot substitute for the carrier position');
    nav.roverOccupied = false;
    assert.equal(shipCargoAccess(nav).aboard, true, 'ordinary ship cabin access is retained');
  }
});
