import {fitsBox, EPSILON} from '../inventory/containers.js';
import {recipeById} from './recipes.js';

/** Immediate field batch. seconds is nominal throughput metadata for later
 * timed presses; this slice has no queued jobs or grid dependency. The caller
 * owns physical container access; default processing stays in the backpack. */
export function craft(store, recipeId, {source='pack',target='pack',quantity=1,dryRun=false}={}) {
  const recipe=recipeById(recipeId);
  if (!recipe || !Number.isSafeInteger(quantity) || quantity<1 || quantity>1000) return {ok:false,message:'Choose a valid recipe batch.'};
  if (store.blocked) return {ok:false,message:store.warning};
  const from=store.container(source),to=store.container(target);
  if (!from || !to) return {ok:false,message:'Choose an available container.'};
  const remaining={...from.items};
  for (const [id,amount] of Object.entries(recipe.inputs)) {
    if ((remaining[id]??0)+EPSILON<amount*quantity) return {ok:false,message:`Requires ${amount*quantity} kg ${id}.`};
    remaining[id]=Math.max(0,(remaining[id]??0)-amount*quantity);
  }
  const output=source===target?remaining:{...to.items};
  for (const [id,amount] of Object.entries(recipe.outputs)) output[id]=(output[id]??0)+amount*quantity;
  if (!fitsBox(output,to.boxes,store.limits(target))) return {ok:false,message:'Output container lacks mass capacity or stack slots.'};
  let next=store.withItems(store.state,source,remaining);
  if (source!==target) next=store.withItems(next,target,output);
  if (dryRun) return {ok:true,message:`Ready: ${recipe.name}.`};
  if (!store.write(next)) return {ok:false,message:store.warning};
  return {ok:true,message:`${recipe.name} completed.`,recipe:recipe.id,quantity,outputs:recipe.outputs};
}

export const previewCraft = (store,id,options={}) => craft(store,id,{...options,dryRun:true});
