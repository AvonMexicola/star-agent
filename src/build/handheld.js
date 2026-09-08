import * as THREE from 'three';
import {PIECES} from './definitions.js';

export const BUILDER_ITEM = 'builder-tool';

/** Presentation only. Placement/removal and all material transactions stay in BuildSystem. */
export function builderReadout(build) {
  const preview = build?.preview;
  return {
    label: PIECES[preview?.pieceId ?? build?.pieceId]?.label ?? 'Field builder',
    mode: build?.removing ? 'REMOVE' : 'ASSEMBLE',
    status: !build?.active ? 'STOWED' : preview?.valid ? 'READY' : 'BLOCKED',
    valid: Boolean(preview?.valid),
  };
}

export class BuilderHandheld {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'Builder confirmation projection';
    this.root.visible = false;
    scene.add(this.root);
    this.geometry = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
    this.geometry.rotateX(Math.PI / 2);
    this.geometry.translate(0, 0, .5);
    this.material = new THREE.MeshBasicMaterial({color:0xb6efd1,transparent:true,opacity:.65,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    this.beam = new THREE.Mesh(this.geometry, this.material);
    this.beam.frustumCulled = false;
    this.root.add(this.beam);
    this.target = new THREE.Vector3();
    this.start = new THREE.Vector3();
    this.delta = new THREE.Vector3();
    this.forward = new THREE.Vector3(0,0,1);
    this.pulse = 0;
    this.visible = false;
    this.seenAction = null;
    this.readout = builderReadout(null);
    this.drawKey = '';
  }
  attach(equipment) {
    if (this.screen) return;
    const anchor = equipment.itemObject(BUILDER_ITEM)?.getObjectByName('screen');
    if (!anchor) return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256; this.canvas.height = 128;
    this.context = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(.076,.043),
      new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}));
    this.screen.name = 'Builder live status';
    anchor.add(this.screen);
  }
  draw() {
    if (!this.context) return;
    const {label,mode,status,valid} = this.readout, key = `${label}/${mode}/${status}`;
    if (key === this.drawKey) return;
    this.drawKey = key;
    const c = this.context, color = valid ? '#b6efd1' : '#e9b16d';
    c.fillStyle = '#071410'; c.fillRect(0,0,256,128);
    c.fillStyle = '#b6efd1'; c.font = '600 13px monospace'; c.fillText('MERIDIAN  /  FIELD 01',12,21);
    c.fillStyle = '#44645a'; c.fillRect(12,31,232,1);
    c.fillStyle = '#a9bbb3'; c.font = '11px monospace'; c.fillText(mode,12,49);
    c.fillStyle = '#ecf4ec'; c.font = 'bold 16px monospace';
    c.fillText(label.toUpperCase(),12,73,232);
    c.fillStyle = color; c.fillRect(12,91,7,23); c.font = 'bold 17px monospace'; c.fillText(status,28,109);
    this.texture.needsUpdate = true;
  }
  update(dt,{build,equipment,origin,visible}) {
    this.visible = Boolean(visible && equipment.equipped === BUILDER_ITEM && !equipment.holstered);
    this.attach(equipment);
    this.readout = builderReadout(build);
    this.draw();
    const action = build?.lastToolAction ?? null;
    if (action !== this.seenAction) {
      this.seenAction = action;
      if (this.visible && action) {this.target.fromArray(action.position); this.pulse = .65;}
    }
    if (!this.visible) this.pulse = 0;
    else this.pulse = Math.max(0,this.pulse-Math.max(0,dt));
    const muzzle = this.pulse > 0 ? equipment.muzzleWorldPosition(this.start) : null;
    this.root.visible = Boolean(this.visible && this.screen && muzzle && this.pulse > 0);
    if (!this.root.visible) return;
    this.delta.copy(this.target).sub(muzzle);
    const length = this.delta.length();
    if (length < .001 || length > 30) {this.root.visible=false;return;}
    // Subtract JS-double positions before supplying local geometry transforms.
    this.beam.position.copy(muzzle).sub(origin);
    this.beam.quaternion.setFromUnitVectors(this.forward,this.delta.multiplyScalar(1/length));
    this.beam.scale.set(.006,.006,length);
    this.material.opacity = Math.min(1,this.pulse/.2)*.65;
  }
  get state() {
    return {loaded:Boolean(this.screen),visible:this.visible,projection:this.root.visible,
      readout:this.readout,start:this.root.visible?this.start.toArray():null,
      target:this.root.visible?this.target.toArray():null};
  }
  dispose() {
    this.root.removeFromParent(); this.geometry.dispose(); this.material.dispose();
    this.screen?.removeFromParent(); this.screen?.geometry.dispose(); this.screen?.material.dispose(); this.texture?.dispose();
  }
}
