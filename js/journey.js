// Countdown and flight-day frames for the board, plus live flight lookup.
import { clean } from './flipboard.js';

const pad2 = n => String(n).padStart(2, '0');
const fit = (s, n) => clean(s).slice(0, n);

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 864e5);
}

export function departure(journey) {
  const f = journey?.flight;
  const time = f?.revised || f?.departs;
  if (!journey?.date || !time) return null;
  return new Date(`${journey.date}T${time}`);
}

// Boarding usually opens 30–40 minutes before departure.
export function estimateBoarding(departs) {
  if (!/^\d\d:\d\d$/.test(departs || '')) return '';
  const [h, m] = departs.split(':').map(Number);
  const t = (h * 60 + m - 35 + 1440) % 1440;
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}

function statusFrame(f) {
  const s = (f.status || '').toLowerCase();
  if (s.includes('cancel')) return ['FLIGHT', 'CANCELLED'];
  if (s.includes('delay')) return ['DELAYED', f.revised ? `NOW ${f.revised}` : ''];
  if (s.includes('gateclosed') || s.includes('gate closed')) return ['GATE', 'CLOSED'];
  if (s.includes('board')) return ['NOW', 'BOARDING'];
  if (s.includes('depart') || s.includes('enroute') || s.includes('airborne')) return ['DEPARTED', f.to ? `TO ${f.to}` : ''];
  if (s.includes('arriv') || s.includes('landed')) return ['LANDED', f.to || ''];
  return null;
}

// What the board should say for this trip right now: a list of frames it cycles through.
export function boardFrames(trip, now = new Date()) {
  const j = trip.journey;
  const title = [trip.title];
  if (!j?.date || j.countdown === false) return title;
  const days = daysUntil(j.date, now);
  if (days < 0) return title;

  const place = fit(j.place || '', 10);
  const to = place && place.length <= 7 ? `TO ${place}` : place;
  if (days > 1) return [[`${days} DAYS`, to || 'TO GO']];
  if (days === 1) return [['TOMORROW', place || 'WE GO']];

  const f = j.flight;
  if (!f?.number) return [['TODAY', to || 'WE GO']];

  const frames = [[fit(f.number, 8), [f.from, f.to].filter(Boolean).join('-')]];
  const status = statusFrame(f);
  if (status) frames.push(status);
  const dep = departure(j);
  const mins = dep ? Math.round((dep - now) / 6e4) : -1;
  if (mins > 0) frames.push(['LEAVES', mins >= 60 ? `IN ${Math.floor(mins / 60)}H ${pad2(mins % 60)}M` : `IN ${mins} MIN`]);
  if (!status || !/CANCELLED|DEPARTED|LANDED/.test(status[1] + status[0])) {
    frames.push(['GATE', fit(f.gate, 10) || 'TBC']);
    const boards = f.boards || estimateBoarding(f.revised || f.departs);
    if (boards) frames.push(['BOARDING', boards]);
    if (f.departs) frames.push(['DEPARTS', f.revised || f.departs]);
  }
  return frames;
}

// Short line for the trip clusters on the home screen.
export function countdownLabel(trip, now = new Date()) {
  const days = daysUntil(trip.journey?.date, now);
  if (days == null || days < 0) return '';
  if (days === 0) return trip.journey.flight?.number ? `Today · ${trip.journey.flight.number}` : 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days to go`;
}

// Live status from AeroDataBox (via RapidAPI). The key is the user's own, kept on this device.
export async function lookupFlight({ number, date }, key) {
  const n = number.replace(/\s+/g, '').toUpperCase();
  const res = await fetch(
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(n)}/${date}?withAircraftImage=false&withLocation=false`,
    { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' } });
  if (res.status === 204 || res.status === 404) throw new Error(`No flight ${n} found on ${date}`);
  if (res.status === 401 || res.status === 403) throw new Error('The API key was refused');
  if (res.status === 429) throw new Error('Too many lookups, try again in a minute');
  if (!res.ok) throw new Error(`Flight lookup failed (${res.status})`);
  const list = await res.json();
  const f = Array.isArray(list) ? list[0] : list;
  if (!f) throw new Error(`No flight ${n} found on ${date}`);
  // times look like "2026-05-20 11:20+01:00"
  const hhmm = t => (t?.local || '').slice(11, 16);
  const dep = f.departure || {}, arr = f.arrival || {};
  const departs = hhmm(dep.scheduledTime);
  const revised = hhmm(dep.revisedTime);
  return {
    number: (f.number || n).replace(/\s+/g, ''),
    from: dep.airport?.iata || '',
    to: arr.airport?.iata || '',
    toCity: arr.airport?.municipalityName || arr.airport?.shortName || '',
    departs,
    revised: revised && revised !== departs ? revised : '',
    gate: dep.gate || '',
    terminal: dep.terminal || '',
    status: f.status || '',
    updatedAt: Date.now(),
  };
}
