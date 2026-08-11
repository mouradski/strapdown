// Orchestration : fait tourner ensemble la verite terrain, les capteurs, la
// centrale inertielle et le calculateur.
//
// Une seule regle structurante ici : la verite et l'estimation ne communiquent
// QUE par les capteurs. Le calculateur lit `this.nav`, jamais `this.y`.

import { EARTH, DEG, RAD } from '../core/constants.js';
import * as V from '../core/vec.js';
import { rk4 } from '../core/integrator.js';
import {
  llaToEcef, ecefToLla, ecefToEci, eciToEcef, velEcefToEci,
  enuToEcef, groundRange, localMiss, flightPathAngle,
} from '../core/geodesy.js';
import { atmosphere } from '../core/atmosphere.js';
import { makeRng } from '../core/random.js';
import { makeTerrain } from '../core/terrain.js';
import { VEHICLES, totalMass, propulsion } from './vehicle.js';
import {
  computeForces, makeDeriv, attitudeRateCommand,
  thrustAttitude, windAttitude, airRelativeVelocity, IDX,
} from './dynamics.js';
import { AerothermalMonitor } from './aerothermal.js';
import { IMU, Altimeter, StarTracker, TerrainCorrelator, IMU_GRADES, U } from '../avionics/sensors.js';
import { InertialNavigator, tuningFromImuConfig } from '../avionics/navigation.js';
import { FlightComputer, PHASE } from '../guidance/computer.js';
import { predictImpact } from '../guidance/ballistic.js';

export class Simulation {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset(overrides = {}) {
    const cfg = { ...this.cfg, ...overrides };
    this.cfg = cfg;

    const veh = VEHICLES[cfg.vehicleId] ?? VEHICLES.bal2;
    this.veh = veh;
    this.rng = makeRng(cfg.seed ?? 12345);
    this.t = 0;
    this.launchTime = 0;
    this.running = false;
    this.finished = false;
    this.result = null;
    this.events = [];

    // --- Etat vrai ---
    const L = cfg.launch;
    const rEcef = llaToEcef(L.lat, L.lon, L.alt ?? 0);
    const r0 = ecefToEci(rEcef, 0);
    const v0 = velEcefToEci([0, 0, 0], r0, 0); // immobile au sol
    const up = V.normalize(r0);
    const north = V.normalize(enuToEcef([0, 1, 0], L.lat, L.lon));

    // --- Calculateur ---
    this.computer = new FlightComputer({
      veh,
      launchLla: L,
      targetLla: cfg.target,
      loft: cfg.loft ?? 0,
      gravityModel: cfg.sensors.gravityModel ?? 'j2',
      midcourse: cfg.midcourse ?? { enabled: false, deltaV: 0 },
    });
    this.plan = this.computer.plan(0, r0);

    // Attitude initiale : nez a la verticale, roulis reference sur le plan de tir.
    const planeNormal = this.computer.planeNormal ?? V.cross(up, north);
    this.planeNormal = planeNormal;
    const q0 = thrustAttitude(up, planeNormal);
    this.y = [...r0, ...v0, veh.stages[0].propMass, ...q0];

    this.ctrl = {
      veh,
      stageIndex: 0,
      burning: false,
      throttle: 1,
      separated: false,
      aeroMode: 'launcher',
      gravityModel: 'j2',
      omegaBody: [0, 0, 0],
      rcsAccel: null,
    };

    // --- Capteurs ---
    const s = cfg.sensors;
    const imuCfg = s.imu ?? IMU_GRADES[s.imuGrade ?? 'navigation'];
    this.imu = new IMU(imuCfg, this.rng);
    this.altimeter = new Altimeter(s.altimeter, this.rng);
    this.starTracker = new StarTracker(s.starTracker, this.rng);
    // Le relief est deterministe : meme graine de monde => meme geographie,
    // quel que soit le tirage des capteurs. Deux tirs sur la meme cible
    // survolent donc exactement le meme terrain.
    this.terrainField = makeTerrain({ seed: cfg.worldSeed ?? 7, isLand: cfg.isLand });
    this.terrain = new TerrainCorrelator(s.terrain, this.rng, this.terrainField);

    // --- Centrale inertielle ---
    // Le calculateur connait le site de tir (position levee), mais pas
    // parfaitement l'orientation de sa centrale : c'est l'erreur d'alignement.
    const align = this.imu.initialAlignmentError();
    const posErr = this.rng.gauss3(3);
    this.nav = new InertialNavigator(
      { r: V.add(r0, posErr), v: v0, q: V.qMul(V.qFromRotVec(align), q0) },
      tuningFromImuConfig(imuCfg, s.gravityModel ?? 'j2'),
    );
    this.initialAlignment = V.norm(align);

    // --- Historique pour l'affichage ---
    this.trailTruth = [];
    this.trailEst = [];
    this.lastTrailTime = -1e9;
    this.telemetry = [];
    // Temoin aerothermique. Il ne participe a aucune boucle : la trajectoire
    // est rigoureusement la meme qu'on l'instrumente ou non.
    this.aero = new AerothermalMonitor(veh);
    this.maxQ = 0;
    this.maxAccel = 0;
    this.apogee = 0;
    this.apogeeTime = 0;
    this.burnoutTime = null;
    this.burnoutSpeed = null;
    this.separationTime = null;
    this.predicted = null;
    this.lastPredictTime = -1e9;

    this.targetEcef = llaToEcef(cfg.target.lat, cfg.target.lon, cfg.target.alt ?? 0);
    this.log('events.solution');
    return this;
  }

  /**
   * Journal de bord. On enregistre une cle de traduction et ses variables,
   * jamais une phrase : la couche de simulation n'a pas a connaitre la langue
   * de l'interface, et un vol rejoue apres un changement de langue doit se
   * relire dans la nouvelle.
   */
  log(key, vars = null) {
    this.events.push({ t: this.t, key, vars, phase: this.computer.phase });
    if (this.events.length > 200) this.events.shift();
  }

  launch() {
    if (this.running || this.finished) return;
    this.running = true;
    this.launchTime = this.t;
    this.ctrl.burning = true;
    this.log('events.ignition');
  }

  // --- Acces a la verite (reserve a l'affichage et au bilan final) ---
  get rTrue() { return [this.y[0], this.y[1], this.y[2]]; }
  get vTrue() { return [this.y[3], this.y[4], this.y[5]]; }
  get qTrue() { return V.qNormalize([this.y[7], this.y[8], this.y[9], this.y[10]]); }
  get altTrue() { return ecefToLla(eciToEcef(this.rTrue, this.t)).alt; }
  get llaTrue() { return ecefToLla(eciToEcef(this.rTrue, this.t)); }

  /** Erreur de navigation reelle : ce que le calculateur ignore. */
  get navError() { return V.dist(this.nav.r, this.rTrue); }

  /** Pas d'integration adapte au regime de vol. */
  chooseDt() {
    if (!this.running) return 0.05;
    const alt = this.altTrue;
    if (this.ctrl.burning) return 0.02;
    if (alt < 90000) return 0.05;
    return 0.25;
  }

  /**
   * Avance la simulation d'un pas. Renvoie false si le vol est termine.
   */
  step() {
    if (this.finished) return false;
    if (!this.running) { this.t += 0.05; return true; }

    const t = this.t;

    // 1) Le calculateur decide, a partir de la SEULE estimation inertielle.
    //    On lui transmet l'acceleration MESUREE par la centrale, pas la vraie.
    const cmd = this.computer.update(t, this.nav, {
      launchTime: this.launchTime,
      separated: this.ctrl.separated,
      stageIndex: this.ctrl.stageIndex,
      specificForce: V.norm(this.nav.fI),
    });
    this.lastCmd = cmd;

    // Pas d'integration. Pres de l'extinction on raccourcit le pas pour couper
    // exactement quand la vitesse a gagner s'annule : couper a la fin d'un pas
    // ordinaire laisserait jusqu'a 0.7 m/s d'erreur, soit pres d'un kilometre
    // de portee.
    let dt = this.chooseDt();
    this.cutoffAfterStep = false;
    const ttc = this.computer.timeToCutoff;
    if (this.ctrl.burning && !this.ctrl.separated && Number.isFinite(ttc) && ttc < dt) {
      dt = Math.max(1e-4, ttc);
      this.cutoffAfterStep = true;
    }

    // Meme precaution pour l'epuisement des ergols. L'accelerometre ne recoit
    // qu'une moyenne sur le pas : si la poussee s'arrete au milieu, il rapporte
    // une demi-poussee fictive, la centrale integre une vitesse qui n'existe
    // pas, et l'erreur — un demi-metre par seconde environ — se propage sur
    // tout le reste du vol. On termine donc le pas exactement a l'extinction.
    if (this.ctrl.burning && !this.ctrl.separated && this.y[IDX.PROP] > 0) {
      const { mdot } = propulsion(this.veh, this.ctrl.stageIndex, this.altTrue);
      if (mdot > 0) {
        const tBurn = this.y[IDX.PROP] / mdot;
        if (tBurn > 1e-7 && tBurn < dt) dt = tBurn;
      }
    }

    // 2) Attitude commandee, puis vitesse de rotation pour l'atteindre.
    const qNow = this.qTrue;
    let qTarget = qNow;
    if (cmd.mode === 'boost' && cmd.thrustDir) {
      qTarget = thrustAttitude(cmd.thrustDir, this.planeNormal);
    } else if (cmd.mode === 'midcourse' && cmd.thrustDir) {
      qTarget = thrustAttitude(cmd.thrustDir, this.planeNormal);
    } else {
      const vRel = airRelativeVelocity(this.rTrue, this.vTrue);
      if (V.norm(vRel) > 10) {
        qTarget = windAttitude(vRel, this.rTrue, cmd.aoa ?? 0, cmd.bank ?? 0);
      }
    }
    const maxRate = this.ctrl.separated ? 0.25 : 0.12;
    this.ctrl.omegaBody = attitudeRateCommand(qNow, qTarget, 1.4, maxRate);

    // 3) Poussee de correction mi-course : appliquee comme une vraie
    //    acceleration, pour que la centrale la voie passer.
    this.ctrl.rcsAccel = null;
    if (cmd.mode === 'midcourse' && cmd.midcourseDeltaV > 0) {
      this.midcourseRemaining = cmd.midcourseDeltaV;
      this.midcourseDir = cmd.thrustDir;
      this.log('events.midcourse', { dv: cmd.midcourseDeltaV.toFixed(1) });
    }
    if (this.midcourseRemaining > 0) {
      const accel = 4;
      const applied = Math.min(this.midcourseRemaining, accel * dt);
      this.ctrl.rcsAccel = V.scale(this.midcourseDir, applied / dt);
      this.midcourseRemaining -= applied;
      if (this.midcourseRemaining <= 0) this.log('events.midcourseDone');
    }

    // 4) Force specifique VRAIE, pour alimenter l'IMU.
    //
    // L'accelerometre ne donne pas une valeur instantanee : il rend l'INTEGRALE
    // de la force specifique sur l'intervalle. On l'estime par la regle de
    // Simpson, d'ordre 4. Ni la moyenne des extremites ni le point milieu ne
    // suffisent : pendant la rentree la deceleration croit de facon tres
    // convexe, et l'erreur de quadrature se transforme en une erreur de
    // vitesse qui se propage ensuite jusqu'a l'impact.
    const deriv = makeDeriv(this.ctrl);
    const yMid = rk4(deriv, t, this.y, dt * 0.5);
    const yNext = rk4(deriv, t, this.y, dt);

    // Piege a eviter : sur un pas qui se termine exactement a l'extinction,
    // les ergols valent zero a l'extremite et la poussee y serait comptee
    // nulle, alors qu'elle s'est exercee pendant tout le pas.
    const yEnd = yNext.slice();
    if (this.ctrl.burning && !this.ctrl.separated
      && this.y[IDX.PROP] > 0 && yEnd[IDX.PROP] <= 0) {
      yEnd[IDX.PROP] = 1e-9;
    }

    const fStart = computeForces(t, this.y, this.ctrl);
    const fMid = computeForces(t + dt * 0.5, yMid, this.ctrl);
    const fEnd = computeForces(t + dt, yEnd, this.ctrl);

    const toBody = (y, f) => V.m3tv(V.qToM3(V.qNormalize([y[7], y[8], y[9], y[10]])), f.aSpecific);
    const bStart = toBody(this.y, fStart);
    const bMid = toBody(yMid, fMid);
    const bEnd = toBody(yEnd, fEnd);
    const fBody = [
      (bStart[0] + 4 * bMid[0] + bEnd[0]) / 6,
      (bStart[1] + 4 * bMid[1] + bEnd[1]) / 6,
      (bStart[2] + 4 * bMid[2] + bEnd[2]) / 6,
    ];

    // 5) Les capteurs mesurent, la centrale integre. Aucune information vraie
    //    ne franchit cette frontiere autrement que par ces mesures.
    const meas = this.imu.measure(fBody, this.ctrl.omegaBody, dt);
    this.nav.propagate(meas.f, meas.w, dt);
    this.nav.propagateCovariance(0.25);
    this.applyAiding(t + dt, yNext);

    // 6) Detection d'impact avant de valider le pas.
    const altNext = ecefToLla(eciToEcef([yNext[0], yNext[1], yNext[2]], t + dt)).alt;
    if (altNext <= 0 && t - this.launchTime > 5) {
      this.resolveImpact(t, dt, deriv);
      return false;
    }

    this.y = yNext;
    this.t = t + dt;

    // 7) Suivi des maxima et des evenements mecaniques.
    // Les trois bilans de forces du pas servent une seconde fois ici, pour
    // integrer la charge thermique sans rien recalculer.
    this.aero.integrate(t - this.launchTime, dt, fStart, fMid, fEnd, this.ctrl.separated);
    this.maxQ = Math.max(this.maxQ, fStart.qDyn);
    this.maxAccel = Math.max(this.maxAccel, V.norm(fStart.aSpecific));
    const alt = this.altTrue;
    if (alt > this.apogee) { this.apogee = alt; this.apogeeTime = this.t; }

    this.handleStaging(cmd);
    this.recordTrail(fStart);
    return true;
  }

  /** Recalages : chaque capteur a ses conditions de validite. */
  applyAiding(t, yNext) {
    const rTrue = [yNext[0], yNext[1], yNext[2]];
    const qT = V.qNormalize([yNext[7], yNext[8], yNext[9], yNext[10]]);
    const altTrue = ecefToLla(eciToEcef(rTrue, t)).alt;

    const st = this.starTracker.sample(t, altTrue, qT);
    if (st) this.nav.updateAttitude(st.q, st.sigma);

    const al = this.altimeter.sample(t, altTrue);
    if (al) this.nav.updateAltitude(al.alt, al.sigma, t);

    // Correlation de terrain : elle a besoin des DEUX positions — la vraie,
    // que sonde le radioaltimetre, et l'estimee, en face de laquelle le
    // calculateur range sa mesure.
    if (this.terrain.cfg.enabled) {
      const trueLla = ecefToLla(eciToEcef(rTrue, t));
      const navLla = ecefToLla(eciToEcef(this.nav.r, t));
      this.terrain.observe(altTrue, trueLla, navLla);
      // On transmet l'incertitude annoncee par le filtre : elle borne
      // l'etendue de la recherche, donc le cout du recalage.
      const tc = this.terrain.correlate(t, navLla, this.nav.positionSigma());
      if (tc) this.nav.updateHorizontalPosition(tc.rEcef, tc.sigma, t);
    }
  }

  /** Etagement, extinction et separation de la charge. */
  handleStaging(cmd) {
    const c = this.ctrl;
    if (c.separated) return;

    const exhausted = this.y[IDX.PROP] <= 0;
    const wantCutoff = cmd.cutoff || this.cutoffAfterStep;

    if (c.burning && exhausted) {
      if (c.stageIndex < this.veh.stages.length - 1) {
        c.stageIndex++;
        this.y[IDX.PROP] = this.veh.stages[c.stageIndex].propMass;
        this.log('events.staging', { n: c.stageIndex + 1 });
      } else {
        this.endBoost('events.depletion');
      }
    } else if (c.burning && wantCutoff) {
      this.endBoost(this.veh.glide ? 'events.cutoffGlide' : 'events.cutoffBallistic');
    }
  }

  endBoost(reasonKey) {
    const c = this.ctrl;
    c.burning = false;
    c.separated = true;
    c.aeroMode = this.veh.glide ? 'glide' : 'rv';
    this.burnoutTime = this.t;
    this.burnoutSpeed = V.norm(this.vTrue);
    // On fige l'erreur de navigation A L'EXTINCTION. C'est elle qui determine
    // l'ecart d'un vecteur balistique : la trajectoire est scellee a cet
    // instant. L'erreur mesuree a l'impact, elle, aura souvent ete reduite par
    // l'altimetre pendant la descente — trop tard pour changer quoi que ce soit.
    this.burnoutNavError = this.navError;
    this.burnoutVelError = V.dist(this.nav.v, this.vTrue);
    this.separationTime = this.t;
    this.log(reasonKey);
    this.log('events.separation', { speed: `${(this.burnoutSpeed / 1000).toFixed(3)} km/s` });
  }

  /** Raffine l'instant d'impact et etablit le bilan du tir. */
  resolveImpact(t, dt, deriv) {
    let lo = 0, hi = dt;
    for (let i = 0; i < 40; i++) {
      const mid = 0.5 * (lo + hi);
      const ym = rk4(deriv, t, this.y, mid);
      const am = ecefToLla(eciToEcef([ym[0], ym[1], ym[2]], t + mid)).alt;
      if (am > 0) lo = mid; else hi = mid;
    }
    const tImp = t + 0.5 * (lo + hi);
    this.y = rk4(deriv, t, this.y, 0.5 * (lo + hi));
    this.t = tImp;

    const lla = this.llaTrue;
    const tgt = this.cfg.target;
    const miss = localMiss(lla.lat, lla.lon, tgt.lat, tgt.lon);
    const navLla = ecefToLla(eciToEcef(this.nav.r, this.t));
    const navMiss = localMiss(navLla.lat, navLla.lon, tgt.lat, tgt.lon);

    this.finished = true;
    this.running = false;
    this.result = {
      impact: lla,
      target: tgt,
      missDistance: miss.dist,
      missNorth: -miss.north,
      missEast: -miss.east,
      navError: this.navError,
      burnoutNavError: this.burnoutNavError,
      burnoutVelError: this.burnoutVelError,
      navBelievedMiss: navMiss.dist,
      navSigma: this.nav.positionSigma(),
      flightTime: this.t - this.launchTime,
      impactSpeed: V.norm(this.vTrue),
      apogee: this.apogee,
      maxQ: this.maxQ,
      maxAccel: this.maxAccel,
      burnoutSpeed: this.burnoutSpeed,
      burnoutTime: this.burnoutTime ? this.burnoutTime - this.launchTime : null,
      groundRange: groundRange(this.cfg.launch.lat, this.cfg.launch.lon, lla.lat, lla.lon),
      targetRange: groundRange(this.cfg.launch.lat, this.cfg.launch.lon, tgt.lat, tgt.lon),
      starFixes: this.starTracker.fixes,
      terrainFixes: this.terrain.fixes,
      terrainRejected: this.terrain.rejected,
      alignmentError: this.initialAlignment,
      updates: { ...this.nav.updates },
      ...this.aero.summary(),
    };
    this.log('events.impact', { miss: formatDistance(miss.dist) });
  }

  /** Echantillonne les traces et la telemetrie pour l'affichage. */
  recordTrail(f) {
    const period = this.ctrl.burning ? 0.4 : 2.0;
    if (this.t - this.lastTrailTime < period) return;
    this.lastTrailTime = this.t;

    // Les traces sont memorisees en repere terrestre : c'est ainsi qu'on voit
    // la trajectoire deriver vers l'ouest par rapport au sol, effet de la
    // rotation de la Terre pendant le vol.
    this.trailTruth.push(eciToEcef(this.rTrue, this.t));
    this.trailEst.push(eciToEcef(this.nav.r, this.t));
    if (this.trailTruth.length > 4000) { this.trailTruth.shift(); this.trailEst.shift(); }

    this.telemetry.push({
      t: this.t - this.launchTime,
      alt: f.alt,
      speed: V.norm(this.vTrue),
      navError: this.navError,
      navSigma: this.nav.positionSigma(),
      attError: V.norm(V.rotVecBetween(this.nav.q, this.qTrue)),
      mach: f.mach,
      qDyn: f.qDyn,
      accel: V.norm(f.aSpecific),
    });
    if (this.telemetry.length > 3000) this.telemetry.shift();
  }

  /**
   * Point d'impact prevu, tel que le calculateur le croit. Recalcule
   * periodiquement car c'est une simulation complete a chaque fois.
   */
  predictedImpact() {
    if (this.finished || !this.running) return this.predicted;
    if (this.t - this.lastPredictTime < 2) return this.predicted;
    this.lastPredictTime = this.t;
    if (!this.ctrl.separated && this.computer.phase !== PHASE.CLOSED_LOOP) return this.predicted;

    // Pour un planeur, une prediction purement balistique donnerait son point
    // de CHUTE, pas son point d'impact : elle ignorerait toute l'allonge du vol
    // plane et afficherait un repere des centaines de kilometres trop court.
    // On lui passe donc le meme modele de corps porteur qu'au guidage.
    this.predicted = predictImpact(this.nav.r, this.nav.v, this.t, {
      ballisticCoef: this.veh.rv.ballisticCoef,
      gravityModel: this.cfg.sensors.gravityModel ?? 'j2',
      maxTime: 6000,
      glide: this.veh.glide ? this.computer.glideModel : null,
    });

    // Point de ressource : la ou le planeur cessera de tomber pour commencer a
    // planer. C'est un jalon intermediaire, pas un impact — il merite son
    // propre nom, sans quoi on le confond avec le point d'arrivee.
    this.pullUpPoint = null;
    if (this.veh.glide && !this.computer.pullUpDone) {
      const arc = predictImpact(this.nav.r, this.nav.v, this.t, {
        ballisticCoef: this.veh.rv.ballisticCoef,
        gravityModel: this.cfg.sensors.gravityModel ?? 'j2',
        coarse: true,
        stopAlt: this.veh.glide.pullUpAlt,
        maxTime: 3000,
      });
      if (arc.stoppedAtAlt) this.pullUpPoint = arc.lla;
    }
    return this.predicted;
  }

  /** Etat courant condense, pour le HUD. */
  snapshot() {
    const f = computeForces(this.t, this.y, this.ctrl);
    const lla = this.llaTrue;
    const navLla = ecefToLla(eciToEcef(this.nav.r, this.t));
    const vRel = airRelativeVelocity(this.rTrue, this.vTrue);
    // Recalcule plutot que relu du dernier pas : le HUD affiche l'etat qu'il a
    // sous les yeux, et l'affichage tourne plus vite que la simulation quand le
    // pas s'allonge en vol exo-atmospherique.
    const heat = this.aero.sample(f, this.ctrl.separated);
    return {
      t: this.t - this.launchTime,
      running: this.running,
      finished: this.finished,
      phase: this.computer.phase,
      alt: lla.alt,
      lat: lla.lat,
      lon: lla.lon,
      navAlt: navLla.alt,
      navLat: navLla.lat,
      navLon: navLla.lon,
      speed: V.norm(this.vTrue),
      groundSpeed: V.norm(vRel),
      mach: f.mach,
      qDyn: f.qDyn,
      accel: V.norm(f.aSpecific) / 9.80665,
      // Aerothermique. Unites SI strictes : W/m^2, J/m^2, K.
      heatRate: heat.heatRate,
      heatLoad: this.aero.heatLoad,
      surfaceTemp: heat.surfaceTemp,
      mass: f.mass,
      thrust: f.thrust,
      stageIndex: this.ctrl.stageIndex,
      burning: this.ctrl.burning,
      separated: this.ctrl.separated,
      navError: this.navError,
      navSigma: this.nav.positionSigma(),
      attError: V.norm(V.rotVecBetween(this.nav.q, this.qTrue)) * RAD,
      attSigma: this.nav.attitudeSigma() * RAD,
      vGo: this.computer.vGoMag,
      fpa: flightPathAngle(this.rTrue, this.vTrue) * RAD,
      apogee: this.apogee,
      downrange: groundRange(this.cfg.launch.lat, this.cfg.launch.lon, lla.lat, lla.lon),
      toTarget: groundRange(lla.lat, lla.lon, this.cfg.target.lat, this.cfg.target.lon),
      starFixes: this.starTracker.fixes,
      terrainFixes: this.terrain.fixes,
      terrainRejected: this.terrain.rejected,
      terrainSigma: this.terrain.lastSigma,
      // Rugosite du sol survole : c'est elle qui decide si une correlation
      // de relief peut fonctionner ici.
      ruggedness: this.terrainField.ruggedness(lla.lat, lla.lon),
      groundElevation: this.terrainField.elevation(lla.lat, lla.lon),
      glide: this.computer.diagnostics,
    };
  }

  /**
   * Trame de telemetrie : ce que les capteurs MESURENT et ce que le calculateur
   * COMMANDE aux equipements.
   *
   * Ces deux flux sont volontairement separes, car c'est toute la distinction
   * que le simulateur cherche a rendre tangible : les mesures sont les seules
   * informations dont dispose le bord, et les commandes en sont la consequence.
   * Rien ici ne provient de la verite terrain — un vrai enregistreur de bord
   * n'y aurait pas acces non plus.
   */
  telemetryFrame() {
    const t = this.t;
    const age = (last) => (last == null ? null : t - last);
    const cmd = this.lastCmd ?? {};
    const c = this.computer;
    const imu = this.imu.lastSample;

    const st = this.veh.stages[this.ctrl.stageIndex];
    const f = computeForces(t, this.y, this.ctrl);
    const thrustN = this.ctrl.separated ? 0 : (f.thrust || 0);
    const rcsN = this.ctrl.rcsAccel
      ? V.norm(this.ctrl.rcsAccel) * this.veh.payloadMass
      : 0;

    const aim = ecefToLla(c.aimEcef);
    const aimOffset = localMiss(this.cfg.target.lat, this.cfg.target.lon, aim.lat, aim.lon);

    return {
      t: t - this.launchTime,
      capteurs: {
        imu: {
          // Force specifique mesuree, en g, dans le repere du corps.
          fBody: imu ? imu.f.map((v) => v / 9.80665) : null,
          // Vitesse de rotation mesuree, en degres par seconde.
          wBody: imu ? imu.w.map((v) => v * RAD) : null,
          biaisEstimeGyro: this.nav.biasGyro.map((v) => (v * RAD) * 3600),
          biaisEstimeAccel: this.nav.biasAccel.map((v) => v / 9.80665e-6),
        },
        altimetre: this.altimeter.lastSample
          ? { ...this.altimeter.lastSample, age: age(this.altimeter.lastSample.t) }
          : null,
        stellaire: {
          disponible: this.starTracker.available(this.altTrue),
          visees: this.starTracker.fixes,
          age: age(this.starTracker.lastSample?.t),
          sigmaArcsec: this.starTracker.lastSample?.sigmaArcsec ?? null,
        },
        terrain: {
          actif: !!this.terrain.cfg.enabled,
          dansLaTranche: this.terrain.inBand(this.altTrue),
          profil: this.terrain.profile.length,
          recalages: this.terrain.fixes,
          rejets: this.terrain.rejected,
          age: age(this.terrain.lastSample?.t),
          dE: this.terrain.lastSample?.dE ?? null,
          dN: this.terrain.lastSample?.dN ?? null,
          sigma: this.terrain.lastSample?.sigma ?? null,
          contraste: this.terrain.lastContrast ?? null,
        },
      },
      instructions: {
        propulsion: {
          etage: this.ctrl.stageIndex + 1,
          nbEtages: this.veh.stages.length,
          allume: thrustN > 0,
          pousseeN: thrustN,
          pousseeMaxN: st ? st.thrustVac : 0,
          ergolsKg: Math.max(0, this.y[IDX.PROP]),
          extinctionDemandee: !!cmd.cutoff,
          tempsAvantExtinction: Number.isFinite(c.timeToCutoff) ? c.timeToCutoff : null,
          separe: this.ctrl.separated,
        },
        pilotage: {
          mode: cmd.mode ?? '—',
          // Vitesse de rotation commandee aux actionneurs, en degres/s.
          rotationCmd: this.ctrl.omegaBody.map((v) => v * RAD),
          incidenceCmd: (cmd.aoa ?? 0) * RAD,
          giteCmd: (cmd.bank ?? 0) * RAD,
        },
        correction: {
          active: !!this.cfg.midcourse?.enabled,
          pousseeN: rcsN,
          deltaVUtilise: c.midcourseUsed,
          deltaVBudget: this.cfg.midcourse?.deltaV ?? 0,
        },
        guidage: {
          phase: c.phase,
          vitesseAGagner: Number.isFinite(c.vGoMag) ? c.vGoMag : null,
          erreurPortee: c.rangeError,
          viseeDecalageN: aimOffset.north,
          viseeDecalageE: aimOffset.east,
          viseeGelee: !!c.aimFrozen,
        },
      },
    };
  }
}

export function formatDistance(m) {
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return `${m.toFixed(0)} m`;
  if (m < 100000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(0)} km`;
}

/**
 * Fait tourner un vol complet sans affichage. Utilise par le mode
 * Monte-Carlo et par les tests.
 */
export function runHeadless(cfg, maxSteps = 400000) {
  const sim = new Simulation(cfg);
  sim.launch();
  let n = 0;
  while (n++ < maxSteps && sim.step()) { /* avance jusqu'a l'impact */ }
  return sim;
}
