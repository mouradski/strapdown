// Schemas du groupe terrain.
//
// La correlation de terrain est le seul capteur du simulateur qui rende une
// POSITION. Ces schemas servent donc tous la meme idee : le decalage qui fait
// coincider le profil mesure et la carte embarquee EST l'erreur de navigation,
// et la nettete de cette coincidence ne se regle pas — elle depend du relief.
//
// Trois d'entre eux rejouent une correlation reduite a une dimension, sur un
// relief synthetique construit comme celui de core/terrain.js : bruit de
// valeur, interpolation quintique, octaves a gain 0.5. Les courbes du bas ne
// sont pas dessinees a la main — la somme des ecarts quadratiques y est
// reellement calculee, et ses minima sont ceux que produit le mecanisme.

import { svg, axes, text, polyline, arrow, line, dot, band, legend, rect, esc } from '../svg.js';

// --- Relief synthetique, meme recette que core/terrain.js -------------------

/** Hachage entier -> [0, 1). Deterministe : la figure ne bouge pas d'une ouverture a l'autre. */
function hash1(i, seed) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bruit de valeur a une dimension, interpolation quintique. */
function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u;
}

/** Somme d'octaves a gain 0.5 : signature en 1/f des reliefs naturels. */
function fbm1(x, octaves, seed) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let k = 0; k < octaves; k++) {
    sum += amp * (noise1(x * freq, seed + k * 1013) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Relief centre, ecart-type unite, x en kilometres. */
const relief = (xKm, seed = 31) => clamp(fbm1(xKm / 2.6, 5, seed) * 3.2, -2.6, 2.6);

/**
 * Variante a cretes regulieres — la campagne en rides et vallons paralleles,
 * cas classique de l'ambiguite : toutes les rides se ressemblent.
 */
const RIDGE_KM = 1.9;
const ridged = (xKm, seed = 31) => relief(xKm, seed) + 1.1 * Math.sin((2 * Math.PI * xKm) / RIDGE_KM);

/** Carte embarquee : le relief plus une erreur LENTE, de longueur d'onde kilometrique. */
const mapErrorOf = (xKm, seed = 31) => fbm1(xKm / 3.1, 2, seed + 4242) * 3.2;

/** Bruit blanc reproductible. */
function makeNoise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

/**
 * Somme des ecarts quadratiques entre un profil mesure et la carte, decalage
 * par decalage. Les deux profils sont centres, exactement comme le fait
 * TerrainCorrelator : un biais d'altitude commun n'influe pas sur le resultat.
 * On rend la MOYENNE des carres, pour que deux longueurs de profil restent
 * comparables.
 */
function ssdCurve(ground, x0, n, stepKm, meas, offsets, mapErr) {
  const mMeas = meas.reduce((a, b) => a + b, 0) / n;
  return offsets.map((d) => {
    const pred = [];
    let mean = 0;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * stepKm + d;
      const v = ground(x) + mapErr * mapErrorOf(x);
      pred.push(v);
      mean += v;
    }
    mean /= n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const r = (pred[i] - mean) - (meas[i] - mMeas);
      sum += r * r;
    }
    return sum / n;
  });
}

/** Profil mesure : le relief vrai sous la position VRAIE, plus le bruit du radar. */
function measured(ground, x0, n, stepKm, trueOffset, noiseAmp, rndSeed = 777) {
  const rnd = makeNoise(rndSeed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(ground(x0 + i * stepKm + trueOffset) + noiseAmp * rnd());
  return out;
}

/** Minima locaux nettement marques, sur une courbe normalisee a son propre creux. */
function deepMinima(vals, offsets, threshold = 0.12) {
  const hi = Math.max(...vals), lo = Math.min(...vals);
  const span = Math.max(1e-9, hi - lo);
  const out = [];
  for (let i = 2; i < vals.length - 2; i++) {
    if (vals[i] <= vals[i - 1] && vals[i] <= vals[i + 1] && (vals[i] - lo) / span < threshold) {
      out.push({ d: offsets[i], v: vals[i] });
    }
  }
  return out;
}

/**
 * Centre et normalise une portion de relief pour le DESSIN : sur six ou huit
 * kilometres, un fragment de bruit fractal peut se trouver entierement d'un
 * cote de sa moyenne, et la figure paraitrait plate sans que le relief le soit.
 * Les valeurs affichees, elles, restent celles du texte.
 */
function shape(f, xa, xb, count) {
  const v = [];
  for (let i = 0; i <= count; i++) v.push(f(xa + ((xb - xa) * i) / count));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const rms = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1;
  return { mean, rms, u: v.map((x) => (x - mean) / rms) };
}

/** Crochet horizontal : une longueur de profil reportee sur le relief. */
const bracket = (xa, xb, y, cls) => `
  ${line(xa, y, xb, y, { cls })}
  ${line(xa, y - 4, xa, y + 4, { cls })}
  ${line(xb, y - 4, xb, y + 4, { cls })}`;

const fmt = (v, d = 0) => v.toFixed(d);

// ---------------------------------------------------------------------------

/**
 * Le principe meme du recalage par le relief.
 *
 * Trois etages relies par une seule verticale : le radioaltimetre sonde le sol
 * sous la position VRAIE, le calculateur range la mesure en face de la position
 * qu'il CROIT occuper, et le decalage qui fait coincider les deux profils est
 * exactement l'ecart entre les deux. La courbe du bas est calculee : son
 * minimum tombe sous le bon calage, et c'est tout le mecanisme.
 */
export function tercomPrinciple({ labels: L }) {
  const kmPx = 26;
  const stepKm = 0.12;
  const n = 50;
  const x0 = 4.0;
  const trueOffsetKm = 2.6; // erreur de navigation, exageree pour etre lisible

  const xBelieved = 104;
  const xMatch = xBelieved + trueOffsetKm * kmPx;
  const ground = (x) => relief(x, 31);

  // Une seule normalisation pour la carte et pour les profils : ils decrivent
  // le meme sol, et doivent donc se superposer.
  const xa = x0 + (22 - xBelieved) / kmPx, xb = x0 + (350 - xBelieved) / kmPx;
  const ref = shape(ground, xa, xb, 164);
  const mapY = (v) => 146 - 13 * ((v - ref.mean) / ref.rms);

  const mapPts = [];
  for (let px = 22; px <= 350; px += 2) {
    const xKm = x0 + (px - xBelieved) / kmPx;
    mapPts.push([px, mapY(ground(xKm) + 0.10 * mapErrorOf(xKm))]);
  }
  // Le sol dessine comme un aplat : les deux profils poses dessus se lisent
  // alors comme ce qu'ils sont, un calage qui rate et un calage qui tombe juste.
  const mapFill = [[22, 178], ...mapPts, [350, 178]];

  const meas = measured(ground, x0, n, stepKm, trueOffsetKm, 0.1);
  const strip = (xAnchor) => meas.map((v, i) => [xAnchor + i * stepKm * kmPx, mapY(v)]);

  const offsets = [];
  for (let d = -3; d <= 3.001; d += 0.05) offsets.push(d);
  const s = ssdCurve(ground, x0, n, stepKm, meas, offsets, 0.16);
  const sMax = Math.max(...s), sMin = Math.min(...s);
  const yTop = 198, hBox = 38;
  const ssdPts = offsets.map((d, i) => [
    xBelieved + d * kmPx,
    yTop + hBox - hBox * ((sMax - s[i]) / Math.max(1e-9, sMax - sMin)),
  ]);

  return svg(`
    ${/* etage 1 : ou l'on est, ou l'on croit etre, et le faisceau radar */ ''}
    ${dot(xMatch, 40, { r: 4, cls: 'fig-truth-fill' })}
    ${text(xMatch + 9, 36, esc(L.truth), { cls: 'fig-truth', size: 10 })}
    ${dot(xBelieved, 64, { r: 4, cls: 'fig-est-fill' })}
    ${text(xBelieved - 9, 68, esc(L.believed), { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${arrow(xMatch, 48, xMatch, 112, { cls: 'fig-truth', dash: '3 3' })}
    ${text(xMatch + 9, 92, esc(L.radar), { cls: 'fig-truth', size: 10 })}

    ${/* etage 2 : la carte, le profil mal range, le profil qui coincide */ ''}
    ${band(mapFill, { cls: 'fig-band' })}
    ${polyline(mapPts, { cls: 'fig-dim' })}
    ${text(22, 120, esc(L.map), { cls: 'fig-dim', size: 10 })}
    ${polyline(strip(xBelieved), { cls: 'fig-est', dash: '4 3' })}
    ${polyline(strip(xMatch), { cls: 'fig-truth', width: 2.2 })}

    ${/* la verticale qui lie le minimum, le bon calage et la position vraie */ ''}
    ${line(xBelieved, 72, xBelieved, 190, { cls: 'fig-est', dash: '2 4' })}
    ${line(xMatch, 118, xMatch, 236, { cls: 'fig-danger', dash: '2 4' })}
    ${arrow(xBelieved, 186, xMatch, 186, { cls: 'fig-danger' })}
    ${text((xBelieved + xMatch) / 2, 181, 'Δ', { anchor: 'middle', cls: 'fig-danger', size: 12 })}

    ${/* etage 3 : la somme des ecarts quadratiques, reellement calculee */ ''}
    ${text(26, 196, esc(L.ssd), { cls: 'fig-dim', size: 10 })}
    ${polyline(ssdPts, { cls: 'fig-est' })}
    ${dot(xMatch, yTop + hBox, { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(xMatch + 9, yTop + hBox + 4, esc(L.minimum), { cls: 'fig-danger', size: 10 })}
    ${legend(252, 202, [
    { cls: 'fig-est', dash: '4 3', label: L.filed },
    { cls: 'fig-truth', label: L.measured },
    { cls: 'fig-danger', label: L.offset },
  ])}
  `, { h: 250 });
}

/**
 * Fidelite de la carte embarquee.
 *
 * L'erreur de carte n'est pas un bruit : c'est une ondulation lente, de
 * longueur d'onde kilometrique. Elle ne se moyenne donc pas le long du profil
 * et fixe un plancher que ni un meilleur radar ni un profil plus long ne
 * franchissent. La barre de droite donne sa part dans la variance de mesure.
 */
export function mapFidelity({ labels: L, sensors }) {
  const cfg = sensors?.terrain ?? {};
  const mapErr = cfg.mapError ?? 12;
  const radar = cfg.radarSigma ?? 6;
  const n = cfg.samples ?? 50;
  const stepM = cfg.sampleStep ?? 120;
  const lenKm = (n * stepM) / 1000;

  const x0 = 40, x1 = 330, yBase = 104, count = 145;
  // Amplitude de l'ecart : croissante avec le reglage, mais bornee, sinon la
  // carte sortirait du cadre bien avant 200 m.
  const gapPx = clamp(12 * (mapErr / 12) ** 0.4, 4, 26);
  const rel = shape((x) => relief(x, 17), 0, lenKm, count);
  const err = shape((x) => mapErrorOf(x, 17), 0, lenKm, count);
  const truth = rel.u.map((u, i) => [x0 + ((x1 - x0) * i) / count, yBase - 22 * u]);
  const mapp = truth.map(([px, py], i) => [px, py - gapPx * err.u[i]]);

  // Part de chaque source dans la variance de la mesure : var = radar^2 + carte^2.
  const vMap = mapErr * mapErr, vRad = radar * radar;
  const share = vMap / (vMap + vRad);
  const barX = 372, barY = 46, barH = 96, barW = 22;
  const hMap = barH * share;

  return svg(`
    ${band([...truth, ...mapp.slice().reverse()], { cls: 'fig-band-danger' })}
    ${polyline(truth, { cls: 'fig-truth' })}
    ${polyline(mapp, { cls: 'fig-est', dash: '5 3' })}
    ${legend(x0, 158, [
    { cls: 'fig-truth', label: L.ground },
    { cls: 'fig-est', dash: '5 3', label: L.map },
  ])}
    ${text(x0, 192, `${esc(L.wavelength)}`, { cls: 'fig-dim', size: 10 })}
    ${text(x0, 208, `${esc(L.profile)} ${fmt(lenKm, 1)} km · ± ${fmt(mapErr)} m`, { cls: 'fig-dim', size: 10 })}

    ${text(470, barY - 10, esc(L.variance), { anchor: 'end', cls: 'fig-dim', size: 10 })}
    ${rect(barX, barY, barW, barH, { cls: 'fig-band', rx: 3 })}
    ${rect(barX, barY, barW, hMap, { cls: 'fig-est-fill', rx: 3 })}
    ${text(barX + barW + 7, barY + hMap / 2 + 4, `${esc(L.mapShare)} ${fmt(share * 100)} %`, { cls: 'fig-est', size: 10 })}
    ${text(barX + barW + 7, barY + hMap + (barH - hMap) / 2 + 4, `${esc(L.radarShare)} ${fmt((1 - share) * 100)} %`, { cls: 'fig-truth', size: 10 })}
    ${text(barX, barY + barH + 18, `σ = ${fmt(Math.sqrt(vMap + vRad), 1)} m`, { cls: 'fig-dim', size: 10.5 })}
  `, { h: 226 });
}

/**
 * Bruit du radioaltimetre — mais surtout : bruit RAPPORTE AU RELIEF.
 *
 * Le meme bruit de quelques metres est negligeable sur un massif et fatal sur
 * une plaine. Les deux panneaux partagent la meme echelle verticale, sans quoi
 * la comparaison ne voudrait rien dire.
 */
export function profileNoise({ labels: L, sensors }) {
  const sigma = clamp(sensors?.terrain?.radarSigma ?? 6, 0.5, 60);
  // Ecarts-types du relief mesures sur le champ synthetique de core/terrain.js,
  // le long d'un profil de 6 km : 24 m sur un massif, 2,2 m sur une plaine.
  const panels = [
    { x: 66, w: 172, sd: 24, key: 'rugged', seed: 55 },
    { x: 274, w: 172, sd: 2.2, key: 'plain', seed: 62 },
  ];
  const yMid = 112;
  const mPx = 0.8; // pixels par metre — LA MEME echelle pour les deux panneaux
  const count = 84;

  const draw = (p, idx) => {
    const s = shape((x) => relief(x, p.seed), 0, 6, count);
    const at = (i) => [p.x + (p.w * i) / count, yMid - mPx * p.sd * s.u[i]];
    const curvePts = [];
    for (let i = 0; i <= count; i++) curvePts.push(at(i));
    const rnd = makeNoise(4242 + idx * 31);
    const dots = [];
    for (let i = 0; i <= count; i += 4) {
      const [px, py] = at(i);
      dots.push(dot(px, py + mPx * sigma * 2.4 * rnd(), { r: 2.2, cls: 'fig-est-fill' }));
    }
    return `
      ${polyline(curvePts, { cls: 'fig-truth' })}
      ${dots.join('')}
      ${text(p.x, 32, esc(L[p.key]), { cls: 'fig-dim', size: 10.5 })}
      ${text(p.x, 48, `${esc(L.reliefSd)} ± ${fmt(p.sd, 1)} m`, { cls: 'fig-truth', size: 10 })}
      ${text(p.x, 190, `${esc(L.ratio)} ${fmt(p.sd / sigma, p.sd / sigma < 1 ? 2 : 1)}`, {
      cls: p.sd > 2 * sigma ? 'fig-truth' : 'fig-danger', size: 10.5,
    })}`;
  };

  // Deux jauges cote a cote : l'echelle du relief et celle du bruit. Sans
  // elles, les deux panneaux ne se compareraient pas.
  const gauge = (x, half, cls) => `
    ${line(x, yMid - half, x, yMid + half, { cls })}
    ${line(x - 4, yMid - half, x + 4, yMid - half, { cls })}
    ${line(x - 4, yMid + half, x + 4, yMid + half, { cls })}`;

  return svg(`
    ${panels.map(draw).join('')}
    ${line(252, 40, 252, 178, { cls: 'fig-dim', dash: '2 4' })}
    ${gauge(24, 15 * mPx, 'fig-dim')}
    ${gauge(42, Math.min(48, sigma * mPx), 'fig-est')}
    ${text(14, 190, '30 m', { cls: 'fig-dim', size: 9.5 })}
    ${text(66, 206, `${esc(L.noise)} ± ${fmt(sigma, 1)} m`, { cls: 'fig-est', size: 10 })}
    ${text(14, 226, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 238 });
}

/**
 * Longueur du profil — le parametre qui decide de l'ambiguite.
 *
 * REACTIF : la courbe du bas est calculee avec le nombre de points regle. Un
 * profil court ressemble a plusieurs endroits du relief, et la correlation
 * presente alors plusieurs minima de profondeur comparable ; rien ne dit lequel
 * est le bon. En allongeant le profil, les faux minima remontent, un seul
 * subsiste. Chaque courbe est normalisee sur son propre creux : ce qui se
 * compare ici est la FORME, pas le niveau.
 */
export function profileLength({ labels: L, sensors }) {
  const cfg = sensors?.terrain ?? {};
  const n = clamp(Math.round(cfg.samples ?? 50), 4, 200);
  const stepKm = (cfg.sampleStep ?? 120) / 1000;
  const nShort = 8;
  const x0 = 3.0;
  const trueOffset = 0.9; // km
  const ground = (x) => ridged(x, 31);

  const offsets = [];
  for (let d = -3; d <= 3.001; d += 0.04) offsets.push(d);
  const curveOf = (count) => ssdCurve(
    ground, x0, count, stepKm,
    measured(ground, x0, count, stepKm, trueOffset, 0.09, 991),
    offsets, 0.12,
  );
  const sShort = curveOf(nShort);
  const sLong = curveOf(n);

  // Bandeau de relief : 15 km, de quoi loger le profil le plus long.
  const spanKm = 15;
  const gx0 = 48, gw = 396;
  const kmPx = gw / spanKm;
  const relShape = shape((x) => ground(x0 + x), 0, spanKm, 198);
  const relPts = relShape.u.map((u, i) => [gx0 + (gw * i) / 198, 50 - 11 * u]);
  const wShort = Math.min(gw, nShort * stepKm * kmPx);
  const wLong = Math.min(gw, n * stepKm * kmPx);

  const panel = (vals, box, cls, fill) => {
    const hi = Math.max(...vals), lo = Math.min(...vals);
    const X = (d) => box.x + ((d + 3) / 6) * box.w;
    const Y = (v) => box.y + box.h - box.h * ((hi - v) / Math.max(1e-9, hi - lo));
    const pts = offsets.map((d, i) => [X(d), Y(vals[i])]);
    const mins = deepMinima(vals, offsets);
    return {
      count: mins.length,
      svg: `${polyline(pts, { cls })}
        ${mins.map((m) => dot(X(m.d), Y(m.v), { r: 3, cls: fill })).join('')}`,
    };
  };
  const boxA = { x: 48, y: 104, w: 396, h: 36 };
  const boxB = { x: 48, y: 158, w: 396, h: 36 };
  const A = panel(sShort, boxA, 'fig-danger', 'fig-danger-fill');
  const B = panel(sLong, boxB, 'fig-est', 'fig-est-fill');
  const xTrue = boxA.x + ((trueOffset + 3) / 6) * boxA.w;

  return svg(`
    ${text(gx0, 24, `${esc(L.short)} ${nShort} · ${fmt(nShort * stepKm, 1)} km`, { cls: 'fig-danger', size: 10.5 })}
    ${text(gx0 + 214, 24, `${esc(L.long)} ${n} · ${fmt(n * stepKm, 1)} km`, { cls: 'fig-est', size: 10.5 })}
    ${polyline(relPts, { cls: 'fig-dim' })}
    ${bracket(gx0, gx0 + wShort, 68, 'fig-danger')}
    ${bracket(gx0, gx0 + wLong, 80, 'fig-est')}

    ${A.svg}
    ${B.svg}
    ${line(xTrue, 96, xTrue, 200, { cls: 'fig-truth', dash: '3 3' })}
    ${text(xTrue + 6, 100, esc(L.trueOffset), { cls: 'fig-truth', size: 10 })}
    ${axes(boxA.x, 200, boxA.x + boxA.w + 14, 96)}
    ${text(boxA.x + 6, 98, esc(L.ssd), { cls: 'fig-axis-label', size: 10 })}
    ${[-2, 0, 2].map((d) => {
    const x = boxA.x + ((d + 3) / 6) * boxA.w;
    return `${line(x, 200, x, 205, { cls: 'fig-axis' })}
      ${text(x, 216, `${d > 0 ? '+' : ''}${d} km`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}`;
  }).join('')}
    ${text(boxA.x, 234, `${esc(L.count)} ${A.count} / ${B.count}`, { cls: 'fig-dim', size: 10 })}
    ${text(boxA.x + boxA.w + 14, 234, esc(L.offset), { anchor: 'end', cls: 'fig-axis-label', size: 10 })}
    ${text(boxA.x, 250, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 258 });
}

/**
 * La tranche d'altitude ou le module travaille, et ce qu'elle implique sur le
 * choix du vecteur. L'axe des abscisses est le temps AVANT impact : on voit
 * alors que le planeur traverse la tranche pendant des minutes tandis que le
 * corps de rentree n'y passe qu'une poignee de secondes.
 */
export function terrainBand({ labels: L, sensors, veh }) {
  const cfg = sensors?.terrain ?? {};
  const maxAlt = clamp((cfg.maxAlt ?? 32000) / 1000, 1, 68);
  const minAlt = (cfg.minAlt ?? 300) / 1000;
  const isGlider = !!veh?.glide;

  const T = 600; // secondes avant impact
  const A = 70; // kilometres d'altitude
  const x0 = 56, x1 = 452, yGround = 182, yTop = 40;
  const X = (tau) => x1 - ((x1 - x0) * tau) / T;
  const Y = (km) => yGround - ((yGround - yTop) * Math.min(km, A)) / A;

  // Planeur : descente lente, avec l'oscillation caracteristique du vol plane.
  const glide = [];
  for (let tau = T; tau >= 0; tau -= 2) {
    const base = 62 * (tau / T) ** 1.448 + 1.2 * Math.sin(tau / 42) * (tau / T);
    glide.push([X(tau), Y(Math.max(0, base))]);
  }
  // Corps de rentree : il entre par le haut du cadre une trentaine de secondes
  // avant l'impact, a plusieurs km/s.
  const rv = [];
  for (let tau = 34; tau >= 0; tau -= 0.5) rv.push([X(tau), Y(Math.max(0, 70 * (tau / 34) ** 1.25))]);

  const enter = (arr) => {
    for (const [x, y] of arr) if (y > Y(maxAlt)) return x;
    return null;
  };
  const xG = enter(glide), xR = enter(rv);
  const secOf = (x) => (x == null ? 0 : ((x1 - x) / (x1 - x0)) * T);
  const yBar = Y(minAlt) - 5;

  return svg(`
    ${rect(x0, Y(maxAlt), x1 - x0, Math.max(1, Y(minAlt) - Y(maxAlt)), { cls: 'fig-band-truth', rx: 2 })}
    ${line(x0, Y(maxAlt), x1, Y(maxAlt), { cls: 'fig-dim', dash: '4 3' })}
    ${line(x0, Y(minAlt), x1, Y(minAlt), { cls: 'fig-dim', dash: '4 3' })}
    ${text(x0 + 5, Y(maxAlt) - 6, `${esc(L.ceiling)} ${fmt(maxAlt, 1)} km`, { cls: 'fig-dim', size: 10 })}
    ${text(x0 + 5, Y(minAlt) + 13, `${esc(L.floor)} ${fmt(minAlt * 1000)} m`, { cls: 'fig-dim', size: 9.5 })}

    ${polyline(glide, { cls: 'fig-truth' })}
    ${polyline(rv, { cls: 'fig-danger' })}
    ${xG != null ? `${dot(xG, Y(maxAlt), { r: 3, cls: 'fig-truth-fill' })}
      ${arrow(xG, yBar, x1, yBar, { cls: 'fig-truth' })}` : ''}
    ${xR != null ? `${dot(xR, Y(maxAlt), { r: 3, cls: 'fig-danger-fill' })}
      ${arrow(xR, yBar - 10, x1, yBar - 10, { cls: 'fig-danger' })}` : ''}

    ${text(196, 58, `${isGlider ? '▸ ' : ''}${esc(L.glider)} — ${esc(L.inBand)} ${fmt(secOf(xG))} s`, { cls: 'fig-truth', size: 10.5 })}
    ${text(196, 76, `${isGlider ? '' : '▸ '}${esc(L.rv)} — ${esc(L.inBand)} ${fmt(secOf(xR))} s`, { cls: 'fig-danger', size: 10.5 })}

    ${axes(x0, yGround, x1 + 12, yTop - 8, { xLabel: L.toImpact, yLabel: L.altitude })}
    ${line(x0 - 4, Y(A), x0, Y(A), { cls: 'fig-axis' })}
    ${text(x0 - 7, Y(A) + 4, `${A} km`, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(x1, yGround + 30, '0 s', { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(x0, yGround + 30, `${T} s`, { cls: 'fig-dim', size: 9.5 })}
    ${text(x0, yGround + 48, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 240 });
}

export default {
  tercomPrinciple, mapFidelity, profileNoise, profileLength, terrainBand,
};
