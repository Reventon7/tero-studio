import * as THREE from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {refineProduct} from './product-refinement.js';
const smooth=(p,a,b)=>THREE.MathUtils.smoothstep(p,a,b);
export function clinicalPose(p){return {chair:smooth(p,.12,.34),body:smooth(p,.26,.70),optics:smooth(p,.36,.65),light:smooth(p,.74,.88),amber:smooth(p,.9,.98)}};
export async function createHumanStudy(container,onProgress){
 const loader=new GLTFLoader();const names=['doctor','chair','stool','workstation','assembled'];
 const assets=await Promise.all(names.map(n=>loader.loadAsync(new URL(`./assets/models/${n}.glb`,import.meta.url).href)));
 const [doctor,chair,stool,work,eyewear]=assets.map(a=>a.scene);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.01,30);const target=new THREE.Vector3(0,.72,.22);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.05);scene.environment=env.texture;scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xdde8e6,0x202832,1.7));const key=new THREE.DirectionalLight(0xffecdc,2.4);key.position.set(-2,3,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.bias=-.0003;scene.add(key);const rim=new THREE.DirectionalLight(0x9fcae8,2.3);rim.position.set(2,2,-2);scene.add(rim);
 const stage=new THREE.Group();stage.add(doctor,chair,stool,work);scene.add(stage);
 doctor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});[chair,stool,work].forEach(g=>g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material=o.material.clone();}}));
 const floor=new THREE.Mesh(new THREE.CircleGeometry(2.3,96),new THREE.ShadowMaterial({opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
 const ring=new THREE.Mesh(new THREE.RingGeometry(1.12,1.125,128),new THREE.MeshBasicMaterial({color:0x60777e,transparent:true,opacity:.3,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.01;scene.add(ring);
 const mixer=new THREE.AnimationMixer(doctor),action=mixer.clipAction(assets[0].animations[0]);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const head=doctor.getObjectByName('head');const mount=new THREE.Group();mount.position.set(0,.81511+.00455-.77654,.12883+.02617-.04507);head.add(mount);refineProduct(eyewear);eyewear.scale.setScalar(.035);mount.add(eyewear);
 eyewear.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(o.name.startsWith('heroHousingPrint')&&o.material.map){o.material.map=o.material.map.clone();o.material.map.repeat.set(1,-1);o.material.map.offset.set(0,1);}}});
 const lamp=eyewear.getObjectByName('Light'),lampHead=new THREE.Group();lampHead.position.set(0,.86,.055);eyewear.updateMatrixWorld(true);const movingHead=lamp.children.slice(16);lamp.add(lampHead);lampHead.updateMatrixWorld(true);movingHead.forEach(o=>lampHead.attach(o));lampHead.rotation.x=.72;
 const filter=eyewear.getObjectByName('lampFilter'),closed=filter.quaternion.clone(),axis=new THREE.Vector3(0,0,1),q=new THREE.Quaternion();
 const spot=new THREE.SpotLight(0xf4f8ff,0,2.5,.18,.65,1.5);mount.add(spot);spot.position.set(0,.032,.026);spot.target.position.set(0,.837,.55);scene.add(spot.target);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.045,.004,1,32,1,true),new THREE.MeshBasicMaterial({color:0xe5f4ff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));scene.add(beam);const beamStart=new THREE.Vector3(),beamDirection=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const origin=new THREE.Vector3(),forward=new THREE.Vector3(),workPoint=new THREE.Vector3(0,.837,.55);
 const pathGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(),workPoint]);const guide=new THREE.Line(pathGeometry,new THREE.LineBasicMaterial({color:0xd8ed8a,transparent:true,opacity:0}));scene.add(guide);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;const state={p:0,manual:false};let shown=0,visible=false,disposed=false,last=-1;
 function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;const d=w/h<.8?3.65:3.15;camera.position.set(d*.89,1.65,d*.61);camera.lookAt(target);camera.updateProjectionMatrix();last=-1;}
 const ro=new ResizeObserver(resize);ro.observe(container);resize();const io=new IntersectionObserver(e=>visible=e[0].isIntersecting);io.observe(container);
 function fade(g,alpha){g.visible=alpha>.001;g.traverse(o=>{if(o.isMesh){o.material.transparent=alpha<.999;o.material.opacity=alpha;o.material.depthWrite=alpha>.95}})}
 const timer=new THREE.Timer();timer.connect(document);
 renderer.setAnimationLoop(()=>{timer.update();if(disposed||!visible||document.hidden)return;shown=THREE.MathUtils.lerp(shown,state.p,reduced()?1:Math.min(1,timer.getDelta()*9));if(Math.abs(shown-state.p)<.0001)shown=state.p;if(shown===last)return;last=shown;const pose=clinicalPose(shown);action.enabled=true;action.paused=false;mixer.setTime(Math.min(3.9999,pose.body*4));doctor.updateMatrixWorld(true);
 fade(chair,pose.chair);fade(stool,1-pose.chair);chair.position.x=(1-pose.chair)*-.32;stool.position.x=-pose.chair*.25;
 eyewear.visible=pose.optics>.001;eyewear.position.set((1-pose.optics)*1.8,(1-pose.optics)*4,(1-pose.optics)*5);filter.quaternion.copy(closed).multiply(q.setFromAxisAngle(axis,-2.95*(1-pose.amber)));
 spot.intensity=pose.light*5;spot.color.set(pose.amber>.8?0xffbd70:0xf4f8ff);
 mount.updateWorldMatrix(true,true);spot.getWorldPosition(beamStart);beamDirection.copy(workPoint).sub(beamStart);beam.position.copy(beamStart).addScaledVector(beamDirection,.5);beam.scale.y=beamDirection.length();beam.quaternion.setFromUnitVectors(up,beamDirection.normalize());beam.material.opacity=pose.light*.045;beam.material.color.copy(spot.color);mount.getWorldPosition(origin);forward.set(0,0,.09).applyMatrix4(mount.matrixWorld);const positions=pathGeometry.attributes.position;positions.setXYZ(0,origin.x,origin.y,origin.z);positions.setXYZ(1,forward.x,forward.y,forward.z);positions.setXYZ(2,workPoint.x,workPoint.y,workPoint.z);positions.needsUpdate=true;guide.material.opacity=pose.optics*(1-pose.light)*.6;
 container.dataset.phase=shown<.12?'before':shown<.36?'support':shown<.74?'perspective':'light';container.dataset.progress=shown.toFixed(3);onProgress(shown);renderer.render(scene,camera);container.classList.add('ready');});
 return {state,setProgress(p){state.p=THREE.MathUtils.clamp(p,0,1);last=-1},dispose(){disposed=true;renderer.setAnimationLoop(null);ro.disconnect();io.disconnect();timer.dispose();mixer.stopAllAction();const gs=new Set(),ms=new Set(),ts=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material)});ms.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)ts.add(v)});m.dispose()});ts.forEach(t=>t.dispose());gs.forEach(g=>g.dispose());env.dispose();renderer.dispose();renderer.domElement.remove()}};
}
