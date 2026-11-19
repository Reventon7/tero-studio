import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const loupes = [
  {
    slug: 'ergo-hd', name: 'Ergo HD', image: 'ergo-clean-v1.webp', powers: [3.5, 4, 5, 6, 8],
    summary: 'Five magnifications in the ergonomic loupe family.',
    suitedTo: 'A naturally relaxed ergonomic working posture.',
    description: 'The Ergo HD range spans 3.5× to 8×. Its ergonomic viewing geometry is designed to give a clear view of the working area while supporting a more upright posture.',
    facts: [['System', 'Ergonomic optics'], ['Viewing position', 'Designed for a relaxed working posture']],
    specifications: [['Optical system', 'Ergonomic'], ['Viewing posture', 'Naturally relaxed and upright']]
  },
  {
    slug: 'ergo-hd-zm', name: 'Ergo HD ZM', image: 'ergo-zm-clean-v1.webp', powers: [3.5, 5, 8],
    summary: 'Ergonomic optics with adjustable working distance.',
    suitedTo: 'Comfortable viewing as working distance changes.',
    description: 'Ergo HD ZM lets you adjust the working distance. That adjustment helps you bring the working area into focus as the distance between you and the patient changes.',
    facts: [['System', 'Ergonomic optics'], ['Working distance', 'Adjustable']],
    specifications: [['Optical system', 'Ergonomic'], ['Working distance', 'Adjustable']]
  },
  {
    slug: 'galilean', name: 'Galilean', image: 'galilean-clean-v1.webp', powers: [2.5, 3, 3.5],
    summary: 'Compact, lightweight optics with a broad field of view.',
    suitedTo: 'A broad view in a compact, lightweight format.',
    description: 'TERO’s Galilean system combines a compact optical housing with a broad field of view and good depth of field. It is designed to keep more of the working area in view at lower magnifications.',
    facts: [['System', 'Galilean optics'], ['Field and depth of view', 'Broad field of view with good depth of field']],
    specifications: [['Optical system', 'Galilean'], ['Housing', 'Compact and lightweight'], ['Field of view', 'Broad'], ['Depth of field', 'Excellent']],
    metrics: {
      2.5: { field: '100 mm', depth: '140 mm', suitedTo: 'Hygiene, exams and general procedures' },
      3: { field: '85 mm', depth: '110 mm', suitedTo: 'Everyday restorative dentistry' },
      3.5: { field: '65 mm', depth: '80 mm', suitedTo: 'Crown preparation and fine margins' }
    }
  },
  {
    slug: 'galilean-hd', name: 'Galilean HD', image: 'galilean-hd-clean-v1.webp', powers: [2.5, 3, 3.5],
    summary: 'Lightweight Galilean optics designed for a sharp, wide view.',
    suitedTo: 'A sharp, wide view with a lightweight housing.',
    description: 'Galilean HD retains the lightweight format of the Galilean family and emphasizes image sharpness, a wide field of view and useful depth of field across the available magnifications.',
    facts: [['System', 'Galilean HD optics'], ['Optical design', 'Sharp, wide view in a lightweight housing']],
    specifications: [['Optical system', 'Galilean HD'], ['Image quality', 'High optical quality and sharpness'], ['Field of view', 'Wide'], ['Depth of field', 'Wide'], ['Housing', 'Lightweight']]
  },
  {
    slug: 'prismatic', name: 'Prismatic', image: 'prismatic-clean-v1.webp', powers: [4, 5],
    summary: 'Keplerian optics for higher magnification and crisp edges.',
    suitedTo: 'Higher magnification with clear edge definition.',
    description: 'The Prismatic system, also called Keplerian, offers higher magnification than the Galilean range. The catalog emphasizes image resolution and edge definition at both 4× and 5×.',
    facts: [['System', 'Keplerian optics'], ['Optical design', 'Higher magnification with clear edge definition']],
    specifications: [['Optical system', 'Prismatic / Keplerian'], ['Image quality', 'High resolution'], ['Edge definition', 'Clear and precise']]
  }
];

const lights = [
  {
    slug: 'wired', name: 'Wired headlight', image: 'light-v1.webp', alt: 'TERO wired headlight with the amber filter raised',
    summary: 'A loupe-mounted light with an integrated amber filter.',
    description: 'The wired TERO headlight clips onto the frame and directs a white beam toward the working area. Lower the amber filter over the lamp to switch to warm illumination.',
    facts: [['Connection', 'Wired'], ['Mount', 'Frame-mounted clip'], ['Filter', 'Flip-down amber cover']]
  },
  {
    slug: 'wireless', name: 'Wireless headlight',
    summary: 'A cable-free headlight option.',
    description: 'The wireless headlight is the cable-free option in the TERO lighting range. Contact TERO for product specifications and availability.',
    facts: [['Connection', 'Wireless']]
  }
];

const home = await readFile('dist/index.html', 'utf8');
const shared = html => html.replaceAll('href="#top"', 'href="/"').replaceAll('href="#contact"', 'href="/#contact"');
const header = shared(home.match(/<header class="site-header">[\s\S]*?<\/header>/)[0]);
const footer = shared(home.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0]);
const detailDialog = home.match(/<dialog id="detail-dialog"[\s\S]*?<\/dialog>/)[0];
const mobileMenu = shared(home.match(/<dialog id="mobile-menu"[\s\S]*?<\/dialog>/)[0]);

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function photo(filename, alt, lazy = false) {
  if (!filename) return '<div class="catalog-placeholder">Product photography coming soon</div>';
  return `<img src="/assets/${escape(filename)}" alt="${escape(alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;
}

function powersLabel(powers) {
  return powers.map(value => `${value}×`).join(' · ');
}

function breadcrumb(title, parent) {
  const category = parent ? `<a href="${parent.url}">${escape(parent.name)}</a><span aria-hidden="true">/</span>` : '';
  return `<nav class="catalog-trail" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span>${category}<span aria-current="page">${escape(title)}</span></nav>`;
}

function action(label, url = '/#contact') {
  return `<a class="catalog-action" href="${url}">${escape(label)} <span aria-hidden="true">↗</span></a>`;
}

function facts(entries) {
  return `<dl class="catalog-facts">${entries.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`;
}

function intro(title, text, parent) {
  return `<div class="catalog-shell catalog-intro">${breadcrumb(title, parent)}<h1>${escape(title)}</h1><p class="catalog-lede">${escape(text)}</p></div>`;
}

function detail(product, parent, label) {
  const entries = product.powers ? [['Magnifications', powersLabel(product.powers)], ...product.facts] : product.facts;
  return `<section class="catalog-shell catalog-intro">
    ${breadcrumb(product.name, parent)}
    <div class="catalog-detail">
      <div><h1>${escape(product.name)}</h1><p class="catalog-lede">${escape(product.description)}</p>${facts(entries)}${action(label)}</div>
      <div class="catalog-media">${photo(product.image, product.alt ?? `TERO ${product.name} loupes`)}</div>
    </div>
  </section>`;
}

function cards(products, route, compact = false) {
  return `<div class="catalog-shell catalog-grid${compact ? ' catalog-grid--two' : ''}">${products.map(product => `
    <a class="catalog-card" href="${route}/${product.slug}">
      <div class="catalog-media">${photo(product.image, '', true)}</div>
      <div class="catalog-card-body">
        <h2 class="catalog-card-title">${escape(product.name)} <span aria-hidden="true">↗</span></h2>
        <p>${escape(product.summary)}</p>
        ${product.powers ? `<div class="catalog-powers">${powersLabel(product.powers)}</div>` : ''}
      </div>
    </a>`).join('')}</div>`;
}

async function page(route, title, description, content, interactive = false) {
  const filename = `dist${route}.html`;
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#10181e">
  <title>${escape(title)} | TERO</title>
  <meta name="description" content="${escape(description)}">
  <link rel="icon" href="/assets/favicon-v1.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <link rel="stylesheet" href="/style.css">
  ${interactive ? '<link rel="stylesheet" href="/lens.css">' : ''}
  <link rel="stylesheet" href="/catalog.css">
  ${route === '/about' ? '<script defer src="/vendor/gsap.min.js"></script><script defer src="/vendor/ScrollTrigger.min.js"></script>' : ''}
  <script type="module" src="/catalog-page.js"></script>
</head>
<body class="catalog-page">
  <a class="skip-link" href="#content">Skip to content</a>
  ${header}
  <main class="catalog-main" id="content">${content}</main>
  ${footer}
  ${mobileMenu}
</body>
</html>\n`);
}

await page('/loupes', 'Loupes', 'Explore the five TERO loupe systems.',
  intro('Loupes', 'Compare five TERO optical systems by magnification, working distance and field of view.') + cards(loupes, '/loupes'));

for (const product of loupes) {
  const specifications = {
    name: product.name,
    suitedTo: product.suitedTo,
    rows: [['Magnifications', powersLabel(product.powers)], ...product.specifications],
    metrics: product.metrics
  };
  await page(`/loupes/${product.slug}`, product.name, product.summary,
    detail(product, { name: 'Loupes', url: '/loupes' }, 'Ask about this model') + `
    <section class="lens-section catalog-lens" aria-labelledby="lens-title">
      <div class="catalog-shell">
        <h2 id="lens-title">Through the lens.</h2>
        <p class="catalog-demo-note">Try this model’s magnifications on a dental cast. The view is illustrative.</p>
        <div id="lens-interactive" data-loupe-powers="${product.powers.join(',')}" data-loupe-specifications="${escape(JSON.stringify(specifications))}">
          <noscript><img src="/assets/dental-casts-rebuilt-v1.webp" alt="White plaster dental casts"></noscript>
        </div>
      </div>
    </section>`, true);
}

await page('/lights', 'Lights', 'Explore TERO wired and wireless headlights.',
  intro('Lights', 'Explore wired and wireless lighting for your TERO loupes.') + cards(lights, '/lights', true));

for (const product of lights) {
  await page(`/lights/${product.slug}`, product.name, product.summary,
    detail(product, { name: 'Lights', url: '/lights' }, 'Ask about this headlight') +
    (product.slug === 'wired' ? `<section class="catalog-shell catalog-story">
      <h2>The wired kit.</h2>
      <div class="catalog-media">${photo('light-kit-v1.webp', 'TERO wired headlight, amber filter, mounts and power accessories', true)}</div>
    </section>` : ''));
}

const chairViews = [
  ['front', 'Front view'], ['rear', 'Rear view'], ['side', 'Side view']
];
await page('/chair', 'The TERO chair', 'A clinical chair with forearm supports and a wheeled base.', `
  <section class="catalog-shell catalog-intro">
    ${breadcrumb('Chair')}
    <div class="catalog-detail">
      <div>
        <h1>The TERO <em>chair.</em></h1>
        <p class="catalog-lede">A clinical chair with padded forearm supports, a shaped backrest and a wheeled base for moving around the working area.</p>
        ${facts([['Support', 'Padded seat, backrest and forearm rests'], ['Base', 'Five-spoke base with casters']])}
        ${action('Ask about the chair')}
      </div>
      <div class="catalog-chair-photo">${photo('chair-photo-three-quarter-v1.webp', 'Three-quarter view of the TERO chair')}</div>
    </div>
  </section>
  <section class="catalog-shell catalog-story">
    <h2>The chair in detail.</h2>
    <div class="catalog-gallery">${chairViews.map(([view, label]) => `<figure>${photo(`chair-photo-${view}-v1.webp`, `${label} of the TERO chair`, true)}<figcaption>${label}</figcaption></figure>`).join('')}</div>
  </section>`);

await page('/ergonomics', 'Ergonomics', 'How working distance, viewing angle and magnification shape the clinical setup.', `
  <section class="catalog-shell catalog-intro">
    ${breadcrumb('Ergonomics')}
    <div class="catalog-detail">
      <div><h1>Ergonomics.</h1><p class="catalog-lede">A clearer view starts with a setup that suits how you sit and work. Loupes, lighting and seating each play a part.</p></div>
      <div class="catalog-media">${photo('tero-ergonomics-v1.webp', 'A seated clinician using loupes with forearm support')}</div>
    </div>
  </section>
  <section class="catalog-shell catalog-story">
    <h2>What to check at a fitting.</h2>
    <div class="catalog-factors">
      <article><h3>Working distance</h3><p>Measure from your eyes to the working area with your chair and the patient positioned as you normally use them.</p></article>
      <article><h3>Viewing angle</h3><p>Try the optics in your usual seated position. The angle of the view affects how far you need to tilt your head to see the working area.</p></article>
      <article><h3>Field of view</h3><p>Compare how much of the working area you can see at each magnification. Choose a view that suits the procedures you do most often.</p></article>
    </div>
    ${action('Explore ergonomic loupes', '/loupes/ergo-hd')}
  </section>`);

await page('/about', 'About us', 'TERO designs optics, lighting and seating around the way clinicians work.', `
  <section class="catalog-shell catalog-intro">
    ${breadcrumb('About us')}
    <div class="catalog-detail">
      <div>
        <h1>About <em>TERO.</em></h1>
        <p class="catalog-lede">Our aim is to make clinical eyewear feel natural to wear, with optics that are comfortable to use throughout the working day.</p>
        <p class="catalog-lede">TERO brings together loupes, headlights and seating to support a clear view and a comfortable working position.</p>
        ${action('Contact TERO')}
      </div>
      <div class="catalog-media catalog-about-photo">${photo('tero-about-catalog-v1.webp', 'A hand holding TERO loupes from the product catalog')}</div>
    </div>
  </section>
  <section class="craft" id="craft">
    <div class="craft-media"><img src="/assets/detail-v1.webp" alt="Close-up of the silver TERO optical housing" loading="lazy"></div>
    <div class="craft-copy">
      <h2>Small details.<br><em>A different world.</em></h2>
      <p>Look closer. The shape of the housing.<br>The meeting of frame and optic.<br>The details that define TERO.</p>
      <button class="text-link" data-open="detail">Take a closer look <span>+</span></button>
    </div>
  </section>
  ${detailDialog}`);
