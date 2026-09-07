import { Quaternion } from 'three';
/** Compose terrain domains with conservative authored-building volume sweeps. */
export function createBuildObstacles(mining,build){
  const sweep=(previous,proposed,resolve,envelope)=>{
    const initial=resolve(previous,proposed),point=initial?.point??proposed;
    const delta=point.clone().sub(previous),distance=delta.length();
    if(distance<1e-8)return initial;
    const hit=build.raycast(previous,delta.normalize(),distance,envelope);
    if(hit)return {point:previous.clone().addScaledVector(delta,Math.max(0,hit.distance-.005)),hit:true};
    return initial;
  };
  function flightEnvelope(){
    const {layout,orientation}=build.nav;
    return {min:layout.flightBounds.min.map((n,i)=>n-layout.seatEye[i]),max:layout.flightBounds.max.map((n,i)=>n-layout.seatEye[i]),orientation};
  }
  function evaEnvelope(){
    const nav=build.nav,eye=nav.layout?.eyeHeight??1.65;
    return {min:[-.3,-eye,-.3],max:[.3,1.8-eye,.3],orientation:nav.orientation??new Quaternion()};
  }
  return {
    get grounded(){return mining.grounded||build.grounded;},
    constrainWalker(previous,proposed){const rock=mining.constrainWalker(previous,proposed),base=build.constrainWalker(previous,rock.point);return {...base,hit:rock.hit||base.hit,grounded:rock.grounded||base.grounded};},
    constrainEVA(previous,proposed){return sweep(previous,proposed,(a,b)=>mining.constrainEVA(a,b),evaEnvelope());},
    constrainFlight(previous,proposed){return sweep(previous,proposed,(a,b)=>mining.constrainFlight(a,b),flightEnvelope());},
  };
}
