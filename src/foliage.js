import * as THREE from 'three';

// Botanical branch cards rather than solid cones. The atlas is drawn once using
// a private seed, so creating foliage never changes the world's random stream.
export function createNeedleTexture(broadleaf = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  let seed = 1873;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#796c48'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(128, 252); ctx.lineTo(128, 10); ctx.stroke();
  for (let row = 0; row < 35; row++) {
    const y = 24 + row * 6.25;
    const width = (18 + Math.sin(row / 35 * Math.PI * .8) * 91) * (.8 + random() * .2);
    for (const side of [-1, 1]) {
      const endX = 128 + side * width, endY = y - 15 - random() * 25;
      ctx.strokeStyle = '#586b36'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(128, y + 8); ctx.lineTo(endX, endY); ctx.stroke();
      for (let needle = 0; needle < 18; needle++) {
        const t = needle / 18, x = 128 + (endX - 128) * t, py = y + 8 + (endY - y - 8) * t;
        const brightness = 62 + Math.floor(random() * 58);
        ctx.strokeStyle = `rgb(${brightness + 12},${brightness + 28},${Math.floor(brightness * .66)})`;
        ctx.lineWidth = 1.2 + random();
        if(broadleaf){
          ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();
          ctx.ellipse(x+side*5,py-5,4+random()*4,2+random()*3,side*.65,0,Math.PI*2);ctx.fill();
        }else{
          ctx.beginPath(); ctx.moveTo(x, py);
          ctx.lineTo(x + side * (5 + random() * 10), py - 9 - random() * 13); ctx.stroke();
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function crownProfile(t,variant=0) {
  if(variant===1)return {y:.50+t*.43,spread:.34*Math.pow(Math.sin((.12+t*.88)*Math.PI),.55)+.025};
  if(variant===2)return {y:.28+t*.65,spread:.38*Math.pow(Math.sin((.08+t*.92)*Math.PI),.6)+.025};
  return {y:.22+t*.684,spread:.29*(1-t*9/11)};
}

export function createBranchGeometry(medium = false, variant = 0) {
  const positions = [], normals = [], uvs = [], colors = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let layer = 0; layer < (medium ? 6 : 10); layer++) {
    const t = layer / (medium ? 5 : 9);
    const {y,spread}=crownProfile(t,variant);
    const count = medium ? 4 : layer > 7 ? 4 : 6;
    for (let branch = 0; branch < count; branch++) {
      const angle = branch / count * Math.PI * 2 + layer * 2.399;
      const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      for (const tilt of (medium ? [branch % 2 ? -.8 : .8] : [-.8, .8])) {
      const across = new THREE.Vector3(-radial.z, 0, radial.x).applyAxisAngle(radial, tilt);
      const root = new THREE.Vector3(0, y + Math.sin(branch*7+layer*13)*.016, 0);
      const tip = root.clone().addScaledVector(radial, spread*(.83+.17*Math.sin(layer*7+branch*11))).addScaledVector(up, -.075 + layer * .011);
      const normal = new THREE.Vector3().crossVectors(across, tip.clone().sub(root)).normalize();
      const points = [root.clone().addScaledVector(across, -spread * .35), root.clone().addScaledVector(across, spread * .35),
        tip.clone().addScaledVector(across, -spread * .52), tip.clone().addScaledVector(across, spread * .52)];
      for (const i of [0, 2, 1, 1, 2, 3]) {
        positions.push(...points[i]); normals.push(...normal);
        uvs.push(i % 2, i < 2 ? 0 : 1);
        const shade = .68 + layer * .027;
        colors.push(shade, shade, shade);
      }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function addFoliageWind(material, windTime) {
  material.onBeforeCompile = shader => {
    shader.uniforms.windTime = windTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float windTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float phase = instanceMatrix[3].x*.13+instanceMatrix[3].z*.17;
        float bend = sin(windTime*1.15+phase)+.35*sin(windTime*2.7+phase*1.3);
        transformed.x += bend*.006*position.y*position.y;
        transformed.z += cos(windTime*.8+phase)*.004*position.y;
      `);
  };
  material.customProgramCacheKey = () => 'branch-wind-v1';
}


// A full-tree silhouette for distant stands. Ragged branch clusters preserve
// the tree's width and height; two crossed cards give coverage from any bearing.
export function createTreeImpostor(needleTexture,variant=0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#655747'; ctx.fillRect(247, 95, 18, 929);
  let seed = 991;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let layer = 0; layer < 22; layer++) {
    const t = 1-layer/21,profile=crownProfile(t,variant),y=(1-profile.y)*1024,width=profile.spread*512;
    for (let branch = 0; branch < 10; branch++) {
      const side = branch % 2 ? 1 : -1;
      const reach = width * (.25 + random() * .75);
      ctx.save(); ctx.translate(256 + side * reach * .5, y + random() * 20);
      ctx.rotate(side * (.8 + random() * .8));
      ctx.drawImage(needleTexture.image, -38-t*24, -reach*.7, 76+t*48, reach+35);
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const geometry = new THREE.BufferGeometry(), positions = [], normals = [], uvs = [];
  for (const angle of [0, Math.PI / 2]) {
    for (const i of [0,2,1,1,2,3]) {
      const x = (i % 2 ? .5 : -.5), y = i < 2 ? 0 : 1;
      positions.push(x*Math.cos(angle),y,x*Math.sin(angle));
      // Round crown lighting avoids a bright/dark cross at a card intersection.
      normals.push(Math.cos(angle)*.25,.94,Math.sin(angle)*.25);
      uvs.push(i%2,y);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  return { geometry, texture };
}
