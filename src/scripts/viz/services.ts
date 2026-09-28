// Visualizations for the service cards: statistics, AI (RAG) and scientific computing.
import { RGB, clamp, easeInOutCubic, easeOutCubic, gaussian, lerp, mulberry32 } from '../utils';
import { MONO, registerViz, type Viz } from './runner';

// ── Statistics: a regression that refits itself as new samples arrive ─────────
function regression(): Viz {
  const N = 26;
  const rand = mulberry32(11);
  const sample = () => {
    const slope = 0.45 + rand() * 0.3;
    const intercept = 0.16 + rand() * 0.1;
    return Array.from({ length: N }, () => {
      const x = 0.05 + rand() * 0.9;
      return { x, y: clamp(intercept + slope * x + gaussian(rand) * 0.075, 0.04, 0.96) };
    });
  };
  let from = sample();
  let to = from;
  let born: number | null = null;
  let moveStart = 0;
  let nextAt = 0;

  return {
    settle() {
      born = -1e9;
      moveStart = -1e9;
      nextAt = Infinity;
    },
    draw(ctx, w, h, now, _dt, hover) {
      if (born === null) {
        born = now;
        moveStart = now;
        nextAt = now + 4200;
      }
      const age = now - born;
      if (now > nextAt) {
        from = current(now);
        to = sample();
        moveStart = now;
        nextAt = now + (hover ? 1700 : 4200);
      } else if (hover && nextAt - now > 1700) nextAt = now + 300;

      const pts = current(now);
      const pad = { l: 16, r: 10, t: 14, b: 16 };
      const X = (x: number) => pad.l + x * (w - pad.l - pad.r);
      const Y = (y: number) => h - pad.b - y * (h - pad.t - pad.b);

      // Axes
      ctx.strokeStyle = `rgba(${RGB.white},0.1)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, pad.t - 4);
      ctx.lineTo(pad.l, h - pad.b);
      ctx.lineTo(w - pad.r + 4, h - pad.b);
      ctx.stroke();

      // Ordinary least squares on what is currently on screen
      const mx = pts.reduce((s, p) => s + p.x, 0) / N;
      const my = pts.reduce((s, p) => s + p.y, 0) / N;
      let sxx = 0;
      let sxy = 0;
      let syy = 0;
      for (const p of pts) {
        sxx += (p.x - mx) ** 2;
        sxy += (p.x - mx) * (p.y - my);
        syy += (p.y - my) ** 2;
      }
      const grow = easeInOutCubic(clamp((age - 700) / 1100));
      const b = lerp(0, sxy / sxx, grow);
      const a = my - b * mx;
      const fit = (x: number) => a + b * x;
      const sse = pts.reduce((s, p) => s + (p.y - fit(p.x)) ** 2, 0);
      const se = Math.sqrt(sse / (N - 2));
      const r2 = 1 - sse / syy;

      // 95% confidence band of the mean
      ctx.fillStyle = `rgba(${RGB.emerald},${0.1 * grow})`;
      ctx.beginPath();
      const band = (x: number) => 2.06 * se * Math.sqrt(1 / N + (x - mx) ** 2 / sxx);
      for (let i = 0; i <= 24; i++) {
        const x = i / 24;
        ctx[i ? 'lineTo' : 'moveTo'](X(x), Y(fit(x) + band(x)));
      }
      for (let i = 24; i >= 0; i--) {
        const x = i / 24;
        ctx.lineTo(X(x), Y(fit(x) - band(x)));
      }
      ctx.fill();

      // Residuals
      ctx.strokeStyle = `rgba(${RGB.white},${0.12 * grow})`;
      ctx.beginPath();
      for (const p of pts) {
        ctx.moveTo(X(p.x), Y(p.y));
        ctx.lineTo(X(p.x), Y(fit(p.x)));
      }
      ctx.stroke();

      // Fitted line
      ctx.strokeStyle = `rgba(${RGB.emeraldLight},0.95)`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(fit(0)));
      ctx.lineTo(X(1), Y(fit(1)));
      ctx.stroke();

      // Points pop in one after another on first view
      pts.forEach((p, i) => {
        const pop = easeOutCubic(clamp((age - i * 22) / 350));
        if (!pop) return;
        ctx.fillStyle = `rgba(${RGB.purpleLight},${0.9 * pop})`;
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), 2.3 * pop, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.font = MONO;
      ctx.textAlign = 'right';
      ctx.fillStyle = `rgba(${RGB.white},${0.4 * grow})`;
      ctx.fillText(`R² = ${Math.max(0, r2).toFixed(2)}`, w - pad.r, pad.t);
    },
  };

  function current(now: number) {
    const k = easeInOutCubic(clamp((now - moveStart) / 900));
    return to.map((p, i) => ({ x: lerp(from[i].x, p.x, k), y: lerp(from[i].y, p.y, k) }));
  }
}

// ── AI: documents flow through retrieval into a model and become an answer ───
function rag(): Viz {
  interface Pulse {
    leg: 0 | 1 | 2;
    doc: number;
    t: number;
  }
  const DURATION = [750, 480, 420];
  const COLOR = [RGB.emeraldLight, RGB.purpleLight, RGB.white];
  let pulses: Pulse[] = [];
  let spawnIn = 0;
  let docIndex = 0;
  let storeGlow = 0;
  let modelGlow = 0;
  let answer = 0;
  let answerHold = 0;

  return {
    settle() {
      storeGlow = 0.4;
      modelGlow = 0.6;
      answer = 1;
    },
    draw(ctx, w, h, _now, dt, hover) {
      const docs = [0.2, 0.4, 0.6, 0.8].map((y) => ({ x: w * 0.1, y: h * y }));
      const store = { x: w * 0.38, y: h * 0.5 };
      const model = { x: w * 0.64, y: h * 0.5 };
      const out = { x: w * 0.88, y: h * 0.5 };

      const path = (p: Pulse, t: number) => {
        if (p.leg === 0) {
          const a = { x: docs[p.doc].x + 8, y: docs[p.doc].y };
          const b = { x: store.x - 14, y: store.y };
          const dx = (b.x - a.x) * 0.5;
          return cubic(a, { x: a.x + dx, y: a.y }, { x: b.x - dx, y: b.y }, b, t);
        }
        const [a, b] = p.leg === 1 ? [{ x: store.x + 14, y: store.y }, { x: model.x - 18, y: model.y }] : [{ x: model.x + 18, y: model.y }, { x: out.x - 17, y: out.y }];
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      };

      // Update pulses
      spawnIn -= dt;
      if (spawnIn <= 0) {
        pulses.push({ leg: 0, doc: docIndex++ % 4, t: 0 });
        spawnIn = hover ? 260 : 900;
      }
      const next: Pulse[] = [];
      for (const p of pulses) {
        p.t += dt / DURATION[p.leg];
        if (p.t < 1) next.push(p);
        else if (p.leg === 0) {
          storeGlow = 1;
          next.push({ leg: 1, doc: p.doc, t: 0 });
        } else if (p.leg === 1) {
          modelGlow = 1;
          next.push({ leg: 2, doc: p.doc, t: 0 });
        } else answer = Math.min(1, answer + 0.26);
      }
      pulses = next;
      storeGlow = Math.max(0, storeGlow - dt / 500);
      modelGlow = Math.max(0, modelGlow - dt / 700);
      if (answer >= 1) {
        answerHold += dt;
        if (answerHold > 1400) {
          answer = 0;
          answerHold = 0;
        }
      }

      // Edges
      ctx.strokeStyle = `rgba(${RGB.white},0.08)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let d = 0; d < 4; d++) {
        for (let i = 0; i <= 20; i++) {
          const q = path({ leg: 0, doc: d, t: 0 }, i / 20);
          ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y);
        }
      }
      ctx.moveTo(store.x + 14, store.y);
      ctx.lineTo(model.x - 18, model.y);
      ctx.moveTo(model.x + 18, model.y);
      ctx.lineTo(out.x - 17, out.y);
      ctx.stroke();

      // Documents
      ctx.lineWidth = 1;
      for (const d of docs) {
        ctx.strokeStyle = `rgba(${RGB.white},0.28)`;
        roundRect(ctx, d.x - 7, d.y - 9, 14, 18, 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${RGB.white},0.18)`;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          ctx.moveTo(d.x - 4, d.y - 4 + k * 4);
          ctx.lineTo(d.x + (k === 2 ? 1 : 4), d.y - 4 + k * 4);
        }
        ctx.stroke();
      }

      // Vector store: a small cluster of embeddings
      const cluster = [[0, 0], [-7, -5], [7, -5], [-7, 5], [7, 5], [0, -10], [0, 10]];
      for (const [cx, cy] of cluster) {
        ctx.fillStyle = `rgba(${RGB.emerald},${0.45 + storeGlow * 0.5})`;
        ctx.beginPath();
        ctx.arc(store.x + cx, store.y + cy, 2.2 + storeGlow, 0, Math.PI * 2);
        ctx.fill();
      }

      // Model: the brand hexagon
      if (modelGlow > 0) {
        const g = ctx.createRadialGradient(model.x, model.y, 0, model.x, model.y, 34);
        g.addColorStop(0, `rgba(${RGB.purple},${0.35 * modelGlow})`);
        g.addColorStop(1, `rgba(${RGB.purple},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(model.x - 34, model.y - 34, 68, 68);
      }
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        ctx[i ? 'lineTo' : 'moveTo'](model.x + 17 * Math.cos(a), model.y + 17 * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${RGB.purple},${0.12 + modelGlow * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${RGB.purpleLight},${0.7 + modelGlow * 0.3})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Answer: lines of text being written
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${RGB.white},0.28)`;
      roundRect(ctx, out.x - 16, out.y - 19, 32, 38, 3);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${RGB.emeraldLight},0.85)`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      [18, 14, 18, 10].forEach((len, k) => {
        const fill = clamp(answer * 4 - k) * len;
        if (fill <= 0) return;
        ctx.moveTo(out.x - 10, out.y - 10 + k * 6.5);
        ctx.lineTo(out.x - 10 + fill, out.y - 10 + k * 6.5);
      });
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Pulses with a short tail
      for (const p of pulses) {
        for (let k = 4; k >= 0; k--) {
          const q = path(p, clamp(p.t - k * 0.035));
          ctx.fillStyle = `rgba(${COLOR[p.leg]},${(1 - k / 5) * 0.9})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, k ? 1.6 : 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.font = MONO;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${RGB.white},0.35)`;
      ctx.fillText('docs', docs[0].x, h - 3);
      ctx.fillText('RAG', store.x, h - 3);
      ctx.fillText('LLM', model.x, h - 3);
    },
  };
}

// ── Scientific computing: the Lorenz attractor tracing itself ────────────────
function lorenz(): Viz {
  const MAX = 900;
  let x = 0.1;
  let y = 0;
  let z = 0;
  let phase = 0;
  const trail: [number, number, number][] = [];
  const step = () => {
    const dt = 0.007;
    const dx = 10 * (y - x);
    const dy = x * (28 - z) - y;
    const dz = x * y - (8 / 3) * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    trail.push([x, y, z]);
    if (trail.length > MAX) trail.shift();
  };
  for (let i = 0; i < 300; i++) step();
  trail.length = 0;

  return {
    settle() {
      for (let i = 0; i < MAX; i++) step();
    },
    draw(ctx, w, h, _now, dt, hover) {
      const steps = hover ? 7 : 3;
      for (let i = 0; i < steps; i++) step();
      phase += (hover ? 0.0035 : 0.0012) * (dt / 16);
      const angle = Math.sin(phase) * 0.6;

      const scale = (h - 20) / 46;
      const sx = Math.min(scale * 1.7, (w - 24) / 44);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const P = ([px, py, pz]: [number, number, number]) => ({
        x: w / 2 + (px * cos - py * sin) * sx,
        y: h / 2 + 4 - (pz - 25) * scale,
      });

      // Old → new: purple, faint → emerald, bright
      ctx.lineWidth = 1.1;
      const CHUNK = 30;
      const [r1, g1, b1] = RGB.purple.split(',').map(Number);
      const [r2, g2, b2] = RGB.emeraldLight.split(',').map(Number);
      for (let s = 0; s < trail.length - 1; s += CHUNK) {
        const k = (s + CHUNK) / trail.length;
        ctx.strokeStyle = `rgba(${Math.round(lerp(r1, r2, k))},${Math.round(lerp(g1, g2, k))},${Math.round(lerp(b1, b2, k))},${lerp(0.08, 0.9, k * k)})`;
        ctx.beginPath();
        const end = Math.min(trail.length - 1, s + CHUNK);
        for (let i = s; i <= end; i++) {
          const q = P(trail[i]);
          ctx[i === s ? 'moveTo' : 'lineTo'](q.x, q.y);
        }
        ctx.stroke();
      }

      const head = P(trail[trail.length - 1]);
      const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 10);
      g.addColorStop(0, `rgba(${RGB.emeraldLight},0.6)`);
      g.addColorStop(1, `rgba(${RGB.emeraldLight},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(head.x - 10, head.y - 10, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(${RGB.white},0.35)`;
      ctx.fillText('dx/dt = σ(y − x)', 10, 14);
    },
  };
}

function cubic(a: Pt, b: Pt, c: Pt, d: Pt, t: number) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}
type Pt = { x: number; y: number };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

registerViz('regression', regression);
registerViz('rag', rag);
registerViz('lorenz', lorenz);
