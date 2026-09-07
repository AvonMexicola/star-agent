import {test,expect} from '@playwright/test';

test('all passenger cabins share bounded sign textures and the finished room keeps metre-scale material UVs',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?intro=0&debug=1&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.navigation.station.ready);
  const audit=await page.evaluate(()=>{
    const s=starAgent.navigation.station;
    const lifts=[s.hub.lift,...s.pods.map(p=>p.lift)];
    const signs=lifts.map(lift=>{
      const found=[];lift.group.traverse(mesh=>{
        if(!mesh.isMesh||!mesh.name.startsWith('Sign_'))return;
        const map=mesh.material.map;
        found.push({name:mesh.name,id:map.uuid,width:map.image.width,height:map.image.height});
      });return found;
    });
    const floor=s.hub.group.getObjectByName('HubStructure_FinishDeck');
    const uv=floor.geometry.attributes.uv;
    let min=Infinity,max=-Infinity;
    for(let i=0;i<uv.count;i++){min=Math.min(min,uv.getX(i));max=Math.max(max,uv.getX(i));}
    return {finish:s.finishStatus,signs,floorUSpan:max-min,weatherShader:floor.material.onBeforeCompile.toString().includes('surfaceDetail')};
  });
  expect(audit.finish).toBe('ready');expect(audit.signs).toHaveLength(21);
  for(const signs of audit.signs){
    expect(signs).toHaveLength(3);
    for(const sign of signs){expect(Math.max(sign.width,sign.height)).toBeLessThanOrEqual(1024);expect(Math.min(sign.width,sign.height)).toBeGreaterThan(0);}
  }
  const distinct=new Set(audit.signs.flat().map(sign=>sign.id));
  expect(distinct.size).toBe(3);
  expect(audit.floorUSpan).toBeGreaterThanOrEqual(19);
  expect(audit.weatherShader).toBe(false);
  expect(errors).toEqual([]);
});
