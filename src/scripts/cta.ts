// Final call to action: a stream of data points spirals into the button (stronger on hover).
import { RGB, fitCanvas, mulberry32, onPage, prefersReducedMotion, visibleLoop } from './utils';

interface Mote {
  x: number;
  y: number;
  trail: { x: number; y: number }[];
  vx: number;
  vy: number;
  color: string;
  life: number;
}

onPage(() => {
  const section = document.querySelector<HTMLElement>('[data-cta]');
  const canvas = section?.querySelector<HTMLCanvasElement>('[data-cta-canvas]');
  const target = section?.querySelector<HTMLElement>('[data-cta-target]');
  if (!section || !canvas || !target || prefersReducedMotion()) return;

  const rand = mulberry32(3);
  let size = fitCanvas(canvas);
  let hover = false;
  const motes: Mote[] = [];

  const spawn = (m?: Mote): Mote => {
    // Enter from a random point on an ellipse around the section's centre, outside the button.
    const a = rand() * Math.PI * 2;
    const r = 0.75 + rand() * 0.35;
    const mote = m ?? ({} as Mote);
    mote.x = size.w / 2 + Math.cos(a) * size.w * 0.5 * r;
    mote.y = size.h / 2 + Math.sin(a) * size.h * 0.55 * r;
    mote.trail = [];
    mote.vx = 0;
    mote.vy = 0;
    mote.color = rand() < 0.6 ? RGB.emeraldLight : RGB.purpleLight;
    mote.life = 0;
    return mote;
  };
  for (let i = 0; i < (size.w < 768 ? 36 : 70); i++) {
    const m = spawn();
    m.life = rand() * 3000;
    motes.push(m);
  }

  const frame = () => {
    const { ctx, w, h } = size;
    const c = canvas.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const tx = t.left + t.width / 2 - c.left;
    const ty = t.top + t.height / 2 - c.top;
    const pull = hover ? 0.16 : 0.07;

    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (const m of motes) {
      const dx = tx - m.x;
      const dy = ty - m.y;
      const d = Math.hypot(dx, dy) || 1;
      // Attraction plus a gentle tangential swirl
      m.vx = m.vx * 0.95 + (dx / d) * pull + (-dy / d) * pull * 0.35;
      m.vy = m.vy * 0.95 + (dy / d) * pull + (dx / d) * pull * 0.35;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 14) m.trail.shift();
      m.x += m.vx;
      m.y += m.vy;
      m.life += 16;

      const fadeIn = Math.min(1, m.life / 600);
      const fadeOut = Math.min(1, Math.max(0, (d - 40) / 120));
      const alpha = fadeIn * fadeOut * (hover ? 0.95 : 0.65);
      ctx.lineWidth = 1;
      for (let k = 1; k < m.trail.length; k++) {
        ctx.strokeStyle = `rgba(${m.color},${alpha * (k / m.trail.length) * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(m.trail[k - 1].x, m.trail[k - 1].y);
        ctx.lineTo(m.trail[k].x, m.trail[k].y);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(${m.color},${alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fill();

      if (d < 40 || m.life > 9000) spawn(m);
    }
  };

  const ro = new ResizeObserver(() => (size = fitCanvas(canvas)));
  ro.observe(canvas);
  const enter = () => (hover = true);
  const leave = () => (hover = false);
  target.addEventListener('pointerenter', enter);
  target.addEventListener('pointerleave', leave);
  const stop = visibleLoop(section, frame);

  return () => {
    stop();
    ro.disconnect();
    target.removeEventListener('pointerenter', enter);
    target.removeEventListener('pointerleave', leave);
  };
});
