const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

/** Review received seat poses, rather than treating a delayed render sample as
 * one simulation tick. A held pose keeps its first-observed timestamp. The
 * existing server advances access at 0.85 m/s and publishes every two 30 Hz
 * ticks; one publication interval accounts for sampling either side of a send.
 * The 4 mm tolerance is the existing actual-room route tolerance. */
export function analyzeSentryAccess(samples){
  const speed=.85,snapshotSeconds=2/30,tolerance=.004;
  const result={speed,snapshotSeconds,tolerance,samples:samples.length,motions:0,
    maximumRenderedStep:0,maximumRenderGap:0,largestMotion:null,violations:[]};
  let anchor=samples[0],previous=null;
  for(const [index,sample]of samples.entries()){
    if(!Number.isFinite(sample.time)||!Array.isArray(sample.position)||sample.position.length!==3||!sample.position.every(Number.isFinite))throw Error('Invalid access evidence at sample '+index);
    if(previous){
      if(sample.time<previous.time)throw Error('Non-monotonic access evidence at sample '+index);
      result.maximumRenderedStep=Math.max(result.maximumRenderedStep,distance(sample.position,previous.position));
      result.maximumRenderGap=Math.max(result.maximumRenderGap,(sample.time-previous.time)/1000);
    }
    previous=sample;
    if(sample.seat&&sample.peer&&distance(sample.position,sample.peer.position)>tolerance)result.violations.push({index,reason:'rendered pose differs from received authority'});
    if(!anchor)anchor=sample;
    const moved=distance(sample.position,anchor.position);
    if(moved<1e-6){
      // Door waiting is not available travel time. Start a new motion window
      // when an unchanged pose enters the next physical access phase.
      if(sample.seat!==anchor.seat)anchor=sample;
      continue;
    }
    const elapsed=(sample.time-anchor.time)/1000,limit=speed*(elapsed+snapshotSeconds)+tolerance;
    const motion={index,distance:moved,elapsed,limit,beforeTime:anchor.time,afterTime:sample.time};
    result.motions++;
    if(!result.largestMotion||moved>result.largestMotion.distance)result.largestMotion=motion;
    if(moved>limit)result.violations.push({...motion,reason:'movement exceeds physical route speed plus one snapshot interval'});
    anchor=sample;
  }
  if(result.motions===0)result.violations.push({reason:'no physical route movement recorded'});
  return result;
}
