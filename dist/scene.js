import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {refineProduct,heroPose} from './product-refinement.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';

// Supplied TERO GLB assets. Preserve their geometry, materials and filter hinge.
export async function createProductScene(container, {reducedMotion=false,lightingOnly=false,onReady=()=>{},modelBytes}={}) {
 const loader=new GLTFLoader();
 const modelPath=lightingOnly?'/assets/models/light-v1.glb':'/assets/models/assembled.glb';
 const asset=modelBytes ? await loader.parseAsync(modelBytes, '') : await loader.loadAsync(modelPath);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.0;
 renderer.setClearColor(0x000000,0);
 const canvas=renderer.domElement;
 canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',lightingOnly?'Rotate the headlight with arrow keys or drag. Press Home to reset.':'Rotate the 3D loupe with arrow keys or drag. Press Home to reset.');
 container.appendChild(canvas);
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(31,1,.1,80);
 camera.position.set(0,1.3,12.6);camera.lookAt(0,0,0);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);
 scene.environment=environment.texture;scene.environmentIntensity=1.0;
 room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xe4f0ff,2.5);key.position.set(-3,5,5);
 const rim=new THREE.DirectionalLight(0x9fb8d3,3);rim.position.set(5,2,-3);
 const fill=new THREE.DirectionalLight(0xffffff,1.5);fill.position.set(2,-2,7);
 scene.add(key,rim,fill,new THREE.HemisphereLight(0xdceaff,0x283440,.7));
 const model=new THREE.Group();scene.add(model);
 const product=asset.scene;refineProduct(product);model.add(product);
 // The exported housing print is inverted in its UV map; orient the supplied artwork.
 product.traverse(o=>{if(o.name.startsWith('heroHousingPrint')&&o.material?.map){o.material=o.material.clone();o.material.map=o.material.map.clone();o.material.map.repeat.set(1,-1);o.material.map.offset.set(0,1);o.material.map.needsUpdate=true}});
 const lamp=product.getObjectByName('Light');
 const frame=product.getObjectByName('Frame');
 const loupes=product.getObjectByName('Loupes');
 const explodedParts=[];
 if(loupes)for(const object of loupes.children){
  const side=object.position.x<0?-1:1;
  // Separate whole optical assemblies; do not invent internal lens construction.
  explodedParts.push({object,base:object.position.clone(),offset:new THREE.Vector3(side*.23,-.22,1.05)});
 }
 const filter=product.getObjectByName('lampFilter');
 const filterClosed=filter.quaternion.clone();
 const filterAxis=new THREE.Vector3(0,0,1),filterRotation=new THREE.Quaternion();
 filter.material=filter.material.clone();filter.material.opacity=.62;filter.material.depthWrite=false;
 const shell=product.getObjectByName('lampShell');
 const head=new THREE.Group();head.position.copy(shell.position);head.quaternion.copy(shell.quaternion);lamp.add(head);
 const emitter=new THREE.Mesh(new THREE.CircleGeometry(.183,48),new THREE.MeshBasicMaterial({color:0xfffaf0,transparent:true,opacity:.92,depthWrite:false}));
 emitter.position.z=.69;head.add(emitter);
 const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{strength:{value:0},beamColor:{value:new THREE.Color(0xf2f6ff)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float strength;uniform vec3 beamColor;void main(){float edge=pow(sin(vUv.x*3.14159265),2.0);float a=pow(1.0-vUv.y,1.8)*0.2*strength;gl_FragColor=vec4(beamColor,a*edge);}'});
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.95,.18,2.8,64,1,true),beamMaterial);beam.rotation.x=Math.PI/2;beam.position.z=2.1;head.add(beam);
 const white=new THREE.Color(0xf2f6ff),warm=new THREE.Color(0xffad55);
 if(lightingOnly){product.position.set(0,-.78,-.1);model.scale.setScalar(3.15)}
 const templeMaterials=[];
 frame?.traverse(o=>{if(o.isMesh&&o.name.startsWith('heroTemple')){o.material=o.material.clone();templeMaterials.push(o.material)}});
 const motionReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const state={progress:0,exploded:false,paused:reducedMotion,color:'black',filter:0,rotationX:0,rotationY:0};
 let disposed=false,drag=null,smoothed=0,explodeSmooth=0,rx=0,ry=0,first=true;
 const timer=new THREE.Timer();timer.connect(document);
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.position.z=w/h<1.15?16:12.6;camera.updateProjectionMatrix()}
 const resizer=new ResizeObserver(resize);resizer.observe(container);resize();
 await renderer.compileAsync(scene,camera);
 const observer = new IntersectionObserver(([entry]) => {
  renderer.setAnimationLoop(entry.isIntersecting ? render : null);
 });
 observer.observe(container);
 function down(e){if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,rx:state.rotationX,ry:state.rotationY};canvas.setPointerCapture(e.pointerId)}
 function move(e){if(!drag)return;state.rotationY=drag.ry+(e.clientX-drag.x)*.007;state.rotationX=THREE.MathUtils.clamp(drag.rx+(e.clientY-drag.y)*.004,-.7,.7)}
 function up(){drag=null}
 function reset(){state.rotationX=0;state.rotationY=0;state.exploded=false}
 function keyboard(e){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')reset();if(e.key==='ArrowLeft')state.rotationY-=.2;if(e.key==='ArrowRight')state.rotationY+=.2;if(e.key==='ArrowUp')state.rotationX-=.1;if(e.key==='ArrowDown')state.rotationX+=.1;state.rotationX=THREE.MathUtils.clamp(state.rotationX,-.7,.7)}}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',keyboard);
 function lost(e){e.preventDefault();container.classList.remove('ready');container.classList.add('fallback-only');container.querySelector('.scene-loading').textContent='3D paused. Product photography shown.'}
 function restored(){container.classList.remove('fallback-only');container.classList.add('ready')}
 canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
 function render(){
  timer.update();if(disposed||document.hidden)return;
  const dt=Math.min(timer.getDelta(),.05),t=timer.getElapsed(),damp=reducedMotion?1:1-Math.exp(-dt*7);
  smoothed+=(state.progress-smoothed)*damp;rx+=(state.rotationX-rx)*damp;ry+=(state.rotationY-ry)*damp;
  // End pose cannot lag behind the sticky-section release on a fast scroll.
  if(state.progress>=.94)smoothed=Math.max(smoothed,.90);
  const pose=heroPose(smoothed);
  const architecture=pose.separate;
  const illumination=pose.lamp;
  const manual=state.exploded?(1-THREE.MathUtils.smoothstep(smoothed,.48,.64)):0;
  const ex=Math.max(manual,architecture);explodeSmooth=ex;
  model.rotation.set((lightingOnly?.12:.12+architecture*.1)+rx,(lightingOnly?-.6:-.62+pose.turn*1.4)+ry,lightingOnly?-.12:-.14+architecture*.24-illumination*.04);
  model.position.set(lightingOnly?-.35:0,-.08+architecture*.32+(state.paused||reducedMotion?0:Math.sin(t*.65)*.055),0);
  model.scale.setScalar(lightingOnly?3.15:1.25-architecture*.13);
  explodedParts.forEach(({object,base,offset})=>object.position.copy(base).addScaledVector(offset,explodeSmooth));
  lamp.visible=lightingOnly||illumination>.01;lamp.position.y=lightingOnly?0:(1-illumination)*1.2;beamMaterial.uniforms.strength.value=lightingOnly?1:illumination;
  const filterProgress=lightingOnly?state.filter:pose.filter;
  filter.quaternion.copy(filterClosed).multiply(filterRotation.setFromAxisAngle(filterAxis,-2.95*(1-filterProgress)));
  const warmth=THREE.MathUtils.smoothstep(filterProgress,.72,.98);
  beamMaterial.uniforms.beamColor.value.copy(white).lerp(warm,warmth);emitter.material.color.copy(white).lerp(warm,warmth);
  container.dataset.filter=filterProgress>.98?'amber':filterProgress<.02?'white':'moving';
  if(!lightingOnly){container.dataset.assembly=ex<.001&&illumination>.999?'complete':'assembling';container.dataset.phase=smoothed>=.86?'amber-hold':smoothed>=.74?'filter-closing':smoothed>=.70?'white-light':smoothed>=.46?'assembly':'optics';}
  rim.intensity=3+illumination*2;scene.environmentIntensity=1.0+architecture*.2;renderer.toneMappingExposure=1.0+architecture*.05;
  renderer.render(scene,camera);
  if(first){first=false;container.classList.add('ready');onReady()}
 }
 return {state,reset,setFilter(progress, { immediate = false } = {}) {
  if (!immediate && window.gsap && !motionReduced()) {
   gsap.to(state, { filter: progress, duration: 1.15, ease: 'power2.inOut', overwrite: 'auto' });
  } else {
   window.gsap?.killTweensOf(state, 'filter');
   state.filter = progress;
  }
 },setProgress(p){state.progress=p},setColor(color){const palette={black:0x20272c,blue:0x253e5c,red:0x6c2d38};templeMaterials.forEach(m=>m.color.setHex(palette[color]||palette.black))},dispose(){disposed=true;window.gsap?.killTweensOf(state);renderer.setAnimationLoop(null);resizer.disconnect();observer.disconnect();timer.dispose();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',keyboard);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);const geometries=new Set(),materials=new Set(),textures=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v)});m.dispose()});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());environment.dispose();renderer.dispose();canvas.remove()}};
}
