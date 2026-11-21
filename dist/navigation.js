const menu = document.querySelector('#mobile-menu');
const menuToggle = document.querySelector('.menu-toggle');
let prefetchStarted = false;

// Dialog autofocus is focus-visible on WebKit even after a touch. Keep rings
// for keyboard navigation without leaving a selection box after taps/clicks.
document.documentElement.dataset.inputMethod = 'pointer';
addEventListener('pointerdown', () => {
  document.documentElement.dataset.inputMethod = 'pointer';
}, { capture: true, passive: true });
addEventListener('keydown', event => {
  if (!event.metaKey && !event.ctrlKey && !event.altKey &&
      !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
    document.documentElement.dataset.inputMethod = 'keyboard';
  }
}, { capture: true });

export function prefetchCatalog() {
  if (prefetchStarted || navigator.connection?.saveData) return;
  prefetchStarted = true;
  const urls = [...document.querySelectorAll('.desktop-nav a')]
    .map(link => link.getAttribute('href'))
    .filter(url => url.startsWith('/') && !url.includes('#'));
  if (HTMLScriptElement.supports?.('speculationrules')) {
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls }] });
    document.head.append(rules);
  } else {
    for (const url of urls) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.append(link);
    }
  }
}

menuToggle.addEventListener('click', () => {
  menu.showModal();
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
});
menu.querySelector('[data-close]').addEventListener('click', () => menu.close());
menu.querySelectorAll('nav a').forEach(link => link.addEventListener('click', event => {
  // Keep the dialog covering the old page until the new document replaces it.
  // Closing first flashes the underlying hero during cross-page navigation.
  const destination = new URL(link.href, location.href);
  const leavesPage = destination.origin !== location.origin || destination.pathname !== location.pathname;
  const primary = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  if (!primary || !leavesPage) menu.close();
}));
addEventListener('pageshow', event => {
  if (event.persisted && menu.open) menu.close();
});
menu.addEventListener('close', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  menuToggle.focus({ preventScroll: true });
});
matchMedia('(min-width: 1101px) and (min-height: 521px)').addEventListener('change', event => {
  if (event.matches && menu.open) menu.close();
});

const products = document.querySelector('[data-hover-products]');
const trigger = products.querySelector('summary');
const hover = matchMedia('(hover: hover) and (pointer: fine)');
let openedByHover = false;
products.addEventListener('pointerenter', () => {
  if (!hover.matches || products.open) return;
  openedByHover = true;
  products.open = true;
});
products.addEventListener('pointerleave', () => {
  if (openedByHover && !products.contains(document.activeElement)) products.open = false;
});
trigger.addEventListener('click', event => {
  if (event.detail > 0 && openedByHover && products.open) event.preventDefault();
  openedByHover = false;
});
products.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !products.open) return;
  products.open = false;
  trigger.focus();
});
products.addEventListener('focusout', event => {
  if (!products.contains(event.relatedTarget)) products.open = false;
});
document.addEventListener('pointerdown', event => {
  if (!products.contains(event.target)) products.open = false;
});

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
