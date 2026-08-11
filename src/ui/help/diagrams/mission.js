// Schemas du groupe mission.
//
// Le fil conducteur du groupe : le site de tir est la SEULE position vraie que
// le bord possede, l'objectif n'est qu'une constante, et tout ce qui separe le
// point d'impact de l'objectif s'est accumule entre les deux.

import {
  svg, axes, text, polyline, arrow, line, dot, circle, band, rect, ground, legend, esc,
} from '../svg.js';
import { VEHICLES, totalDeltaV } from '../../../sim/vehicle.js';

const OMEGA = 7.292115e-5; // rotation terrestre [rad/s]
const RE = 6371008.8; // rayon moyen [m]

// -------------------------------------------------------------- site de tir

/**
 * Ce que le pas de tir donne, et ce qu'il ne donne pas.
 *
 * A gauche le recalage d'altitude sur le relief (`snapLaunchToTerrain`) : la
 * valeur saisie ne survit pas. A droite le bilan des conditions initiales —
 * deux sont exactes, la troisieme est l'erreur d'alignement, et c'est celle-la
 * qui coutera des kilometres.
 */
export function launchSite({ labels: L, sensors }) {
  const x0 = 20, x1 = 258;
  const elev = (x) => {
    const u = (x - x0) / (x1 - x0);
    return 170 - (12 * Math.sin(u * 7.1 + 0.6) + 7 * Math.sin(u * 17.3 + 2.1) + 4 * Math.sin(u * 31 + 1.2));
  };

  const prof = [];
  for (let x = x0; x <= x1; x += 4) prof.push([x, elev(x)]);

  const padX = 132;
  const padY = elev(padX);
  const typedY = 108;

  const arcmin = sensors?.imu?.alignment ?? 0.5;
  const vSite = OMEGA * RE; // vitesse du sol a l'equateur [m/s]

  // Bilan des conditions initiales : le libelle, sa couleur, sa note.
  const rows = [
    { key: 'position', note: `${L.posNote} ± 3 m`, cls: 'fig-truth', mark: '✓' },
    { key: 'velocity', note: `${L.velNote} — ${vSite.toFixed(0)} m/s · cos φ`, cls: 'fig-truth', mark: '✓' },
    { key: 'attitude', note: `${L.attNote} — ${arcmin.toFixed(2)}′`, cls: 'fig-est', mark: '✗' },
  ];
  const ledger = rows.map((r, i) => {
    const y = 74 + i * 40;
    return `${text(278, y, r.mark, { cls: r.cls, size: 12 })}
      ${text(294, y, esc(L[r.key]), { cls: r.cls, size: 10.5 })}
      ${text(294, y + 14, esc(r.note), { cls: 'fig-dim', size: 9.5 })}`;
  }).join('');

  return svg(`
    ${band([...prof, [x1, 200], [x0, 200]], { cls: 'fig-band' })}
    ${polyline(prof, { cls: 'fig-ground' })}
    ${line(x0 + 6, typedY, x1 - 6, typedY, { cls: 'fig-dim', dash: '3 3' })}
    ${text(x0 + 6, typedY - 6, esc(L.entered), { cls: 'fig-dim', size: 9.5 })}
    ${arrow(padX, typedY + 2, padX, padY - 16, { cls: 'fig-cmd' })}
    ${text(padX + 8, typedY + 26, esc(L.snapped), { cls: 'fig-cmd', size: 9.5 })}
    ${line(padX, padY, padX, padY - 13, { cls: 'fig-truth' })}
    ${dot(padX, padY - 15, { r: 3.5, cls: 'fig-truth-fill' })}
    ${text(padX - 8, padY - 18, esc(L.pad), { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${line(268, 42, 268, 178, { cls: 'fig-dim' })}
    ${text(278, 48, esc(L.ledger), { cls: 'fig-dim', size: 10.5 })}
    ${ledger}
    ${text(20, 220, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

// --------------------------------------------------------------- objectif

/**
 * La soustraction du guidage : un terme exact, un terme estime.
 *
 * L'objectif entre comme une constante ; la position vraie, elle, n'entre
 * jamais — aucun recepteur ne la mesure. Toute l'erreur du calcul est donc
 * portee par le seul terme estime.
 */
export function targetNoReceiver({ labels: L }) {
  const bx = 14, bw = 152, bh = 36, xr = bx + bw;
  const boxes = [
    { y: 18, label: L.truePos, cls: 'fig-truth' },
    { y: 86, label: L.believed, cls: 'fig-est' },
    { y: 154, label: L.targetBox, cls: 'fig-danger' },
  ];
  const b = boxes.map((o) => `
    ${rect(bx, o.y, bw, bh, { cls: `fig-box ${o.cls}-box`, rx: 6 })}
    ${text(bx + bw / 2, o.y + bh / 2 + 4, esc(o.label), { anchor: 'middle', cls: o.cls, size: 10.5 })}`).join('');

  const nx = 272, ny = 122, nr = 19;

  return svg(`
    ${b}
    ${/* la position vraie ne rejoint jamais le calcul : le lien est coupe */ ''}
    ${line(xr, 36, 210, 36, { cls: 'fig-dim', dash: '4 3' })}
    ${line(216, 29, 230, 43, { cls: 'fig-danger' })}
    ${line(230, 29, 216, 43, { cls: 'fig-danger' })}
    ${text(238, 33, esc(L.noLink), { cls: 'fig-danger', size: 10 })}
    ${text(238, 47, esc(L.noLinkNote), { cls: 'fig-dim', size: 9.5 })}
    ${arrow(xr, 104, nx - nr - 4, ny - 6, { cls: 'fig-est' })}
    ${arrow(xr, 172, nx - nr - 4, ny + 8, { cls: 'fig-danger' })}
    ${text(xr + 6, 94, esc(L.believedNote), { cls: 'fig-dim', size: 9.5 })}
    ${text(xr + 6, 188, esc(L.targetNote), { cls: 'fig-dim', size: 9.5 })}
    ${circle(nx, ny, nr, { cls: 'fig-cmd' })}
    ${text(nx, ny + 6, '−', { anchor: 'middle', cls: 'fig-cmd', size: 17 })}
    ${arrow(nx + nr + 3, ny, 336, ny, { cls: 'fig-cmd' })}
    ${rect(340, ny - 20, 126, 40, { cls: 'fig-box fig-cmd-box', rx: 6 })}
    ${text(403, ny + 4, esc(L.vGo), { anchor: 'middle', cls: 'fig-cmd', size: 10.5 })}
    ${text(403, ny + 36, esc(L.vGoNote), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(14, 220, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

// ------------------------------------------------------ profil de trajectoire

// Solutions relevees sur le solveur pour un tir de 3 600 km : apogee [km],
// duree de vol [s] et vitesse requise [km/s] en fonction du degre de cloche.
// Ce sont des sorties de `solveIntercept`, pas des valeurs inventees.
const LOFT_TABLE = [
  { f: 0, apo: 835, tof: 1076, v: 5.44 },
  { f: 0.25, apo: 1339, tof: 1375, v: 5.66 },
  { f: 0.5, apo: 1863, tof: 1675, v: 6.00 },
  { f: 0.75, apo: 2419, tof: 1990, v: 6.34 },
  { f: 1, apo: 2975, tof: 2305, v: 6.69 },
];
const LOFT_RANGE_KM = 3600;

/** Interpolation lineaire dans la table ci-dessus. */
function loftSolution(f) {
  const x = Math.min(1, Math.max(0, f));
  for (let i = 1; i < LOFT_TABLE.length; i++) {
    const a = LOFT_TABLE[i - 1], b = LOFT_TABLE[i];
    if (x <= b.f) {
      const u = (x - a.f) / (b.f - a.f);
      return {
        apo: a.apo + u * (b.apo - a.apo),
        tof: a.tof + u * (b.tof - a.tof),
        v: a.v + u * (b.v - a.v),
      };
    }
  }
  return LOFT_TABLE[LOFT_TABLE.length - 1];
}

/**
 * Cinq trajectoires pour LE MEME couple de points.
 *
 * Meme portee au sol, meme depart, meme arrivee : seule change l'energie
 * investie. Le reglage courant est surligne, et la comparaison des deux
 * lignes du bas dit ce que la cloche coute reellement — du temps de vol.
 */
export function loftProfiles({ labels: L, loft }) {
  const cur = Math.min(1, Math.max(0, loft ?? 0));
  const H = 248;
  const gy = 190, xa = 64, xb = 444;
  const altMax = 3200;
  const py = (km) => gy - (km / altMax) * 160;

  // Arc balistique stylise : plus la cloche est prononcee, plus il est pointu.
  const arcPath = (f) => {
    const { apo } = loftSolution(f);
    const p = 0.8 + 0.6 * f;
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      pts.push([xa + (xb - xa) * u, py(apo * Math.sin(Math.PI * u) ** p)]);
    }
    return pts;
  };

  const ticks = [1000, 2000, 3000].map((km) => `
    ${line(xa - 4, py(km), xa + 4, py(km), { cls: 'fig-axis' })}
    ${text(xa - 8, py(km) + 3.5, String(km), { anchor: 'end', cls: 'fig-dim', size: 9 })}`).join('');

  const others = LOFT_TABLE.map((r) => polyline(arcPath(r.f), { cls: 'fig-dim', dash: '3 3' })).join('');

  const sol = loftSolution(cur);
  const min = LOFT_TABLE[0];
  const apex = arcPath(cur)[30];

  return svg(`
    ${line(xa, gy, xa, 30, { cls: 'fig-axis' })}
    ${ticks}
    ${text(xa - 6, 24, esc(L.axisAlt), { cls: 'fig-axis-label', size: 9.5 })}
    ${ground(xa, xb + 8, gy)}
    ${others}
    ${polyline(arcPath(cur), { cls: 'fig-cmd', width: 2.2 })}
    ${/* rattache l'apogee courante a la graduation, plutot que de poser un
         nombre au milieu du faisceau d'arcs */ ''}
    ${line(xa, apex[1], apex[0], apex[1], { cls: 'fig-cmd', dash: '2 4' })}
    ${dot(apex[0], apex[1], { r: 3.5, cls: 'fig-cmd-fill' })}
    ${text(xa + 6, apex[1] - 5, `${sol.apo.toFixed(0)} km`, { cls: 'fig-cmd', size: 10 })}
    ${dot(xa, gy, { r: 3.5, cls: 'fig-truth-fill' })}
    ${dot(xb, gy, { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(xa, gy + 16, esc(L.launch), { cls: 'fig-truth', size: 9.5 })}
    ${text(xb, gy + 16, esc(L.target), { anchor: 'end', cls: 'fig-danger', size: 9.5 })}
    ${text((xa + xb) / 2, gy + 16, `${esc(L.groundRange)} ${LOFT_RANGE_KM} km`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(xa, 222, `${esc(L.minEnergy)} · φ = 45° − Ψ/4 = 36.9° · ${esc(L.apogee)} ${min.apo} km · ${esc(L.flightTime)} ${min.tof} s`, { cls: 'fig-dim', size: 9.5 })}
    ${text(xa, 238, `${esc(L.current)} ${(cur * 100).toFixed(0)} % · ${esc(L.apogee)} ${sol.apo.toFixed(0)} km · ${esc(L.flightTime)} ${sol.tof.toFixed(0)} s · ${esc(L.required)} ${sol.v.toFixed(2)} km/s`, { cls: 'fig-cmd', size: 9.5 })}
  `, { h: H });
}

// ------------------------------------------------------------ portee utile

/**
 * La portee ne se deduit pas du delta-v.
 *
 * On trace la regle proportionnelle calee sur le vecteur A, puis les portees
 * REELLEMENT mesurees par simulation. L'ecart entre les deux est le sujet du
 * schema : les pertes sont un montant absolu, et le planeur ne retombe meme
 * pas.
 */
export function reachEnvelope({ labels: L, veh }) {
  const gy = 182, xa = 64, xb = 440, top = 32;
  const dvMax = 12, kmMax = 14000;
  const px = (dv) => xa + (dv / dvMax) * (xb - xa);
  const py = (km) => gy - (km / kmMax) * (gy - top);

  const list = ['bal2', 'bal3', 'glide']
    .filter((id) => VEHICLES[id])
    .map((id) => ({ id, dv: totalDeltaV(VEHICLES[id]) / 1000, km: VEHICLES[id].usefulRange / 1000 }));
  const ref = list.find((o) => o.id === 'bal2') ?? list[0];
  const slope = ref ? ref.km / ref.dv : 0; // km de portee par km/s de delta-v

  // Ecart a la regle, pour tout vecteur qui n'est pas celui qui la calibre.
  const gaps = list.filter((o) => o !== ref).map((o) => {
    const pred = slope * o.dv;
    return `${line(px(o.dv), py(pred), px(o.dv), py(o.km), { cls: 'fig-danger' })}
      ${text(px(o.dv) + 6, (py(pred) + py(o.km)) / 2 + 3.5, `× ${(o.km / pred).toFixed(1)}`, { cls: 'fig-danger', size: 10 })}`;
  }).join('');

  // Le vecteur qui cale la regle est pose sur elle : son libelle passe a
  // droite et dessous, sinon la ligne le traverse.
  const pts = list.map((o) => {
    const onRule = o === ref;
    return `${dot(px(o.dv), py(o.km), { r: 4, cls: 'fig-truth-fill' })}
      ${onRule
    ? text(px(o.dv) + 12, py(o.km) + 16, esc(L[o.id] ?? o.id), { cls: 'fig-truth', size: 10 })
    : text(px(o.dv) - 8, py(o.km) - 8, esc(L[o.id] ?? o.id), { anchor: 'end', cls: 'fig-truth', size: 10 })}`;
  }).join('');

  const sel = list.find((o) => o.id === veh?.id);
  const ring = sel ? circle(px(sel.dv), py(sel.km), 9, { cls: 'fig-cmd' }) : '';

  const glide = list.find((o) => o.id === 'glide');
  const note = glide
    ? text(px(glide.dv) - 8, py(glide.km) - 21, esc(L.glideNote), { anchor: 'end', cls: 'fig-dim', size: 9.5 })
    : '';

  const xticks = [2, 4, 6, 8].map((dv) => `
    ${line(px(dv), gy - 4, px(dv), gy + 4, { cls: 'fig-axis' })}
    ${text(px(dv), gy + 16, String(dv), { anchor: 'middle', cls: 'fig-dim', size: 9 })}`).join('');
  const yticks = [5000, 10000].map((km) => `
    ${line(xa - 4, py(km), xa + 4, py(km), { cls: 'fig-axis' })}
    ${text(xa - 8, py(km) + 3.5, String(km), { anchor: 'end', cls: 'fig-dim', size: 9 })}`).join('');

  return svg(`
    ${axes(xa, gy, xb + 14, top - 6, { xLabel: L.axisDv, yLabel: L.axisRange })}
    ${xticks}${yticks}
    ${polyline([[px(0), py(0)], [px(dvMax), py(slope * dvMax)]], { cls: 'fig-dim', dash: '5 4' })}
    ${legend(296, 170, [{ cls: 'fig-dim', dash: '5 4', label: L.rule }])}
    ${gaps}
    ${ring}
    ${pts}
    ${note}
    ${text(xa, 222, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `);
}

export default {
  launchSite, targetNoReceiver, loftProfiles, reachEnvelope,
};
