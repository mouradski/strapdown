// Schemas du groupe tlmSensors — le flux de ce qui est MESURE.
//
// Fil conducteur de ces sept schemas : aucune valeur du bus ne vient de la
// verite terrain. Chacun montre donc, non pas une grandeur physique, mais le
// mecanisme par lequel le bord se forge une opinion a partir d'une mesure
// incomplete — et l'endroit precis ou cette opinion peut etre fausse.

import {
  svg, axes, text, polyline, arrow, line, dot, band, rect, esc,
} from '../svg.js';

const G0 = 9.80665;

/** Vehicule de repli : la fiche doit se dessiner meme sans contexte. */
const VEH0 = {
  payloadMass: 600,
  usefulRange: 3600e3,
  glide: null,
  stages: [
    { thrustSL: 640e3, thrustVac: 700e3, dryMass: 2100, propMass: 17500 },
    { thrustVac: 190e3, dryMass: 620, propMass: 3900 },
  ],
};

/**
 * Masse au decollage, recalculee ici plutot qu'importee de la simulation : la
 * couche d'aide ne doit rien exiger du moteur de vol.
 */
function liftoffMass(v) {
  let m = v.payloadMass ?? 600;
  for (const st of v.stages ?? []) m += (st.dryMass ?? 0) + (st.propMass ?? 0);
  return m;
}

const fmtG = (g) => (g >= 10 ? g.toFixed(0) : g.toFixed(2));
const fmtKm = (m) => (m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(0)} km`);

/** Petites vitesses angulaires : jamais de 0.000 trompeur. */
function fmtRate(v) {
  const a = Math.abs(v);
  if (a >= 0.1) return v.toFixed(3);
  if (a >= 1e-3) return v.toFixed(4);
  if (a === 0) return '0';
  return v.toExponential(1);
}

/** Echantillonne u -> valeur sur un intervalle, et projette. */
function seg(f, u0, u1, xOf, yOf, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    pts.push([xOf(u), yOf(f(u))]);
  }
  return pts;
}

/**
 * Force specifique : ce que l'accelerometre rapporte, et ce que le vehicule
 * subit reellement.
 *
 * Le schema ne montre pas une grandeur mais un ECART : les deux courbes sont
 * separees par g partout, et c'est ce g absent de la mesure que le calculateur
 * doit fabriquer lui-meme. En vol libre la courbe mesuree touche zero alors que
 * le vehicule tombe — c'est le seul endroit du bus ou une valeur nulle veut
 * dire quelque chose de fort.
 */
export function specificForce({ labels: L = {}, veh }) {
  const v = veh ?? VEH0;
  const liftG = (v.stages?.[0]?.thrustSL ?? 640e3) / (liftoffMass(v) * G0);
  const peakG = 3.6 * liftG; // rapport constate entre l'extinction et le decollage

  const box = { x: 56, y: 26, w: 360, h: 124 };
  const base = box.y + box.h;
  const xOf = (u) => box.x + box.w * u;
  // Echelle brisee : lineaire jusqu'a 2 g (ou se joue tout le propos),
  // logarithmique au-dela (sinon la rentree ecrase le reste du vol).
  const yOf = (g) => {
    const k = g <= 2 ? 0.42 * (g / 2)
      : 0.42 + 0.56 * (Math.log(Math.min(g, 36) / 2) / Math.log(18));
    return base - box.h * k;
  };

  const P = { pad: 0.11, boost: 0.32, coast: 0.8 };
  const fMeas = (u) => {
    if (u <= P.pad) return 1;
    if (u <= P.boost) {
      const k = (u - P.pad) / (P.boost - P.pad);
      return liftG + k * k * (peakG - liftG);
    }
    if (u <= P.coast) return 0;
    const k = (u - P.coast) / (1 - P.coast);
    return 34 * Math.exp(-(((k - 0.55) / 0.33) ** 2));
  };
  // Pesanteur locale : ~0.88 g a l'apogee d'un vol balistique.
  const gLocal = (u) => (u > P.boost && u <= P.coast ? 0.88 : 1);
  const aTrue = (u) => Math.abs(fMeas(u) - gLocal(u));

  const spans = [[0, P.pad], [P.pad, P.boost], [P.boost, P.coast], [P.coast, 1]];
  const draw = (f, cls) => spans
    .map(([a, b]) => polyline(seg(f, a, b, xOf, yOf), { cls })).join('');

  // L'ecart entre les deux courbes pendant le vol libre : c'est la gravite.
  const gapBand = band([
    [xOf(P.boost), base], [xOf(P.coast), base],
    [xOf(P.coast), yOf(0.88)], [xOf(P.boost), yOf(0.88)],
  ], { cls: 'fig-band' });

  const phase = (key, a, b) => text((xOf(a) + xOf(b)) / 2, base + 16,
    esc(L[key] ?? ''), { anchor: 'middle', cls: 'fig-dim', size: 9.5 });

  const uGap = 0.55;
  return svg(`
    ${gapBand}
    ${line(box.x, yOf(1), box.x + box.w, yOf(1), { cls: 'fig-dim', dash: '2 4' })}
    ${text(box.x - 6, yOf(1) + 3, '1 g', { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${axes(box.x, base, box.x + box.w + 16, box.y - 8, { yLabel: L.axis })}
    ${draw(aTrue, 'fig-truth')}
    ${draw(fMeas, 'fig-est')}
    ${/* la chute a l'extinction : de plusieurs g a zero */ ''}
    ${line(xOf(P.boost), yOf(peakG), xOf(P.boost), yOf(0), { cls: 'fig-est' })}
    ${arrow(xOf(uGap), base, xOf(uGap), yOf(0.88), { cls: 'fig-danger' })}
    ${text(xOf(uGap) + 8, yOf(0.88) - 14, esc(L.gapNote ?? ''), { cls: 'fig-danger', size: 10 })}
    ${text(xOf(uGap) + 8, base - 6, esc(L.coastNote ?? ''), { cls: 'fig-est', size: 10 })}
    ${text(xOf(P.boost) - 6, yOf(peakG) - 10, `${esc(L.liftoff ?? '')} ${fmtG(liftG)} g`, { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${text(box.x + box.w - 4, yOf(34) - 8, esc(L.entryPeak ?? ''), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${phase('pad', 0, P.pad)}${phase('boost', P.pad, P.boost)}
    ${phase('coast', P.boost, P.coast)}${phase('entry', P.coast, 1)}
    ${line(box.x, base + 34, box.x + 16, base + 34, { cls: 'fig-est' })}
    ${text(box.x + 22, base + 37, esc(L.measured ?? ''), { cls: 'fig-est', size: 10 })}
    ${line(box.x, base + 52, box.x + 16, base + 52, { cls: 'fig-truth' })}
    ${text(box.x + 22, base + 55, esc(L.trueAccel ?? ''), { cls: 'fig-truth', size: 10 })}
    ${text(box.x, base + 76, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: 240 });
}

/**
 * Vitesse de rotation : la seule ligne du bus dont on puisse lire l'erreur
 * directement, en la comparant a la ligne d'en face.
 *
 * Dans ce simulateur le vehicule suit exactement la rotation commandee. La
 * difference entre les deux lignes du bus est donc, terme pour terme, l'erreur
 * du gyrometre — et ses trois contributions se calculent avec les reglages
 * courants.
 */
export function bodyRates({ labels: L = {}, sensors }) {
  const imu = sensors?.imu ?? {};
  const bias = (imu.gyroBias ?? 0.01) / 3600; // °/h -> °/s
  const rate = 0.17; // vitesse de tangage representative pendant la montee [°/s]
  const scale = (imu.gyroScale ?? 20) * 1e-6 * rate;
  // Bruit blanc rapporte au pas de calcul de la phase propulsee, 20 ms.
  const noise = ((imu.gyroARW ?? 0.002) / 60) / Math.sqrt(0.02);
  const meas = rate + bias + scale;

  const boxW = 178, xB = 22;
  const rowCmd = { x: xB, y: 28, w: boxW, h: 46 };
  const rowMes = { x: xB, y: 158, w: boxW, h: 46 };
  const cx = xB + boxW / 2;

  const term = (y, key, value, cls) => `
    ${arrow(232, y, cx + 8, y, { cls })}
    ${text(238, y - 3, esc(L[key] ?? ''), { cls, size: 10 })}
    ${text(238, y + 11, value, { cls: 'fig-dim', size: 10 })}`;

  return svg(`
    ${rect(rowCmd.x, rowCmd.y, rowCmd.w, rowCmd.h, { cls: 'fig-box fig-cmd-box', rx: 6 })}
    ${text(cx, rowCmd.y + 18, esc(L.commanded ?? ''), { anchor: 'middle', cls: 'fig-cmd', size: 10.5 })}
    ${text(cx, rowCmd.y + 36, `y ${rate.toFixed(3)} °/s`, { anchor: 'middle', cls: 'fig-cmd', size: 12.5 })}

    ${rect(rowMes.x, rowMes.y, rowMes.w, rowMes.h, { cls: 'fig-box fig-est-box', rx: 6 })}
    ${text(cx, rowMes.y + 18, esc(L.measured ?? ''), { anchor: 'middle', cls: 'fig-est', size: 10.5 })}
    ${text(cx, rowMes.y + 36, `y ${meas.toFixed(6)} °/s`, { anchor: 'middle', cls: 'fig-est', size: 12.5 })}

    ${arrow(cx, rowCmd.y + rowCmd.h, cx, rowMes.y - 2, { cls: 'fig-dim' })}
    ${term(94, 'bias', `+ ${fmtRate(bias)} °/s`, 'fig-danger')}
    ${term(126, 'scale', `+ ${fmtRate(scale)} °/s`, 'fig-danger')}
    ${term(158, 'noise', `± ${fmtRate(noise)} °/s`, 'fig-dim')}
    ${text(22, 220, esc(L.note ?? ''), { cls: 'fig-dim', size: 9.5 })}
    ${text(22, 236, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: 248 });
}

/**
 * Biais estimes : deux panneaux, parce que les deux capteurs n'ont pas du tout
 * le meme sort.
 *
 * Le filtre part de zero — il croit ses capteurs parfaits. Ce qu'il apprend
 * ensuite depend entierement de ce qui l'observe : la visee stellaire mesure
 * l'attitude, donc le biais gyrometrique ; rien, en vol libre, ne mesure le
 * biais accelerometrique. Et ce qui entre dans cet etat n'est pas seulement le
 * biais : le facteur d'echelle, absent du modele, s'y refugie.
 */
export function biasEstimation({ labels: L = {}, sensors, veh }) {
  const imu = sensors?.imu ?? {};
  const v = veh ?? VEH0;
  const accelBias = imu.accelBias ?? 25; // [µg]
  const gyroBias = imu.gyroBias ?? 0.01; // [°/h]
  const ppm = imu.accelScale ?? 30;

  // Force specifique en fin de combustion : dernier etage a vide.
  const stages = v.stages ?? VEH0.stages;
  const last = stages[stages.length - 1] ?? {};
  const mEnd = (v.payloadMass ?? 600) + (last.dryMass ?? 620);
  const fEnd = (last.thrustVac ?? 190e3) / mEnd; // [m/s²]
  const scaleUg = (ppm * 1e-6 * fEnd) / (G0 * 1e-6);

  const H = 92, Y = 52, W = 172;
  const panels = [
    {
      x: 44, title: L.accelPanel, unit: 'µg', truth: accelBias, noteKey: 'scaleNote',
      note: `${ppm.toFixed(0)} ppm × ${fEnd.toFixed(0)} m/s² = ${scaleUg.toFixed(0)} µg`,
      // Plat presque tout le vol, puis un saut au-dela de la verite.
      est: (u) => (u < 0.72 ? 0.02 : 0.02 + 1.55 * (1 - Math.exp(-(u - 0.72) * 9))),
    },
    {
      x: 264, title: L.gyroPanel, unit: '°/h', truth: gyroBias, noteKey: 'starNote', note: null,
      // Escalier : une marche par visee, convergence vers la verite.
      est: (u) => 1.03 * (1 - Math.exp(-u * 2.8)) * (1 + 0.05 * Math.sin(u * 32)),
    },
  ];

  const body = panels.map((p) => {
    const box = { x: p.x, y: Y, w: W, h: H };
    const base = box.y + box.h;
    const yOf = (k) => base - Math.min(box.h, k * (box.h / 2));
    const pts = [];
    for (let i = 0; i <= 72; i++) pts.push([box.x + (box.w * i) / 72, yOf(p.est(i / 72))]);
    return `
      ${axes(box.x, base, box.x + box.w + 10, box.y - 6, {})}
      ${line(box.x, yOf(1), box.x + box.w, yOf(1), { cls: 'fig-truth', dash: '5 3' })}
      ${text(box.x + 4, yOf(1) - 6, `${
  p.unit === 'µg' ? p.truth.toFixed(0) : p.truth.toFixed(3)} ${p.unit}`,
  { cls: 'fig-truth', size: 10 })}
      ${polyline(pts, { cls: 'fig-est' })}
      ${dot(box.x, yOf(0.02), { r: 3, cls: 'fig-est-fill' })}
      ${text(box.x + box.w / 2, box.y - 16, esc(p.title ?? ''), { anchor: 'middle', cls: 'fig-dim', size: 10.5 })}
      ${text(box.x, base + 20, esc(L[p.noteKey] ?? ''), { cls: 'fig-dim', size: 9.5 })}
      ${p.note ? text(box.x, base + 34, p.note, { cls: 'fig-danger', size: 9.5 }) : ''}`;
  }).join('');

  const yL = Y + H + 58;
  return svg(`
    ${body}
    ${line(44, yL, 60, yL, { cls: 'fig-truth', dash: '5 3' })}
    ${text(66, yL + 3, esc(L.truthLine ?? ''), { cls: 'fig-truth', size: 10 })}
    ${line(44, yL + 18, 60, yL + 18, { cls: 'fig-est' })}
    ${text(66, yL + 21, esc(L.startZero ?? ''), { cls: 'fig-est', size: 10 })}
    ${text(44, yL + 44, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: yL + 58 });
}

/**
 * L'incertitude annoncee contre l'erreur reelle.
 *
 * L'enveloppe sort de la covariance du filtre : elle se calcule sans jamais
 * regarder la verite, et chaque recalage la fait retomber. La courbe verte,
 * elle, n'existe que dans le simulateur. Tout le sujet tient dans le fait que
 * le bord ne peut pas comparer les deux — et qu'il lui arrive donc d'etre sur
 * de lui a tort.
 */
export function sigmaEnvelope({ labels: L = {}, sensors }) {
  const box = { x: 52, y: 24, w: 372, h: 124 };
  const base = box.y + box.h;
  const xOf = (u) => box.x + box.w * u;

  const period = sensors?.starTracker?.period ?? 20;
  const enabled = sensors?.starTracker?.enabled !== false;
  // Un recalage tous les `period` sur un vol de l'ordre de 900 s : allonger
  // l'intervalle donne moins de dents, mais des dents plus hautes.
  const nFix = enabled ? Math.max(1, Math.min(16, Math.round(900 / Math.max(6, period)))) : 0;

  const N = 480;
  const sig = new Array(N + 1);
  let s = 0.05;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    s += (0.028 + 0.05 * u) * (240 / N);
    // Un recalage retranche l'essentiel de ce qui s'est accumule depuis le
    // precedent, jamais la totalite : il reste toujours un residu.
    if (nFix > 0 && i > 0 && Math.floor(u * nFix) !== Math.floor(((i - 1) / N) * nFix)) s *= 0.45;
    sig[i] = s;
  }

  // Erreur vraie : meme forme, mais un rapport a l'enveloppe que rien a bord ne
  // connait, et qui derive au-dela de 1 en fin de vol.
  let seed = 20260811;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
  const tru = new Array(N + 1);
  let f = 0.5;
  for (let i = 0; i <= N; i++) {
    f = Math.max(0.2, f + rnd() * 0.03 + 0.0013);
    tru[i] = sig[i] * f;
  }

  const peak = Math.max(...sig, ...tru) * 1.06;
  const yOf = (val) => base - box.h * (val / peak);
  const path = (arr) => arr.map((val, i) => [xOf(i / N), yOf(val)]);

  const envPts = path(sig);
  // On annote une dent un peu apres le debut : il faut de la place a gauche
  // pour poser le libelle sans mordre sur l'axe.
  const kDrop = Math.min(3, Math.max(1, nFix - 1));
  const iDrop = nFix > 1 ? Math.round((N * kDrop) / nFix) : 0;

  return svg(`
    ${band([...envPts, [xOf(1), base], [box.x, base]], { cls: 'fig-band' })}
    ${polyline(envPts, { cls: 'fig-est' })}
    ${polyline(path(tru), { cls: 'fig-truth' })}
    ${axes(box.x, base, box.x + box.w + 16, box.y - 8, { xLabel: L.time, yLabel: L.error })}
    ${iDrop ? `${arrow(xOf(iDrop / N) - 46, yOf(sig[iDrop]) - 36, xOf(iDrop / N) - 4, yOf(sig[iDrop]) - 8, { cls: 'fig-dim' })}
      ${text(xOf(iDrop / N) - 52, yOf(sig[iDrop]) - 42, esc(L.fix ?? ''), { cls: 'fig-dim', size: 9.5 })}` : ''}
    ${line(box.x, base + 32, box.x + 16, base + 32, { cls: 'fig-est' })}
    ${text(box.x + 22, base + 35, esc(L.announced ?? ''), { cls: 'fig-est', size: 10 })}
    ${line(box.x, base + 50, box.x + 16, base + 50, { cls: 'fig-truth' })}
    ${text(box.x + 22, base + 53, esc(L.trueError ?? ''), { cls: 'fig-truth', size: 10 })}
    ${text(box.x, base + 74, esc(L.note ?? ''), { cls: 'fig-danger', size: 10 })}
    ${text(box.x, base + 92, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: 250 });
}

/**
 * Comptage des visees stellaires.
 *
 * L'horloge du viseur bat toujours au meme rythme ; ce qui varie, c'est le
 * temps passe au-dessus du plancher de visibilite. Le profil de vol decide donc
 * a lui seul du nombre de recalages d'attitude — et c'est pour cela qu'un
 * planeur en obtient deux fois moins qu'un vecteur balistique de meme duree.
 */
export function starTally({ labels: L = {}, sensors, veh }) {
  const v = veh ?? VEH0;
  const period = sensors?.starTracker?.period ?? 20;
  const minAlt = sensors?.starTracker?.minAlt ?? 45000;
  const enabled = sensors?.starTracker?.enabled !== false;

  // Profils indicatifs, cales sur ce que produit la simulation.
  const isGlide = !!v.glide;
  const far = (v.usefulRange ?? 3600e3) >= 8e6;
  const T = isGlide ? 957 : far ? 2088 : 865;
  const apo = isGlide ? 154e3 : far ? 1528e3 : 586e3;
  const arcEnd = isGlide ? 0.55 : 1; // le planeur redescend, puis file bas
  const cruise = 32e3;

  const endAlt = isGlide ? cruise : 0; // le planeur ne retombe pas : il se met en plane
  const altOf = (u) => {
    if (u <= arcEnd) {
      const x = u / arcEnd;
      return 4 * apo * x * (1 - x) + endAlt * x * x;
    }
    const k = (u - arcEnd) / (1 - arcEnd);
    return cruise * (1 - 0.5 * k * k);
  };

  const box = { x: 50, y: 20, w: 368, h: 108 };
  const base = box.y + box.h;
  const top = Math.max(apo, minAlt * 1.4);
  const xOf = (u) => box.x + box.w * u;
  // Echelle en racine : sinon le plancher de visibilite se colle a l'axe.
  const yOf = (a) => base - box.h * Math.sqrt(Math.max(0, Math.min(1, a / top)));

  const prof = [];
  for (let i = 0; i <= 160; i++) { const u = i / 160; prof.push([xOf(u), yOf(altOf(u))]); }

  const steps = Math.max(1, Math.round(T / Math.max(1, period)));
  const taken = [];
  const missed = [];
  const tally = [];
  let count = 0;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = altOf(u);
    if (enabled && a >= minAlt) { count++; taken.push([xOf(u), yOf(a)]); } else missed.push([xOf(u), yOf(a)]);
    tally.push([xOf(u), count]);
  }

  const tr = { y: 168, h: 38 };
  const stair = tally.map(([x, c]) => [x, tr.y + tr.h - tr.h * (c / Math.max(1, count))]);
  const yFloor = yOf(minAlt);

  return svg(`
    ${band([[box.x, yFloor], [box.x + box.w, yFloor],
    [box.x + box.w, base], [box.x, base]], { cls: 'fig-band' })}
    ${polyline(prof, { cls: 'fig-truth' })}
    ${line(box.x, yFloor, box.x + box.w, yFloor, { cls: 'fig-danger', dash: '5 3' })}
    ${missed.map(([x, y]) => line(x, y - 3, x, y + 3, { cls: 'fig-dim' })).join('')}
    ${taken.map(([x, y]) => dot(x, y, { r: 2.6, cls: 'fig-est-fill' })).join('')}
    ${axes(box.x, base, box.x + box.w + 14, box.y - 6, { yLabel: L.altitude })}
    ${text(box.x + box.w * 0.5, yFloor - 7, `${esc(L.minAlt ?? '')} ${fmtKm(minAlt)}`, { anchor: 'middle', cls: 'fig-danger', size: 9.5 })}
    ${text(box.x + 6, base - 8, esc(L.occulted ?? ''), { cls: 'fig-dim', size: 9.5 })}
    ${text(box.x + box.w + 10, box.y + 4, esc(L.sighting ?? ''), { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${polyline(stair, { cls: 'fig-est' })}
    ${line(box.x, tr.y + tr.h, box.x + box.w, tr.y + tr.h, { cls: 'fig-axis' })}
    ${text(box.x, tr.y - 8, esc(L.tally ?? ''), { cls: 'fig-est', size: 10 })}
    ${text(box.x + box.w, tr.y - 8, `${count} × ${period.toFixed(0)} s`, { anchor: 'end', cls: 'fig-est', size: 10.5 })}
    ${text(box.x + box.w, tr.y + tr.h + 14, esc(L.time ?? ''), { anchor: 'end', cls: 'fig-axis-label', size: 10 })}
    ${text(box.x, tr.y + tr.h + 36, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: 254 });
}

/**
 * Les trois tamis qu'une mesure doit franchir.
 *
 * Deux appartiennent au module de correlation, le troisieme au filtre. Seuls
 * les deux premiers sont comptes sur le bus : le rejet par le test du khi-deux
 * ne s'affiche nulle part. La cloche du bas dit ce que teste ce troisieme
 * tamis — non pas l'erreur, qu'on ignore, mais la vraisemblance de la mesure au
 * regard de ce que le filtre croit savoir. Le seuil est tres large : il
 * n'attrape que l'invraisemblable.
 */
export function chiSquareGate({ labels: L = {}, sensors }) {
  const maxSigma = sensors?.terrain?.maxSigma ?? 1500;

  const boxes = [
    { x: 10, w: 100, key: 'measurement', cls: 'fig-truth' },
    { x: 124, w: 118, key: 'moduleGate', cls: 'fig-est' },
    { x: 256, w: 118, key: 'filterGate', cls: 'fig-est' },
    { x: 388, w: 82, key: 'applied', cls: 'fig-cmd' },
  ];
  const bY = 20, bH = 40;
  const chain = boxes.map((b) => `
    ${rect(b.x, bY, b.w, bH, { cls: `fig-box ${b.cls}-box`, rx: 6 })}
    ${text(b.x + b.w / 2, bY + bH / 2 + 4, esc(L[b.key] ?? ''), { anchor: 'middle', cls: b.cls, size: 10 })}`).join('');

  const links = [[110, 122], [242, 254], [374, 386]]
    .map(([a, b]) => arrow(a, bY + bH / 2, b, bY + bH / 2, { cls: 'fig-dim' })).join('');

  const drop = (x, label) => `
    ${arrow(x, bY + bH, x, bY + bH + 24, { cls: 'fig-danger' })}
    ${text(x + 6, bY + bH + 22, label, { cls: 'fig-danger', size: 9.5 })}`;

  // Cloche de l'innovation : ce que le filtre s'attend a voir.
  const cx = 236, base = 216, hBell = 54, sx = 25;
  const gate = Math.sqrt(30) * sx; // ±sqrt(30)·sigma, l'ecart admis par le test
  const bellAt = (i) => base - hBell * Math.exp(-((i / sx) ** 2) / 2);
  const bell = [];
  for (let i = -150; i <= 150; i += 2) bell.push([cx + i, bellAt(i)]);
  const inside = [];
  for (let i = -gate; i <= gate; i += 2) inside.push([cx + i, bellAt(i)]);

  const tick = (i) => `${line(cx + i, base, cx + i, base + 5, { cls: 'fig-axis' })}`;

  return svg(`
    ${chain}
    ${links}
    ${drop(183, `σ > ${maxSigma.toFixed(0)} m`)}
    ${drop(315, 'd² > 30')}
    ${line(183, bY + bH + 30, 315, bY + bH + 30, { cls: 'fig-danger' })}
    ${text(249, bY + bH + 44, esc(L.rejected ?? ''), { anchor: 'middle', cls: 'fig-danger', size: 10 })}
    ${band([...inside, [cx + gate, base], [cx - gate, base]], { cls: 'fig-band' })}
    ${polyline(bell, { cls: 'fig-est' })}
    ${line(cx - 156, base, cx + 172, base, { cls: 'fig-axis' })}
    ${tick(-sx)}${tick(sx)}${tick(0)}
    ${line(cx - gate, base, cx - gate, base - 40, { cls: 'fig-danger', dash: '3 3' })}
    ${line(cx + gate, base, cx + gate, base - 40, { cls: 'fig-danger', dash: '3 3' })}
    ${text(cx, base - hBell - 8, esc(L.expected ?? ''), { anchor: 'middle', cls: 'fig-est', size: 10 })}
    ${text(cx + sx + 3, base + 15, '1 σ', { cls: 'fig-dim', size: 9 })}
    ${text(cx + gate + 4, base - 44, esc(L.gateNote ?? ''), { anchor: 'middle', cls: 'fig-danger', size: 9.5 })}
    ${dot(cx + gate + 26, base - 3, { r: 3, cls: 'fig-danger-fill' })}
    ${text(cx + gate + 34, base + 1, esc(L.outlier ?? ''), { cls: 'fig-danger', size: 9.5 })}
    ${text(cx - 156, base + 30, esc(L.innovation ?? ''), { cls: 'fig-dim', size: 9.5 })}
    ${text(10, base + 48, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: 274 });
}

/**
 * Contraste de la correlation de terrain.
 *
 * Deux courbes de cout, l'une sur un relief marque, l'autre sur une plaine. Le
 * contraste mesure de combien le meilleur decalage se detache de tous les
 * autres ; c'est lui, et non la seule courbure du minimum, qui decide de
 * l'incertitude annoncee. Sur une plaine, tous les decalages se valent : le
 * minimum retenu tombe n'importe ou, et sa courbure ne dit plus rien.
 */
export function terrainContrast({ labels: L = {}, sensors }) {
  const maxSigma = sensors?.terrain?.maxSigma ?? 1500;
  const box = { x: 58, y: 24, w: 330, h: 116 };
  const base = box.y + box.h;
  const xOf = (d) => box.x + box.w * ((d + 700) / 1400);
  const yOf = (c) => base - box.h * Math.min(1, c / 1.25);

  // Cout normalise : 1 = moyenne sur la grille de recherche.
  const rough = (d) => 1 + 0.1 * Math.cos(d / 190) - 0.88 * Math.exp(-((d / 105) ** 2));
  const flat = (d) => 1 + 0.028 * Math.cos(d / 150 + 1.1) - 0.065 * Math.exp(-(((d - 250) / 300) ** 2));

  const sample = (f) => {
    const pts = [];
    for (let i = -700; i <= 700; i += 8) pts.push([xOf(i), yOf(f(i))]);
    return pts;
  };
  const cRough = 1 - rough(0);
  const cFlat = 1 - flat(250);

  return svg(`
    ${axes(box.x, base, box.x + box.w + 14, box.y - 8, { xLabel: L.offset, yLabel: L.cost })}
    ${line(box.x, yOf(1), box.x + box.w, yOf(1), { cls: 'fig-dim', dash: '4 3' })}
    ${text(box.x + 4, yOf(1) - 6, esc(L.mean ?? ''), { cls: 'fig-dim', size: 9.5 })}
    ${polyline(sample(flat), { cls: 'fig-est' })}
    ${polyline(sample(rough), { cls: 'fig-truth' })}
    ${line(xOf(0), yOf(rough(0)), xOf(0), yOf(1), { cls: 'fig-danger' })}
    ${dot(xOf(0), yOf(rough(0)), { r: 3, cls: 'fig-danger-fill' })}
    ${text(xOf(0) - 8, yOf(rough(0)) + 4, esc(L.min ?? ''), { anchor: 'end', cls: 'fig-danger', size: 9.5 })}
    ${dot(xOf(250), yOf(flat(250)), { r: 3, cls: 'fig-est-fill' })}
    ${line(xOf(250), yOf(flat(250)) + 4, xOf(250), base, { cls: 'fig-est', dash: '2 3' })}
    ${text(xOf(250) + 6, base - 8, esc(L.wrongMin ?? ''), { cls: 'fig-est', size: 9.5 })}
    ${text(xOf(-660), yOf(rough(-660)) + 14, esc(L.rugged ?? ''), { cls: 'fig-truth', size: 10 })}
    ${text(box.x + box.w + 12, yOf(flat(660)) - 8, esc(L.flat ?? ''), { anchor: 'end', cls: 'fig-est', size: 10 })}
    ${text(box.x, base + 36, esc(L.contrast ?? ''), { cls: 'fig-dim', size: 10 })}
    ${text(box.x, base + 54, `${esc(L.rugged ?? '')} : ${cRough.toFixed(2)} → ± 325 m`,
    { cls: 'fig-truth', size: 10 })}
    ${text(box.x, base + 70, `${esc(L.flat ?? '')} : ${cFlat.toFixed(2)} → σ > ${maxSigma.toFixed(0)} m — ${esc(L.rejectedOut ?? '')}`,
    { cls: 'fig-est', size: 10 })}
    ${text(box.x, base + 92, esc(L.caption ?? ''), { cls: 'fig-dim', size: 10 })}
  `, { h: 252 });
}

export default {
  specificForce, bodyRates, biasEstimation, sigmaEnvelope,
  starTally, chiSquareGate, terrainContrast,
};
