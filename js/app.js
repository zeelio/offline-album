import { db, uid } from './db.js';
import { createBoard, clean } from './flipboard.js';
import { createTrail } from './trail.js';
import { STAMPS, stampById, stampSVG, newlyEarned } from './stamps.js';
import { sceneBlob } from './art.js';
import { exportPostcard } from './postcard.js';
import { makeStory, toJpeg, STYLES } from './story.js';
import { openImport } from './import-flow.js';
import { monthYear } from './importer.js';
import { boardFrames, countdownLabel, daysUntil, estimateBoarding, lookupFlight } from './journey.js';

const BUILD = 9;
const LENGTHS = [8, 10];
const ITEM_SCALE_PORTRAIT = .72;
const HALOS = ['#f3e2a9', '#e2d3f3', '#cfe0f4', '#f3d0d4', '#d6e4c4'];
const SHAPES = ['stamp', 'flower', 'rounded', 'circle'];
const SHAPE_NAMES = { stamp: 'Stamp edge', flower: 'Flower', rounded: 'Rounded', circle: 'Circle' };

const app = document.getElementById('app');
const filePick = document.getElementById('filePick');
const toastEl = document.getElementById('toast');

const local = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.random() * (b - a);
const pad2 = n => String(n).padStart(2, '0');

const I = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}><path d="${d}"/></svg>`;
const ICON = {
  back: I('M15 5l-7 7 7 7'),
  plus: I('M12 5v14M5 12h14'),
  theme: I('M12 3a9 9 0 1 0 0.01 0M12 3v18', ''),
  stamp: I('M5 4h14v16H5zM8 8h8v6H8zM8 17h5'),
  share: I('M12 15V3M7 8l5-5 5 5M5 13v7h14v-7'),
  photo: I('M4 6h16v13H4zM4 15l5-5 4 4 3-3 4 4M15.5 9.5a.5.5 0 1 0 .01 0'),
  note: I('M4 20l4-1 11-11-3-3L5 16zM14 7l3 3'),
  shape: I('M12 5c2-3 7-2 7 2 3 1 3 6 0 7 0 4-5 5-7 2-2 3-7 2-7-2-3-1-3-6 0-7 0-4 5-5 7-2z'),
  tag: I('M3 12V4h8l10 10-8 8zM7.5 7.5a.5.5 0 1 0 .01 0'),
  trash: I('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'),
  edit: I('M4 20l4-1 11-11-3-3L5 16z'),
  story: I('M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 7h6M9 17h6M9 10h6v4H9z'),
  plane: I('M3 14l7-2 4-8h2l-1 7 5-1 2-2h1l-1 4 1 4h-1l-2-2-5-1 1 7h-2l-4-8-7-2z'),
};

// ---------- board timing ----------
// The board re-checks every few seconds: multi-frame boards (flight day) rotate,
// and a countdown flips over by itself when the day changes.
let boardTick;
function driveBoard(board, framesFn, first = true) {
  clearInterval(boardTick);
  let i = 0, last = '';
  const step = initial => {
    const frames = framesFn();
    if (!initial && frames.length > 1) i++;
    const lines = frames[i % frames.length];
    if (lines.join('|') !== last) { board.show(lines, initial ? 1.3 : 1); last = lines.join('|'); }
  };
  document.fonts.ready.then(() => step(first));
  boardTick = setInterval(() => step(false), 6000);
  return { reset: () => { last = ''; i = 0; step(false); } };
}

// ---------- theme ----------
let theme = local.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#141414' : '#f4f2ee';
}
function toggleTheme() { theme = theme === 'dark' ? 'light' : 'dark'; local.set('theme', theme); applyTheme(); }
applyTheme();

// ---------- photos ----------
const urls = new Map();
async function photoUrl(id) {
  if (!urls.has(id)) {
    const p = await db.get('photos', id);
    urls.set(id, p ? URL.createObjectURL(p.blob) : '');
  }
  return urls.get(id);
}

async function processImage(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
  return { blob, w: c.width, h: c.height };
}

// ---------- toast ----------
let toastTimer;
function toast(html) {
  toastEl.innerHTML = `<span class="dot"></span>${html}`;
  toastEl.hidden = false;
  toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2800);
}

// ---------- shared view state ----------
let view = null;   // the open trip page, or null on home
let drag = null;
let stageScale = 1;
createTrail(document.getElementById('trail'), {
  scale: () => stageScale,
  enabled: () => !drag && !document.querySelector('dialog[open]'),
  photos: () => view?.thumbs ?? [],
});

// ---------- routing ----------
addEventListener('hashchange', route);
async function route() {
  const m = location.hash.match(/^#\/trip\/([^?]+)/);
  if (m) {
    const trip = await db.get('trips', decodeURIComponent(m[1]));
    if (trip) return renderTrip(trip);
    history.replaceState(null, '', '#/');
  }
  renderHome();
}

// ---------- home ----------
const tripName = t => t.title.map(clean).join(' ').replace(/\s+/g, ' ').trim() || 'Untitled';
const photoCount = t => t.items.filter(it => it.type === 'photo').length;
const coverId = t => t.items.find(it => it.type === 'photo')?.photoId;
const shortDate = d => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

async function renderHome() {
  view = null;
  stageScale = Math.min(1, innerWidth / 900);
  document.body.dataset.view = 'home';
  const trips = (await db.all('trips')).sort((a, b) => b.updated - a.updated);
  const upcoming = trips
    .filter(t => t.journey?.date && daysUntil(t.journey.date) >= 0 && t.journey.countdown !== false)
    .sort((a, b) => a.journey.date.localeCompare(b.journey.date));
  const next = upcoming[0];
  const hero = next || trips[0];
  const feature = trips.find(t => t !== hero);
  const cover = async t => (t && coverId(t)) ? photoUrl(coverId(t)) : '';
  const [heroSrc, featureSrc] = await Promise.all([cover(hero), cover(feature)]);
  const totalPhotos = trips.reduce((n, t) => n + photoCount(t), 0);
  const stamps = new Set(trips.flatMap(t => t.earned)).size;
  const number = t => pad2(trips.length - trips.indexOf(t));

  const heroLabel = next ? 'Next trip' : hero ? 'Latest trip' : 'Welcome';
  const heroFoot = next
    ? `<span class="mono">${esc(countdownLabel(next))} · ${esc(shortDate(next.journey.date))}${next.journey.flight?.number ? ` · ${esc(next.journey.flight.number)}` : ''}</span>`
    : hero ? `<span class="mono">${photoCount(hero)} photos · ${hero.earned.length} stamps</span>`
      : `<span class="mono">Scrapbooks for the trips you were offline for</span>`;
  const heroAction = hero
    ? `<a class="chip-btn" href="#/trip/${encodeURIComponent(hero.id)}">Open</a>`
    : `<button class="chip-btn" data-act="plan">Plan a trip</button>`;

  app.innerHTML = `
    <main class="home2">
      <header class="bar-top">
        <span class="wordmark">Offline Album<i></i></span>
        <span class="bar-icons">
          <button class="icon-btn" data-act="theme" aria-label="Switch light or dark">${ICON.theme}</button>
          <button class="icon-btn" data-act="new" aria-label="New trip">${ICON.plus}</button>
        </span>
      </header>

      <section class="hero ${heroSrc ? 'has-photo' : ''}">
        ${heroSrc ? `<img class="hero-bg" src="${heroSrc}" alt="">` : '<div class="hero-sky"></div>'}
        <div class="hero-top mono"><span>${heroLabel}</span><span>${hero ? `T-${number(hero)}` : 'A-01'}</span></div>
        <div class="board hero-board" id="homeBoard" role="img" aria-label="${esc(hero ? tripName(hero) : 'Offline album')}"></div>
        <div class="hero-foot">${heroFoot}${heroAction}</div>
      </section>

      <section class="tiles">
        <button class="tile" data-act="trips"><span>Trips</span><b>${trips.length}</b></button>
        <button class="tile" data-act="allstamps"><span>Stamps</span><b>${stamps}/${STAMPS.length}</b></button>
        <button class="tile" data-act="import"><span>From library</span><b>${ICON.plus}</b></button>
      </section>

      ${next ? '' : `<button class="plan-row" data-act="plan"><span>Plan your next trip</span><span class="mono">Countdown · flight board</span></button>`}

      ${feature ? `
      <a class="feature" href="#/trip/${encodeURIComponent(feature.id)}">
        ${featureSrc ? `<img src="${featureSrc}" alt="">` : '<div class="hero-sky"></div>'}
        <span class="mono f-top">T-${number(feature)}</span>
        <strong>${esc(tripName(feature))}</strong>
        <span class="chip-btn">Open</span>
      </a>` : ''}

      ${trips.length ? `
      <section class="index">
        <div class="index-head mono"><span>Index</span><span>${pad2(trips.length)}</span></div>
        ${trips.map(t => `
          <a class="index-row" href="#/trip/${encodeURIComponent(t.id)}">
            <span class="mono">${number(t)}</span>
            <strong>${esc(tripName(t))}</strong>
            <span class="mono">${esc(countdownLabel(t) || `${photoCount(t)} photos`)}</span>
          </a>`).join('')}
      </section>` : ''}

      <footer class="mono foot2"><span>Offline Album</span><span>Build ${BUILD}</span></footer>
    </main>
    <nav class="tabs">
      <button data-act="trips">Trips</button>
      <button class="on" aria-current="page">Home</button>
      <button data-act="import">Find</button>
    </nav>`;

  const board = createBoard(document.getElementById('homeBoard'), LENGTHS);
  board.set(['', '']);
  driveBoard(board, () => next ? boardFrames(next) : hero ? [hero.title] : [['OFFLINE', 'ALBUM']]);
  document.getElementById('homeBoard').addEventListener('pointerenter', () => board.shuffle());
}

// Bottom sheet listing every trip as a little stack of its photos.
async function openTrips(editing = false) {
  const trips = (await db.all('trips')).sort((a, b) => b.updated - a.updated);
  const cards = await Promise.all(trips.map(async t => {
    const ids = t.items.filter(it => it.type === 'photo').slice(0, 3).map(it => it.photoId);
    const srcs = await Promise.all(ids.map(photoUrl));
    const layers = srcs.length ? srcs.map((s, i) => `<img class="l${i}" src="${s}" alt="">`).reverse().join('') : '<span class="l0 empty"></span>';
    return `
      <div class="stack-card">
        <a href="#/trip/${encodeURIComponent(t.id)}" class="stack">${layers}</a>
        <span>${esc(tripName(t))}</span>
        ${editing ? `<button class="x" data-del="${esc(t.id)}" aria-label="Delete ${esc(tripName(t))}">${ICON.trash}</button>` : ''}
      </div>`;
  }));
  const dlg = sheetDialog(`
    <div class="sheet-head"><h2>Trips <b>${trips.length}</b></h2><button class="text-btn" data-edit>${editing ? 'Done' : 'Edit'}</button></div>
    <div class="stack-grid">${cards.join('')}<div class="stack-card"><button class="add-round" data-act="new" aria-label="New trip">${ICON.plus}</button></div></div>`);
  dlg.querySelector('[data-edit]').onclick = () => { dlg.close(); openTrips(!editing); };
  dlg.addEventListener('click', e => { if (e.target.closest('a, [data-act="new"]')) dlg.close(); });
}

// Every stamp across all trips.
async function openAllStamps() {
  const trips = await db.all('trips');
  const earned = new Set(trips.flatMap(t => t.earned));
  sheetDialog(`
    <div class="sheet-head"><h2>Stamps <b>${earned.size}/${STAMPS.length}</b></h2></div>
    <div class="stamp-grid">${STAMPS.map(s => `<div class="stamp-cell">${stampSVG(s, { locked: !earned.has(s.id) })}<span>${earned.has(s.id) ? s.label : s.hint}</span></div>`).join('')}</div>`);
}

function sheetDialog(html) {
  document.querySelector('dialog.bottom')?.remove();
  const dlg = document.createElement('dialog');
  dlg.className = 'bottom';
  dlg.innerHTML = `<div class="grabber"></div>${html}`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  // tap the dimmed area above the sheet to close it
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  return dlg;
}

async function newTrip(plan = false) {
  document.querySelector('dialog.bottom')?.close();
  const trips = await db.all('trips');
  const trip = {
    id: uid(), title: ['NEW', 'TRIP'], created: Date.now(), updated: Date.now(),
    items: [], earned: [], halo: HALOS[trips.length % HALOS.length],
  };
  await db.put('trips', trip);
  location.hash = `#/trip/${trip.id}?${plan ? 'plan' : 'new'}`;
}

async function deleteTrip(id) {
  const trip = await db.get('trips', id);
  if (!trip || !confirm(`Delete "${trip.title.join(' ').trim()}" and its photos? This can't be undone.`)) return;
  await Promise.all(trip.items.filter(it => it.type === 'photo').map(it => db.del('photos', it.photoId)));
  await db.del('trips', id);
  document.querySelector('dialog.bottom')?.close();
  renderHome();
}

// ---------- trip page ----------
function stageSize() {
  return innerWidth < innerHeight * .9 ? [640, 1080] : [1440, 900];
}

async function renderTrip(trip) {
  document.body.dataset.view = 'trip';
  const isNew = location.hash.endsWith('?new');
  const isPlan = location.hash.endsWith('?plan');
  if (isNew || isPlan) history.replaceState(null, '', `#/trip/${trip.id}`);

  app.innerHTML = `
    <div class="trip">
      <div class="trip-bg">
        <div class="sky"></div>
        ${cloudsSVG()}
        <div class="glow g1"></div><div class="glow g2"></div>
      </div>
      <p class="empty-hint mono" id="emptyHint">Tap + to add photos and notes<br>or drop photos anywhere</p>
      <div id="stage"><div id="items"></div><div class="board" id="board" role="button" tabindex="0" aria-label="Edit trip title"></div></div>
      <header class="trip-top">
        <a class="glass round" href="#/" aria-label="All trips">${ICON.back}</a>
        <div class="trip-head" data-act="title"><strong id="tTitle"></strong><span class="mono" id="tMeta"></span></div>
        <button class="glass round accent" data-act="add" aria-label="Add">${ICON.plus}</button>
      </header>
      <nav class="dock glass">
        <button data-act="journey">${ICON.plane}<span>Journey</span></button>
        <button data-act="stamps">${ICON.stamp}<span>Stamps</span><b id="stampCount">0</b></button>
        <button data-act="story">${ICON.story}<span>Story</span></button>
        <button data-act="share">${ICON.share}<span>Postcard</span></button>
      </nav>
    </div>`;

  const itemsEl = document.getElementById('items');
  const board = createBoard(document.getElementById('board'), LENGTHS);
  board.set(['', '']);
  view = { trip, board, itemsEl, selected: null, thumbs: [], zTop: Math.max(10, ...trip.items.map(i => i.z || 0)), tripCount: (await db.all('trips')).length };

  layout();
  for (const it of trip.items) itemsEl.appendChild(itemEl(it));
  refreshThumbs();
  updateHead();
  view.boardDriver = driveBoard(board, () => boardFrames(view?.trip ?? trip));
  bindTrip();
  watchFlight();
  if (isNew) setTimeout(openTitle, 450);
  if (isPlan) setTimeout(openJourney, 450);
}

function cloudsSVG() {
  return `<svg class="clouds" viewBox="0 0 900 620" aria-hidden="true"><defs>
    <filter id="puff" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="70" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="9"/></filter>
    <radialGradient id="shade" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#f4f6fa"/><stop offset="1" stop-color="#dfe6ef"/></radialGradient></defs>
    <g filter="url(#puff)" fill="url(#shade)"><circle cx="210" cy="180" r="70"/><circle cx="300" cy="130" r="95"/><circle cx="410" cy="170" r="80"/><circle cx="180" cy="290" r="110"/><circle cx="340" cy="270" r="140"/><circle cx="520" cy="250" r="90"/><circle cx="610" cy="320" r="70"/><circle cx="260" cy="430" r="160"/><circle cx="480" cy="430" r="150"/><circle cx="700" cy="440" r="110"/><circle cx="120" cy="470" r="120"/></g></svg>`;
}

function layout() {
  if (!view) return;
  const [SW, SH] = stageSize();
  Object.assign(view, { SW, SH });
  stageScale = Math.min(innerWidth / SW, innerHeight / SH);
  const stage = document.getElementById('stage');
  stage.style.width = SW + 'px';
  stage.style.height = SH + 'px';
  stage.style.transform = `translate(-50%, -50%) scale(${stageScale})`;
  // sizes are stored for the wide page; shrink things on the narrow one so collages still breathe
  view.itemScale = SW < SH ? ITEM_SCALE_PORTRAIT : 1;
  view.itemsEl.style.setProperty('--k', view.itemScale);
  document.getElementById('board').style.top = (SW < SH ? .2 : .46) * SH + 'px';
  view.itemsEl.querySelectorAll('.item').forEach(el => place(el, findItem(el.dataset.id)));
  positionBar();
}
addEventListener('resize', layout);

const findItem = id => view.trip.items.find(i => i.id === id);

function place(el, it) {
  el.style.left = it.x * view.SW + 'px';
  el.style.top = it.y * view.SH + 'px';
  el.style.zIndex = it.z;
  el.style.setProperty('--r', it.r + 'deg');
}

function photoBox(it) {
  const square = it.shape === 'circle' || it.shape === 'flower';
  return [it.w, square ? it.w : Math.round(it.w * Math.min(1.45, Math.max(.7, it.ratio)))];
}

function itemEl(it) {
  const el = document.createElement('div');
  el.className = `item ${it.type}`;
  el.dataset.id = it.id;
  fillItem(el, it);
  place(el, it);
  return el;
}

function fillItem(el, it) {
  if (it.type === 'photo') {
    const [w, h] = photoBox(it);
    el.innerHTML = `<div class="ph shape-${it.shape}" style="width:${w}px;height:${h}px"><img alt=""></div>${it.caption ? `<span class="chip glass">${esc(it.caption)}</span>` : ''}`;
    photoUrl(it.photoId).then(src => { el.querySelector('img').src = src; });
  } else if (it.type === 'note') {
    el.innerHTML = `<div class="note-text" data-ph="Write something…"></div>`;
    el.firstChild.textContent = it.text;
  } else if (it.type === 'stamp') {
    el.innerHTML = stampSVG(stampById(it.stampId));
  }
}

function itemSize(it) {
  if (it.type === 'photo') return photoBox(it);
  const el = view.itemsEl.querySelector(`[data-id="${it.id}"]`);
  return [el.offsetWidth, el.offsetHeight];
}

function nextZ() { return ++view.zTop; }

// the emptiest spot we can find, keeping clear of the board
function spot() {
  return freeSpot(view.trip.items, view.SW, view.SH);
}

function freeSpot(items, SW, SH) {
  const by = SW < SH ? .2 : .46;
  const bw = 230 / SW + .1, bh = 80 / SH + .08;
  let best = [.5, .8], bestGap = -1;
  for (let i = 0; i < 80; i++) {
    const x = rand(.14, .86), y = rand(.16, .84);
    if (Math.abs(x - .5) < bw && Math.abs(y - by) < bh) continue;
    const gap = Math.min(Infinity, ...items.map(it => Math.hypot((it.x - x) * SW, (it.y - y) * SH)));
    if (gap > bestGap) { best = [x, y]; bestGap = gap; }
  }
  return best;
}

let saveTimer;
function save() {
  view.trip.updated = Date.now();
  const trip = view.trip;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => db.put('trips', trip), 150);
  updateHead();
}

function updateHead() {
  const { trip } = view;
  const photos = trip.items.filter(i => i.type === 'photo').length;
  document.getElementById('tTitle').textContent = trip.title.map(clean).join(' ').trim() || 'Untitled';
  document.getElementById('tMeta').textContent = `${pad2(photos)} PHOTOS · ${trip.earned.length}/${STAMPS.length} STAMPS`;
  document.getElementById('stampCount').textContent = trip.earned.length;
  document.getElementById('emptyHint').hidden = trip.items.some(i => i.type !== 'stamp');
}

function refreshThumbs() {
  Promise.all(view.trip.items.filter(i => i.type === 'photo').map(i => photoUrl(i.photoId)))
    .then(list => { if (view) view.thumbs = list.filter(Boolean); });
}

// ---------- selection ----------
let bar = null;
function select(id) {
  view.itemsEl.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
  bar?.remove(); bar = null;
  view.selected = id;
  if (!id) return;
  const it = findItem(id);
  const el = view.itemsEl.querySelector(`[data-id="${id}"]`);
  el.classList.add('selected');
  const buttons = {
    photo: [['shape', ICON.shape, 'Change shape'], ['caption', ICON.tag, 'Caption'], ['delete', ICON.trash, 'Delete']],
    note: [['edit', ICON.edit, 'Edit note'], ['delete', ICON.trash, 'Delete']],
    stamp: [['delete', ICON.trash, 'Remove from page']],
  }[it.type];
  bar = document.createElement('div');
  bar.className = 'item-bar glass';
  bar.innerHTML = buttons.map(([a, icon, label]) =>
    `<button data-item="${a}" aria-label="${label}" title="${label}" class="${a === 'delete' ? 'danger' : ''}">${icon}</button>`).join('');
  document.querySelector('.trip').appendChild(bar);
  positionBar();
}

function positionBar() {
  if (!bar || !view?.selected) return;
  const el = view.itemsEl.querySelector(`[data-id="${view.selected}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  bar.style.left = Math.min(innerWidth - 90, Math.max(90, r.left + r.width / 2)) + 'px';
  const above = r.top - 62;
  bar.style.top = (above > 74 ? above : Math.min(innerHeight - 140, r.bottom + 16)) + 'px';
}

async function itemAction(action) {
  const it = findItem(view.selected);
  const el = view.itemsEl.querySelector(`[data-id="${it.id}"]`);
  if (action === 'delete') {
    view.trip.items = view.trip.items.filter(i => i !== it);
    el.animate([{ scale: 1, opacity: 1 }, { scale: .6, opacity: 0 }], { duration: 200, easing: 'ease-in' }).finished.then(() => el.remove());
    if (it.type === 'photo') { db.del('photos', it.photoId); refreshThumbs(); }
    select(null);
    save();
  } else if (action === 'shape') {
    it.shape = SHAPES[(SHAPES.indexOf(it.shape) + 1) % SHAPES.length];
    fillItem(el, it);
    el.animate([{ scale: .9 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.4)' });
    toast(SHAPE_NAMES[it.shape]);
    save();
    positionBar();
  } else if (action === 'caption') {
    const dlg = document.getElementById('captionDialog');
    dlg.querySelector('input').value = it.caption || '';
    dlg.returnValue = '';
    dlg.showModal();
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return;
      it.caption = dlg.querySelector('input').value.trim();
      fillItem(el, it);
      save();
    }, { once: true });
  } else if (action === 'edit') {
    editNote(el, it);
  }
}

function editNote(el, it) {
  select(null);
  const t = el.querySelector('.note-text');
  try { t.contentEditable = 'plaintext-only'; } catch { t.contentEditable = 'true'; }
  if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true';
  t.focus();
  const range = document.createRange();
  range.selectNodeContents(t);
  range.collapse(false);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
  t.addEventListener('blur', () => {
    t.contentEditable = 'false';
    it.text = t.innerText.replace(/\n{3,}/g, '\n\n').trim();
    if (!it.text) {
      view.trip.items = view.trip.items.filter(i => i !== it);
      el.remove();
    }
    save();
    checkStamps();
  }, { once: true });
}

// ---------- adding things ----------
function addNote() {
  const [x, y] = spot();
  const it = { id: uid(), type: 'note', text: '', x, y, r: rand(-3, 3), z: nextZ() };
  view.trip.items.push(it);
  const el = itemEl(it);
  view.itemsEl.appendChild(el);
  markNightOwl();
  editNote(el, it);
}

async function addPhotos(files) {
  // iOS can leave the type blank for HEIC, so go by name too
  const images = [...files].filter(f => f.type.startsWith('image/') || (!f.type.startsWith('video/') && /\.(heic|heif|jpe?g|png|webp|avif)$/i.test(f.name)));
  if (!images.length) return;
  for (const file of images) {
    let img;
    try { img = await processImage(file); } catch { toast(`Couldn't read ${esc(file.name)}`); continue; }
    const photoId = uid();
    await db.put('photos', { id: photoId, ...img });
    const [x, y] = spot();
    const count = view.trip.items.filter(i => i.type === 'photo').length;
    const it = {
      id: uid(), type: 'photo', photoId, x, y,
      r: rand(-7, 7), z: nextZ(),
      w: Math.round(rand(190, 235)),
      ratio: img.h / img.w,
      shape: count === 0 ? 'stamp' : ['stamp', 'stamp', 'rounded', 'flower', 'circle'][Math.floor(Math.random() * 5)],
    };
    view.trip.items.push(it);
    const el = itemEl(it);
    view.itemsEl.appendChild(el);
    el.animate([
      { scale: 0, rotate: `${it.r - 25}deg`, opacity: 0 },
      { scale: 1.08, rotate: `${it.r + 3}deg`, opacity: 1, offset: .6 },
      { scale: 1, rotate: `${it.r}deg` },
    ], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  }
  markNightOwl();
  refreshThumbs();
  save();
  view.board.shuffle(.5);
  checkStamps();
}

function markNightOwl() {
  if (new Date().getHours() < 5) view.trip.nightOwl = true;
}

// ---------- stamps ----------
async function checkStamps() {
  if (!view) return;
  const ids = newlyEarned(view.trip, view.tripCount);
  for (const [n, id] of ids.entries()) {
    view.trip.earned.push(id);
    setTimeout(() => {
      placeStamp(id, true);
      toast(`Stamp earned · ${stampById(id).label}`);
    }, 500 + n * 1200);
  }
  if (ids.length) save();
}

function placeStamp(id, celebrate) {
  if (!view) return;
  const [x, y] = spot();
  const it = { id: uid(), type: 'stamp', stampId: id, x, y, r: rand(-12, 12), z: nextZ() };
  view.trip.items.push(it);
  const el = itemEl(it);
  view.itemsEl.appendChild(el);
  el.animate([
    { scale: celebrate ? 2.6 : .4, opacity: 0, rotate: `${it.r - 20}deg` },
    { scale: .92, opacity: 1, rotate: `${it.r}deg`, offset: .55 },
    { scale: 1.04, offset: .75 },
    { scale: 1, rotate: `${it.r}deg` },
  ], { duration: celebrate ? 700 : 400, easing: 'cubic-bezier(.3,.7,.3,1)' });
  save();
}

function openStamps() {
  const { trip } = view;
  document.getElementById('stampsTag').textContent = `03 · ${trip.earned.length}/${STAMPS.length} STAMPS`;
  const grid = document.getElementById('stampGrid');
  grid.innerHTML = STAMPS.map(s => {
    const got = trip.earned.includes(s.id);
    return `<button type="button" data-stamp="${s.id}" ${got ? '' : 'disabled'}>${stampSVG(s, { locked: !got })}<span>${got ? s.label : s.hint}</span></button>`;
  }).join('');
  const dlg = document.getElementById('stampsDialog');
  grid.onclick = e => {
    const b = e.target.closest('[data-stamp]:not([disabled])');
    if (!b) return;
    dlg.close();
    placeStamp(b.dataset.stamp, false);
  };
  dlg.showModal();
}

// ---------- title ----------
function openTitle() {
  const dlg = document.getElementById('titleDialog');
  const [a, b] = dlg.querySelectorAll('input');
  const untouched = view.trip.title.join('|') === 'NEW|TRIP';
  a.value = untouched ? '' : view.trip.title[0];
  b.value = untouched ? '' : view.trip.title[1];
  a.placeholder = 'SUMMER'; b.placeholder = 'IN LISBON';
  dlg.returnValue = '';
  dlg.showModal();
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok' || !view) return;
    const next = [clean(a.value).slice(0, 8), clean(b.value).slice(0, 10)];
    if (!next[0].trim() && !next[1].trim()) return;
    view.trip.title = next;
    view.boardDriver.reset();
    save();
    checkStamps();
  }, { once: true });
}

// ---------- journey: countdown + flight ----------
const journeyDlg = document.getElementById('journeyDialog');
const jField = name => journeyDlg.querySelector(`[name="${name}"]`);
const FLIGHT_FIELDS = ['number', 'from', 'to', 'departs', 'boards', 'gate'];

function openJourney() {
  const j = view.trip.journey || {};
  const f = j.flight || {};
  jField('place').value = j.place || '';
  jField('date').value = j.date || '';
  jField('countdown').checked = j.countdown !== false;
  FLIGHT_FIELDS.forEach(k => { jField(k).value = f[k] || ''; });
  jField('apikey').value = local.get('aerodatabox-key') || '';
  journeyDlg.live = null;
  setLookupNote(f.updatedAt ? `Live status ${f.status ? `· ${f.status} ` : ''}· checked ${new Date(f.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '');
  journeyDlg.returnValue = '';
  journeyDlg.showModal();
}

function setLookupNote(text, error = false) {
  const el = document.getElementById('lookupNote');
  el.textContent = text;
  el.classList.toggle('error', error);
}

journeyDlg.addEventListener('close', () => {
  if (journeyDlg.returnValue !== 'ok' || !view) return;
  const prev = view.trip.journey?.flight || {};
  const flight = { ...prev, ...(journeyDlg.live || {}) };
  FLIGHT_FIELDS.forEach(k => { flight[k] = jField(k).value.trim().toUpperCase(); });
  // hand edits replace whatever the last lookup said
  if (flight.departs !== (journeyDlg.live?.departs ?? prev.departs)) flight.revised = '';
  view.trip.journey = {
    place: clean(jField('place').value).trim(),
    date: jField('date').value,
    countdown: jField('countdown').checked,
    flight: flight.number ? flight : null,
  };
  const { place, date } = view.trip.journey;
  if (view.trip.title.join('|') === 'NEW|TRIP' && place && date) view.trip.title = [monthYear(new Date(`${date}T12:00`).getTime()), place];
  save();
  view.boardDriver.reset();
  watchFlight();
  checkStamps();
});

async function lookupFromDialog() {
  const number = jField('number').value.trim();
  const date = jField('date').value;
  const key = jField('apikey').value.trim();
  if (!number || !date) return setLookupNote('Add the flight number and travel date first.', true);
  if (!key) {
    journeyDlg.querySelector('details').open = true;
    return setLookupNote('Live lookups need your AeroDataBox key, below.', true);
  }
  local.set('aerodatabox-key', key);
  setLookupNote('Looking up…');
  try {
    const live = await lookupFlight({ number, date }, key);
    jField('number').value = live.number;
    jField('from').value = live.from;
    jField('to').value = live.to;
    jField('departs').value = live.departs;
    jField('gate').value = live.gate;
    if (!jField('boards').value) jField('boards').value = estimateBoarding(live.revised || live.departs);
    if (!jField('place').value && live.toCity) jField('place').value = clean(live.toCity);
    journeyDlg.live = live;
    setLookupNote(`Found ${live.number} · ${live.from}→${live.to}${live.status ? ` · ${live.status}` : ''}`);
  } catch (e) {
    setLookupNote(e.message || 'Lookup failed', true);
  }
}

// On travel day (and the day before), keep the flight fresh while the trip is open.
let flightTimer;
function watchFlight() {
  clearInterval(flightTimer);
  const j = view?.trip.journey;
  const key = local.get('aerodatabox-key');
  if (!j?.flight?.number || !key) return;
  const days = daysUntil(j.date);
  if (days == null || days < 0 || days > 1) return;
  const refresh = async () => {
    if (!view || view.trip.journey !== j || document.hidden) return;
    const old = j.flight;
    try {
      const live = await lookupFlight({ number: old.number, date: j.date }, key);
      j.flight = { ...old, ...live, boards: old.boards || estimateBoarding(live.revised || live.departs), gate: live.gate || old.gate };
      if (live.gate && live.gate !== old.gate) toast(`Gate change · ${live.gate}`);
      else if (live.status && live.status !== old.status) toast(`${old.number} · ${live.status}`);
      save();
    } catch { /* keep the last known details */ }
  };
  if (Date.now() - (j.flight.updatedAt || 0) > 5 * 6e4) refresh();
  flightTimer = setInterval(refresh, 5 * 6e4);
}

// ---------- story dump ----------
async function openStory() {
  select(null);
  const trip = view.trip;
  if (!trip.items.some(i => i.type === 'photo')) return toast('Add some photos first');
  let style = STYLES[local.get('story-style')] ? local.get('story-style') : 'paper';
  let seed = Date.now() % 1e6;
  let blobs = [], urls = [], busy = false;
  const dlg = sheetDialog(`
    <div class="sheet-head"><h2>Story dump <b id="storyCount">··</b></h2></div>
    <div class="seg">${Object.entries(STYLES).map(([k, s]) => `<button data-style="${k}" class="${k === style ? 'on' : ''}">${s.name}</button>`).join('')}</div>
    <div class="story-strip" id="storyStrip"></div>
    <p class="story-tip">Frames are 1080 × 1920, ready for Instagram Stories. On iPhone, tap Share, then choose Instagram or Save Images.</p>
    <div class="story-actions"><button class="pill ghost" data-story="shuffle">Shuffle</button><button class="pill solid" data-story="share">Share all</button></div>`);
  const strip = dlg.querySelector('#storyStrip');

  const render = async () => {
    busy = true;
    strip.innerHTML = '<div class="story-loading mono">Developing…</div>';
    const frames = await makeStory(trip, { photoUrl, style, seed });
    urls.forEach(URL.revokeObjectURL);
    blobs = await Promise.all(frames.map(toJpeg));
    urls = blobs.map(b => URL.createObjectURL(b));
    strip.innerHTML = urls.map((u, i) => `<img src="${u}" alt="Story frame ${i + 1}">`).join('');
    strip.scrollLeft = 0;
    dlg.querySelector('#storyCount').textContent = blobs.length;
    busy = false;
  };

  dlg.addEventListener('click', async e => {
    if (busy) return;
    const s = e.target.closest('[data-style]');
    if (s) {
      style = s.dataset.style;
      local.set('story-style', style);
      dlg.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', b === s));
      return render();
    }
    const a = e.target.closest('[data-story]')?.dataset.story;
    if (a === 'shuffle') { seed++; render(); }
    if (a === 'share') shareStory(trip, blobs);
  });
  dlg.addEventListener('close', () => urls.forEach(URL.revokeObjectURL));
  render();
}

async function shareStory(trip, blobs) {
  const slug = trip.title.join('-').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'trip';
  const files = blobs.map((b, i) => new File([b], `${slug}-story-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }));
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await new Promise(r => setTimeout(r, 250));
  }
  toast(`${files.length} story frames saved`);
}

// ---------- postcard ----------
async function sharePostcard() {
  select(null);
  toast('Printing your postcard…');
  const stageRect = document.getElementById('stage').getBoundingClientRect();
  const rel = r => ({
    x: (r.left - stageRect.left) / stageScale, y: (r.top - stageRect.top) / stageScale,
    w: r.width / stageScale, h: r.height / stageScale,
  });
  const boardRects = {
    rows: [...document.querySelectorAll('#board .row')].map(r => rel(r.getBoundingClientRect())),
    cells: view.board.cells().map(c => ({ ...rel(c.el.getBoundingClientRect()), ch: c.ch })),
  };
  const blob = await exportPostcard({
    trip: view.trip, SW: view.SW, SH: view.SH, dark: theme === 'dark',
    photoUrl, itemSize, boardRects, itemScale: view.itemScale,
  });
  const name = `${view.trip.title.join('-').replace(/\s+/g, '-').toLowerCase() || 'trip'}-postcard.png`;
  const file = new File([blob], name, { type: 'image/png' });
  let sent = false;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: view.trip.title.join(' ').trim() });
      sent = true;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  if (!sent) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Postcard saved');
  }
  view.trip.sent = true;
  save();
  checkStamps();
}

// ---------- trip events ----------
let addMenu = null;
function toggleAddMenu(force) {
  const open = force ?? !addMenu;
  addMenu?.remove(); addMenu = null;
  if (!open) return;
  addMenu = document.createElement('div');
  addMenu.className = 'add-menu glass';
  addMenu.innerHTML = `
    <button data-act="photo">${ICON.photo}<span>Photos</span><span class="n">01</span></button>
    <button data-act="note">${ICON.note}<span>Note</span><span class="n">02</span></button>`;
  document.querySelector('.trip-top').appendChild(addMenu);
}

function bindTrip() {
  const itemsEl = view.itemsEl;

  itemsEl.addEventListener('pointerdown', e => {
    const el = e.target.closest('.item');
    if (!el || e.button > 0) return;
    if (el.querySelector('.note-text[contenteditable="true"], .note-text[contenteditable="plaintext-only"]')) return;
    e.preventDefault();
    toggleAddMenu(false);
    const it = findItem(el.dataset.id);
    drag = { el, it, x0: e.clientX, y0: e.clientY, ix: it.x, iy: it.y, moved: false };
    el.setPointerCapture(e.pointerId);
  });
  itemsEl.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x0) / stageScale, dy = (e.clientY - drag.y0) / stageScale;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      drag.el.classList.add('dragging');
      drag.it.z = nextZ();
      select(null);
    }
    drag.it.x = Math.min(.99, Math.max(.01, drag.ix + dx / view.SW));
    drag.it.y = Math.min(.99, Math.max(.01, drag.iy + dy / view.SH));
    place(drag.el, drag.it);
  });
  const end = e => {
    if (!drag) return;
    const { el, it, moved } = drag;
    drag = null;
    el.classList.remove('dragging');
    if (e.type === 'pointercancel') return;
    if (moved) { save(); view.board.shuffle(.45); }
    else if (view.selected === it.id && it.type === 'note') editNote(el, it);
    else select(it.id);
  };
  itemsEl.addEventListener('pointerup', end);
  itemsEl.addEventListener('pointercancel', end);

  const boardEl = document.getElementById('board');
  boardEl.addEventListener('pointerenter', () => { if (!drag) view.board.shuffle(); });
  boardEl.addEventListener('click', openTitle);
  boardEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTitle(); } });

  document.querySelector('.trip').addEventListener('pointerdown', e => {
    if (!e.target.closest('.item, .item-bar, .add-menu, [data-act="add"]')) { select(null); toggleAddMenu(false); }
  });

  // drag photos in from the desktop
  const trip = document.querySelector('.trip');
  let hint = null;
  trip.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'drop-hint';
      hint.textContent = 'Drop photos to add them';
      document.body.appendChild(hint);
    }
  });
  const clearHint = () => { hint?.remove(); hint = null; };
  trip.addEventListener('dragleave', e => { if (e.target === trip || !trip.contains(e.relatedTarget)) clearHint(); });
  trip.addEventListener('drop', e => { e.preventDefault(); clearHint(); addPhotos(e.dataTransfer.files); });
}

// ---------- global clicks ----------
document.addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { e.preventDefault(); deleteTrip(del.dataset.del); return; }
  const itemBtn = e.target.closest('[data-item]');
  if (itemBtn) { itemAction(itemBtn.dataset.item); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'theme') toggleTheme();
  else if (act === 'new') newTrip();
  else if (act === 'plan') newTrip(true);
  else if (act === 'trips') openTrips();
  else if (act === 'allstamps') openAllStamps();
  else if (act === 'import') openImport({ processImage, freeSpot, toast, renderHome, halos: HALOS, local, esc });
  else if (act === 'add') toggleAddMenu();
  else if (act === 'photo') { toggleAddMenu(false); filePick.value = ''; filePick.click(); }
  else if (act === 'note') { toggleAddMenu(false); addNote(); }
  else if (act === 'title') openTitle();
  else if (act === 'journey') openJourney();
  else if (act === 'lookup') lookupFromDialog();
  else if (act === 'stamps') openStamps();
  else if (act === 'share') sharePostcard();
  else if (act === 'story') openStory();
});
filePick.addEventListener('change', () => addPhotos(filePick.files));

document.addEventListener('keydown', e => {
  if (!view?.selected || document.activeElement?.isContentEditable || document.querySelector('dialog[open]')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); itemAction('delete'); }
  if (e.key === 'Escape') select(null);
});

// ---------- first run ----------
async function seed() {
  if ((await db.all('trips')).length || local.get('seeded')) return;
  const photo = async (scene, x, y, r, w, shape, caption) => {
    const { blob, w: pw, h: ph } = sceneBlob(scene);
    const photoId = uid();
    await db.put('photos', { id: photoId, blob, w: pw, h: ph });
    return { id: uid(), type: 'photo', photoId, x, y, r, w, ratio: ph / pw, shape, caption, z: 0 };
  };
  const note = (text, x, y, r) => ({ id: uid(), type: 'note', text, x, y, r, z: 0 });
  const stamp = (stampId, x, y, r) => ({ id: uid(), type: 'stamp', stampId, x, y, r, z: 0 });
  // positions are fractions of the page, so lay the sample out for the screen it first opens on
  const portrait = stageSize()[0] < stageSize()[1];
  const at = (land, port) => portrait ? port : land;
  const items = [
    await photo('villa', ...at([.17, .3], [.27, .43]), 5, 180, 'stamp'),
    await photo('lake', ...at([.76, .74], [.68, .7]), -3, 240, 'stamp', 'Lake Como'),
    await photo('coast', ...at([.82, .26], [.76, .41]), 4, 200, 'flower'),
    note('Italy was all hills and\nlight — I walked until\nmy legs gave out', ...at([.38, .2], [.3, .58]), -2),
    note('I spent most of May in Europe.\n\nIt was just a lot of walking and\na notebook that filled up faster\nthan I expected.', ...at([.25, .76], [.33, .845]), 1),
    note('Slow mornings,\nlong walks,\nzero notifications.', ...at([.52, .8], [.24, .705]), -3),
    stamp('first-frame', ...at([.1, .56], [.1, .31]), -8),
    stamp('named-it', ...at([.93, .52], [.85, .56]), 9),
    stamp('first-note', ...at([.62, .1], [.9, .29]), -5),
  ];
  items.forEach((it, i) => { it.z = i + 1; });
  await db.put('trips', {
    id: uid(), title: ['OFFLINE', 'IN EUROPE'], created: Date.now(), updated: Date.now(),
    items, earned: ['first-frame', 'named-it', 'first-note'], halo: HALOS[0],
  });
  local.set('seeded', '1');
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

seed().catch(() => {}).finally(route);
