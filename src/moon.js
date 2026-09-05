import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION, moonSurface } from './moon-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION } from './world.js';

function textures(width=1024,height=512) {
  const color=new Uint8Array(width*height*4),relief=new Uint8Array(width*height*4);
  for(let row=0;row<height;row++){
    const theta=(1-row/(height-1))*Math.PI,sin=Math.sin(theta),y=Math.cos(theta);
    for(let col=0;col<width;col++){
      const phi=col/width*Math.PI*2,x=-Math.cos(phi)*sin,z=Math.sin(phi)*sin;
      const sample=moonSurface(x,y,z),i=(row*width+col)*4;
      const shade=Math.round(sample.albedo*255),bump=Math.round(255*THREE.MathUtils.clamp(.5+sample.height/8000,0,1));
      color.set([shade,Math.round(shade*.98),Math.round(shade*.94),255],i);
      relief.set([bump,bump,bump,255],i);
    }
  }
  const make=data=>{const texture=new THREE.DataTexture(data,width,height);texture.wrapS=THREE.RepeatWrapping;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;};
  return {color:make(color),relief:make(relief)};
}

export class Moon {
  constructor(scene) {
    this.scene=scene;this.worldPosition=new THREE.Vector3(...MOON_POSITION);
    const maps=textures();this.maps=maps;
    const geometry=new THREE.SphereGeometry(MOON_RADIUS,192,96);
    const position=geometry.attributes.position,normal=geometry.attributes.normal;
    const direction=new THREE.Vector3(),tangent=new THREE.Vector3(),bitangent=new THREE.Vector3(),offset=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      direction.fromBufferAttribute(normal,i).normalize();
      const height=moonSurface(...direction.toArray()).height;
      position.setXYZ(i,direction.x*(MOON_RADIUS+height),direction.y*(MOON_RADIUS+height),direction.z*(MOON_RADIUS+height));
      tangent.set(direction.z,0,-direction.x);if(tangent.lengthSq()<.001)tangent.set(1,0,0);tangent.normalize();
      bitangent.crossVectors(direction,tangent);
      const slope=axis=>{
        const a=offset.copy(direction).addScaledVector(axis,.001).normalize();const h=moonSurface(...a.toArray()).height;
        offset.copy(direction).addScaledVector(axis,-.001).normalize();
        return (h-moonSurface(...offset.toArray()).height)/(.002*MOON_RADIUS);
      };
      const tx=slope(tangent),ty=slope(bitangent);
      offset.copy(direction).addScaledVector(tangent,-tx).addScaledVector(bitangent,-ty).normalize();normal.setXYZ(i,offset.x,offset.y,offset.z);
    }
    geometry.computeBoundingSphere();
    this.material=new THREE.MeshStandardMaterial({map:maps.color,bumpMap:maps.relief,bumpScale:2,roughness:1,metalness:0,envMapIntensity:0});
    // Use the standard material's log-depth support. Lunar normals, textures and
    // vertices remain body-local; only the double-precision translation rebases.
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.name='Selene';this.mesh.castShadow=false;this.mesh.receiveShadow=false;
    scene.add(this.mesh);
    this.sun=new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);
  }
  update(origin) {
    this.mesh.position.copy(this.worldPosition).sub(origin);
    // Eclipse the moon when Aeon blocks its direct sunlight. The small ambient
    // component keeps the disk readable without giving it a self-lit texture.
    const toSun=this.sun.clone().sub(this.worldPosition).normalize(),along=-this.worldPosition.dot(toSun);
    const miss=this.worldPosition.clone().addScaledVector(toSun,Math.max(0,along)).length();
    const visibility=along>0?THREE.MathUtils.smoothstep(miss,RADIUS-MOON_RADIUS,RADIUS+MOON_RADIUS):1;
    this.material.color.setScalar(.035+.965*visibility);
  }
  dispose(){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.material.dispose();this.maps.color.dispose();this.maps.relief.dispose();}
}
