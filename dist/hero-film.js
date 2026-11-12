const FRAME_RATE = 24;
const FRAMES_PER_SHEET = 4;
const DECODE_LIMIT = 2;
const CACHE_LIMIT = 6;
const sheetAt = frame => Math.floor(Math.round(frame) / FRAMES_PER_SHEET);

export function createScrollFilm(canvas, ambient, motion, { directory, frameCount, openingFrame = 0 }) {
  const lastSheet = sheetAt(frameCount - 1);
  const openingSheet = sheetAt(openingFrame);
  const openingSheets = Array.from({ length: openingSheet + 1 }, (_, index) => index);
  const compact = matchMedia('(max-width: 760px)').matches;
  const width = compact ? 960 : 1440;
  const height = compact ? 540 : 810;
  const prefix = compact ? 'compact' : 'frame';
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { setProgress() {} };
  const ambientLayout = matchMedia('(max-aspect-ratio: 8/5), (min-aspect-ratio: 21/9)');
  const ambientContext = ambient.getContext('2d', { alpha: false });

  const downloads = new Map();
  const decoded = new Map();
  const decoding = new Set();
  const failures = new Map();
  let wanted = [];
  let target = openingFrame;
  let position = motion.matches ? openingFrame : 0;
  let drawn = -1;
  let request = 0;
  let lastTime = 0;
  let opening = openingFrame > 0 && !motion.matches;
  let openingStart;
  let direction = 1;

  function download(index) {
    if (!downloads.has(index)) {
      const filename = prefix + '-' + String(index).padStart(2, '0') + '.webp';
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
      if (index < 0 || index > lastSheet || downloads.has(index) || (failures.get(index) ?? 0) > now) continue;
      download(index).catch(() => failures.set(index, performance.now() + 1000));
    }
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
      ambientContext.drawImage(image, x, y, width, height, 0, 0, ambient.width, ambient.height);
      ambient.classList.add('ready');
    }
    if (drawn < 0) canvas.classList.add('ready');
    canvas.dataset.frame = String(frame);
    drawn = frame;
    decoded.delete(index);
    decoded.set(index, image);
  }

  function render(now) {
    request = 0;
    if (opening) {
      queueSheets(openingSheets, [...openingSheets, openingSheet + 1, openingSheet + 2]);
      if (openingSheets.some(index => failures.has(index))) {
        opening = false;
      } else {
        if (!openingSheets.every(index => decoded.has(index))) return;
        openingStart ??= now;
        position = Math.min(openingFrame, Math.floor((now - openingStart) * FRAME_RATE / 1000));
        draw(position);
        opening = position < openingFrame;
        schedule();
        return;
      }
    }

    const elapsed = lastTime ? Math.min(now - lastTime, 50) : 16.7;
    lastTime = now;
    const distance = target - position;
    position = motion.matches || Math.abs(distance) < .3
      ? target
      : position + distance * (1 - Math.exp(-elapsed / 85));

    const frame = Math.round(position);
    const current = sheetAt(frame);
    const destination = sheetAt(target);
    const nearby = [current, current + direction, destination, current - direction,
      current + direction * 2, destination + direction];
    const ahead = [current + direction * 3, current + direction * 4,
      current + direction * 5, destination, destination + direction, current - direction * 2];
    queueSheets(motion.matches ? [current] : nearby, motion.matches ? [] : ahead);

    draw(frame);
    if (position !== target) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!request) request = requestAnimationFrame(render);
  }

  ambientLayout.addEventListener('change', () => {
    if (drawn >= 0) draw(drawn, true);
  });

  return {
    setProgress(progress) {
      if (progress > 0 || motion.matches) opening = false;
      const next = openingFrame + progress * (frameCount - 1 - openingFrame);
      if (next !== target) direction = Math.sign(next - target);
      else if (drawn >= 0 && !opening) return;
      target = next;
      schedule();
    }
  };
}
