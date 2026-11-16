// Souvenirs that pop up along the cursor path and fade away.
import { STICKERS } from './art.js';

const KINDS = Object.keys(STICKERS);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createTrail(layer, { scale, enabled, photos }) {
  let last = null, travelled = 0, n = Math.floor(Math.random() * 100);

  function spawn(x, y, angle) {
    if (layer.childElementCount > 60) layer.firstElementChild.remove();
    const pics = photos();
    // every third souvenir is one of your own photos, when there are some
    const usePhoto = pics.length && n % 3 === 0;
    const k = Math.max(scale(), .55) * (0.85 + Math.random() * .35);
    let w, h, html;
    if (usePhoto) {
      [w, h] = [50, 58];
      html = `<div class="trail-polaroid"><img src="${pics[n % pics.length]}" alt=""></div>`;
    } else {
      [w, h, html] = STICKERS[KINDS[n % KINDS.length]];
    }
    n++;
    w *= k; h *= k;
    const el = document.createElement('div');
    el.className = 'sticker';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.innerHTML = html;
    layer.appendChild(el);
    const r = (Math.random() - .5) * 40 + angle * .15;
    const base = `translate(${x - w / 2}px, ${y - h / 2}px)`;
    const drift = `translate(${x - w / 2}px, ${y - h / 2 + 14}px)`;
    el.animate([
      { transform: `${base} rotate(${r - 30}deg) scale(0)`, opacity: 0 },
      { transform: `${base} rotate(${r + 6}deg) scale(1.12)`, opacity: 1, offset: .14 },
      { transform: `${base} rotate(${r}deg) scale(1)`, opacity: 1, offset: .26 },
      { transform: `${base} rotate(${r}deg) scale(1)`, opacity: 1, offset: .62 },
      { transform: `${drift} rotate(${r + 12}deg) scale(.3)`, opacity: 0 },
    ], { duration: 1500, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' })
      .finished.then(() => el.remove()).catch(() => {});
  }

  addEventListener('pointermove', e => {
    if (reduceMotion || !enabled()) { last = null; return; }
    if (e.pointerType === 'touch' && e.buttons === 0) return;
    const p = { x: e.clientX, y: e.clientY };
    if (last) {
      const dx = p.x - last.x, dy = p.y - last.y;
      travelled += Math.hypot(dx, dy);
      if (travelled > 34 * Math.max(scale(), .6)) {
        travelled = 0;
        spawn(p.x, p.y, Math.atan2(dy, dx) * 180 / Math.PI);
      }
    }
    last = p;
  });
  addEventListener('pointerup', () => { last = null; });
  document.addEventListener('mouseleave', () => { last = null; });
}
