import test from 'node:test';
import assert from 'node:assert/strict';
import {PIECES,sampleLocalSupport} from '../src/build/definitions.js';
import {attachedPanels,panelEdges,wallCandidates,wallOnPanel,structuralReason,footprint} from '../src/build/structure.js';
import {polygonsOverlap,rayPrism} from '../src/build/polygons.js';
import {getWorldBoxes,constrainBuildStep} from '../src/build/collision.js';
const piece=(type,position=[0,0,0],rotation=0,id=type)=>({type,position,rotation,id,doorOpen:false});
test('equilateral triangle sides accept full walls and join square edges without overlap',()=>{
 const square=piece('foundation');
 const candidates=attachedPanels('foundation-triangle',square);assert.equal(candidates.length,12);
 for(const candidate of candidates){const triangle=piece('foundation-triangle',candidate.position,candidate.rotation);assert.equal(polygonsOverlap(footprint(square),footprint(triangle)),false);const walls=wallCandidates('wall',[triangle]);assert.equal(walls.length,3);for(const wall of walls)assert.ok(wallOnPanel(piece('wall',wall.position,wall.rotation),triangle));for(const edge of panelEdges(triangle))assert.ok(Math.abs(Math.hypot(edge.a[0]-edge.b[0],edge.a[1]-edge.b[1])-4)<1e-9);}
});
test('triangle and quarter slab empty corners have no invisible support or ray collision',()=>{
 for(const [type,x,z]of [['foundation-triangle',1.9,2],['foundation-quarter',1.8,1.8]]){
  const p=piece(type);assert.equal(sampleLocalSupport(type,x,z),null);assert.equal(getWorldBoxes(p).some(b=>rayPrism({x,y:2,z},{x:0,y:-1,z:0},b)!==null),false);
  const step=constrainBuildStep([x,1.65,z],[x+.02,1.64,z], [p]);assert.equal(step.grounded,false);
 }
});
test('curved glazing supports a matching curved roof and has a genuinely empty interior',()=>{
 const base=piece('foundation-quarter'),wall=piece('window-quarter'),roof=piece('floor-quarter',[0,3,0]);
 assert.equal(structuralReason(wall,[base]),null);assert.equal(structuralReason(roof,[base,wall]),null);
 const ray=(x,z,dx,dz)=>getWorldBoxes(wall).some(b=>rayPrism({x,y:1.6,z},{x:dx,y:0,z:dz},b)!==null);
 assert.equal(ray(-1,-1,1,1),true);assert.equal(ray(-1,-1,-1,0),false);
});
test('rotated walls block their actual footprint while allowing empty AABB corners',()=>{
 const w=piece('wall',[0,0,0],Math.PI/3);const result=constrainBuildStep([1.8,1.65,1.8],[1.9,1.65,1.8],[w]);assert.equal(result.hit,false);
});
test('hangar curtain clears the Nomad and retracts inside its own header envelope',()=>{
 const p=piece('hangar-door'),closed=getWorldBoxes(p,false),open=getWorldBoxes(p,true);
 const hit=b=>rayPrism({x:5.9,y:4.5,z:2},{x:0,y:0,z:-1},b)!==null;
 assert.ok(closed.some(hit));assert.equal(open.some(hit),false);
 assert.ok(open.every(b=>b.min[0]>=-8&&b.max[0]<=8&&b.max[1]<=6));
});

test('small and medium pads fit Nomad; only the large pad fits the current full-size Atlas with clearance',async()=>{
 const {SHIP_LAYOUT}=await import('../src/boarding.js'),{FREIGHTER_LAYOUT}=await import('../src/freighter-layout.js');
 const fits=(id,layout)=>{const [width,length]=PIECES[id].footprint;return width>layout.flightBounds.max[0]-layout.flightBounds.min[0]+2&&length>layout.flightBounds.max[2]-layout.flightBounds.min[2]+2;};
 for(const [id,layout]of [['foundation-pad-small',SHIP_LAYOUT],['foundation-pad-medium',SHIP_LAYOUT],['foundation-pad-large',FREIGHTER_LAYOUT]]){
  assert.equal(fits(id,layout),true,`${id} leaves more than1m around the complete ${layout===SHIP_LAYOUT?'Nomad':'Atlas'} envelope`);
 }
 assert.equal(fits('foundation-pad-small',FREIGHTER_LAYOUT),false);
 assert.equal(fits('foundation-pad-medium',FREIGHTER_LAYOUT),false,'the retired medium-Atlas assignment cannot return silently');
 assert.deepEqual(PIECES['foundation-pad-large'].footprint,[48,72],'full Atlas support needs no pad geometry resize');
});

test('stacked walls enclose a double-height hangar without an intermediate floor',()=>{
 const base=piece('foundation'),lower=piece('wall',[0,0,2],0,'lower'),upper=piece('window',[0,3,2],0,'upper'),roof=piece('floor',[0,6,0]);assert.equal(structuralReason(upper,[base,lower]),null);assert.equal(structuralReason(roof,[base,lower,upper]),null);assert.notEqual(structuralReason(upper,[lower]),null);
});
