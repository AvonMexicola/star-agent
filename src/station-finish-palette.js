/** Physical surface colours share the CSS design-token source with printed graphics. */
export function stationFinishPalette(){
  const fallback={ivory:'ivory',petrol:'darkslategray',steel:'slategray',dark:'darkslategray',rubber:'black',deck:'dimgray',ochre:'peru',warm:'bisque',cool:'lightsteelblue',paper:'beige',mint:'palegreen',muted:'slategray'};
  if(typeof document==='undefined'||typeof getComputedStyle==='undefined')return fallback;
  const style=getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(fallback).map(([key,value])=>[key,style.getPropertyValue(key==='mint'||key==='muted'?`--${key}`:`--station-${key}`).trim()||value]));
}
