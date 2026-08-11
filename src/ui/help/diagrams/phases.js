// Schema du groupe phases.
//
// Une seule figure, mais elle porte toute la these du simulateur : la frise
// montre QUI decide de chaque transition (une horloge en gris, un seuil lu sur
// l'estimation en ambre) et, apres la rentree, la bifurcation entre un corps
// de rentree que plus personne ne pilote et un planeur pilote jusqu'au sol.
//
// La figure lit `ctx.veh` quand il est fourni : les instants de basculement et
// les seuils du planeur sont ceux du vecteur reellement selectionne.

import { svg, text, rect, line, arrow, esc } from '../svg.js';

// Constantes du calculateur (guidance/computer.js) : duree du basculement,
// plafond de rentree, portee d'entree en phase terminale, altitude minimale
// de la correction mi-course.
const KICK_DURATION = 6;
const REENTRY_ALT_KM = 100;
const TERMINAL_RANGE_KM = 45;
const MIDCOURSE_ALT_KM = 120;

// Estimation de la largeur d'une chaine. Compter les caracteres suffirait en
// anglais ; en francais les libelles sont plus longs et le compte de signes ne
// dit plus rien de l'encombrement reel. On approche donc l'encre.
const NARROW = "iljtfrI.,;:'!|()[]";
const WIDE = 'mMW';
function ink(str, size) {
  let u = 0;
  for (const c of String(str ?? '')) {
    if (NARROW.includes(c)) u += 0.3;
    else if (WIDE.includes(c)) u += 0.88;
    else if (c >= 'A' && c <= 'Z') u += 0.66;
    else if (c === ' ') u += 0.27;
    else u += 0.55;
  }
  return u * size;
}

/** Largeurs proportionnelles a l'encombrement du texte : robuste au changement de langue. */
function layout(items, x0, x1, { gap = 4, name = 9, sub = 8.2 } = {}) {
  const weights = items.map((it) => Math.max(ink(it.name, name), ink(it.sub, sub)) + 13);
  const total = weights.reduce((a, b) => a + b, 0);
  const inner = x1 - x0 - gap * (items.length - 1);
  const out = [];
  let x = x0;
  for (let i = 0; i < items.length; i++) {
    const w = (inner * weights[i]) / total;
    out.push({ x, w, cx: x + w / 2 });
    x += w + gap;
  }
  return out;
}

/** Une rangee de boites : nom au-dessus, critere de sortie en dessous. */
function boxes(items, geo, y, h, { name = 9, sub = 8.2 } = {}) {
  return items.map((it, i) => {
    const g = geo[i];
    const stroke = it.cls ? `fig-box ${it.cls}-box` : 'fig-box';
    return `
      ${rect(g.x, y, g.w, h, { cls: stroke, rx: 5 })}
      ${text(g.cx, y + 13, esc(it.name), { anchor: 'middle', cls: it.cls ?? 'fig-dim', size: name })}
      ${it.sub ? text(g.cx, y + 23, esc(it.sub), { anchor: 'middle', cls: it.subCls ?? 'fig-dim', size: sub }) : ''}`;
  }).join('');
}

// La rangee du vol propulse porte cinq boites : elle respire moins que les
// autres, on y descend d'un demi-point.
const BOOST_TYPE = { gap: 3, name: 8.6, sub: 7.9 };

const fmtDeg = (v) => (v % 1 === 0 ? String(v) : v.toFixed(1));

/**
 * Frise des onze phases.
 *
 * Rangee 1 : le vol propulse, ou trois transitions sur quatre sont de simples
 * horloges. Capsule : l'extinction, seule decision prise sur une trajectoire
 * predite. Rangee 2 : le vol libre, ou le seuil de 100 km est lu sur
 * l'ALTITUDE ESTIMEE. Puis la bifurcation, qui est le sujet de la fiche.
 */
export function phaseTimeline(ctx = {}) {
  const L = ctx.labels ?? {};
  // Les libelles composes avec un chiffre passent par ici : un libelle absent
  // doit laisser un blanc, pas ecrire « undefined » dans la figure.
  const s = (k) => L[k] ?? '';
  const veh = ctx.veh;
  const g = veh?.guidance ?? {};
  const vr = g.verticalRise ?? 8;
  const te = g.turnEnd ?? 62;
  const kickDeg = g.pitchKick ?? 3.5;
  const kickEnd = vr + KICK_DURATION;
  // Cas reel du planeur : le basculement deborde la fenetre du virage
  // gravitationnel, qui ne s'ouvre donc jamais.
  const turnSkipped = kickEnd >= te;
  const isGlider = Boolean(veh?.glide);
  const pullUpKm = Math.round((veh?.glide?.pullUpAlt ?? 62000) / 1000);
  const minSpeed = Math.round(veh?.glide?.minSpeed ?? 900);

  // ---------------------------------------------------------------- rangee 1
  const boost = [
    { name: L.pPrelaunch, sub: L.sPrelaunch },
    { name: L.pVertical, sub: `0 → ${vr} s`, cls: 'fig-cmd' },
    { name: L.pKick, sub: `${KICK_DURATION} s · ${fmtDeg(kickDeg)}°`, cls: 'fig-cmd' },
    turnSkipped
      ? { name: L.pTurn, sub: L.sTurnSkipped }
      : { name: L.pTurn, sub: `${kickEnd} → ${te} s`, cls: 'fig-truth' },
    { name: L.pClosed, sub: L.sToCutoff, cls: 'fig-cmd', subCls: 'fig-est' },
  ];
  const gBoost = layout(boost, 20, 460, BOOST_TYPE);

  // ---------------------------------------------------------------- rangee 2
  const free = [
    { name: L.pCoast, sub: `${s('sAbove')} ${REENTRY_ALT_KM} km`, cls: 'fig-truth', subCls: 'fig-est' },
    { name: L.pMid, sub: `${s('sMid')}, > ${MIDCOURSE_ALT_KM} km`, cls: 'fig-cmd' },
    { name: L.pReentry, sub: `${s('sBelow')} ${REENTRY_ALT_KM} km`, cls: 'fig-truth', subCls: 'fig-est' },
  ];
  const gFree = layout(free, 20, 460);
  const cxRe = gFree[2].cx;

  // ------------------------------------------------------ voies apres rentree
  const glide = [{ name: L.pGlide, sub: `${s('sPullUp')} ${pullUpKm} km`, cls: 'fig-cmd', subCls: 'fig-est' }];
  const term = [{
    name: L.pTerminal,
    sub: `${s('sWithin')} ${TERMINAL_RANGE_KM} km · v < ${minSpeed} m/s`,
    cls: 'fig-cmd',
    subCls: 'fig-est',
  }];
  const gGlide = layout(glide, 246, 454);
  const gTerm = layout(term, 246, 454);
  const endBal = [{ name: L.pImpact, sub: L.sImpactBal, cls: 'fig-danger' }];
  const endGl = [{ name: L.pImpact, sub: L.sImpactGlide, cls: 'fig-danger' }];
  const gEndBal = layout(endBal, 26, 234);
  const gEndGl = layout(endGl, 246, 454);

  // La voie du vecteur selectionne est mise en avant par un aplat.
  const lane = veh ? rect(isGlider ? 240 : 20, 148, 220, 96, { cls: 'fig-band', rx: 8 }) : '';

  const forkL = Math.min(130, cxRe);
  const forkR = Math.max(350, cxRe);

  return svg(`
    ${lane}

    ${/* legende : bleu = ordre, vert = physique seule, ambre = seuil sur l'estime */ ''}
    ${line(22, 9, 38, 9, { cls: 'fig-cmd' })}
    ${text(44, 12.5, esc(L.legCmd), { cls: 'fig-dim', size: 8 })}
    ${line(176, 9, 192, 9, { cls: 'fig-truth' })}
    ${text(198, 12.5, esc(L.legFree), { cls: 'fig-dim', size: 8 })}
    ${line(316, 9, 332, 9, { cls: 'fig-est' })}
    ${text(338, 12.5, esc(L.legEst), { cls: 'fig-dim', size: 8 })}

    ${boxes(boost, gBoost, 22, 28, BOOST_TYPE)}

    ${/* l'extinction ferme la rangee 1 et ouvre la rangee 2 */ ''}
    ${line(460, 50, 460, 71, { cls: 'fig-est', dash: '2 3' })}
    ${line(20, 71, 121, 71, { cls: 'fig-est', dash: '2 3' })}
    ${line(359, 71, 460, 71, { cls: 'fig-est', dash: '2 3' })}
    ${rect(125, 58, 230, 26, { cls: 'fig-box fig-est-box', rx: 6 })}
    ${text(240, 70, esc(L.cutoffTitle), { anchor: 'middle', cls: 'fig-est', size: 9.5 })}
    ${text(240, 80, esc(isGlider ? L.cutoffRuleGlide : L.cutoffRule), { anchor: 'middle', cls: 'fig-dim', size: 8 })}

    ${boxes(free, gFree, 92, 28)}

    ${/* bifurcation : le corps de rentree continue de tomber, le planeur ressource */ ''}
    ${line(cxRe, 120, cxRe, 129, { cls: 'fig-dim' })}
    ${line(forkL, 129, forkR, 129, { cls: 'fig-dim' })}
    ${arrow(130, 129, 130, 140, { cls: 'fig-dim' })}
    ${arrow(350, 129, 350, 140, { cls: 'fig-dim' })}
    ${text(130, 152, esc(L.laneBal), { anchor: 'middle', cls: 'fig-dim', size: 9 })}
    ${text(350, 152, esc(L.laneGlide), { anchor: 'middle', cls: 'fig-dim', size: 9 })}

    ${/* voie balistique : une seule boite, et rien dedans */ ''}
    ${rect(26, 158, 208, 52, { cls: 'fig-box fig-truth-box', rx: 5 })}
    ${text(130, 176, esc(L.pFreeFall), { anchor: 'middle', cls: 'fig-truth', size: 9 })}
    ${text(130, 189, esc(L.sFreeFall), { anchor: 'middle', cls: 'fig-dim', size: 8.2 })}
    ${text(130, 201, esc(L.sSealed), { anchor: 'middle', cls: 'fig-est', size: 8.2 })}
    ${boxes(endBal, gEndBal, 214, 26)}

    ${/* voie planeur : on pilote encore, deux fois */ ''}
    ${boxes(glide, gGlide, 158, 26)}
    ${boxes(term, gTerm, 186, 26)}
    ${boxes(endGl, gEndGl, 214, 26)}
  `, { h: 248 });
}

export default { phaseTimeline };
