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

test('shop print resources stay shared and bounded, and missing artwork preserves the playable finish',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const fallback of [false,true]){
    if(fallback)await page.route('**/textures/station/shop-*.webp',route=>route.abort());
    await page.goto('/?intro=0&debug=1&seed=7291');
    await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.navigation.station.ready);
    const audit=await page.evaluate(()=>{
      const s=starAgent.navigation.station,group=s.hub.group.getObjectByName('Shop retail graphics');
      const meshes=[],maps=new Map();
      group?.traverse(mesh=>{
        if(!mesh.isMesh)return;
        meshes.push({name:mesh.name,castShadow:mesh.castShadow});
        for(const key of ['map','bumpMap','roughnessMap']){
          const map=mesh.material[key];
          if(map)maps.set(map.uuid,{width:map.image.width,height:map.image.height});
        }
      });
      return {finish:s.finishStatus,status:group?.userData.shopGraphics,meshes,maps:[...maps.values()]};
    });
    expect(audit.finish).toBe('ready');
    expect(audit.status).toMatchObject({artwork:fallback?'fallback':'ready',carpet:fallback?'fallback':'ready'});
    expect(audit.meshes.length).toBeGreaterThan(0);expect(audit.meshes.length).toBeLessThanOrEqual(3);
    expect(audit.meshes.every(mesh=>!mesh.castShadow)).toBe(true);
    expect(audit.maps.length).toBeLessThanOrEqual(5);
    for(const map of audit.maps){expect(Math.max(map.width,map.height)).toBeLessThanOrEqual(1024);expect(Math.min(map.width,map.height)).toBeGreaterThan(0);}
  }
  expect(errors).toEqual([]);
});
