import { DefaultLoadingManager } from 'three';

/** Version only this build's local models, leaving embedded and hosted assets alone. */
export function createModelURLModifier(revisions, base) {
  const origin = base ? new URL(base).origin : null;
  return input => {
    if (!origin) return input;
    let url;
    try { url = new URL(input, base); } catch { return input; }
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin) return input;
    const revision = Object.hasOwn(revisions, url.pathname) && revisions[url.pathname];
    if (!revision) return input;
    url.searchParams.set('v', revision);
    return url.href;
  };
}

// Imported before eager loaders by the gameplay entry. FileLoader/TextureLoader,
// including GLTFLoader's dependencies, all share this manager by default.
DefaultLoadingManager.setURLModifier(createModelURLModifier(
  typeof __STAR_AGENT_MODEL_REVISIONS__ === 'undefined' ? {} : __STAR_AGENT_MODEL_REVISIONS__,
  globalThis.location?.href,
));
