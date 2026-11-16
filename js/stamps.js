// Stamps you earn by filling a trip.
const ICONS = {
  camera: 'M4 8h4l2-3h4l2 3h4v11H4z M12 10a4 4 0 1 0 0.01 0',
  film: 'M5 5h14v14H5z M5 9h14 M5 15h14 M8 5v4 M12 5v4 M16 5v4 M8 15v4 M12 15v4 M16 15v4',
  pen: 'M4 20l4-1 11-11-3-3L5 16z M14 7l3 3',
  book: 'M3 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H3z M21 5h-7a2 2 0 0 0-2 2 M21 5v12h-7a2 2 0 0 0-2 2',
  flag: 'M6 21V4 M6 4h12l-3 4 3 4H6',
  envelope: 'M3 6h18v12H3z M3 6l9 7 9-7',
  moon: 'M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z',
  globe: 'M12 3a9 9 0 1 0 0.01 0 M3 12h18 M12 3c3.5 3 3.5 15 0 18 M12 3c-3.5 3-3.5 15 0 18',
};

export const STAMPS = [
  { id: 'first-frame', label: 'FIRST FRAME', hint: 'Add your first photo', color: '#c8484e', icon: 'camera', test: s => s.photos >= 1 },
  { id: 'named-it', label: 'NAMED IT', hint: 'Give the trip a title', color: '#e07a45', icon: 'flag', test: s => s.named },
  { id: 'first-note', label: 'FIRST NOTE', hint: 'Write a note', color: '#5f8a36', icon: 'pen', test: s => s.notes >= 1 },
  { id: 'storyteller', label: 'STORYTELLER', hint: 'Write 5 notes', color: '#7a5a9a', icon: 'book', test: s => s.notes >= 5 },
  { id: 'full-roll', label: 'FULL ROLL', hint: 'Add 12 photos', color: '#2f5d8a', icon: 'film', test: s => s.photos >= 12 },
  { id: 'sent-home', label: 'SENT HOME', hint: 'Share a postcard', color: '#1f2f6b', icon: 'envelope', test: s => s.sent },
  { id: 'night-owl', label: 'NIGHT OWL', hint: 'Add something after midnight', color: '#333a55', icon: 'moon', test: s => s.nightOwl },
  { id: 'collector', label: 'COLLECTOR', hint: 'Start 3 trips', color: '#a5822e', icon: 'globe', test: s => s.trips >= 3 },
];
export const stampById = id => STAMPS.find(s => s.id === id);

let maskId = 0;
export function stampSVG(stamp, { locked = false } = {}) {
  const w = 84, h = 100, id = 'sp' + maskId++;
  const color = locked ? '#b9b6ae' : stamp.color;
  const holes = [];
  for (let x = 3; x < w; x += 6) holes.push(`<circle cx="${x}" cy="0" r="2.4"/><circle cx="${x}" cy="${h}" r="2.4"/>`);
  for (let y = 3; y < h; y += 6) holes.push(`<circle cx="0" cy="${y}" r="2.4"/><circle cx="${w}" cy="${y}" r="2.4"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><mask id="${id}"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${holes.join('')}</g></mask></defs>
    <g mask="url(#${id})">
      <rect width="${w}" height="${h}" fill="#fbf7ee"/>
      <rect x="7" y="7" width="${w - 14}" height="${h - 14}" fill="${color}"/>
      <rect x="11" y="11" width="${w - 22}" height="56" fill="#f7efdf"/>
      <g transform="translate(${w / 2 - 15} 24) scale(1.25)" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[stamp.icon]}"/></g>
      <text x="${w / 2}" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="8.5" letter-spacing="1" fill="#fbf7ee">${locked ? '? ? ?' : stamp.label}</text>
      <text x="${w - 13}" y="21" text-anchor="end" font-family="Georgia, serif" font-size="7" fill="${color}">${new Date().getFullYear()}</text>
    </g></svg>`;
}

// Returns stamp ids the trip has just earned.
export function newlyEarned(trip, tripCount) {
  const state = {
    photos: trip.items.filter(i => i.type === 'photo').length,
    notes: trip.items.filter(i => i.type === 'note' && i.text).length,
    named: trip.title.join('|') !== 'NEW|TRIP',
    sent: !!trip.sent,
    nightOwl: !!trip.nightOwl,
    trips: tripCount,
  };
  return STAMPS.filter(s => !trip.earned.includes(s.id) && s.test(state)).map(s => s.id);
}
