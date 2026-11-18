import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

const magnifications = [
  { scale: 1, label: '1.0×' },
  { scale: 2.5, label: '2.5×' },
  { scale: 3, label: '3.0×' },
  { scale: 3.5, label: '3.5×' },
  { scale: 4, label: '4.0×' },
  { scale: 5, label: '5.0×' },
  { scale: 6, label: '6.0×' },
  { scale: 8, label: '8.0×' },
] as const;
type Magnification = typeof magnifications[number];

const lights = [
  { id: 'daylight', label: 'Daylight' },
  { id: 'amber', label: 'Amber filter' },
  { id: 'none', label: 'No light' },
] as const;
type Light = typeof lights[number]['id'];
const photo = '/assets/dental-casts-rebuilt-v1.webp';
const detailPhoto = photo;
const defaultPosition = { x: .46, y: .49 };

function LoupeViewer({ power, light }: { power: Magnification; light: Light }) {
  const viewer = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLImageElement>(null);
  const detail = useRef<HTMLCanvasElement>(null);
  const scale = useMotionValue(power.scale);
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const render = useRef<(dx?: number, dy?: number) => void>(() => {});
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number } | null>(null);
  const position = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const panel = viewer.current!;
    const circle = glass.current!;
    const overview = base.current!;
    const canvas = detail.current!;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const master = new Image();
    master.decoding = 'async';
    let detailReady = false;
    let disposed = false;
    let hasPainted = false;
    let width = 0, height = 0, radius = 0;
    let target = { x: 0, y: 0 };
    let request = 0;
    const constrain = (x: number, y: number) => ({
      x: Math.max(radius, Math.min(width - radius, x)),
      y: Math.max(radius, Math.min(height - radius, y)),
    });

    const paint = () => {
      request = 0;
      const point = position.current;
      const dx = target.x - point.x, dy = target.y - point.y;
      const settling = !reduced && Math.hypot(dx, dy) > .2;
      point.x = settling ? point.x + dx * .68 : target.x;
      point.y = settling ? point.y + dy * .68 : target.y;
      const zoom = scale.get();
      circle.style.transform = `translate3d(${point.x - radius}px, ${point.y - radius}px, 0)`;
      const image = detailReady ? master : overview;
      if (image.naturalWidth && radius) {
        // Match the overview's centered object-fit: cover, then sample only the area visible in the loupe.
        const fit = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const span = 2 * radius / (fit * zoom);
        const x = image.naturalWidth / 2 + (point.x - width / 2) / fit - span / 2;
        const y = image.naturalHeight / 2 + (point.y - height / 2) / fit - span / 2;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, x, y, span, span, 0, 0, canvas.width, canvas.height);
        if (!hasPainted) {
          hasPainted = true;
          setReady(true);
        }
      }
      if (settling) schedule();
    };

    function schedule() {
      if (!request) request = requestAnimationFrame(paint);
    }

    render.current = (x, y) => {
      target = x === undefined || y === undefined
        ? constrain(width * defaultPosition.x, height * defaultPosition.y)
        : constrain(x, y);
      schedule();
    };

    function measure() {
      const relative = width ? { x: target.x / width, y: target.y / height } : defaultPosition;
      width = panel.clientWidth;
      height = panel.clientHeight;
      radius = circle.offsetWidth / 2;
      if (!width || !height) return;
      const pixels = Math.round(radius * 2 * Math.min(window.devicePixelRatio || 1, 2));
      if (canvas.width !== pixels) canvas.width = canvas.height = pixels;
      target = constrain(width * relative.x, height * relative.y);
      position.current = { ...target };
      schedule();
    }

    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    overview.addEventListener('load', schedule);
    master.src = detailPhoto;
    master.decode().then(() => {
      if (disposed) return;
      detailReady = true;
      schedule();
    }).catch(() => { /* The overview still drives the loupe if the detail asset cannot load. */ });
    const unsubscribe = scale.on('change', schedule);
    return () => {
      disposed = true;
      overview.removeEventListener('load', schedule);
      observer.disconnect();
      unsubscribe();
      cancelAnimationFrame(request);
    };
  }, [scale, reduced]);

  useEffect(() => {
    if (reduced) {
      scale.set(power.scale);
      return;
    }
    const animation = animate(scale, power.scale, { duration: .4, ease: [0.2, 0.75, 0.25, 1] });
    return () => animation.stop();
  }, [power.scale, scale, reduced]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
    drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...position.current };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (origin?.id !== event.pointerId) return;
    render.current(origin.x + event.clientX - origin.clientX, origin.y + event.clientY - origin.clientY);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
  }

  function moveByKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 30 : 10;
    const { x, y } = position.current;
    switch (event.key) {
      case 'ArrowLeft': render.current(x - step, y); break;
      case 'ArrowRight': render.current(x + step, y); break;
      case 'ArrowUp': render.current(x, y - step); break;
      case 'ArrowDown': render.current(x, y + step); break;
      case 'Home': render.current(); break;
      default: return;
    }
    event.preventDefault();
  }

  return <div className="lens-viewer" ref={viewer}>
    <img className="lens-photo lens-photo-base" ref={base} src={photo} alt="A row of white plaster dental casts on a gray work surface" width="3200" height="2133" draggable={false} />
    <span className="lens-badge lens-badge-guide"><span aria-hidden="true">✥</span> Drag the loupe</span>
    <div className="lens-glass" data-ready={ready} data-light={light} ref={glass} tabIndex={0} role="group"
      aria-label={`Loupe view at ${power.label}. Drag it, or use the arrow keys to move it.`}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onLostPointerCapture={endDrag} onKeyDown={moveByKey}>
      <canvas className="lens-photo lens-photo-detail" ref={detail} aria-hidden="true" />
      <span className="lens-light-falloff" aria-hidden="true" />
      <span className="lens-reticle" aria-hidden="true" />
    </div>
  </div>;
}

function MagnificationSelector({ options, selected, select }: {
  options: readonly Magnification[]; selected: Magnification; select: (value: Magnification) => void;
}) {
  return <fieldset className="lens-fieldset">
    <legend className="lens-label">Magnification</legend>
    <div className="lens-option-group flex flex-wrap gap-2">
      {options.map(option => <label className="lens-pill" key={option.scale}>
        <input type="radio" name="lens-magnification" checked={selected.scale === option.scale}
          aria-label={option.scale === 1 ? '1.0× naked eye' : option.label} onChange={() => select(option)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

function HeadlightSelector({ selected, select }: { selected: Light; select: (value: Light) => void }) {
  return <fieldset className="lens-fieldset">
    <legend className="lens-label">Headlight</legend>
    <div className="lens-option-group flex flex-wrap gap-2">
      {lights.map(light => <label className="lens-pill lens-light-pill" key={light.id}>
        <input type="radio" name="lens-light" checked={selected === light.id} onChange={() => select(light.id)} />
        <span><i data-tone={light.id} aria-hidden="true" />{light.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

function MagnificationSection({ options, initial }: { options: readonly Magnification[]; initial: Magnification }) {
  const [power, setPower] = useState<Magnification>(initial);
  const [light, setLight] = useState<Light>('none');
  return <div className="lens-layout grid">
    <LoupeViewer power={power} light={light} />
    <div className="lens-controls grid">
      <MagnificationSelector options={options} selected={power} select={setPower} />
      <HeadlightSelector selected={light} select={setLight} />
    </div>
  </div>;
}

export function mountLens(element: HTMLElement, powers?: readonly number[]) {
  const modelOptions = powers ? magnifications.filter(option => powers.includes(option.scale)) : [];
  const options = modelOptions.length ? modelOptions : magnifications;
  const initial = modelOptions[0] ?? magnifications[3];
  createRoot(element).render(<MagnificationSection options={options} initial={initial} />);
}
