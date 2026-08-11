// Schemas du bandeau de vol.
//
// Le bandeau affiche des grandeurs de deux natures que rien ne distingue a
// l'oeil : des mesures de la VERITE terrain, qu'aucun instrument de bord ne
// pourrait produire, et ce que le calculateur CROIT. Les schemas d'ici servent
// surtout a rendre cet ecart visible, et a montrer d'ou viennent les formes
// des courbes plutot qu'a les decorer.
//
// Les profils incrustes ne sont pas dessines a la main : ils sont releves sur
// le simulateur lui-meme (voir le tableau FLIGHT), de sorte qu'un schema ne
// puisse pas raconter autre chose que ce que fait le code.

import {
  svg, axes, text, polyline, arrow, line, dot, arc, legend, rect, ground, esc,
} from '../svg.js';
import { atmosphere } from '../../../core/atmosphere.js';
import { cdOfMach } from '../../../sim/vehicle.js';

const G0 = 9.80665;
const DEG = Math.PI / 180;

// --- Vol de reference -------------------------------------------------------
//
// Tir bal2 de 1912 km, graine 42, centrale de classe navigation, releve pas a
// pas sur la simulation. Colonnes :
//   t [s] | altitude [km] | vitesse inertielle [m/s] | force specifique [g] | pente [deg]
const FLIGHT = [
  [0, 0.3, 411, 2.65, 0.0],
  [20, 4.0, 573, 3.35, 43.1],
  [40, 17.3, 1081, 4.99, 66.4],
  [60, 46.7, 2120, 8.51, 77.5],
  [80, 96.7, 2760, 4.77, 70.6],
  [100, 147.1, 3176, 7.14, 50.4],
  [113, 178.0, 3987, 10.50, 37.6],
  [120, 196.2, 3949, 0, 37.2],
  [160, 285.8, 3736, 0, 33.9],
  [200, 363.3, 3547, 0, 30.2],
  [240, 429.0, 3382, 0, 26.2],
  [280, 483.1, 3243, 0, 21.8],
  [320, 525.7, 3131, 0, 17.1],
  [360, 557.0, 3046, 0, 12.1],
  [400, 577.0, 2992, 0, 6.9],
  [452, 586.1, 2967, 0, 0.0],
  [500, 578.2, 2989, 0, -6.5],
  [540, 559.1, 3042, 0, -11.8],
  [580, 528.8, 3124, 0, -16.8],
  [620, 487.1, 3234, 0, -21.5],
  [660, 434.0, 3372, 0, -25.9],
  [700, 369.3, 3535, 0, -30.0],
  [740, 292.8, 3722, 0, -33.7],
  [780, 204.2, 3933, 0, -37.1],
  [800, 155.3, 4047, 0, -38.6],
  [820, 103.3, 4166, 0, -40.1],
  [833, 67.0, 4248, 0.02, -41.0],
  [840, 47.6, 4284, 0.30, -41.5],
  [844, 37.8, 4285, 1.20, -41.7],
  [847, 28.0, 4214, 5.20, -41.9],
  [851, 18.7, 3863, 19.10, -41.8],
  [854, 10.8, 2919, 35.50, -40.9],
  [858, 5.6, 1898, 24.80, -38.5],
  [861, 2.3, 1295, 13.70, -35.5],
  [865, 0.1, 974, 7.80, -32.4],
];

// Montee seule, echantillonnee plus finement : c'est la que se joue le maximum
// de pression dynamique. La vitesse est ici celle RELATIVE A L'AIR — la seule
// qui entre dans ½ρv², et qui differe de la vitesse inertielle affichee par le
// bandeau de tout ce que la rotation terrestre emporte.
// Colonnes : altitude [km] | vitesse air [m/s].
const ASCENT = [
  [0.30, 0], [0.43, 67], [0.85, 140], [1.56, 218], [2.60, 302], [3.98, 391],
  [5.74, 488], [7.90, 594], [10.50, 712], [13.59, 843], [17.25, 990],
  [21.54, 1157], [26.53, 1344], [32.32, 1555], [39.01, 1795], [46.72, 2070],
  [55.62, 2390], [65.48, 2511],
];

const TOF = 865; // duree du vol de reference [s]
const RANGE = 1912; // portee du vol de reference [km]
const APOGEE = 586; // apogee [km]

/** Interpolation lineaire de la colonne `iy` en fonction de la colonne `ix`. */
function interp(rows, ix, iy, x) {
  if (x <= rows[0][ix]) return rows[0][iy];
  const last = rows[rows.length - 1];
  if (x >= last[ix]) return last[iy];
  let i = 0;
  while (i < rows.length - 2 && x > rows[i + 1][ix]) i++;
  const a = rows[i], b = rows[i + 1];
  const f = (x - a[ix]) / (b[ix] - a[ix]);
  return a[iy] + f * (b[iy] - a[iy]);
}

const fmtG = (g) => (g >= 10 ? g.toFixed(0) : g.toFixed(1));

/** Force specifique parasite, en µg ou en mg selon l'ordre de grandeur. */
function fmtLeak(ms2) {
  const ug = ms2 / (G0 * 1e-6);
  if (ug < 1) return '0';
  if (ug < 1000) return `${ug.toFixed(0)} µg`;
  return `${(ug / 1000).toFixed(1)} mg`;
}

/**
 * Altitude : le distributeur de recalages.
 *
 * L'altitude ne dit pas seulement ou l'on est, elle dit QUI repond. Chaque
 * capteur a sa tranche, et il subsiste entre le plafond du barometre et le
 * plancher du viseur stellaire une bande ou plus rien ne parle. Un vecteur
 * balistique la traverse en quelques secondes ; un planeur y campe.
 */
export function altitudeProfile({ labels: L, sensors }) {
  const box = { x: 54, y: 22, w: 400, h: 146 };
  const T = 900, ZMAX = 120;
  const px = (t) => box.x + (box.w * t) / T;
  const py = (z) => box.y + box.h - (box.h * Math.min(z, ZMAX)) / ZMAX;

  const zStar = (sensors?.starTracker?.minAlt ?? 45000) / 1000;
  const zBaro = (sensors?.altimeter?.baroMaxAlt ?? 32000) / 1000;
  const zRadar = (sensors?.altimeter?.radarMaxAlt ?? 15000) / 1000;

  // Le profil sort du cadre : on distingue au trait ce qui est visible de ce
  // qui ne l'est pas, plutot que d'ecraser 586 km dans la hauteur du dessin.
  const segs = [];
  let cur = null;
  for (const r of FLIGHT) {
    const inside = r[1] < ZMAX;
    if (!cur || cur.inside !== inside) {
      const prev = cur;
      cur = { inside, p: [] };
      if (prev) cur.p.push(prev.p[prev.p.length - 1]);
      segs.push(cur);
    }
    cur.p.push([px(r[0]), py(r[1])]);
  }

  const mid = (py(zStar) + py(zBaro)) / 2 + 3.5;
  const blind = zStar > zBaro ? `
    ${rect(box.x, py(zStar), box.w, py(zBaro) - py(zStar), { cls: 'fig-band-danger', rx: 0 })}
    ${text(370, mid, `${esc(L.blind)} · ${zBaro.toFixed(0)}–${zStar.toFixed(0)} km`, {
    anchor: 'end', cls: 'fig-danger', size: 10,
  })}
    ${text(100, mid, `${esc(L.crossing)} ≈ 7 s`, { cls: 'fig-danger', size: 10 })}` : '';

  const rule = (z, dy, label) => `
    ${line(box.x, py(z), box.x + box.w, py(z), { cls: 'fig-dim', dash: '3 4' })}
    ${text(112, py(z) + dy, label, { cls: 'fig-est', size: 9.5 })}`;

  return svg(`
    ${blind}
    ${rule(zStar, -5, `${esc(L.star)} ≥ ${zStar.toFixed(0)} km`)}
    ${rule(zBaro, 12, `${esc(L.baro)} ≤ ${zBaro.toFixed(0)} km`)}
    ${rule(zRadar, 12, `${esc(L.radar)} ≤ ${zRadar.toFixed(0)} km`)}
    ${axes(box.x, box.y + box.h, box.x + box.w + 20, box.y - 6, { xLabel: L.time, yLabel: L.altitude })}
    ${segs.map((s) => polyline(s.p, { cls: 'fig-truth', dash: s.inside ? null : '5 4' })).join('')}
    ${text(240, box.y + 12, `${esc(L.offscale)} ${APOGEE} km`, { anchor: 'middle', cls: 'fig-dim', size: 10 })}
    ${text(240, py(72), esc(L.aboveStar), { anchor: 'middle', cls: 'fig-est', size: 10.5 })}
    ${text(box.x, box.y + box.h + 32, `T+0 … T+${TOF} s · ${RANGE} km`, { cls: 'fig-dim', size: 9.5 })}
    ${text(box.x, box.y + box.h + 50, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Vitesse : elle ne part pas de zero et ne passe jamais par zero.
 *
 * Au sol, immobile, le vehicule est deja emporte a 411 m/s par la rotation
 * terrestre ; a l'apogee il conserve les trois quarts de sa vitesse
 * d'extinction, parce qu'une trajectoire balistique est un arc d'orbite. Seule
 * l'atmosphere finit par la lui prendre, et en vingt-cinq secondes.
 */
export function speedProfile({ labels: L }) {
  const box = { x: 54, y: 24, w: 396, h: 130 };
  const T = 900, VMAX = 4.6;
  const px = (t) => box.x + (box.w * t) / T;
  const py = (v) => box.y + box.h - (box.h * v) / VMAX;

  const pts = FLIGHT.map((r) => [px(r[0]), py(r[2] / 1000)]);
  const mark = (t, v, key, dx, dy, anchor = 'start') => `
    ${dot(px(t), py(v), { r: 3, cls: 'fig-truth-fill' })}
    ${text(px(t) + dx, py(v) + dy, `${esc(L[key])} ${v.toFixed(2)} km/s`, { anchor, cls: 'fig-truth', size: 10 })}`;

  const floor = 0.411;
  return svg(`
    ${line(box.x, py(floor), box.x + box.w, py(floor), { cls: 'fig-dim', dash: '3 4' })}
    ${text(box.x + box.w - 20, py(floor) - 6, `${esc(L.floor)} ${(floor * 1000).toFixed(0)} m/s`, {
    anchor: 'end', cls: 'fig-dim', size: 10,
  })}
    ${axes(box.x, box.y + box.h, box.x + box.w + 20, box.y - 6, { xLabel: L.time, yLabel: L.speed })}
    ${polyline(pts, { cls: 'fig-truth' })}
    ${mark(113, 3.99, 'burnout', 6, -6)}
    ${mark(452, 2.97, 'apogee', 0, -10)}
    ${mark(865, 0.97, 'impact', -23, -7, 'end')}
    ${text(px(820), py(2.1), esc(L.brake), { anchor: 'end', cls: 'fig-danger', size: 10 })}
    ${text(box.x, box.y + box.h + 50, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Mach : une mesure de compressibilite, pas de vitesse.
 *
 * A gauche la vitesse du son du modele d'atmosphere : elle ne depend que de la
 * temperature, et la stratopause est 84 K plus chaude que la mesopause. A
 * droite la raison d'etre du nombre : le coefficient de trainee du code n'est
 * fonction de rien d'autre.
 */
export function machRegimes({ labels: L }) {
  const A = { x: 54, y: 32, w: 148, h: 118 };
  const B = { x: 286, y: 32, w: 168, h: 118 };

  // --- vitesse du son en fonction de l'altitude ---
  const aMin = 260, aMax = 350, zMax = 100;
  const ax = (a) => A.x + (A.w * (a - aMin)) / (aMax - aMin);
  const az = (z) => A.y + A.h - (A.h * z) / zMax;
  const sound = [];
  for (let i = 0; i <= 80; i++) {
    const z = (zMax * i) / 80;
    sound.push([ax(atmosphere(z * 1000).a), az(z)]);
  }

  // --- coefficient de trainee en fonction du nombre de Mach ---
  const mMax = 12, cdMax = 0.5;
  const bx = (m) => B.x + (B.w * m) / mMax;
  const by = (c) => B.y + B.h - (B.h * c) / cdMax;
  const drag = [];
  for (let i = 0; i <= 120; i++) {
    const m = (mMax * i) / 120;
    drag.push([bx(m), by(cdOfMach(m))]);
  }

  return svg(`
    ${axes(A.x, A.y + A.h, A.x + A.w + 14, A.y - 6, { xLabel: L.sound, yLabel: L.altitude })}
    ${polyline(sound, { cls: 'fig-truth' })}
    ${dot(ax(329.8), az(47), { r: 3, cls: 'fig-danger-fill' })}
    ${text(ax(329.8) - 6, az(47) + 3, esc(L.warm), { anchor: 'end', cls: 'fig-danger', size: 9.5 })}
    ${dot(ax(274.1), az(86), { r: 3, cls: 'fig-danger-fill' })}
    ${text(ax(274.1) + 6, az(86) + 3, esc(L.cold), { cls: 'fig-danger', size: 9.5 })}

    ${axes(B.x, B.y + B.h, B.x + B.w + 14, B.y - 6, { xLabel: L.mach, yLabel: L.drag })}
    ${polyline(drag, { cls: 'fig-truth' })}
    ${dot(bx(1.05), by(0.44), { r: 3, cls: 'fig-danger-fill' })}
    ${text(bx(1.05) + 7, by(0.44) + 2, `${esc(L.peak)} 0.44`, { cls: 'fig-danger', size: 9.5 })}
    ${text(bx(mMax), by(0.19) - 6, `${esc(L.floorCd)} 0.19`, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}

    ${text(A.x, 184, esc(L.example), { cls: 'fig-dim', size: 10 })}
    ${text(A.x, 200, esc(L.example2), { cls: 'fig-dim', size: 10 })}
    ${text(A.x, 218, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Pression dynamique : le produit de deux courbes qui se croisent.
 *
 * La densite s'effondre, la vitesse grimpe ; leur produit passe donc par un
 * maximum franc, et c'est lui qui decide de ce que le vehicule a le droit de
 * demander a ses gouvernes. Les seuils traces sont ceux du limiteur
 * d'incidence du calculateur, en dur dans computer.js.
 */
export function dynamicPressure({ labels: L }) {
  const box = { x: 54, y: 28, w: 376, h: 126 };
  const zMax = 60, qMax = 110; // [km], [kPa]
  const px = (z) => box.x + (box.w * z) / zMax;
  const py = (q) => box.y + box.h - (box.h * q) / qMax;

  const vAt = (z) => interp(ASCENT, 0, 1, z);
  const qAt = (z) => 0.5 * atmosphere(z * 1000).rho * vAt(z) ** 2 / 1000;

  const qPts = [], rhoPts = [], vPts = [];
  const rho0 = atmosphere(0).rho, vTop = vAt(zMax);
  let peakZ = 0, peakQ = 0;
  for (let i = 0; i <= 120; i++) {
    const z = (zMax * i) / 120;
    const q = qAt(z);
    if (q > peakQ) { peakQ = q; peakZ = z; }
    qPts.push([px(z), py(q)]);
    rhoPts.push([px(z), box.y + box.h - box.h * 0.92 * (atmosphere(z * 1000).rho / rho0)]);
    vPts.push([px(z), box.y + box.h - box.h * 0.92 * (vAt(z) / vTop)]);
  }

  const limit = (q, key) => `
    ${line(box.x, py(q), box.x + box.w, py(q), { cls: 'fig-cmd', dash: '2 4' })}
    ${text(box.x + box.w + 2, py(q) + 3.5, `${q} kPa · ${esc(L[key])}`, { anchor: 'end', cls: 'fig-cmd', size: 9.5 })}`;

  return svg(`
    ${axes(box.x, box.y + box.h, box.x + box.w + 20, box.y - 6, { xLabel: L.altitude, yLabel: L.pressure })}
    ${polyline(rhoPts, { cls: 'fig-dim', dash: '5 4' })}
    ${polyline(vPts, { cls: 'fig-dim', dash: '1 4' })}
    ${limit(20, 'limit2')}
    ${limit(5, 'limit6')}
    ${polyline(qPts, { cls: 'fig-truth' })}
    ${dot(px(peakZ), py(peakQ), { r: 3.5, cls: 'fig-truth-fill' })}
    ${text(px(peakZ) + 8, py(peakQ) - 4, `${peakQ.toFixed(0)} kPa · ${peakZ.toFixed(0)} km`, { cls: 'fig-truth', size: 10.5 })}
    ${text(px(3), box.y + 34, esc(L.density), { cls: 'fig-dim', size: 9.5 })}
    ${text(px(zMax) - 4, box.y + 12, esc(L.speed), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(box.x, box.y + box.h + 32, esc(L.reentry), { cls: 'fig-danger', size: 10 })}
    ${text(box.x, box.y + box.h + 50, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Acceleration : ce que les accelerometres LISENT.
 *
 * Le champ affiche une force specifique, pas une acceleration. Il indique donc
 * zero pendant les 660 secondes de vol libre — l'essentiel du vol — et son
 * maximum n'est pas au decollage mais a la rentree.
 */
export function accelProfile({ labels: L }) {
  const box = { x: 54, y: 24, w: 398, h: 132 };
  const T = 900, gMax = 38;
  const px = (t) => box.x + (box.w * t) / T;
  const py = (g) => box.y + box.h - (box.h * g) / gMax;
  const pts = FLIGHT.map((r) => [px(r[0]), py(r[3])]);

  const y0 = py(0);
  return svg(`
    ${axes(box.x, y0, box.x + box.w + 20, box.y - 6, { xLabel: L.time, yLabel: L.accel })}
    ${polyline(pts, { cls: 'fig-truth' })}
    ${dot(px(113), py(10.5), { r: 3, cls: 'fig-truth-fill' })}
    ${text(px(113) + 7, py(10.5) - 4, `${esc(L.boost)} 10.5 g`, { cls: 'fig-truth', size: 10 })}
    ${dot(px(854), py(35.5), { r: 3, cls: 'fig-truth-fill' })}
    ${text(px(854) - 7, py(35.5) + 4, `${esc(L.reentry)} 35 g`, { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${line(px(120), y0 - 10, px(833), y0 - 10, { cls: 'fig-danger', dash: '4 3' })}
    ${arrow(px(200), y0 - 10, px(120), y0 - 10, { cls: 'fig-danger' })}
    ${arrow(px(753), y0 - 10, px(833), y0 - 10, { cls: 'fig-danger' })}
    ${text(px(476), y0 - 16, `${esc(L.freefall)} · 713 s`, { anchor: 'middle', cls: 'fig-danger', size: 10.5 })}
    ${text(box.x, box.y + box.h + 32, esc(L.note), { cls: 'fig-dim', size: 10 })}
    ${text(box.x, box.y + box.h + 50, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Angle de pente : l'angle entre le vecteur vitesse et l'horizontale locale.
 * A gauche sa definition geometrique, a droite ce qu'il fait sur un vol
 * complet — et le fait qu'il s'annule exactement a l'apogee.
 */
export function flightPathAngle({ labels: L }) {
  const cx = 92, cy = 152, len = 92;
  const gShown = 34 * DEG;
  const tipX = cx + len * Math.cos(gShown), tipY = cy - len * Math.sin(gShown);

  const box = { x: 268, y: 30, w: 178, h: 120 };
  const T = 900, aMax = 90, aMin = -50;
  const px = (t) => box.x + (box.w * t) / T;
  const py = (a) => box.y + box.h - (box.h * (a - aMin)) / (aMax - aMin);
  const pts = FLIGHT.map((r) => [px(r[0]), py(r[4])]);

  return svg(`
    ${line(cx - 66, cy, cx + 118, cy, { cls: 'fig-ground' })}
    ${text(cx - 66, cy + 16, esc(L.horizon), { cls: 'fig-dim', size: 9.5 })}
    ${arrow(cx, cy, cx, cy - len, { cls: 'fig-dim' })}
    ${text(cx - 5, cy - len - 5, esc(L.up), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${arrow(cx, cy, tipX, tipY, { cls: 'fig-truth' })}
    ${text(tipX + 5, tipY - 5, esc(L.velocity), { cls: 'fig-truth', size: 10 })}
    ${arc(cx, cy, 44, 0, gShown, { cls: 'fig-danger' })}
    ${text(cx + 50, cy - 12, 'γ', { cls: 'fig-danger', size: 12 })}
    ${text(cx - 66, 196, 'sin γ = r̂ · v̂', { cls: 'fig-dim', size: 10.5 })}

    ${line(box.x, py(0), box.x + box.w, py(0), { cls: 'fig-dim', dash: '3 4' })}
    ${axes(box.x, box.y + box.h, box.x + box.w + 16, box.y - 6, { xLabel: L.time, yLabel: L.angle })}
    ${polyline(pts, { cls: 'fig-truth' })}
    ${dot(px(452), py(0), { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(px(452) + 7, py(0) - 6, esc(L.apogee), { cls: 'fig-danger', size: 10 })}
    ${text(box.x + 32, py(78) + 2, `${esc(L.climb)} +78°`, { cls: 'fig-truth', size: 9.5 })}
    ${text(box.x + 8, py(-44), `${esc(L.descent)} −41°`, { cls: 'fig-truth', size: 9.5 })}
    ${text(20, 216, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Distance parcourue / distance restante : deux arcs mesures AU SOL.
 *
 * Ni l'un ni l'autre ne suit la trajectoire, et aucun ne tient compte de
 * l'altitude : a l'apogee du tir de reference, le bandeau annonce 892 km alors
 * que le vehicule est a 1100 km du pas de tir en ligne droite.
 */
export function greatCircle({ labels: L }) {
  const C = { x: 240, y: 596 }, R = 430;
  const HALF = 26 * DEG;
  const at = (a, h = 0) => [C.x + (R + h) * Math.sin(a), C.y - (R + h) * Math.cos(a)];

  const surface = [];
  for (let i = 0; i <= 60; i++) surface.push(at(-HALF * 1.15 + (2.3 * HALF * i) / 60));

  // Trajectoire : apogee legerement avant le milieu, comme dans le vol reel.
  const traj = [];
  const hMax = 46;
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    traj.push(at(-HALF + 2 * HALF * u, hMax * Math.sin(Math.PI * u) ** 1.25));
  }

  const uV = 0.466; // fraction de portee atteinte a l'apogee
  const aV = -HALF + 2 * HALF * uV;
  const veh = at(aV, hMax * Math.sin(Math.PI * uV) ** 1.25);
  const sub = at(aV);
  const launch = at(-HALF);
  const target = at(HALF);

  // Les deux arcs mesures, traces legerement sous la surface pour rester lisibles.
  const arcPts = (a0, a1) => {
    const out = [];
    for (let i = 0; i <= 30; i++) out.push(at(a0 + ((a1 - a0) * i) / 30, -13));
    return out;
  };

  return svg(`
    ${polyline(surface, { cls: 'fig-ground' })}
    ${polyline(traj, { cls: 'fig-truth' })}
    ${line(veh[0], veh[1], sub[0], sub[1], { cls: 'fig-dim', dash: '2 3' })}
    ${line(launch[0], launch[1], veh[0], veh[1], { cls: 'fig-cmd', dash: '5 4' })}
    ${polyline(arcPts(-HALF, aV), { cls: 'fig-est' })}
    ${polyline(arcPts(aV, HALF), { cls: 'fig-est' })}
    ${dot(launch[0], launch[1], { r: 3.5, cls: 'fig-truth-fill' })}
    ${dot(sub[0], sub[1], { r: 2.8, cls: 'fig-est-fill' })}
    ${dot(target[0], target[1], { r: 3.5, cls: 'fig-danger-fill' })}
    ${dot(veh[0], veh[1], { r: 3.5, cls: 'fig-truth-fill' })}
    ${text(launch[0] - 4, launch[1] - 8, esc(L.launch), { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${text(target[0] + 4, target[1] - 8, esc(L.target), { cls: 'fig-danger', size: 10 })}
    ${text(veh[0] + 8, veh[1] - 4, `${esc(L.vehicle)} ${APOGEE} km`, { cls: 'fig-truth', size: 10 })}
    ${text(at(-HALF / 2, -22)[0], at(-HALF / 2, -22)[1], `892 km ${esc(L.downrange)}`, {
    anchor: 'middle', cls: 'fig-est', size: 10.5,
  })}
    ${text(at(HALF / 2, -22)[0], at(HALF / 2, -22)[1], `1021 km ${esc(L.toGo)}`, {
    anchor: 'middle', cls: 'fig-est', size: 10.5,
  })}
    ${text(215, 104, `1100 km ${esc(L.straight)}`, { anchor: 'end', cls: 'fig-cmd', size: 10.5 })}
    ${text(240, 220, `892 + 1021 = ${RANGE} km — ${esc(L.sum)}`, { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * L'image de marque du simulateur : deux trajectoires issues du meme point de
 * tir, la verte vraie, l'ambre celle que le calculateur croit suivre. Le
 * guidage ne voit que l'ambre, et la pose exactement sur l'objectif. La verte
 * tombe a cote, de l'ecart accumule par la navigation.
 */
export function truthVsEstimate({ labels: L }) {
  const gy = 178, x0 = 46;
  const xT = 428, xTrue = 372;
  const arcTo = (xEnd, apex) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      pts.push([x0 + (xEnd - x0) * u, gy - apex * Math.sin(Math.PI * u) ** 0.92]);
    }
    return pts;
  };

  const est = arcTo(xT, 122);
  const truth = arcTo(xTrue, 128);
  const xCut = x0 + (xT - x0) * 0.13;

  return svg(`
    ${ground(24, 460, gy)}
    ${line(xCut, gy, xCut, 112, { cls: 'fig-dim', dash: '3 4' })}
    ${text(xCut + 5, 150, esc(L.cutoff), { cls: 'fig-dim', size: 9.5 })}
    ${polyline(est, { cls: 'fig-est' })}
    ${polyline(truth, { cls: 'fig-truth' })}
    ${dot(x0, gy, { r: 3.5, cls: 'fig-truth-fill' })}
    ${line(xT, gy - 9, xT, gy + 9, { cls: 'fig-danger' })}
    ${line(xT - 9, gy, xT + 9, gy, { cls: 'fig-danger' })}
    ${dot(xTrue, gy, { r: 3.5, cls: 'fig-truth-fill' })}
    ${arrow(xTrue, gy + 20, xT, gy + 20, { cls: 'fig-danger' })}
    ${arrow(xT, gy + 20, xTrue, gy + 20, { cls: 'fig-danger' })}
    ${text((xTrue + xT) / 2, gy + 36, esc(L.gap), { anchor: 'middle', cls: 'fig-danger', size: 10.5 })}
    ${legend(46, 28, [
    { cls: 'fig-truth', label: L.truth },
    { cls: 'fig-est', label: L.estimate },
  ])}
    ${text(xCut + 5, 164, `${esc(L.atCutoff)} — 4 m · 0.15 m/s`, { cls: 'fig-dim', size: 9.5 })}
    ${text(456, 28, esc(L.blindNote), { anchor: 'end', cls: 'fig-est', size: 10.5 })}
    ${text(456, 44, esc(L.blindNote2), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(24, 218, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Erreur d'attitude : son cout est proportionnel a la force specifique.
 *
 * Le filtre l'ecrit noir sur blanc — le bloc qui couple l'attitude a la vitesse
 * vaut −[f ×]. Mal orienter une mesure f de ψ, c'est verser f·sin ψ dans le
 * mauvais axe : enorme sous poussee, nul en chute libre, enorme de nouveau a
 * la rentree.
 */
export function attitudeError({ labels: L, sensors }) {
  // La norme de trois erreurs d'axe independantes d'ecart-type σ vaut en
  // moyenne σ·√(8/π) ≈ 1.6 σ — ce qui redonne bien les 0.8′ affiches par le
  // bandeau juste apres le decollage pour une centrale de classe navigation.
  const arcmin = (sensors?.imu?.alignment ?? 0.5) * 1.6;
  const psi = (arcmin / 60) * DEG;

  const cx = 66, cy = 172, len = 96;
  const aTrue = 62 * DEG;
  const shown = Math.max(10 * DEG, Math.min(24 * DEG, psi * 800));
  const tip = [cx + len * Math.cos(aTrue), cy - len * Math.sin(aTrue)];
  const tipEst = [cx + len * Math.cos(aTrue + shown), cy - len * Math.sin(aTrue + shown)];
  const leakLen = 40;
  const leakEnd = [tip[0] + leakLen * Math.sin(aTrue), tip[1] + leakLen * Math.cos(aTrue)];

  const rows = [
    { key: 'phaseBoost', g: 4 },
    { key: 'phaseCoast', g: 0 },
    { key: 'phaseReentry', g: 35 },
  ];
  const xa = 244, xb = 350, xc = 456;
  const table = rows.map((r, i) => {
    const y = 96 + i * 24;
    return `${text(xa, y, esc(L[r.key]), { cls: 'fig-dim', size: 10.5 })}
      ${text(xb, y, `${fmtG(r.g)} g`, { anchor: 'end', cls: 'fig-truth', size: 10.5 })}
      ${text(xc, y, fmtLeak(r.g * G0 * Math.sin(psi)), { anchor: 'end', cls: 'fig-danger', size: 10.5 })}`;
  }).join('');

  return svg(`
    ${arrow(cx, cy, tip[0], tip[1], { cls: 'fig-truth' })}
    ${text(tip[0] + 6, tip[1] + 2, esc(L.trueAxis), { cls: 'fig-truth', size: 10 })}
    ${arrow(cx, cy, tipEst[0], tipEst[1], { cls: 'fig-est' })}
    ${text(tipEst[0] - 6, tipEst[1] - 6, esc(L.believedAxis), { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${arc(cx, cy, 56, aTrue, aTrue + shown, { cls: 'fig-danger' })}
    ${text(cx + 20, cy - 62, 'ψ', { cls: 'fig-danger', size: 12 })}
    ${arrow(tip[0], tip[1], leakEnd[0], leakEnd[1], { cls: 'fig-danger' })}
    ${text(leakEnd[0] + 6, leakEnd[1] + 4, 'f·sin ψ', { cls: 'fig-danger', size: 10.5 })}
    ${text(20, 206, `ψ = ${arcmin.toFixed(2)}′`, { cls: 'fig-est', size: 11 })}
    ${text(xa, 72, esc(L.phase), { cls: 'fig-dim', size: 9.5 })}
    ${text(xb, 72, esc(L.force), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(xc, 72, esc(L.leak), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${line(xa, 78, xc, 78, { cls: 'fig-dim' })}
    ${table}
    ${text(xc, 186, esc(L.note), { anchor: 'end', cls: 'fig-dim', size: 10 })}
    ${text(xc, 206, esc(L.caption), { anchor: 'end', cls: 'fig-dim', size: 10 })}
  `);
}

export default {
  altitudeProfile, speedProfile, machRegimes, dynamicPressure,
  accelProfile, flightPathAngle, greatCircle, truthVsEstimate, attitudeError,
};
