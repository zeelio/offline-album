// Finds holidays in a pile of photos: reads when and where each was taken,
// works out where home is, and groups the time spent away into trips.

// ---------- EXIF ----------
const EXIF_MARK = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"

function findTiff(bytes) {
  outer: for (let i = 0; i < bytes.length - 12; i++) {
    for (let k = 0; k < 6; k++) if (bytes[i + k] !== EXIF_MARK[k]) continue outer;
    const b = bytes[i + 6];
    if (b === 0x49 || b === 0x4d) return i + 6;
  }
  return -1;
}

function parseExif(buf) {
  const t = findTiff(new Uint8Array(buf));
  if (t < 0) return null;
  const dv = new DataView(buf);
  const le = dv.getUint16(t) === 0x4949;
  const u16 = o => dv.getUint16(t + o, le);
  const u32 = o => dv.getUint32(t + o, le);
  const ifd = (off, want) => {
    const out = {};
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      const tag = u16(e);
      if (want.includes(tag)) out[tag] = { count: u32(e + 4), at: e + 8 };
    }
    return out;
  };
  const ascii = en => {
    const off = en.count > 4 ? u32(en.at) : en.at;
    let s = '';
    for (let i = 0; i < en.count - 1; i++) s += String.fromCharCode(dv.getUint8(t + off + i));
    return s;
  };
  const rationals = en => {
    const off = u32(en.at);
    return Array.from({ length: en.count }, (_, i) => u32(off + i * 8) / (u32(off + i * 8 + 4) || 1));
  };

  const root = ifd(u32(4), [0x0132, 0x8769, 0x8825]);
  let stamp = '';
  if (root[0x8769]) {
    const ex = ifd(u32(root[0x8769].at), [0x9003, 0x9004]);
    const en = ex[0x9003] || ex[0x9004];
    if (en) stamp = ascii(en);
  }
  if (!stamp && root[0x0132]) stamp = ascii(root[0x0132]);

  let lat, lon;
  if (root[0x8825]) {
    const g = ifd(u32(root[0x8825].at), [1, 2, 3, 4]);
    if (g[2] && g[4]) {
      const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
      lat = dms(rationals(g[2]));
      lon = dms(rationals(g[4]));
      if (g[1] && ascii(g[1]) === 'S') lat = -lat;
      if (g[3] && ascii(g[3]) === 'W') lon = -lon;
      if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) lat = lon = undefined;
    }
  }
  const m = stamp.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
  const time = m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : undefined;
  return { time, lat, lon };
}

// JPEGs keep EXIF at the front; HEIC can keep it anywhere, so fall back to the whole file.
export async function readPhoto(file) {
  let info = null;
  try {
    info = parseExif(await file.slice(0, 256 * 1024).arrayBuffer());
    if ((!info || info.time == null) && file.size > 256 * 1024) info = parseExif(await file.arrayBuffer());
  } catch { info = null; }
  return {
    file,
    time: info?.time ?? file.lastModified,
    lat: info?.lat,
    lon: info?.lon,
    dated: info?.time != null,
  };
}

// ---------- grouping ----------
const DAY = 864e5;
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const dayKey = t => new Date(t).toDateString();

// Home is wherever photos were taken on the most different days.
function findHome(geo) {
  const cells = new Map();
  for (const p of geo) {
    const key = `${Math.round(p.lat * 2)},${Math.round(p.lon * 2)}`;
    if (!cells.has(key)) cells.set(key, { days: new Set(), pts: [] });
    const c = cells.get(key);
    c.days.add(dayKey(p.time));
    c.pts.push(p);
  }
  const best = [...cells.values()].sort((a, b) => b.days.size - a.days.size)[0];
  return {
    lat: best.pts.reduce((s, p) => s + p.lat, 0) / best.pts.length,
    lon: best.pts.reduce((s, p) => s + p.lon, 0) / best.pts.length,
  };
}

export function detectTrips(records, { awayKm = 60 } = {}) {
  const all = [...records].sort((a, b) => a.time - b.time);
  const geo = all.filter(p => p.lat != null);
  let groups;
  let byLocation = geo.length >= Math.max(5, all.length * .2);

  if (byLocation) {
    const home = findHome(geo);
    groups = [];
    let cur = null;
    for (const p of geo) {
      const away = km(home, p) > awayKm;
      if (away && cur && p.time - cur.end <= 1.5 * DAY) {
        cur.geo.push(p); cur.end = p.time;
      } else if (away) {
        cur = { start: p.time, end: p.time, geo: [p] };
        groups.push(cur);
      } else {
        cur = null; // back home
      }
    }
    // photos without a location belong to whichever trip they were taken during
    for (const g of groups) {
      const mine = new Set(g.geo);
      g.photos = all.filter(p => p.time >= g.start - 6 * 3600e3 && p.time <= g.end + 6 * 3600e3 &&
        (p.lat == null || mine.has(p)));
    }
  } else {
    // no locations to go on: long bursts of photos are the best guess
    groups = [];
    let cur = null;
    for (const p of all) {
      if (cur && p.time - cur.end <= 2 * DAY) { cur.photos.push(p); cur.end = p.time; }
      else { cur = { start: p.time, end: p.time, photos: [p], geo: [] }; groups.push(cur); }
    }
  }

  return groups
    .map(g => ({ ...g, days: new Set(g.photos.map(p => dayKey(p.time))).size }))
    .filter(g => g.photos.length >= 5 && (g.days >= 2 || g.photos.length >= 15))
    .map(g => ({
      start: g.start,
      end: g.end,
      days: g.days,
      photos: g.photos,
      center: g.geo.length ? {
        lat: g.geo.reduce((s, p) => s + p.lat, 0) / g.geo.length,
        lon: g.geo.reduce((s, p) => s + p.lon, 0) / g.geo.length,
      } : null,
      byLocation,
    }))
    .sort((a, b) => b.start - a.start);
}

// Up to n photos spread evenly through the trip.
export function pickPhotos(photos, n = 12) {
  if (photos.length <= n) return photos;
  return Array.from({ length: n }, (_, i) => photos[Math.round(i * (photos.length - 1) / (n - 1))]);
}

// ---------- place names (OpenStreetMap) ----------
let lastCall = 0;
export async function placeName({ lat, lon }) {
  // Nominatim asks for at most one request a second
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`);
  if (!res.ok) throw new Error(`place lookup ${res.status}`);
  const a = (await res.json()).address || {};
  return { city: a.city || a.town || a.village || a.municipality || a.county || a.state || '', country: a.country || '' };
}

export function monthYear(t) {
  return new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
}

export function dateRange(start, end) {
  const s = new Date(start), e = new Date(end);
  const day = { day: 'numeric', month: 'short' };
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString('en-GB', { ...day, year: 'numeric' });
  return `${s.toLocaleDateString('en-GB', day)} – ${e.toLocaleDateString('en-GB', { ...day, year: 'numeric' })}`;
}
