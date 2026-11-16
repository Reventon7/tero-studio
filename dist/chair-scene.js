import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const initialView = { yaw: .68, pitch: .13 };

function upholsteryGrain() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = 90 + ((Math.imul(i + 1, 1597334677) >>> 24) % 82);
    image.data.set([shade, shade, shade, 255], i);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

function contourCushion(mesh, crown) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  for (let i = 0; i < position.count; i++) {
    const x = (position.getX(i) - center.x) * 2 / size.x;
    const y = (position.getY(i) - center.y) * 2 / size.y;
    const z = position.getZ(i);
    const face = THREE.MathUtils.smoothstep(z, center.z, geometry.boundingBox.max.z);
    position.setZ(i, z + crown * face * Math.max(0, 1 - x * x - y * y));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (!geometry.hasAttribute('uv')) {
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      uv[i * 2] = (position.getX(i) - center.x) / size.x + .5;
      uv[i * 2 + 1] = (position.getY(i) - center.y) / size.y + .5;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
}

function finishChair(product, grain) {
  const cushions = new Map([
    ['teroSeat', .008], ['teroBackCushion', .011], ['teroForearmPad', .005]
  ]);
  product.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = mesh.name.replace(/_\d+$/, '');
    if (cushions.has(name)) {
      // Re-contour the padded faces while retaining the measured mounting points.
      contourCushion(mesh, cushions.get(name));
      mesh.material = new THREE.MeshPhysicalMaterial({ color: 0x1a1b1d, roughness: .63,
        sheen: .14, sheenRoughness: .7, sheenColor: 0x454847,
        bumpMap: grain, bumpScale: .00075 });
    } else if (/^tero(?:ChromeSpoke|GasColumn)$/.test(name)) {
      mesh.material = new THREE.MeshStandardMaterial({ color: 0xc5c9cc, metalness: .96, roughness: .2 });
    } else if (name === 'teroBackShell' || name === 'teroSeatShell') {
      mesh.material = new THREE.MeshPhysicalMaterial({ color: 0xe4e3dc, roughness: .36, clearcoat: .22, clearcoatRoughness: .43 });
    } else if (name === 'teroCasterWheel') {
      mesh.material = new THREE.MeshStandardMaterial({ color: 0x666a6b, roughness: .67 });
    }
  });
}

export async function createChairScene(container) {
  const { scene: product } = await new GLTFLoader().loadAsync(new URL('./assets/models/chair.glb', import.meta.url).href);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Rotate the TERO chair with the arrow keys. Press Home to reset.');
  container.append(canvas);

  const scene = new THREE.Scene();
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .065);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.17;
  room.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xfff3e4, 2.4);
  key.position.set(-3.5, 5, 4);
  const rim = new THREE.DirectionalLight(0xe0eeff, 2.8);
  rim.position.set(3, 4, -4);
  scene.add(key, rim, new THREE.HemisphereLight(0xdce7f2, 0x413d36, .65));

  const grain = upholsteryGrain();
  const materials = new Set();
  product.traverse(node => { if (node.isMesh) materials.add(node.material); });
  finishChair(product, grain);
  const bounds = new THREE.Box3().setFromObject(product);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  product.position.set(-center.x, -bounds.min.y, -center.z);
  const model = new THREE.Group();
  model.add(product);
  model.scale.setScalar(2.4 / size.y);
  scene.add(model);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 uvv;void main(){uvv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 uvv;void main(){float d=length((uvv-.5)*2.0);float fade=1.-smoothstep(.2,1.,d);gl_FragColor=vec4(.015,.018,.022,fade*.38*exp(-3.3*d*d));}'
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .008;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(31, 1, .05, 50);
  const focus = new THREE.Vector3(0, 1.18, 0);
  const desired = { ...initialView };
  const current = { ...initialView };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let distance = 5.8;
  let frame = 0;
  let drag;
  let visible = false;

  function draw() {
    frame = 0;
    current.yaw = THREE.MathUtils.lerp(current.yaw, desired.yaw, reduced.matches ? 1 : .28);
    current.pitch = THREE.MathUtils.lerp(current.pitch, desired.pitch, reduced.matches ? 1 : .28);
    const horizontal = distance * Math.cos(current.pitch);
    camera.position.set(Math.sin(current.yaw) * horizontal, focus.y + Math.sin(current.pitch) * distance, Math.cos(current.yaw) * horizontal);
    camera.lookAt(focus);
    renderer.render(scene, camera);
    container.classList.add('ready');
    if (Math.abs(current.yaw - desired.yaw) + Math.abs(current.pitch - desired.pitch) > .001) schedule();
  }

  function schedule() {
    if (!frame && visible) frame = requestAnimationFrame(draw);
  }

  const resize = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    distance = Math.max(5.5, 4.2 / camera.aspect);
    camera.updateProjectionMatrix();
    schedule();
  });
  resize.observe(container);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  observer.observe(container);

  function down(event) {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ...desired };
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = 'true';
  }
  function move(event) {
    if (drag?.id !== event.pointerId) return;
    desired.yaw = drag.yaw - (event.clientX - drag.x) * .011;
    desired.pitch = THREE.MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * .006, -.15, .62);
    schedule();
  }
  function up(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    delete canvas.dataset.dragging;
  }
  function keyboard(event) {
    switch (event.key) {
      case 'Home': Object.assign(desired, initialView); break;
      case 'ArrowLeft': desired.yaw += .22; break;
      case 'ArrowRight': desired.yaw -= .22; break;
      case 'ArrowUp': desired.pitch = Math.min(.62, desired.pitch + .10); break;
      case 'ArrowDown': desired.pitch = Math.max(-.15, desired.pitch - .10); break;
      default: return;
    }
    event.preventDefault();
    schedule();
  }
  function lost(event) {
    event.preventDefault();
    container.classList.remove('ready');
  }

  const listeners = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up,
    lostpointercapture: up, keydown: keyboard, webglcontextlost: lost, webglcontextrestored: schedule };
  for (const [event, listener] of Object.entries(listeners)) canvas.addEventListener(event, listener);
  return { dispose() {
    cancelAnimationFrame(frame);
    resize.disconnect();
    observer.disconnect();
    for (const [event, listener] of Object.entries(listeners)) canvas.removeEventListener(event, listener);
    const geometries = new Set();
    const textures = new Set([grain]);
    scene.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) materials.add(node.material);
    });
    materials.forEach(material => {
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
      material.dispose();
    });
    textures.forEach(texture => texture.dispose());
    geometries.forEach(geometry => geometry.dispose());
    environment.dispose();
    renderer.dispose();
    canvas.remove();
  } };
}
