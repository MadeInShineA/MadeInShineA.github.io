// Header image: NASA's Astronomy Picture of the Day.
// Loaded from <head> so the download starts before the page is parsed. The header shows a
// loader until the image is ready, then fades it in. window.APOD comes from
// assets/apod-data.js, refreshed by scripts/update-apod.py (run by the update workflow).

(function () {
  const apod = window.APOD;
  const width = window.innerWidth * (window.devicePixelRatio || 1) > 1400 ? 2400 : 1280;
  const src = apod?.image ? `${apod.image}?w=${width}&fit=clip` : null;

  let state = src ? 'loading' : 'failed';
  const preload = new Image();
  if (src) {
    preload.onload = () => { state = 'ready'; render(); };
    preload.onerror = () => { state = 'failed'; render(); };
    preload.src = src;
  }

  function render() {
    const hero = document.querySelector('.photo-hero');
    if (!hero || state === 'loading') return;
    hero.classList.remove('is-loading');

    if (state === 'failed') {
      hero.classList.add('is-empty');
      return;
    }

    const img = hero.querySelector('img');
    img.alt = apod.alt || apod.title;
    img.src = src;
    hero.classList.add('is-apod');

    const backdrop = document.querySelector('.backdrop');
    if (backdrop) backdrop.style.backgroundImage = `url("${apod.image}?w=900&fit=clip")`;

    const caption = document.createElement('a');
    caption.className = 'photo-caption';
    caption.href = apod.link;
    caption.target = '_blank';
    caption.rel = 'noopener';
    caption.innerHTML = '<i class="icon-telescope" aria-hidden="true"></i> NASA Astronomy Picture of the Day';
    caption.title = apod.credit ? `${apod.title}, ${apod.copyright ? '© ' : ''}${apod.credit}` : apod.title;
    hero.appendChild(caption);
  }

  // The image may finish before or after the header exists in the DOM
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
