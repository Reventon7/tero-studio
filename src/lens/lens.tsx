import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';

type Magnification = {
  id: string;
  label: string;
  family: string;
  field: string;
  depth: string;
  suitedTo: string;
  scale: number;
};

const options = [
  { id: 'naked', label: '1.0× naked eye', family: '', field: 'Full scene', depth: 'Unlimited', suitedTo: 'Orientation and patient conversation', scale: 1 },
  { id: 'prism-35', label: '3.5×', family: 'TERO Prism', field: '70 mm', depth: '90 mm', suitedTo: 'Restorative detail with an upright posture', scale: 3.5 },
  { id: 'prism-45', label: '4.5×', family: 'TERO Prism', field: '55 mm', depth: '60 mm', suitedTo: 'Endodontic access and canal location', scale: 4.5 },
  { id: 'prism-55', label: '5.5×', family: 'TERO Prism', field: '40 mm', depth: '35 mm', suitedTo: 'Microsurgery and periodontal plastics', scale: 5.5 },
  { id: 'galilean-25', label: '2.5×', family: 'TERO Galilean', field: '100 mm', depth: '140 mm', suitedTo: 'Hygiene, exams and general procedures', scale: 2.5 },
  { id: 'galilean-30', label: '3.0×', family: 'TERO Galilean', field: '85 mm', depth: '110 mm', suitedTo: 'Everyday restorative dentistry', scale: 3 },
  { id: 'galilean-35', label: '3.5×', family: 'TERO Galilean', field: '65 mm', depth: '80 mm', suitedTo: 'Crown preparation and fine margins', scale: 3.5 },
] as const satisfies readonly Magnification[];

const families = ['', 'TERO Prism', 'TERO Galilean'] as const;
const lights = [
  { id: 'daylight', label: 'Daylight' },
  { id: 'amber', label: 'Amber filter' },
  { id: 'none', label: 'No light' },
] as const;
type Light = typeof lights[number]['id'];
const photo = 'assets/dental-study-casts.webp';
const defaultPosition = { x: .43, y: .48 };

function LoupeViewer({ power, light }: { power: Magnification; light: Light }) {
  const viewer = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLImageElement>(null);
  const scale = useMotionValue(power.scale);
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const render = useRef<(dx?: number, dy?: number) => void>(() => {});
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number } | null>(null);
  const position = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const panel = viewer.current!;
    const circle = glass.current!;
    const image = detail.current!;
    let width = 0, height = 0, radius = 0;
    let target = { x: 0, y: 0 };
    let request = 0;
    const constrain = (x: number, y: number) => ({
      x: Math.max(radius, Math.min(width - radius, x)),
      y: Math.max(radius, Math.min(height - radius, y)),
    });

    function paint() {
      request = 0;
      const point = position.current;
      const dx = target.x - point.x, dy = target.y - point.y;
      const settling = !reduced && Math.hypot(dx, dy) > .2;
      point.x = settling ? point.x + dx * .68 : target.x;
      point.y = settling ? point.y + dy * .68 : target.y;
      const zoom = scale.get();
      circle.style.transform = `translate3d(${point.x - radius}px, ${point.y - radius}px, 0)`;
      // The source coordinate underneath the crosshair maps back to its center at any scale.
      image.style.transform = `translate3d(${radius - point.x * zoom}px, ${radius - point.y * zoom}px, 0) scale(${zoom})`;
      if (settling) schedule();
    }

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
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      target = constrain(width * relative.x, height * relative.y);
      position.current = { ...target };
      schedule();
      setReady(true);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    const unsubscribe = scale.on('change', schedule);
    return () => {
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
    <img className="lens-photo lens-photo-base" src={photo} alt="A row of white plaster dental casts on a gray work surface" width="3200" height="2133" draggable={false} />
    <span className="lens-badge lens-badge-base">Naked eye</span>
    <span className="lens-badge lens-badge-guide"><span aria-hidden="true">✥</span> Drag the loupe</span>
    <div className="lens-glass" data-ready={ready} data-light={light} ref={glass} tabIndex={0} role="group"
      aria-label={`Loupe view at ${power.label}${power.family ? `, ${power.family}` : ''}. Drag it, or use the arrow keys to move it.`}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onLostPointerCapture={endDrag} onKeyDown={moveByKey}>
      <img className="lens-photo lens-photo-detail" ref={detail} src={photo} alt="" draggable={false} />
      <span className="lens-light-falloff" aria-hidden="true" />
      <span className="lens-reticle" aria-hidden="true" />
    </div>
  </div>;
}

function MagnificationSelector({ selected, select }: { selected: Magnification; select: (value: Magnification) => void }) {
  return <fieldset className="lens-fieldset">
    <legend className="lens-label">Magnification</legend>
    {families.map(family => <div className="lens-option-group" key={family}>
      {family && <p className="lens-family">{family}</p>}
      <div className="flex flex-wrap gap-2">
        {options.filter(option => option.family === family).map(option => <label className="lens-pill" key={option.id}>
          <input type="radio" name="lens-magnification" checked={selected.id === option.id}
            aria-label={`${option.family ? `${option.family} ` : ''}${option.label}`} onChange={() => select(option)} />
          <span>{option.label}</span>
        </label>)}
      </div>
    </div>)}
  </fieldset>;
}

function TechnicalDataCard({ power }: { power: Magnification }) {
  const reduced = useReducedMotion();
  const entry = { initial: reduced ? false : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: .25 } };
  return <dl className="lens-data grid grid-cols-2" aria-live="polite" aria-atomic="true">
    <div className="lens-metric"><dt className="lens-label">Field of view</dt><motion.dd key={power.field} {...entry}>{power.field}</motion.dd></div>
    <div className="lens-metric"><dt className="lens-label">Depth of field</dt><motion.dd key={power.depth} {...entry}>{power.depth}</motion.dd></div>
    <div className="lens-usage col-span-2"><dt className="lens-label">Suited to</dt>
      <motion.dd key={power.id} {...entry}>{power.suitedTo}{power.family && <small>{power.family}</small>}</motion.dd>
    </div>
  </dl>;
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

function MagnificationSection() {
  const [power, setPower] = useState<Magnification>(options[6]);
  const [light, setLight] = useState<Light>('none');
  return <div className="lens-layout grid">
    <LoupeViewer power={power} light={light} />
    <div className="lens-controls grid">
      <MagnificationSelector selected={power} select={setPower} />
      <TechnicalDataCard power={power} />
      <HeadlightSelector selected={light} select={setLight} />
      <p className="lens-note">Illustrative comparison. Actual field and depth depend on your loupe configuration and working distance.</p>
    </div>
  </div>;
}

export function mountLens(element: HTMLElement) {
  createRoot(element).render(<MagnificationSection />);
}
