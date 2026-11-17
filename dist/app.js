import {createScrollFilm} from './hero-film.js';

const lensMount = document.querySelector('#lens-interactive');
const lensAnchor = '#through-the-lens';
const entryAnchor = location.hash;
const lensObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  lensObserver.disconnect();
  try {
    const { mountLens } = await import('./lens.js');
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

const dialog=$('#detail-dialog'),menu=$('#mobile-menu');let opener;
function openDialog(kind){opener=document.activeElement;const data={anatomy:{title:'Every element.<br>One perspective.',image:'hero',alt:'Original TERO loupe photography',text:'A closer look at the relationship between frame, optics and light. The hero film shows how the parts come together.',list:['Frame and temple design','Twin optical housings','Eyewear-mounted lighting'],note:'Illustrative geometry, not a dimensional or internal engineering model.'},detail:{title:'The finer details.',image:'detail',alt:'TERO optical housing close-up',text:'The original photography reveals the finish and proportions of the TERO optical housing. Explore its form, from the front lens to the meeting of optic and frame.'},kit:{title:'Light. Complete.',image:'light-kit',alt:'TERO lighting kit and accessories',text:'The supplied kit photography shows the lighting system with its accessories and filter. Refer to your supplier to confirm kit contents and frame compatibility.'},chair:{title:'A place for focus.',image:'chair',alt:'TERO chair with black saddle-style seat',text:'Explore the TERO seating collection in the original product photograph. A saddle-style seat, support and wheeled base complete the composition.'}}[kind];if(!data)return;const content=`<div class="dialog-grid"><img src="assets/${data.image}.webp" alt="${data.alt}"><div><h2 id="dialog-title">${data.title}</h2><p>${data.text}</p>${data.list?'<ul>'+data.list.map(s=>'<li>'+s+'</li>').join('')+'</ul>':''}${data.note?'<p class="dialog-note">'+data.note+'</p>':''}</div></div>`;$('#dialog-content').innerHTML=content;dialog.showModal();document.body.style.overflow='hidden'}
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openDialog(b.dataset.open)));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
for(const d of [dialog,menu]){d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()});d.addEventListener('close',()=>{document.body.style.overflow='';$('.menu-toggle').setAttribute('aria-expanded','false');opener?.focus()})}
$('.menu-toggle').addEventListener('click',()=>{opener=document.activeElement;menu.showModal();$('.menu-toggle').setAttribute('aria-expanded','true');document.body.style.overflow='hidden'});$$('#mobile-menu nav a').forEach(a=>a.addEventListener('click',()=>menu.close()));

const experience = $('.film-experience');
const story = $('#experience');
const dentistStory = $('#human-perspective');
const stage = $('#film-stage');
const heroPanel = stage.firstElementChild;
const dentistPanel = stage.lastElementChild;
const header = $('.site-header');
const lightSections = $$('.questions');
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
  media: 'scrub-1440-v2.mp4',
  directory: 'hero-magnific-hd-48', frameCount: 576, openingFrame: 64,
  widths: [1920, 832],
  ambientMedia: '(max-width: 760px), (max-aspect-ratio: 3/2), (min-aspect-ratio: 8/5)',
  ambientStrip: {
    media: '(min-width: 761px) and (min-aspect-ratio: 8/5)',
    background: { left: .072, right: .116 },
    floor: { left: .075, top: .72, fadeEnd: .79 },
    width: .18
  },
  onFrame: updateHeroCopy
});
let dentistFilm;
const dentistFrameCount = 575;
const dentistChapters = dentistPanel.querySelector('.film-chapters');
const ergonomicFrame = Number(dentistChapters.lastElementChild.dataset.start);
const updateDentistCopy = animateChapters(dentistChapters);

function prepareDentist() {
  dentistFilm ??= createScrollFilm($('#dentist-film'), $('#dentist-ambient'), motion, {
    media: 'scrub-720-v2.mp4',
    directory: 'dentist-final-48', frameCount: dentistFrameCount, widths: [1152, 768],
    settleTime: 48, retainEndpoints: true, onFrame: updateDentistCopy
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
let previousBlend;
let geometry;
function scrollState() {
  scrollPending = false;
  const y = scrollY;
  const { height, heroStart, dentistStart, stageRelease, filmBottom, lightOffset, lightTravel, surfaces } = geometry;
  const blendStart = dentistStart - height * (motion.matches ? .52 : 1.18);
  const blend = clampProgress((y - blendStart) / Math.max(1, dentistStart - blendStart));
  const progress = clampProgress((y - heroStart) / Math.max(1, blendStart - heroStart - height * .12));
  // Show the final frame while the stage is still pinned, before the next section enters.
  const dentistEnd = stageRelease - height * .5;
  const clinicalProgress = clampProgress((y - dentistStart) / Math.max(1, dentistEnd - dentistStart));
  const overFilm = y < filmBottom - 76;
  const lightSurface = !overFilm && surfaces.some(({ top, bottom }) => top < y + 76 && bottom > y + 76);

  header.classList.toggle('scrolled', y > 60);
  header.classList.toggle('over-film', overFilm);
  header.classList.toggle('light-header', lightSurface);
  if (previousBlend !== blend) {
    previousBlend = blend;
    updateFilmHandoff(blend);
  }
  scrubLightFilter(lightOffset - y, lightTravel);

  const still = progress < .22 ? 0 : progress < .46 ? .34 : .88;
  heroFilm.setActive(blend < 1);
  heroFilm.setProgress(motion.matches ? still : progress);
  const dentistNear = y >= blendStart - height * 1.55 && y < stageRelease + height;
  if (dentistNear) prepareDentist();
  dentistFilm?.setActive(dentistNear);
  const clinicalStill = clinicalProgress < ergonomicFrame / (dentistFrameCount - 1) ? 0 : 1;
  dentistFilm?.setProgress(motion.matches ? clinicalStill : clinicalProgress, {
    immediate: y <= dentistStart || y >= stageRelease
  });
}
addEventListener('scroll', () => {
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
const scrollSizer = new ResizeObserver(measureScroll);
[$('main'), stage, lightingSection, lightingTrack].forEach(element => scrollSizer.observe(element));
measureScroll();

async function initMotion(){await document.fonts.ready;if(!window.gsap||!window.ScrollTrigger)return;gsap.registerPlugin(ScrollTrigger);const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{gsap.from('.site-header',{y:-12,autoAlpha:0,duration:.65,ease:'power3.out'});$$('.reveal').forEach(el=>gsap.from(el,{y:35,autoAlpha:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%',once:true}}));gsap.to('.craft-media',{yPercent:8,ease:'none',scrollTrigger:{trigger:'.craft',start:'top bottom',end:'bottom top',scrub:1}});});
 const statement=$('#manifesto-text'),words=statement.textContent.trim().split(/\s+/);statement.setAttribute('aria-label',words.join(' '));statement.innerHTML=words.map(w=>`<span aria-hidden="true">${w}</span>`).join(' ');const spans=[...statement.children];ScrollTrigger.create({trigger:statement,start:'top 85%',end:'bottom 40%',onUpdate:self=>spans.forEach((s,i)=>s.classList.toggle('lit',motion.matches||i/spans.length<self.progress+.08))});if(motion.matches)spans.forEach(s=>s.classList.add('lit'));ScrollTrigger.refresh();window.addEventListener('pagehide',()=>mm.revert(),{once:true})}
initMotion().then(() => {
  // ScrollTrigger's initial refresh can interrupt the browser's smooth fragment scroll.
  if ([lensAnchor, '#contact'].includes(entryAnchor) && location.hash === entryAnchor && performance.getEntriesByType('navigation')[0]?.type === 'navigate') {
    document.querySelector(entryAnchor).scrollIntoView({ behavior: 'instant' });
  }
});
const lightObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  lightObserver.disconnect();
  const lightScene = $('#light-scene');
  try {
    const { createProductScene } = await import('./scene.js');
    lightingScene = await createProductScene(lightScene, { reducedMotion: motion.matches, lightingOnly: true });
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
addEventListener('pagehide', () => {
  scrollSizer.disconnect();
  lightObserver.disconnect();
  lightingScene?.dispose();
  window.ScrollTrigger?.getAll().forEach(trigger => trigger.kill());
}, { once: true });
$('#year').textContent=new Date().getFullYear();


const chairContainer = $('#chair-scene');
let chairScene;
let leavingPage = false;
const chairObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  chairObserver.disconnect();
  try {
    const { createChairScene } = await import('./chair-scene.js');
    chairScene = await createChairScene(chairContainer);
    if (leavingPage) chairScene.dispose();
  } catch (error) {
    console.error('TERO chair unavailable:', error);
    chairContainer.querySelector('.chair-status').textContent = 'The 3D chair could not load.';
    $('#chair-guide').hidden = true;
  } finally {
    chairContainer.removeAttribute('aria-busy');
  }
}, { rootMargin: '420px' });
chairObserver.observe(chairContainer);
addEventListener('pagehide', () => {
  leavingPage = true;
  chairObserver.disconnect();
  chairScene?.dispose();
}, { once: true });

const contactForm = $('#contact-form');
contactForm.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const interests = form.getAll('interest');
  const message = [
    'TERO fitting request',
    `Full name: ${form.get('name').trim()}`,
    `Email: ${form.get('email').trim()}`,
    `CT: ${form.get('ct').trim()}`,
    form.get('phone').trim() && `Phone: ${form.get('phone').trim()}`,
    `Specialty: ${form.get('specialty')}`,
    interests.length && `Interested in: ${interests.join(', ')}`,
    form.get('message').trim()
  ].filter(Boolean).join('\n');
  const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
  location.href = `sms:+989198005868${separator}body=${encodeURIComponent(message)}`;
});
contactForm.querySelector('button[type="submit"]').disabled = false;
