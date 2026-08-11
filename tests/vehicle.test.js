// Tests du vehicule et de la dynamique "verite terrain".
import { EARTH, G0, DEG } from '../src/core/constants.js';
import * as V from '../src/core/vec.js';
import { llaToEcef, ecefToEci } from '../src/core/geodesy.js';
import { atmosphere } from '../src/core/atmosphere.js';
import { gravityJ2 } from '../src/core/gravity.js';
import { rk4 } from '../src/core/integrator.js';
import {
  VEHICLES, totalMass, liftoffMass, propulsion, burnTime,
  stageDeltaV, totalDeltaV, cdOfMach, glideCoefficients, bestGlideAoA,
} from '../src/sim/vehicle.js';
import {
  computeForces, makeDeriv, windAttitude, thrustAttitude,
  attitudeRateCommand, airRelativeVelocity, IDX,
} from '../src/sim/dynamics.js';

export default function run(t) {
  const veh = VEHICLES.bal2;

  // --- Comptabilite des masses ---
  {
    const expected = veh.payloadMass
      + veh.stages.reduce((s, st) => s + st.dryMass + st.propMass, 0);
    t.close(liftoffMass(veh), expected, 1e-9, 'masse au decollage');
    // Apres largage du 1er etage, sa masse a vide disparait.
    const afterSep = totalMass(veh, 1, veh.stages[1].propMass);
    t.close(afterSep, expected - veh.stages[0].dryMass - veh.stages[0].propMass, 1e-9,
      'masse apres largage du 1er etage');
    t.close(totalMass(veh, veh.stages.length - 1, 0),
      veh.payloadMass + veh.stages[1].dryMass, 1e-9, 'masse en fin de combustion');
  }

  // --- Propulsion ---
  {
    const sl = propulsion(veh, 0, 0);
    const vac = propulsion(veh, 0, 200000);
    t.close(sl.thrust, veh.stages[0].thrustSL, 1, 'poussee au niveau de la mer');
    t.close(vac.thrust, veh.stages[0].thrustVac, 1, 'poussee dans le vide');
    t.ok(vac.thrust > sl.thrust, 'la poussee augmente avec l altitude');
    t.close(sl.mdot, vac.mdot, 1e-12, 'debit massique independant de l altitude');
    t.close(sl.mdot, veh.stages[0].thrustVac / (veh.stages[0].ispVac * G0), 1e-9, 'debit massique');
    // La poussee doit croitre de facon monotone avec l'altitude.
    let prev = -1;
    for (let z = 0; z <= 60000; z += 2000) {
      const th = propulsion(veh, 0, z).thrust;
      t.ok(th >= prev - 1e-6, `poussee monotone a ${z} m`, true);
      prev = th;
    }
    // Le temps de combustion doit epuiser exactement les ergols.
    t.close(burnTime(veh, 0) * sl.mdot, veh.stages[0].propMass, 1e-6, 'duree de combustion');
    t.close(propulsion(veh, 0, 0, 0.5).thrust, sl.thrust * 0.5, 1e-6, 'reglage de poussee');
  }

  // --- Delta-v ideal ---
  {
    const dv0 = stageDeltaV(veh, 0);
    const m0 = liftoffMass(veh);
    const m1 = totalMass(veh, 0, 0);
    t.close(dv0, veh.stages[0].ispVac * G0 * Math.log(m0 / m1), 1e-9, 'Tsiolkovski etage 1');
    t.close(totalDeltaV(veh), stageDeltaV(veh, 0) + stageDeltaV(veh, 1), 1e-9, 'delta-v cumule');
    // Les trois vecteurs doivent avoir un delta-v plausible pour un engin balistique.
    for (const id of Object.keys(VEHICLES)) {
      const dv = totalDeltaV(VEHICLES[id]);
      t.ok(dv > 4000 && dv < 12000, `delta-v ideal plausible pour ${id} (${Math.round(dv)} m/s)`);
    }
  }

  // --- Trainee ---
  {
    t.ok(cdOfMach(1.05) > cdOfMach(0.5), 'pic de trainee transsonique');
    t.ok(cdOfMach(1.05) > cdOfMach(5), 'la trainee retombe en hypersonique');
    t.close(cdOfMach(-3), cdOfMach(0), 1e-12, 'Mach negatif ramene a zero');
    t.close(cdOfMach(1000), cdOfMach(25), 1e-12, 'saturation au-dela de la table');
    for (let m = 0; m < 30; m += 0.1) {
      t.ok(cdOfMach(m) > 0.1 && cdOfMach(m) < 0.6, `Cd borne a Mach ${m.toFixed(1)}`, true);
    }
  }

  // --- Aerodynamique du planeur ---
  {
    const gv = VEHICLES.glide;
    t.close(glideCoefficients(gv, 0).cl, 0, 1e-12, 'portance nulle a incidence nulle');
    t.ok(glideCoefficients(gv, 0).cd > 0, 'trainee axiale residuelle a incidence nulle');
    const a = bestGlideAoA(gv);
    const { cl, cd } = glideCoefficients(gv, a);
    const ld = cl / cd;
    t.ok(a > 5 * DEG && a < 25 * DEG, `incidence de finesse max plausible (${(a / DEG).toFixed(1)} deg)`);
    t.ok(ld > 1.5 && ld < 4, `finesse hypersonique plausible (${ld.toFixed(2)})`);
    // La finesse doit bien etre maximale a cette incidence.
    for (let d = 1; d < 30; d += 0.5) {
      const c = glideCoefficients(gv, d * DEG);
      t.ok(c.cl / c.cd <= ld + 1e-9, `finesse maximale a ${(a / DEG).toFixed(1)} deg`, true);
    }
    // La portance doit croitre avec l'incidence dans le domaine utile.
    for (let d = 1; d < 18; d += 1) {
      t.ok(glideCoefficients(gv, (d + 1) * DEG).cl > glideCoefficients(gv, d * DEG).cl,
        `portance croissante a ${d} deg`, true);
    }
    // Le facteur de qualite aerodynamique doit bien augmenter la finesse.
    const better = { ...gv, glide: { ...gv.glide, ldScale: 2.0 } };
    const cBetter = glideCoefficients(better, bestGlideAoA(better));
    t.ok(cBetter.cl / cBetter.cd > ld, 'ldScale ameliore la finesse');
  }

  // --- Attitude en repere vent ---
  {
    const rEci = llaToEcef(20, 30, 60000);
    // Vitesse horizontale locale : plein Est.
    const up = V.normalize(rEci);
    const east = V.normalize(V.cross([0, 0, 1], rEci));
    const vRel = V.scale(east, 2000);

    for (const aoaDeg of [0, 5, 12, 18]) {
      for (const bankDeg of [0, 30, 60, -45, 90, 180]) {
        const aoa = aoaDeg * DEG, bank = bankDeg * DEG;
        const q = windAttitude(vRel, rEci, aoa, bank);
        const xBody = V.qRot(q, [1, 0, 0]);
        t.close(V.angleBetween(xBody, vRel), aoa, 1e-9,
          `incidence restituee (${aoaDeg} deg, gite ${bankDeg} deg)`, true);
        // Le quaternion doit rester unitaire.
        t.close(Math.hypot(...q), 1, 1e-12, 'quaternion unitaire', true);
      }
    }

    // Direction de portance en fonction de la gite.
    const liftDir = (bankDeg) => {
      const q = windAttitude(vRel, rEci, 10 * DEG, bankDeg * DEG);
      return V.normalize(V.rejectFrom(V.qRot(q, [1, 0, 0]), V.normalize(vRel)));
    };
    t.close(V.dot(liftDir(0), up), 1, 1e-6, 'gite nulle : portance vers le haut');
    t.close(V.dot(liftDir(180), up), -1, 1e-6, 'gite 180 : portance vers le bas');
    t.close(V.dot(liftDir(90), up), 0, 1e-6, 'gite 90 : portance horizontale');
    t.close(V.dot(liftDir(60), up), Math.cos(60 * DEG), 1e-6, 'composante verticale en cos(gite)');
    // Gite positive = virage a droite : la portance pointe a tribord.
    const starboard = V.normalize(V.cross(V.normalize(vRel), up));
    t.ok(V.dot(liftDir(90), starboard) > 0.99, 'gite positive = virage a droite');
    t.ok(V.dot(liftDir(-90), starboard) < -0.99, 'gite negative = virage a gauche');
  }

  // --- Attitude propulsee, y compris au decollage ---
  {
    const rEci = llaToEcef(36, 3, 0);
    const up = V.normalize(rEci);
    const planeNormal = V.normalize(V.cross(rEci, llaToEcef(45, 40, 0)));
    // Cas critique : poussee strictement verticale au lancement.
    const q = thrustAttitude(up, planeNormal);
    const x = V.qRot(q, [1, 0, 0]);
    t.close(V.dist(x, up), 0, 1e-9, 'axe corps aligne sur la poussee verticale');
    t.ok(Number.isFinite(q[0] + q[1] + q[2] + q[3]), 'attitude definie au decollage');
    const m = V.qToM3(q);
    const mmT = V.m3mul(m, V.m3transpose(m));
    t.close(V.dist([mmT[0], mmT[4], mmT[8]], [1, 1, 1]), 0, 1e-12, 'repere de poussee orthonorme');
    // Le roulis doit rester continu quand la poussee bascule progressivement.
    let prevY = null, maxJump = 0;
    for (let d = 0; d <= 90; d += 1) {
      const dir = V.normalize(V.lc2(up, Math.cos(d * DEG), V.cross(planeNormal, up), Math.sin(d * DEG)));
      const yAxis = V.qRot(thrustAttitude(dir, planeNormal), [0, 1, 0]);
      if (prevY) maxJump = Math.max(maxJump, V.dist(yAxis, prevY));
      prevY = yAxis;
    }
    t.ok(maxJump < 0.05, `pas de saut de roulis pendant le basculement (max ${maxJump.toFixed(4)})`);
  }

  // --- Asservissement d'attitude ---
  {
    let q = V.qIdentity();
    const qT = V.qNormalize([0.7, 0.5, 0.3, 0.4]);
    const dt = 0.02;
    for (let i = 0; i < 4000; i++) {
      const w = attitudeRateCommand(q, qT, 2.0, 0.3);
      const d = V.qDot(q, w);
      q = V.qNormalize([q[0] + d[0] * dt, q[1] + d[1] * dt, q[2] + d[2] * dt, q[3] + d[3] * dt]);
    }
    t.close(V.norm(V.rotVecBetween(qT, q)), 0, 1e-4, 'l attitude converge vers la consigne');
    // La saturation de vitesse doit etre respectee.
    const wBig = attitudeRateCommand(V.qIdentity(), V.qFromAxisAngle([0, 0, 1], 3.0), 5.0, 0.25);
    t.close(V.norm(wBig), 0.25, 1e-9, 'vitesse de rotation saturee');
  }

  // --- Bilan des forces ---
  {
    const rEci = llaToEcef(0, 0, 500000);
    const vEci = [0, 7000, 0];
    const q = V.qIdentity();
    const y = [...rEci, ...vEci, 0, ...q];

    // En chute libre hors atmosphere : force specifique nulle, accel = gravite.
    const f = computeForces(0, y, {
      veh, stageIndex: 1, burning: false, separated: true, aeroMode: 'rv', gravityModel: 'j2',
    });
    t.close(V.norm(f.aSpecific), 0, 1e-12, 'force specifique nulle en chute libre');
    t.close(V.dist(f.accel, gravityJ2(rEci)), 0, 1e-12, 'acceleration = gravite seule');
    t.close(f.mass, veh.payloadMass, 1e-9, 'masse apres separation');

    // Poussee : dirigee selon l'axe X du corps, d'intensite T/m.
    const rLow = llaToEcef(0, 0, 1000);
    const qUp = thrustAttitude(V.normalize(rLow), [0, 0, 1]);
    const y2 = [...rLow, 0, 0, 0, veh.stages[0].propMass, ...qUp];
    const f2 = computeForces(0, y2, {
      veh, stageIndex: 0, burning: true, throttle: 1, separated: false,
      aeroMode: 'launcher', gravityModel: 'j2',
    });
    const expectedThrust = propulsion(veh, 0, f2.alt).thrust / liftoffMass(veh);
    t.close(V.norm(f2.aThrust), expectedThrust, 1e-6, 'intensite de l acceleration de poussee');
    t.close(V.dot(V.normalize(f2.aThrust), V.normalize(rLow)), 1, 1e-9, 'poussee selon l axe du corps');
    t.close(f2.mass, liftoffMass(veh), 1e-9, 'masse au decollage dans le bilan');

    // Trainee : opposee a la vitesse relative a l'air, jamais a la vitesse ECI.
    const rAir = llaToEcef(0, 0, 15000);
    const vAir = [0, 1200, 0];
    const y3 = [...rAir, ...vAir, 0, ...V.qIdentity()];
    const f3 = computeForces(0, y3, {
      veh, stageIndex: 1, burning: false, separated: true, aeroMode: 'rv', gravityModel: 'j2',
    });
    const vRelExpected = airRelativeVelocity(rAir, vAir);
    t.ok(V.norm(f3.aAero) > 0, 'trainee non nulle dans l atmosphere');
    t.close(V.dot(V.normalize(f3.aAero), V.normalize(vRelExpected)), -1, 1e-3,
      'trainee opposee a la vitesse air');
    t.ok(V.norm(V.sub(vRelExpected, vAir)) > 100, 'la rotation de l atmosphere est prise en compte');

    // Coefficient balistique : a = 0.5 rho v^2 / beta, par definition.
    const rho = atmosphere(f3.alt).rho;
    const vr = V.norm(vRelExpected);
    const expectedDrag = (0.5 * rho * vr * vr) / veh.rv.ballisticCoef;
    const dragOnly = Math.abs(V.dot(f3.aAero, V.normalize(vRelExpected)));
    t.close(dragOnly, expectedDrag, expectedDrag * 1e-6, 'deceleration = q/beta');

    // Un coefficient balistique double freine deux fois moins.
    const heavy = { ...veh, rv: { ...veh.rv, ballisticCoef: veh.rv.ballisticCoef * 2 } };
    const f4 = computeForces(0, y3, {
      veh: heavy, stageIndex: 1, burning: false, separated: true, aeroMode: 'rv', gravityModel: 'j2',
    });
    t.close(V.norm(f4.aAero) / V.norm(f3.aAero), 0.5, 1e-6, 'beta double => trainee moitie');
  }

  // --- Conservation de l'energie en vol libre ---
  {
    // Orbite circulaire a 1500 km : au-dela du domaine du modele
    // d'atmosphere, donc trainee rigoureusement nulle. On teste ainsi
    // l'integrateur et la gravite seuls, sans dissipation parasite.
    const r0 = llaToEcef(10, 20, 1500000);
    const up = V.normalize(r0);
    const east = V.normalize(V.cross([0, 0, 1], r0));
    const vCirc = Math.sqrt(EARTH.mu / V.norm(r0));
    const v0 = V.scale(V.normalize(V.rejectFrom(east, up)), vCirc);
    let y = [...r0, ...v0, 0, ...V.qIdentity()];
    const ctrl = {
      veh, stageIndex: 1, burning: false, separated: true,
      aeroMode: 'rv', gravityModel: 'point', omegaBody: [0, 0, 0],
    };
    const deriv = makeDeriv(ctrl);
    const energy = (s) => {
      const rn = V.norm([s[0], s[1], s[2]]);
      const vn = V.norm([s[3], s[4], s[5]]);
      return 0.5 * vn * vn - EARTH.mu / rn;
    };
    const e0 = energy(y);
    const h0 = V.cross([y[0], y[1], y[2]], [y[3], y[4], y[5]]);
    for (let i = 0; i < 3000; i++) y = rk4(deriv, i * 0.5, y, 0.5);
    t.close(Math.abs(energy(y) - e0) / Math.abs(e0), 0, 1e-11, 'energie conservee en vol libre');
    const h1 = V.cross([y[0], y[1], y[2]], [y[3], y[4], y[5]]);
    t.close(V.dist(h1, h0) / V.norm(h0), 0, 1e-11, 'moment cinetique conserve');
    t.close(Math.hypot(y[7], y[8], y[9], y[10]), 1, 1e-9, 'quaternion reste unitaire');
    // L'orbite circulaire doit rester circulaire.
    t.close(V.norm([y[0], y[1], y[2]]) / V.norm(r0), 1, 1e-10, 'rayon constant sur orbite circulaire');
  }

  // --- La trainee, elle, doit bien dissiper de l'energie ---
  {
    // Meme configuration mais sur une trajectoire qui traverse l'atmosphere :
    // l'energie orbitale doit cette fois decroitre de facon monotone.
    const r0 = llaToEcef(0, 0, 120000);
    const up = V.normalize(r0);
    const east = V.normalize(V.cross([0, 0, 1], r0));
    let y = [...r0, ...V.lc2(east, 5000, up, -600), 0, ...V.qIdentity()];
    const ctrl = {
      veh, stageIndex: 1, burning: false, separated: true,
      aeroMode: 'rv', gravityModel: 'point', omegaBody: [0, 0, 0],
    };
    const deriv = makeDeriv(ctrl);
    const energy = (s) => 0.5 * V.norm2([s[3], s[4], s[5]]) - EARTH.mu / V.norm([s[0], s[1], s[2]]);
    let e = energy(y), monotone = true;
    for (let i = 0; i < 400; i++) {
      y = rk4(deriv, i * 0.25, y, 0.25);
      const en = energy(y);
      if (en > e + 1e-6) monotone = false;
      e = en;
    }
    t.ok(monotone, 'la trainee ne peut que dissiper de l energie');
    t.ok(e < energy([...r0, ...V.lc2(east, 5000, up, -600)]) - 1e5,
      'perte d energie significative a la rentree');
  }

  // --- La masse decroit bien pendant la combustion ---
  {
    const r0 = llaToEcef(36, 3, 100);
    const qUp = thrustAttitude(V.normalize(r0), [0, 0, 1]);
    const ctrl = {
      veh, stageIndex: 0, burning: true, throttle: 1, separated: false,
      aeroMode: 'launcher', gravityModel: 'j2', omegaBody: [0, 0, 0],
    };
    let y = [...r0, 0, 0, 0, veh.stages[0].propMass, ...qUp];
    const deriv = makeDeriv(ctrl);
    const dt = 0.05;
    const n = 200;
    for (let i = 0; i < n; i++) y = rk4(deriv, i * dt, y, dt);
    const consumed = veh.stages[0].propMass - y[IDX.PROP];
    const mdot = propulsion(veh, 0, 0).mdot;
    t.close(consumed, mdot * n * dt, 1e-6, 'ergols consommes = debit x duree');
    t.ok(V.norm([y[3], y[4], y[5]]) > 50, 'le vehicule accelere pendant la combustion');
    // Il doit avoir gagne de l'altitude.
    t.ok(V.norm([y[0], y[1], y[2]]) > V.norm(r0), 'le vehicule monte');
  }
}
