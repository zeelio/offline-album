// Renders the current trip page into a PNG postcard.
import { FLOWER_PATH } from './art.js';
import { stampById, stampSVG } from './stamps.js';

const loadImg = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

function shapePath(ctx, shape, w, h) {
  ctx.beginPath();
  if (shape === 'circle') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (shape === 'flower') {
    const p = new Path2D();
    p.addPath(new Path2D(FLOWER_PATH), new DOMMatrix().translate(-w / 2, -h / 2).scale(w / 100, h / 100));
    return p;
  } else ctx.roundRect(-w / 2, -h / 2, w, h, shape === 'rounded' ? 22 : 14);
  return null;
}

function background(ctx, W, H, dark) {
  if (dark) {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, c] of [[.15, .1, .5, 'rgba(232,180,186,.35)'], [.9, .85, .55, 'rgba(138,154,106,.35)']]) {
      const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(20,20,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let x = 8; x < W; x += 18) for (let y = 8; y < H; y += 18) ctx.fillRect(x, y, 1.4, 1.4);
    return;
  }
  const lin = ctx.createLinearGradient(0, 0, W, 0);
  lin.addColorStop(0, '#f3f1ec'); lin.addColorStop(.45, '#f1f0ed'); lin.addColorStop(.75, '#dfe6ee'); lin.addColorStop(1, '#c3d3e3');
  ctx.fillStyle = lin; ctx.fillRect(0, 0, W, H);
  const sky = ctx.createRadialGradient(W, 0, 0, W, 0, W * .7);
  sky.addColorStop(0, 'rgba(159,184,210,.9)'); sky.addColorStop(1, 'rgba(220,228,236,0)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const [x, y, r] of [[.62, .7, .22], [.75, .62, .18], [.85, .75, .2], [.55, .85, .2], [.7, .9, .25]]) {
    const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
    g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

export async function exportPostcard({ trip, SW, SH, dark, photoUrl, itemSize, boardRects, itemScale = 1 }) {
  await document.fonts.load('20px "Cedarville Cursive"');
  await document.fonts.load('300 30px Inter');
  const k = 1.4;
  const W = SW * k, H = SH * k;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  background(ctx, W, H, dark);
  ctx.scale(k, k);

  for (const it of [...trip.items].sort((a, b) => a.z - b.z)) {
    const [w, h] = itemSize(it);
    ctx.save();
    ctx.translate(it.x * SW, it.y * SH);
    ctx.rotate(it.r * Math.PI / 180);
    ctx.scale(itemScale, itemScale);
    if (it.type === 'photo') {
      const img = await loadImg(await photoUrl(it.photoId)).catch(() => null);
      ctx.shadowColor = 'rgba(20,20,30,.28)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
      const flower = shapePath(ctx, it.shape, w, h);
      ctx.fillStyle = '#333';
      flower ? ctx.fill(flower) : ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      flower ? ctx.clip(flower) : ctx.clip();
      if (img) {
        const s = Math.max(w / img.width, h / img.height);
        ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
      }
      ctx.restore();
      if (it.shape === 'stamp') {
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 6.5, -h / 2 + 6.5, w - 13, h - 13, 11);
        ctx.setLineDash([.1, 6.5]); ctx.lineCap = 'round'; ctx.lineWidth = 3.4; ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      if (it.caption) {
        ctx.font = '400 13px Inter';
        const tw = ctx.measureText(it.caption).width + 26;
        ctx.beginPath(); ctx.roundRect(-tw / 2, h / 2 - 14, tw, 28, 14);
        ctx.fillStyle = dark ? 'rgba(50,50,50,.8)' : 'rgba(255,255,255,.82)'; ctx.fill();
        ctx.fillStyle = dark ? '#f2f2f2' : '#1d1d1f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.caption, 0, h / 2);
      }
    } else if (it.type === 'note') {
      ctx.font = '20px "Cedarville Cursive"';
      ctx.fillStyle = dark ? '#e6dff0' : '#3a3d6a';
      ctx.textBaseline = 'top';
      it.text.split('\n').forEach((line, i) => ctx.fillText(line, -w / 2 + 4, -h / 2 + 4 + i * 30));
    } else if (it.type === 'stamp') {
      const svg = stampSVG(stampById(it.stampId));
      const img = await loadImg(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
      ctx.shadowColor = 'rgba(20,20,30,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  // the flipboard
  for (const r of boardRects.rows) {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 9);
    ctx.shadowColor = 'rgba(20,25,35,.3)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#171717'; ctx.fill();
  }
  ctx.shadowColor = 'transparent';
  ctx.font = '300 31px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of boardRects.cells) {
    ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 4);
    ctx.fillStyle = '#282828'; ctx.fill();
    ctx.fillStyle = '#ececec'; ctx.fillText(c.ch, c.x + c.w / 2, c.y + c.h / 2 + 1);
    ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(c.x, c.y + c.h / 2 - .5, c.w, 1);
  }

  // footer
  ctx.font = '400 11px "DM Mono", monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = dark ? 'rgba(255,255,255,.45)' : 'rgba(29,29,31,.45)';
  ctx.fillText(`OFFLINE ALBUM · ${trip.title.join(' ').trim()} · ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()}`, 24, SH - 22);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
