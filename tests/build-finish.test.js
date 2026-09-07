import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture,ShaderLib} from 'three';
import {setBuildOpacity,disposeBuildVisual} from '../src/build/visuals.js';

test('fading one base instance preserves other instances, authored vertex colours and shared textures',()=>{
 const geometry=new BoxGeometry(),texture=new Texture(),source=new MeshStandardMaterial({map:texture,vertexColors:true});
 const template=new Group();template.add(new Mesh(geometry,source),new Mesh(geometry,source));
 const first=template.clone(true),second=template.clone(true);
 setBuildOpacity(first,.25);setBuildOpacity(second,1);
 assert.equal(source.transparent,false);assert.equal(source.opacity,1);assert.equal(source.userData.buildFadeUniform,undefined);
 assert.equal(first.children[0].material,first.children[1].material,'one private material per shared source');
 assert.notEqual(first.children[0].material,second.children[0].material);
 assert.equal(first.children[0].material.userData.buildFadeUniform.value,.25);
 assert.equal(second.children[0].material.userData.buildFadeUniform.value,1);
 assert.equal(first.children[0].material.vertexColors,true);
 assert.equal(first.children[0].material.map,texture);
 assert.equal(first.children[0].geometry,geometry);
 setBuildOpacity(first,.75);
 assert.equal(first.children[0].material.userData.buildFadeUniform.value,.75);
 let geometryDisposed=false,textureDisposed=false,privateDisposed=0;
 geometry.addEventListener('dispose',()=>geometryDisposed=true);texture.addEventListener('dispose',()=>textureDisposed=true);
 first.children[0].material.addEventListener('dispose',()=>privateDisposed++);
 disposeBuildVisual(first);assert.equal(privateDisposed,1);assert.equal(geometryDisposed,false);assert.equal(textureDisposed,false);
});

test('native logarithmic depth and shading survive coverage injection, including late console materials',()=>{
 const root=new Group();root.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));setBuildOpacity(root,.5);
 const shader={uniforms:{},fragmentShader:ShaderLib.standard.fragmentShader};
 root.children[0].material.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('#include <logdepthbuf_fragment>'));
 assert.ok(shader.fragmentShader.includes('#include <lights_fragment_begin>'));
 assert.ok(shader.fragmentShader.includes('if (coverage >= buildVisibility) discard;'));
 assert.equal(shader.uniforms.buildVisibility.value,.5);
 const display=new Mesh(new BoxGeometry(),new MeshStandardMaterial());root.add(display);setBuildOpacity(root,.3);
 assert.equal(display.material.userData.buildFadeUniform,root.children[0].material.userData.buildFadeUniform);
 assert.equal(shader.uniforms.buildVisibility.value,.3);
});
