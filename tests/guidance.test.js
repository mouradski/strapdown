// Tests du guidage et de la boucle complete.
import { EARTH, RAD, DEG } from '../src/core/constants.js';
import * as V from '../src/core/vec.js';
import { llaToEcef, ecefToLla, groundRange, flightPathAngle, initialBearing } from '../src/core/geodesy.js';
import { gravityPoint } from '../src/core/gravity.js';
import { rk4 } from '../src/core/integrator.js';
import {
  gaussFromP, gaussMinEnergy, gaussLofted, pBounds, solveIntercept, predictImpact,
} from '../src/guidance/ballistic.js';
import { equilibriumGlideRange, VEHICLES, totalDeltaV, aoaForCL, glideCoefficients, bestGlideAoA } from '../src/sim/vehicle.js';
import { runHeadless } from '../src/sim/world.js';
import { defaultSensorConfig, IMU_GRADES } from '../src/avionics/sensors.js';

const kepler = (t, y) => {
  const a = gravityPoint([y[0], y[1], y[2]]);
  return [y[3], y[4], y[5], a[0], a[1], a[2]];
};

/** Deux points a la surface separes d'une portee donnee, sur l'equateur. */
function pair(rangeKm) {
  return [llaToEcef(0, 0, 0), llaToEcef(0, ((rangeKm * 1000) / EARTH.Rmean) * RAD, 0)];
}

function baseConfig(over = {}) {
  return {
    vehicleId: 'bal2',
    launch: { lat: 28, lon: 2, alt: 300 },
    target: { lat: 36, lon: 20, alt: 0 },
    sensors: { ...defaultSensorConfig(), imu: { ...IMU_GRADES.navigation } },
    loft: 0,
    seed: 42,
    ...over,
  };
}

export default function run(t) {
  // --- Probleme de Gauss : la solution doit vraiment atteindre le 2e point ---
  {
    for (const km of [500, 1000, 3000, 6000, 10000]) {
      const [r1, r2] = pair(km);
      const s = gaussMinEnergy(r1, r2);
      t.ok(s !== null, `solution trouvee a ${km} km`, true);
      let y = [...r1, ...s.v1];
      const n = 4000, dt = s.tof / n;
      for (let i = 0; i < n; i++) y = rk4(kepler, i * dt, y, dt);
      t.close(V.dist([y[0], y[1], y[2]], r2), 0, 1.0,
        `la trajectoire arrive bien sur la cible a ${km} km`);

      // L'angle de pente d'energie minimale suit la formule fermee 45 - psi/4.
      // C'est une verification analytique totalement independante du solveur.
      const psi = ((km * 1000) / EARTH.Rmean) * RAD;
      t.close(flightPathAngle(r1, s.v1) * RAD, 45 - psi / 4, 0.02,
        `angle de pente d energie minimale a ${km} km`);
    }
  }

  // --- Energie minimale : aucun autre p ne fait mieux ---
  {
    const [r1, r2] = pair(3000);
    const me = gaussMinEnergy(r1, r2);
    const { pMin, pMax } = pBounds(r1, r2);
    const hi = Math.min(pMax, pMin * 30);
    let better = 0;
    for (let i = 1; i < 1500; i++) {
      const s = gaussFromP(r1, r2, pMin + (hi - pMin) * (i / 1500));
      if (s && s.speed < me.speed - 1e-6) better++;
    }
    t.ok(better === 0, 'aucune solution moins couteuse que celle d energie minimale');
    t.ok(me.speed > 4000 && me.speed < 5500, `vitesse requise plausible a 3000 km (${(me.speed / 1000).toFixed(2)} km/s)`);
  }

  // --- Cloche : apogee et vitesse croissent avec le parametre ---
  {
    const [r1, r2] = pair(3000);
    let prevApogee = -Infinity, prevSpeed = -Infinity, prevTof = -Infinity;
    for (const loft of [0, 0.25, 0.5, 0.75, 1.0]) {
      const s = gaussLofted(r1, r2, loft);
      t.ok(s.apogee > prevApogee, `apogee croissante (loft ${loft})`);
      t.ok(s.speed >= prevSpeed - 1, `vitesse requise croissante (loft ${loft})`);
      t.ok(s.tof > prevTof, `temps de vol croissant (loft ${loft})`);
      prevApogee = s.apogee; prevSpeed = s.speed; prevTof = s.tof;
      // Et la trajectoire doit toujours atteindre la cible.
      let y = [...r1, ...s.v1];
      const n = 3000, dt = s.tof / n;
      for (let i = 0; i < n; i++) y = rk4(kepler, i * dt, y, dt);
      t.close(V.dist([y[0], y[1], y[2]], r2), 0, 2.0, `cloche ${loft} atteint la cible`, true);
    }
  }

  // --- solveIntercept doit tenir compte de la rotation terrestre ---
  {
    const r1 = llaToEcef(0, 0, 0);
    const targetEcef = llaToEcef(0, 40, 0);
    const sol = solveIntercept(r1, targetEcef, 0, 0);
    t.ok(sol !== null, 'solution d interception trouvee');
    // En propageant, on doit retomber sur la cible APRES qu'elle a tourne.
    // Le solveur suppose un champ keplerien : on propage donc en masse
    // ponctuelle pour ne tester QUE la prise en compte de la rotation.
    const opts = { ballisticCoef: 1e9, gravityModel: 'point' };
    const imp = predictImpact(r1, sol.v1, 0, opts);
    t.close(imp.lla.lat, 0, 0.02, 'impact a la bonne latitude');
    t.close(imp.lla.lon, 40, 0.02, 'impact a la bonne longitude (rotation prise en compte)');
    // Sans tenir compte de la rotation, l'ecart serait de plusieurs centaines de km.
    const naive = gaussMinEnergy(r1, targetEcef);
    const impNaive = predictImpact(r1, naive.v1, 0, opts);
    t.ok(Math.abs(impNaive.lla.lon - 40) > 0.5,
      `ignorer la rotation terrestre couterait cher (${((impNaive.lla.lon - 40) * 111).toFixed(0)} km)`);
    // L'aplatissement terrestre, lui, deplace l'impact de plusieurs km : c'est
    // pour cela que le calculateur corrige sa visee par simulation complete.
    const impJ2 = predictImpact(r1, sol.v1, 0, { ballisticCoef: 1e9, gravityModel: 'j2' });
    const dJ2 = groundRange(imp.lla.lat, imp.lla.lon, impJ2.lla.lat, impJ2.lla.lon);
    t.ok(dJ2 > 2000 && dJ2 < 60000,
      `l aplatissement J2 deplace l impact de ${(dJ2 / 1000).toFixed(1)} km`);
  }

  // --- predictImpact : la trainee raccourcit toujours la portee ---
  {
    const r1 = llaToEcef(0, 0, 0);
    const sol = gaussMinEnergy(r1, llaToEcef(0, 30, 0));
    const noDrag = predictImpact(r1, sol.v1, 0, { ballisticCoef: 1e12 });
    const withDrag = predictImpact(r1, sol.v1, 0, { ballisticCoef: 3000 });
    const rNo = groundRange(0, 0, noDrag.lla.lat, noDrag.lla.lon);
    const rYes = groundRange(0, 0, withDrag.lla.lat, withDrag.lla.lon);
    t.ok(rYes < rNo, `la trainee raccourcit la portee (${((rNo - rYes) / 1000).toFixed(0)} km)`);
    t.ok(withDrag.impactSpeed < noDrag.impactSpeed, 'la trainee reduit la vitesse a l impact');
    // Un coefficient balistique plus eleve penetre plus profond, donc porte plus loin.
    const slippery = predictImpact(r1, sol.v1, 0, { ballisticCoef: 9000 });
    t.ok(groundRange(0, 0, slippery.lla.lat, slippery.lla.lon) > rYes,
      'un coefficient balistique eleve porte plus loin');
    // Le mode grossier doit rester proche du mode fin.
    const coarse = predictImpact(r1, sol.v1, 0, { ballisticCoef: 3000, coarse: true });
    const dCoarse = groundRange(coarse.lla.lat, coarse.lla.lon, withDrag.lla.lat, withDrag.lla.lon);
    t.ok(dCoarse < 5000, `prediction grossiere fidele a ${(dCoarse / 1000).toFixed(2)} km`);
  }

  // --- Formule de portee du vol plane ---
  {
    const R = equilibriumGlideRange(4000, 700, 2.0);
    t.ok(R > 1e6 && R < 6e6, `portee de plane plausible (${(R / 1000).toFixed(0)} km)`);
    t.ok(equilibriumGlideRange(5000, 700, 2.0) > R, 'plus vite = plus loin');
    t.ok(equilibriumGlideRange(4000, 700, 3.0) > R, 'plus fin = plus loin');
    t.close(equilibriumGlideRange(700, 700, 2.0), 0, 1e-9, 'portee nulle a la vitesse plancher');
    t.close(equilibriumGlideRange(500, 700, 2.0), 0, 1e-9, 'portee nulle en dessous du plancher');
    // Proportionnalite a la finesse.
    t.close(equilibriumGlideRange(4000, 700, 4.0) / R, 2, 1e-9, 'portee proportionnelle a la finesse');
  }

  // --- Inversion du coefficient de portance ---
  {
    const gv = VEHICLES.glide;
    for (const target of [0.02, 0.05, 0.1, 0.15]) {
      const a = aoaForCL(gv, target);
      t.close(glideCoefficients(gv, a).cl, target, 1e-3, `aoaForCL restitue CL=${target}`, true);
    }
    t.close(aoaForCL(gv, 0), 0, 1e-12, 'CL nul => incidence nulle');
    t.close(aoaForCL(gv, 99), gv.glide.maxAoA, 1e-12, 'CL inatteignable => incidence maximale');
  }

  // --- Vol complet : chaque vecteur doit atteindre sa cible ---
  {
    const cases = [
      ['bal2 moyenne portee', baseConfig(), 3000],
      ['bal2 courte portee', baseConfig({ target: { lat: 31, lon: 7, alt: 0 } }), 3000],
      ['bal3 longue portee', baseConfig({ vehicleId: 'bal3', target: { lat: 55, lon: 60, alt: 0 } }), 4000],
      ['planeur', baseConfig({ vehicleId: 'glide', target: { lat: 40, lon: 25, alt: 0 } }), 1500],
    ];
    for (const [name, cfg, tol] of cases) {
      const sim = runHeadless(cfg);
      t.ok(sim.result !== null, `${name} : le vol se termine par un impact`);
      if (!sim.result) continue;
      const r = sim.result;
      t.ok(r.missDistance < tol,
        `${name} : ecart de ${(r.missDistance / 1000).toFixed(2)} km (< ${tol / 1000} km)`);
      // La portee atteinte doit correspondre a la portee visee.
      t.close(r.groundRange / r.targetRange, 1, 0.01, `${name} : portee conforme`);
      t.ok(r.apogee > 50000, `${name} : apogee credible (${(r.apogee / 1000).toFixed(0)} km)`);
      t.ok(r.flightTime > 100 && r.flightTime < 3000, `${name} : duree de vol plausible`);
      t.ok(r.burnoutSpeed > 1500, `${name} : vitesse d extinction credible`);
      // L'ecart doit rester du meme ordre que l'erreur de navigation : c'est
      // toute la these du simulateur.
      t.ok(r.missDistance < Math.max(2000, r.navError * 25),
        `${name} : ecart pilote par la derive inertielle (${Math.round(r.navError)} m de derive)`);
    }
  }

  // --- Le calculateur ne voit jamais la verite ---
  {
    // Avec une centrale parfaite l'ecart doit devenir tres petit : cela prouve
    // que la chaine de guidage elle-meme est saine, et que tout le reste de
    // l'ecart vient bien des capteurs.
    const perfect = {
      label: 'ideale', gyroBias: 0, gyroARW: 0, gyroBiasWalk: 0, gyroScale: 0,
      accelBias: 0, accelVRW: 0, accelBiasWalk: 0, accelScale: 0, alignment: 0,
    };
    const sim = runHeadless(baseConfig({ sensors: { ...defaultSensorConfig(), imu: perfect } }));
    t.ok(sim.result.navError < 60,
      `centrale ideale : navigation exacte (${sim.result.navError.toFixed(1)} m)`);
    t.ok(sim.result.missDistance < 400,
      `centrale ideale : le guidage seul atteint la cible a ${sim.result.missDistance.toFixed(0)} m`);

    // Ce plancher doit rester DETERMINISTE et petit devant les erreurs de
    // navigation que le simulateur cherche a mettre en evidence : s'il
    // remontait, il masquerait l'ecart entre deux classes de centrale.
    const again = runHeadless(baseConfig({
      seed: 999, sensors: { ...defaultSensorConfig(), imu: perfect },
    }));
    t.close(again.result.missDistance, sim.result.missDistance, 30,
      'le plancher de guidage ne depend pas du tirage aleatoire');

    // Et il doit etre essentiellement lateral : le critere d'extinction est
    // scalaire en portee, c'est donc le residu perpendiculaire qui subsiste.
    const az = initialBearing(28, 2, 36, 20) * DEG;
    const r = sim.result;
    const alongTrack = r.missNorth * Math.cos(az) + r.missEast * Math.sin(az);
    t.ok(Math.abs(alongTrack) < 200,
      `erreur en portee bien corrigee (${alongTrack.toFixed(0)} m)`);
  }

  // --- La qualite de la centrale doit se voir a l'impact ---
  {
    const errs = {};
    for (const grade of ['consumer', 'tactical', 'navigation', 'strategic']) {
      let sum = 0, n = 0;
      for (const seed of [7, 21, 55]) {
        const sim = runHeadless(baseConfig({
          seed, sensors: { ...defaultSensorConfig(), imu: { ...IMU_GRADES[grade] } },
        }));
        if (sim.result) { sum += sim.result.missDistance; n++; }
      }
      errs[grade] = n ? sum / n : Infinity;
    }
    t.ok(errs.consumer > errs.tactical,
      `centrale grand public moins precise que tactique (${(errs.consumer / 1000).toFixed(1)} > ${(errs.tactical / 1000).toFixed(1)} km)`);
    t.ok(errs.tactical > errs.navigation,
      `tactique moins precise que navigation (${(errs.tactical / 1000).toFixed(1)} > ${(errs.navigation / 1000).toFixed(2)} km)`);
    t.ok(errs.navigation >= errs.strategic * 0.8,
      `navigation pas meilleure que strategique (${(errs.navigation / 1000).toFixed(2)} vs ${(errs.strategic / 1000).toFixed(2)} km)`);
  }

  // --- Le viseur stellaire doit ameliorer la precision ---
  {
    let withSum = 0, withoutSum = 0, n = 0;
    for (const seed of [3, 9, 17]) {
      const s = defaultSensorConfig();
      const a = runHeadless(baseConfig({
        seed, sensors: { ...s, imu: { ...IMU_GRADES.tactical }, starTracker: { ...s.starTracker, enabled: true } },
      }));
      const b = runHeadless(baseConfig({
        seed, sensors: { ...s, imu: { ...IMU_GRADES.tactical }, starTracker: { ...s.starTracker, enabled: false } },
      }));
      if (a.result && b.result) { withSum += a.result.missDistance; withoutSum += b.result.missDistance; n++; }
    }
    t.ok(withSum < withoutSum,
      `le viseur stellaire ameliore la precision (${(withoutSum / n / 1000).toFixed(1)} -> ${(withSum / n / 1000).toFixed(1)} km)`);
  }

  // --- Le planeur doit tenir sa portee avec MOINS d'energie ---
  {
    const glide = runHeadless(baseConfig({ vehicleId: 'glide', target: { lat: 40, lon: 25, alt: 0 } }));
    t.ok(glide.result, 'le planeur atteint le sol');
    const r = glide.result;
    // Un vecteur purement balistique avec la meme vitesse d'extinction
    // n'irait pas aussi loin : c'est tout l'apport du corps porteur.
    const ballisticReach = (() => {
      const [r1] = pair(0);
      let lo = 100, hi = 12000;
      for (let i = 0; i < 40; i++) {
        const mid = 0.5 * (lo + hi);
        const s = gaussMinEnergy(...pair(mid));
        if (s.speed < r.burnoutSpeed) lo = mid; else hi = mid;
      }
      return lo * 1000;
    })();
    t.ok(r.groundRange > ballisticReach,
      `le plane allonge la portee (${(r.groundRange / 1000).toFixed(0)} km contre ${(ballisticReach / 1000).toFixed(0)} km en balistique pur a ${(r.burnoutSpeed / 1000).toFixed(2)} km/s)`);
    // Et sa trajectoire reste basse : c'est sa signature.
    t.ok(r.apogee < 250000, `trajectoire surbaissee (apogee ${(r.apogee / 1000).toFixed(0)} km)`);
    t.ok(r.maxAccel < 20 * 9.80665, `charge structurale moderee (${(r.maxAccel / 9.80665).toFixed(1)} g)`);
  }

  // --- Le planeur doit tenir sa precision sur TOUTE sa plage ---
  // C'est ce que ne permettait aucun coefficient de finesse fixe : le biais
  // changeait de signe avec la portee. Le guidage boucle donc sur une
  // simulation complete du plane, et non sur la formule analytique.
  {
    const perfect = {
      label: 'ideale', gyroBias: 0, gyroARW: 0, gyroBiasWalk: 0, gyroScale: 0,
      accelBias: 0, accelVRW: 0, accelBiasWalk: 0, accelScale: 0, alignment: 0,
    };
    let worst = 0;
    for (const km of [800, 2000, 3500, 5500]) {
      const lon = ((km * 1000) / EARTH.Rmean) * RAD;
      const sim = runHeadless({
        vehicleId: 'glide',
        launch: { lat: 0, lon: 0, alt: 0 },
        target: { lat: 0, lon, alt: 0 },
        sensors: { ...defaultSensorConfig(), imu: perfect },
        loft: 0, seed: 1,
      });
      const r = sim.result;
      t.ok(r !== null, `planeur ${km} km : impact obtenu`, true);
      if (!r) continue;
      const err = r.missDistance;
      worst = Math.max(worst, err);
      t.ok(err < 1200, `planeur a ${km} km : ecart de ${(err / 1000).toFixed(2)} km`);
      // La trajectoire doit rester surbaissee a toutes les portees.
      t.ok(r.apogee < 260000, `planeur a ${km} km : apogee ${(r.apogee / 1000).toFixed(0)} km`, true);
    }
    t.ok(worst < 1200, `precision homogene sur toute la plage (pire ecart ${(worst / 1000).toFixed(2)} km)`);
  }

  // --- L'erreur du planeur est un residu de GUIDAGE, pas de navigation ---
  // Contre-intuitif : un engin qui manoeuvre jusqu'au bout devrait voir son
  // ecart suivre sa derive inertielle. Ce n'est pas le cas — la gestion
  // d'energie du vol plane laisse un residu propre, qu'il faut donc mesurer
  // avec une centrale parfaite si l'on veut le distinguer.
  {
    const perfect = {
      label: 'ideale', gyroBias: 0, gyroARW: 0, gyroBiasWalk: 0, gyroScale: 0,
      accelBias: 0, accelVRW: 0, accelBiasWalk: 0, accelScale: 0, alignment: 0,
    };
    const cfg = { vehicleId: 'glide', target: { lat: 40, lon: 25, alt: 0 } };
    const ideal = runHeadless(baseConfig({ ...cfg, sensors: { ...defaultSensorConfig(), imu: perfect } }));
    t.ok(ideal.result.missDistance < 600,
      `planeur, centrale ideale : residu de guidage ${Math.round(ideal.result.missDistance)} m`);

    // Et ce residu ne doit pas dependre du tirage : c'est un biais, pas du bruit.
    const other = runHeadless(baseConfig({
      ...cfg, seed: 555, sensors: { ...defaultSensorConfig(), imu: perfect },
    }));
    t.close(other.result.missDistance, ideal.result.missDistance, 300,
      'le residu du planeur est deterministe');
  }

  // --- Un recalage terminal ne profite qu'a un engin qui manoeuvre encore ---
  //
  // C'est la difference de fond entre les deux familles. Le corps de rentree
  // balistique a scelle sa trajectoire a l'extinction : lui donner une position
  // exacte a trente kilometres du sol ne change plus rien, il ne pilote plus.
  // Le planeur, lui, manoeuvre jusqu'au bout et convertit cette information en
  // precision. Sans satellite, c'est donc le vecteur MANOEUVRANT qui peut etre
  // le plus precis — l'inverse de l'intuition.
  {
    const terrain = { enabled: true, period: 3, minAlt: 200, maxAlt: 40000 };
    const measure = (vehicleId, target, withTerrain) => {
      let miss = 0, nav = 0, fixes = 0;
      const seeds = [1, 2, 3, 4];
      for (const seed of seeds) {
        const s0 = defaultSensorConfig();
        const sim = runHeadless(baseConfig({
          vehicleId, target, seed,
          sensors: { ...s0, imu: { ...IMU_GRADES.navigation }, terrain: withTerrain ? terrain : s0.terrain },
        }));
        miss += sim.result.missDistance;
        nav += sim.result.navError;
        fixes += sim.result.terrainFixes;
      }
      return {
        miss: miss / seeds.length,
        nav: nav / seeds.length,
        fixes: fixes / seeds.length,
      };
    };

    const glideTgt = { lat: 40, lon: 25, alt: 0 };
    const gSans = measure('glide', glideTgt, false);
    const gAvec = measure('glide', glideTgt, true);
    const bSans = measure('bal2', { lat: 36, lon: 20, alt: 0 }, false);
    const bAvec = measure('bal2', { lat: 36, lon: 20, alt: 0 }, true);

    // Premiere raison, purement cinematique : un corps de rentree traverse la
    // tranche d'altitude exploitable en quelques secondes a plusieurs km/s. Il
    // n'a pas le temps d'accumuler les kilometres de profil qu'exige une
    // correlation. Le planeur, lui, y reste des minutes.
    t.ok(gAvec.fixes > 20 * bAvec.fixes,
      `le planeur obtient des recalages, le balistique presque aucun (${Math.round(gAvec.fixes)} contre ${Math.round(bAvec.fixes)})`);

    // Le planeur convertit ces recalages en connaissance de position...
    t.ok(gAvec.nav < gSans.nav * 0.75,
      `planeur : le terrain reduit la derive (${Math.round(gSans.nav)} -> ${Math.round(gAvec.nav)} m)`);
    // ...puis en precision, parce qu'il manoeuvre encore.
    t.ok(gAvec.miss < gSans.miss,
      `planeur : la meilleure position ameliore l ecart (${Math.round(gSans.miss)} -> ${Math.round(gAvec.miss)} m)`);

    // Et au total, le manoeuvrant fait mieux que le balistique sans satellite.
    t.ok(gAvec.miss < bSans.miss,
      `sans satellite, le manoeuvrant est le plus precis (${Math.round(gAvec.miss)} m contre ${Math.round(bSans.miss)} m)`);
  }

  // --- Une cible hors de portee doit tomber court, sans planter ---
  {
    const sim = runHeadless(baseConfig({ target: { lat: 60, lon: 100, alt: 0 } }));
    t.ok(sim.result !== null, 'cible hors de portee : le vol se termine quand meme');
    t.ok(sim.result.groundRange < sim.result.targetRange,
      'cible hors de portee : l engin tombe court, comme attendu');
    t.ok(sim.ctrl.burning === false, 'les ergols ont ete brules jusqu au bout');
  }

  // --- Reproductibilite ---
  {
    const a = runHeadless(baseConfig({ seed: 1234 }));
    const b = runHeadless(baseConfig({ seed: 1234 }));
    t.close(a.result.missDistance, b.result.missDistance, 1e-9, 'meme graine => meme resultat');
    const c = runHeadless(baseConfig({ seed: 999 }));
    t.ok(Math.abs(c.result.missDistance - a.result.missDistance) > 1,
      'graine differente => tirage different');
  }

  // --- Le budget de delta-v doit rester coherent ---
  {
    for (const id of Object.keys(VEHICLES)) {
      const dv = totalDeltaV(VEHICLES[id]);
      const sim = runHeadless(baseConfig({
        vehicleId: id,
        target: id === 'bal3' ? { lat: 55, lon: 60, alt: 0 } : { lat: 36, lon: 20, alt: 0 },
      }));
      // La vitesse a l'extinction doit rester sous le delta-v ideal : les
      // pertes gravitationnelles et aerodynamiques ne peuvent pas etre nulles.
      t.ok(sim.result.burnoutSpeed < dv,
        `${id} : vitesse d extinction sous le delta-v ideal (${Math.round(sim.result.burnoutSpeed)} < ${Math.round(dv)} m/s)`);
      t.ok(sim.result.burnoutSpeed > dv * 0.45,
        `${id} : pertes de montee raisonnables (${Math.round(100 * (1 - sim.result.burnoutSpeed / dv))} %)`);
    }
  }
}
