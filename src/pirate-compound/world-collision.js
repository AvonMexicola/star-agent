import {BuildSystem} from '../build/system.js';
import {emptyBuild} from '../build/state.js';

/** Match the existing settlement authority: world content is supplied only
 * after the empty player-save constructor check, never written to player saves. */
export function createPirateCollision(scene,nav,claims){
 const store={state:{build:emptyBuild()},container:()=>null};
 const collision=new BuildSystem({scene,nav,store,render:false});
 store.state.build={...emptyBuild(),claims};
 return collision;
}
