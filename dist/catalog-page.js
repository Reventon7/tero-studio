import {prefetchCatalog} from './navigation.js';

addEventListener('load', prefetchCatalog, { once: true });

const demo = document.querySelector('[data-loupe-powers]');
if (demo) {
  const observer = new IntersectionObserver(async entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    try {
      const { loadLens } = await import('./bundles/entries.js');
      const { mountLens } = await loadLens();
      mountLens(demo, demo.dataset.loupePowers.split(',').map(Number), JSON.parse(demo.dataset.loupeSpecifications));
    } catch {
      demo.textContent = 'The interactive loupe could not load. Refresh to try again.';
    }
  }, { rootMargin: '350px' });
  observer.observe(demo);
}
