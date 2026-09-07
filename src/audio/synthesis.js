/** Original procedural sound design. No recordings, network requests or assets.
 * PCM is cached on first use; slight seeded variants avoid identical footsteps. */
export const SOUND_KINDS=['rock','grass','snow','water','sand','metal','carbine','sidearm','pulse','laser','void','impact','collect','overheat'];
export function synthesize(kind,variant=0,rate=48000){
  if(!SOUND_KINDS.includes(kind))throw new Error(`Unknown sound: ${kind}`);
  const duration={rock:.26,grass:.34,snow:.4,water:.48,sand:.3,metal:.28,carbine:.3,sidearm:.23,pulse:.36,laser:.55,void:.9,impact:.32,collect:.34,overheat:.5}[kind];
  const data=new Float32Array(Math.ceil(rate*duration));
  let seed=(12345+variant*701+SOUND_KINDS.indexOf(kind)*92821)>>>0,low=0,mid=0,phase=0;
  const detune=1+(variant-1.5)*.018,pi=Math.PI*2;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
  let peak=0;
  for(let i=0;i<data.length;i++){
    const t=i/rate,p=t/duration,n=rnd();low+=.035*(n-low);mid+=.24*(n-mid);
    const grit=mid-low,air=n-mid,heel=Math.exp(-t*34),toe=Math.exp(-Math.pow((t-.09)/.065,2));
    let s=0;
    switch(kind){
      case 'rock':s=.9*grit*(heel+.4*toe)+.25*Math.sin(pi*105*detune*t)*heel+(Math.abs(n)>.987?n*.32:0)*Math.exp(-t*14);break;
      case 'grass':s=.33*air*(heel*.5+toe)+.45*grit*Math.exp(-t*12)+.12*Math.sin(pi*68*t)*heel;break;
      case 'snow':s=.55*air*(heel+.8*toe)*(.2+.8*Math.abs(Math.sin(pi*47*t)))+.5*low*toe+.12*Math.sin(pi*(370*t+120*t*t))*Math.exp(-t*10);break;
      case 'water':s=.7*grit*(heel+.7*toe)+.45*low*Math.exp(-t*7);for(let j=0;j<4;j++){const u=t-j*.055;if(u>0)s+=.12*Math.sin(pi*(420+j*150)*u/(1+u*4))*Math.exp(-u*22);}break;
      case 'sand':s=.6*grit*(heel+.65*toe)+.22*air*toe+.1*Math.sin(pi*80*t)*heel;break;
      case 'metal':s=.12*low*heel;for(const [f,a,d] of [[92,.36,32],[215,.085,35],[430,.012,48]])s+=a*Math.sin(pi*f*detune*t)*Math.exp(-t*d);break;
      case 'carbine':phase+=pi*(160+1800*Math.exp(-t*35))*detune/rate;s=(.48*Math.sin(phase)+.12*Math.sin(phase*2.01))*Math.exp(-t*17)+.32*air*Math.exp(-t*65);break;
      case 'sidearm':phase+=pi*(280+2500*Math.exp(-t*48))*detune/rate;s=.44*Math.sin(phase)*Math.exp(-t*22)+.3*grit*Math.exp(-t*45);break;
      case 'pulse':phase+=pi*(115+900*Math.exp(-t*23))*detune/rate;s=(.5*Math.sin(phase)+.18*Math.sin(phase*1.99))*Math.exp(-t*12)+.18*grit*heel;break;
      case 'laser':phase+=pi*(330+1600*Math.exp(-t*12))*detune/rate;s=(.35*Math.sin(phase)+.17*Math.sin(phase*2)+.1*Math.sin(phase*3))*Math.exp(-t*8)+.15*air*Math.exp(-t*20);break;
      case 'void':phase+=pi*(38+95*Math.exp(-t*6))*detune/rate;s=(.42*Math.sin(phase)+.16*Math.sin(phase*1.51))*(.65+.35*Math.cos(pi*18*t))*Math.exp(-t*4)+.24*low*Math.exp(-t*6);break;
      case 'impact':s=.65*grit*Math.exp(-t*24)+.18*Math.sin(pi*170*t)*Math.exp(-t*17)+.16*air*Math.exp(-t*55);break;
      case 'collect':s=.25*(Math.sin(pi*880*detune*t)+.5*Math.sin(pi*1320*detune*t))*Math.exp(-t*10);break;
      case 'overheat':s=.17*Math.sin(pi*(620*t-280*t*t))*(.5+.5*Math.sin(pi*12*t))*Math.exp(-t*5)+.2*air*Math.exp(-t*8);break;
    }
    const edge=Math.min(1,t/(kind==='metal'?.012:.003),(duration-t)/.025);data[i]=s*Math.max(0,edge);peak=Math.max(peak,Math.abs(data[i]));
  }
  const scale=(kind==='metal'?.44:.72)/Math.max(.001,peak);
  for(let i=0;i<data.length;i++)data[i]*=scale;
  return data;
}
