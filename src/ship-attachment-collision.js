/** Sweep the suit against fitted equipment in ship-local metres. Attachments
 * are obstacles only: they never create another cabin or walkable floor. */
export function constrainShipAttachments(previous,proposed,parts=[],{eva=false,eyeHeight=1.75}={}){
  const delta=proposed.clone().sub(previous);
  for(const part of parts){
    const min=part.min.map((v,i)=>v-(eva?.45:i===1?.12:.25));
    const max=part.max.map((v,i)=>v+(eva?.45:i===1?eyeHeight:.25));
    const inside=previous.toArray().every((v,i)=>v>min[i]&&v<max[i]);
    if(inside){
      // A saved/restored overlap must permit gradual escape at normal speed.
      // Penetration may decrease, but cannot deepen or enter from outside.
      const depth=point=>Math.min(...point.toArray().flatMap((v,i)=>[v-min[i],max[i]-v]));
      if(depth(proposed)<depth(previous)-1e-9)continue;
      return previous.clone();
    }
    let enter=0,leave=1;
    for(let i=0;i<3;i++){
      const start=previous.getComponent(i),d=delta.getComponent(i);
      if(Math.abs(d)<1e-12){if(start<=min[i]||start>=max[i]){enter=2;break;}continue;}
      const a=(min[i]-start)/d,b=(max[i]-start)/d;
      enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
    }
    if(enter<leave&&leave>0&&enter<1)return previous.clone();
  }
  return proposed.clone();
}
