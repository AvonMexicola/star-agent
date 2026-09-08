import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightMusic, musicScene } from '../src/music.js';

test('travel, orbit and actual descent follow navigation with hysteresis', () => {
  assert.equal(musicScene({ altitude: 5000000 }), 'travel');
  assert.equal(musicScene({ altitude: 4000000 }, 'travel'), 'travel');
  assert.equal(musicScene({ altitude: 3700000 }, 'travel'), 'orbit');
  assert.equal(musicScene({ altitude: 4000000 }, 'orbit'), 'orbit');
  assert.equal(musicScene({ altitude: 60000, verticalSpeed: -6 }), 'descent');
  assert.equal(musicScene({ altitude: 75000, verticalSpeed: 0 }, 'descent'), 'descent');
  assert.equal(musicScene({ altitude: 60000, verticalSpeed: 6 }, 'descent'), 'orbit');
  assert.equal(musicScene({ altitude: 100, verticalSpeed: 0 }), 'orbit', 'quick transit is not descent');
  assert.equal(musicScene({ altitude: 100, verticalSpeed: -100, airless: true }), 'orbit');
  assert.equal(musicScene({ altitude: 700000, airless: true }), 'travel');
  assert.equal(musicScene({ mode: 'walk', altitude: 60000, verticalSpeed: -100 }), 'orbit');
  assert.equal(musicScene({ mode: 'crashed' }), null);
  assert.equal(musicScene({ mode: 'destroyed' }), null);
});

function fixture(play) {
  const nodes = [];
  const context = { currentTime: 0,
    createGain() {
      const node = { gain: { value: 0, setTargetAtTime(value) { this.value = value; }, cancelScheduledValues() {} },
        connect() {}, disconnect() { this.disconnected = true; } };
      nodes.push(node); return node;
    },
    createMediaElementSource() { return { connect() {}, disconnect() {} }; },
  };
  const media = [];
  const music = new FlightMusic(context, {}, { baseURL: '/audio/music/', mediaFactory: () => {
    const item = { src: '', currentTime: 0, duration: 210, paused: true, plays: 0,
      play() { this.plays++; this.paused = false; return play ? play(this) : Promise.resolve(); },
      pause() { this.paused = true; }, removeAttribute() { this.src = ''; }, load() { this.currentTime = 0; },
    };
    media.push(item); return item;
  } });
  return { music, context, media, nodes };
}
const orbit = { mode: 'flight', altitude: 200000 };
const travel = { mode: 'flight', altitude: 5000000 };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('gesture gates all media requests; startup fades and variants alternate near the ending', async () => {
  const { music, media, context } = fixture();
  music.update(orbit);
  assert.ok(media.every(m => !m.src && m.plays === 0));
  music.setEnabled(true); music.update(orbit); await flush();
  assert.equal(music.state.file, 'blue-horizon-1.mp3');
  assert.equal(music.active.gain.gain.value, 0);
  context.currentTime = 6; music.update(orbit);
  assert.equal(music.state.crossfading, false);
  const outgoing = music.active;
  outgoing.media.currentTime = 204;
  music.update(orbit); await flush();
  assert.equal(music.state.file, 'blue-horizon-2.mp3');
  context.currentTime = 9; music.update(orbit);
  assert.ok(Math.abs(outgoing.gain.gain.value - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(music.active.gain.gain.value - Math.SQRT1_2) < 1e-9);
  context.currentTime = 12; music.update(orbit);
  assert.equal(outgoing.media.src, '');
  assert.equal(outgoing.media.paused, true);
  assert.equal(music.state.crossfading, false);
  music.dispose();
});

test('short boundary excursions do not restart the score; stable changes crossfade', async () => {
  const { music, context } = fixture();
  music.setEnabled(true); music.update(orbit); await flush();
  context.currentTime = 7; music.update(travel);
  context.currentTime = 8; music.update(orbit);
  assert.equal(music.state.file, 'blue-horizon-1.mp3');
  context.currentTime = 9; music.update(travel);
  context.currentTime = 11; music.update(travel); await flush();
  assert.equal(music.state.file, 'between-worlds-1.mp3');
  assert.equal(music.state.crossfading, true);
  music.dispose();
});

test('mute/visibility pause retains playback and fade position; crash clears music', async () => {
  const { music, context, media } = fixture();
  music.setEnabled(true); music.update(orbit); await flush();
  context.currentTime = 3; music.update(orbit);
  const gain = music.active.gain.gain.value;
  music.active.media.currentTime = 30;
  music.setEnabled(false);
  assert.ok(media.every(m => m.paused));
  context.currentTime = 103;
  music.setEnabled(true); await flush(); music.update(orbit);
  assert.equal(music.active.media.currentTime, 30);
  assert.equal(music.active.gain.gain.value, gain);
  music.update({ mode: 'crashed' });
  assert.equal(music.state.file, null);
  assert.ok(media.every(m => m.paused && !m.src));
  music.dispose();
});

test('a missing file falls back to the other variant without an endless retry loop', async () => {
  const { music, context, media } = fixture(() => Promise.reject(new Error('404')));
  music.setEnabled(true); music.update(orbit); await flush();
  music.update(orbit); await flush();
  assert.equal(music.state.failed.length, 2);
  for (let i = 0; i < 100; i++) { context.currentTime++; music.update(orbit); }
  assert.equal(media.reduce((sum, m) => sum + m.plays, 0), 2);
  assert.equal(music.state.pending, null);
  music.dispose();
});

test('a late play resolution after mute or disposal cannot resurrect audio', async () => {
  let resolve;
  const { music, media } = fixture(() => new Promise(done => { resolve = done; }));
  music.setEnabled(true); music.update(orbit);
  music.setEnabled(false); music.dispose(); resolve(); await flush();
  assert.ok(media.every(m => m.paused && !m.src));
  assert.equal(music.state.file, null);
  assert.equal(music.state.pending, null);
});

test('browser activation denial waits for a fresh gesture without blacklisting the score', async () => {
  let allowed=false;
  const {music,media}=fixture(()=>allowed?Promise.resolve():Promise.reject(Object.assign(new Error('gesture required'),{name:'NotAllowedError'})));
  music.setEnabled(true);music.update(orbit);await flush();
  assert.equal(music.state.activationRequired,true);assert.deepEqual(music.state.failed,[]);
  for(let i=0;i<60;i++)music.update(orbit);
  assert.equal(media.reduce((n,item)=>n+item.plays,0),1,'render frames do not retry blocked media');
  allowed=true;music.unlock();music.update(orbit);await flush();
  assert.equal(music.state.activationRequired,false);assert.equal(music.state.file,'blue-horizon-1.mp3');
  assert.equal(music.state.paused,false);music.dispose();
});

test('a synchronous autoplay exception also remains retryable', async () => {
  let blocked=true;
  const {music}=fixture(()=>{if(blocked)throw Object.assign(new Error('interrupted'),{name:'AbortError'});return Promise.resolve();});
  music.setEnabled(true);assert.doesNotThrow(()=>music.update(travel));
  assert.equal(music.state.activationRequired,true);assert.deepEqual(music.state.failed,[]);
  blocked=false;music.unlock();music.update(travel);await flush();
  assert.equal(music.state.file,'between-worlds-1.mp3');music.dispose();
});

test('an interrupted resume preserves playback and fade clocks until activation returns', async () => {
  let blocked=false;
  const {music,context}=fixture(()=>blocked?Promise.reject(Object.assign(new Error('interrupted'),{name:'AbortError'})):Promise.resolve());
  music.setEnabled(true);music.update(orbit);await flush();
  context.currentTime=3;music.update(orbit);music.active.media.currentTime=20;
  const gain=music.active.gain.gain.value;
  music.setEnabled(false);context.currentTime=30;blocked=true;
  music.setEnabled(true);await flush();
  assert.equal(music.state.activationRequired,true);assert.equal(music.state.time,20);
  context.currentTime=90;music.update(orbit);assert.equal(music.active.gain.gain.value,gain);
  blocked=false;music.unlock();music.update(orbit);await flush();
  assert.equal(music.active.gain.gain.value,gain,'fade remains at the point where playback paused');
  assert.equal(music.state.time,20);assert.deepEqual(music.state.failed,[]);music.dispose();
});

test('a stale resume rejection cannot erase a later successful resume',async()=>{
  let rejectResume;
  const {music}=fixture(item=>item.plays===2?new Promise((_resolve,reject)=>{rejectResume=reject;}):Promise.resolve());
  music.setEnabled(true);music.update(orbit);await flush();
  music.setEnabled(false);music.setEnabled(true);
  music.setEnabled(false);music.setEnabled(true);await flush();
  rejectResume(new Error('old media operation was canceled'));await flush();
  assert.equal(music.state.file,'blue-horizon-1.mp3');assert.deepEqual(music.state.failed,[]);
  assert.equal(music.state.paused,false);music.dispose();
});

test('music selection is shared by all hulls and follows unpowered navigation too',()=>{
  for(const shipId of ['atlas','kestrel','nomad']){
    assert.equal(musicScene({...travel,shipId,powered:false}),'travel');
    assert.equal(musicScene({...orbit,shipId}),'orbit');
    assert.equal(musicScene({shipId,altitude:60000,verticalSpeed:-20}),'descent');
  }
});
