// Aerothermique : ce que la trajectoire fait subir a la peau du vehicule.
//
// Ce module OBSERVE, il ne pilote rien. Aucune de ses sorties ne revient dans
// les equations du mouvement, et c'est volontaire : le simulateur ne modelise
// ni l'ablation, ni la recession de nez, ni la degradation aerodynamique qui
// s'ensuit. Un couplage partiel — l'echauffement qui modifierait la trainee
// sans que le materiau ne s'use — serait moins honnete qu'une mesure passive.
//
// Trois grandeurs, dans cet ordre d'importance pour qui dessine un vehicule :
//   - le flux au point d'arret, qui dit si le materiau tient sur l'instant ;
//   - la charge integree, qui dimensionne l'EPAISSEUR de la protection : c'est
//     elle, et non le pic, qui decide combien de kilogrammes de bouclier il
//     faut embarquer ;
//   - la temperature de paroi a l'equilibre radiatif, seule des trois qui soit
//     visible de l'exterieur.

import { atmosphere } from '../core/atmosphere.js';
import { G0 } from '../core/constants.js';

/**
 * Constante de la correlation de Sutton-Graves pour l'air terrestre.
 *
 * En unites SI (rho en kg/m^3, rayon en m, vitesse en m/s) le resultat sort
 * directement en W/m^2. Verification sur un cas publie : capsule Apollo,
 * Rn = 4.7 m, 11 km/s, rho ~ 5e-4 kg/m^3 vers 55 km, la formule rend
 * 2.4 MW/m^2 la ou la litterature donne un pic convectif de 2.5 a 4 MW/m^2 —
 * l'ecart restant est la part radiative du gaz de choc, ignoree ici.
 */
export const SUTTON_GRAVES_K = 1.7415e-4;

/** Constante de Stefan-Boltzmann [W/(m^2.K^4)]. */
export const STEFAN_BOLTZMANN = 5.670374419e-8;

/**
 * Emissivite d'une protection thermique. Les revetements de rentree (carbone,
 * silice, ceramiques) sont choisis EMISSIFS a dessein : renvoyer le flux par
 * rayonnement est le seul mecanisme de refroidissement disponible tant que le
 * materiau ne s'ablate pas. 0.85 est la valeur haute typique.
 */
export const TPS_EMISSIVITY = 0.85;

// Rapport rayon de nez / rayon de base d'un corps de rentree, pris a un
// coefficient balistique de reference. Voir noseRadius() pour la justification.
const RV_BC_REF = 2500;
const RV_BLUNTNESS_REF = 0.20;

/**
 * Rayon de courbure du nez [m], deduit de la geometrie du vecteur.
 *
 * Toute l'aerothermique tient dans ce seul nombre : le flux varie en
 * 1/sqrt(Rn), donc doubler le rayon retire 30 % du flux. C'est exactement la
 * ligne de partage entre les deux familles de vehicules du simulateur.
 *
 * Un corps de rentree balistique cherche a traverser l'atmosphere le plus vite
 * possible : nez pointu, trainee minimale, coefficient balistique eleve. Il
 * encaisse en echange un flux enorme, mais pendant quelques dizaines de
 * secondes seulement, et il peut se le permettre parce qu'il ablate.
 *
 * Un corps porteur, lui, plane pendant des minutes. Aucun materiau ne tient un
 * flux de corps de rentree aussi longtemps : il lui faut un bord d'attaque
 * franchement emousse, decimetrique, qui divise le flux par plusieurs. C'est
 * une contrainte thermique qui dicte une forme aerodynamique, et non l'inverse.
 *
 * `separated` distingue les deux ecoulements successifs : sous coiffe, c'est
 * l'ogive du lanceur qui voit l'air, et elle est dessinee pour le transsonique.
 */
export function noseRadius(veh, separated = true) {
  if (!separated) {
    return 0.10 * Math.sqrt(veh.refArea / Math.PI);
  }
  // Seule dimension transverse que porte la definition d'un vecteur. Pour le
  // corps porteur, `rv.refArea` est plus une surface portante qu'une section :
  // la longueur caracteristique qu'on en tire reste neanmoins la bonne echelle.
  const baseRadius = Math.sqrt(veh.rv.refArea / Math.PI);
  if (veh.glide) return 0.25 * baseRadius;

  // La loi en racine inverse du coefficient balistique n'a pas de fondement
  // analytique : elle interpole doucement entre les vecteurs du simulateur
  // (3.5 cm pour bal2, 2.4 cm pour bal3) en restant dans la fourchette
  // centimetrique des corps de rentree publies. Ce qui compte ici, c'est
  // l'ordre de grandeur et le SENS de la variation — plus dense et plus
  // effile, donc plus pointu, donc plus chaud.
  return baseRadius * RV_BLUNTNESS_REF * Math.sqrt(RV_BC_REF / veh.rv.ballisticCoef);
}

/**
 * Flux de chaleur convectif au point d'arret [W/m^2], correlation de
 * Sutton-Graves. La dependance en v^3 est la raison pour laquelle l'ordre des
 * operations compte : entre 6 et 7 km/s, le flux augmente de 60 %.
 *
 * Le terme radiatif du gaz de choc est ignore : il ne devient comparable au
 * convectif qu'au-dela de ~10 km/s, vitesse que seule une rentree de sonde
 * interplanetaire atteint. Aucun vecteur d'ici n'en approche.
 */
export function stagnationHeatFlux(rho, vRel, rn) {
  if (!(rho > 0) || !(vRel > 0) || !(rn > 0)) return 0;
  return SUTTON_GRAVES_K * Math.sqrt(rho / rn) * vRel * vRel * vRel;
}

/**
 * Temperature de paroi a l'equilibre radiatif [K] : la paroi est supposee
 * reemettre en rayonnement tout ce qu'elle recoit.
 *
 * C'est une borne SUPERIEURE, et il faut la lire comme telle. Une protection
 * reelle conduit une part du flux vers l'interieur et surtout, au-dela de
 * ~3000 K, ablate — elle emporte l'energie avec la matiere plutot que de
 * monter en temperature. Une valeur affichee de 5000 K ne dit donc pas que la
 * paroi est a 5000 K : elle dit que le materiau est en train de partir.
 *
 * Le plancher a la temperature de l'air ambiant evite une aberration de
 * l'idealisation : a flux nul la formule rend 0 K, alors qu'une paroi ne peut
 * pas etre plus froide que le gaz qui la baigne.
 */
export function wallTemperature(heatFlux, ambientT = 0) {
  const t = Math.pow(Math.max(0, heatFlux) / (TPS_EMISSIVITY * STEFAN_BOLTZMANN), 0.25);
  return Math.max(t, ambientT);
}

/**
 * Accumulateur aerothermique d'un vol. Une instance par tir.
 */
export class AerothermalMonitor {
  constructor(veh) {
    this.veh = veh;
    // Les deux rayons sont figes a la construction : ils ne dependent que du
    // vecteur, et les recalculer a chaque pas serait de la depense pure.
    this.rnBoost = noseRadius(veh, false);
    this.rnReentry = noseRadius(veh, true);
    this.reset();
  }

  reset() {
    this.heatRate = 0; // [W/m^2]
    this.heatLoad = 0; // [J/m^2]
    this.surfaceTemp = 0; // [K]
    this.maxHeatRate = 0;
    this.maxHeatRateTime = null;
    this.maxSurfaceTemp = 0;
    this.maxSurfaceTempTime = null;
    this.maxQDyn = 0;
    this.maxQDynTime = null;
    this.maxAccel = 0;
    this.maxAccelTime = null;
    return this;
  }

  /**
   * Grandeurs instantanees, sans effet de bord. `f` est une sortie de
   * computeForces.
   *
   * On y prend la vitesse RELATIVE A L'AIR et non la vitesse inertielle : a
   * l'equateur un vehicule pose au sol file deja a 465 m/s dans le repere
   * inertiel, et cet entrainement n'echauffe evidemment rien.
   */
  sample(f, separated) {
    const rn = separated ? this.rnReentry : this.rnBoost;
    const q = stagnationHeatFlux(f.rho, f.vRelMag, rn);
    return { heatRate: q, surfaceTemp: wallTemperature(q, atmosphere(f.alt).T) };
  }

  /**
   * Integre un pas de simulation. `fStart`, `fMid` et `fEnd` sont les bilans de
   * forces deja calcules par la boucle principale aux trois points du pas.
   *
   * La charge thermique est integree a la regle de Simpson pour la meme raison
   * que la force specifique alimentant la centrale : le flux varie en v^3 sur
   * une densite exponentielle, la courbe est donc violemment convexe pendant la
   * rentree. Un rectangle a gauche sous-estimerait l'integrale de plusieurs
   * pour cent sur les pas ou tout se joue.
   *
   * Les maxima, eux, ne sont releves qu'au debut du pas : c'est le meme
   * echantillon que celui dont la boucle principale tire maxQ et maxAccel, et
   * deux jeux de maxima qui different de 2 % seraient plus troublants
   * qu'utiles. Le pas vaut 50 ms pendant la rentree, ou le pic dure plusieurs
   * secondes — l'echantillonnage n'y perd rien.
   */
  integrate(tFlight, dt, fStart, fMid, fEnd, separated) {
    const rn = separated ? this.rnReentry : this.rnBoost;
    const q0 = stagnationHeatFlux(fStart.rho, fStart.vRelMag, rn);
    const q1 = stagnationHeatFlux(fMid.rho, fMid.vRelMag, rn);
    const q2 = stagnationHeatFlux(fEnd.rho, fEnd.vRelMag, rn);
    this.heatLoad += (dt * (q0 + 4 * q1 + q2)) / 6;

    this.heatRate = q0;
    this.surfaceTemp = wallTemperature(q0, atmosphere(fStart.alt).T);

    if (q0 > this.maxHeatRate) {
      this.maxHeatRate = q0;
      this.maxHeatRateTime = tFlight;
    }
    if (this.surfaceTemp > this.maxSurfaceTemp) {
      this.maxSurfaceTemp = this.surfaceTemp;
      this.maxSurfaceTempTime = tFlight;
    }
    if (fStart.qDyn > this.maxQDyn) {
      this.maxQDyn = fStart.qDyn;
      this.maxQDynTime = tFlight;
    }
    const load = Math.hypot(fStart.aSpecific[0], fStart.aSpecific[1], fStart.aSpecific[2]);
    if (load > this.maxAccel) {
      this.maxAccel = load;
      this.maxAccelTime = tFlight;
    }
  }

  /**
   * Bilan de fin de vol. Les instants sont comptes depuis le decollage, comme
   * partout ailleurs dans le bilan.
   */
  summary() {
    return {
      heatLoad: this.heatLoad,
      maxHeatRate: this.maxHeatRate,
      maxHeatRateTime: this.maxHeatRateTime,
      maxSurfaceTemp: this.maxSurfaceTemp,
      maxSurfaceTempTime: this.maxSurfaceTempTime,
      // La pression dynamique et le facteur de charge maximaux figuraient deja
      // au bilan ; ce qui leur manquait, c'est QUAND. Un pic de pression a la
      // montee et un pic a la rentree ne racontent pas la meme histoire.
      maxQTime: this.maxQDynTime,
      maxAccelTime: this.maxAccelTime,
      maxLoadFactor: this.maxAccel / G0,
      noseRadius: this.rnReentry,
    };
  }
}
