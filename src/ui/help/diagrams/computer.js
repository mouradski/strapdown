// Schemas du calculateur de bord.
//
// Le fil conducteur des quatre : ce que le bord CROIT n'est pas ce qui EST, et
// tout ce que le calculateur decide est decide sur la croyance. Le premier
// schema pose la frontiere, les trois autres montrent trois facons de la payer.

import {
  svg, text, polyline, curve, arrow, line, dot, rect, ground, legend, esc,
} from '../svg.js';
import { EARTH, G0 } from '../../../core/constants.js';

// Deplacement du point d'impact par m/s d'impulsion, mesure par propagation
// (voir predictImpact) sur un tir bal2 de 1912 km : 456 m a l'apogee,
// 868 m a l'extinction — une impulsion vaut presque deux fois plus tot.
const KM_PER_MS_APOGEE = 0.456;
const M_PER_MS_APOGEE = 456;
const M_PER_MS_CUTOFF = 868;
// Acceleration du bloc de correction (voir world.js).
const BURN_ACCEL = 4;
// Bornes du curseur de reserve (voir main.js).
const DV_MAX = 400;

/** Deux traits croises, pour barrer un lien. */
function crossMark(x, y, r = 7, cls = 'fig-danger') {
  return `${line(x - r, y - r, x + r, y + r, { cls })}${line(x - r, y + r, x + r, y - r, { cls })}`;
}

/** Ellipse fermee, tracee point par point : la boite a outils n'en a pas. */
function ellipse(cx, cy, rx, ry, opts = {}) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * 2 * Math.PI;
    pts.push([cx + rx * Math.cos(a), cy - ry * Math.sin(a)]);
  }
  return polyline(pts, opts);
}

/**
 * La boucle de guidage, et la frontiere que la verite ne franchit jamais.
 *
 * Le schema le plus structurel du simulateur : en bas le monde physique, en
 * haut le calculateur. Une seule fleche monte — celle des capteurs, bruitee et
 * biaisee. Le lien direct qui rendrait le guidage juste est dessine barre :
 * dans le code, il n'existe simplement pas.
 */
export function guidanceLoop({ labels: L }) {
  const W = 96, H = 38, yTop = 34;
  const yBot = 150, yFront = 118;
  const cols = [16, 132, 248, 364];

  const top = [
    { x: cols[0], label: L.sensors, cls: 'fig-est' },
    { x: cols[1], label: L.filter, cls: 'fig-est' },
    { x: cols[2], label: L.estimate, cls: 'fig-est' },
    { x: cols[3], label: L.guidance, cls: 'fig-cmd' },
  ];
  const boxes = top.map((o) => `
    ${rect(o.x, yTop, W, H, { cls: `fig-box ${o.cls}-box`, rx: 6 })}
    ${text(o.x + W / 2, yTop + H / 2 + 4, esc(o.label), { anchor: 'middle', cls: o.cls, size: 10 })}`).join('');

  const links = [0, 1, 2].map((i) => arrow(cols[i] + W + 2, yTop + H / 2, cols[i + 1] - 2, yTop + H / 2, { cls: 'fig-est' })).join('');

  return svg(`
    ${rect(16, yBot, 140, H, { cls: 'fig-box fig-truth-box', rx: 6 })}
    ${text(86, yBot + H / 2 + 4, esc(L.truth), { anchor: 'middle', cls: 'fig-truth', size: 10.5 })}
    ${rect(364, yBot, W, H, { cls: 'fig-box fig-cmd-box', rx: 6 })}
    ${text(412, yBot + H / 2 + 4, esc(L.actuators), { anchor: 'middle', cls: 'fig-cmd', size: 10 })}
    ${boxes}
    ${links}

    ${/* la frontiere */ ''}
    ${line(14, yFront, 466, yFront, { cls: 'fig-dim', dash: '5 4' })}
    ${text(16, 24, esc(L.onboard), { cls: 'fig-dim', size: 10 })}
    ${text(16, 206, esc(L.world), { cls: 'fig-dim', size: 10 })}

    ${/* la seule remontee : la mesure, corrompue */ ''}
    ${arrow(64, yBot - 2, 64, yTop + H + 2, { cls: 'fig-truth' })}
    ${text(70, 96, esc(L.measured), { cls: 'fig-truth', size: 10 })}
    ${text(70, 110, esc(L.noisy), { cls: 'fig-danger', size: 9.5 })}

    ${/* la descente : les ordres, puis les forces */ ''}
    ${arrow(412, yTop + H + 2, 412, yBot - 2, { cls: 'fig-cmd' })}
    ${text(418, 96, esc(L.orders), { cls: 'fig-cmd', size: 10 })}
    ${arrow(362, yBot + H / 2, 158, yBot + H / 2, { cls: 'fig-cmd' })}
    ${text(260, 186, esc(L.forces), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}

    ${/* le lien qui n'existe pas */ ''}
    ${line(158, yBot, 366, yTop + H + 6, { cls: 'fig-danger', dash: '4 4' })}
    ${crossMark(250, yFront)}
    ${text(264, 136, esc(L.never), { cls: 'fig-danger', size: 9.5 })}

    ${text(240, 222, esc(L.caption), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `, { h: 232 });
}

/**
 * L'aplatissement de la Terre, et pourquoi un millieme devient des kilometres.
 *
 * L'ecart de gravite entre le modele masse ponctuelle et le modele J2 vaut
 * 1.5*J2 a l'equateur, soit 1.6e-3 — mais rapporte en micro-g c'est 1620 µg,
 * soit 65 fois le biais d'un accelerometre de classe navigation. La croissance
 * en 1/2.b.t² est la meme que celle d'un biais, et le schema les superpose.
 */
export function oblateness({ labels: L, sensors }) {
  const model = sensors?.gravityModel ?? 'j2';

  // Ecart relatif de |g| entre J2 et masse ponctuelle, a la surface.
  const relEq = 1.5 * EARTH.J2; // equateur : +1.62e-3
  const relPole = 3 * EARTH.J2 * (EARTH.a / EARTH.b) ** 2; // pole : -3.27e-3
  const gEq = EARTH.mu / (EARTH.a * EARTH.a);
  const bias = relEq * gEq; // [m/s²] — l'erreur de modele vue comme un biais
  const biasUg = bias / (1e-6 * G0);

  const T = 900;
  const eModel = (t) => 0.5 * bias * t * t;
  const eNav = (t) => 0.5 * 25e-6 * G0 * t * t; // biais accelerometrique classe navigation
  const box = { x: 68, y: 116, w: 344, h: 92 };
  const peak = Math.max(eModel(T), 1);

  // Croquis : la sphere que suppose le modele, l'ellipsoide reel.
  const cx = 52, cy = 50;
  const sketch = `
    ${ellipse(cx, cy, 34, 22, { cls: 'fig-truth' })}
    ${ellipse(cx, cy, 27, 27, { cls: 'fig-est', dash: '3 3' })}
    ${arrow(cx + 52, cy, cx + 38, cy, { cls: 'fig-danger' })}
    ${arrow(cx, cy - 40, cx, cy - 26, { cls: 'fig-danger' })}`;

  return svg(`
    ${sketch}
    ${text(96, 30, esc(L.sphere), { cls: 'fig-est', size: 10 })}
    ${text(96, 46, esc(L.real), { cls: 'fig-truth', size: 10 })}
    ${text(96, 68, `${esc(L.gravityGap)} : +${(relEq * 1e3).toFixed(2)}·10⁻³ / −${(relPole * 1e3).toFixed(2)}·10⁻³`, { cls: 'fig-danger', size: 10 })}
    ${text(96, 84, `= ${bias.toFixed(4)} m/s² ≡ ${biasUg.toFixed(0)} µg — ${esc(L.noSensor)}`, { cls: 'fig-danger', size: 10 })}

    ${curve(eModel, 0, T, box, { cls: 'fig-danger', yMax: peak, dash: model === 'point' ? null : '4 4' })}
    ${curve(eNav, 0, T, box, { cls: 'fig-est', yMax: peak })}
    ${line(box.x, box.y + box.h, box.x + box.w, box.y + box.h, { cls: 'fig-axis' })}
    ${line(box.x, box.y + box.h, box.x, box.y, { cls: 'fig-axis' })}
    ${text(box.x + box.w, box.y + box.h + 15, esc(L.time), { anchor: 'end', cls: 'fig-axis-label', size: 10 })}
    ${text(box.x - 4, box.y - 6, esc(L.error), { cls: 'fig-axis-label', size: 10 })}
    ${text(box.x + 10, box.y + 16, `${esc(L.j2Curve)} — ${(eModel(T) / 1000).toFixed(1)} km`, { cls: 'fig-danger', size: 10 })}
    ${text(box.x + box.w - 4, box.y + box.h - 8, `${esc(L.navCurve)} — ${eNav(T).toFixed(0)} m`, { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${text(box.x, box.y + box.h + 32, `${esc(L.currentModel)} : ${esc(model === 'point' ? L.modelPoint : L.modelJ2)}`, {
    cls: model === 'point' ? 'fig-danger' : 'fig-truth', size: 10.5,
  })}
    ${model === 'point' ? '' : text(box.x + 200, box.y + box.h + 32, esc(L.matches), { cls: 'fig-dim', size: 9.5 })}
    ${text(box.x, box.y + box.h + 50, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 268 });
}

/**
 * La fenetre de la correction mi-course, et ce qu'elle ne corrige pas.
 *
 * Condition du code : altEst > 120 km ET composante radiale de la vitesse sous
 * 2 % du module, soit une pente inferieure a 1.15° — quelques secondes avant
 * l'apogee. Le plancher d'altitude est franchi bien avant : c'est l'angle qui
 * decide. Les deux arcs montrent le reste : l'impulsion recale la trajectoire
 * CRUE sur l'objectif, et laisse l'ecart vrai ou il etait.
 */
export function midcourseWindow({ labels: L }) {
  const x0 = 44, x1 = 424, yG = 196, H = 142;
  const uFire = 0.46;
  // Derive deja presente avant le tir, puis ecart qui s'ouvre apres.
  const drift = (u) => (u <= uFire ? 5 : 5 + 27 * ((u - uFire) / (1 - uFire)) ** 2);
  const pt = (u, dx = 0) => [x0 + (x1 - x0) * u + dx, yG - H * 4 * u * (1 - u)];

  const trueArc = [], estArc = [];
  for (let i = 0; i <= 80; i++) {
    const u = i / 80;
    trueArc.push(pt(u));
    estArc.push(pt(u, drift(u)));
  }
  const [fx, fy] = pt(uFire);
  // Plancher d'emploi : 120 km rapportes a une apogee de 585 km.
  const yFloor = yG - H * (120 / 585);

  return svg(`
    ${ground(30, 466, yG)}
    ${rect(226, 38, 16, yG - 38, { cls: 'fig-band' })}
    ${line(30, yFloor, 466, yFloor, { cls: 'fig-dim', dash: '4 4' })}
    ${text(88, yFloor - 6, `${esc(L.altFloor)} — 120 km`, { cls: 'fig-dim', size: 9.5 })}

    ${polyline(trueArc, { cls: 'fig-truth' })}
    ${polyline(estArc, { cls: 'fig-est', dash: '4 3' })}

    ${legend(40, 24, [
    { cls: 'fig-truth', label: L.truth },
    { cls: 'fig-est', dash: '4 3', label: L.believed },
    { cls: 'fig-danger', label: L.target },
  ])}

    ${dot(fx, fy, { r: 4, cls: 'fig-cmd-fill' })}
    ${arrow(fx - 6, fy + 2, fx - 32, fy - 12, { cls: 'fig-cmd' })}
    ${text(fx - 38, fy - 14, 'Δv', { anchor: 'end', cls: 'fig-cmd', size: 11 })}
    ${text(252, 32, esc(L.windowLabel), { cls: 'fig-cmd', size: 10 })}
    ${text(252, 48, esc(L.fire), { cls: 'fig-dim', size: 9.5 })}

    ${dot(x1, yG, { r: 4, cls: 'fig-truth-fill' })}
    ${dot(x1 + 32, yG, { r: 4, cls: 'fig-danger-fill' })}
    ${line(x1, yG + 4, x1, yG + 18, { cls: 'fig-dim' })}
    ${line(x1 + 32, yG + 4, x1 + 32, yG + 18, { cls: 'fig-dim' })}
    ${arrow(x1, yG + 14, x1 + 32, yG + 14, { cls: 'fig-danger' })}
    ${arrow(x1 + 32, yG + 14, x1, yG + 14, { cls: 'fig-danger' })}
    ${text(x1 - 8, yG + 18, esc(L.gap), { anchor: 'end', cls: 'fig-danger', size: 10 })}

    ${text(240, 240, esc(L.caption), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `, { h: 250 });
}

/**
 * Ce qu'achete une reserve d'impulsion.
 *
 * Le curseur se lit en m/s ; ce qui compte est le deplacement d'impact que
 * cela represente. La conversion est mesuree, pas devinee : 1 m/s a l'apogee
 * vaut 456 m au sol. Mise en regard d'une erreur de navigation de quelques
 * kilometres, la reserve n'est jamais ce qui limite.
 */
export function impulseBudget({ labels: L, midcourse }) {
  const dv = Math.max(0, Math.min(DV_MAX, midcourse?.deltaV ?? 60));
  const reach = dv * KM_PER_MS_APOGEE;

  // Colonne de gauche : la reserve, en m/s.
  const xL = 44, wL = 34, yB = 152, hL = 110;
  const pyv = (v) => yB - (v / DV_MAX) * hL;
  const ticksV = [0, 200, 400].map((v) => `
    ${line(xL - 4, pyv(v), xL, pyv(v), { cls: 'fig-axis' })}
    ${text(xL - 8, pyv(v) + 3.5, String(v), { anchor: 'end', cls: 'fig-dim', size: 9 })}`).join('');

  // Barre de droite : le deplacement d'impact, en km.
  const xR0 = 166, xR1 = 452, KM_MAX = 200;
  const pxk = (km) => xR0 + (km / KM_MAX) * (xR1 - xR0);
  const ticksK = [0, 50, 100, 150, 200].map((k) => `
    ${line(pxk(k), 132, pxk(k), 137, { cls: 'fig-axis' })}
    ${text(pxk(k), 148, String(k), { anchor: 'middle', cls: 'fig-dim', size: 9 })}`).join('');

  const xReach = pxk(reach);

  return svg(`
    ${line(xL, pyv(DV_MAX), xL, yB, { cls: 'fig-axis' })}
    ${ticksV}
    ${rect(xL, pyv(dv), wL, yB - pyv(dv), { cls: 'fig-band' })}
    ${line(xL, pyv(dv), xL + wL, pyv(dv), { cls: 'fig-cmd' })}
    ${text(xL + wL / 2, pyv(dv) - 6, `${dv.toFixed(0)} m/s`, { anchor: 'middle', cls: 'fig-cmd', size: 10.5 })}
    ${text(xL + wL / 2, 168, esc(L.reserve), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}

    ${arrow(88, 100, 150, 100, { cls: 'fig-cmd' })}
    ${text(119, 92, `× ${KM_PER_MS_APOGEE.toFixed(2)} km`, { anchor: 'middle', cls: 'fig-cmd', size: 10 })}
    ${text(119, 116, esc(L.atApogee), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}

    ${line(xR0, 132, xR1, 132, { cls: 'fig-axis' })}
    ${ticksK}
    ${rect(xR0, 106, Math.max(1, xReach - xR0), 26, { cls: 'fig-band' })}
    ${rect(xR0, 106, Math.max(2, pxk(2) - xR0), 26, { cls: 'fig-danger-fill' })}
    ${line(xReach, 106, xReach, 132, { cls: 'fig-cmd' })}
    ${text(xReach + 5, 100, `${reach.toFixed(0)} km`, { anchor: xReach > 380 ? 'end' : 'start', cls: 'fig-cmd', size: 10.5 })}
    ${line(xR0 + 3, 106, 196, 74, { cls: 'fig-dim' })}
    ${text(200, 72, esc(L.navError), { cls: 'fig-danger', size: 9.5 })}
    ${text(xR1, 162, esc(L.reach), { anchor: 'end', cls: 'fig-axis-label', size: 9.5 })}

    ${text(20, 186, `${esc(L.perMs)} — ${M_PER_MS_APOGEE} m / ${M_PER_MS_CUTOFF} m`, { cls: 'fig-dim', size: 10 })}
    ${text(20, 202, `${esc(L.burn)} — ${(dv / BURN_ACCEL).toFixed(0)} s`, { cls: 'fig-dim', size: 10 })}
    ${text(240, 218, esc(L.caption), { anchor: 'middle', cls: 'fig-dim', size: 10 })}
  `, { h: 228 });
}

/**
 * Geometrie du declenchement en altitude.
 *
 * Le propos tient en un triangle : sur une trajectoire inclinee, quitter le
 * sol de h metres, c'est reculer le point de fonctionnement de h/tan(pente)
 * metres. Viser le sol en declenchant en l'air fait donc fonctionner AVANT la
 * cible, toujours du meme cote.
 */
export function burstGeometry({ labels: L, fuze }) {
  const x0 = 60, x1 = 430, sol = 176;
  const h = Math.max(0, Math.min(5000, fuze?.height ?? 1500));
  // Pente de rentree typique, exageree pour rester lisible.
  const pente = 34 * (Math.PI / 180);
  // Hauteur a l'ecran : 3000 m occupent 96 px.
  const hPix = Math.min(96, (h / 3000) * 96);
  const recul = hPix / Math.tan(pente);
  const xCible = 356;
  const xBurst = xCible - recul;
  const yBurst = sol - hPix;
  const depart = { x: xBurst - 190, y: yBurst - 190 * Math.tan(pente) };

  return svg(`
    ${ground(x0, x1, sol)}
    ${line(depart.x, depart.y, xCible, sol, { cls: 'fig-truth', dash: '5 4' })}
    ${polyline([[depart.x, depart.y], [xBurst, yBurst]], { cls: 'fig-truth' })}
    ${dot(xCible, sol, { r: 4, cls: 'fig-danger-fill' })}
    ${text(xCible + 8, sol + 4, esc(L.target), { cls: 'fig-danger', size: 10.5 })}
    ${hPix > 3 ? `
      ${dot(xBurst, yBurst, { r: 4.5, cls: 'fig-est-fill' })}
      ${line(xBurst, yBurst, xBurst, sol, { cls: 'fig-est', dash: '3 3' })}
      ${text(xBurst - 6, yBurst - 8, `${esc(L.burst)} ${h.toFixed(0)} m`, { anchor: 'end', cls: 'fig-est', size: 10.5 })}
      ${line(xBurst, sol + 16, xCible, sol + 16, { cls: 'fig-danger' })}
      ${text((xBurst + xCible) / 2, sol + 30, `${esc(L.shortfall)} ${(recul / hPix * h).toFixed(0)} m`, { anchor: 'middle', cls: 'fig-danger', size: 10.5 })}`
    : `${text(xCible - 10, sol - 10, esc(L.contact), { anchor: 'end', cls: 'fig-est', size: 10.5 })}`}
    ${text(x0, 210, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 224 });
}

export default {
  burstGeometry,
  guidanceLoop, oblateness, midcourseWindow, impulseBudget,
};
