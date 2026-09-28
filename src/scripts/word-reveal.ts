// Paragraphs marked [data-word-reveal] light up word by word as they scroll into view.
// The phrase in data-accent-<lang> lights up in emerald.
import { clamp, onPage, prefersReducedMotion } from './utils';

onPage(() => {
  const paragraphs = [...document.querySelectorAll<HTMLElement>('[data-word-reveal]')];
  if (!paragraphs.length) return;
  const still = prefersReducedMotion();
  let words: HTMLElement[][] = [];
  let raf = 0;

  const split = () => {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'es';
    words = paragraphs.map((p) => {
      const text = (p.textContent ?? '').trim().replace(/\s+/g, ' ');
      const accent = p.getAttribute(`data-accent-${lang}`) ?? '';
      const from = accent ? text.indexOf(accent) : -1;
      const to = from + accent.length;
      p.textContent = '';
      let offset = 0;
      return text.split(' ').map((word) => {
        const span = document.createElement('span');
        span.className = 'word';
        if (from >= 0 && offset >= from && offset < to) span.classList.add('word-accent');
        span.textContent = word;
        p.append(span, ' ');
        offset += word.length + 1;
        return span;
      });
    });
    update();
  };

  const update = () => {
    raf = 0;
    paragraphs.forEach((p, i) => {
      const rect = p.getBoundingClientRect();
      const progress = still ? 1 : clamp((window.innerHeight * 0.85 - rect.top) / (window.innerHeight * 0.55));
      const lit = progress * words[i].length;
      words[i].forEach((w, j) => w.classList.toggle('is-lit', j < lit));
    });
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  split();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // The language switch replaces the paragraph text: split it again.
  document.addEventListener('syfron:lang', split);
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('syfron:lang', split);
    cancelAnimationFrame(raf);
  };
});
