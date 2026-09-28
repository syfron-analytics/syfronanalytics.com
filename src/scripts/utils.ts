export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Brand colors as "r,g,b" so they can be combined with any alpha.
export const RGB = {
  emerald: '16,185,129',
  emeraldLight: '52,211,153',
  purple: '139,92,246',
  purpleLight: '167,139,250',
  white: '255,255,255',
};

/** Seeded PRNG (mulberry32): same sequence, and therefore same drawing, on every visit. */
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller) from a uniform source. */
export function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Matches the canvas backing store to its CSS size at the device pixel ratio, so it stays sharp. */
export function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/**
 * Runs `frame` on every animation frame, but only while `el` is on screen and the tab is visible.
 * Returns a function that stops it.
 */
export function visibleLoop(el: Element, frame: (now: number) => void) {
  let raf = 0;
  let inView = false;
  const tick = (now: number) => {
    frame(now);
    raf = requestAnimationFrame(tick);
  };
  const update = () => {
    const run = inView && !document.hidden;
    if (run && !raf) raf = requestAnimationFrame(tick);
    else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    update();
  });
  io.observe(el);
  document.addEventListener('visibilitychange', update);
  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', update);
    cancelAnimationFrame(raf);
    raf = 0;
  };
}

/**
 * Runs `init` on every page load (including View Transition navigations) and
 * the cleanup it returns before the page is swapped out.
 */
export function onPage(init: () => (() => void) | void) {
  let cleanup: (() => void) | void;
  const stop = () => {
    cleanup?.();
    cleanup = undefined;
  };
  document.addEventListener('astro:page-load', () => {
    stop();
    cleanup = init();
  });
  document.addEventListener('astro:before-swap', stop);
}
