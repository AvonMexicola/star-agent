const icons={
  objective:'<path d="m12 3 9 9-9 9-9-9Z"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  poi:'<path d="M18 9c0 5-6 12-6 12S6 14 6 9a6 6 0 1 1 12 0Z"/><circle cx="12" cy="9" r="2"/>',
  ship:'<path d="m12 3 8 17-8-4-8 4Z"/><path d="M12 11v5"/>',
  vehicle:'<rect x="5" y="7" width="14" height="9" rx="2"/><path d="M8 7V4h8v3M8 11h8M7 16v3m10-3v3"/>',
};

export function navigationMarkerType(target,objective=false){
  return objective?'objective':target.owned?'vehicle':target.category==='ships'?'ship':'poi';
}

/** Fixed, monochrome line symbols. Labels carry all dynamic player-visible text. */
export function navigationMarkerIcon(type){
  return `<svg class="navigation-type-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[type]??icons.poi}</svg>`;
}
