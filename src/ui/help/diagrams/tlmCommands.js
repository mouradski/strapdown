// Schemas du flux « instructions » : ce que le calculateur ORDONNE.
//
// Fil conducteur du groupe : un ordre n'est jamais qu'un ordre. Il est calcule
// sur l'etat ESTIME, il agit sur des actionneurs qui ne produisent aucune force
// par eux-memes, et rien dans la boucle ne verifie qu'il a produit l'effet
// espere. Chaque schema doit montrer ce mecanisme plutot que le nommer.
//
// Plusieurs schemas lisent le vehicule courant (`ctx.veh`) : les durees de
// combustion, la finesse et la gite maximale sont des proprietes du vecteur, et
// les voir changer avec lui vaut mieux qu'une valeur figee.

import {
  svg, axes, text, polyline, arrow, line, dot, circle, arc, band,
  legend, rect, ground, esc,
} from '../svg.js';
import {
  VEHICLES, burnTime, glideCoefficients, bestGlideAoA, equilibriumGlideRange,
} from '../../../sim/vehicle.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Vecteur courant, avec repli sur un vecteur balistique plausible. */
const pickVeh = (veh) => (veh && Array.isArray(veh.stages) && veh.stages.length ? veh : VEHICLES.bal2);
/** Corps porteur courant, avec repli : les fiches d'incidence et de gite n'ont
 *  de sens que pour un planeur, meme si le vecteur selectionne est balistique. */
const pickGlider = (veh) => (veh && veh.glide ? veh : VEHICLES.glide);

const kmTxt = (m) => (Math.abs(m) >= 1e6 ? `${(m / 1000).toFixed(0)} km` : `${(m / 1000).toFixed(1)} km`);

// Tir de reference du simulateur (bal2, 1912 km) : portee, vitesse et instant
// d'extinction mesures sur un vol complet. Ils servent a coter les schemas.
const REF = { range: 1912e3, cutoffSpeed: 3987, cutoffTime: 113.5 };
/** Sensibilite balistique : 1 m/s d'erreur a l'extinction coute 2R/v en portee. */
const dRdV = (2 * REF.range) / REF.cutoffSpeed; // ≈ 960 m par m/s

// Loi d'attitude du simulateur (voir attitudeRateCommand et world.js) : gain
// proportionnel, et saturation differente selon que la pile pousse ou non.
const GAIN = 1.4;
const RATE_BOOST = 0.12 * RAD; // ≈ 6,9 °/s
const RATE_COAST = 0.25 * RAD; // ≈ 14,3 °/s

/**
 * Poussee commandee et ergols restants, sur toute la duree propulsee.
 *
 * Le point du schema : la manette n'a que deux positions. Toute la modulation
 * de portee tient dans l'INSTANT de l'extinction, et le dernier etage est
 * coupe avec ses reservoirs encore partiellement pleins.
 */
export function thrustTimeline({ labels: L, veh }) {
  const v = pickVeh(veh);
  const st = v.stages;
  const burns = st.map((_, i) => burnTime(v, i));
  const total = burns.reduce((a, b) => a + b, 0);
  // Fraction du dernier etage laissee dans les reservoirs a l'extinction : 15 %
  // sur le tir de reference (587 kg sur 3900).
  const LEFT = 0.15;
  const last = st.length - 1;
  const tCut = total - LEFT * burns[last];
  const tEnd = total * 1.03;

  const x0 = 46, x1 = 452;
  const px = (t) => x0 + (t / tEnd) * (x1 - x0);
  const fMax = Math.max(...st.map((s) => s.thrustVac));

  const yA0 = 94, yA1 = 28; // panneau poussee
  const pyF = (f) => yA0 - (f / fMax) * (yA0 - yA1);
  const yB0 = 192, yB1 = 136; // panneau ergols
  const pyP = (frac) => yB0 - frac * (yB0 - yB1);

  const thrustPts = [];
  const propPts = [];
  const seps = [];
  const stageMarks = [];
  let t = 0;
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    const t0 = t, t1 = t + burns[i];
    const isLast = i === last;
    const stop = isLast ? tCut : t1;
    // Montee de poussee du premier etage : la pression ambiante cesse de
    // s'exercer sur la section de sortie de tuyere.
    const ramp = Math.min(burns[i] * 0.55, 45);
    thrustPts.push([px(t0), pyF(s.thrustSL)]);
    thrustPts.push([px(Math.min(t0 + ramp, stop)), pyF(s.thrustVac)]);
    thrustPts.push([px(stop), pyF(s.thrustVac)]);
    thrustPts.push([px(stop), pyF(0)]);
    propPts.push([px(t0), pyP(1)]);
    propPts.push([px(stop), pyP(isLast ? LEFT : 0)]);
    if (!isLast) {
      thrustPts.push([px(t1), pyF(0)]);
      propPts.push([px(t1), pyP(1)]);
      seps.push(t1);
    }
    stageMarks.push([px((t0 + stop) / 2), i + 1]);
    t = t1;
  }

  const fill = band([[px(0), yA0], ...thrustPts, [px(tCut), yA0]], { cls: 'fig-band' });
  const leftKg = LEFT * st[last].propMass;
  const vacGain = ((st[0].thrustVac / st[0].thrustSL - 1) * 100);

  return svg(`
    ${fill}
    ${seps.map((s) => `${line(px(s), yA1 - 2, px(s), yA0, { cls: 'fig-dim', dash: '2 4' })}
      ${line(px(s), yB1, px(s), yB0, { cls: 'fig-dim', dash: '2 4' })}`).join('')}
    ${polyline(thrustPts, { cls: 'fig-cmd' })}
    ${/* ce qui aurait brule si personne n'avait coupe */ ''}
    ${polyline([[px(tCut), pyF(st[last].thrustVac)], [px(total), pyF(st[last].thrustVac)],
    [px(total), pyF(0)]], { cls: 'fig-dim', dash: '3 3' })}
    ${band([[px(tCut), yB0], [px(tCut), pyP(LEFT)], [px(total), pyP(LEFT)], [px(total), yB0]],
    { cls: 'fig-band-danger' })}
    ${line(x0, pyP(LEFT), px(total) + 6, pyP(LEFT), { cls: 'fig-danger', dash: '3 4' })}
    ${polyline(propPts, { cls: 'fig-truth' })}
    ${polyline([[px(tCut), pyP(LEFT)], [px(total), pyP(0)]], { cls: 'fig-danger', dash: '3 3' })}
    ${axes(x0, yB0, x1 + 14, yB1 - 8, { xLabel: L.time })}
    ${line(px(tCut), yA1 - 8, px(tCut), yB0 + 4, { cls: 'fig-danger' })}
    ${dot(px(tCut), pyF(0), { r: 3, cls: 'fig-danger-fill' })}
    ${text(px(tCut) - 6, yA1 - 12, esc(L.cutoff), { anchor: 'end', cls: 'fig-danger', size: 10.5 })}
    ${text(x0, 20, esc(L.thrust), { cls: 'fig-cmd', size: 10.5 })}
    ${text(x1, 20, `${(fMax / 1000).toFixed(0)} kN`, { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${text(x0, 110, esc(L.onOff), { cls: 'fig-dim', size: 9.5 })}
    ${text(x0, 126, esc(L.propellant), { cls: 'fig-truth', size: 10.5 })}
    ${stageMarks.map(([x, n]) => text(x, 42, `${esc(L.stage)} ${n}`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })).join('')}
    ${text(px(tCut) - 8, pyP(LEFT) - 8, `${esc(L.unused)} : ${leftKg.toFixed(0)} kg`, { anchor: 'end', cls: 'fig-danger', size: 10 })}
    ${text(px(burns[0] * 0.55) + 6, pyF(st[0].thrustVac) - 6, `${esc(L.vacuum)} +${vacGain.toFixed(0)} %`, { cls: 'fig-dim', size: 9.5 })}
    ${text(x0, 228, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 238 });
}

/**
 * Le critere d'extinction.
 *
 * On ne coupe pas quand la vitesse a gagner s'annule — avec un moteur non
 * modulable elle peut repartir a la hausse sans passer par zero. On coupe sur
 * une grandeur scalaire et MONOTONE : la portee du point d'impact predit.
 */
export function cutoffDecision({ labels: L }) {
  // Le cadre s'arrete tot : tout ce qui est a droite du trait d'extinction sert
  // au prolongement fantome et a son libelle, qui ne doivent pas chevaucher le
  // trait rouge.
  const bx = { x0: 44, x1: 330, yTop: 44, yBot: 162 };
  const xr = 396; // fin du prolongement fantome
  const px = (u) => bx.x0 + u * (bx.x1 - bx.x0);

  // Erreur de portee : negative, croissante, et de plus en plus vite — la
  // portee predite gagne des kilometres par metre par seconde acquis.
  const errY = (u) => bx.yBot - (1 - (1 - u) ** 0.78) * (bx.yBot - bx.yTop);
  // Vitesse a gagner : elle descend, mais rien ne garantit qu'elle atteigne 0.
  const goY = (u) => bx.yBot - ((1 - u) ** 0.85) * (bx.yBot - bx.yTop) * 0.92;

  const N = 48;
  const errPts = [], goPts = [];
  for (let i = 0; i <= N; i++) { const u = i / N; errPts.push([px(u), errY(u)]); goPts.push([px(u), goY(u)]); }
  // Ce que ferait la vitesse a gagner si l'on continuait a pousser : le module
  // de vitesse est deja atteint, l'orientation ne l'est pas, elle remonte.
  const ghost = [];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16;
    ghost.push([bx.x1 + s * (xr - bx.x1), bx.yBot - s * s * 46]);
  }

  return svg(`
    ${axes(bx.x0, bx.yBot, xr + 10, bx.yTop - 14, { xLabel: L.time })}
    ${line(bx.x0, bx.yTop, xr, bx.yTop, { cls: 'fig-danger', dash: '4 4' })}
    ${text(bx.x0 + 4, bx.yTop - 6, esc(L.targetRange), { cls: 'fig-danger', size: 10 })}
    ${polyline(errPts, { cls: 'fig-cmd' })}
    ${polyline(goPts, { cls: 'fig-est' })}
    ${polyline(ghost, { cls: 'fig-est', dash: '3 3' })}
    ${line(bx.x1, bx.yTop - 12, bx.x1, bx.yBot + 8, { cls: 'fig-danger' })}
    ${dot(bx.x1, bx.yTop, { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(bx.x1 - 6, bx.yTop - 18, esc(L.cutoff), { anchor: 'end', cls: 'fig-danger', size: 10.5 })}
    ${text(bx.x1 + 6, bx.yBot - 56, esc(L.rise), { cls: 'fig-est', size: 9.5 })}
    ${/* une note par ligne : en anglais, la legende et la cadence mises cote a
        cote depassent ensemble la largeur du cadre */ ''}
    ${legend(bx.x0, bx.yBot + 24, [
    { cls: 'fig-cmd', label: L.rangeErr },
    { cls: 'fig-est', label: L.vGo },
  ])}
    ${text(bx.x0, bx.yBot + 54, esc(L.cadence), { cls: 'fig-dim', size: 9.5 })}
    ${text(bx.x0, bx.yBot + 68, `${esc(L.sensitivity)} ${(dRdV).toFixed(0)} m`, { cls: 'fig-dim', size: 9.5 })}
    ${text(bx.x0, 246, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 254 });
}

/**
 * Les quatre modes de pilotage et les deux facons de construire une attitude.
 *
 * Le mode ne dit pas ce que fait le vehicule : il dit QUELLE VOIE de commande
 * est lue. En balistique aucune des deux n'est alimentee — l'incidence et la
 * gite commandees valent zero, et rien n'est pilote du tout.
 */
export function steeringModes({ labels: L }) {
  const chips = [
    { y: 26, label: L.boost, sub: L.chanThrust, cls: 'fig-cmd', to: 'thrust' },
    { y: 66, label: L.midcourse, sub: L.chanThrust, cls: 'fig-cmd', to: 'thrust' },
    { y: 112, label: L.ballistic, sub: L.chanZero, cls: 'fig-dim', to: 'wind' },
    { y: 152, label: L.glide, sub: L.chanAngles, cls: 'fig-cmd', to: 'wind' },
  ];
  const cx0 = 14, cw = 124, ch = 34;
  const bx0 = 190, bw = 132, bh = 46;
  const yThrust = 32, yWind = 126;

  const chip = (c) => `
    ${rect(cx0, c.y, cw, ch, { cls: `fig-box ${c.cls === 'fig-dim' ? 'fig-danger' : c.cls}-box`, rx: 6 })}
    ${text(cx0 + cw / 2, c.y + 14, esc(c.label), { anchor: 'middle', cls: c.cls === 'fig-dim' ? 'fig-danger' : c.cls, size: 10.5 })}
    ${text(cx0 + cw / 2, c.y + 27, esc(c.sub), { anchor: 'middle', cls: 'fig-dim', size: 9 })}
    ${arrow(cx0 + cw, c.y + ch / 2, bx0 - 2, (c.to === 'thrust' ? yThrust : yWind) + bh / 2)}`;

  const box = (y, title, sub, cls) => `
    ${rect(bx0, y, bw, bh, { cls: `fig-box ${cls}-box`, rx: 6 })}
    ${text(bx0 + bw / 2, y + 19, esc(title), { anchor: 'middle', cls, size: 10.5 })}
    ${text(bx0 + bw / 2, y + 34, esc(sub), { anchor: 'middle', cls: 'fig-dim', size: 9 })}`;

  const ox = 358, oy = 78, ow = 108, oh = 46;

  return svg(`
    ${chips.map(chip).join('')}
    ${box(yThrust, L.thrustBuilder, L.thrustBuilderSub, 'fig-cmd')}
    ${box(yWind, L.windBuilder, L.windBuilderSub, 'fig-cmd')}
    ${arrow(bx0 + bw, yThrust + bh / 2, ox - 2, oy + 14)}
    ${arrow(bx0 + bw, yWind + bh / 2, ox - 2, oy + oh - 14)}
    ${rect(ox, oy, ow, oh, { cls: 'fig-box fig-cmd-box', rx: 6 })}
    ${text(ox + ow / 2, oy + 19, esc(L.output), { anchor: 'middle', cls: 'fig-cmd', size: 10.5 })}
    ${text(ox + ow / 2, oy + 34, esc(L.outputSub), { anchor: 'middle', cls: 'fig-dim', size: 9 })}
    ${text(cx0, 208, esc(L.noControl), { cls: 'fig-danger', size: 10 })}
    ${text(cx0, 224, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 236 });
}

/**
 * La chaine d'attitude, et sa limite.
 *
 * Tourner n'accelere rien. La rotation commandee ne fait qu'ORIENTER le corps ;
 * la force, s'il y en a une, est produite par le moteur ou par l'air. Dans le
 * vide et moteur eteint, la meme commande ne change strictement rien.
 */
export function attitudeChain({ labels: L }) {
  const boxes = [
    { x: 4, label: L.order, cls: 'fig-cmd' },
    { x: 124, label: L.error, cls: 'fig-est' },
    { x: 244, label: L.rate, cls: 'fig-cmd' },
    { x: 364, label: L.body, cls: 'fig-truth' },
  ];
  const bw = 112, bh = 40, by = 26;
  const chain = boxes.map((o) => `
    ${rect(o.x, by, bw, bh, { cls: `fig-box ${o.cls}-box`, rx: 6 })}
    ${text(o.x + bw / 2, by + bh / 2 + 4, esc(o.label), { anchor: 'middle', cls: o.cls, size: 10 })}`).join('');
  const links = boxes.slice(0, -1)
    .map((o) => arrow(o.x + bw, by + bh / 2, o.x + bw + 6, by + bh / 2)).join('');

  const yBar = 122;
  const xL = 118, xR = 340;
  const yOut = 150, oh = 46;

  return svg(`
    ${chain}
    ${links}
    ${text(300, by + bh + 16, `ω = ${GAIN.toFixed(1)} · ψ`, { anchor: 'middle', cls: 'fig-cmd', size: 10 })}
    ${text(300, by + bh + 30, `${esc(L.satBoost)} ${RATE_BOOST.toFixed(1)} °/s`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(300, by + bh + 43, `${esc(L.satCoast)} ${RATE_COAST.toFixed(1)} °/s`, { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${line(420, by + bh, 420, yBar, { cls: 'fig-dim' })}
    ${line(xL, yBar, 420, yBar, { cls: 'fig-dim' })}
    ${arrow(xR, yBar, xR, yOut - 2, { cls: 'fig-truth' })}
    ${arrow(xL, yBar, xL, yOut - 2, { cls: 'fig-danger' })}
    ${/* cale a droite : la branche « avec force » porte le libelle le plus long */ ''}
    ${text(474, yBar + 20, esc(L.ifForce), { anchor: 'end', cls: 'fig-truth', size: 9.5 })}
    ${text(xL - 6, yBar + 20, esc(L.ifNone), { anchor: 'end', cls: 'fig-danger', size: 9.5 })}
    ${rect(252, yOut, 176, oh, { cls: 'fig-box fig-truth-box', rx: 6 })}
    ${text(340, yOut + 19, esc(L.force), { anchor: 'middle', cls: 'fig-truth', size: 10.5 })}
    ${text(340, yOut + 34, esc(L.forceSub), { anchor: 'middle', cls: 'fig-dim', size: 9 })}
    ${rect(30, yOut, 176, oh, { cls: 'fig-box fig-danger-box', rx: 6 })}
    ${text(118, yOut + 19, esc(L.none), { anchor: 'middle', cls: 'fig-danger', size: 10.5 })}
    ${text(118, yOut + 34, esc(L.noneSub), { anchor: 'middle', cls: 'fig-dim', size: 9 })}
    ${text(30, 222, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 232 });
}

/**
 * Repere vent : ce que fixe l'incidence.
 *
 * A gauche, la geometrie — la portance est perpendiculaire au VENT, pas au
 * corps. A droite, la courbe de finesse : elle est si plate au sommet que
 * toute la plage d'incidence disponible n'en fait perdre qu'un dixieme. C'est
 * pourquoi un planeur ne peut pas dissiper en jouant de l'incidence.
 */
export function windFrame({ labels: L, veh }) {
  const g = pickGlider(veh);
  const best = bestGlideAoA(g);
  const cBest = glideCoefficients(g, best);
  const eBest = cBest.cl / cBest.cd;
  const maxA = g.glide.maxAoA;
  const cMax = glideCoefficients(g, maxA);
  const eMax = cMax.cl / cMax.cd;

  // --- panneau gauche : geometrie ---
  const ax = 22, ay = 152, aLen = 190;
  const shown = 22 * DEG; // incidence dessinee, exageree pour la lisibilite
  const nose = [ax + 146 * Math.cos(shown), ay - 146 * Math.sin(shown)];
  // Point d'application des forces, place avant le nez pour laisser la place
  // aux libelles.
  const fp = [ax + 84 * Math.cos(shown), ay - 84 * Math.sin(shown)];

  // --- panneau droit : finesse(incidence) ---
  const bx = { x: 286, y: 52, w: 170, h: 100 };
  const aMin = 2 * DEG;
  const yMax = eBest * 1.18;
  const pxA = (a) => bx.x + ((a - aMin) / (maxA - aMin)) * bx.w;
  const pyE = (e) => bx.y + bx.h - (e / yMax) * bx.h;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = aMin + ((maxA - aMin) * i) / 40;
    const c = glideCoefficients(g, a);
    pts.push([pxA(a), pyE(c.cd > 0 ? c.cl / c.cd : 0)]);
  }

  return svg(`
    ${arrow(ax, ay, ax + aLen, ay, { cls: 'fig-truth' })}
    ${text(ax + aLen, ay + 15, esc(L.velocity), { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${arrow(ax, ay, nose[0], nose[1], { cls: 'fig-cmd' })}
    ${text(nose[0] + 6, nose[1] + 2, esc(L.bodyAxis), { cls: 'fig-cmd', size: 10 })}
    ${arc(ax, ay, 58, 0, shown, { cls: 'fig-dim' })}
    ${text(ax + 66, ay - 10, 'α', { cls: 'fig-dim', size: 12 })}
    ${arrow(fp[0], fp[1], fp[0], fp[1] - 54, { cls: 'fig-truth' })}
    ${text(fp[0] + 5, fp[1] - 58, esc(L.lift), { cls: 'fig-truth', size: 10 })}
    ${arrow(fp[0], fp[1], fp[0] - 56, fp[1], { cls: 'fig-truth', dash: '4 3' })}
    ${text(fp[0] - 60, fp[1] - 5, esc(L.drag), { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${/* ligne pleine largeur : la phrase court sous les deux panneaux */ ''}
    ${text(ax, 206, esc(L.perp), { cls: 'fig-dim', size: 9.5 })}

    ${axes(bx.x, bx.y + bx.h, bx.x + bx.w + 18, bx.y - 10, { xLabel: L.aoaAxis, yLabel: L.finesse })}
    ${polyline(pts, { cls: 'fig-cmd' })}
    ${band([[pxA(best), pyE(eBest)], [pxA(maxA) + 14, pyE(eBest)], [pxA(maxA) + 14, pyE(eMax)], [pxA(best), pyE(eMax)]], { cls: 'fig-band-danger' })}
    ${line(pxA(best), pyE(eBest), pxA(maxA) + 14, pyE(eBest), { cls: 'fig-dim', dash: '2 3' })}
    ${line(pxA(maxA), pyE(eMax), pxA(maxA) + 14, pyE(eMax), { cls: 'fig-dim', dash: '2 3' })}
    ${dot(pxA(best), pyE(eBest), { r: 3.5, cls: 'fig-cmd-fill' })}
    ${dot(pxA(maxA), pyE(eMax), { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(pxA(best), pyE(eBest) - 12, `${esc(L.best)} ${eBest.toFixed(2)}`, { anchor: 'middle', cls: 'fig-cmd', size: 9.5 })}
    ${text(bx.x + bx.w + 16, pyE(eMax) + 14, `${esc(L.maxA)} ${eMax.toFixed(2)}`, { anchor: 'end', cls: 'fig-danger', size: 9.5 })}
    ${text(bx.x, bx.y + bx.h + 32, `${esc(L.drop)} ${((1 - eMax / eBest) * 100).toFixed(0)} %`, { cls: 'fig-danger', size: 10 })}
    ${text(ax, 222, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 234 });
}

/**
 * Gite : ce qui oriente le plan de la portance.
 *
 * A gauche, la decomposition vue de l'arriere — en virage il ne reste que
 * L·cos μ pour porter. A droite, la consequence : la portee du plane suit
 * cos μ, et toute la plage d'incidence ne vaut que ce que donnent 25° de gite.
 */
export function bankLift({ labels: L, veh }) {
  const g = pickGlider(veh);
  const best = bestGlideAoA(g);
  const cB = glideCoefficients(g, best);
  const eBest = cB.cl / cB.cd;
  const cM = glideCoefficients(g, g.glide.maxAoA);
  const eMax = cM.cl / cM.cd;
  const maxBank = g.glide.maxBank;
  const vStart = 6000, vEnd = g.glide.minSpeed;

  // --- vue arriere ---
  const cx = 92, cy = 128, len = 78;
  const mu = 42 * DEG; // gite dessinee
  const tip = [cx + len * Math.sin(mu), cy - len * Math.cos(mu)];
  const vert = cy - len * Math.cos(mu);

  // --- portee(gite) ---
  const bx = { x: 288, y: 46, w: 166, h: 104 };
  const r0 = equilibriumGlideRange(vStart, vEnd, eBest);
  const rOf = (m) => equilibriumGlideRange(vStart, vEnd, eBest * Math.cos(m));
  const pxB = (m) => bx.x + (m / maxBank) * bx.w;
  const pyR = (r) => bx.y + bx.h - (r / (r0 * 1.06)) * bx.h;
  const pts = [];
  for (let i = 0; i <= 40; i++) { const m = (maxBank * i) / 40; pts.push([pxB(m), pyR(rOf(m))]); }
  // Gite equivalente a toute la plage d'incidence : cos μ = E(αmax)/E(αopt).
  const muEq = Math.acos(Math.max(0, Math.min(1, eMax / eBest)));

  return svg(`
    ${line(cx, cy, cx, cy - len - 12, { cls: 'fig-dim', dash: '3 3' })}
    ${circle(cx, cy, 9, { cls: 'fig-dim' })}
    ${arrow(cx, cy, tip[0], tip[1], { cls: 'fig-truth' })}
    ${text(tip[0] + 6, tip[1] - 2, esc(L.lift), { cls: 'fig-truth', size: 10 })}
    ${line(cx, vert, tip[0], vert, { cls: 'fig-dim', dash: '2 3' })}
    ${line(tip[0], vert, tip[0], cy, { cls: 'fig-dim', dash: '2 3' })}
    ${arrow(cx, cy, cx, vert, { cls: 'fig-truth', dash: '5 3' })}
    ${text(cx - 8, vert + 4, esc(L.vertical), { anchor: 'end', cls: 'fig-truth', size: 10 })}
    ${arrow(cx, cy, tip[0], cy, { cls: 'fig-cmd' })}
    ${text(tip[0] + 6, cy + 12, esc(L.horizontal), { cls: 'fig-cmd', size: 10 })}
    ${arc(cx, cy, 34, Math.PI / 2, Math.PI / 2 - mu, { cls: 'fig-danger' })}
    ${text(cx + 12, cy - 42, 'μ', { cls: 'fig-danger', size: 12 })}
    ${arrow(cx, cy, cx, cy + 44, { cls: 'fig-dim' })}
    ${text(cx - 6, cy + 42, esc(L.weight), { anchor: 'end', cls: 'fig-dim', size: 9.5 })}
    ${sTrack(20, 190, 210, L)}

    ${axes(bx.x, bx.y + bx.h, bx.x + bx.w + 18, bx.y - 10, { xLabel: L.bankAxis, yLabel: L.rangeAxis })}
    ${polyline(pts, { cls: 'fig-cmd' })}
    ${line(bx.x, pyR(rOf(muEq)), pxB(muEq), pyR(rOf(muEq)), { cls: 'fig-est', dash: '4 3' })}
    ${line(pxB(muEq), pyR(rOf(muEq)), pxB(muEq), bx.y + bx.h, { cls: 'fig-est', dash: '4 3' })}
    ${dot(pxB(muEq), pyR(rOf(muEq)), { r: 3, cls: 'fig-est-fill' })}
    ${text(pxB(muEq) - 6, pyR(rOf(muEq)) - 7, `${esc(L.aoaOnly)} ${(muEq * RAD).toFixed(0)}°`, { anchor: 'end', cls: 'fig-est', size: 9.5 })}
    ${dot(pxB(maxBank), pyR(rOf(maxBank)), { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(bx.x + bx.w + 16, pyR(rOf(maxBank)) + 16, `${esc(L.maxBank)} ${(maxBank * RAD).toFixed(0)}°`, { anchor: 'end', cls: 'fig-danger', size: 9.5 })}
    ${text(bx.x, bx.y + bx.h + 32, `${(r0 / 1000).toFixed(0)} → ${(rOf(maxBank) / 1000).toFixed(0)} km`, { cls: 'fig-danger', size: 10 })}
    ${text(20, 230, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 242 });
}

/** Petit encart : la trace en S, qui brule de l'energie sans deriver du cap. */
function sTrack(x, y, w, L) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    pts.push([x + u * w, y - 9 * Math.sin(u * 3 * Math.PI)]);
  }
  return `
    ${line(x, y, x + w, y, { cls: 'fig-dim', dash: '3 3' })}
    ${polyline(pts, { cls: 'fig-cmd' })}
    ${text(x, y + 20, esc(L.sTurn), { cls: 'fig-dim', size: 9.5 })}`;
}

/**
 * La vitesse a gagner, et l'erreur qu'elle ne peut pas voir.
 *
 * Le triangle est resolu depuis la position ESTIMEE. Si la vraie position est
 * ailleurs, la vitesse requise vraie est un autre vecteur — et rien a bord ne
 * distingue les deux.
 */
export function velocityToGain({ labels: L }) {
  const oE = [66, 150];
  const tEst = [250, 100];
  const tReq = [330, 44];
  const oT = [86, 168];
  const tTrue = [346, 74];

  // Les points intermediaires disent que la pointe du vecteur vitesse remonte
  // vers la pointe du vecteur requis : c'est la poussee qui referme le triangle.
  const marks = [0.34, 0.67].map((s) => dot(
    tEst[0] + s * (tReq[0] - tEst[0]),
    tEst[1] + s * (tReq[1] - tEst[1]),
    { r: 2.5, cls: 'fig-est-fill' },
  )).join('');

  return svg(`
    ${arrow(oE[0], oE[1], tEst[0], tEst[1], { cls: 'fig-est' })}
    ${text(tEst[0] + 6, tEst[1] + 24, esc(L.vEst), { cls: 'fig-est', size: 10.5 })}
    ${arrow(oE[0], oE[1], tReq[0], tReq[1], { cls: 'fig-cmd' })}
    ${text(222, 80, esc(L.vReq), { anchor: 'end', cls: 'fig-cmd', size: 10.5 })}
    ${arrow(tEst[0], tEst[1], tReq[0], tReq[1], { cls: 'fig-cmd' })}
    ${marks}
    ${text(tReq[0] + 8, 40, esc(L.vGo), { cls: 'fig-cmd', size: 10.5 })}
    ${text(tReq[0] + 8, 54, esc(L.shrinks), { cls: 'fig-dim', size: 9.5 })}
    ${dot(oE[0], oE[1], { r: 4, cls: 'fig-est-fill' })}
    ${arrow(oT[0], oT[1], tTrue[0], tTrue[1], { cls: 'fig-truth', dash: '4 3' })}
    ${dot(oT[0], oT[1], { r: 4, cls: 'fig-truth-fill' })}
    ${text(452, tTrue[1] + 14, esc(L.trueReq), { anchor: 'end', cls: 'fig-truth', size: 9.5 })}
    ${dot(34, 186, { r: 4, cls: 'fig-est-fill' })}
    ${text(46, 190, esc(L.posEst), { cls: 'fig-est', size: 10 })}
    ${dot(34, 206, { r: 4, cls: 'fig-truth-fill' })}
    ${text(46, 210, esc(L.posTrue), { cls: 'fig-truth', size: 10 })}
    ${text(250, 190, esc(L.formula), { cls: 'fig-cmd', size: 10.5 })}
    ${text(30, 230, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 240 });
}

/**
 * Sensibilite de la portee a l'extinction, et ce que le guidage ne voit pas.
 *
 * L'agrandissement du bas est indispensable : a l'echelle de l'arc, un
 * kilometre ne fait pas un cinquieme de pixel.
 */
export function rangeSensitivity({ labels: L }) {
  const gy = 108;
  const xa = 34, xb = 404;
  const arcPts = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    arcPts.push([xa + u * (xb - xa), gy - 74 * Math.sin(Math.PI * u)]);
  }
  const uBo = 0.17;
  const bo = [xa + uBo * (xb - xa), gy - 74 * Math.sin(Math.PI * uBo)];

  // Agrandissement : 1 km = 19 px.
  const S = 19 / 1000;
  const zx = 154, zy = 138, zw = 300, zh = 62;
  const cxT = zx + 152, cyT = zy + 34;
  const xDv = cxT + dRdV * S;
  const xNav = cxT - 2000 * S;

  return svg(`
    ${ground(20, 452, gy)}
    ${polyline(arcPts, { cls: 'fig-cmd' })}
    ${dot(bo[0], bo[1], { r: 3.5, cls: 'fig-cmd-fill' })}
    ${text(bo[0] + 8, bo[1] + 16, esc(L.burnout), { cls: 'fig-cmd', size: 10 })}
    ${circle(xb - 2, gy - 8, 13, { cls: 'fig-dim', dash: '3 3' })}
    ${line(xb - 12, gy + 2, zx + zw, zy, { cls: 'fig-dim', dash: '3 3' })}
    ${text(20, 30, `ΔR ≈ (2R / v) · Δv`, { cls: 'fig-dim', size: 10.5 })}
    ${text(20, 45, `2 × ${(REF.range / 1000).toFixed(0)} km / ${REF.cutoffSpeed} m/s ≈ ${(dRdV).toFixed(0)} m`, { cls: 'fig-dim', size: 9.5 })}
    ${rect(zx, zy, zw, zh, { cls: 'fig-box', rx: 5 })}
    ${line(zx + 10, cyT, zx + zw - 10, cyT, { cls: 'fig-dim' })}
    ${line(cxT - 7, cyT - 7, cxT + 7, cyT + 7, { cls: 'fig-danger' })}
    ${line(cxT - 7, cyT + 7, cxT + 7, cyT - 7, { cls: 'fig-danger' })}
    ${text(cxT, zy + 16, esc(L.target), { anchor: 'middle', cls: 'fig-danger', size: 9.5 })}
    ${dot(xDv, cyT, { r: 3.5, cls: 'fig-danger-fill' })}
    ${text(xDv + 6, cyT + 14, esc(L.dvShift), { cls: 'fig-danger', size: 9.5 })}
    ${dot(xNav, cyT, { r: 3.5, cls: 'fig-est-fill' })}
    ${text(xNav - 6, cyT - 8, esc(L.navShift), { anchor: 'end', cls: 'fig-est', size: 9.5 })}
    ${line(zx + 16, zy + zh - 10, zx + 16 + 1000 * S, zy + zh - 10, { cls: 'fig-dim' })}
    ${line(zx + 16, zy + zh - 13, zx + 16, zy + zh - 7, { cls: 'fig-dim' })}
    ${line(zx + 16 + 1000 * S, zy + zh - 13, zx + 16 + 1000 * S, zy + zh - 7, { cls: 'fig-dim' })}
    ${text(zx + 20 + 1000 * S, zy + zh - 7, '1 km', { cls: 'fig-dim', size: 9 })}
    ${text(zx, zy - 6, esc(L.zoom), { cls: 'fig-dim', size: 9.5 })}
    ${text(20, 216, esc(L.invisible), { cls: 'fig-est', size: 10 })}
    ${text(20, 231, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 240 });
}

/**
 * Le point vise n'est pas la cible.
 *
 * Deux decalages de nature differente : un decalage EN PORTEE, qui compense le
 * freinage de rentree que la solution keplerienne ignore, et un decalage
 * LATERAL, qui compense la deviation que le critere d'extinction — scalaire —
 * laisserait passer.
 */
export function aimOffset({ labels: L }) {
  const route = 106;
  const xT = 300, xP = 232;
  const aim = [368, 73];
  const S = 38 / 1000; // 38 px = 1 km

  return svg(`
    ${arrow(24, route, 452, route, { cls: 'fig-dim', dash: '5 4' })}
    ${text(24, route + 16, esc(L.route), { cls: 'fig-dim', size: 9.5 })}
    ${line(xT - 8, route - 8, xT + 8, route + 8, { cls: 'fig-danger' })}
    ${line(xT - 8, route + 8, xT + 8, route - 8, { cls: 'fig-danger' })}
    ${text(xT, route + 32, esc(L.target), { anchor: 'middle', cls: 'fig-danger', size: 10 })}
    ${dot(xP, route, { r: 4, cls: 'fig-est-fill' })}
    ${text(xP, route + 32, esc(L.predicted), { anchor: 'middle', cls: 'fig-est', size: 10 })}
    ${arrow(xP, route - 14, xT, route - 14, { cls: 'fig-est' })}
    ${text((xP + xT) / 2, route - 20, esc(L.shortfall), { anchor: 'middle', cls: 'fig-est', size: 9.5 })}
    ${arrow(xT, route - 14, aim[0], aim[1] - 4, { cls: 'fig-cmd' })}
    ${dot(aim[0], aim[1], { r: 4, cls: 'fig-cmd-fill' })}
    ${text(aim[0] + 8, aim[1] + 4, esc(L.aim), { cls: 'fig-cmd', size: 10 })}
    ${line(xT, route, aim[0], route, { cls: 'fig-dim', dash: '2 3' })}
    ${line(aim[0], route, aim[0], aim[1], { cls: 'fig-dim', dash: '2 3' })}
    ${text((xT + aim[0]) / 2, route + 14, esc(L.downrange), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(aim[0] + 6, route - 8, esc(L.crossTrack), { cls: 'fig-dim', size: 9.5 })}
    ${line(30, 170, 30 + 1000 * S, 170, { cls: 'fig-dim' })}
    ${line(30, 167, 30, 173, { cls: 'fig-dim' })}
    ${line(30 + 1000 * S, 167, 30 + 1000 * S, 173, { cls: 'fig-dim' })}
    ${text(34 + 1000 * S, 173, '1 km', { cls: 'fig-dim', size: 9 })}
    ${text(24, 28, esc(L.why), { cls: 'fig-dim', size: 10 })}
    ${text(24, 202, esc(L.gain), { cls: 'fig-cmd', size: 10 })}
    ${text(24, 226, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 236 });
}

/**
 * Pourquoi la visee se gele.
 *
 * La boucle de raffinement se mord la queue : corriger la visee change la
 * vitesse requise, donc la vitesse a gagner que l'on cherche justement a
 * annuler. On coupe deliberement la boucle en fin de poussee.
 */
export function aimFreeze({ labels: L }) {
  const bw = 140, bh = 42;
  const xl = 24, xr = 318;
  const yt = 30, yb = 152;
  const node = (x, y, label, cls) => `
    ${rect(x, y, bw, bh, { cls: `fig-box ${cls}-box`, rx: 6 })}
    ${text(x + bw / 2, y + bh / 2 + 4, esc(label), { anchor: 'middle', cls, size: 10 })}`;

  // 1 km de visee vaut, par 2R/v, environ 1 m/s de vitesse requise.
  const perKm = 1000 / dRdV;

  return svg(`
    ${node(xl, yt, L.refine, 'fig-cmd')}
    ${node(xr, yt, L.required, 'fig-cmd')}
    ${node(xr, yb, L.vGoNode, 'fig-est')}
    ${node(xl, yb, L.steer, 'fig-cmd')}
    ${arrow(xl + bw, yt + bh / 2, xr - 2, yt + bh / 2)}
    ${arrow(xr + bw / 2, yt + bh, xr + bw / 2, yb - 2)}
    ${arrow(xr, yb + bh / 2, xl + bw + 2, yb + bh / 2)}
    ${arrow(xl + bw / 2, yb, xl + bw / 2, yt + bh + 2)}
    ${line(xl + bw / 2 - 22, yb - 60, xl + bw / 2 + 22, yb - 76, { cls: 'fig-danger' })}
    ${text(xl + bw / 2 + 28, yb - 70, esc(L.freeze), { cls: 'fig-danger', size: 10 })}
    ${text(240, 104, esc(L.cadence), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(240, 126, `3 km ↔ ${(3 * perKm).toFixed(1)} m/s`, { anchor: 'middle', cls: 'fig-cmd', size: 11 })}
    ${text(240, 142, esc(L.equivalence), { anchor: 'middle', cls: 'fig-dim', size: 9.5 })}
    ${text(xl, 222, esc(L.caption), { cls: 'fig-dim', size: 10 })}
  `, { h: 232 });
}

export default {
  thrustTimeline, cutoffDecision, steeringModes, attitudeChain,
  windFrame, bankLift, velocityToGain, rangeSensitivity, aimOffset, aimFreeze,
};
