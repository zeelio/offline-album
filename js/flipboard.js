// Split-flap board. Each cell flips through random characters before landing.
export const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = s => s[Math.floor(Math.random() * s.length)];

export function pad(text, len) {
  text = clean(text).slice(0, len);
  const left = Math.floor((len - text.length) / 2);
  return (' '.repeat(left) + text).padEnd(len, ' ');
}

export function clean(text) {
  return [...(text || '').toUpperCase()].filter(c => CHARS.includes(c)).join('');
}

export function createBoard(container, lengths) {
  container.innerHTML = '';
  const rows = lengths.map(len => {
    const row = document.createElement('div');
    row.className = 'row';
    container.appendChild(row);
    return Array.from({ length: len }, () => {
      const el = document.createElement('div');
      el.className = 'cell';
      el.innerHTML = '<div class="h t"><span></span></div><div class="h b"><span></span></div><div class="l t"><span></span></div><div class="l b"><span></span></div>';
      const [T, B, LT, LB] = el.querySelectorAll('div');
      row.appendChild(el);
      const cell = { el, T, B, LT, LB, ch: ' ', token: 0 };
      setStatic(cell, ' ');
      return cell;
    });
  });

  let busy = false;
  let current = lengths.map(() => '');

  function set(lines) {
    current = lines;
    rows.forEach((cells, r) => {
      const t = pad(lines[r], cells.length);
      cells.forEach((c, i) => { c.token++; setStatic(c, t[i]); });
    });
  }

  function show(lines, intensity = 1) {
    current = lines;
    if (reduceMotion) { set(lines); return Promise.resolve(); }
    busy = true;
    const jobs = [];
    rows.forEach((cells, r) => {
      const t = pad(lines[r], cells.length);
      cells.forEach((c, i) => {
        const flips = Math.round((4 + Math.random() * 6 + i * 1.3 + r * 3) * intensity);
        jobs.push(spin(c, t[i], flips, 38 + Math.random() * 18));
      });
    });
    return Promise.all(jobs).then(() => { busy = false; });
  }

  return {
    set,
    show,
    shuffle: (intensity = .6) => { if (!busy) show(current, intensity); },
    cells: () => rows.flat().map(c => ({ el: c.el, ch: c.ch })),
  };
}

function setText(part, ch) { part.firstChild.textContent = ch; }
function setStatic(cell, ch) {
  cell.ch = ch;
  setText(cell.T, ch); setText(cell.B, ch); setText(cell.LT, ch); setText(cell.LB, ch);
}

function flip(cell, next, dur) {
  const prev = cell.ch;
  if (prev === next) return Promise.resolve();
  cell.ch = next;
  setText(cell.T, next);
  setText(cell.B, prev);
  setText(cell.LT, prev);
  setText(cell.LB, next);
  const down = cell.LT.animate(
    [{ transform: 'rotateX(0deg)', filter: 'brightness(1)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(.55)' }],
    { duration: dur, easing: 'ease-in', fill: 'forwards' });
  return down.finished.then(() => cell.LB.animate(
    [{ transform: 'rotateX(90deg)', filter: 'brightness(1.4)' }, { transform: 'rotateX(0deg)', filter: 'brightness(1)' }],
    { duration: dur, easing: 'cubic-bezier(.2,1.6,.5,1)', fill: 'forwards' }).finished
  ).then(() => {
    setText(cell.B, next);
    setText(cell.LT, next);
    down.cancel();
    cell.LB.getAnimations().forEach(a => a.cancel());
  }).catch(() => {});
}

async function spin(cell, target, flips, dur) {
  const token = ++cell.token;
  for (let i = 0; i < flips; i++) {
    if (token !== cell.token) return;
    await flip(cell, rand(CHARS), dur);
  }
  if (token !== cell.token) return;
  await flip(cell, target, dur * 1.4);
}

// Static, small version for trip cards on the home screen.
export function miniBoard(lines, lengths) {
  return `<div class="mini-board">${lines.map((l, r) =>
    `<div class="mini-row">${[...pad(l, lengths[r])].map(c => `<span>${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>`
  ).join('')}</div>`;
}
