// Equations du mouvement de la "verite terrain".
//
// C'est la reference : ce que fait reellement le vehicule. Le calculateur de
// bord n'y a jamais acces — il ne voit que ce que ses capteurs lui rapportent.
//
// Vecteur d'etat (11 composantes) :
//   0-2  position ECI [m]
//   3-5  vitesse ECI [m/s]
//   6    ergol restant dans l'etage courant [kg]
//   7-10 quaternion attitude corps -> ECI
//
// La vitesse angulaire n'est pas un etat dynamique : il n'y a pas de modele
// d'inertie ni de couples. Le pilote automatique impose directement une vitesse
// de rotation, saturee, et le corps la suit. C'est suffisant pour produire un
// signal gyrometrique realiste sans modeliser une boucle d'asservissement
// d'attitude complete.

import { EARTH } from '../core/constants.js';
import * as V from '../core/vec.js';
import { gravity } from '../core/gravity.js';
import { atmosphere } from '../core/atmosphere.js';
import { totalMass, propulsion, cdOfMach, glideCoefficients } from './vehicle.js';
import { eciToEcef, ecefToLla } from '../core/geodesy.js';

export const IDX = { R: 0, V: 3, PROP: 6, Q: 7, SIZE: 11 };

const OMEGA_E = [0, 0, EARTH.omega];

export const getR = (y) => [y[0], y[1], y[2]];
export const getV = (y) => [y[3], y[4], y[5]];
export const getQ = (y) => [y[7], y[8], y[9], y[10]];

/** Vitesse par rapport a l'air (l'atmosphere tourne avec la Terre). */
export function airRelativeVelocity(r, v) {
  return V.sub(v, V.cross(OMEGA_E, r));
}

/**
 * Bilan des forces a un instant donne.
 * `ctrl` decrit la configuration courante du vehicule :
 *   { veh, stageIndex, burning, throttle, separated, aeroMode, gravityModel }
 *
 * Renvoie les accelerations separees, car le calculateur en a besoin :
 * l'accelerometre ne mesure QUE la force specifique (poussee + aerodynamique),
 * jamais la gravite. C'est toute la difficulte de la navigation inertielle.
 */
export function computeForces(t, y, ctrl) {
  const r = getR(y);
  const v = getV(y);
  const q = V.qNormalize(getQ(y));
  const veh = ctrl.veh;

  const alt = ecefToLla(eciToEcef(r, t)).alt;
  const mass = ctrl.separated
    ? veh.payloadMass
    : totalMass(veh, ctrl.stageIndex, y[IDX.PROP]);

  // Axe longitudinal du vehicule, exprime en ECI.
  const xBody = V.qRot(q, [1, 0, 0]);

  // --- Propulsion ---
  let aThrust = [0, 0, 0];
  let thrust = 0;
  let mdot = 0;
  if (ctrl.burning && !ctrl.separated && y[IDX.PROP] > 0) {
    const p = propulsion(veh, ctrl.stageIndex, alt, ctrl.throttle ?? 1);
    thrust = p.thrust;
    mdot = p.mdot;
    aThrust = V.scale(xBody, thrust / mass);
  }

  // --- Aerodynamique ---
  const vRel = airRelativeVelocity(r, v);
  const vRelMag = V.norm(vRel);
  const { rho, a: aSound } = atmosphere(alt);
  const mach = vRelMag / aSound;
  const qDyn = 0.5 * rho * vRelMag * vRelMag;

  let aAero = [0, 0, 0];
  let aoa = 0;
  let cl = 0, cd = 0, area = 0;

  if (vRelMag > 1 && rho > 1e-12) {
    const vHat = V.scale(vRel, 1 / vRelMag);
    // Incidence : angle entre l'axe du corps et le vent relatif.
    aoa = V.angleBetween(xBody, vHat);

    // Direction de portance : composante de l'axe corps orthogonale au vent.
    // A incidence positive, la portance pousse vers ou pointe le nez.
    let lHat = V.rejectFrom(xBody, vHat);
    const ln = V.norm(lHat);
    lHat = ln > 1e-6 ? V.scale(lHat, 1 / ln) : [0, 0, 0];

    if (ctrl.aeroMode === 'glide') {
      area = veh.rv.refArea;
      const c = glideCoefficients(veh, aoa);
      cl = c.cl;
      cd = c.cd;
    } else if (ctrl.aeroMode === 'marv') {
      // Corps de rentree manoeuvrant. La trainee de base reste celle d'un corps
      // de rentree — c'est le coefficient balistique qui la fixe — mais des
      // gouvernes lui ajoutent une portance commandable, et la trainee induite
      // qui va avec. Cette derniere n'est pas un detail : c'est elle qui fait
      // qu'une manoeuvre terminale se paie en vitesse a l'impact.
      area = veh.rv.refArea;
      const m = veh.marv;
      const s2 = Math.sin(2 * aoa);
      cl = m.liftSlope * s2;
      cd = veh.payloadMass / (veh.rv.ballisticCoef * area) + 0.9 * cl * cl;
    } else if (ctrl.aeroMode === 'rv') {
      area = veh.rv.refArea;
      // Corps de rentree non porteur : le coefficient balistique fixe tout.
      cd = veh.payloadMass / (veh.rv.ballisticCoef * area);
      // Une legere portance subsiste si le corps n'est pas parfaitement aligne.
      cl = 0.6 * Math.sin(2 * aoa);
    } else {
      area = veh.refArea;
      cd = cdOfMach(mach);
      // Force normale du corps elance sous incidence, modele newtonien.
      const s = Math.sin(aoa);
      cl = 2 * s * s * Math.cos(aoa) * Math.sign(aoa || 1);
    }

    const fD = qDyn * area * cd;
    const fL = qDyn * area * cl;
    aAero = V.lc2(vHat, -fD / mass, lHat, fL / mass);
  }

  // Force specifique : exactement ce que mesure l'accelerometre.
  const aSpecific = V.add(aThrust, aAero);
  const aGrav = gravity(r, ctrl.gravityModel ?? 'j2');

  return {
    aSpecific, aGrav, aThrust, aAero,
    mass, mdot, thrust, alt, mach, qDyn, rho, aoa,
    vRel, vRelMag, xBody, cl, cd, area,
    accel: V.add(aSpecific, aGrav),
  };
}

/**
 * Derivee de l'etat. `ctrl.omegaBody` est la vitesse de rotation commandee,
 * consideree constante sur le pas d'integration.
 */
export function makeDeriv(ctrl) {
  return (t, y) => {
    const f = computeForces(t, y, ctrl);
    const q = V.qNormalize(getQ(y));
    const dq = V.qDot(q, ctrl.omegaBody ?? [0, 0, 0]);
    return [
      y[3], y[4], y[5],
      f.accel[0], f.accel[1], f.accel[2],
      ctrl.burning && !ctrl.separated ? -f.mdot : 0,
      dq[0], dq[1], dq[2], dq[3],
    ];
  };
}

/**
 * Vitesse de rotation a appliquer pour rallier l'attitude commandee.
 * Loi proportionnelle saturee : simple, stable, et suffisante pour que le
 * gyrometre voie des rotations realistes.
 */
export function attitudeRateCommand(qCurrent, qTarget, gain, maxRate) {
  const errEci = V.rotVecBetween(qTarget, V.qNormalize(qCurrent));
  // La commande gyroscopique s'exprime dans le repere du corps.
  const errBody = V.m3tv(V.qToM3(V.qNormalize(qCurrent)), errEci);
  let w = V.scale(errBody, gain);
  const n = V.norm(w);
  if (n > maxRate) w = V.scale(w, maxRate / n);
  return w;
}

/**
 * Attitude commandee pendant la phase propulsee : axe X selon la direction de
 * poussee voulue. Le roulis est reference sur la normale au plan de tir, et
 * non sur la verticale locale : au decollage la poussee EST verticale, et une
 * reference verticale serait degeneree precisement a l'instant du lancement.
 * La normale au plan de tir, elle, reste orthogonale a la poussee tout le vol.
 */
export function thrustAttitude(thrustDir, planeNormal) {
  return V.m3ToQ(V.frameFromXY(thrustDir, planeNormal));
}

/**
 * Attitude commandee en vol atmospherique porteur.
 *
 * On construit d'abord le repere vent aeronautique (X avant, Y tribord,
 * Z ventral), puis on applique le roulis autour de X, puis l'incidence autour
 * de l'axe de tangage deja incline. Convention : incidence positive = nez
 * au-dessus du vecteur vitesse, gite positive = virage a droite.
 */
export function windAttitude(vRel, rEci, aoa, bank) {
  const xW = V.normalize(vRel);
  const up = V.normalize(rEci);
  // Axe de tangage = tribord. Degenere seulement en piquee strictement
  // verticale, ou la notion de gite n'a de toute facon plus de sens.
  let pitchAxis = V.cross(xW, up);
  const pn = V.norm(pitchAxis);
  pitchAxis = pn > 1e-6
    ? V.scale(pitchAxis, 1 / pn)
    : V.normalize(V.rejectFrom(Math.abs(xW[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], xW));

  const qWind = V.m3ToQ(V.frameFromXY(xW, pitchAxis));
  const qBank = V.qFromAxisAngle(xW, bank);
  const qPitch = V.qFromAxisAngle(V.qRot(qBank, pitchAxis), aoa);
  return V.qNormalize(V.qMul(qPitch, V.qMul(qBank, qWind)));
}
