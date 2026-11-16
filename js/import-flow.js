// "Find my holidays": pick a camera roll or folder, review the trips found, turn them into pages.
import { db, uid } from './db.js';
import { clean } from './flipboard.js';
import { newlyEarned } from './stamps.js';
import { readPhoto, detectTrips, pickPhotos, placeName, monthYear, dateRange } from './importer.js';

const SW = 1440, SH = 900; // trips are laid out for the landscape page
const rand = (a, b) => a + Math.random() * (b - a);
const coarse = matchMedia('(pointer: coarse)').matches;

let dlg, app;

function sheet(html) {
  dlg.innerHTML = `<div class="imp">${html}</div>`;
}

export function openImport(deps) {
  app = deps;
  dlg?.remove();
  dlg = document.createElement('dialog');
  dlg.className = 'sheet wide';
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.onclick = e => {
    const a = e.target.closest('[data-imp]')?.dataset.imp;
    if (a === 'cancel') dlg.close();
    if (a === 'restart') intro();
  };
  intro();
  dlg.showModal();
}

// The pick buttons are real file inputs wrapped in labels: tapping one opens the picker directly,
// which is the pattern iPhone Safari handles reliably.
function intro() {
  const geocode = app.local.get('import-geocode') !== 'off';
  sheet(`
    <span class="mono tag">05 · FIND MY HOLIDAYS</span>
    <h2>Pull trips from your photos</h2>
    <p class="small muted lead">Choose your camera roll or a folder of photos. Offline Album reads when and where each one was taken, works out where home is, and turns the time you spent away into trips. Your photos stay on this device.</p>
    <ul class="imp-tips small muted">
      <li><b>Mac:</b> in the file window, pick <i>Photos</i> in the sidebar to choose from your Photos library, or choose an exported folder.</li>
      <li><b>iPhone:</b> select your photos, then tap <i>Options</i> and turn on <i>Location</i> so places can be found.</li>
    </ul>
    <label class="check"><input type="checkbox" id="impGeo" ${geocode ? 'checked' : ''}><span>Name places with OpenStreetMap <span class="muted">(sends each trip's rough location, never photos)</span></span></label>
    <p class="imp-wait small" id="impWait" hidden><span class="bar indeterminate"><i></i></span>Waiting for your photos. After you tap <b>Add</b>, your phone gets them ready first, which can take a minute for a big selection.</p>
    <div class="actions split">
      <button type="button" class="pill ghost" data-imp="cancel">Cancel</button>
      <span>
        ${coarse ? '' : '<label class="pill ghost file-btn">Choose a folder<input type="file" id="impFolder" multiple webkitdirectory></label>'}
        <label class="pill solid file-btn">Choose photos<input type="file" id="impFiles" accept="image/*" multiple></label>
      </span>
    </div>`);
  dlg.querySelector('#impGeo').addEventListener('change', e => app.local.set('import-geocode', e.target.checked ? 'on' : 'off'));
  for (const input of dlg.querySelectorAll('input[type="file"]')) {
    input.addEventListener('click', () => { dlg.querySelector('#impWait').hidden = false; });
    input.addEventListener('cancel', () => { dlg.querySelector('#impWait').hidden = true; });
    input.addEventListener('change', () => {
      const files = [...input.files];
      if (!files.length) { dlg.querySelector('#impWait').hidden = true; return; }
      scan(files.filter(isPhoto), files.length);
    });
  }
}

// iOS can leave the type blank for HEIC, so go by name too; just skip videos
const isPhoto = f => f.type.startsWith('image/') ||
  (!f.type.startsWith('video/') && /\.(heic|heif|jpe?g|png|webp|avif|dng)$/i.test(f.name));

function failed(message) {
  sheet(`
    <span class="mono tag">05 · FIND MY HOLIDAYS</span>
    <h2>Something went wrong</h2>
    <p class="small muted lead">${app.esc(message)}</p>
    <div class="actions"><button type="button" class="pill ghost" data-imp="cancel">Close</button><button type="button" class="pill solid" data-imp="restart">Try again</button></div>`);
}

function progress(title, done, total, note = '') {
  sheet(`
    <span class="mono tag">05 · FIND MY HOLIDAYS</span>
    <h2>${title}</h2>
    <div class="bar"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
    <p class="mono small muted">${total ? `${done} of ${total}` : ''}${note ? ` · ${note}` : ''}</p>`);
}

async function scan(files, picked) {
  if (!files.length) {
    return failed(picked
      ? `None of the ${picked} files you chose look like photos. Videos are skipped.`
      : 'No photos came through. Try choosing them again.');
  }
  try {
    await findTrips(files);
  } catch (e) {
    failed(`Couldn't read your photos (${e?.message || e}). Try a smaller selection, or try again.`);
  }
}

async function findTrips(files) {
  const records = [];
  for (let i = 0; i < files.length; i++) {
    if (i % 25 === 0) progress('Reading your photos…', i, files.length);
    records.push(await readPhoto(files[i]));
  }
  const trips = detectTrips(records);
  const geocode = app.local.get('import-geocode') !== 'off';
  const existing = new Set((await db.all('trips')).map(t => t.importKey).filter(Boolean));

  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    t.key = `${t.start}-${t.end}`;
    t.already = existing.has(t.key);
    t.place = { city: '', country: '' };
    if (geocode && t.center) {
      progress('Naming the places…', i, trips.length);
      try { t.place = await placeName(t.center); } catch { /* keep it unnamed */ }
    }
  }
  review(trips, records);
}

function placeLabel(t) {
  const city = clean(t.place.city).trim(), country = clean(t.place.country).trim();
  if (city && city.length <= 10) return city;
  if (country && country.length <= 10) return country;
  return city.slice(0, 10) || country.slice(0, 10);
}

function titleFor(t) {
  return [monthYear(t.start), placeLabel(t) || `${t.days} DAYS`];
}

let thumbUrls = [];
function review(trips, records) {
  thumbUrls.forEach(URL.revokeObjectURL);
  thumbUrls = [];
  const located = records.filter(r => r.lat != null).length;
  if (!trips.length) {
    sheet(`
      <span class="mono tag">05 · FIND MY HOLIDAYS</span>
      <h2>No holidays found</h2>
      <p class="small muted lead">Looked through ${records.length} photos${located ? `, ${located} with a location` : ' (none had a location)'}. A trip needs at least 5 photos across 2 days away from home. Try choosing more of your library${located ? '' : ', and on iPhone turn on Location under Options'}.</p>
      <div class="actions"><button type="button" class="pill solid" data-imp="cancel">Close</button></div>`);
    return;
  }
  const rows = trips.map((t, i) => {
    const thumbs = pickPhotos(t.photos, 3).map(p => {
      const u = URL.createObjectURL(p.file);
      thumbUrls.push(u);
      return `<img src="${u}" alt="" onerror="this.style.visibility='hidden'">`;
    }).join('');
    const where = [t.place.city, t.place.country].filter(Boolean).join(', ') || (t.byLocation ? 'Somewhere away from home' : 'A busy stretch of photos');
    return `
      <label class="imp-row">
        <input type="checkbox" data-trip="${i}" ${t.already ? '' : 'checked'}>
        <span class="imp-thumbs">${thumbs}</span>
        <span class="imp-text">
          <strong>${app.esc(where)}</strong>
          <span class="mono small muted">${app.esc(dateRange(t.start, t.end))} · ${t.days} DAYS · ${t.photos.length} PHOTOS</span>
          ${t.already ? '<span class="mono small muted">ALREADY IN YOUR ALBUM</span>' : ''}
        </span>
      </label>`;
  }).join('');
  sheet(`
    <span class="mono tag">05 · ${trips.length} TRIP${trips.length === 1 ? '' : 'S'} FOUND</span>
    <h2>Which ones should we make?</h2>
    <p class="small muted lead">${located ? `${located} of ${records.length} photos had a location.` : `None of these ${records.length} photos had a location, so these are guesses based on dates.`} Each trip gets up to 12 photos, spread across the days.</p>
    <div class="imp-list">${rows}</div>
    <div class="actions"><button type="button" class="pill ghost" data-imp="cancel">Cancel</button><button type="button" class="pill solid" data-imp="make">Make trips</button></div>`);
  const update = () => {
    const n = dlg.querySelectorAll('[data-trip]:checked').length;
    const b = dlg.querySelector('[data-imp="make"]');
    b.textContent = n ? `Make ${n} trip${n === 1 ? '' : 's'}` : 'Make trips';
    b.disabled = !n;
  };
  dlg.onchange = update;
  update();
  dlg.onclick = e => {
    const a = e.target.closest('[data-imp]')?.dataset.imp;
    if (a === 'cancel') dlg.close();
    if (a === 'make') build([...dlg.querySelectorAll('[data-trip]:checked')].map(c => trips[+c.dataset.trip]));
  };
}

async function build(chosen) {
  const total = chosen.reduce((s, t) => s + Math.min(12, t.photos.length), 0);
  let done = 0, failed = 0, made = 0;
  let tripCount = (await db.all('trips')).length;

  // oldest first, so the newest trip ends up first on the home screen
  for (const t of [...chosen].sort((a, b) => a.start - b.start)) {
    const items = [];
    let z = 1;
    for (const p of pickPhotos(t.photos, 12)) {
      progress('Making your trips…', done++, total, failed ? `${failed} couldn't be opened` : '');
      let img;
      try { img = await app.processImage(p.file); } catch { failed++; continue; }
      const photoId = uid();
      await db.put('photos', { id: photoId, ...img });
      const [x, y] = app.freeSpot(items, SW, SH);
      items.push({
        id: uid(), type: 'photo', photoId, x, y, r: rand(-7, 7), z: z++,
        w: Math.round(rand(190, 235)), ratio: img.h / img.w,
        shape: items.length === 0 ? 'stamp' : ['stamp', 'stamp', 'rounded', 'flower', 'circle'][Math.floor(Math.random() * 5)],
      });
    }
    if (!items.length) continue;

    const city = t.place.city || t.place.country;
    const [nx, ny] = app.freeSpot(items, SW, SH);
    items.push({
      id: uid(), type: 'note', x: nx, y: ny, r: rand(-3, 3), z: z++,
      text: `${t.days} day${t.days === 1 ? '' : 's'}${city ? ` in ${city}` : ' away'}\n${dateRange(t.start, t.end)}`,
    });

    const start = new Date(t.start);
    const trip = {
      id: uid(), title: titleFor(t), created: Date.now(), updated: Date.now() + made,
      items, earned: [], halo: app.halos[(tripCount + made) % app.halos.length],
      importKey: t.key,
      journey: {
        place: placeLabel(t),
        date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
        countdown: false, flight: null,
      },
    };
    for (const id of newlyEarned(trip, tripCount + made + 1)) {
      trip.earned.push(id);
      const [sx, sy] = app.freeSpot(items, SW, SH);
      items.push({ id: uid(), type: 'stamp', stampId: id, x: sx, y: sy, r: rand(-12, 12), z: z++ });
    }
    await db.put('trips', trip);
    made++;
  }

  thumbUrls.forEach(URL.revokeObjectURL);
  thumbUrls = [];
  dlg.close();
  app.toast(made
    ? `${made} trip${made === 1 ? '' : 's'} added${failed ? ` · ${failed} photos couldn't be opened in this browser` : ''}`
    : `Couldn't open these photos here${failed ? ' (HEIC photos need Safari)' : ''}`);
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else app.renderHome();
}
