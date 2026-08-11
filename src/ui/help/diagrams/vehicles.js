// Schemas des trois vecteurs.
//
// Le fil conducteur est le meme dans les trois : ou se joue la precision.
// Pour un balistique, tout est scelle a l'extinction et l'ecart final n'est
// que l'erreur de navigation d'alors, amplifiee par la geometrie du tir. Pour
// le planeur, rien n'est scelle : il manoeuvre jusqu'au bout.
//
// Les profils dessines sont cales sur des vols reellement simules (portee
// 2890 km pour le vecteur A, 4925 km pour le vecteur C, centrale de classe
// navigation), et les constantes du planeur sont lues dans le modele lui-meme.

import {
  svg, axes, text, polyline, curve, arrow, line, dot, circle, rect, legend, ground, esc,
} from '../svg.js';
import { VEHICLES, bestGlideAoA, glideCoefficients } from '../../../sim/vehicle.js';

const EARTH_R = 6371008.8;
const MU = 3.986004418e14;

/**
 * Profil d'altitude normalise d'un arc balistique.
 * L'exposant 0.62 cale la courbe sur le vol mesure du vecteur A : 25 % de
 * l'apogee des 3 % de portee franchis, 86 % a 29 %. Une parabole, elle,
 * monterait beaucoup trop mollement au depart.
 */
const bellShape = (u) => Math.sin(Math.PI * u) ** 0.62;

/** Vitesse d'une trajectoire d'energie minimale de portee R [m/s]. */
function minEnergySpeed(R) {
  if (!(R > 0)) return 0;
  const s = Math.sin(R / EARTH_R / 2);
  return Math.sqrt((MU / EARTH_R) * ((2 * s) / (1 + s)));
}

/** Angle de portee d'un tir de vitesse v et de pente gamma [rad]. */
function rangeAngle(v, gammaDeg) {
  const g = (gammaDeg * Math.PI) / 180;
  const lam = (v * v * EARTH_R) / MU;
  return 2 * Math.atan2(lam * Math.sin(g) * Math.cos(g), 1 - lam * Math.cos(g) * Math.cos(g));
}

/**
 * Metres de portee gagnes par m/s supplementaire a l'extinction, sur Terre
 * spherique, a la pente d'energie minimale (45 - psi/4). Verifie contre le
 * simulateur : 743 m predits contre 702 mesures a 1060 km, 8172 contre 8220
 * a 11 795 km.
 */
function rangeSensitivity(R) {
  if (!(R > 0)) return 0;
  const gamma = 45 - ((R / EARTH_R) * (180 / Math.PI)) / 4;
  const v = minEnergySpeed(R);
  const d = 0.5;
  return ((rangeAngle(v + d, gamma) - rangeAngle(v - d, gamma)) * EARTH_R) / (2 * d);
}

/** La regle de pouce, exacte sur Terre plate. */
const flatRule = (R) => (R > 1000 ? (2 * R) / minEnergySpeed(R) : 0);

/**
 * Vecteur A : la cloche balistique, et le point unique ou tout se decide.
 *
 * L'extinction tombe a 3 % de la portee et 11 % du temps de vol ; tout le
 * reste est une ellipse figee. Le second arc montre ce que devient 1 m/s
 * d'erreur a cet instant.
 */
export function trajectoryBallistic({ labels: L }) {
  const X0 = 46, X1 = 436, GY = 176, H = 120;
  const uCut = 0.03, EXT = 22;

  const nomX = (u) => X0 + (X1 - X0) * u;
  const nomY = (u) => GY - H * bellShape(u);
  // L'arc perturbe part exactement du point d'extinction et s'en ecarte
  // progressivement : c'est bien la coupure qui fait diverger, pas le tir.
  const k = (u) => (u - uCut) / (1 - uCut);
  const pertX = (u) => nomX(u) + EXT * k(u);
  const pertY = (u) => GY - H * bellShape(u) * (1 + 0.045 * k(u));

  const sample = (fx, fy, a, b, n = 90) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = a + ((b - a) * i) / n;
      pts.push([fx(u), fy(u)]);
    }
    return pts;
  };

  const cutX = nomX(uCut), cutY = nomY(uCut);

  return svg(`
    ${polyline(sample(nomX, nomY, uCut, 1), { cls: 'fig-truth' })}
    ${polyline(sample(pertX, pertY, uCut, 1), { cls: 'fig-danger', dash: '4 3' })}
    ${polyline(sample(nomX, nomY, 0, uCut, 12), { cls: 'fig-cmd', width: 3 })}
    ${ground(24, 464, GY)}
    ${dot(cutX, cutY, { r: 4, cls: 'fig-est-fill' })}
    ${line(cutX + 3, cutY + 3, 106, 150, { cls: 'fig-dim' })}
    ${text(110, 153, esc(L.cutoff), { cls: 'fig-est', size: 11 })}
    ${text(110, 167, esc(L.cutoffNote), { cls: 'fig-dim', size: 9.5 })}
    ${text(241, 78, `${esc(L.apogee)} 797 km`, { anchor: 'middle', cls: 'fig-truth', size: 10.5 })}
    ${text(241, 102, esc(L.sealed), { anchor: 'middle', cls: 'fig-dim', size: 10.5 })}
    ${text(241, 117, esc(L.sealedNote), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${dot(X1, GY, { r: 4, cls: 'fig-danger-fill' })}
    ${text(X1 - 8, GY - 8, esc(L.target), { anchor: 'end', cls: 'fig-danger', size: 10 })}
    ${line(X1, GY - 13, X1 + EXT, GY - 13, { cls: 'fig-danger' })}
    ${line(X1, GY - 17, X1, GY - 9, { cls: 'fig-danger' })}
    ${line(X1 + EXT, GY - 17, X1 + EXT, GY - 9, { cls: 'fig-danger' })}
    ${text(16, 198, esc(L.exaggerated), { cls: 'fig-dim', size: 9.5 })}
    ${text(466, 198, `+1 m/s ${esc(L.atCutoff)} → +1.4 km`, { anchor: 'end', cls: 'fig-danger', size: 10.5 })}
    ${text(240, 218, esc(L.caption), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Vecteur B : le prix de la portee.
 *
 * La sensibilite de la portee a la vitesse d'extinction ne croit pas comme la
 * portee, mais bien plus vite. La regle de pouce 2R/v, exacte sur Terre plate,
 * devient franchement optimiste au-dela de 5000 km — et c'est precisement le
 * domaine du vecteur B.
 */
export function trajectoryRange({ labels: L }) {
  const box = { x: 60, y: 34, w: 350, h: 124 };
  const Rmax = 13500e3, yMax = 11000;
  const px = (R) => box.x + (box.w * R) / Rmax;
  const py = (v) => box.y + box.h - box.h * Math.min(1, v / yMax);

  // Tirs reellement mesures dans le simulateur (portee, m de portee par m/s).
  const shots = [[1060e3, 702], [1912e3, 1049], [2890e3, 1446], [6357e3, 3098], [11795e3, 8220]];

  const grid = [5000, 10000].map((v) => `
    ${line(box.x, py(v), box.x + box.w, py(v), { cls: 'fig-dim', dash: '2 4' })}
    ${text(box.x - 6, py(v) + 3.5, `${v / 1000} km`, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}`).join('');

  const ticks = [4000e3, 8000e3, 12000e3].map((R) => `
    ${line(px(R), box.y + box.h, px(R), box.y + box.h + 4, { cls: 'fig-axis' })}
    ${text(px(R), box.y + box.h + 15, `${R / 1000}`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}`).join('');

  // Le trait ne monte que jusqu'a la courbe : au-dessus il ne dirait rien et
  // traverserait la legende.
  const limit = (R, label) => {
    const top = Math.max(box.y - 6, py(rangeSensitivity(R)) - 18);
    return `
      ${line(px(R), top, px(R), box.y + box.h, { cls: 'fig-dim', dash: '3 4' })}
      ${text(px(R), top - 5, esc(label), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}`;
  };

  const dots = shots.map(([R, v]) => circle(px(R), py(v), 3, { cls: 'fig-truth' })).join('');

  const rFull = 13000e3;
  return svg(`
    ${grid}
    ${limit(3600e3, L.vehA)}
    ${limit(rFull, L.vehB)}
    ${axes(box.x, box.y + box.h, box.x + box.w + 24, box.y - 10, { yLabel: L.sensitivity })}
    ${ticks}
    ${curve(flatRule, 0, Rmax, box, { cls: 'fig-dim', dash: '4 3', yMax, n: 80 })}
    ${curve(rangeSensitivity, 0, Rmax, box, { cls: 'fig-danger', yMax, n: 80 })}
    ${dots}
    ${circle(78, 50, 3, { cls: 'fig-truth' })}
    ${text(92, 53.5, esc(L.measured), { cls: 'fig-dim', size: 10 })}
    ${legend(70, 66, [
    { cls: 'fig-danger', label: L.real },
    { cls: 'fig-dim', dash: '4 3', label: L.flatRule },
  ])}
    ${text(box.x + box.w / 2, box.y + box.h + 32, esc(L.range), { anchor: 'middle', cls: 'fig-axis-label', size: 10 })}
    ${text(box.x, box.y + box.h + 50, `${esc(L.at)} 13 000 km — 2R/v : ${(flatRule(rFull) / 1000).toFixed(1)} km · ${esc(L.real)} : ${(rangeSensitivity(rFull) / 1000).toFixed(1)} km`, { cls: 'fig-dim', size: 10 })}
    ${text(box.x, box.y + box.h + 66, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * Vecteur C : la meme portee, mais a plat.
 *
 * Deux echelles d'altitude superposees. En haut, la cloche du vecteur A monte
 * a 797 km tandis que tout le vol du planeur tient dans la bande basse ; en
 * bas, cette bande est dilatee et l'on voit la ressource, l'oscillation
 * phugoide et le plane qui descend lentement jusqu'a la piquee finale.
 */
export function trajectoryGlide({ labels: L }) {
  const PX0 = 78, PX1 = 452;
  const yT = 120, hT = 94, TOP_SCALE = 800; // panneau haut : 0 → 800 km
  const yB = 272, hB = 94, BOT_SCALE = 180; // panneau bas : 0 → 180 km

  const px = (pct) => PX0 + ((PX1 - PX0) * pct) / 100;
  const yTop = (alt) => yT - (hT * alt) / TOP_SCALE;
  const yBot = (alt) => yB - (hB * alt) / BOT_SCALE;

  // Profil mesure du planeur : % de portee parcourue, altitude [km].
  const PROFILE = [
    [0, 0], [1, 55], [8, 141], [18, 167], [28, 141], [38, 62], [47, 55], [55, 62],
    [63, 37], [70, 47], [77, 37], [83, 39], [88, 35], [92, 33], [95, 29], [98, 25], [100, 0],
  ];

  const bell = (u) => 797 * bellShape(u);
  const bellPts = (fy, a, b, n = 80) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = a + ((b - a) * i) / n;
      pts.push([px(u * 100), fy(bell(u))]);
    }
    return pts;
  };
  const glidePts = (fy) => PROFILE.map(([p, a]) => [px(p), fy(a)]);

  // Le vecteur A quitte le cadre du bas des que son altitude depasse 180 km.
  const uOut = Math.asin((180 / 797) ** (1 / 0.62)) / Math.PI;

  const g = VEHICLES.glide;
  const pullUpKm = (g?.glide?.pullUpAlt ?? 62000) / 1000;
  const aoa = bestGlideAoA(g);
  const c = glideCoefficients(g, aoa);
  const ld = c.cd > 0 ? c.cl / c.cd : 0;
  const loading = (g?.payloadMass ?? 1400) / (g?.rv?.refArea ?? 4);

  return svg(`
    ${rect(72, yTop(BOT_SCALE), PX1 + 6 - 72, yT - yTop(BOT_SCALE), { cls: 'fig-band', rx: 2 })}
    ${axes(72, yT, PX1 + 16, 26, { yLabel: `${L.altitude} 0 → ${TOP_SCALE} km` })}
    ${polyline(bellPts(yTop, 0, 1), { cls: 'fig-truth' })}
    ${polyline(glidePts(yTop), { cls: 'fig-cmd' })}
    ${text(268, 72, esc(L.vehA), { anchor: 'middle', cls: 'fig-truth', size: 11 })}
    ${text(268, 88, esc(L.vehANote), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}

    ${arrow(240, 126, 240, 168, { cls: 'fig-dim' })}
    ${text(250, 152, esc(L.zoom), { cls: 'fig-dim', size: 9.5 })}

    ${axes(72, yB, PX1 + 16, 176, { xLabel: L.rangeFlown, yLabel: `${L.altitude} 0 → ${BOT_SCALE} km` })}
    ${polyline(bellPts(yBot, 0, uOut, 14), { cls: 'fig-truth' })}
    ${polyline(bellPts(yBot, 1 - uOut, 1, 14), { cls: 'fig-truth' })}
    ${text(82, 252, esc(L.offScale), { cls: 'fig-truth', size: 9.5 })}
    ${polyline(glidePts(yBot), { cls: 'fig-cmd' })}
    ${text(px(18), yBot(167) - 7, `${esc(L.apogee)} 167 km`, { anchor: 'middle', cls: 'fig-cmd', size: 10 })}
    ${dot(px(38), yBot(pullUpKm), { r: 3.5, cls: 'fig-est-fill' })}
    ${line(px(38), yBot(pullUpKm) + 5, px(38), 256, { cls: 'fig-dim' })}
    ${text(px(38) + 6, 260, `${esc(L.pullUp)} ${pullUpKm.toFixed(0)} km · 5110 m/s`, { cls: 'fig-cmd', size: 9.5 })}
    ${text(px(65), 194, esc(L.vehC), { anchor: 'middle', cls: 'fig-cmd', size: 11 })}
    ${text(px(65), 210, `${esc(L.glideNote)} ${ld.toFixed(1)} — ${loading.toFixed(0)} kg/m²`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(px(65), 226, esc(L.steering), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}

    ${text(8, 296, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 304 });
}

export default { trajectoryBallistic, trajectoryRange, trajectoryGlide };
