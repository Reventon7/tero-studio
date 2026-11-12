const WIDTH = 1280;
const HEIGHT = 720;
const FRAME_COUNT = 240;
const FRAMES_PER_SHEET = 4;
const LAST_SHEET = Math.ceil(FRAME_COUNT / FRAMES_PER_SHEET) - 1;

export function createHeroFilm(canvas, ambient, motion) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { setProgress() {} };
  const ambientContext = ambient.getContext('2d', { alpha: false });

  const downloads = new Map();
  const sheets = new Map();
  let target = 0;
  let position = 0;
  let drawn = -1;
  let request = 0;
  let lastTime = 0;

  function download(index) {
    if (!downloads.has(index)) {
      const filename = `sheet-${String(index).padStart(2, '0')}.webp`;
      const response = fetch(new URL(`./assets/hero-film/${filename}`, import.meta.url))
        .then(result => {
          if (!result.ok) throw new Error(`Hero frame sheet ${index} could not load`);
          return result.blob();
        });
      downloads.set(index, response);
    }
    return downloads.get(index);
  }

  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob); } catch { /* Try the browser image decoder. */ }
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

  function loadSheet(index) {
    if (sheets.has(index)) return;
    const entry = { image: null };
    sheets.set(index, entry);
    download(index).then(decode).then(image => {
      if (sheets.get(index) !== entry) {
        image.close?.();
        return;
      }
      entry.image = image;
      schedule();
    }).catch(() => {
      downloads.delete(index);
    });
  }

  function render(now) {
    request = 0;
    const elapsed = lastTime ? Math.min(now - lastTime, 40) : 16.7;
    lastTime = now;
    const distance = target - position;
    position = motion.matches || Math.abs(distance) < .35
      ? target
      : position + distance * (1 - Math.exp(-elapsed / 40));

    const frame = Math.round(position);
    const sheetIndex = Math.floor(frame / FRAMES_PER_SHEET);
    const targetSheet = Math.floor(Math.round(target) / FRAMES_PER_SHEET);
    const wanted = new Set([sheetIndex, targetSheet]);
    if (!motion.matches) {
      const direction = Math.sign(distance) || 1;
      for (const offset of [direction, -direction, direction * 2]) {
        const neighbor = sheetIndex + offset;
        if (neighbor >= 0 && neighbor <= LAST_SHEET) wanted.add(neighbor);
      }
    }
    for (const [index, entry] of sheets) {
      if (wanted.has(index)) continue;
      entry.image?.close?.();
      sheets.delete(index);
    }
    for (const index of wanted) loadSheet(index);

    const sheet = sheets.get(sheetIndex);
    if (frame !== drawn && sheet.image) {
      const tile = frame % FRAMES_PER_SHEET;
      context.drawImage(sheet.image, tile % 2 * WIDTH, Math.floor(tile / 2) * HEIGHT,
        WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
      if (ambientContext) {
        ambientContext.drawImage(canvas, 0, 0, ambient.width, ambient.height);
        ambient.classList.add('ready');
      }
      canvas.dataset.frame = String(frame);
      canvas.classList.add('ready');
      drawn = frame;
    }
    if (position !== target) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!request) request = requestAnimationFrame(render);
  }

  return {
    setProgress(progress) {
      const next = progress * (FRAME_COUNT - 1);
      if (next === target && drawn >= 0) return;
      target = next;
      schedule();
    }
  };
}
