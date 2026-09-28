// Timelines ([data-process]): a line that fills as the visitor scrolls and lights up each step it reaches.
import { clamp, onPage, prefersReducedMotion } from './utils';

onPage(() => {
  const lists = [...document.querySelectorAll<HTMLElement>('[data-process]')];
  if (!lists.length) return;
  const still = prefersReducedMotion();
  let raf = 0;

  const timelines = lists.map((list) => {
    const steps = [...list.querySelectorAll<HTMLElement>('[data-step]')];
    return {
      list,
      track: list.querySelector<HTMLElement>('[data-process-track]')!,
      steps,
      nums: steps.map((s) => s.querySelector<HTMLElement>('[data-step-num]')!),
    };
  });

  const update = () => {
    raf = 0;
    for (const { list, track, steps, nums } of timelines) {
      // The track runs from the centre of the first number to the centre of the last one.
      const centre = (n: HTMLElement) => n.offsetTop + n.offsetHeight / 2;
      const top = centre(nums[0]);
      const height = centre(nums[nums.length - 1]) - top;
      track.style.top = `${top}px`;
      track.style.height = `${height}px`;

      const rect = list.getBoundingClientRect();
      const progress = still ? 1 : clamp((window.innerHeight * 0.6 - rect.top - top) / height);
      list.style.setProperty('--progress', progress.toFixed(4));
      nums.forEach((n, i) => steps[i].classList.toggle('is-active', progress * height >= centre(n) - top - 1));
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(raf);
  };
});
