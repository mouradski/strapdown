// Schemas de la centrale inertielle.
//
// Trois d'entre eux lisent les reglages courants (`ctx.sensors`) : voir la
// courbe d'erreur se deformer quand on tire le curseur enseigne davantage
// qu'un paragraphe sur la croissance en cube du temps.

import { svg, axes, text, polyline, curve, arrow, line, dot, arc, band, rect, esc } from '../svg.js';

const G0 = 9.80665;
const DEG = Math.PI / 180;

/** Biais gyro [°/h] -> [rad/s]. */
const gyroSI = (dph) => (dph * DEG) / 3600;
/** Biais accelerometrique [µg] -> [m/s²]. */
const accelSI = (ug) => ug * 1e-6 * G0;

/**
 * La boucle qui se referme sur elle-meme.
 *
 * C'est le schema le plus important du simulateur : l'accelerometre ne mesure
 * pas la gravite, le calculateur doit donc l'ajouter lui-meme, calculee a
 * partir d'une position deja fausse. L'erreur alimente sa propre croissance.
 */
export function strapdownLoop({ labels: L }) {
  const boxes = [
    { x: 18, y: 26, w: 108, h: 40, label: L.accel, cls: 'fig-truth' },
    { x: 186, y: 26, w: 108, h: 40, label: L.integrate, cls: 'fig-est' },
    { x: 354, y: 26, w: 108, h: 40, label: L.position, cls: 'fig-est' },
    { x: 186, y: 150, w: 108, h: 40, label: L.gravity, cls: 'fig-danger' },
  ];
  const b = boxes.map((o) => `
    ${rect(o.x, o.y, o.w, o.h, { cls: `fig-box ${o.cls}-box`, rx: 6 })}
    ${text(o.x + o.w / 2, o.y + o.h / 2 + 4, esc(o.label), { anchor: 'middle', cls: o.cls, size: 10.5 })}`).join('');

  return svg(`
    ${b}
    ${arrow(126, 46, 184, 46)}
    ${arrow(294, 46, 352, 46)}
    ${/* retour de la position vers le modele de gravite */ ''}
    ${line(408, 66, 408, 170, { cls: 'fig-danger' })}
    ${arrow(408, 170, 296, 170, { cls: 'fig-danger' })}
    ${/* et la gravite calculee revient dans l'integration */ ''}
    ${line(186, 170, 150, 170, { cls: 'fig-danger' })}
    ${line(150, 170, 150, 46, { cls: 'fig-danger' })}
    ${arrow(150, 46, 184, 46, { cls: 'fig-danger' })}
    ${text(240, 96, esc(L.loop), { anchor: 'middle', cls: 'fig-danger', size: 10.5 })}
    ${text(240, 112, esc(L.loopNote), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(240, 212, esc(L.caption), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * L'echelle des classes de centrale, en decades.
 *
 * Quatre ordres de grandeur separent une centrale de telephone d'une centrale
 * strategique : seule une echelle logarithmique le montre honnetement.
 */
export function gradeLadder({ labels: L, sensors }) {
  const marks = [
    { v: 150, key: 'consumer' },
    { v: 1.0, key: 'tactical' },
    { v: 0.01, key: 'navigation' },
    { v: 0.0005, key: 'strategic' },
  ];
  const lo = 1e-4, hi = 500;
  const x0 = 56, x1 = 452;
  const px = (v) => x0 + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (x1 - x0);
  const yAxis = 132;

  const decades = [];
  for (let e = -4; e <= 2; e++) {
    const x = px(10 ** e);
    decades.push(line(x, yAxis - 5, x, yAxis + 5, { cls: 'fig-axis' }));
    decades.push(text(x, yAxis + 19, `10${sup(e)}`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 }));
  }

  const cur = sensors?.imu?.gyroBias;
  const pins = marks.map((m, i) => {
    const x = px(m.v);
    const up = i % 2 === 0;
    const yTip = up ? yAxis - 26 : yAxis - 62;
    return `${line(x, yAxis, x, yTip, { cls: 'fig-dim', dash: '2 3' })}
      ${dot(x, yAxis, { r: 3, cls: 'fig-est-fill' })}
      ${text(x, yTip - 5, esc(L[m.key] ?? m.key), { anchor: 'middle', cls: 'fig-est', size: 10 })}`;
  }).join('');

  const marker = Number.isFinite(cur) && cur > 0 ? `
    ${line(px(cur), yAxis - 78, px(cur), yAxis + 8, { cls: 'fig-danger' })}
    ${text(px(cur), yAxis - 84, `${esc(L.current)} ${fmtSci(cur)} °/h`, {
    anchor: px(cur) > 300 ? 'end' : 'middle', cls: 'fig-danger', size: 10.5,
  })}` : '';

  return svg(`
    ${line(x0, yAxis, x1, yAxis, { cls: 'fig-axis' })}
    ${decades.join('')}
    ${pins}
    ${marker}
    ${text(x0, yAxis + 40, esc(L.axis), { cls: 'fig-axis-label', size: 10 })}
    ${text(240, 206, esc(L.caption), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `, { h: 220 });
}

const sup = (e) => String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);

function fmtSci(v) {
  if (v >= 100) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.001) return v.toFixed(3);
  return v.toExponential(1);
}

/**
 * Croissance de l'erreur de position : carre du temps pour l'accelerometre,
 * CUBE pour le gyrometre. Les deux courbes sont calculees avec les reglages
 * reels, ce qui rend l'instant de croisement lisible.
 */
export function errorGrowth({ labels: L, sensors }) {
  const ba = accelSI(sensors?.imu?.accelBias ?? 25);
  const bg = gyroSI(sensors?.imu?.gyroBias ?? 0.01);

  // Erreur de position : 1/2.b.t² pour un biais d'acceleration ;
  // 1/6.g.b.t³ pour un biais gyro, via le basculement de la verticale.
  const eAccel = (t) => 0.5 * ba * t * t;
  const eGyro = (t) => (G0 * bg * t * t * t) / 6;

  // Instant ou le terme cubique depasse le quadratique : 3.ba/(g.bg). La
  // fenetre de temps se cale dessus, sinon le croisement tombe hors du cadre
  // pour la moitie des reglages et le schema ne montre plus rien.
  const tCross = bg > 0 ? (3 * ba) / (G0 * bg) : Infinity;
  const T = Math.max(120, Math.min(3600, Number.isFinite(tCross) ? tCross * 1.6 : 900));

  const box = { x: 52, y: 24, w: 342, h: 132 };
  const peak = Math.max(eAccel(T), eGyro(T), 1);
  const crossX = tCross > 0 && tCross < T ? box.x + (box.w * tCross) / T : null;

  return svg(`
    ${axes(box.x, box.y + box.h, box.x + box.w + 22, box.y - 8, { xLabel: L.time, yLabel: L.error })}
    ${curve(eAccel, 0, T, box, { cls: 'fig-est', yMax: peak })}
    ${curve(eGyro, 0, T, box, { cls: 'fig-danger', yMax: peak })}
    ${crossX ? `${line(crossX, box.y, crossX, box.y + box.h, { cls: 'fig-dim', dash: '3 3' })}
      ${text(crossX + 4, box.y + 12, `${esc(L.crossover)} T+${tCross.toFixed(0)} s`, { cls: 'fig-dim', size: 9.5 })}` : ''}
    ${text(box.x + box.w + 6, box.y + box.h - (eAccel(T) / peak) * box.h - 4, `${esc(L.accel)} · t²`, { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${text(box.x + box.w + 6, box.y + box.h - (eGyro(T) / peak) * box.h - 4, `${esc(L.gyro)} · t³`, { anchor: 'end', cls: 'fig-danger', size: 10 })}
    ${text(box.x, box.y + box.h + 34, `${esc(L.at)} T+${T.toFixed(0)} s : ${esc(L.accel)} ${fmtM(eAccel(T))}, ${esc(L.gyro)} ${fmtM(eGyro(T))}`, { cls: 'fig-dim', size: 10 })}
    ${text(box.x, box.y + box.h + 50, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 220 });
}

const fmtM = (m) => (m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * Marche aleatoire : le bruit ne biaise pas, il DISPERSE. Plusieurs tirages
 * partant du meme point, et l'enveloppe en racine du temps qui les contient.
 */
export function randomWalk({ labels: L }) {
  const box = { x: 52, y: 20, w: 366, h: 120 };
  const mid = box.y + box.h / 2;
  const n = 70;

  // Graine fixe : le schema doit etre le meme a chaque ouverture.
  let seed = 20240117;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };

  const paths = [];
  for (let k = 0; k < 5; k++) {
    let acc = 0;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      acc += rnd() * 5.2;
      pts.push([box.x + (box.w * i) / n, mid + acc]);
    }
    paths.push(polyline(pts, { cls: 'fig-est', dash: null }));
  }

  // Enveloppe ±sigma, en racine du temps.
  const env = (sign) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([box.x + (box.w * i) / n, mid + sign * 21 * Math.sqrt(i / n)]);
    return pts;
  };
  const up = env(-1), dn = env(1);

  return svg(`
    ${band([...up, ...dn.reverse()], { cls: 'fig-band' })}
    ${line(box.x, mid, box.x + box.w, mid, { cls: 'fig-axis', dash: '3 3' })}
    ${paths.join('')}
    ${polyline(env(-1), { cls: 'fig-danger', dash: '4 3' })}
    ${polyline(env(1), { cls: 'fig-danger', dash: '4 3' })}
    ${axes(box.x, box.y + box.h + 16, box.x + box.w + 20, box.y - 6, { xLabel: L.time, yLabel: L.error })}
    ${text(box.x + box.w - 4, mid - 27, `± σ ∝ √t`, { anchor: 'end', cls: 'fig-danger', size: 10.5 })}
    ${text(box.x, box.y + box.h + 46, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 200 });
}

/**
 * Erreur d'alignement : la centrale croit la verticale ailleurs qu'elle n'est.
 * Une fraction de g fuit alors dans l'horizontale, et rien a bord ne peut
 * distinguer cette fuite d'une vraie acceleration.
 */
export function alignmentTilt({ labels: L, sensors }) {
  const arcmin = sensors?.imu?.alignment ?? 0.5;
  const psi = (arcmin / 60) * DEG;
  const cx = 150, cy = 158, len = 96;

  // On exagere l'angle pour qu'il soit visible : quelques minutes d'arc ne se
  // dessinent pas. Le texte donne la valeur vraie.
  const shown = Math.max(9 * DEG, Math.min(26 * DEG, psi * 900));
  const tipX = cx + len * Math.sin(shown);
  const tipY = cy - len * Math.cos(shown);
  const leak = G0 * Math.sin(psi);

  return svg(`
    ${line(cx - 108, cy, cx + 150, cy, { cls: 'fig-ground' })}
    ${arrow(cx, cy, cx, cy - len, { cls: 'fig-truth' })}
    ${text(cx - 6, cy - len - 8, esc(L.trueVertical), { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${arrow(cx, cy, tipX, tipY, { cls: 'fig-est' })}
    ${text(tipX + 8, tipY - 4, esc(L.believedVertical), { cls: 'fig-est', size: 10 })}
    ${arc(cx, cy, 52, Math.PI / 2, Math.PI / 2 - shown, { cls: 'fig-danger' })}
    ${text(cx + 26, cy - 60, 'ψ', { cls: 'fig-danger', size: 12 })}
    ${/* composante horizontale parasite */ ''}
    ${arrow(cx, cy - 34, cx + 62, cy - 34, { cls: 'fig-danger' })}
    ${text(cx + 68, cy - 30, 'g·sin ψ', { cls: 'fig-danger', size: 10.5 })}
    ${text(300, 48, `${esc(L.alignment)} : ${arcmin.toFixed(2)}′`, { cls: 'fig-est', size: 11 })}
    ${text(300, 66, `${esc(L.leak)} : ${(leak * 1e6 / G0).toFixed(0)} µg`, { cls: 'fig-danger', size: 11 })}
    ${text(300, 84, `${esc(L.after)} : ${fmtM(0.5 * leak * 600 * 600)}`, { cls: 'fig-danger', size: 11 })}
    ${text(20, 208, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 220 });
}

export default {
  strapdownLoop, gradeLadder, errorGrowth, randomWalk, alignmentTilt,
};
