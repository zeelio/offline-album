// Drawn artwork: souvenir stickers for the cursor trail and scenes for the sample trip.
export const FLOWER_PATH = 'M50 12C60 2 98-4 96 34C94 44 88 46 88 50C88 54 94 56 96 66C98 104 60 98 50 88C40 98 2 104 4 66C6 56 12 54 12 50C12 46 6 44 4 34C2-4 40 2 50 12Z';
const perf = (w, h, id) => `<mask id="${id}"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${
  Array.from({ length: Math.ceil(w / 6) }, (_, i) => `<circle cx="${3 + i * 6}" cy="0" r="2.2"/><circle cx="${3 + i * 6}" cy="${h}" r="2.2"/>`).join('')}${
  Array.from({ length: Math.ceil(h / 6) }, (_, i) => `<circle cx="0" cy="${2 + i * 6}" r="2.2"/><circle cx="${w}" cy="${2 + i * 6}" r="2.2"/>`).join('')}</g></mask>`;

export const STICKERS = {
  passport: [46, 62, `<svg viewBox="0 0 48 64"><rect x="2" y="2" width="44" height="60" rx="3" fill="#1f2f6b"/><rect x="2" y="2" width="5" height="60" fill="#18245a"/><text x="26" y="15" text-anchor="middle" font-size="5.5" fill="#d8b660" font-family="Georgia" letter-spacing=".6">PASSPORT</text><circle cx="26" cy="36" r="10" fill="none" stroke="#d8b660" stroke-width="1.4"/><path d="M16 36h20M26 26v20M19 29q7 7 14 0M19 43q7-7 14 0" fill="none" stroke="#d8b660" stroke-width="1"/></svg>`],
  compass: [58, 58, `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#9b6a3c"/><circle cx="32" cy="32" r="24" fill="#e8d7b4" stroke="#6e4a28" stroke-width="2"/><path d="M32 10 L36 32 L32 54 L28 32Z" fill="#6e4a28"/><path d="M10 32 L32 28 L54 32 L32 36Z" fill="#a37a4e"/><path d="M32 10 L36 32 L28 32Z" fill="#b8473a"/><circle cx="32" cy="32" r="3" fill="#3c2814"/></svg>`],
  camera: [68, 50, `<svg viewBox="0 0 72 52"><rect x="2" y="10" width="68" height="40" rx="5" fill="#c9c3b8"/><rect x="2" y="22" width="68" height="18" fill="#5a4e44"/><rect x="10" y="4" width="16" height="8" rx="2" fill="#b0a99c"/><circle cx="38" cy="30" r="14" fill="#2a2a2a" stroke="#a9a196" stroke-width="3"/><circle cx="38" cy="30" r="7" fill="#4a6a8a"/><circle cx="35" cy="27" r="2" fill="#cfe0f0"/><rect x="56" y="14" width="9" height="6" rx="1" fill="#eee"/></svg>`],
  globe: [52, 60, `<svg viewBox="0 0 56 64"><circle cx="28" cy="26" r="22" fill="#d9c9a3"/><path d="M14 16q6-4 10 2t8 2 6 8-4 10-10 2-8-8 2-10" fill="#9b8a63"/><circle cx="28" cy="26" r="22" fill="none" stroke="#7a5a36" stroke-width="2"/><path d="M8 40 Q28 58 48 40" stroke="#7a5a36" stroke-width="3" fill="none"/><rect x="25" y="50" width="6" height="8" fill="#7a5a36"/><rect x="16" y="58" width="24" height="5" rx="2" fill="#5a3e22"/></svg>`],
  leaf: [62, 62, `<svg viewBox="0 0 64 64"><path d="M8 58 Q30 40 56 6" stroke="#4a5e2a" stroke-width="2.4" fill="none"/><g fill="#6f8f3c"><path d="M20 48q-14-4-14-18 12 2 14 18z"/><path d="M28 40q-2-16 10-22 4 14-10 22z"/><path d="M36 30q12 2 20 12-14 4-20-12z"/><path d="M42 20q-4-12 4-18 6 10-4 18z"/></g><path d="M24 46q10-8 22-4-10 10-22 4z" fill="#8fb04f"/></svg>`],
  plane: [74, 42, `<svg viewBox="0 0 72 40"><path d="M4 20 Q36 14 66 18 Q72 20 66 22 Q36 26 4 20Z" fill="#e9ecf0" stroke="#9aa3ad"/><path d="M32 18 L20 4 h6 L44 18Z" fill="#cdd3da"/><path d="M32 22 L20 36 h6 L44 22Z" fill="#cdd3da"/><path d="M8 19 L2 10 h5 L14 19Z" fill="#cdd3da"/><g fill="#6c7a8a"><circle cx="50" cy="19" r="1.2"/><circle cx="54" cy="19" r="1.2"/><circle cx="58" cy="19" r="1.2"/></g></svg>`],
  van: [70, 46, `<svg viewBox="0 0 72 48"><rect x="4" y="8" width="62" height="30" rx="10" fill="#e9e1cf"/><path d="M4 26 h62 v4 q0 8-8 8 H12 q-8 0-8-8z" fill="#6c8a7a"/><rect x="12" y="13" width="12" height="9" rx="2" fill="#9fb4c4"/><rect x="28" y="13" width="12" height="9" rx="2" fill="#9fb4c4"/><rect x="44" y="13" width="14" height="9" rx="2" fill="#9fb4c4"/><circle cx="18" cy="38" r="6" fill="#2a2a2a"/><circle cx="54" cy="38" r="6" fill="#2a2a2a"/><circle cx="18" cy="38" r="2.5" fill="#aaa"/><circle cx="54" cy="38" r="2.5" fill="#aaa"/></svg>`],
  stamp: [46, 56, `<svg viewBox="0 0 54 64"><defs>${perf(54, 64, 'trailperf')}</defs><g mask="url(#trailperf)"><rect width="54" height="64" fill="#f3ead6"/><rect x="6" y="6" width="42" height="40" fill="#bcd0de"/><path d="M6 36 L18 22 L28 32 L38 18 L48 30 V46 H6Z" fill="#6c7f99"/><circle cx="38" cy="14" r="4" fill="#f0b05c"/><text x="27" y="57" text-anchor="middle" font-size="7" fill="#7a3a2a" font-family="Georgia">POSTA</text></g></svg>`],
  ticket: [72, 36, `<svg viewBox="0 0 72 36"><path d="M2 2 H70 V13 a5 5 0 0 0 0 10 V34 H2 V23 a5 5 0 0 0 0-10Z" fill="#e8c46a"/><path d="M50 4 V32" stroke="#a5822e" stroke-dasharray="2 2"/><text x="26" y="16" text-anchor="middle" font-size="7" font-family="Georgia" fill="#5a3e16" letter-spacing=".8">TRENO</text><text x="26" y="27" text-anchor="middle" font-size="5" font-family="Inter" fill="#5a3e16">ROMA → COMO</text></svg>`],
  shell: [54, 48, `<svg viewBox="0 0 60 54"><path d="M30 50 L6 22 Q30 -6 54 22Z" fill="#f2d6c2"/><g stroke="#c9967a" stroke-width="1.6" fill="none"><path d="M30 50 L14 14"/><path d="M30 50 L22 8"/><path d="M30 50 L30 6"/><path d="M30 50 L38 8"/><path d="M30 50 L46 14"/></g><rect x="24" y="46" width="12" height="6" rx="2" fill="#e2bba3"/></svg>`],
  lemon: [56, 46, `<svg viewBox="0 0 60 50"><ellipse cx="30" cy="28" rx="22" ry="16" fill="#f1cf3c"/><ellipse cx="24" cy="23" rx="7" ry="3" fill="#f8e58a"/><path d="M52 28 h5" stroke="#d9b02a" stroke-width="3"/><path d="M34 12 q10-12 22-8-6 12-22 8z" fill="#5f8a36"/></svg>`],
  espresso: [56, 44, `<svg viewBox="0 0 60 48"><ellipse cx="28" cy="42" rx="24" ry="5" fill="#e9e4dc"/><path d="M10 14 h36 l-4 24 q-14 6-28 0z" fill="#f6f2ec" stroke="#cfc6ba"/><ellipse cx="28" cy="14" rx="18" ry="4" fill="#5a3a22"/><path d="M45 18 q10 0 8 8-2 6-10 5" stroke="#cfc6ba" stroke-width="3" fill="none"/><path d="M22 2 q4 4 0 8M30 0 q4 4 0 8" stroke="#bfb7ad" stroke-width="1.5" fill="none"/></svg>`],
  map: [64, 52, `<svg viewBox="0 0 66 54"><path d="M2 6 L22 2 L44 8 L64 4 V48 L44 52 L22 46 L2 50Z" fill="#efe3c6"/><path d="M22 2 V46 M44 8 V52" stroke="#d2c19c"/><path d="M8 40 q10-14 20-10 t16-16 t14-4" stroke="#b8473a" stroke-width="1.6" stroke-dasharray="3 2" fill="none"/><circle cx="58" cy="10" r="2.6" fill="#b8473a"/></svg>`],
  sailboat: [56, 56, `<svg viewBox="0 0 60 60"><path d="M30 6 V44" stroke="#6b5a48" stroke-width="2"/><path d="M32 8 L52 42 H32Z" fill="#f4efe6" stroke="#cfc6ba"/><path d="M28 14 L12 42 H28Z" fill="#e6d3b8"/><path d="M6 46 H54 L46 56 H14Z" fill="#7a4a2a"/><path d="M30 6 l8 3-8 3" fill="#b8473a"/></svg>`],
};

// Scenes used as photos in the sample trip.
const SCENES = {
  lake: [450, 500, `<svg viewBox="0 0 225 250" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="lsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c2da"/><stop offset="1" stop-color="#e3dde6"/></linearGradient>
    <linearGradient id="lwat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a9bb6"/><stop offset="1" stop-color="#5f6f8a"/></linearGradient></defs>
    <rect width="225" height="250" fill="url(#lsky)"/>
    <path d="M0 95 L40 70 L75 88 L115 60 L160 92 L225 80 V160 H0Z" fill="#a3adc4"/>
    <path d="M0 125 L30 105 L70 118 L110 98 L150 122 L190 110 L225 120 V165 H0Z" fill="#7d8aa6"/>
    <rect y="150" width="225" height="100" fill="url(#lwat)"/>
    <g transform="translate(18 150)"><rect x="0" y="6" width="58" height="10" rx="2" fill="#f2f2f2"/><rect x="0" y="12" width="58" height="3" fill="#b03c3c"/><rect x="10" y="0" width="34" height="7" fill="#e8e8e8"/></g>
    <rect x="168" y="20" width="4" height="230" fill="#8c7d6a"/>
    <path d="M160 40 Q170 15 180 40 L184 150 Q170 160 156 150Z" fill="#d6cbbb"/>
    <circle cx="15" cy="175" r="22" fill="#4d6b3a"/><circle cx="5" cy="200" r="20" fill="#3d5a2e"/>
    <ellipse cx="40" cy="250" rx="30" ry="40" fill="#5a6a8a"/><circle cx="40" cy="196" r="11" fill="#e9e3dc"/>
    <ellipse cx="95" cy="252" rx="34" ry="42" fill="#2e3440"/><circle cx="95" cy="196" r="12" fill="#6b5d52"/>
    <ellipse cx="150" cy="250" rx="30" ry="38" fill="#e6e6ea"/><circle cx="150" cy="200" r="11" fill="#b49a85"/>
    <ellipse cx="200" cy="252" rx="28" ry="36" fill="#c7c9d1"/><circle cx="198" cy="205" r="10" fill="#efe6dc"/>
  </svg>`],
  villa: [350, 440, `<svg viewBox="0 0 175 220" preserveAspectRatio="xMidYMid slice">
    <rect width="175" height="220" fill="#e4e9ef"/>
    <path d="M40 120 L95 40 L140 85 L175 70 V140 H40Z" fill="#a1abba"/>
    <path d="M60 130 L110 75 L175 110 V150 H60Z" fill="#8792a6"/>
    <rect y="135" width="175" height="20" fill="#b9c4d3"/>
    <path d="M0 0 H55 C40 40 60 80 45 140 L0 160Z" fill="#3e5a34"/>
    <circle cx="20" cy="40" r="30" fill="#4a6b3c"/><circle cx="40" cy="90" r="26" fill="#2f4a28"/>
    <rect x="98" y="120" width="8" height="22" fill="#7a3a2a"/>
    <path d="M30 150 L95 132 L175 148 V220 H30Z" fill="#a6553c"/>
    <g stroke="#8a4130" stroke-width="1.4"><path d="M40 162 L175 160"/><path d="M38 176 L175 174"/><path d="M36 190 L175 188"/><path d="M34 204 L175 202"/></g>
    <path d="M0 160 L30 150 L40 220 H0Z" fill="#c9c2b6"/>
  </svg>`],
  coast: [480, 360, `<svg viewBox="0 0 240 180" preserveAspectRatio="xMidYMid slice">
    <rect width="240" height="180" fill="#f2d9bf"/>
    <circle cx="170" cy="70" r="26" fill="#f6b46a"/>
    <rect y="95" width="240" height="85" fill="#6f8fae"/>
    <path d="M0 95 h240" stroke="#f6c58c" stroke-width="2"/>
    <path d="M0 60 L30 40 L60 70 L90 95 H0Z" fill="#8a6a52"/>
    <g fill="#e9dccb"><rect x="8" y="58" width="14" height="14"/><rect x="26" y="66" width="12" height="12"/><rect x="42" y="74" width="16" height="12"/></g>
    <g fill="#c87a5a"><path d="M6 58 l9-6 9 6z"/><path d="M24 66 l8-5 8 5z"/></g>
    <path d="M150 120 l12 -14 v14z" fill="#fff"/><path d="M146 121 h20 l-3 4 h-14z" fill="#5a3e2a"/>
  </svg>`],
};

export function sceneBlob(name) {
  const [w, h, svg] = SCENES[name];
  const src = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `);
  return { blob: new Blob([src], { type: 'image/svg+xml' }), w, h };
}
