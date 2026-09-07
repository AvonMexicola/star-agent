import fleet from './fleet-development.config.js';

// Compatibility entry: the current 64 m Atlas uses the shared physical journey.
// Build with VITE_DEV_TOOLS=1 first; this configuration previews that same dist.
export default { ...fleet, grep: /atlas:/ };
