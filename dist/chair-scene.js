import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const initialView = { yaw: .68, pitch: .13 };

function restoreBackShell(product) {
  product.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.computeVertexNormals();
    mesh.material.flatShading = false;
    // The reference rear view shows an ivory shell behind the black cushion.
    // Preserve the baked texture elsewhere, including the cushion's rolled edge.
    mesh.material.onBeforeCompile = shader => {
      const varyings = 'varying vec3 chairPoint; varying vec3 chairNormal;\n';
      shader.vertexShader = varyings + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nchairPoint = position; chairNormal = normal;');
      shader.fragmentShader = varyings + shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float shellBody = smoothstep(.113, .145, chairPoint.y)
          * (1.0 - smoothstep(.485, .503, chairPoint.y))
          * (1.0 - smoothstep(.166, .197, abs(chairPoint.x - .012)))
          * (1.0 - smoothstep(-.188, -.154, chairPoint.z));
        float shellFacing = smoothstep(.42, .65, -normalize(chairNormal).z);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.71, .69, .65), shellBody * shellFacing);
      `);
    };
  });
}

export async function createChairScene(container, modelBytes) {
  const loader = new GLTFLoader();
  const { scene: product } = modelBytes
    ? await loader.parseAsync(modelBytes, '')
    : await loader.loadAsync('/assets/models/tero-chair-higgsfield-v1.glb');
  restoreBackShell(product);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Rotate the TERO chair with the arrow keys. Use plus or minus to zoom, or Home to reset.');
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
  camera.position.set(0, 1.8, 5.8);
  camera.lookAt(focus);
  await renderer.compileAsync(scene, camera);
  const desired = { ...initialView };
  const current = { ...initialView };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let distance = 5.8;
  let zoom = 1;
  let desiredZoom = 1;
  let frame = 0;
  let drag;
  let visible = false;
  const controls = document.querySelector('#chair-controls');
  const zoomOut = controls.querySelector('[data-chair-action="out"]');
  const zoomIn = controls.querySelector('[data-chair-action="in"]');

  function draw() {
    frame = 0;
    if (!visible) return;
    current.yaw = THREE.MathUtils.lerp(current.yaw, desired.yaw, reduced.matches ? 1 : .28);
    current.pitch = THREE.MathUtils.lerp(current.pitch, desired.pitch, reduced.matches ? 1 : .28);
    zoom = THREE.MathUtils.lerp(zoom, desiredZoom, reduced.matches ? 1 : .24);
    const radius = distance / zoom;
    const horizontal = radius * Math.cos(current.pitch);
    camera.position.set(Math.sin(current.yaw) * horizontal, focus.y + Math.sin(current.pitch) * radius, Math.cos(current.yaw) * horizontal);
    camera.lookAt(focus);
    renderer.render(scene, camera);
    container.classList.add('ready');
    controls.hidden = false;
    if (Math.abs(current.yaw - desired.yaw) + Math.abs(current.pitch - desired.pitch) + Math.abs(zoom - desiredZoom) > .001) schedule();
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
    if (visible) schedule();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
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
  function setZoom(value) {
    desiredZoom = THREE.MathUtils.clamp(value, .85, 1.75);
    zoomOut.disabled = desiredZoom === .85;
    zoomIn.disabled = desiredZoom === 1.75;
    schedule();
  }
  function reset() {
    Object.assign(desired, initialView);
    setZoom(1);
  }
  function toggleZoom() {
    setZoom(desiredZoom > 1.1 ? 1 : 1.55);
  }
  function useControl(event) {
    switch (event.target.closest('button')?.dataset.chairAction) {
      case 'out': setZoom(desiredZoom - .23); break;
      case 'in': setZoom(desiredZoom + .23); break;
      case 'reset': reset(); break;
    }
  }
  function keyboard(event) {
    switch (event.key) {
      case 'Home': reset(); break;
      case '+':
      case '=': setZoom(desiredZoom + .23); break;
      case '-': setZoom(desiredZoom - .23); break;
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
    controls.hidden = true;
  }

  const listeners = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up,
    lostpointercapture: up, dblclick: toggleZoom, keydown: keyboard, webglcontextlost: lost, webglcontextrestored: schedule };
  for (const [event, listener] of Object.entries(listeners)) canvas.addEventListener(event, listener);
  controls.addEventListener('click', useControl);
  return { dispose() {
    cancelAnimationFrame(frame);
    resize.disconnect();
    observer.disconnect();
    controls.removeEventListener('click', useControl);
    controls.hidden = true;
    for (const [event, listener] of Object.entries(listeners)) canvas.removeEventListener(event, listener);
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
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
