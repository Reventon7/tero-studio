const FRAME_RATE = 48;
const FRAMES_PER_SHEET = 4;
const NETWORK_LIMIT = 4;
const BLOB_LIMIT = 15;
const GUIDE_STEP = 3;
const GUIDE_COLUMNS = 12;
const GUIDE_WIDTH = 256;
const GUIDE_HEIGHT = 144;
const MAX_SCRUB_GAP = FRAME_RATE;
const POSITION_EPSILON = .15;
const VELOCITY_EPSILON = .002;
const sheetAt = frame => Math.floor(Math.round(frame) / FRAMES_PER_SHEET);

export function createScrollFilm(canvas, ambient, motion, {
  directory, frameCount, openingFrame = 0, widths = [1280, 832],
  ambientMedia = '(max-aspect-ratio: 8/5), (min-aspect-ratio: 21/9)', ambientStrip, onFrame,
  settleTime = 95, retainEndpoints = false
}) {
  const lastSheet = sheetAt(frameCount - 1);
  const openingSheet = sheetAt(openingFrame);
  // The pinned dentist sequence needs its first and last frames ready in both directions.
  const endpointSheets = retainEndpoints ? [openingSheet, lastSheet] : [];
  const network = navigator.connection;
  const compact = matchMedia('(max-width: 1040px)').matches ||
    (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) ||
    network?.saveData || /2g/.test(network?.effectiveType ?? '');
  const decodeLimit = compact ? 1 : 2;
  const width = widths[compact ? 1 : 0];
  const height = width * 9 / 16;
  const prefix = compact ? 'compact' : 'frame';
  const cacheLimit = Math.max(3, Math.min(7, Math.floor((compact ? 42 : 104) * 2 ** 20 / (width * height * 16))));
  // Decode to the resolution the viewport can use. Keep the source tiers for wide/high-DPI screens.
  const viewWidth = Math.ceil(innerWidth * Math.min(devicePixelRatio, 1.5) * 1.08 / 16) * 16;
  canvas.width = Math.min(width, Math.max(768, viewWidth));
  canvas.height = canvas.width * 9 / 16;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { setProgress() {}, setActive() {} };
  const ambientLayout = matchMedia(ambientMedia);
  if (ambientStrip) {
    ambient.width = compact ? 256 : 960;
    ambient.height = ambient.width * 9 / 16;
  }
  const stripLayout = ambientStrip && matchMedia(ambientStrip.media);
  const ambientContext = ambient.getContext('2d', { alpha: false });
  const floorPatch = ambientStrip && document.createElement('canvas');
  let floorContext, floorFade, floorY;
  if (floorPatch) {
    floorY = Math.round(ambient.height * ambientStrip.floor.top);
    floorPatch.width = Math.round(ambient.width * ambientStrip.width);
    floorPatch.height = ambient.height - floorY;
    floorContext = floorPatch.getContext('2d');
    if (floorContext) {
      const fadeHeight = ambient.height * (ambientStrip.floor.fadeEnd - ambientStrip.floor.top);
      floorFade = floorContext.createLinearGradient(0, 0, 0, fadeHeight);
      floorFade.addColorStop(0, 'transparent');
      floorFade.addColorStop(1, '#000');
    }
  }

  const compressed = new Map();
  const pending = new Map();
  const decoded = new Map();
  const decoding = new Set();
  const failures = new Map();
  let decodeWindow = [];
  let active = true;
  let target = openingFrame;
  let position = motion.matches ? openingFrame : 0;
  let velocity = 0;
  let drawn = -1;
  let drawnSource;
  let request = 0;
  let lastTime = 0;
  let opening = openingFrame > 0 && !motion.matches;
  let openingTime;
  let direction = 1;
  let retryTimer;
  const guideEnd = Math.ceil((frameCount - 1) / GUIDE_STEP);
  const guide = new Image();
  const guideCanvas = document.createElement('canvas');
  guideCanvas.className = 'film-frames';
  guideCanvas.setAttribute('aria-hidden', 'true');
  guideCanvas.width = GUIDE_WIDTH;
  guideCanvas.height = GUIDE_HEIGHT;
  const guideContext = guideCanvas.getContext('2d', { alpha: false });
  let guideReady = false;
  let guideRequested = false;
  let ambientReady = false;

  function prepareGuide() {
    if (guideRequested || motion.matches || !guideContext) return;
    guideRequested = true;
    canvas.after(guideCanvas);
    guide.fetchPriority = openingFrame ? 'high' : 'auto';
    guide.src = new URL('./assets/' + directory + '/guide-v1.webp', import.meta.url).href;
    guide.decode().then(() => {
      guideReady = true;
      schedule();
    }).catch(() => { /* Full-resolution sheets remain available. */ });
  }

  function download(index, priority) {
    const controller = new AbortController();
    pending.set(index, controller);
    const filename = prefix + '-' + String(index).padStart(3, '0') + '.webp';
    const url = new URL('./assets/' + directory + '/' + filename, import.meta.url);
    fetch(url, { signal: controller.signal, priority }).then(result => {
      if (!result.ok) throw new Error('Film frame sheet unavailable');
      return result.blob();
    }).then(blob => {
      failures.delete(index);
      compressed.set(index, blob);
      if (compressed.size > BLOB_LIMIT) compressed.delete(compressed.keys().next().value);
    }).catch(error => {
      if (error.name !== 'AbortError') {
        failures.set(index, performance.now() + 1250);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(schedule, 1300);
      }
    }).finally(() => {
      pending.delete(index);
      schedule();
    });
  }

  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try {
        return canvas.width < width
          ? await createImageBitmap(blob, { resizeWidth: canvas.width * 2, resizeHeight: canvas.height * 2, resizeQuality: 'medium' })
          : await createImageBitmap(blob);
      } catch { /* Use the image decoder. */ }
    }
    const image = new Image();
    const url = URL.createObjectURL(blob);
    try {
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function trimCache() {
    for (const [index, image] of decoded) {
      if (decoded.size <= cacheLimit) return;
      if (decodeWindow.includes(index) || endpointSheets.includes(index)) continue;
      image.close?.();
      decoded.delete(index);
    }
  }

  function loadAround(current, destination) {
    const nearby = [...new Set([
      current, ...endpointSheets, destination, current + direction,
      current - direction, destination + direction, current + direction * 2
    ])].filter(index => index >= 0 && index <= lastSheet);
    decodeWindow = nearby.slice(0, cacheLimit);
    const now = performance.now();
    const needsDownload = index => !decoded.has(index) && !compressed.has(index) &&
      !decoding.has(index) && !pending.has(index) && (failures.get(index) ?? 0) <= now;

    // A fast scroll can make queued requests irrelevant. Free one slot for the new frame.
    if (pending.size >= NETWORK_LIMIT && needsDownload(current)) {
      const obsolete = [...pending].find(([index, controller]) =>
        !nearby.includes(index) && !controller.signal.aborted);
      obsolete?.[1].abort();
    }
    for (const index of nearby) {
      if (pending.size >= NETWORK_LIMIT) break;
      if (needsDownload(index)) download(index, index === current || index === destination ? 'high' : 'low');
    }

    for (const index of decodeWindow) {
      if (decoding.size >= decodeLimit) break;
      if (decoded.has(index) || decoding.has(index) || !compressed.has(index)) continue;
      const blob = compressed.get(index);
      compressed.delete(index);
      compressed.set(index, blob);
      decoding.add(index);
      decode(blob).then(image => {
        if (!active && !endpointSheets.includes(index)) {
          image.close?.();
          return;
        }
        decoded.set(index, image);
        trimCache();
      }).catch(() => {
        compressed.delete(index);
        failures.set(index, performance.now() + 1250);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(schedule, 1300);
      }).finally(() => {
        decoding.delete(index);
        schedule();
      });
    }
  }

  function drawAmbient(image, x, y, sourceWidth, sourceHeight) {
    if (!stripLayout?.matches || !floorContext) {
      ambientContext.drawImage(image, x, y, sourceWidth, sourceHeight, 0, 0, ambient.width, ambient.height);
      return;
    }

    const { background, floor, width: stripWidth } = ambientStrip;
    const tileWidth = Math.round(ambient.width * (background.right - background.left));
    // Reflect the clean wall detail edge to edge, preserving the grain scale.
    for (let offset = 0; offset < floorPatch.width; offset += tileWidth) {
      const mirrored = Math.floor(offset / tileWidth) % 2 === 1;
      ambientContext.save();
      ambientContext.translate(offset + (mirrored ? tileWidth : 0), 0);
      if (mirrored) ambientContext.scale(-1, 1);
      ambientContext.drawImage(
        image, x + sourceWidth * background.left, y, sourceWidth * tileWidth / ambient.width, sourceHeight,
        0, 0, tileWidth, ambient.height
      );
      ambientContext.restore();
    }

    // Copy a clean patch of floor at its original scale and vertical position.
    // Blend only its upper edge into the dark background above.
    const floorSourceY = sourceHeight * floorY / ambient.height;
    floorContext.globalCompositeOperation = 'copy';
    floorContext.drawImage(
      image, x + sourceWidth * floor.left, y + floorSourceY, sourceWidth * stripWidth, sourceHeight - floorSourceY,
      0, 0, floorPatch.width, floorPatch.height
    );
    floorContext.globalCompositeOperation = 'destination-in';
    floorContext.fillStyle = floorFade;
    floorContext.fillRect(0, 0, floorPatch.width, floorPatch.height);
    ambientContext.drawImage(floorPatch, 0, floorY);
  }

  function draw(frame, force = false) {
    const index = sheetAt(frame);
    const sheet = decoded.get(index);
    const sample = frame === frameCount - 1 ? guideEnd : Math.round(frame / GUIDE_STEP);
    const visualFrame = sheet ? frame : Math.min(sample * GUIDE_STEP, frameCount - 1);
    const image = sheet ?? (guideReady ? guide : null);
    if (!image || (!force && visualFrame === drawn && (image === drawnSource || !sheet))) return;
    const tile = sheet ? frame % FRAMES_PER_SHEET : sample;
    const columns = sheet ? 2 : GUIDE_COLUMNS;
    const sourceWidth = sheet ? (sheet.naturalWidth || sheet.width) / 2 : GUIDE_WIDTH;
    const sourceHeight = sheet ? (sheet.naturalHeight || sheet.height) / 2 : GUIDE_HEIGHT;
    const x = tile % columns * sourceWidth;
    const y = Math.floor(tile / columns) * sourceHeight;
    if (sheet) context.drawImage(image, x, y, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    else guideContext.drawImage(image, x, y, sourceWidth, sourceHeight, 0, 0, GUIDE_WIDTH, GUIDE_HEIGHT);
    if (ambientContext && ambientLayout.matches) {
      drawAmbient(image, x, y, sourceWidth, sourceHeight);
      if (!ambientReady) {
        ambientReady = true;
        ambient.classList.add('ready');
      }
    }
    const quality = sheet ? 'full' : 'guide';
    if (canvas.dataset.quality !== quality) {
      canvas.classList.toggle('ready', Boolean(sheet));
      guideCanvas.classList.toggle('ready', !sheet);
      canvas.dataset.quality = quality;
    }
    canvas.dataset.frame = String(visualFrame);
    drawn = visualFrame;
    drawnSource = image;
    // Captions follow the displayed frame even when the guide is active.
    onFrame?.(visualFrame);
    if (sheet) {
      decoded.delete(index);
      decoded.set(index, sheet);
    }
  }

  function advance(elapsed) {
    const displacement = position - target;
    if (motion.matches ||
        (Math.abs(displacement) < POSITION_EPSILON && Math.abs(velocity) < VELOCITY_EPSILON)) {
      position = target;
      velocity = 0;
      return;
    }

    // Critically damped motion preserves speed across wheel events and brakes
    // toward the latest scroll position without oscillating around it.
    const drift = velocity + displacement / settleTime;
    const decay = Math.exp(-elapsed / settleTime);
    const next = target + (displacement + drift * elapsed) * decay;
    velocity = (velocity - drift * elapsed / settleTime) * decay;
    position = Math.max(openingFrame, Math.min(frameCount - 1, next));
    if (position !== next) velocity = 0;
  }

  function render(now) {
    request = 0;
    if (opening) {
      const current = sheetAt(position);
      loadAround(current, current + 1);
      if (guideReady || decoded.has(current)) {
        const elapsed = openingTime === undefined ? 0 : Math.min(now - openingTime, 34);
        position = Math.min(openingFrame, position + elapsed * FRAME_RATE / 1000);
        draw(Math.floor(position));
        opening = position < openingFrame;
        schedule();
      }
      openingTime = now;
      return;
    }

    const elapsed = lastTime ? Math.min(now - lastTime, 75) : 16.7;
    lastTime = now;
    advance(elapsed);
    const frame = Math.round(position);
    loadAround(sheetAt(frame), sheetAt(target));
    draw(frame);
    if (position !== target || velocity !== 0) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (active && !request) request = requestAnimationFrame(render);
  }

  function redrawAmbient() {
    if (active && drawn >= 0) draw(drawn, true);
  }
  ambientLayout.addEventListener('change', redrawAmbient);
  stripLayout?.addEventListener('change', redrawAmbient);

  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (active) {
        schedule();
        return;
      }
      cancelAnimationFrame(request);
      request = 0;
      lastTime = 0;
      clearTimeout(retryTimer);
      pending.forEach(controller => controller.abort());
      for (const [index, image] of decoded) {
        if (endpointSheets.includes(index)) continue;
        image.close?.();
        decoded.delete(index);
      }
      compressed.clear();
      drawnSource = undefined;
    },
    setProgress(progress, { immediate = false } = {}) {
      if (active) prepareGuide();
      if (opening && (progress > .015 || motion.matches)) {
        opening = false;
        position = Math.max(position, openingFrame);
      }
      const next = openingFrame + progress * (frameCount - 1 - openingFrame);
      const snap = immediate && position !== next;
      if (snap) {
        position = next;
        velocity = 0;
      } else if (!opening && Math.abs(next - position) > MAX_SCRUB_GAP) {
        position = next - Math.sign(next - position) * MAX_SCRUB_GAP;
      }
      if (velocity * (next - position) < 0) velocity = 0;
      if (next !== target) direction = Math.sign(next - target);
      else if (!snap && drawn >= 0 && !opening && !motion.matches) return;
      target = next;
      schedule();
    }
  };
}
