// Schemas de l'altimetre.
//
// Fil conducteur des quatre figures : un altimetre ne corrige qu'UNE des trois
// dimensions, et sur un vecteur balistique il parle surtout lorsque la
// trajectoire est deja scellee. Les figures lisent les reglages courants
// (`ctx.sensors.altimeter`) : voir la tranche barometrique s'etendre ou le
// nuage de mesures se resserrer vaut mieux qu'une phrase.

import { svg, text, polyline, arrow, line, dot, rect, ground, esc } from '../svg.js';
import { atmosphere } from '../../../core/atmosphere.js';

const alt = (s) => s?.altimeter ?? {};
const num = (v, d) => (Number.isFinite(v) ? v : d);
const lbl = (L) => (k) => esc(L?.[k] ?? '');

/** Cadre en traits fins — `rect` remplit, ici on ne veut que le contour. */
const frame = (x, y, w, h) => `
  ${line(x, y, x + w, y)}${line(x, y + h, x + w, y + h)}
  ${line(x, y, x, y + h)}${line(x + w, y, x + w, y + h)}`;

/**
 * Chronologies MESUREES sur un tir par defaut (graine 42, portee 1912 km,
 * centrale de classe navigation) : intervalles pendant lesquels l'altimetre
 * repond effectivement. 'r' = radioaltimetre, 'b' = barometre.
 */
const TIMELINE = {
  bal: {
    T: 865, cutT: 113, cutAlt: 180,
    segs: [[0, 38, 'r'], [38, 52, 'b'], [846, 852, 'b'], [852, 865, 'r']],
  },
  glide: {
    T: 958,
    segs: [[0, 56, 'r'], [56, 79, 'b'], [441, 915, 'b'], [915, 958, 'r']],
  },
};

const silentShare = (tl) => {
  const on = tl.segs.reduce((s, [t0, t1]) => s + (t1 - t0), 0);
  return 1 - on / tl.T;
};

/**
 * Qui repond a quelle altitude, et QUAND sur la duree du vol.
 *
 * La bande du haut est reactive : elle suit les plafonds et les bruits reels
 * de la configuration. Les deux barres du bas opposent le vecteur balistique,
 * muet pendant 92 % du vol et deja scelle a l'extinction, au planeur qui vole
 * des minutes entieres dans la tranche exploitable.
 */
export function altimeterPair(ctx = {}) {
  const L = lbl(ctx.labels);
  const a = alt(ctx.sensors);
  const radarOn = a.radarEnabled !== false;
  const rMax = num(a.radarMaxAlt, 15000);
  const bMax = num(a.baroMaxAlt, 32000);
  const rSig = num(a.radarSigma, 8);
  const bSig = num(a.baroSigma, 120);
  const bBias = num(a.baroBias, 60);

  // --- bande des altitudes ---
  const x0 = 60, x1 = 444, aMax = 40000;
  const xa = (m) => x0 + ((x1 - x0) * Math.min(m, aMax)) / aMax;
  const yB = 30, hB = 26;
  const xr = radarOn ? xa(rMax) : x0;
  const xb = xa(bMax);

  const zone = (xs, xe, cls, key) => (xe - xs < 6 ? '' : `
    ${rect(xs, yB, xe - xs, hB, { cls: `fig-box ${cls}-box`, rx: 4 })}
    ${text((xs + xe) / 2, yB + hB / 2 + 4, L(key), { anchor: 'middle', cls, size: 10.5 })}`);

  const tick = (x, s) => `${line(x, yB + hB, x, yB + hB + 5)}
    ${text(x, yB + hB + 17, s, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}`;

  const notes = `
    ${radarOn && xr - x0 > 60 ? text((x0 + xr) / 2, 84, `σ ${rSig.toFixed(0)} m · ${L('noBias')}`, { anchor: 'middle', cls: 'fig-truth', size: 10 }) : ''}
    ${xb - xr > 90 ? text((xr + xb) / 2, 84, `σ ${bSig.toFixed(0)} m · ${L('bias')} ± ${bBias.toFixed(0)} m`, { anchor: 'middle', cls: 'fig-est', size: 10 }) : ''}`;

  // --- deux chronologies ---
  const tx0 = 104, tx1 = 452;
  const row = (tl, yTop) => {
    const px = (t) => tx0 + ((tx1 - tx0) * t) / tl.T;
    const blocks = tl.segs.map(([t0, t1, k]) => rect(
      px(t0), yTop + 2, Math.max(3, px(t1) - px(t0)), 10,
      { cls: k === 'r' ? 'fig-truth-fill' : 'fig-est-fill', rx: 1.5 },
    )).join('');
    // Le trou : entre la derniere montee et la premiere redescente.
    const gap = [tl.segs[1][1], tl.segs[2][0]];
    return `${frame(tx0, yTop, tx1 - tx0, 14)}${blocks}
      ${text((px(gap[0]) + px(gap[1])) / 2, yTop + 11, `${L('silent')} ${(silentShare(tl) * 100).toFixed(0)} %`,
    { anchor: 'middle', cls: 'fig-dim', size: 9 })}`;
  };

  const bal = TIMELINE.bal;
  const xCut = tx0 + ((tx1 - tx0) * bal.cutT) / bal.T;

  return svg(`
    ${text(x0, 20, L('whereTitle'), { cls: 'fig-dim', size: 10 })}
    ${zone(x0, xr, 'fig-truth', 'radar')}
    ${zone(xr, xb, 'fig-est', 'baro')}
    ${line(xb, yB, x1, yB, { cls: 'fig-dim', dash: '3 3' })}
    ${line(xb, yB + hB, x1, yB + hB, { cls: 'fig-dim', dash: '3 3' })}
    ${text((xb + x1) / 2, yB + hB / 2 + 4, L('silence'), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${tick(x0, '0')}${radarOn ? tick(xr, `${(rMax / 1000).toFixed(0)} km`) : ''}${tick(xb, `${(bMax / 1000).toFixed(0)} km`)}
    ${notes}

    ${text(x0 - 40, 98, L('whenTitle'), { cls: 'fig-dim', size: 10 })}
    ${text(98, 131, L('ballistic'), { anchor: 'end', cls: 'fig-dim', size: 10 })}
    ${row(bal, 120)}
    ${line(xCut, 108, xCut, 138, { cls: 'fig-danger' })}
    ${text(xCut + 4, 114, `${L('cutoff')} · ${bal.cutAlt} km`, { cls: 'fig-danger', size: 9.5 })}
    ${text(98, 177, L('glider'), { anchor: 'end', cls: 'fig-dim', size: 10 })}
    ${row(TIMELINE.glide, 166)}
    ${arrow(408, 156, 448, 138, { cls: 'fig-dim' })}
    ${text(404, 159, L('lastSeconds'), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(tx0, 202, L('steering'), { cls: 'fig-cmd', size: 10 })}
    ${text(tx0, 220, L('sealed'), { cls: 'fig-danger', size: 10 })}
  `);
}

/** Tirages pseudo-gaussiens reproductibles : la figure doit etre stable. */
function draws(n, seed) {
  let s = seed >>> 0;
  const u = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const out = [];
  for (let i = 0; i < n; i++) out.push((u() + u() + u() + u()) * 1.732);
  return out;
}

/**
 * Le bruit se moyenne. Chaque point est une mesure, la courbe est la moyenne
 * courante, et l'enveloppe en sigma/racine(n) montre a quelle vitesse elle
 * s'effondre. Le lisere vert autour de zero est la dispersion du
 * radioaltimetre, a la meme echelle : c'est la comparaison qui parle.
 */
export function baroNoise(ctx = {}) {
  const L = lbl(ctx.labels);
  const a = alt(ctx.sensors);
  const bSig = Math.max(1, num(a.baroSigma, 120));
  const rSig = Math.max(0.5, num(a.radarSigma, 8));
  const period = Math.max(0.05, num(a.period, 0.5));

  const bx = 66, bw = 380, mid = 92, half = 58;
  const k = half / (2.4 * bSig); // px par metre
  const n = 48;
  const e = draws(n, 8675309);

  const pts = [];
  let sum = 0;
  const mean = [], envUp = [], envDn = [];
  for (let i = 0; i < n; i++) {
    const x = bx + (bw * (i + 0.5)) / n;
    const v = e[i] * bSig;
    sum += v;
    const clamp = (y) => Math.max(mid - half - 4, Math.min(mid + half + 4, y));
    pts.push(dot(x, clamp(mid - k * v), { r: 1.7, cls: 'fig-est-fill' }));
    mean.push([x, clamp(mid - (k * sum) / (i + 1))]);
    envUp.push([x, mid - (k * bSig) / Math.sqrt(i + 1)]);
    envDn.push([x, mid + (k * bSig) / Math.sqrt(i + 1)]);
  }

  const rBand = Math.max(1.2, k * rSig);
  const nWin = 28; // mesures disponibles dans la tranche barometrique en montee

  return svg(`
    ${line(bx, mid - k * bSig, bx + bw, mid - k * bSig, { cls: 'fig-dim', dash: '4 4' })}
    ${line(bx, mid + k * bSig, bx + bw, mid + k * bSig, { cls: 'fig-dim', dash: '4 4' })}
    ${text(bx + bw, mid - k * bSig - 5, `± σ = ${bSig.toFixed(0)} m`, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${rect(bx, mid - rBand, bw, 2 * rBand, { cls: 'fig-band-truth', rx: 0 })}
    ${pts.join('')}
    ${polyline(envUp, { cls: 'fig-est', dash: '3 3' })}
    ${polyline(envDn, { cls: 'fig-est', dash: '3 3' })}
    ${polyline(mean, { cls: 'fig-est' })}
    ${line(bx, mid, bx + bw, mid, { cls: 'fig-truth' })}
    ${line(bx, 158, bx, 26, { cls: 'fig-axis' })}
    ${text(bx - 4, 20, L('axisErr'), { cls: 'fig-axis-label', size: 10 })}
    ${text(bx + bw, mid + 16, L('axisN'), { anchor: 'end', cls: 'fig-axis-label', size: 10 })}
    ${text(bx + 6, mid - 9, L('truth'), { cls: 'fig-truth', size: 10 })}
    ${arrow(bx + 118, 138, bx + 92, mid + rBand + 2, { cls: 'fig-truth' })}
    ${text(bx + 122, 141, `${L('radar')} · σ ${rSig.toFixed(0)} m`, { cls: 'fig-truth', size: 10 })}
    ${text(bx, 180, `${L('baro')} · σ ${bSig.toFixed(0)} m · ${(1 / period).toFixed(0)} Hz`, { cls: 'fig-est', size: 10.5 })}
    ${text(bx, 198, `${L('mean')} (n = ${nWin}) : ± ${(bSig / Math.sqrt(nWin)).toFixed(0)} m`, { cls: 'fig-est', size: 10.5 })}
    ${text(bx, 218, L('collapse'), { cls: 'fig-dim', size: 10 })}
  `);
}

/**
 * D'ou vient le BIAIS : le barometre mesure une pression et l'inverse par
 * l'atmosphere standard. L'atmosphere du jour n'est pas celle-la, et la meme
 * pression designe alors deux altitudes differentes. L'ecart est dessine
 * exagere — un pour cent de pression ne se verrait pas.
 */
export function atmosphereDeviation(ctx = {}) {
  const L = lbl(ctx.labels);
  const a = alt(ctx.sensors);
  const bias = num(a.baroBias, 60);

  const X0 = 74, X1 = 424, Y0 = 168, Y1 = 36, zMax = 30000;
  const LO = 500, HI = 101325;
  const lg = Math.log10(HI) - Math.log10(LO);
  const xp = (p) => X0 + ((X1 - X0) * (Math.log10(HI) - Math.log10(Math.max(p, LO)))) / lg;
  const yz = (z) => Y0 - ((Y0 - Y1) * z) / zMax;

  const SHOWN = 5000; // decalage dessine, tres exagere devant les 60 m reels
  const std = [], real = [];
  for (let i = 0; i <= 40; i++) {
    const z = (zMax * i) / 40;
    std.push([xp(atmosphere(z).p), yz(z)]);
    real.push([xp(atmosphere(z + SHOWN).p), yz(z)]);
  }

  const zRead = 12000;
  const pRead = atmosphere(zRead).p;
  const xRead = xp(pRead);
  const yBelieved = yz(zRead);
  const yTrue = yz(zRead - SHOWN);

  const decade = (p, s) => `${line(xp(p), Y0, xp(p), Y0 + 5)}
    ${text(xp(p), Y0 + 17, s, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}`;
  const level = (z, s) => `${line(X0 - 5, yz(z), X0, yz(z))}
    ${text(X0 - 9, yz(z) + 3.5, s, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}`;

  // Hauteur d'echelle de l'atmosphere vers 10-12 km : c'est elle qui convertit
  // un pourcentage de pression en metres.
  const H = 6500;

  return svg(`
    ${line(X0, Y0, X1, Y0, { cls: 'fig-axis' })}
    ${line(X0, Y0, X0, Y1 - 6, { cls: 'fig-axis' })}
    ${decade(100000, '100 kPa')}${decade(10000, '10 kPa')}${decade(1000, '1 kPa')}
    ${level(0, '0')}${level(15000, '15 km')}${level(30000, '30 km')}
    ${text(X1 - 4, Y0 - 10, L('axisP'), { anchor: 'end', cls: 'fig-axis-label', size: 10 })}
    ${text(X0 - 4, Y1 - 14, L('axisH'), { cls: 'fig-axis-label', size: 10 })}
    ${polyline(std, { cls: 'fig-est' })}
    ${polyline(real, { cls: 'fig-truth' })}
    ${line(xRead, Y0, xRead, Y1, { cls: 'fig-dim', dash: '3 3' })}
    ${text(xRead - 5, Y1 + 4, L('measured'), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${dot(xRead, yBelieved, { r: 3.2, cls: 'fig-est-fill' })}
    ${dot(xRead, yTrue, { r: 3.2, cls: 'fig-truth-fill' })}
    ${arrow(xRead, yTrue, xRead, yBelieved, { cls: 'fig-danger' })}
    ${arrow(xRead, yBelieved, xRead, yTrue, { cls: 'fig-danger' })}
    ${text(xRead - 8, (yTrue + yBelieved) / 2 + 4, L('bias'), { anchor: 'end', cls: 'fig-danger', size: 10.5 })}
    ${text(std[20][0] - 8, std[20][1] - 4, L('standard'), { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${text(real[20][0] + 8, real[20][1] + 12, L('real'), { cls: 'fig-truth', size: 10 })}
    ${text(X0, 196, `${L('setting')} : ± ${bias.toFixed(0)} m ≈ ${((100 * bias) / H).toFixed(1)} % ${L('ofPressure')}`, { cls: 'fig-danger', size: 10.5 })}
    ${text(X0, 214, L('exaggerated'), { cls: 'fig-dim', size: 10 })}
  `, { h: 230 });
}

/**
 * La portee du radioaltimetre est une DUREE : la tranche divisee par la
 * vitesse verticale. Le corps de rentree la traverse en une douzaine de
 * secondes, apres l'extinction ; le planeur y reste des dizaines de secondes,
 * et lui pilote encore.
 */
export function radarReach(ctx = {}) {
  const L = lbl(ctx.labels);
  const a = alt(ctx.sensors);
  const on = a.radarEnabled !== false;
  const rMax = num(a.radarMaxAlt, 15000);
  const period = Math.max(0.05, num(a.period, 0.5));
  const isGlider = Boolean(ctx.veh?.glide);

  const yG = 180, yTop = 104;
  const cols = [
    { x: 46, w: 176, vz: 1200, key: 'ballistic', state: 'noSteer', cls: 'fig-danger', active: !isGlider },
    { x: 258, w: 176, vz: 350, key: 'glider', state: 'steering', cls: 'fig-cmd', active: isGlider },
  ];

  const body = cols.map((c) => {
    const t = rMax / c.vz;
    const n = Math.round(t / period);
    const cx = c.x + c.w / 2;
    const path = c.vz > 800
      ? arrow(c.x + 104, 52, c.x + 150, yG, { cls: 'fig-truth' })
      : arrow(c.x + 4, 74, c.x + 172, yG, { cls: 'fig-truth' });
    return `
      ${rect(c.x, yTop, c.w, yG - yTop, { cls: on ? 'fig-band-truth' : 'fig-band', rx: 3 })}
      ${line(c.x, yTop, c.x + c.w, yTop, { cls: on ? 'fig-truth' : 'fig-dim', dash: '4 3' })}
      ${path}
      ${text(cx, 198, L(c.key), { anchor: 'middle', cls: 'fig-dim', size: 10.5 })}
      ${c.active ? line(cx - 36, 203, cx + 36, 203, { cls: 'fig-est' }) : ''}
      ${text(cx, 218, `${L('vspeed')} ${c.vz} m/s`, { anchor: 'middle', cls: 'fig-dim', size: 10 })}
      ${text(cx, 234, `${t.toFixed(0)} s · ${n} ${L('readings')}`, { anchor: 'middle', cls: 'fig-truth', size: 10.5 })}
      ${text(cx, 250, L(c.state), { anchor: 'middle', cls: c.cls, size: 10 })}`;
  }).join('');

  return svg(`
    ${body}
    ${ground(30, 450, yG)}
    ${text(38, yTop - 8, `${(rMax / 1000).toFixed(0)} km — ${L('band')}`, { cls: 'fig-truth', size: 10 })}
    ${arrow(150, 50, 150, 24, { cls: 'fig-danger', dash: '3 3' })}
    ${text(158, 30, L('cutoffAbove'), { cls: 'fig-danger', size: 9.5 })}
    ${on ? '' : text(240, 18, L('off'), { anchor: 'middle', cls: 'fig-dim', size: 10.5 })}
  `, { h: 260 });
}

export default {
  altimeterPair, baroNoise, atmosphereDeviation, radarReach,
};
