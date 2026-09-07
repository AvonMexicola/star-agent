// The public props viewer is served as a static file. Route its dependencies
// through Vite so bare addon imports resolve to the same Three.js instance.
export * as THREE from 'three';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
