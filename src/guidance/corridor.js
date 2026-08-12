// Corridor de rentree.
//
// Un vol plane hypersonique n'est pas libre de descendre ou il veut. Trois
// limites physiques lui interdisent le bas du domaine :
//
//   flux thermique      la protection thermique fond
//   pression dynamique  la structure et les gouvernes cedent
//   facteur de charge   la cellule, et ce qu'elle emporte, cassent
//
// Chacune se traduit par une densite d'air a ne pas depasser a la vitesse
// courante, donc par une ALTITUDE PLANCHER. Le plancher retenu est le plus
// contraignant des trois — et il n'est pas le meme tout au long du vol : a
// haute vitesse c'est le flux qui commande, plus tard c'est la pression
// dynamique. Le vehicule doit rester au-dessus de cette frontiere mouvante.
//
// C'est la moitie basse du corridor. La moitie haute — ne pas ressortir de
// l'atmosphere faute de portance — est deja tenue par la boucle d'incidence,
// qui vole a finesse maximale.
//
// Sans cette contrainte le planeur du simulateur plongeait a 24 km en encaissant
// 190 kPa et 10 g : des valeurs auxquelles aucun corps porteur ne survit.

import { density } from '../core/atmosphere.js';
import { G0 } from '../core/constants.js';
import { SUTTON_GRAVES_K, noseRadius } from '../sim/aerothermal.js';
import { glideCoefficients } from '../sim/vehicle.js';

/**
 * Limites par defaut, choisies dans les ordres de grandeur ouverts des corps
 * porteurs hypersoniques. Elles sont volontairement reglables : c'est en les
 * desserrant que l'on voit reapparaitre le plongeon, et donc a quoi elles
 * servent.
 */
export const DEFAULT_LIMITS = {
  maxHeatRate: 2.5e6, // [W/m^2] au point d'arret
  maxQ: 50e3, // [Pa]
  maxLoad: 2.5, // [g]
};

/**
 * Densite maximale admissible a la vitesse `v`, pour chacune des trois limites.
 * On renvoie le detail et pas seulement le minimum : savoir LAQUELLE contraint
 * est la moitie de l'interet pedagogique.
 *
 * @param {number} v vitesse relative [m/s]
 * @param {object} veh definition du vecteur
 * @param {object} limits {maxHeatRate, maxQ, maxLoad}
 * @param {number} cl coefficient de portance courant
 */
export function admissibleDensity(v, veh, limits, cl) {
  if (!(v > 1)) return { rho: Infinity, binding: null, byQ: Infinity, byHeat: Infinity, byLoad: Infinity };

  // Pression dynamique : q = 1/2 rho v^2.
  const byQ = (2 * limits.maxQ) / (v * v);

  // Flux de Sutton-Graves : q = k sqrt(rho / Rn) v^3, inverse en rho.
  const rn = noseRadius(veh, true);
  const s = (limits.maxHeatRate * Math.sqrt(rn)) / (SUTTON_GRAVES_K * v * v * v);
  const byHeat = s * s;

  // Facteur de charge : n = L / (m g0), avec L = 1/2 rho v^2 S Cl.
  // On prend le Cl REELLEMENT vole : a incidence faible la portance est
  // moindre, et la limite de charge se relache d'autant.
  const S = veh.rv?.refArea ?? veh.refArea;
  const m = veh.payloadMass;
  const byLoad = (2 * limits.maxLoad * m * G0) / (v * v * S * Math.max(cl, 0.02));

  const rho = Math.min(byQ, byHeat, byLoad);
  const binding = rho === byHeat ? 'heat' : rho === byQ ? 'q' : 'load';
  return { rho, binding, byQ, byHeat, byLoad };
}

// L'atmosphere n'est pas inversible analytiquement : elle est definie par
// couches, avec un raccord tabule au-dela de 86 km. Une dichotomie sur
// l'altitude coute une trentaine d'evaluations et reste negligeable devant un
// pas d'integration — et elle reste juste si le modele change.
const ALT_MIN = 0;
const ALT_MAX = 200000;

/** Altitude a laquelle la densite vaut `rhoTarget`. Monotone decroissante. */
export function altitudeForDensity(rhoTarget) {
  if (!Number.isFinite(rhoTarget) || rhoTarget <= 0) return ALT_MAX;
  if (rhoTarget >= density(ALT_MIN)) return ALT_MIN;
  if (rhoTarget <= density(ALT_MAX)) return ALT_MAX;
  let lo = ALT_MIN, hi = ALT_MAX;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (density(mid) > rhoTarget) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Acceleration de portance atteignable ici, a incidence maximale. C'est le
 * plafond physique du freinage : au-dela, il n'y a plus d'air a mordre.
 */
export function maxLiftAcceleration(alt, v, veh) {
  if (!veh.glide) return Infinity;
  const cl = Math.abs(glideCoefficients(veh, veh.glide.maxAoA).cl);
  const S = veh.rv?.refArea ?? veh.refArea;
  return (0.5 * density(alt) * v * v * S * cl) / veh.payloadMass;
}

/**
 * Altitude plancher du corridor a la vitesse courante, et limite qui commande.
 */
export function corridorFloor(v, veh, limits, aoa) {
  const cl = veh.glide ? Math.abs(glideCoefficients(veh, Math.abs(aoa)).cl) : 0.3;
  const d = admissibleDensity(v, veh, limits, cl);
  return {
    alt: altitudeForDensity(d.rho),
    binding: d.binding,
    altByQ: altitudeForDensity(d.byQ),
    altByHeat: altitudeForDensity(d.byHeat),
    altByLoad: altitudeForDensity(d.byLoad),
  };
}

// Le piege de la contrainte de charge.
//
// Premiere tentative, fausse : cabrer proportionnellement au creusement predit.
// Elle AGGRAVE le facteur de charge au lieu de le reduire — cabrer, c'est
// augmenter la portance, c'est-a-dire precisement la grandeur qu'on limite.
// Mesure a l'appui : 12,6 g au lieu de 10,5 sans contrainte.
//
// La contrainte de charge ne se tient donc pas au fond du plongeon : elle se
// tient en n'y arrivant pas. Ce qu'il faut borner, ce n'est pas l'altitude,
// c'est la VITESSE DE DESCENTE admissible a une marge donnee — exactement une
// distance de freinage.
//
// Avec une acceleration verticale disponible `a`, arreter une descente de
// `vVert` demande une hauteur vVert^2 / (2a). En inversant : a la marge `h`,
// la descente ne doit pas depasser sqrt(2 a h). Au-dela, aucune incidence ne
// redressera a temps, et l'on encaissera la limite quoi qu'il arrive.
//
// C'est une barriere : elle mord doucement et tot, loin du plancher, la ou
// cabrer coute encore peu de portance — et elle laisse le vol plane nominal
// entierement libre tant qu'on descend assez lentement.

// Gain du rappel, en radians d'incidence par (m/s) de depassement de la
// descente admissible. Regle pour redresser franchement sans relancer la
// phugoide qu'on cherche justement a mater.
const GAIN = 3.0e-4;

/** Marge au-dela de laquelle la barriere ne contraint plus rien. */
const MARGIN_MAX = 30000;

/**
 * Supplement d'incidence a commander pour rester au-dessus du plancher.
 * Renvoie 0 tant que la descente reste dans ce que la marge permet de freiner.
 *
 * @param {number} alt altitude estimee [m]
 * @param {number} vVert vitesse verticale estimee [m/s], negative en descente
 * @param {object} floor sortie de corridorFloor()
 * @param {number} maxLoad limite de facteur de charge [g]
 * @param {number} maxLiftAccel acceleration de portance atteignable ici [m/s^2]
 */
export function corridorPullUp(alt, vVert, floor, maxLoad, maxLiftAccel = null) {
  if (vVert >= 0) return 0; // en montee, rien a freiner
  const marge = Math.min(alt - floor.alt, MARGIN_MAX);
  if (marge <= 0) return GAIN * -vVert; // deja sous le plancher : tout ce qu'on a

  // Acceleration verticale disponible pour freiner. Deux plafonds, et il faut
  // retenir le plus bas :
  //
  //   - ce qu'on s'AUTORISE : la limite de charge elle-meme ;
  //   - ce qu'on PEUT : la portance que l'air rend a cette altitude.
  //
  // Ne retenir que le premier etait une erreur mesurable. A 90 km l'air est
  // trop rare pour rendre un dixieme de g, quelle que soit l'incidence : la
  // barriere autorisait alors une descente de 1300 m/s en croyant pouvoir
  // l'arreter, et le vehicule arrivait en bas a 12 g, incidence saturee,
  // incapable de redresser. Une barriere qui promet ce que la physique ne
  // donne pas ne protege de rien.
  const aLimite = Math.max(0.2, maxLoad - 1) * G0;
  const aPortance = maxLiftAccel != null ? Math.max(0, maxLiftAccel - G0) : aLimite;
  const aDispo = Math.max(0.02, Math.min(aLimite, aPortance));
  const descenteAdmise = Math.sqrt(2 * aDispo * marge);
  const exces = -vVert - descenteAdmise;
  return exces > 0 ? GAIN * exces : 0;
}
