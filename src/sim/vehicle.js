// Definition des vecteurs et comptabilite masse / poussee.
//
// Les chiffres ci-dessous sont des ordres de grandeur generiques choisis pour
// que le simulateur se comporte de facon plausible et pedagogique. Ce ne sont
// les caracteristiques d'aucun materiel reel, et le modele de propulsion
// (poussee constante, Isp constant, etagement instantane) reste volontairement
// grossier : ce n'est pas le sujet du simulateur.
//
// Le sujet, c'est ce que le calculateur croit savoir de sa position.

import { G0 } from '../core/constants.js';
import { atmosphere } from '../core/atmosphere.js';

/**
 * Courbe de trainee d'un corps elance en fonction du nombre de Mach.
 * Le pic transsonique vers Mach 1 est la caracteristique dominante.
 */
const CD_MACH = [
  [0.0, 0.15], [0.5, 0.15], [0.8, 0.18], [0.95, 0.36], [1.05, 0.44],
  [1.3, 0.42], [1.6, 0.37], [2.0, 0.32], [3.0, 0.26], [5.0, 0.22],
  [8.0, 0.20], [12.0, 0.19], [25.0, 0.19],
];

export function cdOfMach(mach) {
  const m = Math.max(0, mach);
  if (m >= CD_MACH[CD_MACH.length - 1][0]) return CD_MACH[CD_MACH.length - 1][1];
  let i = 0;
  while (i < CD_MACH.length - 2 && m > CD_MACH[i + 1][0]) i++;
  const [m0, c0] = CD_MACH[i];
  const [m1, c1] = CD_MACH[i + 1];
  return c0 + ((m - m0) / (m1 - m0)) * (c1 - c0);
}

export const VEHICLES = {
  bal2: {
    id: 'bal2',
    payloadMass: 600, // masse du corps de rentree [kg]
    refArea: 1.13, // section de reference du lanceur [m^2]
    stages: [
      { thrustVac: 700e3, thrustSL: 640e3, ispVac: 262, propMass: 17500, dryMass: 2100 },
      { thrustVac: 190e3, thrustSL: 190e3, ispVac: 288, propMass: 3900, dryMass: 620 },
    ],
    // Corps de rentree : le coefficient balistique m/(Cd.S) pilote a lui seul
    // la profondeur de penetration dans l'atmosphere.
    rv: { ballisticCoef: 3800, refArea: 0.15 },
    glide: null,
    // Portee utile MESUREE par simulation (voir tests/guidance.test.js), et
    // non deduite du delta-v : les pertes gravitationnelles sont un montant
    // absolu, pas un pourcentage, de sorte qu'aucune regle simple ne les
    // predit correctement d'un vecteur a l'autre.
    usefulRange: 3600e3,
    guidance: { verticalRise: 8, pitchKick: 3.5, turnEnd: 62 },
  },

  bal3: {
    id: 'bal3',
    payloadMass: 500,
    refArea: 1.77,
    stages: [
      { thrustVac: 1650e3, thrustSL: 1500e3, ispVac: 265, propMass: 44000, dryMass: 4600 },
      { thrustVac: 520e3, thrustSL: 520e3, ispVac: 289, propMass: 12500, dryMass: 1500 },
      { thrustVac: 130e3, thrustSL: 130e3, ispVac: 295, propMass: 3200, dryMass: 420 },
    ],
    rv: { ballisticCoef: 6500, refArea: 0.12 },
    glide: null,
    usefulRange: 13000e3,
    guidance: { verticalRise: 9, pitchKick: 3.0, turnEnd: 78 },
  },

  glide: {
    id: 'glide',
    payloadMass: 1400, // le planeur est nettement plus lourd qu'un corps de rentree
    refArea: 1.77,
    // Poussee volontairement modeste : un rapport poussee/poids de 1.8 laisse
    // au virage gravitationnel le temps de coucher la trajectoire. A 2.5, le
    // vehicule prend trop vite de la pression dynamique, le limiteur
    // d'incidence l'empeche de basculer, et il part sur un arc balistique
    // beaucoup trop cabre pour pouvoir ensuite planer.
    stages: [
      { thrustVac: 980e3, thrustSL: 900e3, ispVac: 263, propMass: 36000, dryMass: 3900 },
      { thrustVac: 200e3, thrustSL: 200e3, ispVac: 288, propMass: 9000, dryMass: 1150 },
    ],
    // Surface de reference nettement plus grande que celle d'un corps de
    // rentree : c'est ce qui distingue un corps PORTEUR. Avec 4 m^2 pour
    // 1400 kg la charge alaire tombe a 350 kg/m^2, valeur a laquelle la
    // portance disponible permet reellement de tenir un vol plane. Le
    // coefficient balistique ne sert qu'a la descente a incidence nulle,
    // avant la ressource.
    rv: { ballisticCoef: 12000, refArea: 4.0 },
    // Modele newtonien modifie : CN = 2 sin^2(a), CA = axial constant.
    // `ldScale` multiplie la portance et represente la qualite aerodynamique
    // du corps porteur — c'est un des modules que l'on peut affiner.
    glide: {
      axialCoef: 0.022,
      ldScale: 1.0,
      maxAoA: 22 * (Math.PI / 180),
      maxBank: 55 * (Math.PI / 180),
      pullUpAlt: 62000, // altitude de ressource [m]
      // Vitesse plancher du vol plane. Ce n'est pas un reglage libre : c'est
      // la limite de validite du modele aerodynamique newtonien, qui suppose
      // un ecoulement hypersonique. En dessous, le corps porteur pique.
      minSpeed: 900,
      // Profil de montee surbaissee : la pente decroit lineairement avec
      // l'altitude jusqu'a s'annuler a `ascentTargetAlt`. Sans cela le
      // planeur monterait comme un vecteur balistique et redescendrait bien
      // trop raide pour pouvoir se mettre en plane.
      //
      // 18 km, et non 72 : c'est tout l'ecart entre un balistique qui plane un
      // peu et un vrai vol plane propulse. A 72 km la pente ne s'annulait qu'en
      // haute atmosphere, l'engin coupait a 118 km sous 11 degres et culminait
      // a 157 km — donc rentrait a 1189 m/s de chute, que sa portance ne
      // rattrapait plus, d'ou les 12 g encaisses au premier plongeon.
      //
      // En aplatissant des 18 km, l'apogee tombe a 72 km et la chute a 491 m/s.
      // Valeur choisie par balayage : plus bas, la portee longue devient
      // fragile ; plus haut, l'entree redevient raide sans que la precision y
      // gagne.
      ascentGammaMax: 72,
      ascentTargetAlt: 18000,
    },
    usefulRange: 9500e3,
    // Virage gravitationnel tres court : le pilotage de pente prend la main
    // presque tout de suite, sinon la trajectoire est deja trop cabree.
    guidance: { verticalRise: 5, pitchKick: 24, turnEnd: 10 },
  },
};

/** Masse totale courante, en kg. */
export function totalMass(veh, stageIndex, propRemaining) {
  let m = veh.payloadMass;
  for (let i = stageIndex; i < veh.stages.length; i++) {
    m += veh.stages[i].dryMass;
    m += i === stageIndex ? Math.max(0, propRemaining) : veh.stages[i].propMass;
  }
  return m;
}

/** Masse au decollage. */
export function liftoffMass(veh) {
  return totalMass(veh, 0, veh.stages[0].propMass);
}

/**
 * Poussee et debit massique de l'etage courant a l'altitude donnee.
 * La poussee augmente avec l'altitude parce que la pression ambiante cesse de
 * s'exercer sur la section de sortie de tuyere ; le debit, lui, ne depend que
 * de la chambre et reste constant.
 */
export function propulsion(veh, stageIndex, alt, throttle = 1) {
  const st = veh.stages[stageIndex];
  if (!st) return { thrust: 0, mdot: 0 };
  const p = atmosphere(Math.max(0, alt)).p;
  const ratio = Math.min(1, Math.max(0, p / 101325));
  const thrustVac = st.thrustVac;
  const thrust = (thrustVac - (thrustVac - st.thrustSL) * ratio) * throttle;
  const mdot = (thrustVac / (st.ispVac * G0)) * throttle;
  return { thrust: Math.max(0, thrust), mdot };
}

/** Duree de combustion nominale d'un etage [s]. */
export function burnTime(veh, stageIndex) {
  const st = veh.stages[stageIndex];
  return st.propMass / (st.thrustVac / (st.ispVac * G0));
}

/** Increment de vitesse ideal de l'etage (equation de Tsiolkovski) [m/s]. */
export function stageDeltaV(veh, stageIndex) {
  const m0 = totalMass(veh, stageIndex, veh.stages[stageIndex].propMass);
  const m1 = totalMass(veh, stageIndex, 0);
  return veh.stages[stageIndex].ispVac * G0 * Math.log(m0 / m1);
}

/** Increment de vitesse ideal cumule de tous les etages [m/s]. */
export function totalDeltaV(veh) {
  let sum = 0;
  for (let i = 0; i < veh.stages.length; i++) sum += stageDeltaV(veh, i);
  return sum;
}

/**
 * Coefficients aerodynamiques du corps porteur (modele newtonien modifie).
 * `aoa` en radians. Renvoie { cl, cd } rapportes a `rv.refArea`.
 */
export function glideCoefficients(veh, aoa) {
  const g = veh.glide;
  if (!g) return { cl: 0, cd: 0 };
  const a = Math.abs(aoa);
  const s = Math.sin(a), c = Math.cos(a);
  const cn = 2 * s * s * g.ldScale;
  const ca = g.axialCoef;
  const cl = (cn * c - ca * s) * Math.sign(aoa || 1);
  const cd = cn * s + ca * c;
  return { cl, cd };
}

/**
 * Incidence produisant un coefficient de portance donne.
 * CL est monotone croissant sur le domaine utile, d'ou la dichotomie.
 */
export function aoaForCL(veh, clTarget) {
  const g = veh.glide;
  if (!g || clTarget <= 0) return 0;
  let lo = 0, hi = g.maxAoA;
  if (glideCoefficients(veh, hi).cl <= clTarget) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = 0.5 * (lo + hi);
    if (glideCoefficients(veh, mid).cl < clTarget) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Portee d'un vol plane d'equilibre, de `vStart` a `vEnd` [m].
 *
 * Formule classique du plane hypersonique : la portance equilibre le poids
 * diminue de l'effet centrifuge, et l'energie se dissipe par trainee. C'est
 * ce terme qui fait tout l'interet d'un corps porteur — la portee ne depend
 * plus seulement de l'energie a l'extinction, mais aussi de la finesse.
 */
export function equilibriumGlideRange(vStart, vEnd, finesse, rBody = 6371008.8) {
  const vc2 = 3.986004418e14 / rBody; // vitesse circulaire au carre
  const a = 1 - (vEnd * vEnd) / vc2;
  const b = 1 - (vStart * vStart) / vc2;
  if (a <= 0 || b <= 0 || a <= b) return 0;
  return (finesse / 2) * rBody * Math.log(a / b);
}

/**
 * Incidence donnant une finesse imposee, sur la branche a forte trainee.
 *
 * La finesse passe par un maximum puis redescend quand l'incidence augmente.
 * On cherche donc sur la branche decroissante : c'est ainsi qu'un planeur
 * raccourcit sa portee, en degradant volontairement sa finesse plutot qu'en
 * freinant. Si la finesse demandee depasse le maximum disponible, on rend
 * l'incidence de finesse maximale — on ne peut pas faire mieux.
 */
export function aoaForFinesse(veh, target) {
  const best = bestGlideAoA(veh);
  const c = glideCoefficients(veh, best);
  if (!veh.glide || target >= c.cl / c.cd) return best;

  let lo = best, hi = veh.glide.maxAoA;
  const ldAt = (a) => { const k = glideCoefficients(veh, a); return k.cl / k.cd; };
  if (ldAt(hi) > target) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = 0.5 * (lo + hi);
    if (ldAt(mid) > target) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Angle d'incidence donnant la finesse maximale, par balayage [rad]. */
export function bestGlideAoA(veh) {
  if (!veh.glide) return 0;
  let best = 0, bestLD = -Infinity;
  for (let deg = 1; deg <= 30; deg += 0.25) {
    const a = deg * (Math.PI / 180);
    const { cl, cd } = glideCoefficients(veh, a);
    const ld = cl / cd;
    if (ld > bestLD) { bestLD = ld; best = a; }
  }
  return Math.min(best, veh.glide.maxAoA);
}
