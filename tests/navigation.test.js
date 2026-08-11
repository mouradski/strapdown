// Tests de la centrale inertielle et du filtre de Kalman.
//
// Une erreur de signe dans un filtre de Kalman ne provoque aucune exception :
// elle degrade simplement l'estimation. Ces tests sont donc construits pour
// verifier le COMPORTEMENT attendu (lois de croissance des erreurs, effet
// reel des recalages) plutot que des valeurs numeriques isolees.

import { EARTH, DEG } from '../src/core/constants.js';
import * as V from '../src/core/vec.js';
import * as M from '../src/core/mat.js';
import { llaToEcef, ecefToEci, eciToEcef, ecefToLla, enuToEcef } from '../src/core/geodesy.js';
import { gravityJ2 } from '../src/core/gravity.js';
import { rk4 } from '../src/core/integrator.js';
import { makeRng } from '../src/core/random.js';
import {
  IMU, IMU_GRADES, StarTracker, Altimeter, U, defaultSensorConfig,
} from '../src/avionics/sensors.js';
import { InertialNavigator, tuningFromImuConfig, IR, IPSI, N } from '../src/avionics/navigation.js';

/**
 * Vol synthetique : phase propulsee a force specifique constante puis vol
 * libre. Renvoie l'historique verite + estimation.
 */
function flight(opts) {
  const {
    imuCfg, rng, dt = 0.05, duration = 400, boost = 100,
    accelMag = 30, aiding = {}, tuningOverride = {}, perfectImu = false,
    killScale = false,
  } = opts;

  const t0 = 0;
  const rEcef = llaToEcef(30, 10, 100);
  let r = ecefToEci(rEcef, t0);
  let v = V.cross([0, 0, EARTH.omega], r);
  // Nez vers le haut au depart, puis basculement lent.
  const up = V.normalize(r);
  const north = V.normalize(enuToEcef([0, 1, 0], 30, 10));
  let q = V.m3ToQ(V.frameFromXY(up, V.cross(up, north)));

  const imu = new IMU(imuCfg, rng);
  if (perfectImu) {
    imu.biasGyro = [0, 0, 0];
    imu.biasAccel = [0, 0, 0];
    imu.scaleGyro = [0, 0, 0];
    imu.scaleAccel = [0, 0, 0];
    imu.arw = 0; imu.vrw = 0; imu.gyroWalk = 0; imu.accelWalk = 0;
  }
  // Permet d'isoler ce que le filtre peut reellement estimer : le facteur
  // d'echelle n'est pas dans l'etat, donc son effet se retrouve inevitablement
  // reporte sur l'estimation du biais.
  if (killScale) { imu.scaleGyro = [0, 0, 0]; imu.scaleAccel = [0, 0, 0]; }

  // Le calculateur demarre avec une erreur d'alignement, sauf centrale parfaite.
  const align = perfectImu ? [0, 0, 0] : imu.initialAlignmentError();
  const nav = new InertialNavigator(
    { r, v, q: V.qMul(V.qFromRotVec(align), q) },
    { ...tuningFromImuConfig(imuCfg), ...tuningOverride },
  );

  const star = new StarTracker(aiding.starTracker ?? { enabled: false }, rng);
  const alt = new Altimeter(aiding.altimeter ?? { enabled: false }, rng);
  // Recalage de position simplifie : ce harnais teste le FILTRE de Kalman,
  // pas la correlation de relief (qui a sa propre suite). On lui fournit donc
  // une mesure de position de qualite maitrisee.
  const terrainCfg = aiding.terrain ?? { enabled: false };
  let lastTerrain = -1e9;
  const terrain = {
    fixes: 0,
    sample(tt, altTrue, rEciTrue, simTime) {
      if (!terrainCfg.enabled) return null;
      if (altTrue > terrainCfg.maxAlt || altTrue < terrainCfg.minAlt) return null;
      if (tt - lastTerrain < terrainCfg.period) return null;
      lastTerrain = tt;
      this.fixes++;
      const ecef = eciToEcef(rEciTrue, simTime);
      const lla = ecefToLla(ecef);
      const sigma = terrainCfg.sigma;
      const off = enuToEcef([rng.normal(0, sigma), rng.normal(0, sigma), 0], lla.lat, lla.lon);
      return { rEcef: V.add(ecef, off), sigma };
    },
  };

  const hist = [];
  const steps = Math.round(duration / dt);
  for (let i = 0; i < steps; i++) {
    const t = t0 + i * dt;
    const burning = t < boost;
    // Basculement lent pendant la phase propulsee : le gyrometre voit une
    // rotation reelle, ce qui active les erreurs de facteur d'echelle.
    const wBody = burning ? [0.0, 0.012, 0.0] : [0, 0, 0];
    const fBody = burning ? [accelMag, 0, 0] : [0, 0, 0];

    // --- Verite ---
    // L'attitude fait partie de l'etat integre, comme dans le simulateur reel.
    // Si on la gelait au debut du pas, la verite serait d'ordre 1 en attitude
    // alors que la centrale est d'ordre 2, et la comparaison mesurerait cet
    // ecart de schema plutot que l'erreur de navigation.
    const deriv = (_tt, y) => {
      const g = gravityJ2([y[0], y[1], y[2]]);
      const qq = V.qNormalize([y[6], y[7], y[8], y[9]]);
      const fI = V.qRot(qq, fBody);
      const dq = V.qDot(qq, wBody);
      return [y[3], y[4], y[5], fI[0] + g[0], fI[1] + g[1], fI[2] + g[2],
        dq[0], dq[1], dq[2], dq[3]];
    };
    const y = rk4(deriv, t, [...r, ...v, ...q], dt);
    r = [y[0], y[1], y[2]];
    v = [y[3], y[4], y[5]];
    q = V.qNormalize([y[6], y[7], y[8], y[9]]);

    // --- Capteurs et navigation ---
    const m = imu.measure(fBody, wBody, dt);
    nav.propagate(m.f, m.w, dt);
    nav.propagateCovariance(0.25);

    const altTrue = ecefToLla(eciToEcef(r, t + dt)).alt;
    const s = star.sample(t, altTrue, q);
    if (s) nav.updateAttitude(s.q, (aiding.starTracker.sigma ?? 8) * U.arcsec);
    const a = alt.sample(t, altTrue);
    if (a) nav.updateAltitude(a.alt, a.sigma, t + dt);
    const g = terrain.sample(t, altTrue, r, t + dt);
    if (g) nav.updateHorizontalPosition(g.rEcef, g.sigma, t + dt);

    if (i % 20 === 0) {
      hist.push({ t: t + dt, err: V.dist(nav.r, r), altTrue });
    }
  }

  return {
    r, v, q, nav, imu, star, terrain,
    posError: V.dist(nav.r, r),
    velError: V.dist(nav.v, v),
    attError: V.norm(V.rotVecBetween(nav.q, q)),
    hist,
  };
}

export default function run(t) {
  // --- Conversions d'unites ---
  {
    t.close(1 * U.degPerHour, 4.8481368e-6, 1e-12, 'deg/h -> rad/s');
    t.close(1 * U.arcsec, 4.8481368e-6, 1e-12, 'arcsec -> rad');
    t.close(1 * U.arcmin, 2.9088821e-4, 1e-10, 'arcmin -> rad');
    t.close(1 * U.microG, 9.80665e-6, 1e-15, 'micro-g -> m/s^2');
    // 1 deg/sqrt(h) sur une heure doit donner 1 deg d'ecart-type.
    t.close(1 * U.degPerSqrtHour * Math.sqrt(3600), 1 * DEG, 1e-12, 'coherence deg/sqrt(h)');
  }

  // --- Mecanisation : une centrale parfaite doit suivre la verite ---
  {
    const a = flight({ imuCfg: IMU_GRADES.strategic, rng: makeRng(1), perfectImu: true, dt: 0.05, duration: 300 });
    t.ok(a.posError < 5, `centrale parfaite : erreur residuelle faible (${a.posError.toFixed(2)} m)`);

    // Le schema est d'ordre 2 : diviser le pas par 2 doit diviser l'erreur par ~4.
    const b = flight({ imuCfg: IMU_GRADES.strategic, rng: makeRng(1), perfectImu: true, dt: 0.025, duration: 300 });
    const ratio = a.posError / Math.max(b.posError, 1e-12);
    t.ok(ratio > 2.5 && ratio < 6, `convergence d ordre 2 de la mecanisation (rapport ${ratio.toFixed(2)})`);
    t.ok(b.posError < 1.5, `erreur residuelle a pas fin (${b.posError.toFixed(3)} m)`);
    t.close(Math.hypot(...a.nav.q), 1, 1e-9, 'quaternion de navigation reste unitaire');
  }

  // --- Lois de croissance des erreurs ---
  // On compare deux centrales alimentees par la MEME verite : l'une parfaite,
  // l'autre avec un unique defaut. L'ecart isole la contribution de ce defaut.
  {
    const setup = () => {
      const r0 = ecefToEci(llaToEcef(0, 0, 200000), 0);
      const q0 = V.qIdentity();
      const tuning = tuningFromImuConfig(IMU_GRADES.navigation);
      return { r0, q0, tuning };
    };

    // Biais accelerometrique seul : l'erreur de position doit croitre en t^2.
    {
      const { r0, q0, tuning } = setup();
      const ref = new InertialNavigator({ r: r0, v: [0, 0, 0], q: q0 }, tuning);
      const bad = new InertialNavigator({ r: r0, v: [0, 0, 0], q: q0 }, tuning);
      const bias = [1e-4, 0, 0]; // 100 micro-g environ
      const dt = 0.01;
      const samples = {};
      for (let i = 0; i < 12000; i++) {
        const f = [0, 0, 0];
        ref.propagate(f, [0, 0, 0], dt);
        bad.propagate(V.add(f, bias), [0, 0, 0], dt);
        const tt = (i + 1) * dt;
        for (const mark of [30, 60, 120]) {
          if (Math.abs(tt - mark) < dt / 2) samples[mark] = V.dist(ref.r, bad.r);
        }
      }
      t.close(samples[60] / samples[30], 4, 0.05, 'biais accelerometrique : erreur en t^2');
      t.close(samples[120] / samples[60], 4, 0.05, 'biais accelerometrique : erreur en t^2 (bis)');
      // Valeur absolue : 0.5 * b * t^2.
      t.close(samples[60], 0.5 * 1e-4 * 3600, 0.02, 'amplitude de l erreur en 0.5.b.t^2');
    }

    // Biais gyrometrique sous acceleration : l'erreur doit croitre en t^3.
    // C'est le terme dominant sur un vol long, et la raison pour laquelle la
    // qualite du gyrometre prime sur celle de l'accelerometre.
    {
      const { r0, q0, tuning } = setup();
      const ref = new InertialNavigator({ r: r0, v: [0, 0, 0], q: q0 }, tuning);
      const bad = new InertialNavigator({ r: r0, v: [0, 0, 0], q: q0 }, tuning);
      const gbias = [0, 0, 1 * U.degPerHour];
      const f = [20, 0, 0];
      const dt = 0.01;
      const samples = {};
      for (let i = 0; i < 12000; i++) {
        ref.propagate(f, [0, 0, 0], dt);
        bad.propagate(f, gbias, dt);
        const tt = (i + 1) * dt;
        for (const mark of [30, 60, 120]) {
          if (Math.abs(tt - mark) < dt / 2) samples[mark] = V.dist(ref.r, bad.r);
        }
      }
      t.close(samples[60] / samples[30], 8, 0.15, 'biais gyrometrique : erreur en t^3');
      t.close(samples[120] / samples[60], 8, 0.15, 'biais gyrometrique : erreur en t^3 (bis)');
      // Amplitude : |f| * b * t^3 / 6.
      const expected = (20 * 1 * U.degPerHour * 60 ** 3) / 6;
      t.close(samples[60] / expected, 1, 0.02, 'amplitude de l erreur en |f|.b.t^3/6');
    }

    // Sans acceleration, un biais gyrometrique ne cree AUCUNE erreur de
    // position : une attitude fausse ne se voit que si l'on projette quelque
    // chose a travers elle.
    {
      const { r0, q0, tuning } = setup();
      const ref = new InertialNavigator({ r: r0, v: [0, 0, 0], q: q0 }, tuning);
      const bad = new InertialNavigator({ r: r0, v: [0, 0, 0], q: q0 }, tuning);
      for (let i = 0; i < 6000; i++) {
        ref.propagate([0, 0, 0], [0, 0, 0], 0.01);
        bad.propagate([0, 0, 0], [0, 0, 1 * U.degPerHour], 0.01);
      }
      t.close(V.dist(ref.r, bad.r), 0, 1e-9, 'derive gyrometrique invisible en chute libre');
      t.ok(V.norm(V.rotVecBetween(ref.q, bad.q)) > 1e-7, 'mais l attitude, elle, a bien derive');
    }
  }

  // --- Le viseur stellaire doit reduire l'erreur d'attitude ---
  {
    const cfg = IMU_GRADES.tactical;
    const withStar = flight({
      imuCfg: cfg, rng: makeRng(11), duration: 600,
      aiding: { starTracker: { enabled: true, period: 15, sigma: 5, minAlt: 0 } },
    });
    const without = flight({ imuCfg: cfg, rng: makeRng(11), duration: 600 });
    t.ok(withStar.star.fixes > 20, `le viseur stellaire a bien pris des visees (${withStar.star.fixes})`);
    t.ok(withStar.attError < without.attError * 0.5,
      `le viseur stellaire divise l erreur d attitude (${(without.attError / U.arcmin).toFixed(1)}' -> ${(withStar.attError / U.arcmin).toFixed(2)}')`);
    t.ok(withStar.posError < without.posError,
      `...et donc reduit l erreur de position (${Math.round(without.posError)} m -> ${Math.round(withStar.posError)} m)`);
  }

  // --- L'altimetre doit reduire l'erreur verticale ---
  {
    const cfg = IMU_GRADES.tactical;
    const aid = { altimeter: { enabled: true, period: 0.5, baroSigma: 100, baroBias: 0, baroMaxAlt: 1e9, radarEnabled: false } };
    const withAlt = flight({ imuCfg: cfg, rng: makeRng(23), duration: 300, boost: 60, aiding: aid });
    const without = flight({ imuCfg: cfg, rng: makeRng(23), duration: 300, boost: 60 });
    const vertErr = (f) => {
      const up = V.normalize(f.r);
      return Math.abs(V.dot(V.sub(f.nav.r, f.r), up));
    };
    t.ok(withAlt.nav.updates.alt > 100, `recalages altimetriques appliques (${withAlt.nav.updates.alt})`);
    t.ok(vertErr(withAlt) < vertErr(without),
      `l altimetre reduit l erreur verticale (${vertErr(without).toFixed(0)} m -> ${vertErr(withAlt).toFixed(0)} m)`);
  }

  // --- La correlation de terrain doit reduire l'erreur horizontale ---
  {
    const cfg = IMU_GRADES.tactical;
    const aid = { terrain: { enabled: true, period: 2, sigma: 60, minAlt: 0, maxAlt: 1e9 } };
    const withTer = flight({ imuCfg: cfg, rng: makeRng(31), duration: 300, boost: 60, aiding: aid });
    const without = flight({ imuCfg: cfg, rng: makeRng(31), duration: 300, boost: 60 });
    const horizErr = (f) => {
      const up = V.normalize(f.r);
      return V.norm(V.rejectFrom(V.sub(f.nav.r, f.r), up));
    };
    t.ok(withTer.nav.updates.terrain > 50, `recalages de terrain appliques (${withTer.nav.updates.terrain})`);
    t.ok(horizErr(withTer) < horizErr(without) * 0.5,
      `la correlation de terrain divise l erreur horizontale (${horizErr(without).toFixed(0)} m -> ${horizErr(withTer).toFixed(0)} m)`);
    t.ok(horizErr(withTer) < 300, `erreur horizontale ramenee au niveau du capteur (${horizErr(withTer).toFixed(0)} m)`);
  }

  // --- Le filtre doit estimer les biais, pas seulement corriger l'etat ---
  {
    const aiding = {
      starTracker: { enabled: true, period: 10, sigma: 3, minAlt: 0 },
      terrain: { enabled: true, period: 2, sigma: 50, minAlt: 0, maxAlt: 1e9 },
    };
    const cfg = IMU_GRADES.tactical;

    // Sans facteur d'echelle, les biais sont les seuls defauts constants :
    // le filtre doit alors les retrouver.
    const clean = flight({ imuCfg: cfg, rng: makeRng(77), duration: 900, boost: 200, aiding, killScale: true });
    const gBefore = V.norm(clean.imu.biasGyro);
    const gAfter = V.dist(clean.imu.biasGyro, clean.nav.biasGyro);
    t.ok(gAfter < gBefore * 0.6,
      `biais gyrometrique estime (${(gBefore / U.degPerHour).toFixed(3)} -> ${(gAfter / U.degPerHour).toFixed(3)} deg/h)`);
    const aBefore = V.norm(clean.imu.biasAccel);
    const aAfter = V.dist(clean.imu.biasAccel, clean.nav.biasAccel);
    t.ok(aAfter < aBefore,
      `biais accelerometrique estime (${(aBefore / U.microG).toFixed(0)} -> ${(aAfter / U.microG).toFixed(0)} ug)`);

    // Avec facteur d'echelle, le filtre n'a AUCUN etat pour le representer.
    // Il le reporte donc sur l'etat de biais, qui s'ecarte volontairement du
    // biais physique pour compenser l'erreur totale. Ce n'est pas un defaut
    // du filtre : c'est le meilleur usage possible des etats dont il dispose.
    const real = flight({ imuCfg: cfg, rng: makeRng(77), duration: 900, boost: 200, aiding });
    const sfEquivalent = V.norm(real.imu.scaleAccel) * 30; // en m/s^2 sous 30 m/s^2 de poussee
    const estimated = V.norm(real.nav.biasAccel);
    t.ok(sfEquivalent > V.norm(real.imu.biasAccel) * 2,
      `le facteur d echelle domine le biais pendant la poussee (${(sfEquivalent / U.microG).toFixed(0)} contre ${(V.norm(real.imu.biasAccel) / U.microG).toFixed(0)} ug)`);
    t.ok(estimated > V.norm(real.imu.biasAccel) * 2,
      `l etat de biais absorbe l erreur non modelisee (estime ${(estimated / U.microG).toFixed(0)} ug)`);
    // Et malgre cela la position reste tenue par les recalages.
    t.ok(real.posError < 20000, `position tenue malgre l erreur non modelisee (${Math.round(real.posError)} m)`);
  }

  // --- Les recalages doivent ameliorer la position, jamais la degrader ---
  // Test decisif sur les signes : un signe inverse ferait diverger le filtre.
  {
    let better = 0, total = 0, sumAided = 0, sumFree = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const cfg = IMU_GRADES.tactical;
      const aided = flight({
        imuCfg: cfg, rng: makeRng(seed * 97), duration: 700, boost: 150,
        aiding: {
          starTracker: { enabled: true, period: 15, sigma: 5, minAlt: 0 },
          altimeter: { enabled: true, period: 1, baroSigma: 100, baroBias: 40, baroMaxAlt: 1e9, radarEnabled: false },
        },
      });
      const free = flight({ imuCfg: cfg, rng: makeRng(seed * 97), duration: 700, boost: 150 });
      total++;
      if (aided.posError < free.posError) better++;
      sumAided += aided.posError;
      sumFree += free.posError;
    }
    t.ok(better >= 11, `les recalages ameliorent la position sur ${better}/${total} tirages`);
    t.ok(sumAided < sumFree * 0.5,
      `gain moyen des recalages (${Math.round(sumFree / total)} m -> ${Math.round(sumAided / total)} m)`);
  }

  // --- Coherence du filtre : l'incertitude annoncee doit etre credible ---
  {
    let sumRatio = 0, n = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const f = flight({
        imuCfg: IMU_GRADES.navigation, rng: makeRng(seed * 313), duration: 600, boost: 120,
        aiding: { starTracker: { enabled: true, period: 20, sigma: 8, minAlt: 0 } },
      });
      const sigma = f.nav.positionSigma();
      if (sigma > 1e-6) { sumRatio += f.posError / sigma; n++; }
    }
    const mean = sumRatio / n;
    // On attend un rapport de l'ordre de l'unite. Trop grand : le filtre est
    // trop confiant. Trop petit : il est inutilement pessimiste.
    t.ok(mean > 0.15 && mean < 6,
      `incertitude annoncee coherente avec l erreur reelle (rapport moyen ${mean.toFixed(2)})`);
  }

  // --- La classe de centrale doit hierarchiser les performances ---
  {
    const errors = {};
    for (const grade of ['consumer', 'tactical', 'navigation', 'strategic']) {
      let sum = 0;
      for (let seed = 1; seed <= 5; seed++) {
        sum += flight({ imuCfg: IMU_GRADES[grade], rng: makeRng(seed * 41), duration: 600, boost: 120 }).posError;
      }
      errors[grade] = sum / 5;
    }
    t.ok(errors.consumer > errors.tactical, `grand public pire que tactique (${Math.round(errors.consumer)} > ${Math.round(errors.tactical)} m)`);
    t.ok(errors.tactical > errors.navigation, `tactique pire que navigation (${Math.round(errors.tactical)} > ${Math.round(errors.navigation)} m)`);
    t.ok(errors.navigation > errors.strategic, `navigation pire que strategique (${Math.round(errors.navigation)} > ${Math.round(errors.strategic)} m)`);
    t.ok(errors.strategic < 500, `centrale strategique sous 500 m en vol libre (${Math.round(errors.strategic)} m)`);
  }

  // --- Rejet des mesures aberrantes ---
  {
    const nav = new InertialNavigator(
      { r: ecefToEci(llaToEcef(0, 0, 100000), 0), v: [0, 0, 0], q: V.qIdentity() },
      tuningFromImuConfig(IMU_GRADES.navigation),
    );
    const before = V.clone(nav.r);
    // Mesure d'altitude delirante : elle doit etre rejetee par le test du khi2.
    const ok = nav.updateAltitude(100000 + 5e6, 100, 0);
    t.ok(!ok, 'mesure aberrante rejetee');
    t.ok(nav.updates.rejected === 1, 'rejet comptabilise');
    t.close(V.dist(nav.r, before), 0, 1e-12, 'l etat n est pas corrompu par une mesure rejetee');
    // Une mesure plausible, elle, doit passer.
    t.ok(nav.updateAltitude(100050, 100, 0), 'mesure plausible acceptee');
  }

  // --- La covariance doit rester saine ---
  {
    const f = flight({
      imuCfg: IMU_GRADES.tactical, rng: makeRng(5), duration: 600, boost: 120,
      aiding: {
        starTracker: { enabled: true, period: 15, sigma: 5, minAlt: 0 },
        altimeter: { enabled: true, period: 1, baroSigma: 100, baroMaxAlt: 1e9, radarEnabled: false },
      },
    });
    const P = f.nav.P;
    let symOk = true, diagOk = true, finite = true;
    for (let i = 0; i < N; i++) {
      if (!(P.d[i * N + i] > 0)) diagOk = false;
      for (let j = 0; j < N; j++) {
        const a = P.d[i * N + j], b = P.d[j * N + i];
        if (!Number.isFinite(a)) finite = false;
        if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) symOk = false;
      }
    }
    t.ok(finite, 'covariance finie apres un vol complet');
    t.ok(symOk, 'covariance symetrique');
    t.ok(diagOk, 'covariance a diagonale strictement positive');
    // Inegalite de Cauchy-Schwarz sur les correlations.
    let cauchy = true;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const c = P.d[i * N + j] ** 2;
        if (c > P.d[i * N + i] * P.d[j * N + j] * (1 + 1e-6)) cauchy = false;
      }
    }
    t.ok(cauchy, 'correlations bornees (Cauchy-Schwarz)');
  }

  // --- Configuration par defaut coherente ---
  {
    const c = defaultSensorConfig();
    t.ok(IMU_GRADES[c.imuGrade], 'la classe de centrale par defaut existe');
    t.ok(c.starTracker.enabled, 'viseur stellaire actif par defaut');
    const tun = tuningFromImuConfig(c.imu);
    t.ok(tun.arw > 0 && tun.vrw > 0 && tun.sigmaAtt > 0, 'reglage du filtre bien renseigne');
  }
}
