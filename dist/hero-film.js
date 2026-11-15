const FRAME_RATE = 48;
const FRAMES_PER_SHEET = 4;
const DECODE_LIMIT = 2;
const CACHE_LIMIT = 8;
const SETTLE_TIME = 95;
const POSITION_EPSILON = .15;
const VELOCITY_EPSILON = .002;
const sheetAt = frame => Math.floor(Math.round(frame) / FRAMES_PER_SHEET);

export function createScrollFilm(canvas, ambient, motion, {
  directory, frameCount, openingFrame = 0, widths = [1280, 832],
  ambientMedia = '(max-aspect-ratio: 8/5), (min-aspect-ratio: 21/9)', ambientStrip, onFrame,
  maxPlaybackRate = Infinity
}) {
  const lastSheet = sheetAt(frameCount - 1);
  const maxVelocity = FRAME_RATE * maxPlaybackRate / 1000;
  const openingSheet = sheetAt(openingFrame);
  const openingSheets = Array.from({ length: openingSheet + 1 }, (_, index) => index);
  const compact = matchMedia('(max-width: 760px)').matches;
  const width = widths[compact ? 1 : 0];
  const height = width * 9 / 16;
  const prefix = compact ? 'compact' : 'frame';
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { setProgress() {} };
  const ambientLayout = matchMedia(ambientMedia);
  if (compact && ambientStrip) {
    ambient.width = 256;
    ambient.height = 144;
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

  const downloads = new Map();
  const decoded = new Map();
  const decoding = new Set();
  const failures = new Map();
  let wanted = [];
  let target = openingFrame;
  let position = motion.matches ? openingFrame : 0;
  let velocity = 0;
  let drawn = -1;
  let request = 0;
  let lastTime = 0;
  let opening = openingFrame > 0 && !motion.matches;
  let openingTime;
  let direction = 1;
  let prefetchTimer;

  function prefetch(index) {
    if (index < 0 || index > lastSheet || downloads.has(index)) return;
    download(index).catch(() => {});
  }

  function download(index) {
    if (!downloads.has(index)) {
      const filename = prefix + '-' + String(index).padStart(3, '0') + '.webp';
      const url = new URL('./assets/' + directory + '/' + filename, import.meta.url);
      const response = fetch(url).then(result => {
        if (!result.ok) throw new Error('Film frame sheet unavailable');
        return result.blob();
      }).catch(error => {
        downloads.delete(index);
        throw error;
      });
      downloads.set(index, response);
    }
    return downloads.get(index);
  }

  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob); } catch { /* Use the image decoder. */ }
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
      if (decoded.size <= CACHE_LIMIT) return;
      if (wanted.includes(index)) continue;
      image.close?.();
      decoded.delete(index);
    }
  }

  function queueSheets(indices, ahead = []) {
    wanted = [...new Set(indices)].filter(index => index >= 0 && index <= lastSheet);
    const now = performance.now();
    for (const index of wanted) {
      if (decoding.size >= DECODE_LIMIT) break;
      if (decoded.has(index) || decoding.has(index) || (failures.get(index) ?? 0) > now) continue;

      decoding.add(index);
      download(index).then(decode).then(image => {
        decoded.set(index, image);
        failures.delete(index);
        trimCache();
      }).catch(() => {
        downloads.delete(index);
        failures.set(index, performance.now() + 1000);
      }).finally(() => {
        decoding.delete(index);
        schedule();
      });
    }
    for (const index of ahead) {
      if ((failures.get(index) ?? 0) <= now) prefetch(index);
    }
  }

  function warmAhead(from, sign) {
    clearTimeout(prefetchTimer);
    if (motion.matches) return;
    prefetchTimer = setTimeout(() => {
      for (let offset = 1; offset <= 12; offset++) prefetch(from + offset * sign);
    }, 140);
  }

  function drawAmbient(image, x, y) {
    if (!stripLayout?.matches || !floorContext) {
      ambientContext.drawImage(image, x, y, width, height, 0, 0, ambient.width, ambient.height);
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
        image, x + width * background.left, y, width * tileWidth / ambient.width, height,
        0, 0, tileWidth, ambient.height
      );
      ambientContext.restore();
    }

    // Copy a clean patch of floor at its original scale and vertical position.
    // Blend only its upper edge into the dark background above.
    const floorSourceY = height * floorY / ambient.height;
    floorContext.globalCompositeOperation = 'copy';
    floorContext.drawImage(
      image, x + width * floor.left, y + floorSourceY, width * stripWidth, height - floorSourceY,
      0, 0, floorPatch.width, floorPatch.height
    );
    floorContext.globalCompositeOperation = 'destination-in';
    floorContext.fillStyle = floorFade;
    floorContext.fillRect(0, 0, floorPatch.width, floorPatch.height);
    ambientContext.drawImage(floorPatch, 0, floorY);
  }

  function draw(frame, force = false) {
    const index = sheetAt(frame);
    const image = decoded.get(index);
    if (!image || (frame === drawn && !force)) return;
    const tile = frame % FRAMES_PER_SHEET;
    const x = tile % 2 * width;
    const y = Math.floor(tile / 2) * height;
    context.drawImage(image, x, y, width, height, 0, 0, width, height);
    if (ambientContext && ambientLayout.matches) {
      drawAmbient(image, x, y);
      ambient.classList.add('ready');
    }
    if (drawn < 0) canvas.classList.add('ready');
    canvas.dataset.frame = String(frame);
    drawn = frame;
    onFrame?.(frame);
    decoded.delete(index);
    decoded.set(index, image);
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
    const drift = velocity + displacement / SETTLE_TIME;
    const decay = Math.exp(-elapsed / SETTLE_TIME);
    const next = target + (displacement + drift * elapsed) * decay;
    velocity = (velocity - drift * elapsed / SETTLE_TIME) * decay;
    const maxStep = maxVelocity * elapsed;
    const step = Math.max(-maxStep, Math.min(maxStep, next - position));
    const pacedPosition = position + step;
    velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));
    position = Math.max(openingFrame, Math.min(frameCount - 1, pacedPosition));
    if (position !== pacedPosition) velocity = 0;
  }

  function render(now) {
    request = 0;
    if (opening) {
      // The opening spans more sheets than the scrub cache. Decode a rolling
      // window and start once the first few sheets can play without waiting.
      const first = sheetAt(position);
      const window = openingSheets.slice(first, first + 4);
      queueSheets(window, openingSheets);
      if (openingSheets.some(index => failures.has(index))) {
        opening = false;
      } else {
        if (openingTime === undefined && !window.every(index => decoded.has(index))) return;
        const elapsed = openingTime === undefined ? 0 : Math.min(now - openingTime, 34);
        openingTime = now;
        const next = Math.min(openingFrame, position + elapsed * FRAME_RATE / 1000);
        const frame = Math.floor(next);
        if (decoded.has(sheetAt(frame))) {
          position = next;
          draw(frame);
          opening = frame < openingFrame;
        }
        schedule();
        return;
      }
    }

    const elapsed = lastTime ? Math.min(now - lastTime, 50) : 16.7;
    lastTime = now;
    advance(elapsed);

    const frame = Math.round(position);
    const current = sheetAt(frame);
    const destination = sheetAt(target);
    const nearby = [current, destination, current + direction, current - direction,
      current + direction * 2, destination + direction, current - direction * 2];
    const ahead = [current + direction * 3, current + direction * 4,
      current + direction * 5, current + direction * 6, current + direction * 7,
      destination, destination + direction, destination + direction * 2, current - direction * 3];
    queueSheets(motion.matches ? [current] : nearby, motion.matches ? [] : ahead);

    if (decoded.has(current)) {
      draw(frame);
    } else if (drawn >= 0) {
      // Keep moving through available frames while a requested sheet decodes.
      const step = Math.sign(frame - drawn);
      for (let offset = 1; step && offset <= 7; offset++) {
        const candidate = frame - offset * step;
        if ((candidate - drawn) * step <= 0) break;
        if (!decoded.has(sheetAt(candidate))) continue;
        draw(candidate);
        break;
      }
    }
    if (position !== target || velocity !== 0) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!request) request = requestAnimationFrame(render);
  }

  function redrawAmbient() {
    if (drawn >= 0) draw(drawn, true);
  }
  ambientLayout.addEventListener('change', redrawAmbient);
  stripLayout?.addEventListener('change', redrawAmbient);

  return {
    setProgress(progress) {
      const wasOpening = opening;
      // Queue early scroll input while the frame lands. Skip the intro when
      // navigation jumps directly past the hero or motion is reduced.
      if (progress >= 1 || motion.matches) opening = false;
      const next = openingFrame + progress * (frameCount - 1 - openingFrame);
      if (next !== target) {
        direction = Math.sign(next - target);
        warmAhead(sheetAt(next), direction);
      }
      else if (drawn >= 0 && !wasOpening && !motion.matches) return;
      target = next;
      schedule();
    }
  };
}
