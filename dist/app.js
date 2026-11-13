import {createScrollFilm} from './hero-film.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let lightingScene,filterActive=false;
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const models={
 ergo:{name:'ERGO HD',title:'ERGO <span>HD</span>',category:'THE ERGONOMIC SERIES',family:'Ergonomic',series:'ERGONOMIC OPTICS',description:'An angled optical system designed around a more natural viewing posture. Explore five magnification options in the ERGO HD family.',sizes:['3.5','4.0','5.0','6.0','8.0']},
 'ergo-zm':{name:'ERGO HD ZM',title:'ERGO <span>HD ZM</span>',category:'THE ERGONOMIC SERIES',family:'Ergonomic / ZM',series:'ADJUSTABLE WORKING DISTANCE',description:'An ergonomic optical family with adjustable working distance. Choose from three magnifications listed in the TERO catalog.',sizes:['3.5','5.0','8.0']},
 galilean:{name:'Galilean',title:'Galilean',category:'THE GALILEAN SERIES',family:'Galilean',series:'COMPACT OPTICS',description:'A compact Galilean optical system. A considered introduction to magnification, available in three catalog options.',sizes:['2.5','3.0','3.5']},
 'galilean-hd':{name:'Galilean HD',title:'Galilean <span>HD</span>',category:'THE GALILEAN SERIES',family:'Galilean / HD',series:'GALILEAN HD OPTICS',description:'Discover the HD expression of the Galilean family. Explore its three magnifications and consult the catalog for the full optical description.',sizes:['2.5','3.0','3.5']},
 prismatic:{name:'Prismatic',title:'Prismatic',category:'THE PRISMATIC SERIES',family:'Prismatic / Keplerian',series:'PRISMATIC OPTICS',description:'A prism-based optical system, also known as Keplerian. Available in 4.0× and 5.0× magnification in the TERO catalog.',sizes:['4.0','5.0']}
};
let selection={model:'ergo',magnification:'3.5',color:'black'},imageRequests=new WeakMap(),toastTimer;
const colors={black:{name:'Graphite',number:'01'},blue:{name:'Midnight blue',number:'02'},red:{name:'Bordeaux',number:'03'}};
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3800)}
async function swapPhoto(element,src,alt){const token={};imageRequests.set(element,token);const next=new Image();next.src=src;try{await next.decode();if(imageRequests.get(element)!==token)return;element.src=src;element.alt=alt;if(!motion.matches&&window.gsap)gsap.fromTo(element,{opacity:.35},{opacity:1,duration:.45,overwrite:true})}catch{toast('This image could not load. The previous view is still available.')}}
let flowerRequest=0,previousMagnification=3.5;
async function renderFlower(){
 const request=++flowerRequest,scale=Number(selection.magnification),family=selection.model;
 const source=`assets/flower-${family}-${selection.magnification}.webp`,next=new Image();next.src=source;
 try{await next.decode();if(request!==flowerRequest)return;
 const photo=$('#magnification-photo');photo.src=source;photo.alt=`${models[family].name} catalog orchid at ${scale} times magnification`;
 $('#flower-scale').textContent=selection.magnification+'×';$('#flower-caption').textContent=models[family].name+' · Catalog view';
 if(!motion.matches&&window.gsap)gsap.fromTo(photo,{scale:scale>previousMagnification?.86:1.14,opacity:.3},{scale:1,opacity:1,duration:.75,ease:'power3.out',overwrite:true});previousMagnification=scale;
 }catch{toast('The magnification preview could not load. Please try again.')}
}
function renderMagnifications(){const model=models[selection.model];$('#magnifications').replaceChildren(...model.sizes.map(size=>{const b=document.createElement('button');b.type='button';b.textContent=size+'×';b.setAttribute('aria-label',size+' times magnification');b.setAttribute('aria-pressed',size===selection.magnification);b.addEventListener('click',()=>{selection.magnification=size;$$('#magnifications button').forEach(button=>button.setAttribute('aria-pressed',button===b));$('#magnification-current').textContent=size+'×';renderFlower()});return b}));$('#magnification-current').textContent=selection.magnification+'×';renderFlower()}
function chooseModel(key){if(!models[key])return;selection.model=key;document.querySelector('.product-plate').classList.toggle('light-plate',['ergo-zm','galilean-hd'].includes(key));selection.magnification=models[key].sizes[0];const model=models[key],number=Object.keys(models).indexOf(key)+1;$$('[data-model]').forEach(b=>{const active=b.dataset.model===key;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1});$('#product-panel').setAttribute('aria-labelledby','tab-'+key);$('#product-title').innerHTML=model.title;$('#product-category').textContent=model.category;$('#product-description').textContent=model.description;$('#spec-family').textContent=model.family;$('#spec-range').textContent=model.sizes[0]+'× — '+model.sizes.at(-1)+'×';swapPhoto($('#product-photo'),`assets/${key}-clean.webp`,'TERO '+model.name+' loupes');renderMagnifications()}
$$('[data-model]').forEach((button,index,array)=>{button.addEventListener('click',()=>chooseModel(button.dataset.model));button.addEventListener('keydown',e=>{let target;if(e.key==='ArrowRight')target=(index+1)%array.length;if(e.key==='ArrowLeft')target=(index+array.length-1)%array.length;if(e.key==='Home')target=0;if(e.key==='End')target=array.length-1;if(target!==undefined){e.preventDefault();chooseModel(array[target].dataset.model);array[target].focus()}})});renderMagnifications();
$$('[data-color]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.color;selection.color=key;$$('[data-color]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active)});swapPhoto($('#frame-photo'),`assets/frame-${key}.webp`,colors[key].name+' TERO frame with loupes');$('#frame-name').textContent=colors[key].number+' / '+colors[key].name.toUpperCase()}));
$('#save-selection').addEventListener('click',()=>{const model=models[selection.model];const text=`TERO — YOUR OPTICAL SELECTION\n\nOptical family: ${model.name}\nMagnification: ${selection.magnification}x\nFrame finish of interest: ${colors[selection.color].name}\n\nThis is a browsing selection, not an order or a confirmed configuration.\nConfirm frame compatibility, fit and working distance using the TERO catalog and your supplier.\n\nCatalog: TERO-2.pdf\n`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='TERO-my-selection.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your TERO selection has been downloaded.');});
$('#light-toggle').addEventListener('click',()=>{filterActive=!filterActive;$('#light-toggle').setAttribute('aria-pressed',filterActive);$('#lighting').classList.toggle('amber-mode',filterActive);$('#filter-action').textContent=filterActive?'Raise the amber filter':'Lower the amber filter';$('#light-state').textContent=filterActive?'AMBER LIGHT / FILTER LOWERED':'WHITE LIGHT / FILTER RAISED';lightingScene?.setFilter(filterActive)});

const dialog=$('#detail-dialog'),menu=$('#mobile-menu');let opener;
function openDialog(kind){opener=document.activeElement;let content='';if(kind==='compare'){content=`<h2 id="dialog-title" class="compare-title">A perspective for every detail.</h2><div class="table-scroll"><table><thead><tr><th>OPTICAL FAMILY</th><th>SYSTEM</th><th>CATALOG MAGNIFICATIONS</th></tr></thead><tbody>${Object.values(models).map(m=>`<tr><td>${m.name}</td><td>${m.family}</td><td>${m.sizes.map(s=>s+'×').join(' · ')}</td></tr>`).join('')}</tbody></table></div><p class="dialog-note">Magnifications are taken from the supplied TERO catalog. Final fit, working distance and available combinations require individual confirmation.</p><a class="text-link" href="assets/TERO-catalog.pdf" target="_blank" rel="noopener">Open the original catalog <span>↗</span></a>`}else{const data={anatomy:{title:'Every element.<br>One perspective.',image:'hero',alt:'Original TERO loupe photography',text:'A closer look at the relationship between frame, optics and light. The hero film shows how the parts come together.',list:['Frame and temple design','Twin optical housings','Eyewear-mounted lighting'],note:'Illustrative geometry, not a dimensional or internal engineering model.'},detail:{title:'The finer details.',image:'detail',alt:'TERO optical housing close-up',text:'The original photography reveals the finish and proportions of the TERO optical housing. Explore its form, from the front lens to the meeting of optic and frame.'},kit:{title:'Light. Complete.',image:'light-kit',alt:'TERO lighting kit and accessories',text:'The supplied kit photography shows the lighting system with its accessories and filter. Refer to your supplier to confirm kit contents and frame compatibility.'},chair:{title:'A place for focus.',image:'chair',alt:'TERO chair with black saddle-style seat',text:'Explore the TERO seating collection in the original product photograph. A saddle-style seat, support and wheeled base complete the composition.'},product:{title:models[selection.model].name,image:selection.model+'-clean',alt:'TERO '+models[selection.model].name+' loupes',text:models[selection.model].description}}[kind];if(!data)return;content=`<div class="dialog-grid"><img src="assets/${data.image}.webp" alt="${data.alt}"><div><h2 id="dialog-title">${data.title}</h2><p>${data.text}</p>${data.list?'<ul>'+data.list.map(s=>'<li>'+s+'</li>').join('')+'</ul>':''}${data.note?'<p class="dialog-note">'+data.note+'</p>':''}<a class="text-link" href="assets/TERO-catalog.pdf" target="_blank" rel="noopener">The TERO catalog <span>↗</span></a></div></div>`}$('#dialog-content').innerHTML=content;dialog.showModal();document.body.style.overflow='hidden'}
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openDialog(b.dataset.open)));$('#open-photo').addEventListener('click',()=>openDialog('product'));
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
const pageProgress = $('.page-progress');
const lightSections = $$('#collection,#frames,#seating,.questions');
const heroFilm = createScrollFilm($('#hero-film'), $('#hero-ambient'), motion, {
  directory: 'hero-film-48', frameCount: 431, openingFrame: 36
});
let dentistFilm;

const clampProgress = value => Math.max(0, Math.min(1, value));

function prepareDentist() {
  dentistFilm ??= createScrollFilm($('#dentist-film'), $('#dentist-ambient'), motion, {
    directory: 'dentist-film-48', frameCount: 477, widths: [1152, 768]
  });
}

let scrollPending = false;
function scrollState() {
  scrollPending = false;
  const y = scrollY;
  const height = stage.offsetHeight;
  const heroStart = experience.offsetTop + story.offsetTop;
  const dentistStart = experience.offsetTop + dentistStory.offsetTop;
  const blendStart = dentistStart - height * .52;
  const blend = clampProgress((y - blendStart) / Math.max(1, dentistStart - blendStart));
  const progress = clampProgress((y - heroStart) / Math.max(1, blendStart - heroStart - height * .12));
  const clinicalProgress = clampProgress((y - dentistStart) / Math.max(1, (dentistStory.offsetHeight - height) * .92));
  const overFilm = y < experience.offsetTop + experience.offsetHeight - header.offsetHeight;
  const lightSurface = !overFilm && lightSections.some(section => {
    const rect = section.getBoundingClientRect();
    return rect.top < 76 && rect.bottom > 76;
  });
  const total = document.documentElement.scrollHeight - innerHeight;
  const opacity = motion.matches ? Number(blend >= 1) : blend * blend * (3 - 2 * blend);

  header.classList.toggle('scrolled', y > 60);
  header.classList.toggle('over-film', overFilm);
  header.classList.toggle('light-header', lightSurface);
  pageProgress.style.transform = `scaleX(${total > 0 ? y / total : 0})`;
  dentistPanel.style.opacity = opacity;
  stage.style.setProperty('--hero-copy', 1 - clampProgress(opacity / .38));
  stage.style.setProperty('--dentist-copy', clampProgress((opacity - .58) / .42));
  dentistPanel.style.visibility = opacity > 0 ? 'visible' : 'hidden';
  heroPanel.style.visibility = opacity < 1 ? 'visible' : 'hidden';
  heroPanel.inert = opacity >= .5;
  dentistPanel.inert = opacity < .5;

  const still = progress < .22 ? 0 : progress < .46 ? .34 : .88;
  heroFilm.setProgress(motion.matches ? still : progress);
  if (y >= blendStart - height * .7) prepareDentist();
  const clinicalStill = clinicalProgress < .35 ? 0 : clinicalProgress < .75 ? .55 : 1;
  dentistFilm?.setProgress(motion.matches ? clinicalStill : clinicalProgress);
}
addEventListener('scroll', () => {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(scrollState);
}, { passive: true });
addEventListener('resize', scrollState);
scrollState();

async function initMotion(){await document.fonts.ready;if(!window.gsap||!window.ScrollTrigger)return;gsap.registerPlugin(ScrollTrigger);const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{gsap.from('.site-header',{y:-12,autoAlpha:0,duration:.65,ease:'power3.out'});$$('.reveal').forEach(el=>gsap.from(el,{y:35,autoAlpha:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%',once:true}}));gsap.to('.craft-media',{yPercent:8,ease:'none',scrollTrigger:{trigger:'.craft',start:'top bottom',end:'bottom top',scrub:1}});});
 const statement=$('#manifesto-text'),words=statement.textContent.trim().split(/\s+/);statement.setAttribute('aria-label',words.join(' '));statement.innerHTML=words.map(w=>`<span aria-hidden="true">${w}</span>`).join(' ');const spans=[...statement.children];ScrollTrigger.create({trigger:statement,start:'top 85%',end:'bottom 40%',onUpdate:self=>spans.forEach((s,i)=>s.classList.toggle('lit',motion.matches||i/spans.length<self.progress+.08))});if(motion.matches)spans.forEach(s=>s.classList.add('lit'));ScrollTrigger.refresh();window.addEventListener('pagehide',()=>mm.revert(),{once:true})}
initMotion();
const lightObserver=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;lightObserver.disconnect();import('./scene.js').then(async({createProductScene})=>{lightingScene=await createProductScene($('#light-scene'),{reducedMotion:motion.matches,lightingOnly:true});lightingScene.setFilter(filterActive)}).catch(error=>{console.error('TERO headlight unavailable:',error);$('#light-scene').classList.add('fallback-only');$('#light-scene .scene-loading').textContent='Product photography / 3D unavailable';$('#light-toggle').disabled=true;$('#filter-action').textContent='Interactive filter unavailable'})},{rootMargin:'350px'});lightObserver.observe($('#lighting'));
motion.addEventListener('change', () => {
  if (lightingScene) lightingScene.state.paused = motion.matches;
  scrollState();
});
addEventListener('pagehide', () => {
  lightObserver.disconnect();
  lightingScene?.dispose();
  window.ScrollTrigger?.getAll().forEach(trigger => trigger.kill());
}, { once: true });
$('#year').textContent=new Date().getFullYear();


let chairScene,chairView=0;
function chooseChairView(index){chairView=index;chairScene?.view(index);document.querySelectorAll('[data-chair-view]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.chairView)===index));}
document.querySelectorAll('[data-chair-view]').forEach(b=>b.addEventListener('click',()=>chooseChairView(Number(b.dataset.chairView))));
$('#chair-explore').addEventListener('click',()=>chooseChairView((chairView+1)%4));
$('#chair-motion').addEventListener('click',()=>{if(!chairScene)return;chairScene.state.paused=!chairScene.state.paused;$('#chair-motion').setAttribute('aria-pressed',chairScene.state.paused);$('#chair-motion').setAttribute('aria-label',chairScene.state.paused?'Resume chair motion':'Pause chair motion');$('#chair-motion').textContent=chairScene.state.paused?'▷':'Ⅱ'});
const chairObserver=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;chairObserver.disconnect();import('./chair-scene.js').then(async({createChairScene})=>{chairScene=await createChairScene($('#chair-scene'));chooseChairView(chairView)}).catch(error=>{console.error('TERO chair unavailable:',error);$('#chair-scene .chair-loading').textContent='3D unavailable on this device. Explore the catalog below.';document.querySelectorAll('[data-chair-view],#chair-motion,#chair-explore').forEach(b=>b.disabled=true)})},{rootMargin:'500px'});chairObserver.observe($('#seating'));
addEventListener('pagehide',()=>{chairObserver.disconnect();chairScene?.dispose()},{once:true});
