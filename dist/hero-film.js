const FRAME_RATE = 48;
const VIDEO_RATE = 24;
const FRAMES_PER_SHEET = 4;
const NETWORK_LIMIT = 4;
const BLOB_LIMIT = 15;
const MAX_SCRUB_GAP = FRAME_RATE;
const POSITION_EPSILON = .15;
const VELOCITY_EPSILON = .002;
const sheetAt = frame => Math.floor(Math.round(frame) / FRAMES_PER_SHEET);

function createFilmBackdrop(ambient, ambientMedia = '(max-aspect-ratio: 8/5), (min-aspect-ratio: 21/9)', ambientStrip) {
  const ambientLayout = matchMedia(ambientMedia);
  if (ambientStrip) {
    ambient.width = matchMedia('(max-width: 760px)').matches ? 256 : 960;
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

  return {
    draw(image, x, y, width, height) {
      if (!ambientContext || !ambientLayout.matches) return;
      drawAmbient(image, x, y, width, height);
      if (!ambient.classList.contains('ready')) ambient.classList.add('ready');
    },
    onLayoutChange(callback) {
      ambientLayout.addEventListener('change', callback);
      stripLayout?.addEventListener('change', callback);
    }
  };
}

export function createScrollFilm(canvas, ambient, motion, options) {
  const video = document.createElement('video');
  if (!options.media || !video.canPlayType('video/mp4; codecs="avc1.640028"')) {
    return createSheetFilm(canvas, ambient, motion, options);
  }

  const { directory, media, frameCount, openingFrame = 0, onFrame, ambientMedia, ambientStrip, settleTime = 95 } = options;
  const backdrop = createFilmBackdrop(ambient, ambientMedia, ambientStrip);
  const toTime = frame => Math.floor(frame / 2) / VIDEO_RATE + .004;
  const introEnd = openingFrame / FRAME_RATE;
  const lastTime = toTime(frameCount - 1);
  let active = true;
  let opening = Boolean(openingFrame) && !motion.matches;
  let introStarted = false;
  let queued = 0;
  let previousTick = 0;
  let position = introEnd;
  let target = introEnd;
  let latestProgress = 0;
  let publishedFrame = -1;
  let fallback;

  video.className = 'film-frames';
  video.setAttribute('aria-hidden', 'true');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.preload = 'none';
  canvas.after(video);

  function publish(mediaTime) {
    if (!active || video.readyState < 2) return;
    const sourceFrame = Math.floor(mediaTime * VIDEO_RATE + .02);
    const frame = sourceFrame === Math.floor((frameCount - 1) / 2) ? frameCount - 1 : sourceFrame * 2;
    if (frame === publishedFrame) return;
    publishedFrame = frame;
    backdrop.draw(video, 0, 0, video.videoWidth, video.videoHeight);
    video.classList.add('ready');
    canvas.dataset.frame = String(frame);
    canvas.dataset.quality = 'native';
    onFrame?.(frame);
  }

  function schedule() {
    if (active && !fallback && !queued) queued = requestAnimationFrame(update);
  }

  function update(now) {
    queued = 0;
    if (!active || fallback || !video.videoWidth) return;
    if (opening) {
      if (!introStarted && video.readyState >= 2) {
        introStarted = true;
        video.play().catch(() => { opening = false; schedule(); });
      }
      if (!video.paused && video.currentTime < introEnd) {
        if (publishedFrame < 0 || !video.requestVideoFrameCallback) publish(video.currentTime);
        schedule();
        return;
      }
      if (video.currentTime >= introEnd) {
        opening = false;
        video.pause();
      } else return;
    }

    if (video.seeking) return;
    const elapsed = previousTick ? Math.min(80, now - previousTick) : 17;
    previousTick = now;
    const delta = target - position;
    const factor = motion.matches ? 1 : 1 - Math.exp(-elapsed / (settleTime * .46));
    position = Math.abs(delta) <= 1 / FRAME_RATE ? target : position + delta * factor;
    const time = Math.min(lastTime, Math.round(position * VIDEO_RATE) / VIDEO_RATE + .004);
    if (Math.abs(video.currentTime - time) > .012) video.currentTime = time;
    else if (video.readyState >= 2) publish(video.currentTime);
    if (position !== target && !video.seeking) schedule();
    if (position === target) previousTick = 0;
  }

  function watchFrame() {
    video.requestVideoFrameCallback?.((_, { mediaTime }) => {
      if (fallback) return;
      if (!video.seeking && (opening ? introStarted : Math.abs(mediaTime - video.currentTime) < 1 / VIDEO_RATE)) {
        publish(mediaTime);
      }
      watchFrame();
    });
  }
  watchFrame();
  video.addEventListener('loadeddata', schedule);
  video.addEventListener('loadedmetadata', schedule);
  video.addEventListener('seeked', () => {
    if (!opening) publish(video.currentTime);
    schedule();
  });
  video.addEventListener('playing', schedule);
  video.addEventListener('error', () => {
    if (fallback) return;
    video.remove();
    fallback = createSheetFilm(canvas, ambient, motion, options);
    fallback.setActive(active);
    fallback.setProgress(latestProgress, { immediate: true });
  });
  backdrop.onLayoutChange(() => {
    if (active && !fallback && publishedFrame >= 0 && !video.seeking) {
      backdrop.draw(video, 0, 0, video.videoWidth, video.videoHeight);
    }
  });

  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (fallback) return fallback.setActive(value);
      if (active) schedule();
      else {
        video.pause();
        cancelAnimationFrame(queued);
        queued = previousTick = 0;
      }
    },
    setProgress(progress, { immediate = false } = {}) {
      latestProgress = progress;
      if (fallback) return fallback.setProgress(progress, { immediate });
      if (active && !video.getAttribute('src')) {
        video.preload = 'auto';
        video.src = new URL('./assets/' + directory + '/' + media, import.meta.url).href;
      }
      if (opening && (progress > .015 || motion.matches)) {
        opening = false;
        video.pause();
      }
      const time = toTime(openingFrame + progress * (frameCount - 1 - openingFrame));
      if (time === target && (!immediate || position === time) && (introStarted || !opening)) return;
      target = time;
      if (immediate || motion.matches) position = time;
      else if (Math.abs(target - position) > .72) position = target - Math.sign(target - position) * .72;
      schedule();
    }
  };
}

function createSheetFilm(canvas, ambient, motion, {
  directory, frameCount, openingFrame = 0, widths = [1280, 832],
  ambientMedia = '(max-aspect-ratio: 8/5), (min-aspect-ratio: 21/9)', ambientStrip, onFrame,
  settleTime = 95, retainEndpoints = false
}) {
  const lastSheet = sheetAt(frameCount - 1);
  const openingSheet = sheetAt(openingFrame);
  // The pinned dentist sequence needs its first and last frames ready in both directions.
  const endpointSheets = retainEndpoints ? [openingSheet, lastSheet] : [];
  const compact = matchMedia('(max-width: 760px)').matches;
  const decodeLimit = compact ? 1 : 2;
  const width = widths[compact ? 1 : 0];
  const height = width * 9 / 16;
  const prefix = compact ? 'compact' : 'frame';
  const cacheLimit = Math.max(3, Math.min(7, Math.floor((compact ? 42 : 104) * 2 ** 20 / (width * height * 16))));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { setProgress() {}, setActive() {} };
  const backdrop = createFilmBackdrop(ambient, ambientMedia, ambientStrip);

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

  function draw(frame, force = false) {
    const index = sheetAt(frame);
    const sheet = decoded.get(index);
    if (!sheet || (!force && frame === drawn && sheet === drawnSource)) return;
    const tile = frame % FRAMES_PER_SHEET;
    const x = tile % 2 * width;
    const y = Math.floor(tile / 2) * height;
    context.drawImage(sheet, x, y, width, height, 0, 0, width, height);
    backdrop.draw(sheet, x, y, width, height);
    if (!canvas.classList.contains('ready')) canvas.classList.add('ready');
    canvas.dataset.frame = String(frame);
    canvas.dataset.quality = 'full';
    drawn = frame;
    drawnSource = sheet;
    onFrame?.(frame);
    decoded.delete(index);
    decoded.set(index, sheet);
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
      if (decoded.has(current)) {
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
  backdrop.onLayoutChange(redrawAmbient);

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
