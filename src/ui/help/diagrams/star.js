// Schemas du viseur stellaire.
//
// Le point a faire passer n'est pas « il mesure l'attitude » mais « il ne
// mesure QUE l'attitude ». `starGeometry` montre d'ou vient cette
// impossibilite ; `starAccuracy` et `fixCadence` montrent ce qu'elle laisse
// tout de meme gagner, et a partir de quand serrer les reglages ne rapporte
// plus rien ; `starVisibility` montre la tranche d'altitude ou tout cela
// existe.
//
// `fixCadence` sert aussi a terrain.period et a tlm.lastReading ;
// `starAccuracy` sert aussi a tlm.sightingAccuracy. Les fiches concernees
// doivent fournir les memes cles de `labels`.

import {
  svg, axes, text, polyline, arrow, line, dot, arc, circle, rect, legend, ground, esc,
} from '../svg.js';

const ARCSEC = Math.PI / (180 * 3600); // une seconde d'arc, en radians
// Une erreur d'attitude psi fait fuir g.sin(psi) dans l'horizontale. Rapporte
// a g, cela vaut psi lui-meme : une seconde d'arc = 4,85 µg.
const UG_PER_ARCSEC = ARCSEC * 1e6;

/** Seconde d'arc, avec juste ce qu'il faut de decimales. */
function fmtSec(v) {
  if (!Number.isFinite(v)) return '—';
  if (v < 0.01) return v.toExponential(1);
  if (v < 0.1) return v.toFixed(3);
  if (v < 1) return v.toFixed(2);
  if (v < 100) return v.toFixed(1);
  return v.toFixed(0);
}

function fmtUg(v) {
  if (!Number.isFinite(v)) return '—';
  if (v < 0.01) return v.toExponential(1);
  if (v < 0.1) return v.toFixed(2);
  if (v < 10) return v.toFixed(1);
  return v.toFixed(0);
}

/**
 * Pourquoi une visee stellaire ne donne aucune position.
 *
 * A gauche : deux positions distantes de mille kilometres, la meme etoile, deux
 * lignes de visee rigoureusement paralleles — la mesure ne sait pas laquelle
 * des deux positions est la bonne. A droite : ce qu'elle sait, en revanche,
 * c'est l'ecart entre la direction ou l'etoile se trouve et celle ou le
 * calculateur l'attendait. Cet ecart, c'est l'erreur d'attitude, mesuree.
 */
export function starGeometry({ labels: L }) {
  const dx = 0.5, dy = 0.866; // direction commune des lignes de visee

  // Fleche de visee arrivant sur (x, y) selon la direction (ux, uy).
  const sight = (x, y, ux, uy, len, gap, opt) => arrow(
    x - ux * len, y - uy * len, x - ux * gap, y - uy * gap, opt,
  );

  // Etoile : trois traits croises, sans aplat de couleur.
  const glyph = (x, y, r) => [0, 60, 120].map((a) => {
    const th = (a * Math.PI) / 180;
    return line(x - r * Math.cos(th), y - r * Math.sin(th),
      x + r * Math.cos(th), y + r * Math.sin(th), { cls: 'fig-truth' });
  }).join('');

  // Marque de parallelisme posee en travers d'une visee.
  const tick = (x, y, s) => {
    const px = x - dx * s, py = y - dy * s;
    return line(px + dy * 4, py - dx * 4, px - dy * 4, py + dx * 4, { cls: 'fig-truth' });
  };

  const ax = 95, bx = 205, vy = 152; // les deux positions, et le sol commun

  // --- panneau de droite : la meme visee, vue comme une mesure d'attitude ---
  const cx = 358, cy = 150;
  const ex = 0.766, ey = 0.643; // direction ou le calculateur attendait l'etoile

  return svg(`
    ${glyph(30, 40, 7)}
    ${text(44, 36, esc(L.star), { cls: 'fig-truth', size: 10 })}
    ${sight(ax, vy, dx, dy, 129, 10, { cls: 'fig-truth' })}
    ${sight(bx, vy, dx, dy, 80, 10, { cls: 'fig-truth' })}
    ${line(bx - dx * 80, vy - dy * 80, bx - dx * 110, vy - dy * 110, { cls: 'fig-truth', dash: '3 4' })}
    ${tick(ax, vy, 52)}${tick(ax, vy, 60)}
    ${tick(bx, vy, 52)}${tick(bx, vy, 60)}
    ${text(133, 122, esc(L.parallel), { anchor: 'middle', cls: 'fig-truth', size: 9.5 })}
    ${circle(ax, vy, 5, { cls: 'fig-truth' })}
    ${circle(bx, vy, 5, { cls: 'fig-truth' })}
    ${line(ax, vy + 7, ax, 172, { cls: 'fig-dim' })}
    ${line(bx, vy + 7, bx, 172, { cls: 'fig-dim' })}
    ${arrow(150, 172, ax, 172, { cls: 'fig-dim' })}
    ${arrow(150, 172, bx, 172, { cls: 'fig-dim' })}
    ${text(150, 187, esc(L.apart), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
    ${text(140, 207, esc(L.noPosition), { anchor: 'middle', cls: 'fig-dim', size: 10 })}

    ${line(250, 24, 250, 200, { cls: 'fig-dim', dash: '2 5' })}

    ${legend(262, 30, [
    { cls: 'fig-truth', label: L.trueRay },
    { cls: 'fig-est', label: L.expectedRay, dash: '5 3' },
  ])}
    ${sight(cx, cy, dx, dy, 76, 9, { cls: 'fig-truth' })}
    ${sight(cx, cy, ex, ey, 76, 9, { cls: 'fig-est', dash: '5 3' })}
    ${arc(cx, cy, 44, (120 * Math.PI) / 180, (140 * Math.PI) / 180, { cls: 'fig-danger' })}
    ${text(318, 111, 'ψ', { cls: 'fig-danger', size: 12 })}
    ${circle(cx, cy, 5, { cls: 'fig-truth' })}
    ${text(364, 207, esc(L.attitudeOnly), { anchor: 'middle', cls: 'fig-danger', size: 10 })}
  `);
}

/**
 * Ce que vaut une seconde d'arc, et contre quoi elle se compare.
 *
 * Trois erreurs angulaires sur la meme echelle logarithmique, toutes tirees des
 * reglages courants : ce que valait l'alignement initial, ce que laisse une
 * visee, et ce que le gyrometre a le temps de deriver entre deux visees.
 * Quand la troisieme passe sous la deuxieme, resserrer la cadence ne rapporte
 * plus rien — c'est le bruit de visee qui commande.
 */
export function starAccuracy({ labels: L, sensors }) {
  const sigma = sensors?.starTracker?.sigma ?? 8; // ["]
  const period = sensors?.starTracker?.period ?? 20; // [s]
  const align = (sensors?.imu?.alignment ?? 0.5) * 60; // minutes d'arc -> "
  // Un degre par heure vaut exactement une seconde d'arc par seconde.
  const drift = (sensors?.imu?.gyroBias ?? 0.01) * period;

  const x0 = 118, x1 = 452, lo = 0.05, hi = 5000;
  const span = Math.log10(hi) - Math.log10(lo);
  const px = (v) => {
    const c = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
    return x0 + ((Math.log10(c) - Math.log10(lo)) / span) * (x1 - x0);
  };

  const yAxis = 178;
  const decades = [];
  for (let e = -1; e <= 3; e++) {
    const x = px(10 ** e);
    decades.push(line(x, yAxis - 5, x, yAxis + 5, { cls: 'fig-axis' }));
    decades.push(text(x, yAxis + 18, `${10 ** e}″`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 }));
  }

  const rows = [
    { v: align, cls: 'fig-est', key: 'alignment', y: 38 },
    { v: sigma, cls: 'fig-truth', key: 'sighting', y: 80 },
    { v: drift, cls: 'fig-danger', key: 'drift', y: 122 },
  ];

  const bars = rows.map((r) => {
    const x = px(r.v);
    const yMid = r.y + 16;
    const val = `${fmtSec(r.v)}″ · ${fmtUg(r.v * UG_PER_ARCSEC)} µg`;
    // Assez de place a droite du repere ? Sinon la valeur passe au-dessus de la
    // barre, jamais dessus : une valeur barree ne se lit plus.
    const right = x + 10 + val.length * 5.4 < 474;
    return `
      ${text(x0, r.y, esc(L[r.key] ?? r.key), { cls: r.cls, size: 10 })}
      ${line(x0, yMid, x, yMid, { cls: r.cls })}
      ${r.v > hi
    ? arrow(x - 11, yMid, x, yMid, { cls: r.cls })
    : line(x, yMid - 6, x, yMid + 6, { cls: r.cls })}
      ${text(right ? x + 8 : x, right ? yMid + 4 : yMid - 8, val, {
    anchor: right ? 'start' : 'end', cls: r.cls, size: 10,
  })}`;
  }).join('');

  const verdict = drift < sigma ? L.verdictQuiet : L.verdictLoud;

  return svg(`
    ${bars}
    ${text(x0, 164, esc(verdict), { cls: 'fig-dim', size: 10 })}
    ${line(x0, yAxis, x1, yAxis, { cls: 'fig-axis' })}
    ${decades.join('')}
    ${text(x0, 212, esc(L.axis), { cls: 'fig-axis-label', size: 10 })}
    ${text(x1, 212, esc(L.conversion), { anchor: 'end', cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Ce que change l'intervalle entre deux recalages — et ce qu'il ne change pas.
 *
 * Entre deux mesures, l'erreur remonte en pente libre ; chaque recalage la
 * rabat sur le plancher que fixe le bruit de la mesure elle-meme. Serrer
 * l'intervalle rabote la rampe, jamais le plancher : passe un certain point on
 * ne fait plus que remesurer le meme bruit.
 *
 * Schema partage avec terrain.period et tlm.lastReading.
 */
export function fixCadence({ labels: L }) {
  const box = { x: 58, y: 34, w: 372, h: 124 };
  const T = 180, floor = 0.22, rate = 0.0092;
  const X = (t) => box.x + (box.w * t) / T;
  const Y = (e) => box.y + box.h * (1 - Math.min(1, e));

  const saw = (period) => {
    const pts = [[X(0), Y(floor)]];
    for (let t = period; t <= T + 1e-6; t += period) {
      pts.push([X(t), Y(floor + rate * period)]);
      if (t < T - 1e-6) pts.push([X(t), Y(floor)]);
    }
    return pts;
  };
  const fixes = (period, cls) => {
    const d = [];
    for (let t = 0; t < T - 1e-6; t += period) d.push(dot(X(t), Y(floor), { r: 2.3, cls }));
    return d.join('');
  };

  // Ou l'on en est sur la rampe : c'est exactement ce que dit l'age du dernier
  // recalage affiche en telemetrie.
  const tAge = 45;
  const yAge = Y(floor + rate * tAge);

  return svg(`
    ${polyline(saw(60), { cls: 'fig-danger' })}
    ${polyline(saw(20), { cls: 'fig-est' })}
    ${fixes(60, 'fig-danger-fill')}
    ${fixes(20, 'fig-est-fill')}
    ${line(box.x, Y(floor), box.x + box.w, Y(floor), { cls: 'fig-dim', dash: '4 4' })}
    ${text(box.x + box.w - 4, Y(floor) + 14, esc(L.floor), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${line(X(tAge), yAge, X(tAge), 170, { cls: 'fig-dim', dash: '2 3' })}
    ${arrow(X(tAge / 2), 170, X(0), 170, { cls: 'fig-dim' })}
    ${arrow(X(tAge / 2), 170, X(tAge), 170, { cls: 'fig-dim' })}
    ${text(X(tAge / 2), 186, esc(L.age), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${axes(box.x, box.y + box.h, box.x + box.w + 20, box.y - 8, { xLabel: L.time, yLabel: L.error })}
    ${legend(box.x + 8, 36, [
    { cls: 'fig-danger', label: L.slow },
    { cls: 'fig-est', label: L.fast },
  ])}
    ${text(box.x, 210, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * La tranche d'altitude ou le ciel est exploitable.
 *
 * Le seuil coupe l'echelle des altitudes en deux, et l'on voit aussitot qui
 * vit au-dessus et qui vit en dessous : un vol balistique passe presque tout
 * son temps dans le ciel utilisable, un corps porteur passe tout son vol plane
 * sous la ligne. Le trait pointille rappelle le plafond du barometre et de la
 * correlation de terrain : entre les deux, plus rien n'aide le calculateur.
 */
export function starVisibility({ labels: L, sensors, veh }) {
  const minAlt = (sensors?.starTracker?.minAlt ?? 45000) / 1000; // [km]
  // Altitude de ressource du corps porteur : le haut de son vol plane.
  const pullUp = Math.max(24, (veh?.glide?.pullUpAlt ?? 62000) / 1000); // [km]

  const y0 = 190, y1 = 34; // 1 km en bas, 1000 km en haut
  const Y = (km) => y0 - (Math.log10(Math.min(1000, Math.max(1, km))) / 3) * (y0 - y1);
  const yT = Y(minAlt);
  const yCeil = Y(32);

  const ticks = [1, 10, 100, 1000].map((v) => `
    ${line(58, Y(v), 64, Y(v), { cls: 'fig-axis' })}
    ${text(54, Y(v) + 3.5, `${v} km`, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}`).join('');

  // Une colonne = la tranche d'altitude qu'occupe une phase de vol. La part
  // situee sous le seuil est aveugle : elle passe au rouge.
  const column = (x, hLo, hHi, topArrow) => {
    const yLo = Y(hLo), yHi = Y(hHi);
    const yCut = Math.max(yHi, Math.min(yLo, yT));
    return `
      ${yCut < yLo ? line(x, yLo, x, yCut, { cls: 'fig-danger' }) : ''}
      ${yCut > yHi ? line(x, yCut, x, yHi, { cls: 'fig-truth' }) : ''}
      ${line(x - 5, yLo, x + 5, yLo, { cls: yCut < yLo ? 'fig-danger' : 'fig-truth' })}
      ${topArrow
    ? arrow(x, yHi + 12, x, yHi, { cls: 'fig-truth' })
    : line(x - 5, yHi, x + 5, yHi, { cls: yCut > yHi ? 'fig-truth' : 'fig-danger' })}`;
  };

  // L'air qui s'epaissit vers le bas : traits de plus en plus serres. C'est
  // lui qui diffuse la lumiere du jour et noie les etoiles, donc lui qui pose
  // le seuil.
  const haze = [];
  for (let y = Math.max(yT, yCeil) + 12, step = 14; y < 196; step *= 0.86) {
    haze.push(line(258, y, 372, y, { cls: 'fig-ground' }));
    y += step;
  }

  // Les libelles tiennent tous dans la marge de gauche, ou aucune colonne ne
  // passe. Les deux traits horizontaux peuvent se froler : on ecrit alors vers
  // l'exterieur, chacun du cote ou il reste de la place.
  const below = yT < yCeil; // le seuil est au-dessus du plafond des autres capteurs
  const yThr = below ? yT - 6 : yT + 15;
  const yCei = below ? yCeil + 14 : yCeil - 6;
  const yMurk = (below ? yCeil : yT) + 29;

  return svg(`
    ${rect(64, y1 - 6, 388, Math.max(0, yT - (y1 - 6)), { cls: 'fig-band', rx: 0 })}
    ${line(64, y1 - 6, 64, 196, { cls: 'fig-axis' })}
    ${ticks}
    ${haze.join('')}
    ${ground(64, 452, 200)}
    ${column(275, 100, 800, true)}
    ${column(385, 20, pullUp, false)}
    ${text(275, 214, esc(L.coast), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(385, 214, esc(L.glide), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${line(64, yCeil, 452, yCeil, { cls: 'fig-dim', dash: '3 3' })}
    ${text(72, yCei, `${esc(L.ceiling)} 32 km`, { cls: 'fig-dim', size: 9.5 })}
    ${text(72, yMurk, esc(L.murk), { cls: 'fig-dim', size: 9.5 })}
    ${line(64, yT, 452, yT, { cls: 'fig-danger' })}
    ${text(72, yThr, `${esc(L.threshold)} ${minAlt.toFixed(0)} km`, { cls: 'fig-danger', size: 10 })}
  `);
}

export default {
  starGeometry, starAccuracy, fixCadence, starVisibility,
};
