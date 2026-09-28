// Runs the small generative visualizations (canvas[data-viz="name"]) registered with registerViz.
// Each one animates while on screen and gets `hover` while its card ([data-viz-host] or .spotlight) is hovered.
import { fitCanvas, onPage, prefersReducedMotion, visibleLoop } from '../utils';

export interface Viz {
  /** `dt` in ms, capped. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, dt: number, hover: boolean): void;
  /** Jump to a representative finished state (reduced motion). */
  settle(): void;
}

export const MONO = '500 9px "JetBrains Mono", "Space Mono", monospace';

const registry: Record<string, () => Viz> = {};

export function registerViz(name: string, factory: () => Viz) {
  registry[name] = factory;
}

onPage(() => {
  const still = prefersReducedMotion();
  const cleanups: (() => void)[] = [];

  document.querySelectorAll<HTMLCanvasElement>('canvas[data-viz]').forEach((canvas) => {
    const viz = registry[canvas.dataset.viz ?? '']?.();
    if (!viz) return;
    const host = canvas.closest<HTMLElement>('[data-viz-host], .spotlight') ?? canvas;
    let hover = false;
    let last = performance.now();
    let size = fitCanvas(canvas);

    const render = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      size.ctx.clearRect(0, 0, size.w, size.h);
      viz.draw(size.ctx, size.w, size.h, now, dt, hover);
    };

    const ro = new ResizeObserver(() => {
      size = fitCanvas(canvas);
      if (still) render(last);
    });
    ro.observe(canvas);
    const enter = () => (hover = true);
    const leave = () => (hover = false);
    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);

    if (still) {
      viz.settle();
      render(performance.now());
    } else cleanups.push(visibleLoop(canvas, render));

    cleanups.push(() => {
      ro.disconnect();
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
    });
  });

  return () => cleanups.forEach((stop) => stop());
});
