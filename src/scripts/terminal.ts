// Contact page terminal: types a command, then prints the (translated) lines below it.
import { onPage, prefersReducedMotion } from './utils';

onPage(() => {
  const term = document.querySelector<HTMLElement>('[data-terminal]');
  if (!term || prefersReducedMotion()) return;
  const lines = [...term.querySelectorAll<HTMLElement>('[data-term-line]')];
  const prompt = term.querySelector<HTMLElement>('[data-term-prompt]')!;
  const cursor = term.querySelector<HTMLElement>('[data-term-cursor]')!;

  // Hide everything until the terminal is on screen.
  const texts = lines.map((l) => l.textContent ?? '');
  lines.forEach((l) => (l.style.visibility = 'hidden'));
  prompt.style.visibility = 'hidden';

  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  const typeLine = (i: number, at: number, speed: number) => {
    const line = lines[i];
    const text = texts[i];
    const node = document.createTextNode('');
    later(at, () => {
      line.textContent = '';
      line.append(node, cursor);
      line.style.visibility = 'visible';
    });
    for (let k = 1; k <= text.length; k++) later(at + k * speed, () => (node.data = text.slice(0, k)));
    return at + text.length * speed;
  };

  const finish = () => {
    timers.forEach(clearTimeout);
    lines.forEach((l, i) => {
      // Translated lines already hold their full text; the command may have been cut mid-typing.
      if (!l.hasAttribute('data-i18n')) l.textContent = texts[i];
      l.style.visibility = 'visible';
    });
    prompt.style.visibility = 'visible';
    prompt.append(cursor);
  };

  const run = () => {
    // The command types like a person; the answer prints fast.
    let t = typeLine(0, 300, 55);
    for (let i = 1; i < lines.length; i++) t = typeLine(i, t + 350, 12);
    later(t + 300, finish);
  };

  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    run();
  });
  io.observe(term);

  // A language switch rewrites the lines: show them in full.
  const onLang = () => {
    io.disconnect();
    finish();
  };
  document.addEventListener('syfron:lang', onLang);

  return () => {
    io.disconnect();
    timers.forEach(clearTimeout);
    document.removeEventListener('syfron:lang', onLang);
  };
});
