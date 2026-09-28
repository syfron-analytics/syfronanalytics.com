// Portfolio: interactive Topological Data Analysis demo on synthetic data.
// Growing the radius ε builds the Vietoris–Rips complex; the barcode shows which components (H₀)
// and loops (H₁) are alive at that scale and how long they persist.
import { RGB, clamp, easeInOutCubic, fitCanvas, gaussian, mulberry32, onPage, prefersReducedMotion } from './utils';
import { ripsPersistence, type Bar, type Pt } from './tda-math';

const MAX_EPS = 0.4;
// Computing a bit past the visible range lets loops born near MAX_EPS still find their death.
const COMPUTE_EPS = 0.54;
const MIN_PERSISTENCE = 0.012;
const MONO = '500 10px "JetBrains Mono", "Space Mono", monospace';

function syntheticCloud(): Pt[] {
  const rand = mulberry32(8);
  const pts: Pt[] = [];
  const ring = (cx: number, cy: number, r: number, count: number, noise: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.2;
      const rr = r + gaussian(rand) * noise;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  };
  ring(0.32, 0.44, 0.2, 26, 0.016);
  ring(0.75, 0.33, 0.13, 17, 0.01);
  for (let i = 0; i < 10; i++) pts.push({ x: 0.72 + gaussian(rand) * 0.04, y: 0.8 + gaussian(rand) * 0.03 });
  return pts;
}

onPage(() => {
  const root = document.querySelector<HTMLElement>('[data-tda]');
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-tda-canvas]')!;
  const barcode = root.querySelector<HTMLCanvasElement>('[data-tda-barcode]')!;
  const range = root.querySelector<HTMLInputElement>('[data-tda-range]')!;
  const value = root.querySelector<HTMLElement>('[data-tda-value]')!;
  const b0 = root.querySelector<HTMLElement>('[data-tda-b0]')!;
  const b1 = root.querySelector<HTMLElement>('[data-tda-b1]')!;
  const replay = root.querySelector<HTMLButtonElement>('[data-tda-replay]')!;
  const still = prefersReducedMotion();

  const points = syntheticCloud();
  const { edges, triangles, h0, h1: rawH1 } = ripsPersistence(points, COMPUTE_EPS);
  const h1 = rawH1.filter((b) => b.birth < MAX_EPS && b.death - b.birth > MIN_PERSISTENCE).sort((a, b) => a.birth - b.birth);
  const h0Sorted = [...h0].sort((a, b) => b.death - a.death);

  let eps = still ? 0.12 : 0;
  let anim = 0;

  const alive = (bars: Bar[]) => bars.filter((b) => b.birth <= eps && eps < b.death).length;

  function drawComplex() {
    const { ctx, w, h } = fitCanvas(canvas);
    const pad = 14;
    const s = Math.min(w, h) - pad * 2;
    const ox = (w - s) / 2;
    const oy = (h - s) / 2;
    const X = (p: Pt) => ox + p.x * s;
    const Y = (p: Pt) => oy + p.y * s;
    ctx.clearRect(0, 0, w, h);

    // Balls of radius ε/2: two points link exactly when their balls touch
    ctx.fillStyle = `rgba(${RGB.emerald},0.07)`;
    ctx.beginPath();
    for (const p of points) {
      ctx.moveTo(X(p) + (eps / 2) * s, Y(p));
      ctx.arc(X(p), Y(p), (eps / 2) * s, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = `rgba(${RGB.purple},0.18)`;
    ctx.beginPath();
    for (const t of triangles) {
      if (t.d > eps) break;
      ctx.moveTo(X(points[t.a]), Y(points[t.a]));
      ctx.lineTo(X(points[t.b]), Y(points[t.b]));
      ctx.lineTo(X(points[t.c]), Y(points[t.c]));
      ctx.closePath();
    }
    ctx.fill();

    ctx.strokeStyle = `rgba(${RGB.white},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const e of edges) {
      if (e.d > eps) break;
      ctx.moveTo(X(points[e.i]), Y(points[e.i]));
      ctx.lineTo(X(points[e.j]), Y(points[e.j]));
    }
    ctx.stroke();

    ctx.fillStyle = `rgb(${RGB.emeraldLight})`;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(X(p), Y(p), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBarcode() {
    const { ctx, w, h } = fitCanvas(barcode);
    const padL = 30;
    const padR = 12;
    const top = 6;
    const bottom = 22;
    const X = (v: number) => padL + (Math.min(v, MAX_EPS) / MAX_EPS) * (w - padL - padR);
    // H₀ has one bar per point; H₁ only a few, so it gets a band of its own with thicker bars.
    const band = h - top - bottom;
    const h1Top = top + band * 0.68;
    const h0Row = (band * 0.62) / h0Sorted.length;
    const h1Row = Math.min(14, (band * 0.3) / Math.max(1, h1.length));
    ctx.clearRect(0, 0, w, h);

    const drawBars = (bars: Bar[], y0: number, rowH: number, rgb: string) => {
      const thick = Math.max(1, rowH * 0.62);
      bars.forEach((b, k) => {
        const y = y0 + k * rowH;
        const end = X(b.death);
        ctx.fillStyle = `rgba(${rgb},0.16)`;
        ctx.fillRect(X(b.birth), y, Math.max(1, end - X(b.birth)), thick);
        if (eps > b.birth) {
          ctx.fillStyle = `rgba(${rgb},${eps < b.death ? 0.95 : 0.45})`;
          ctx.fillRect(X(b.birth), y, Math.max(1, X(Math.min(eps, b.death)) - X(b.birth)), thick);
        }
      });
    };
    drawBars(h0Sorted, top, h0Row, RGB.emeraldLight);
    drawBars(h1, h1Top, h1Row, RGB.purpleLight);

    ctx.font = MONO;
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgb(${RGB.emeraldLight})`;
    ctx.fillText('H₀', 4, top + 10);
    ctx.fillStyle = `rgb(${RGB.purpleLight})`;
    ctx.fillText('H₁', 4, h1Top + 8);

    // Axis
    ctx.strokeStyle = `rgba(${RGB.white},0.15)`;
    ctx.fillStyle = `rgba(${RGB.white},0.4)`;
    ctx.textAlign = 'center';
    ctx.beginPath();
    ctx.moveTo(padL, h - bottom + 4);
    ctx.lineTo(w - padR, h - bottom + 4);
    for (let v = 0; v <= MAX_EPS + 1e-9; v += 0.1) {
      ctx.moveTo(X(v), h - bottom + 4);
      ctx.lineTo(X(v), h - bottom + 8);
      ctx.fillText(v.toFixed(1), X(v), h - 4);
    }
    ctx.stroke();

    // Current scale
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(X(eps), top);
    ctx.lineTo(X(eps), h - bottom + 4);
    ctx.stroke();
  }

  function render() {
    range.value = String(eps);
    value.textContent = eps.toFixed(2);
    b0.textContent = String(alive(h0));
    b1.textContent = String(alive(h1));
    drawComplex();
    drawBarcode();
  }

  function play() {
    cancelAnimationFrame(anim);
    const start = performance.now();
    const tick = (now: number) => {
      const t = clamp((now - start) / 7000);
      eps = easeInOutCubic(t) * MAX_EPS * 0.95;
      render();
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  range.min = '0';
  range.max = String(MAX_EPS);
  range.step = '0.001';
  const onInput = () => {
    cancelAnimationFrame(anim);
    eps = parseFloat(range.value);
    render();
  };
  range.addEventListener('input', onInput);
  replay.addEventListener('click', play);

  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      if (!still) play();
    },
    { threshold: 0.4 },
  );
  io.observe(canvas);

  const ro = new ResizeObserver(render);
  ro.observe(canvas);
  ro.observe(barcode);

  return () => {
    cancelAnimationFrame(anim);
    io.disconnect();
    ro.disconnect();
    range.removeEventListener('input', onInput);
    replay.removeEventListener('click', play);
  };
});
