export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shapes={
  weapon:'M8 27h35l7 5h8v5H38l-5 15h-8l2-15H8Zm5-5h23v5M42 27v-5h5v10',
  tool:'M8 23h25l10 7h14v10H35l-5 12h-9l3-12H8Zm4 6h20m-20 5h20M44 33h13',
  backpack:'M21 16v-5h22v5M17 17h30l5 8v30H12V25Zm-5 11h40M22 35h20v13H22Zm10 3v7m-4-3h8',
  ammo:'M13 18h14v36H13Zm24 0h14v36H37ZM17 10h6v8m18-8h6v8M13 40h14m10 0h14',
  bandage:'m12 27 15-15 25 25-15 15Zm10-7 22 22m-24-8 14-14m-8 23 17-17',
  stim:'m15 49 27-27m-23 9 14 14M36 16l12 12m-9-15 12 12M9 55l6-6m5-15 10 10m-3-17 10 10',
  box:'M12 20h40v34H12Zm8 0v-9h24v9M12 31h40M26 20v34m12-34v34',
};
export function itemIcon(item){
  if(item?.unit==='kg')return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 43 19 19 40 10 54 34 43 53 24 55Z" fill="${item.color}" opacity=".8"/><path d="m19 19 14 18 7-27m-7 27 21-3M12 43l21-6 10 16" fill="none" stroke="currentColor"/></svg>`;
  const kind=item?.id==='bandage'?'bandage':item?.id==='healing-stim'?'stim':item?.category;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" style="color:${item?.color??'#96afa7'}"><path d="${shapes[kind]??shapes.box}" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
