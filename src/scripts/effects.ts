// Site-wide effects: scroll progress bar, dot grid that lights up around the cursor,
// and the spotlight border on .spotlight cards.
import { clamp, onPage } from './utils';

const root = document.documentElement;
let bar: HTMLElement | null = null;
let raf = 0;
let pointer: { x: number; y: number } | null = null;

function paint() {
  raf = 0;
  if (bar) {
    const max = root.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`;
  }
  if (pointer) {
    root.style.setProperty('--cx', `${pointer.x}px`);
    root.style.setProperty('--cy', `${pointer.y}px`);
  }
}
const schedule = () => {
  if (!raf) raf = requestAnimationFrame(paint);
};

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule);

window.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    schedule();

    const card = (e.target as Element | null)?.closest?.<HTMLElement>('.spotlight');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
  },
  { passive: true },
);
root.addEventListener('pointerleave', () => {
  pointer = { x: -9999, y: -9999 };
  schedule();
});

onPage(() => {
  bar = document.querySelector('[data-scroll-progress]');
  schedule();
});
