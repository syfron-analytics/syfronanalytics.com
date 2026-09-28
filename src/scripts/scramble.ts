// Text "decoding": each character cycles through random glyphs before settling on its final letter.
import { mulberry32 } from './utils';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/';

interface Options {
  /** ms before the first letter can settle. */
  delay?: number;
  /** ms over which letters settle, left to right. */
  duration?: number;
  /** Random extra ms per letter. */
  jitter?: number;
}

/**
 * Scrambles each element from its current text into `text`, all targets sharing one left-to-right sweep.
 * Returns a function that cancels and shows the final text.
 */
export function scramble(targets: { el: HTMLElement; text: string }[], { delay = 0, duration = 900, jitter = 350 }: Options = {}) {
  const rand = mulberry32(7);
  const lengths = targets.map((t) => Math.max(t.text.length, t.el.textContent?.length ?? 0));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const begin = performance.now() + delay;
  let index = 0;
  const reveal = lengths.map((len) => Array.from({ length: len }, () => begin + (index++ / total) * duration + rand() * jitter));

  let raf = 0;
  let lastSwap = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - lastSwap < 45) return;
    lastSwap = now;
    let done = true;
    targets.forEach((t, i) => {
      let out = '';
      for (let j = 0; j < lengths[i]; j++) {
        // Positions past the end of the final text scramble too, then disappear.
        const ch = t.text[j] ?? '';
        if (ch === ' ' || now >= reveal[i][j]) out += ch;
        else {
          done = false;
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      t.el.textContent = out;
    });
    if (done) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    targets.forEach((t) => (t.el.textContent = t.text));
  };
}
