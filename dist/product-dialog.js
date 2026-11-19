const dialog = document.querySelector('#detail-dialog');

if (dialog) {
  let opener;
  const details = {
    anatomy: {
      title: 'Every element.<br>One perspective.', image: 'hero', alt: 'Original TERO loupe photography',
      text: 'A closer look at the relationship between frame, optics and light. The hero film shows how the parts come together.',
      list: ['Frame and temple design', 'Twin optical housings', 'Eyewear-mounted lighting'],
      note: 'Illustrative geometry, not a dimensional or internal engineering model.'
    },
    detail: {
      title: 'The finer details.', image: 'detail', alt: 'TERO optical housing close-up',
      text: 'The original photography reveals the finish and proportions of the TERO optical housing. Explore its form, from the front lens to the meeting of optic and frame.'
    },
    kit: {
      title: 'Light. Complete.', image: 'light-kit', alt: 'TERO lighting kit and accessories',
      text: 'The supplied kit photography shows the lighting system with its accessories and filter. Refer to your supplier to confirm kit contents and frame compatibility.'
    }
  };

  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
    const data = details[button.dataset.open];
    if (!data) return;
    opener = document.activeElement;
    const list = data.list ? `<ul>${data.list.map(item => `<li>${item}</li>`).join('')}</ul>` : '';
    const note = data.note ? `<p class="dialog-note">${data.note}</p>` : '';
    dialog.querySelector('#dialog-content').innerHTML = `<div class="dialog-grid">
      <img src="/assets/${data.image}-v1.webp" alt="${data.alt}">
      <div><h2 id="dialog-title">${data.title}</h2><p>${data.text}</p>${list}${note}</div>
    </div>`;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }));

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const { left, top, right, bottom } = dialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    opener?.focus({ preventScroll: true });
  });
}
