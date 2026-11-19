import {createScrollFilm} from './hero-film.js';
import {prefetchCatalog} from './navigation.js';
import './product-dialog.js';
import {loadLens, loadLighting} from './bundles/entries.js';

history.scrollRestoration = 'manual';
const entryAnchor = location.hash;
if (entryAnchor === '#seating') location.replace('/chair');
if (!entryAnchor) scrollTo({ top: 0, left: 0, behavior: 'instant' });
if (entryAnchor === '#contact') positionContactEntry();

function positionContactEntry() {
  const contact = document.querySelector('#contact');
  const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  scrollTo({ top: Math.max(0, contact.getBoundingClientRect().top + scrollY - offset), behavior: 'instant' });
}

function reuseLoad(load) {
  let pending;
  return () => pending ??= load().catch(error => {
    pending = undefined;
    throw error;
  });
}

const lensModule = reuseLoad(loadLens);
const lightModule = reuseLoad(loadLighting);
function loadModel(filename) {
  return reuseLoad(async () => {
    const response = await fetch(new URL(`./assets/models/${filename}`, import.meta.url), { priority: 'low' });
    if (!response.ok) throw new Error(`Model unavailable: ${filename}`);
    return response.arrayBuffer();
  });
}
const lightModel = loadModel('light-v1.glb');

function warmBelowFold() {
  const idle = window.requestIdleCallback?.bind(window) ?? (callback => setTimeout(callback, 120));
  const loads = [lightModule, lensModule, lightModel];
  function next() {
    const load = loads.shift();
    if (!load) return;
    idle(() => {
      load().catch(() => { /* The visible section retries a failed preload. */ });
      next();
    });
  }
  next();
}

const lensMount = document.querySelector('#lens-interactive');
const lensAnchor = '#through-the-lens';
const lensObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  lensObserver.disconnect();
  try {
    const { mountLens } = await lensModule();
    mountLens(lensMount);
  } catch (error) {
    console.error('TERO comparison unavailable:', error);
    lensMount.textContent = 'The interactive comparison could not load. Refresh to try again.';
  }
}, { rootMargin: '550px' });
lensObserver.observe(lensMount);

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const lightingTrack = $('#lighting');
const lightingSection = lightingTrack.firstElementChild;
const lightToggle = $('#light-toggle');
let lightingScene;
let filterActive = false;
let manualFilter = false;
let filterProgress = 0;
let lightPinTop = 76;

function updateFilterLabel(active) {
  filterActive = active;
  lightToggle.setAttribute('aria-pressed', String(active));
  lightingTrack.classList.toggle('amber-mode', active);
  $('#filter-action').textContent = active ? 'Raise the amber filter' : 'Lower the amber filter';
}

lightToggle.addEventListener('click', () => {
  manualFilter = true;
  updateFilterLabel(!filterActive);
  lightingScene?.setFilter(Number(filterActive));
});


const experience = $('.film-experience');
const story = $('#experience');
const dentistStory = $('#human-perspective');
const stage = $('#film-stage');
const heroPanel = stage.firstElementChild;
const dentistPanel = stage.lastElementChild;
const header = $('.site-header');
const lightSections = $$('.questions, #contact, .site-footer');
const clampProgress = value => Math.max(0, Math.min(1, value));
const easeProgress = value => {
  const p = clampProgress(value);
  return p * p * (3 - 2 * p);
};

function animateChapters(group) {
  const chapters = [...group.children].map(element => ({ element, start: Number(element.dataset.start) }));
  let active = chapters[0].element;
  let leaving;
  let entering;
  const travel = 'clamp(24px, 8svh, 68px)';

  return frame => {
    const next = chapters.findLast(chapter => frame >= chapter.start).element;
    if (next === active) return;

    const previous = active;
    const previousStyle = getComputedStyle(previous);
    const exitStart = { opacity: previousStyle.opacity, transform: previousStyle.transform };
    const nextStyle = getComputedStyle(next);
    const enterStart = Number(nextStyle.opacity) > 0
      ? { opacity: nextStyle.opacity, transform: nextStyle.transform }
      : { opacity: 0, transform: `translateY(${travel})` };
    leaving?.cancel();
    entering?.cancel();

    previous.classList.remove('is-current');
    previous.setAttribute('aria-hidden', 'true');
    next.classList.add('is-current');
    next.removeAttribute('aria-hidden');
    active = next;
    if (motion.matches) return;

    leaving = previous.animate([exitStart, { opacity: 0, transform: `translateY(calc(-1 * ${travel}))` }],
      { duration: 330, easing: 'cubic-bezier(.45, 0, .75, .45)', fill: 'backwards' });
    entering = next.animate([enterStart, { opacity: 1, transform: 'translateY(0)' }],
      { delay: 150, duration: 430, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
  };
}

const updateHeroCopy = animateChapters(heroPanel.querySelector('.film-chapters'));

const heroFilm = createScrollFilm($('#hero-film'), $('#hero-ambient'), motion, {
  preview: { desktop: 'scrub-540-preview-v1.mp4' },
  media: { large: 'scrub-1440-v4.mp4', desktop: 'scrub-1080-v4.mp4', mobile: 'scrub-720-v4.mp4' },
  directory: 'hero-magnific-hd-48', frameCount: 576, openingFrame: 64,
  widths: [1920, 832], retainEndpoints: true,
  ambientMedia: '(max-width: 760px), (max-aspect-ratio: 3/2), (min-aspect-ratio: 8/5)',
  ambientStrip: {
    media: '(min-width: 1101px) and (min-height: 521px) and (min-aspect-ratio: 8/5)',
    background: { left: .072, right: .116 },
    floor: { left: .075, top: .72, fadeEnd: .79 },
    width: .18
  },
  onFrame: updateHeroCopy,
  onReady() {
    prepareDentist();
    prefetchCatalog();
    measureScroll();
  }
});
let dentistFilm;
const dentistFrameCount = 575;
// Motion begins at source frame 55 (24 fps). Retain six source frames of lead-in.
const dentistStartFrame = 98;
dentistStory.style.setProperty('--dentist-span-ratio', (dentistFrameCount - 1 - dentistStartFrame) / (dentistFrameCount - 1));
const dentistChapters = dentistPanel.querySelector('.film-chapters');
const ergonomicFrame = Number(dentistChapters.lastElementChild.dataset.start);
const updateDentistCopy = animateChapters(dentistChapters);

function prepareDentist() {
  dentistFilm ??= createScrollFilm($('#dentist-film'), $('#dentist-ambient'), motion, {
    preview: { desktop: 'scrub-540-preview-v1.mp4' },
    media: { desktop: 'scrub-720-v4.mp4', mobile: 'scrub-540-v4.mp4' },
    directory: 'dentist-final-48', frameCount: dentistFrameCount, startFrame: dentistStartFrame, widths: [1152, 768],
    settleTime: 48, retainEndpoints: true, startActive: false, onFrame: updateDentistCopy,
    async onReady() {
      warmBelowFold();
      const canDownloadFull = () => {
        const connection = navigator.connection;
        return !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
      };
      if (!canDownloadFull()) return;
      await heroFilm.upgrade?.();
      if (canDownloadFull()) await dentistFilm.upgrade?.();
    }
  });
}

function updateFilmHandoff(blend) {
  const complete = blend >= 1;
  const wipe = motion.matches ? Number(complete) : blend;
  stage.style.setProperty('--film-wipe', wipe);
  heroPanel.style.visibility = complete ? 'hidden' : 'visible';
  dentistPanel.style.visibility = wipe > 0 ? 'visible' : 'hidden';
  heroPanel.inert = wipe > 0;
  dentistPanel.inert = !complete;
}

function scrubLightFilter(trackTop, travel) {
  if (motion.matches || !travel || lightToggle.disabled) return;
  if (manualFilter && trackTop < innerHeight) return;
  const progress = easeProgress(((lightPinTop - trackTop) / travel - .08) / .80);
  if (!manualFilter && progress === filterProgress) return;
  manualFilter = false;
  filterProgress = progress;
  lightingScene?.setFilter(progress, { immediate: true });
  if (filterActive !== (progress >= 1)) updateFilterLabel(progress >= 1);
}

let scrollPending = false;
// ScrollTrigger can move the viewport temporarily while measuring the page.
let hasScrolled = Boolean(entryAnchor && entryAnchor !== '#top');
let previousBlend;
let geometry;
function scrollState() {
  scrollPending = false;
  const y = scrollY;
  const { height, heroStart, dentistStart, stageRelease, filmBottom, lightOffset, lightTravel, surfaces } = geometry;
  const reduced = motion.matches;
  const blendStart = dentistStart - height * (reduced ? .52 : .5);
  const blend = clampProgress((y - blendStart) / Math.max(1, dentistStart - blendStart));
  const heroEnd = blendStart - (reduced ? height * .12 : 0);
  const progress = clampProgress((y - heroStart) / Math.max(1, heroEnd - heroStart));
  // Show the final frame while the stage is still pinned, before the next section enters.
  const clinicalStart = reduced ? dentistStart : blendStart;
  const dentistEnd = stageRelease - height * .5;
  const clinicalProgress = clampProgress((y - clinicalStart) / Math.max(1, dentistEnd - clinicalStart));
  const overFilm = y < filmBottom - 76;
  const lightSurface = !overFilm && surfaces.some(({ top, bottom }) => top < y + 76 && bottom > y + 76);

  header.classList.toggle('scrolled', y > 60);
  header.classList.toggle('over-film', overFilm);
  header.classList.toggle('over-dentist', overFilm && blend >= 1);
  header.classList.toggle('light-header', lightSurface);
  if (previousBlend !== blend) {
    previousBlend = blend;
    updateFilmHandoff(blend);
  }
  scrubLightFilter(lightOffset - y, lightTravel);

  const still = progress < .22 ? 0 : progress < .46 ? .34 : .88;
  heroFilm.setActive(blend < 1);
  heroFilm.setProgress(reduced ? still : progress, {
    immediate: !reduced && y >= heroEnd,
    skipIntro: hasScrolled
  });
  const dentistNear = y >= blendStart - height * 1.55 && y < stageRelease + height;
  dentistFilm?.setActive(dentistNear);
  const clinicalFrame = dentistStartFrame + clinicalProgress * (dentistFrameCount - 1 - dentistStartFrame);
  const clinicalStill = clinicalFrame < ergonomicFrame ? 0 : 1;
  dentistFilm?.setProgress(motion.matches ? clinicalStill : clinicalProgress, {
    immediate: y <= clinicalStart || y >= stageRelease
  });
}
addEventListener('scroll', () => {
  if (scrollY > 2) hasScrolled = true;
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(scrollState);
}, { passive: true });
function measureScroll() {
  const y = scrollY;
  const height = stage.offsetHeight;
  const filmTop = experience.offsetTop;
  const filmBottom = filmTop + experience.offsetHeight;
  const lightHeight = lightingSection.offsetHeight;
  geometry = {
    height, filmBottom, stageRelease: filmBottom - height,
    heroStart: filmTop + story.offsetTop,
    dentistStart: filmTop + dentistStory.offsetTop,
    lightOffset: lightingTrack.getBoundingClientRect().top + y,
    lightTravel: lightingTrack.offsetHeight - lightHeight,
    surfaces: lightSections.map(section => {
      const { top, bottom } = section.getBoundingClientRect();
      return { top: top + y, bottom: bottom + y };
    })
  };
  const pin = Math.min(76, innerHeight - lightHeight);
  if (pin !== lightPinTop) {
    lightPinTop = pin;
    lightingTrack.style.setProperty('--light-pin-top', `${pin}px`);
  }
  scrollState();
}
addEventListener('resize', measureScroll);
// Keep the active contact field above a mobile keyboard after viewport resizing.
function keepContactFieldVisible() {
  const field = document.activeElement;
  if (!matchMedia('(max-width: 1100px), (any-pointer: coarse)').matches ||
      !field?.matches('#contact-form input, #contact-form select, #contact-form textarea')) return;
  requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const top = (viewport?.offsetTop || 0) + header.getBoundingClientRect().height + 12;
    const bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 16;
    const rect = field.getBoundingClientRect();
    if (rect.top < top || rect.bottom > bottom) {
      scrollBy({ top: rect.top + rect.height / 2 - (top + bottom) / 2, behavior: 'instant' });
    }
  });
}
addEventListener('resize', keepContactFieldVisible);
window.visualViewport?.addEventListener('resize', keepContactFieldVisible);
const scrollSizer = new ResizeObserver(measureScroll);
[$('main'), stage, lightingSection, lightingTrack].forEach(element => scrollSizer.observe(element));
measureScroll();

addEventListener('pageshow', event => {
  if (!event.persisted || location.hash) return;
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  hasScrolled = false;
  heroFilm.reset?.();
  dentistFilm?.reset?.();
  previousBlend = undefined;
  measureScroll();
});

async function initMotion(){await document.fonts.ready;if(!window.gsap||!window.ScrollTrigger)return;gsap.registerPlugin(ScrollTrigger);ScrollTrigger.clearScrollMemory('manual');const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{if(entryAnchor !== '#contact')gsap.from('.site-header',{y:-12,autoAlpha:0,duration:.65,ease:'power3.out'});$$('.reveal').forEach(el=>gsap.from(el,{y:35,autoAlpha:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%',once:true}}));});
 const statement=$('#manifesto-text'),words=statement.textContent.trim().split(/\s+/);statement.setAttribute('aria-label',words.join(' '));statement.innerHTML=words.map(w=>`<span aria-hidden="true">${w}</span>`).join(' ');const spans=[...statement.children];ScrollTrigger.create({trigger:statement,start:'top 85%',end:'bottom 40%',onUpdate:self=>spans.forEach((s,i)=>s.classList.toggle('lit',motion.matches||i/spans.length<self.progress+.08))});if(motion.matches)spans.forEach(s=>s.classList.add('lit'));ScrollTrigger.refresh();window.addEventListener('pagehide',event=>{if(!event.persisted)mm.revert()})}
initMotion().finally(() => {
  // ScrollTrigger's initial refresh can interrupt the browser's smooth fragment scroll.
  if (entryAnchor === '#contact' && location.hash === entryAnchor) {
    positionContactEntry();
    measureScroll();
    requestAnimationFrame(() => delete document.documentElement.dataset.contactEntry);
  } else if ([lensAnchor, '#human-perspective', '#philosophy'].includes(entryAnchor) && location.hash === entryAnchor) {
    document.querySelector(entryAnchor).scrollIntoView({ behavior: 'instant' });
  }
});
let leavingPage = false;
const lightObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  lightObserver.disconnect();
  const lightScene = $('#light-scene');
  try {
    const [{ createProductScene }, modelBytes] = await Promise.all([lightModule(), lightModel()]);
    if (leavingPage) return;
    lightingScene = await createProductScene(lightScene, { reducedMotion: motion.matches, modelBytes });
    if (leavingPage) { lightingScene.dispose(); return; }
    lightingScene.setFilter(manualFilter ? Number(filterActive) : filterProgress, { immediate: true });
  } catch (error) {
    console.error('TERO headlight unavailable:', error);
    lightScene.classList.add('fallback-only');
    lightScene.querySelector('.scene-loading').textContent = 'Product photography / 3D unavailable';
    lightToggle.disabled = true;
    $('#filter-action').textContent = 'Interactive filter unavailable';
  }
}, { rootMargin: '550px' });
lightObserver.observe(lightingTrack);
motion.addEventListener('change', () => {
  previousBlend = undefined;
  if (motion.matches && !manualFilter) {
    filterProgress = Number(filterActive);
    lightingScene?.setFilter(filterProgress, { immediate: true });
  }
  if (lightingScene) lightingScene.state.paused = motion.matches;
  measureScroll();
});
addEventListener('pagehide', event => {
  if (event.persisted) return;
  leavingPage = true;
  scrollSizer.disconnect();
  lightObserver.disconnect();
  lightingScene?.dispose();
  window.ScrollTrigger?.getAll().forEach(trigger => trigger.kill());
});
$('#year').textContent=new Date().getFullYear();


const contactSection = $('#contact');
let stopContactScroll;

function goToContact(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  stopContactScroll?.();
  // The mobile menu closes before this handler runs. Unlock before measuring the page.
  if (event.currentTarget.closest('#mobile-menu')) document.body.style.overflow = '';

  const destination = () => {
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = contactSection.getBoundingClientRect().top + scrollY - offset;
    return Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
  };
  const finish = () => {
    if (location.hash !== '#contact') history.pushState(null, '', '#contact');
    contactSection.focus({ preventScroll: true });
  };
  if (motion.matches) {
    scrollTo({ top: destination(), behavior: 'instant' });
    finish();
    return;
  }

  const start = scrollY;
  const duration = Math.min(2150, Math.max(380, Math.abs(destination() - start) * .26));
  const input = new AbortController();
  let frame;
  let started;
  stopContactScroll = () => {
    cancelAnimationFrame(frame);
    input.abort();
    stopContactScroll = undefined;
  };
  const listener = { passive: true, signal: input.signal };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'popstate']) {
    addEventListener(type, stopContactScroll, listener);
  }
  addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape', 'Tab'].includes(event.key)) {
      stopContactScroll?.();
    }
  }, listener);

  function advance(now) {
    started ??= now;
    const progress = Math.min(1, (now - started) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    // Re-read the destination as lazy sections above Contact settle.
    scrollTo({ top: start + (destination() - start) * eased, behavior: 'instant' });
    if (progress < 1) {
      frame = requestAnimationFrame(advance);
    } else {
      stopContactScroll();
      finish();
    }
  }
  frame = requestAnimationFrame(advance);
}

$$('.site-header a[href="#contact"], #mobile-menu a[href="#contact"]').forEach(link => {
  link.addEventListener('click', goToContact);
});

const contactForm = $('#contact-form');
contactForm.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const interests = form.getAll('interest');
  const message = [
    'TERO fitting request',
    `Full name: ${form.get('name').trim()}`,
    `Email: ${form.get('email').trim()}`,
    `City: ${form.get('city').trim()}`,
    form.get('phone').trim() && `Phone: ${form.get('phone').trim()}`,
    `Specialty: ${form.get('specialty')}`,
    interests.length && `Interested in: ${interests.join(', ')}`,
    form.get('message').trim()
  ].filter(Boolean).join('\n');
  const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
  location.href = `sms:+989198005868${separator}body=${encodeURIComponent(message)}`;
});
contactForm.querySelector('button[type="submit"]').disabled = false;
