// Services scrollytelling: one sticky visualization that follows the three services as they scroll by.
//   0 · Analysis       raw, scattered observations being scanned
//   1 · Understanding  the same points settle into clusters and a structure graph
//   2 · Automation     each cluster flows through a pipeline and comes out processed
import { RGB, clamp, easeInOutCubic, fitCanvas, gaussian, lerp, mulberry32, onPage, prefersReducedMotion, visibleLoop } from './utils';

const N = 84;
const CENTERS = [
  { x: 0.27, y: 0.34 },
  { x: 0.73, y: 0.32 },
  { x: 0.5, y: 0.74 },
];
const GREY = '115,115,115';
const CLUSTER_RGB = [RGB.emeraldLight, RGB.purpleLight, '229,229,229'];
const HUB = { x: 0.5, y: 0.5 };
const LANES_Y = [0.22, 0.5, 0.78];

const mix = (a: string, b: string, t: number) => {
  const pa = a.split(',').map(Number);
  const pb = b.split(',').map(Number);
  return pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',');
};

onPage(() => {
  const root = document.querySelector<HTMLElement>('[data-story]');
  const canvas = root?.querySelector<HTMLCanvasElement>('[data-story-canvas]');
  if (!root || !canvas) return;
  const steps = [...root.querySelectorAll<HTMLElement>('[data-story-step]')];
  const labels = [...root.querySelectorAll<HTMLElement>('[data-story-label]')];
  const still = prefersReducedMotion();
  const wide = window.matchMedia('(min-width: 1024px)');

  const rand = mulberry32(17);
  const points = Array.from({ length: N }, (_, i) => {
    const c = i % 3;
    return {
      c,
      x0: 0.08 + rand() * 0.84,
      y0: 0.1 + rand() * 0.8,
      x1: CENTERS[c].x + gaussian(rand) * 0.065,
      y1: CENTERS[c].y + gaussian(rand) * 0.06,
      phase: rand(),
      u: 0,
      w: 0.5 + rand(),
      p: rand() * 6.28,
    };
  });

  let size = fitCanvas(canvas);
  let f = 0;
  let clock = 0;
  let last = performance.now();
  let processed = 0;
  let hubGlow = 0;

  // Where the reader is: 0..2, interpolated between the centres of the service cards.
  const scrollTarget = () => {
    const anchor = window.innerHeight * 0.5;
    const centres = steps.map((s) => {
      const r = s.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    if (anchor <= centres[0]) return 0;
    for (let i = 0; i < centres.length - 1; i++) {
      if (anchor <= centres[i + 1]) return i + (anchor - centres[i]) / (centres[i + 1] - centres[i]);
    }
    return centres.length - 1;
  };

  const pipeline = (lane: number, u: number, X: (v: number) => number, Y: (v: number) => number) => {
    if (u < 0.5) {
      const t = u / 0.5;
      const a = { x: X(0.04), y: Y(LANES_Y[lane]) };
      const b = { x: X(0.26), y: Y(LANES_Y[lane]) };
      const e = { x: X(HUB.x) - 22, y: Y(HUB.y) };
      const q = 1 - t;
      return { x: q * q * a.x + 2 * q * t * b.x + t * t * e.x, y: q * q * a.y + 2 * q * t * b.y + t * t * e.y, done: false };
    }
    const t = (u - 0.5) / 0.5;
    return { x: lerp(X(HUB.x) + 22, X(0.78), t), y: Y(HUB.y), done: true };
  };

  const frame = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    if (!still) clock += dt;

    const target = wide.matches ? scrollTarget() : Math.floor(clock / 4500) % 3;
    f = still ? Math.round(target) : f + (target - f) * Math.min(1, dt / 200);
    const current = Math.round(f);
    labels.forEach((l, i) => l.classList.toggle('is-active', i === current));
    steps.forEach((s, i) => s.classList.toggle('is-current', wide.matches && i === current));

    const { ctx, w, h } = size;
    const pad = 22;
    const X = (v: number) => pad + v * (w - pad * 2);
    const Y = (v: number) => pad + v * (h - pad * 2);
    const unit = Math.min(w, h);
    const t = clock * 0.001;
    const e1 = easeInOutCubic(clamp(f));
    const e2 = easeInOutCubic(clamp(f - 1));
    const a0 = 1 - clamp(f * 1.5);
    const a1 = clamp(1 - Math.abs(f - 1) * 1.5);
    const a2 = clamp((f - 1) * 1.5);

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;

    // 0 · axes, grid and a scanning line
    if (a0 > 0) {
      ctx.strokeStyle = `rgba(${RGB.white},${0.05 * a0})`;
      ctx.beginPath();
      for (let g = 0; g <= 8; g++) {
        ctx.moveTo(X(g / 8), Y(0));
        ctx.lineTo(X(g / 8), Y(1));
        ctx.moveTo(X(0), Y(g / 8));
        ctx.lineTo(X(1), Y(g / 8));
      }
      ctx.stroke();
      const sx = X((t * 0.18) % 1);
      const grad = ctx.createLinearGradient(sx - 60, 0, sx, 0);
      grad.addColorStop(0, `rgba(${RGB.emerald},0)`);
      grad.addColorStop(1, `rgba(${RGB.emerald},${0.18 * a0})`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx - 60, Y(0), 60, Y(1) - Y(0));
      ctx.strokeStyle = `rgba(${RGB.emeraldLight},${0.5 * a0})`;
      ctx.beginPath();
      ctx.moveTo(sx, Y(0));
      ctx.lineTo(sx, Y(1));
      ctx.stroke();
    }

    // Particle positions for the current blend of states
    const pos = points.map((p) => {
      const x0 = X(p.x0 + Math.sin(t * p.w + p.p) * 0.012);
      const y0 = Y(p.y0 + Math.cos(t * p.w * 0.8 + p.p) * 0.012);
      const x1 = X(p.x1 + Math.sin(t * p.w * 0.6 + p.p) * 0.006);
      const y1 = Y(p.y1 + Math.cos(t * p.w * 0.5 + p.p) * 0.006);
      if (f <= 1) return { x: lerp(x0, x1, e1), y: lerp(y0, y1, e1), done: false };
      const u = (p.phase + t * 0.11) % 1;
      // Count items leaving the pipeline and flash the hub as they pass through it
      if (e2 > 0.9) {
        if (u < p.u) processed++;
        if (p.u < 0.5 && u >= 0.5) hubGlow = 1;
      }
      p.u = u;
      const q = pipeline(p.c, u, X, Y);
      return { x: lerp(x1, q.x, e2), y: lerp(y1, q.y, e2), done: q.done && e2 > 0.5 };
    });

    // 1 · cluster outlines, neighbourhood links and the structure graph between clusters
    if (a1 > 0) {
      ctx.setLineDash([3, 4]);
      CENTERS.forEach((c, i) => {
        ctx.strokeStyle = `rgba(${CLUSTER_RGB[i]},${0.35 * a1})`;
        ctx.beginPath();
        ctx.arc(X(c.x), Y(c.y), unit * 0.16, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${RGB.white},${0.22 * a1})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = CENTERS[i];
        const b = CENTERS[(i + 1) % 3];
        ctx.moveTo(X(a.x), Y(a.y));
        ctx.lineTo(X(b.x), Y(b.y));
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      const reach = unit * 0.075;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (points[i].c !== points[j].c) continue;
          const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
          if (d > reach) continue;
          ctx.strokeStyle = `rgba(${CLUSTER_RGB[points[i].c]},${(1 - d / reach) * 0.4 * a1})`;
          ctx.beginPath();
          ctx.moveTo(pos[i].x, pos[i].y);
          ctx.lineTo(pos[j].x, pos[j].y);
          ctx.stroke();
        }
      }
    }

    // 2 · lanes, the hub (brand hexagon) and the output
    if (a2 > 0) {
      ctx.strokeStyle = `rgba(${RGB.white},${0.08 * a2})`;
      ctx.beginPath();
      for (let lane = 0; lane < 3; lane++) {
        for (let k = 0; k <= 24; k++) {
          const q = pipeline(lane, (k / 24) * 0.4999, X, Y);
          ctx[k ? 'lineTo' : 'moveTo'](q.x, q.y);
        }
      }
      ctx.moveTo(X(HUB.x) + 22, Y(HUB.y));
      ctx.lineTo(X(0.78), Y(HUB.y));
      ctx.stroke();

      const hx = X(HUB.x);
      const hy = Y(HUB.y);
      if (hubGlow > 0) {
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 60);
        g.addColorStop(0, `rgba(${RGB.purple},${0.3 * hubGlow * a2})`);
        g.addColorStop(1, `rgba(${RGB.purple},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(hx - 60, hy - 60, 120, 120);
      }
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        ctx[i ? 'lineTo' : 'moveTo'](hx + 22 * Math.cos(a), hy + 22 * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${RGB.purple},${0.15 * a2})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${RGB.purpleLight},${0.85 * a2})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;

      const ox = X(0.78);
      ctx.strokeStyle = `rgba(${RGB.white},${0.3 * a2})`;
      ctx.beginPath();
      ctx.roundRect(ox, hy - 20, X(1) - ox, 40, 6);
      ctx.stroke();
      ctx.font = '500 10px "JetBrains Mono", "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${RGB.emeraldLight},${0.9 * a2})`;
      ctx.fillText(`✓ ${processed}`, (ox + X(1)) / 2, hy + 4);
    }

    // Points
    pos.forEach((q, i) => {
      const p = points[i];
      let rgb = mix(GREY, CLUSTER_RGB[p.c], e1);
      if (q.done) rgb = mix(rgb, RGB.white, e2);
      ctx.fillStyle = `rgba(${rgb},${0.55 + 0.35 * e1})`;
      if (q.done) {
        ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
      } else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    hubGlow = Math.max(0, hubGlow - dt / 500);
  };

  const ro = new ResizeObserver(() => {
    size = fitCanvas(canvas);
    frame(performance.now());
  });
  ro.observe(canvas);
  const stop = visibleLoop(canvas, frame);
  return () => {
    stop();
    ro.disconnect();
  };
});
