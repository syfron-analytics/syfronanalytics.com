// Hero: a constellation of data points that converges into the Syfron mark
// ("from chaos to structure"), reacts to the cursor and dissolves back into a
// network as the visitor scrolls away.
import {
  RGB,
  clamp,
  easeInOutCubic,
  fitCanvas,
  lerp,
  mulberry32,
  onPage,
  prefersReducedMotion,
  visibleLoop,
} from './utils';
import { LOGO_R, LOGO_VIEWBOX, logoOutlinePoints } from './logo-geometry';
import { scramble } from './scramble';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Free-floating home, as a fraction of the canvas size.
  hx: number;
  hy: number;
  phase: number;
  r: number;
  color: string;
  // Target on the mark in logo units (only when onLogo).
  lx: number;
  ly: number;
  onLogo: boolean;
}

const MORPH_DELAY = 300;
const MORPH_DURATION = 2000;
const DRAW_LOGO_AT = 2300;
const MOUSE_RADIUS = 130;

onPage(() => {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const canvas = hero?.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  const logo = hero?.querySelector<SVGSVGElement>('[data-hero-logo]');
  if (!hero || !canvas || !logo) return;

  const root = document.documentElement;
  const intro = root.classList.contains('intro-pending');
  const still = prefersReducedMotion();
  const start = performance.now();
  const mouse = { x: 0, y: 0, active: false };

  let particles: Particle[] = [];
  let spacing = 0;
  let connect = 0;
  let size = fitCanvas(canvas);
  let logoDrawn = !intro;
  let snap = true;

  function build() {
    size = fitCanvas(canvas!);
    const small = size.w < 768;
    const perHex = small ? 18 : 24;
    const ambient = small ? 26 : 56;
    connect = small ? 110 : 160;
    spacing = (6 * LOGO_R) / perHex;

    const targets = logoOutlinePoints(perHex);
    const rand = mulberry32(42);
    particles = [];
    for (let i = 0; i < targets.length + ambient; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = (rand() * 0.8 + 0.2) * (0.5 + rand() * 0.5);
      const target = targets[i];
      particles.push({
        hx: 0.5 + Math.cos(angle) * radius * 0.48,
        hy: 0.5 + Math.sin(angle) * radius * 0.46,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        phase: rand() * Math.PI * 2,
        r: rand() * 2.5 + 1.5,
        color: rand() < 0.5 ? RGB.emerald : RGB.purple,
        lx: target?.x ?? 0,
        ly: target?.y ?? 0,
        onLogo: !!target,
      });
    }
    snap = true;
  }

  // How far the particles have gathered into the mark: 0 = free network, 1 = logo.
  function morphAt(now: number) {
    if (still) return 1;
    const gathered = intro ? easeInOutCubic(clamp((now - start - MORPH_DELAY) / MORPH_DURATION)) : 1;
    const scrolled = clamp(window.scrollY / (size.h * 0.65));
    logo!.style.opacity = String(1 - clamp(scrolled * 1.4));
    return gathered * (1 - easeInOutCubic(scrolled));
  }

  function frame(now: number) {
    const { ctx, w, h } = size;
    const m = morphAt(now);

    if (!logoDrawn && now - start > DRAW_LOGO_AT) {
      logoDrawn = true;
      root.classList.remove('intro-pending');
    }

    // Map logo units to canvas pixels (re-read every frame: fonts or layout may move the mark).
    const c = canvas!.getBoundingClientRect();
    const l = logo!.getBoundingClientRect();
    const s = l.width / LOGO_VIEWBOX.w;
    const ox = l.left - c.left - LOGO_VIEWBOX.x * s;
    const oy = l.top - c.top - LOGO_VIEWBOX.y * s;
    const t = now * 0.001;

    for (const p of particles) {
      let tx = p.hx * w + Math.sin(t * 0.35 + p.phase) * 12;
      let ty = p.hy * h + Math.cos(t * 0.3 + p.phase * 1.3) * 10;
      if (p.onLogo) {
        tx = lerp(tx, ox + p.lx * s, m);
        ty = lerp(ty, oy + p.ly * s, m);
      }
      if (snap) {
        p.x = tx;
        p.y = ty;
        continue;
      }
      let ax = (tx - p.x) * 0.028;
      let ay = (ty - p.y) * 0.028;
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < MOUSE_RADIUS && d > 0.1) {
          const f = Math.pow(1 - d / MOUSE_RADIUS, 2) * 1.6;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
      }
      p.vx = p.vx * 0.8 + ax;
      p.vy = p.vy * 0.8 + ay;
      p.x += p.vx;
      p.y += p.vy;
    }
    snap = false;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 0.8;

    // Links: once gathered, logo points only link to their neighbours along the outline.
    const logoLink = spacing * s * 1.35;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const both = a.onLogo && b.onLogo;
        const reach = both ? lerp(connect, logoLink, m) : a.onLogo || b.onLogo ? lerp(connect, connect * 0.55, m) : connect;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > reach * reach) continue;
        const alpha = (1 - Math.sqrt(d2) / reach) * (both ? lerp(0.2, 0.55, m) : 0.18);
        ctx.strokeStyle = `rgba(${a.color},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // The cursor acts like a probe: it links to every point within reach.
    if (mouse.active) {
      for (const p of particles) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d > MOUSE_RADIUS * 1.3) continue;
        ctx.strokeStyle = `rgba(${RGB.emeraldLight},${(1 - d / (MOUSE_RADIUS * 1.3)) * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    for (const p of particles) {
      const k = p.onLogo ? m : 0;
      const r = lerp(p.r, 2, k);
      if (k > 0.05) {
        ctx.fillStyle = `rgba(${p.color},${0.12 * k})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${p.color},${lerp(0.35, 0.85, k)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = mouse.y >= 0 && mouse.y <= r.height;
  };
  const onPointerLeave = () => (mouse.active = false);

  build();
  const ro = new ResizeObserver(() => {
    build();
    if (still) frame(performance.now());
  });
  ro.observe(hero);

  let stopLoop = () => {};
  if (still) frame(performance.now());
  else {
    stopLoop = visibleLoop(hero, frame);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
  }

  const titleParts = [...hero.querySelectorAll<HTMLElement>('[data-scramble]')].map((el) => ({ el, text: el.textContent ?? '' }));
  const stopScramble = intro ? scramble(titleParts, { delay: 250 }) : () => {};

  return () => {
    stopLoop();
    stopScramble();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    root.classList.remove('intro-pending');
  };
});
