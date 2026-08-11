// Navigation inertielle pure (mecanisation strapdown en ECI) et filtre de
// Kalman a etat d'erreur.
//
// PRINCIPE
// L'accelerometre ne mesure PAS l'acceleration : il mesure la force specifique,
// c'est-a-dire tout sauf la gravite. En chute libre il indique zero. Le
// calculateur doit donc rajouter lui-meme la gravite, calculee a partir de la
// position qu'il croit avoir — une position deja entachee d'erreur. La boucle
// se referme sur elle-meme, et c'est ce qui rend la derive inertielle si
// difficile a contenir.
//
// ETAT D'ERREUR (15 composantes), convention x = estime - vrai :
//   0-2   erreur de position ECI       [m]
//   3-5   erreur de vitesse ECI        [m/s]
//   6-8   erreur d'attitude (petit vecteur rotation, en ECI) [rad]
//   9-11  erreur sur le biais accelerometrique [m/s^2]
//   12-14 erreur sur le biais gyrometrique     [rad/s]
//
// Le filtre estime l'ERREUR plutot que l'etat lui-meme : l'erreur reste petite
// et sa dynamique est quasi lineaire, alors que l'etat, lui, ne l'est pas du
// tout. C'est la formulation standard en navigation inertielle.

import * as V from '../core/vec.js';
import * as M from '../core/mat.js';
import { gravity, gravityGradient } from '../core/gravity.js';
import { rk4 } from '../core/integrator.js';
import { eciToEcef, ecefToEci, ecefToLla, enuMatrix } from '../core/geodesy.js';
import { U } from './sensors.js';

export const N = 15;
export const IR = 0, IV = 3, IPSI = 6, IBA = 9, IBG = 12;

export class InertialNavigator {
  /**
   * @param {object} init  { r, v, q } etat initial CRU (deja entache d'erreur)
   * @param {object} tuning valeurs de reglage du filtre, deduites de la
   *                        specification de la centrale embarquee.
   */
  constructor(init, tuning) {
    this.r = V.clone(init.r);
    this.v = V.clone(init.v);
    this.q = V.qNormalize(init.q);
    this.biasAccel = [0, 0, 0];
    this.biasGyro = [0, 0, 0];
    this.gravityModel = tuning.gravityModel ?? 'j2';

    // Coefficients de bruit tels que le filtre les CROIT. Un filtre trop
    // optimiste sur son materiel diverge silencieusement.
    this.arw = tuning.arw;
    this.vrw = tuning.vrw;
    this.gyroWalk = tuning.gyroWalk;
    this.accelWalk = tuning.accelWalk;
    // Les erreurs de facteur d'echelle ne font pas partie de l'etat estime :
    // les modeliser demanderait six etats de plus pour un gain modeste. Mais
    // les ignorer rendrait le filtre trop confiant, car pendant la poussee
    // leur effet depasse celui du biais. On les provisionne donc comme un
    // bruit de processus proportionnel a la sollicitation instantanee.
    this.scaleAccelSigma = tuning.scaleAccelSigma ?? 0;
    this.scaleGyroSigma = tuning.scaleGyroSigma ?? 0;

    this.P = M.mat(N, N);
    const set = (i, s) => { this.P.d[i * N + i] = s * s; };
    for (let i = 0; i < 3; i++) {
      set(IR + i, tuning.sigmaPos ?? 5);
      set(IV + i, tuning.sigmaVel ?? 0.02);
      set(IPSI + i, tuning.sigmaAtt);
      set(IBA + i, tuning.sigmaBiasAccel);
      set(IBG + i, tuning.sigmaBiasGyro);
    }

    this.fI = [0, 0, 0]; // derniere force specifique projetee en ECI
    this.wNorm = 0; // derniere vitesse de rotation mesuree [rad/s]
    this.C = V.qToM3(this.q);
    this.pendingDt = 0; // temps accumule depuis la derniere propagation de P
    this.updates = { alt: 0, star: 0, terrain: 0, rejected: 0 };
  }

  /**
   * Mecanisation : integre un increment inertiel.
   * Schema du point milieu sur l'attitude et sur la position, ce qui suffit
   * largement aux pas de temps utilises ici.
   */
  propagate(fMeas, wMeas, dt) {
    const fB = V.sub(fMeas, this.biasAccel);
    const wB = V.sub(wMeas, this.biasGyro);

    // Attitude : rotation exacte par le vecteur rotation, pas d'approximation
    // au premier ordre — sinon le quaternion perd sa norme a chaque pas.
    const qMid = V.qMul(this.q, V.qFromRotVec(V.scale(wB, dt * 0.5)));
    const qNew = V.qNormalize(V.qMul(this.q, V.qFromRotVec(V.scale(wB, dt))));

    // Projection de la force specifique avec l'attitude au milieu du pas.
    const fI = V.m3v(V.qToM3(qMid), fB);

    // Integration de la position et de la vitesse par Runge-Kutta d'ordre 4,
    // la force specifique etant tenue constante sur le pas — c'est bien ce
    // que fournit l'accelerometre, une moyenne sur l'intervalle.
    //
    // Un schema d'ordre 2 suffirait pendant la poussee, mais pas sur les
    // longues phases de vol libre : sa troncature y atteint plusieurs
    // centaines de metres, ce qui masquerait completement les erreurs de
    // capteurs que ce simulateur cherche justement a mettre en evidence.
    const model = this.gravityModel;
    const deriv = (_tt, y) => {
      const g = gravity([y[0], y[1], y[2]], model);
      return [y[3], y[4], y[5], fI[0] + g[0], fI[1] + g[1], fI[2] + g[2]];
    };
    const y = rk4(deriv, 0, [...this.r, ...this.v], dt);
    const a = V.add(fI, gravity(this.r, model));

    this.r = [y[0], y[1], y[2]];
    this.v = [y[3], y[4], y[5]];
    this.q = qNew;
    this.C = V.qToM3(qNew);
    this.fI = fI;
    this.wNorm = V.norm(wB);

    this.pendingDt += dt;
    return { fI, a };
  }

  /**
   * Propagation de la covariance. Appelee moins souvent que la mecanisation :
   * la covariance evolue lentement, et les produits matriciels 15x15 sont la
   * partie couteuse.
   */
  propagateCovariance(dtMin = 0.25) {
    const dt = this.pendingDt;
    if (dt < dtMin) return;
    this.pendingDt = 0;

    const F = M.mat(N, N);
    // d(dr)/dt = dv
    M.setBlock3(F, IR, IV, V.M3_I());
    // d(dv)/dt = G.dr - [fI x].psi - C.dba
    M.setBlock3(F, IV, IR, gravityGradient(this.r));
    M.setBlock3(F, IV, IPSI, V.skew(this.fI).map((x) => -x));
    M.setBlock3(F, IV, IBA, this.C.map((x) => -x));
    // d(psi)/dt = -C.dbg
    M.setBlock3(F, IPSI, IBG, this.C.map((x) => -x));

    // Transition au second ordre : pendant la phase propulsee le couplage
    // attitude -> vitesse vaut plusieurs dizaines de m/s par radian, et le
    // premier ordre seul devient insuffisant.
    const Fdt = M.scaleInto(M.copy(F), dt);
    const Phi = M.eye(N);
    M.addInto(Phi, Fdt);
    M.addInto(Phi, M.mul(Fdt, Fdt), 0.5);

    let P = M.mulT(M.mul(Phi, this.P), Phi);

    // Bruit de processus : bruits blancs des capteurs, marche des biais, et
    // provision pour les facteurs d'echelle non modelises. Ce dernier terme
    // n'agit que lorsque le capteur est sollicite — nul en vol libre, dominant
    // pendant la poussee.
    const sfAccel = this.scaleAccelSigma * V.norm(this.fI);
    const sfGyro = this.scaleGyroSigma * this.wNorm;
    const qv = (this.vrw * this.vrw + sfAccel * sfAccel) * dt;
    const qp = (this.arw * this.arw + sfGyro * sfGyro) * dt;
    const qba = this.accelWalk * this.accelWalk * dt;
    const qbg = this.gyroWalk * this.gyroWalk * dt;
    for (let i = 0; i < 3; i++) {
      P.d[(IV + i) * N + (IV + i)] += qv;
      P.d[(IPSI + i) * N + (IPSI + i)] += qp;
      P.d[(IBA + i) * N + (IBA + i)] += qba;
      P.d[(IBG + i) * N + (IBG + i)] += qbg;
    }
    this.P = M.symmetrize(P);
  }

  /**
   * Mise a jour generique.
   * Convention : z = prediction - mesure, de sorte que z ~ H.x directement.
   * Forme de Joseph pour la covariance : plus couteuse, mais elle preserve la
   * symetrie et la positivite meme quand le gain n'est pas optimal.
   */
  update(H, z, R, gateChi2 = 0) {
    const PHt = M.mulT(this.P, H);
    const S = M.add(M.mul(H, PHt), R);
    const Sinv = M.inverse(S);
    if (!Sinv) return false;

    // Test de coherence : une mesure trop eloignee de la prediction est
    // probablement aberrante et corromprait le filtre.
    if (gateChi2 > 0) {
      const Sz = M.mulVec(Sinv, z);
      let d2 = 0;
      for (let i = 0; i < z.length; i++) d2 += z[i] * Sz[i];
      if (d2 > gateChi2) { this.updates.rejected++; return false; }
    }

    const K = M.mul(PHt, Sinv);
    const x = M.mulVec(K, z);

    const ImKH = M.add(M.eye(N), M.mul(K, H), -1);
    const P1 = M.mulT(M.mul(ImKH, this.P), ImKH);
    const P2 = M.mulT(M.mul(K, R), K);
    this.P = M.symmetrize(M.addInto(P1, P2));

    this.applyCorrection(x);
    return true;
  }

  /** Retranche l'erreur estimee de l'etat courant. */
  applyCorrection(x) {
    this.r = V.sub(this.r, [x[IR], x[IR + 1], x[IR + 2]]);
    this.v = V.sub(this.v, [x[IV], x[IV + 1], x[IV + 2]]);
    const psi = [x[IPSI], x[IPSI + 1], x[IPSI + 2]];
    this.q = V.qNormalize(V.qMul(V.qFromRotVec(V.neg(psi)), this.q));
    this.C = V.qToM3(this.q);
    this.biasAccel = V.sub(this.biasAccel, [x[IBA], x[IBA + 1], x[IBA + 2]]);
    this.biasGyro = V.sub(this.biasGyro, [x[IBG], x[IBG + 1], x[IBG + 2]]);
  }

  // --- Recalages ---

  /** Recalage en altitude (barometre ou radioaltimetre). */
  updateAltitude(altMeas, sigma, t) {
    const ecef = eciToEcef(this.r, t);
    const lla = ecefToLla(ecef);
    // Jacobien : la normale a l'ellipsoide, ramenee en ECI.
    const nEcef = V.m3v(enuMatrix(lla.lat, lla.lon), [0, 0, 1]);
    const nEci = ecefToEci(nEcef, t);

    const H = M.mat(1, N);
    for (let i = 0; i < 3; i++) H.d[IR + i] = nEci[i];
    const R = M.mat(1, 1);
    R.d[0] = sigma * sigma;
    const ok = this.update(H, [lla.alt - altMeas], R, 30);
    if (ok) this.updates.alt++;
    return ok;
  }

  /** Recalage d'attitude par viseur stellaire. */
  updateAttitude(qMeas, sigmaRad) {
    const psi = V.rotVecBetween(this.q, V.qNormalize(qMeas));
    const H = M.mat(3, N);
    for (let i = 0; i < 3; i++) H.d[i * N + IPSI + i] = 1;
    const R = M.mat(3, 3);
    for (let i = 0; i < 3; i++) R.d[i * 3 + i] = sigmaRad * sigmaRad;
    const ok = this.update(H, psi, R, 40);
    if (ok) this.updates.star++;
    return ok;
  }

  /** Recalage de position horizontale (correlation de terrain). */
  updateHorizontalPosition(rEcefMeas, sigma, t) {
    const rMeasEci = ecefToEci(rEcefMeas, t);
    const lla = ecefToLla(eciToEcef(this.r, t));
    const E = enuMatrix(lla.lat, lla.lon);
    // Colonnes Est et Nord de la matrice ENU, ramenees en ECI.
    const east = ecefToEci([E[0], E[3], E[6]], t);
    const north = ecefToEci([E[1], E[4], E[7]], t);

    const dr = V.sub(this.r, rMeasEci);
    const H = M.mat(2, N);
    for (let i = 0; i < 3; i++) {
      H.d[IR + i] = east[i];
      H.d[N + IR + i] = north[i];
    }
    const R = M.mat(2, 2);
    R.d[0] = sigma * sigma;
    R.d[3] = sigma * sigma;
    const ok = this.update(H, [V.dot(east, dr), V.dot(north, dr)], R, 30);
    if (ok) this.updates.terrain++;
    return ok;
  }

  // --- Diagnostics ---

  /** Ecart-type de position estime PAR LE FILTRE (et non l'erreur reelle). */
  positionSigma() {
    return Math.sqrt(Math.max(0,
      this.P.d[IR * N + IR] + this.P.d[(IR + 1) * N + (IR + 1)] + this.P.d[(IR + 2) * N + (IR + 2)]));
  }

  velocitySigma() {
    return Math.sqrt(Math.max(0,
      this.P.d[IV * N + IV] + this.P.d[(IV + 1) * N + (IV + 1)] + this.P.d[(IV + 2) * N + (IV + 2)]));
  }

  /** Ecart-type d'attitude estime [rad]. */
  attitudeSigma() {
    return Math.sqrt(Math.max(0,
      this.P.d[IPSI * N + IPSI] + this.P.d[(IPSI + 1) * N + (IPSI + 1)]
      + this.P.d[(IPSI + 2) * N + (IPSI + 2)]));
  }
}

/**
 * Construit le reglage du filtre a partir de la specification de la centrale.
 * Le filtre ne connait que la SPECIFICATION de son materiel, jamais les biais
 * effectivement tires pour ce vol. C'est bien la tout le probleme.
 */
export function tuningFromImuConfig(cfg, gravityModel = 'j2') {
  return {
    arw: cfg.gyroARW * U.degPerSqrtHour,
    vrw: cfg.accelVRW * U.mPerSPerSqrtHour,
    gyroWalk: (cfg.gyroBiasWalk * U.degPerHour) / 60,
    accelWalk: (cfg.accelBiasWalk * U.microG) / 60,
    sigmaAtt: cfg.alignment * U.arcmin,
    sigmaBiasAccel: cfg.accelBias * U.microG,
    sigmaBiasGyro: cfg.gyroBias * U.degPerHour,
    scaleAccelSigma: cfg.accelScale * U.ppm,
    scaleGyroSigma: cfg.gyroScale * U.ppm,
    sigmaPos: 5,
    sigmaVel: 0.02,
    gravityModel,
  };
}
