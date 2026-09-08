import test from 'node:test';import assert from 'node:assert/strict';
import {controllerHints} from '../src/controller-hints.js';
const hints=options=>Object.fromEntries(controllerHints(options));
test('controller hints distinguish owned site, outside claim, cabin, flight and EVA',()=>{
 assert.equal(hints({mode:'walk',canBuild:true}).B,'BUILD WHEEL');assert.equal(hints({mode:'walk'}).B,'BUILD · NEED MAINFRAME');
 assert.equal(hints({mode:'walk',insideShip:true}).B,undefined);assert.equal(hints({mode:'walk',insideShip:true}).X,'INTERACT');
 assert.equal(hints({mode:'flight'}).LT,'BRAKE');assert.equal(hints({mode:'flight'}).RT,'FIRE');assert.equal(hints({mode:'flight'})['A / B'],'UP / DOWN');
 assert.equal(hints({mode:'eva'})['A / B'],'RISE / LOWER');assert.equal(hints({mode:'landed'}).Y,'LAUNCH');
});
test('hands-free concourse hints retain walking, interaction and inventory without fire or draw bindings',()=>{
 const h=hints({mode:'walk',handsFree:true,tool:'rifle-laser'});
 assert.equal(h.X,'INTERACT');assert.equal(h.VIEW,'BACKPACK');assert.equal(h.RT,undefined);assert.equal(h['D-PAD ← / →'],undefined);assert.equal(h.B,undefined);
});
