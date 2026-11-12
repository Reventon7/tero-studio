import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
export async function createChairScene(container){
 const asset=await new GLTFLoader().loadAsync(new URL('./assets/models/chair.glb',import.meta.url).href);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Rotate the TERO chair with arrow keys or drag. Home resets the view.');container.appendChild(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,50);camera.position.set(0,1.5,5.7);camera.lookAt(0,1.1,0);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xfff4df,2.1);key.position.set(-3,5,4);const rim=new THREE.DirectionalLight(0xb6cfe3,1.8);rim.position.set(3,3,-3);scene.add(key,rim,new THREE.HemisphereLight(0xffffff,0x5c6670,1.2));
 const model=new THREE.Group();scene.add(model);const product=asset.scene;const bounds=new THREE.Box3().setFromObject(product),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const scale=2.4/size.y;product.position.set(-center.x,-bounds.min.y,-center.z);const normalizer=new THREE.Group();normalizer.add(product);normalizer.scale.setScalar(scale);model.add(normalizer);
 product.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.material.metalness>.5)o.material.roughness=Math.max(.27,o.material.roughness);}});
 // Soft studio contact shadow, independent of the product geometry.
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,3.5),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 uvv;void main(){uvv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 uvv;void main(){float d=length((uvv-.5)*2.0);gl_FragColor=vec4(.12,.16,.18,.2*exp(-6.0*d*d));}'}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.008;scene.add(shadow);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;const state={yaw:.65,progress:0,paused:reduced()};let visible=false,drag=null,disposed=false,angle=.65;
 const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.z=w/h<.8?6.9:5.7;camera.updateProjectionMatrix()};const ro=new ResizeObserver(resize);ro.observe(container);resize();
 const io=new IntersectionObserver(e=>visible=e[0].isIntersecting);io.observe(container);
 const trigger=window.ScrollTrigger?.create({trigger:'#seating',start:'top bottom',end:'bottom top',onUpdate:s=>state.progress=s.progress});
 const timer=new THREE.Timer();timer.connect(document);
 renderer.setAnimationLoop(()=>{timer.update();if(disposed||!visible||document.hidden)return;const target=state.yaw+(reduced()||state.paused?0:(state.progress-.5)*.65);angle=THREE.MathUtils.lerp(angle,target,reduced()?1:.09);model.rotation.y=angle;renderer.render(scene,camera);container.classList.add('ready');});
 function down(e){if(e.button!==0)return;drag={x:e.clientX,yaw:state.yaw};canvas.setPointerCapture(e.pointerId)}function move(e){if(drag)state.yaw=drag.yaw+(e.clientX-drag.x)*.009}function up(){drag=null}function keyboard(e){if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();state.yaw=e.key==='Home'?.65:state.yaw+(e.key==='ArrowLeft'?-.25:.25)}}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',keyboard);
 return {state,view(index){const yaw=[.65,0,Math.PI/2,Math.PI][index];if(window.gsap&&!reduced())gsap.to(state,{yaw,duration:1.3,ease:'power3.inOut',overwrite:true});else state.yaw=yaw;container.dataset.view=['three-quarter','front','side','rear'][index]},dispose(){disposed=true;trigger?.kill();window.gsap?.killTweensOf(state);ro.disconnect();io.disconnect();timer.dispose();renderer.setAnimationLoop(null);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();canvas.remove()}};
}
