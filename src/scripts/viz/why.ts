// "Why Syfron" bento: research signal, noise that self-organizes, a lattice that is built to last,
// and a formula that turns into code.
import { RGB, clamp, easeInOutCubic, easeOutCubic, lerp, mulberry32, onPage, prefersReducedMotion } from '../utils';
import { scramble } from '../scramble';
import { MONO, registerViz, type Viz } from './runner';

// ── Research: a complex signal and the components it decomposes into ────────
function signal(): Viz {
  const components = [
    { f: 1, a: 0.34, p: 0 },
    { f: 2.6, a: 0.17, p: 1.3 },
    { f: 5.2, a: 0.08, p: 2.1 },
  ];
  const rand = mulberry32(5);
  const noise = Array.from({ length: 80 }, () => (rand() - 0.5) * 0.18);
  let t = 0;

  return {
    settle() {
      t = 1.3;
    },
    draw(ctx, w, h, _now, dt, hover) {
      t += dt * (hover ? 0.0016 : 0.0006);
      const mid = h / 2 + 6;
      const amp = h * 0.36;
      const wave = (c: (typeof components)[number], x: number) =>
        Math.sin(2 * Math.PI * (c.f * (x / w) * 1.6 - t * c.f * 0.5) + c.p) * c.a;
      const sum = (x: number) => components.reduce((s, c) => s + wave(c, x), 0);

      ctx.strokeStyle = `rgba(${RGB.white},0.05)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 24; x < w; x += 24) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      // Components
      ctx.lineWidth = 1;
      components.forEach((c, i) => {
        ctx.strokeStyle = `rgba(${RGB.purpleLight},${0.35 - i * 0.08})`;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) ctx[x ? 'lineTo' : 'moveTo'](x, mid - wave(c, x) * amp);
        ctx.stroke();
      });

      // Noisy measurements around the signal
      ctx.fillStyle = `rgba(${RGB.white},0.35)`;
      for (let i = 0, x = 7; x < w; x += 14, i++) {
        ctx.beginPath();
        ctx.arc(x, mid - (sum(x) + noise[i % noise.length]) * amp, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Recovered signal
      ctx.strokeStyle = `rgba(${RGB.emeraldLight},0.95)`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) ctx[x ? 'lineTo' : 'moveTo'](x, mid - sum(x) * amp);
      ctx.stroke();

      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(${RGB.white},0.35)`;
      ctx.fillText('f(t) = Σ aₖ·sin(ωₖt + φₖ)', 10, 14);
    },
  };
}

// ── Ambiguity: noise that organizes itself into a lattice (hover to force order) ─
function order(): Viz {
  const COLS = 9;
  const ROWS = 4;
  const N = COLS * ROWS;
  const rand = mulberry32(21);
  const drift = Array.from({ length: N }, () => ({
    x: 0.08 + rand() * 0.84,
    y: 0.12 + rand() * 0.76,
    w1: 0.4 + rand() * 0.8,
    w2: 0.4 + rand() * 0.8,
    p1: rand() * 6.28,
    p2: rand() * 6.28,
  }));
  const links: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c + 1 < COLS) links.push([i, i + 1]);
      if (r + 1 < ROWS) {
        links.push([i, i + COLS]);
        const diag = r % 2 ? c + 1 : c - 1;
        if (diag >= 0 && diag < COLS) links.push([i, (r + 1) * COLS + diag]);
      }
    }
  }
  const CYCLE = 7000;
  let clock = 0;
  let k = 0;

  const cycleOrder = (t: number) => {
    const p = t % CYCLE;
    if (p < 2600) return 0;
    if (p < 3800) return easeInOutCubic((p - 2600) / 1200);
    if (p < 5600) return 1;
    if (p < 6800) return 1 - easeInOutCubic((p - 5600) / 1200);
    return 0;
  };

  return {
    settle() {
      k = 1;
      clock = 3000;
    },
    draw(ctx, w, h, _now, dt, hover) {
      clock += dt;
      const target = hover ? 1 : cycleOrder(clock);
      k += (target - k) * Math.min(1, dt / 220);

      const sx = (w - 40) / (COLS - 0.5);
      const sy = Math.min(sx * 0.866, (h - 30) / (ROWS - 1));
      const ox = (w - sx * (COLS - 0.5)) / 2;
      const oy = (h - sy * (ROWS - 1)) / 2;
      const t = clock * 0.001;
      const pts = drift.map((d, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const gx = ox + (c + (r % 2) * 0.5) * sx;
        const gy = oy + r * sy;
        const nx = (d.x + Math.sin(t * d.w1 + d.p1) * 0.07) * w;
        const ny = (d.y + Math.cos(t * d.w2 + d.p2) * 0.09) * h;
        return { x: lerp(nx, gx, k), y: lerp(ny, gy, k) };
      });

      const linkAlpha = clamp((k - 0.55) / 0.45) * 0.35;
      if (linkAlpha > 0) {
        ctx.strokeStyle = `rgba(${RGB.emerald},${linkAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b] of links) {
          ctx.moveTo(pts[a].x, pts[a].y);
          ctx.lineTo(pts[b].x, pts[b].y);
        }
        ctx.stroke();
      }
      for (const p of pts) {
        ctx.fillStyle = `rgba(${RGB.purpleLight},${0.8 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${RGB.emeraldLight},${0.9 * k})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}

// ── Built to last: a honeycomb assembled cell by cell, then kept running ─────
function lattice(): Viz {
  const R = 13;
  let cells: { x: number; y: number; d: number; born: number }[] = [];
  let builtFor = '';
  let clock = 0;
  let wave = 0;

  const build = (w: number, h: number) => {
    const dx = Math.sqrt(3) * R;
    const dy = 1.5 * R;
    cells = [];
    for (let r = -1; r * dy < h + dy; r++) {
      for (let c = -1; c * dx < w + dx; c++) {
        const x = c * dx + (r % 2 ? dx / 2 : 0);
        const y = r * dy;
        cells.push({ x, y, d: Math.hypot(x - w / 2, y - h / 2), born: 0 });
      }
    }
    // Assemble from the centre outwards
    [...cells].sort((a, b) => a.d - b.d).forEach((cell, i) => (cell.born = 200 + i * 9));
    builtFor = `${w}x${h}`;
  };

  return {
    settle() {
      clock = 1e6;
    },
    draw(ctx, w, h, _now, dt, hover) {
      if (builtFor !== `${w}x${h}`) build(w, h);
      clock += dt;
      wave += dt * (hover ? 0.006 : 0.0022);

      for (const cell of cells) {
        const grow = easeOutCubic(clamp((clock - cell.born) / 350));
        if (!grow) continue;
        const pulse = Math.pow(Math.max(0, Math.sin(cell.d * 0.028 - wave)), 10);
        const r = (R - 1.5) * grow;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = ((-90 + 60 * i) * Math.PI) / 180;
          ctx[i ? 'lineTo' : 'moveTo'](cell.x + r * Math.cos(a), cell.y + r * Math.sin(a));
        }
        ctx.closePath();
        if (pulse > 0.02) {
          ctx.fillStyle = `rgba(${RGB.emerald},${pulse * 0.3})`;
          ctx.fill();
        }
        ctx.strokeStyle = pulse > 0.02 ? `rgba(${RGB.emeraldLight},${0.15 + pulse * 0.6})` : `rgba(${RGB.white},0.1)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },
  };
}

registerViz('signal', signal);
registerViz('order', order);
registerViz('lattice', lattice);

// ── Theory ↔ implementation: the same idea written as maths and as code ─────
onPage(() => {
  const host = document.querySelector<HTMLElement>('[data-morph]');
  const text = host?.querySelector<HTMLElement>('[data-morph-text]');
  if (!host || !text) return;
  const variants: string[] = JSON.parse(host.dataset.morph ?? '[]');
  const tags = [...host.querySelectorAll<HTMLElement>('[data-morph-tag]')];
  if (variants.length < 2 || prefersReducedMotion()) return;

  let index = 0;
  let timer = 0;
  let cancel = () => {};
  const show = (i: number) => {
    index = i;
    cancel();
    cancel = scramble([{ el: text, text: variants[i] }], { duration: 700, jitter: 250 });
    tags.forEach((t, j) => t.classList.toggle('is-active', j === i));
  };
  const io = new IntersectionObserver(([entry]) => {
    clearInterval(timer);
    if (entry.isIntersecting) timer = window.setInterval(() => show((index + 1) % variants.length), 3200);
  });
  io.observe(host);

  return () => {
    io.disconnect();
    clearInterval(timer);
    cancel();
  };
});
