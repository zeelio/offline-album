// Story dump: a sequence of 9:16 editorial frames made from a trip's photos.
import { stampById, stampSVG } from './stamps.js';
import { clean } from './flipboard.js';

const W = 1080, H = 1920, M = 72;

export const STYLES = {
  paper: { name: 'Paper', bg: '#f3f2ef', ink: '#1d1d1f', muted: 'rgba(29,29,31,.5)', hand: '#3a3d6a', frame: '#ffffff' },
  night: { name: 'Night', bg: '#121212', ink: '#f2f2f2', muted: 'rgba(242,242,242,.5)', hand: '#e6dff0', frame: '#1f1f1f' },
  film: { name: 'Film', bg: '#e8dfd0', ink: '#2a2420', muted: 'rgba(42,36,32,.5)', hand: '#5a3e2a', frame: '#f6f0e4', grain: true },
};

// ---------- small seeded random, so Shuffle is repeatable per seed ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const loadImg = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// ---------- drawing helpers ----------
function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function photo(ctx, img, x, y, w, h, { r = 18, perforated = false, shadow = true, rotate = 0 } = {}) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotate * Math.PI / 180);
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; }
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.fillStyle = '#444'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.clip(); cover(ctx, img, -w / 2, -h / 2, w, h); ctx.restore();
  if (perforated) {
    ctx.beginPath(); ctx.roundRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, Math.max(4, r - 6));
    ctx.setLineDash([.1, 15]); ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function mono(ctx, text, x, y, { size = 26, color, align = 'left', spacing = 2 } = {}) {
  ctx.font = `400 ${size}px "DM Mono", ui-monospace, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text.toUpperCase(), x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function hand(ctx, text, x, y, { size = 50, color, align = 'left', lineHeight = 1.45, maxWidth = W - M * 2, maxLines = 4 } = {}) {
  ctx.font = `${size}px "Cedarville Cursive", cursive`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  // wrap each paragraph to the width, then keep only as many lines as fit
  const lines = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/\s*\S*$/, '…');
  shown.forEach((line, i) => ctx.fillText(line, x, y + i * size * lineHeight));
}

function chrome(ctx, st, { left, right, foot, light = false }) {
  const c = light ? 'rgba(255,255,255,.9)' : st.muted;
  mono(ctx, left, M, 128, { color: c });
  mono(ctx, right, W - M, 128, { color: c, align: 'right' });
  if (foot) {
    mono(ctx, 'Offline Album', M, H - 92, { color: c });
    mono(ctx, foot, W - M, H - 92, { color: c, align: 'right' });
  }
}

// The split-flap board, drawn flat.
function board(ctx, lines, cx, y, cw) {
  const ch = cw * 1.38, gap = 5, pad = 8;
  let top = y;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const raw of lines) {
    const line = clean(raw).trim();
    if (!line) continue;
    const n = line.length;
    const rw = n * cw + (n - 1) * gap + pad * 2, rh = ch + pad * 2;
    const x0 = cx - rw / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    ctx.beginPath(); ctx.roundRect(x0, top, rw, rh, 14); ctx.fillStyle = '#161616'; ctx.fill();
    ctx.restore();
    ctx.font = `300 ${Math.round(cw * .78)}px Inter, sans-serif`;
    [...line].forEach((c, i) => {
      const x = x0 + pad + i * (cw + gap), yy = top + pad;
      ctx.beginPath(); ctx.roundRect(x, yy, cw, ch, 6);
      const g = ctx.createLinearGradient(0, yy, 0, yy + ch);
      g.addColorStop(0, '#303030'); g.addColorStop(.5, '#272727'); g.addColorStop(.5, '#222'); g.addColorStop(1, '#1d1d1d');
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#ededed'; ctx.fillText(c, x + cw / 2, yy + ch / 2 + 2);
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x, yy + ch / 2 - 1, cw, 2);
    });
    top += rh + 18;
  }
  return top;
}

let grainTile;
function grain(ctx, amount = .07) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------- frame templates ----------
const T = {
  cover(ctx, st, { imgs, trip, page, date }) {
    cover(ctx, imgs[0], 0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(.35, 'rgba(0,0,0,.05)'); g.addColorStop(.7, 'rgba(0,0,0,.1)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    chrome(ctx, st, { left: 'Travel log', right: page, foot: date, light: true });
    const lines = trip.title.map(l => clean(l).trim()).filter(Boolean);
    board(ctx, lines, W / 2, H / 2 - 120, 76);
  },

  single(ctx, st, { imgs, page, date, note }) {
    chrome(ctx, st, { left: 'Frame', right: page, foot: date });
    photo(ctx, imgs[0], M, 220, W - M * 2, 1260, { perforated: true, r: 22 });
    if (note) hand(ctx, note, M + 10, 1540, { color: st.hand, size: 52, maxLines: 3 });
  },

  grid(ctx, st, { imgs, page, date }) {
    chrome(ctx, st, { left: `${String(imgs.length).padStart(2, '0')} frames`, right: page, foot: date });
    const g = 14, top = 220, w = (W - M * 2 - g) / 2, h = (H - top - 260 - g) / 2;
    imgs.slice(0, 4).forEach((img, i) =>
      photo(ctx, img, M + (i % 2) * (w + g), top + Math.floor(i / 2) * (h + g), w, h, { r: 16, shadow: false }));
  },

  stack(ctx, st, { imgs, page, date, stamp, rand }) {
    chrome(ctx, st, { left: 'Contact sheet', right: page, foot: date });
    const w = 640, h = 820;
    const spots = [[W / 2 - w / 2 - 70, 250, -7], [W / 2 - w / 2 + 80, 560, 5], [W / 2 - w / 2 - 20, 900, -2]];
    imgs.slice(0, 3).forEach((img, i) => {
      const [x, y, r] = spots[i];
      photo(ctx, img, x, y, w, h, { r: 14, rotate: r + (rand() - .5) * 4, perforated: i === 2 });
    });
    if (stamp) {
      ctx.save(); ctx.translate(W - M - 120, H - 420); ctx.rotate(.18);
      ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      ctx.drawImage(stamp, -84, -100, 168, 200); ctx.restore();
    }
  },

  duo(ctx, st, { imgs, page, date, note }) {
    chrome(ctx, st, { left: 'Notes', right: page, foot: date });
    photo(ctx, imgs[0], M, 220, W - M * 2, 980, { r: 22, shadow: false });
    ctx.save();
    ctx.translate(W - M - 250, 1330); ctx.rotate(.06);
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = st.frame; ctx.fillRect(-230, -150, 460, 560);
    ctx.shadowColor = 'transparent';
    cover(ctx, imgs[1], -206, -126, 412, 420);
    ctx.restore();
    if (note) hand(ctx, note, M + 6, 1270, { color: st.hand, size: 46, maxWidth: W - M * 2 - 500, maxLines: 6 });
  },

  film(ctx, st, { imgs, page, date }) {
    ctx.fillStyle = '#121110'; ctx.fillRect(0, 0, W, H);
    chrome(ctx, { ...st, muted: 'rgba(255,255,255,.55)' }, { left: 'Roll 01', right: page, foot: date });
    const x = 190, w = W - 380, top = 200, fh = 360, g = 30;
    ctx.fillStyle = '#1c1a18'; ctx.fillRect(x - 70, top - 30, w + 140, 4 * (fh + g) + 30);
    for (let y = top - 10; y < top + 4 * (fh + g); y += 46) {
      for (const sx of [x - 50, x + w + 22]) { ctx.beginPath(); ctx.roundRect(sx, y, 28, 22, 4); ctx.fillStyle = '#0b0a09'; ctx.fill(); }
    }
    imgs.slice(0, 4).forEach((img, i) => {
      const y = top + i * (fh + g);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, fh); ctx.clip(); cover(ctx, img, x, y, w, fh); ctx.restore();
      mono(ctx, `${24 + i}A`, x + w + 4, y + fh + 22, { size: 20, color: '#e2783c', align: 'right' });
    });
  },

  end(ctx, st, { trip, page, date, stamps }) {
    chrome(ctx, st, { left: 'Fin', right: page, foot: date });
    const after = board(ctx, ['SEE YOU', 'NEXT TIME'], W / 2, 600, 70);
    const photos = trip.items.filter(i => i.type === 'photo').length;
    const rows = [['Photos', photos], ['Notes', trip.items.filter(i => i.type === 'note' && i.text).length], ['Stamps', trip.earned.length]];
    let y = after + 110;
    for (const [k, v] of rows) {
      ctx.fillStyle = st.muted; ctx.fillRect(M, y - 52, W - M * 2, 2);
      mono(ctx, k, M, y, { size: 30, color: st.ink });
      mono(ctx, String(v).padStart(2, '0'), W - M, y, { size: 30, color: st.ink, align: 'right' });
      y += 96;
    }
    const n = Math.min(stamps.length, 4), sw = 168, gap = 34;
    stamps.slice(0, n).forEach((img, i) => {
      const x = W / 2 - (n * sw + (n - 1) * gap) / 2 + i * (sw + gap);
      ctx.save(); ctx.translate(x + sw / 2, y + 140); ctx.rotate((i % 2 ? 1 : -1) * .07);
      ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.drawImage(img, -sw / 2, -100, sw, 200); ctx.restore();
    });
  },
};

// ---------- the sequence ----------
export async function makeStory(trip, { photoUrl, style = 'paper', seed = 1 }) {
  const st = STYLES[style];
  const rand = rng(seed);
  await Promise.all([
    document.fonts.load('76px Inter'), document.fonts.load('300 76px Inter'),
    document.fonts.load('26px "DM Mono"'), document.fonts.load('50px "Cedarville Cursive"'),
  ]);

  const photoItems = trip.items.filter(i => i.type === 'photo');
  const imgs = (await Promise.all(photoItems.map(async it => loadImg(await photoUrl(it.photoId)).catch(() => null)))).filter(Boolean);
  if (!imgs.length) return [];
  // keep the first photo as the cover; shuffle the rest
  const rest = imgs.slice(1);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }

  const notes = trip.items.filter(i => i.type === 'note' && i.text).map(i => i.text);
  const svgImg = svg => loadImg(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
  const stamps = await Promise.all(trip.earned.map(id => stampById(id)).filter(Boolean).map(s => svgImg(stampSVG(s))));
  const date = trip.journey?.date
    ? new Date(`${trip.journey.date}T12:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : new Date(trip.created).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  // which template each frame uses, and how many photos it takes
  const plan = [['cover', 1, imgs.slice(0, 1)]];
  const order = ['single', 'grid', 'stack', 'duo', 'film'];
  const needs = { single: 1, grid: 4, stack: 3, duo: 2, film: 4 };
  const start = Math.floor(rand() * order.length);
  let k = 0;
  const pool = rest.length ? rest : imgs;
  let used = 0;
  while (used < pool.length && plan.length < 8) {
    let name = order[(start + k++) % order.length];
    if (pool.length - used < needs[name]) name = pool.length - used >= 2 ? 'duo' : 'single';
    plan.push([name, needs[name], pool.slice(used, used + needs[name])]);
    used += needs[name];
  }
  plan.push(['end', 0, []]);

  let noteIdx = 0;
  const frames = [];
  for (const [i, [name, , frameImgs]] of plan.entries()) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
    const takesNote = name === 'single' || name === 'duo';
    T[name](ctx, st, {
      imgs: frameImgs, trip, date, stamps, rand,
      page: `${String(i + 1).padStart(2, '0')}/${String(plan.length).padStart(2, '0')}`,
      note: takesNote ? notes[noteIdx++] : '',
      stamp: stamps[Math.floor(rand() * stamps.length)],
    });
    if (st.grain) grain(ctx);
    frames.push(canvas);
  }
  return frames;
}

export const toJpeg = canvas => new Promise(r => canvas.toBlob(r, 'image/jpeg', .9));
