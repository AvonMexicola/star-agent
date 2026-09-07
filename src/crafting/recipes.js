// Tier-0 gameplay abstractions: selectable fractions consume the entire input
// batch, never award several products from the same rock mass. No water/grid gate.
const recipe = (id, name, inputs, outputs, seconds) => Object.freeze({id,name,inputs:Object.freeze(inputs),outputs:Object.freeze(outputs),seconds,power:0,workstation:'field',tier:0});
export const RECIPES = Object.freeze([
  recipe('aggregate','Crush aggregate',{basalt:1},{aggregate:1},2),
  recipe('mineral-binder','Separate dry binder',{basalt:1},{'mineral-binder':1},4),
  recipe('concrete','Press dry concrete',{aggregate:8,'mineral-binder':2},{concrete:10},6),
  recipe('metal-stock','Work common metal',{basalt:1},{'metal-stock':1},6),
  recipe('conductor','Refine conductor',{copper:1},{conductor:1},6),
  recipe('glass','Process basic glass',{basalt:1},{glass:1},6),
]);
export const recipeById = id => RECIPES.find(recipe=>recipe.id===id);
