import {test,expect} from '@playwright/test';
import WebSocket from 'ws';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {MULTIPLAYER_VERSION,WEAPON_RULES} from '../src/multiplayer/protocol.js';

const origin='http://127.0.0.1:5564';
const output=process.env.COMMUNITY_DEFENSE_OUTPUT??process.env.COMMUNITY_OUTPUT??'/home/cees/projects/.community-hub-qa/defense-01';
const viewport={width:1440,height:900};
const password='isolated defense acceptance password';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const state=page=>page.evaluate(()=>window.starAgent.state);
const own=s=>s.multiplayer.players.find(p=>p.id===s.multiplayer.ownId);
const combatEvent=m=>m.type==='event'&&['fire','hit','stationStrike','notice'].includes(m.event);

async function until(read,label,timeout=10000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const value=await read();if(value)return value;await pause(10);}
  throw new Error('Timed out: '+label);
}

// The only injected browser state is a standard Gamepad input device. Dialogs
// are reached with D-pad/A/B; no game action or player pose is assigned.
async function pulse(page,index){
  await page.evaluate(i=>hubPad.buttons[i]={pressed:true,value:1},index);
  await page.waitForTimeout(90);
  await page.evaluate(i=>hubPad.buttons[i]={pressed:false,value:0},index);
  await page.waitForTimeout(110);
}
async function activate(page,key){
  const target=page.locator('dialog[open]').last().locator(`[data-controller-key="${key}"]`);
  await expect(target).toBeVisible();await expect(target).toBeEnabled();
  for(let i=0;i<100;i++){
    const route=await target.evaluate(target=>{
      const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
      const items=[...dialog.querySelectorAll('summary,button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')]
        .filter(e=>!e.closest('[hidden],[inert]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
      const current=items.indexOf(document.activeElement),goal=items.indexOf(target);
      return {done:document.activeElement===target,back:(goal-current+items.length)%items.length>items.length/2};
    });
    if(route.done){await pulse(page,0);return;}
    await pulse(page,route.back?12:13);
  }
  throw new Error('Controller could not reach '+key);
}

async function witnessSetup(page,context,callsign,record){
  await page.addInitScript(()=>{
    window.hubPad={id:'Bastion acceptance standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[hubPad]});
  });
  const data={callsign,email:callsign+'@example.test',password};
  const registered=await context.request.post('/api/auth/register',{headers:{Origin:origin},data});
  expect(registered.status()).toBe(201);
  const account=(await registered.json()).account;
  const loggedIn=await context.request.post('/api/auth/login',{headers:{Origin:origin},data});
  expect(loggedIn.status()).toBe(200);
  expect((await loggedIn.json()).account.id).toBe(account.id);
  record.authentication.push({role:'witness',id:account.id,callsign,register:registered.status(),login:loggedIn.status()});
  await page.goto('/?debug&intro=0');
  await expect.poll(()=>page.evaluate(()=>window.starAgent?.state.ready),{timeout:90000}).toBe(true);
  if(await page.locator('#dev-launcher').isVisible()){
    await activate(page,'tab-comms');await activate(page,'comms-flight');await activate(page,'comms-account');
  }
  await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();
  await activate(page,'join-multiplayer');
  await expect.poll(async()=>(await state(page)).multiplayer.connected,{timeout:30000}).toBe(true);
  await pulse(page,1);await page.waitForTimeout(220);
  await expect.poll(()=>page.evaluate(()=>window.starAgent.navigation.enabled)).toBe(true);
  await expect.poll(async()=>(await state(page)).controller.armed).toBe(true);
  await expect.poll(async()=>(await state(page)).stationDefense.ready,{timeout:30000}).toBe(true);
  // The fixture server assigns this initial EVA viewpoint after normal join.
  await expect.poll(async()=>own(await state(page))?.mode).toBe('eva');
  const s=await state(page);
  expect(s.multiplayer.ownId).toBe(account.id);
  expect(own(s).parkedShipPosition).toBeNull();expect(own(s).weapon).toBeNull();
  expect(s.stationDefense.error).toBeNull();expect(s.stationDefense.mounts).toHaveLength(4);
  record.witnessInitial={player:own(s),camera:s.camera,defense:s.stationDefense};
  return account;
}

async function rawPilot(role,callsign,record){
  const data={callsign,email:callsign+'@example.test',password};
  const auth=async action=>{
    const response=await fetch(origin+'/api/auth/'+action,{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
    expect(response.status).toBe(action==='register'?201:200);
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const registered=await auth('register'),loggedIn=await auth('login'),account=loggedIn.body.account;
  expect(account.id).toBe(registered.body.account.id);expect(loggedIn.cookie).toBeTruthy();
  record.authentication.push({role,id:account.id,callsign,register:registered.status,login:loggedIn.status});
  const ws=new WebSocket(origin.replace('http:','ws:')+'/ws',{headers:{Origin:origin,Cookie:loggedIn.cookie}});
  const peer={account,ws,sequence:0,latest:null,welcome:null,social:null,messages:[],errors:[],autoRelease:false};
  peer.input=input=>{
    if(ws.readyState!==WebSocket.OPEN)throw new Error(role+' socket is not open');
    const packet={type:'input',sequence:++peer.sequence,input};ws.send(JSON.stringify(packet));
    record.inputs.push({at:Date.now(),peerId:account.id,...packet});return packet.sequence;
  };
  ws.on('message',bytes=>{
    const message=JSON.parse(bytes.toString());
    if(message.type==='welcome'){peer.welcome=message;peer.latest=message;}
    if(message.type==='state')peer.latest=message;
    if(message.type==='social')peer.social=message;
    if(message.type==='ack'||message.type==='social'||combatEvent(message))peer.messages.push(message);
    if(combatEvent(message))record.peerEvents.push({at:Date.now(),receiver:account.id,message});
    if(peer.autoRelease&&message.type==='event'&&message.event==='fire'&&message.peerId===account.id){
      peer.autoRelease=false;peer.input({});
    }
  });
  ws.on('error',error=>peer.errors.push(error.message));
  peer.player=id=>(peer.latest?.players??[]).find(p=>p.id===(id??account.id));
  peer.socialAction=async(action,targetId)=>{
    const requestId=randomUUID();ws.send(JSON.stringify({type:'social',requestId,action,targetId}));
    const ack=await until(()=>peer.messages.find(m=>m.type==='ack'&&m.requestId===requestId),role+' '+action+' acknowledgment');
    record.relationshipActions.push({actor:account.id,action,targetId,ack});expect(ack.ok).toBe(true);return ack;
  };
  peer.neutral=async()=>{
    const sequence=peer.input({});
    await until(()=>peer.player()?.sequence>=sequence,role+' neutral input acknowledgment');
  };
  peer.fireOnce=async()=>{
    await peer.neutral();const begin=peer.messages.length;peer.autoRelease=true;peer.input({fire:true});
    try{return await until(()=>peer.messages.slice(begin).find(m=>m.type==='event'&&m.event==='fire'&&m.peerId===account.id),role+' accepted fire');}
    finally{peer.autoRelease=false;if(ws.readyState===WebSocket.OPEN)peer.input({});}
  };
  peer.close=async()=>{
    if(ws.readyState===WebSocket.CLOSED)return;
    if(ws.readyState===WebSocket.OPEN)peer.input({});
    await new Promise(resolve=>{
      const timer=setTimeout(()=>{ws.terminate();resolve();},2000);
      ws.once('close',()=>{clearTimeout(timer);resolve();});ws.close();
    });
  };
  // Keep cleanup available even if handshake validation fails.
  record._peers.push(peer);
  await until(()=>peer.welcome&&peer.social,role+' admitted welcome and social roster');
  expect(peer.welcome.version).toBe(MULTIPLAYER_VERSION);
  await until(()=>peer.player()?.mode==='eva'&&peer.player()?.parkedShipPosition===null,role+' server-side initial EVA pose');
  expect(peer.player().weapon).toBe('rifle-laser');expect(peer.player().health).toBe(100);
  record.initialPeers.push({role,player:peer.player(),protocol:peer.welcome.version});
  await peer.neutral();return peer;
}

async function sources(){
  const paths=['../public/models/station-defense.glb','../src/station-security.js','../src/station-security-policy.js','../src/main.js','../src/multiplayer/client.js','../src/multiplayer/protocol.js','../server/security.js','../server/combat.js','../server/room.js','community-hub-server.mjs'];
  return Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha(await readFile(new URL(path,import.meta.url)))])));
}

async function recorder(context,page,folder,record){
  const cdp=await context.newCDPSession(page),frames=[];
  await cdp.send('Page.enable');
  const receive=frame=>{
    void cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(error=>record.captureErrors.push(error.message));
    if(frames.length<180)frames.push({receivedAt:Date.now(),metadata:frame.metadata,bytes:Buffer.from(frame.data,'base64')});
  };
  cdp.on('Page.screencastFrame',receive);
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:viewport.width,maxHeight:viewport.height,everyNthFrame:1});
  return {async stop(){
    await cdp.send('Page.stopScreencast');cdp.off('Page.screencastFrame',receive);await cdp.detach();
    await mkdir(folder+'/strike-frames',{recursive:true});
    record.screencast={format:'native Chromium JPEG frames',selection:'Timestamp-selected frame is a review candidate; beam visibility must be inspected.',frames:[]};
    for(let i=0;i<frames.length;i++){
      const frame=frames[i],file='strike-frames/'+String(i).padStart(4,'0')+'.jpg';
      await writeFile(folder+'/'+file,frame.bytes);
      record.screencast.frames.push({file,receivedAt:frame.receivedAt,...frame.metadata});
    }
    const eventAt=record.strikeReceivedAt;
    const selected=frames.filter(f=>f.receivedAt>=eventAt&&f.receivedAt<=eventAt+170)
      .sort((a,b)=>Math.abs(a.receivedAt-eventAt-65)-Math.abs(b.receivedAt-eventAt-65))[0];
    if(selected){
      const index=frames.indexOf(selected);record.screencast.selected=index;
      await writeFile(folder+'/03-strike-window-native.jpg',selected.bytes);
    }
  }};
}

test('controller witness: accepted friends are exempt, nonfriend fire causes a rendered lethal Bastion strike',async({browser})=>{
  const folder=output+'/witness';await mkdir(folder,{recursive:true});
  const record={started:new Date().toISOString(),scope:'Disposable memory server initial EVA poses; controller menu entry, real authenticated WebSockets and accepted friendship; no physical controller or performance claim.',poseMutation:false,physicalController:false,viewport,
    serverInitialPoses:{BastionWitness:[710,48,-108],witnessLooksAt:[665,4,-24],BastionTarget:[665,38,-90],BastionFriend:[665,38,-65],BastionAggressor:[665,38,-65],coordinates:'Aeon station-local metres; combat peers face local -Z'},
    authentication:[],inputs:[],relationshipActions:[],initialPeers:[],peerEvents:[],browserEvents:[],captureErrors:[],errors:[],warnings:[],_peers:[]};
  const context=await browser.newContext({baseURL:origin,viewport,deviceScaleFactor:1,recordVideo:{dir:folder+'/video',size:viewport}});
  context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(60000);
  const page=await context.newPage();let capture=null,instantShot=null,telemetry=null,expectedAttacker=null;
  const video=page.video();
  page.on('pageerror',e=>record.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());if(m.type()==='warning')record.warnings.push(m.text());});
  page.on('websocket',socket=>socket.on('framereceived',frame=>{
    let message;try{message=JSON.parse(frame.payload.toString());}catch{return;}
    if(!combatEvent(message))return;
    record.browserEvents.push({at:Date.now(),message});
    if(message.event==='stationStrike'&&message.attackerId===expectedAttacker&&!instantShot){
      record.strikeReceivedAt=Date.now();record.wireStrike=message;
      // No render delay or paused game state: request an actual frame now. A
      // screencast is retained because screenshot latency can exceed beam life.
      instantShot=page.screenshot({path:folder+'/03-instant-request.png'}).then(()=>true,error=>{record.captureErrors.push(error.message);return false;});
    }
  }));
  try{
    record.sourcesBefore=await sources();
    const asset=await context.request.get('/models/station-defense.glb');expect(asset.status()).toBe(200);
    const assetBytes=await asset.body();record.servedAsset={sha256:sha(assetBytes),bytes:assetBytes.length};
    expect(record.servedAsset.sha256).toBe(record.sourcesBefore['../public/models/station-defense.glb']);
    const suffix='_'+Date.now().toString().slice(-6);
    await witnessSetup(page,context,'BastionWitness'+suffix,record);
    const target=await rawPilot('target','BastionTarget'+suffix,record);
    const friend=await rawPilot('friend','BastionFriend'+suffix,record);
    await friend.socialAction('request',target.account.id);await target.socialAction('accept',friend.account.id);
    const linked=(peer,id)=>peer.social?.relationships?.some(r=>r.id===id&&r.status==='friend');
    await until(()=>linked(friend,target.account.id)&&linked(target,friend.account.id),'mutual accepted friendship');
    record.acceptedFriendship={friend:friend.social.relationships,target:target.social.relationships};
    const before=await state(page);expect(before.stationDefense.strikes).toBe(0);
    await page.screenshot({path:folder+'/01-before-fire.png'});
    const friendShot=await friend.fireOnce();
    expect(friendShot.targetId).toBe(target.account.id);expect(friendShot.kind).toBe('player');
    expect(friendShot.damage).toBe(25);expect(WEAPON_RULES['rifle-laser'].damage).toBe(25);
    await until(()=>target.player()?.health===75,'ordinary friendly-fire damage');
    await pause(400);
    expect(friend.player().health).toBe(100);expect(friend.player().shipHealth).toBe(100);expect(friend.player().mode).toBe('eva');
    expect(friend.messages.filter(m=>m.type==='event'&&m.event==='fire'&&m.peerId===friend.account.id)).toHaveLength(1);
    expect(record.browserEvents.filter(({message:m})=>m.event==='stationStrike')).toHaveLength(0);
    expect((await state(page)).stationDefense.strikes).toBe(0);
    record.friendCase={shot:friendShot,friend:friend.player(),target:target.player()};
    await page.screenshot({path:folder+'/02-friend-exempt.png'});
    // The friend and aggressor share one documented initial firing pose. Remove
    // the friend first so its physical body cannot obstruct the next shot.
    await friend.close();
    await until(()=>!target.player(friend.account.id),'friend removal before reusing firing pose');
    const aggressor=await rawPilot('aggressor','BastionAggressor'+suffix,record);
    expect(linked(aggressor,target.account.id)).toBeFalsy();expect(linked(target,aggressor.account.id)).toBeFalsy();
    expectedAttacker=aggressor.account.id;
    await expect.poll(async()=>(await state(page)).multiplayer.players.some(p=>p.id===expectedAttacker)).toBe(true);
    capture=await recorder(context,page,folder,record);
    // Read-only in-page samples avoid round-trip gaps during the short recoil.
    telemetry=page.evaluate(async()=>{
      const samples=[],start=performance.now();
      while(performance.now()-start<1500){
        const s=window.starAgent.state;
        samples.push({at:Date.now(),elapsed:performance.now()-start,renderedFrames:s.renderedFrames,defense:s.stationDefense});
        await new Promise(resolve=>setTimeout(resolve,16));
      }
      return samples;
    }).catch(error=>{record.captureErrors.push(error.message);return [];});
    const hostileShot=await aggressor.fireOnce();
    expect(hostileShot.targetId).toBe(target.account.id);expect(hostileShot.kind).toBe('player');expect(hostileShot.damage).toBe(25);
    await until(()=>record.wireStrike,'browser receipt of stationStrike');
    const strike=record.wireStrike;
    expect(strike.victimId).toBe(target.account.id);expect(strike.attackerId).toBe(aggressor.account.id);expect(strike.cause).toBe('shot');
    expect(strike.stationId).toBe('aeon-orbital');expect([0,1]).toContain(strike.barrel);
    for(const field of ['origin','direction','target']){expect(strike[field]).toHaveLength(3);expect(strike[field].every(Number.isFinite)).toBe(true);}
    expect(Math.hypot(...strike.direction)).toBeCloseTo(1,5);
    await until(()=>aggressor.player()?.health===0&&aggressor.player()?.shipHealth===0,'lethal security response');
    await until(()=>target.player()?.health===50,'nonfriend ordinary hit damage');
    expect(aggressor.player().weapon).toBeNull();expect(aggressor.player().mode).toBe('crashed');
    await expect.poll(async()=>(await state(page)).stationDefense.lastStrike?.id).toBe(strike.id);
    await expect.poll(async()=>(await state(page)).stationDefense.strikes).toBe(1);
    if(instantShot)await instantShot;
    await page.screenshot({path:folder+'/04-after-strike.png'});
    record.recoilSamples=await telemetry;telemetry=null;
    const kicked=record.recoilSamples.flatMap(s=>s.defense.mounts).filter(m=>m.mountId===strike.mountId).map(m=>m.recoil[strike.barrel]);
    expect(kicked.length).toBeGreaterThan(0);expect(Math.max(...kicked)).toBeGreaterThan(.1);
    await expect.poll(async()=>{
      const mount=(await state(page)).stationDefense.mounts.find(m=>m.mountId===strike.mountId);return mount?.recoil[strike.barrel];
    }).toBe(0);
    await capture.stop();capture=null;
    expect(record.screencast.frames.length).toBeGreaterThan(1);
    expect(record.browserEvents.filter(({message:m})=>m.event==='stationStrike')).toHaveLength(1);
    expect(aggressor.messages.filter(m=>m.type==='event'&&m.event==='fire'&&m.peerId===aggressor.account.id)).toHaveLength(1);
    record.nonfriendCase={shot:hostileShot,strike,aggressor:aggressor.player(),target:target.player(),recoilPeak:Math.max(...kicked)};
    await page.screenshot({path:folder+'/05-recoil-return.png'});
    record.final=await state(page);
    expect(own(record.final).health).toBe(100);expect(record.final.multiplayer.connected).toBe(true);
    expect(record.final.enabled).toBe(true);expect(record.final.controller.armed).toBe(true);
    expect(record.errors).toEqual([]);expect(record.warnings).toEqual([]);expect(record.captureErrors).toEqual([]);
    for(const peer of record._peers)expect(peer.errors).toEqual([]);
    record.sourcesAfter=await sources();expect(record.sourcesAfter).toEqual(record.sourcesBefore);
    record.complete=true;
  }catch(error){record.failure={message:error.message,stack:error.stack};throw error;}
  finally{
    if(telemetry)record.recoilSamples=await telemetry;
    if(instantShot)await instantShot;
    if(capture)await capture.stop().catch(error=>record.captureErrors.push(error.message));
    await page.screenshot({path:folder+'/last-frame.png'}).catch(error=>record.captureErrors.push(error.message));
    record.last=await state(page).catch(()=>null);
    record.browser=browser.version();
    record.graphics=await page.evaluate(()=>{
      const canvas=document.querySelector('#viewport'),gl=canvas?.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
      return {backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),drawingBuffer:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:null,viewport:[innerWidth,innerHeight],devicePixelRatio};
    }).catch(()=>null);
    for(const peer of record._peers)await peer.close().catch(error=>record.captureErrors.push(error.message));
    record.peerErrors=record._peers.map(peer=>({id:peer.account.id,errors:peer.errors}));delete record._peers;
    record.finished=new Date().toISOString();
    await context.close();record.video=await video?.path();
    await writeFile(folder+'/journey.json',JSON.stringify(record,null,2));
  }
});
