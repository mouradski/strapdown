// Calculateur de bord.
//
// Point essentiel : ce module ne recoit JAMAIS l'etat vrai du vehicule. Il ne
// travaille que sur l'estimation fournie par la centrale inertielle. S'il vise
// juste mais que la centrale a derive de deux kilometres, l'engin tombera a
// deux kilometres — et le calculateur n'en saura rien. C'est exactement ce que
// le simulateur cherche a montrer.
//
// Enchainement du guidage propulse :
//   1. montee verticale     — on sort de la couche dense sans contrainte laterale
//   2. basculement initial  — une impulsion de tangage donne l'azimut de tir
//   3. virage gravitationnel— on suit le vecteur vitesse, incidence quasi nulle,
//                             donc efforts aerodynamiques minimaux
//   4. boucle fermee        — on resout la trajectoire balistique a chaque cycle
//                             et on pousse selon la "vitesse a gagner"
//
// L'extinction survient quand la vitesse a gagner s'annule : c'est ce qui
// permet a un meme vecteur de couvrir toutes les portees jusqu'a son maximum,
// sans programme de vol fige a l'avance.

import { EARTH, DEG, RAD, G0 } from '../core/constants.js';
import * as V from '../core/vec.js';
import {
  llaToEcef, ecefToLla, eciToEcef, ecefToEci, enuToEcef,
  groundRange, initialBearing, flightPathAngle, crossTrackDistance,
} from '../core/geodesy.js';
import { atmosphere } from '../core/atmosphere.js';
import { solveIntercept, predictImpact } from './ballistic.js';
import {
  bestGlideAoA, glideCoefficients, aoaForCL, aoaForFinesse, equilibriumGlideRange,
} from '../sim/vehicle.js';
import { corridorFloor, corridorPullUp, maxLiftAcceleration, DEFAULT_LIMITS } from './corridor.js';

export const PHASE = {
  PRELAUNCH: 'prelaunch',
  VERTICAL: 'vertical',
  KICK: 'kick',
  GRAVITY_TURN: 'gravityturn',
  CLOSED_LOOP: 'closedloop',
  COAST: 'coast',
  MIDCOURSE: 'midcourse',
  REENTRY: 'reentry',
  GLIDE: 'glide',
  TERMINAL: 'terminal',
  IMPACT: 'impact',
};

// Reglage de la correction laterale (voir `evaluateCutoff`). La fenetre dit a
// partir de quel ecart de portee la deviation laterale predite devient
// exploitable ; le gain amortit la correction pour qu'elle converge sans
// osciller pendant les quelques dizaines de secondes qui restent.
const CROSS_TRACK_WINDOW = 80e3;
const CROSS_TRACK_GAIN = 0.6;

// Facteur d'anticipation de la dissipation d'energie du planeur (voir
// `guideGlide`). A 1 la correction est exacte mais ne converge qu'a l'infini ;
// au-dela, l'exces est efface tot et la boucle relache ensuite.
const ENERGY_LEAD = 1.3;

// Phase terminale du planeur : distance a laquelle on passe en poursuite, et
// gain reliant l'erreur de pointage a l'incidence commandee.
const TERMINAL_RANGE = 45000;
// Gain de poursuite du corps manoeuvrant. Plus faible que celui du planeur :
// avec 9 degres d'incidence disponibles, un gain fort ne ferait que saturer.
const MARV_GAIN = 3.5;
const TERMINAL_GAIN = 6;

export class FlightComputer {
  constructor(opts) {
    this.veh = opts.veh;
    this.launchLla = opts.launchLla;
    this.targetLla = opts.targetLla;
    this.loft = opts.loft ?? 0;
    this.gravityModel = opts.gravityModel ?? 'j2';
    this.midcourse = opts.midcourse ?? { enabled: false, deltaV: 0 };
    // Limites de corridor. Desserrables depuis l'interface : c'est en les
    // relachant que l'on voit reapparaitre le plongeon qu'elles empechent.
    this.limits = { ...DEFAULT_LIMITS, ...(opts.limits ?? {}) };

    this.targetEcef = llaToEcef(opts.targetLla.lat, opts.targetLla.lon, opts.targetLla.alt ?? 0);
    // Le point vise differe de la cible : il compense tout ce que la solution
    // keplerienne ignore, a commencer par le freinage a la rentree.
    this.aimEcef = V.clone(this.targetEcef);

    this.phase = PHASE.PRELAUNCH;
    this.cutoff = false;
    this.vGo = null;
    this.vGoMag = Infinity;
    this.prevVGoMag = Infinity;
    this.timeToCutoff = Infinity;
    this.solution = null;
    this.lastSolveTime = -1e9;
    this.lastAimUpdate = -1e9;
    this.aimIterations = 0;
    this.aimFrozen = false;
    this.aimResidual = null;
    // Suivi du critere d'extinction.
    this.lastCutoffEval = null;
    this.rangeRate = 0;
    this.rangeError = null;
    this.cutoffPrediction = null;
    this.targetGroundRange = groundRange(
      opts.launchLla.lat, opts.launchLla.lon, opts.targetLla.lat, opts.targetLla.lon,
    );
    this.midcourseUsed = 0;
    this.midcourseDone = false;
    this.predictedImpact = null;
    this.thrustDir = null;
    this.diagnostics = {};

    const g = this.veh.guidance;
    this.verticalRise = g.verticalRise;
    this.kickDuration = 6;
    this.kickAngle = g.pitchKick * DEG;
    this.turnEnd = g.turnEnd;
    this.blendTime = 12;

    this.bestAoA = this.veh.glide ? bestGlideAoA(this.veh) : 0;
    if (this.veh.glide) {
      const c = glideCoefficients(this.veh, this.bestAoA);
      this.ldMax = c.cl / c.cd;
      this.glideFinesse = this.ldMax;
      // Modele passe au predicteur : les memes coefficients que ceux que le
      // guidage appliquera, pour que la prediction decrive bien le vol reel.
      this.glideModel = {
        area: this.veh.rv.refArea,
        mass: this.veh.payloadMass,
        cl: c.cl,
        cd: c.cd,
        pullUpAlt: this.veh.glide.pullUpAlt,
        minSpeed: this.veh.glide.minSpeed,
      };
    }
    this.pullUpDone = false;
  }

  /**
   * Solution de tir avant lancement. Ne sert qu'a fixer l'azimut initial et a
   * verifier la faisabilite : la boucle fermee recalculera tout en vol.
   */
  plan(t0, rLaunchEci) {
    const sol = solveIntercept(rLaunchEci, this.aimEcef, t0, this.loft);
    if (!sol) return null;
    this.solution = sol;

    // Azimut de tir : direction horizontale de la vitesse requise. Elle
    // integre naturellement la derive due a la rotation terrestre, ce qu'un
    // simple cap orthodromique ne ferait pas.
    const up = V.normalize(rLaunchEci);
    const horiz = V.rejectFrom(sol.v1, up);
    this.launchDir = V.norm(horiz) > 1 ? V.normalize(horiz) : V.normalize(V.cross([0, 0, 1], up));

    const lla = ecefToLla(eciToEcef(rLaunchEci, t0));
    this.groundRange = groundRange(lla.lat, lla.lon, this.targetLla.lat, this.targetLla.lon);
    this.bearing = initialBearing(lla.lat, lla.lon, this.targetLla.lat, this.targetLla.lon);
    this.planeNormal = V.normalize(V.cross(rLaunchEci, ecefToEci(this.aimEcef, t0 + sol.tof)));

    return {
      requiredSpeed: sol.speed,
      apogee: sol.apogee,
      tof: sol.tof,
      groundRange: this.groundRange,
      bearing: this.bearing,
      flightPathAngle: flightPathAngle(rLaunchEci, sol.v1) * RAD,
    };
  }

  /**
   * Cycle de guidage. `nav` est la centrale inertielle : c'est la seule source
   * d'information sur la position. `env` decrit la configuration mecanique.
   */
  update(t, nav, env) {
    const rEst = nav.r;
    const vEst = nav.v;
    const upEst = V.normalize(rEst);
    const altEst = ecefToLla(eciToEcef(rEst, t)).alt;
    const vRelEst = V.sub(vEst, V.cross([0, 0, EARTH.omega], rEst));
    const qDynEst = 0.5 * atmosphere(Math.max(0, altEst)).rho * V.norm2(vRelEst);

    const cmd = {
      thrustDir: null, throttle: 1, cutoff: false, separate: false,
      aoa: 0, bank: 0, mode: 'ballistic', phase: this.phase,
    };

    if (env.separated) {
      return this.guideAfterSeparation(t, nav, env, cmd, altEst, vRelEst, qDynEst);
    }

    const tSince = t - env.launchTime;

    if (tSince < this.verticalRise) {
      this.phase = PHASE.VERTICAL;
      cmd.thrustDir = upEst;
    } else if (tSince < this.verticalRise + this.kickDuration) {
      this.phase = PHASE.KICK;
      // Basculement progressif de la verticale vers l'azimut de tir.
      const s = (tSince - this.verticalRise) / this.kickDuration;
      const axis = V.cross(upEst, this.launchDir);
      cmd.thrustDir = V.qRot(V.qFromAxisAngle(axis, this.kickAngle * s), upEst);
    } else if (tSince < this.turnEnd) {
      this.phase = PHASE.GRAVITY_TURN;
      // Incidence nulle : le vehicule se laisse coucher par la gravite, ce
      // qui minimise les efforts lateraux dans la couche dense.
      cmd.thrustDir = V.norm(vRelEst) > 10 ? V.normalize(vRelEst) : upEst;
    } else {
      this.phase = PHASE.CLOSED_LOOP;
      if (this.veh.glide) {
        cmd.thrustDir = this.depressedAscentDirection(t, rEst, vEst, vRelEst, altEst);
        this.evaluateCutoff(t, rEst, vEst);
      } else {
        cmd.thrustDir = this.closedLoopDirection(t, rEst, vEst, vRelEst, tSince, env);
      }
      cmd.cutoff = this.cutoff;
    }

    // Limitation d'incidence tant que la pression dynamique est forte : une
    // manoeuvre trop brutale dans la couche dense casserait le vehicule.
    if (cmd.thrustDir && V.norm(vRelEst) > 50) {
      const maxAoA = qDynEst > 20000 ? 2 * DEG : qDynEst > 5000 ? 6 * DEG
        : qDynEst > 500 ? 20 * DEG : Math.PI;
      cmd.thrustDir = clampToCone(cmd.thrustDir, V.normalize(vRelEst), maxAoA);
    }

    cmd.mode = 'boost';
    cmd.phase = this.phase;
    this.thrustDir = cmd.thrustDir;
    return cmd;
  }

  /**
   * Guidage en boucle fermee : on resout la trajectoire balistique depuis la
   * position estimee, et l'on pousse selon la difference entre la vitesse
   * requise et la vitesse actuelle. Quand cette difference s'annule, on coupe.
   */
  closedLoopDirection(t, rEst, vEst, vRelEst, tSince, env) {
    // Loin de l'extinction la solution evolue lentement et un recalcul par
    // demi-seconde suffit. Pres de l'extinction, en revanche, une solution
    // vieille d'une demi-seconde est deja fausse de plusieurs m/s — et sur
    // une trajectoire balistique 1 m/s d'erreur a l'extinction coute environ
    // 2R/v en portee, soit pres d'un kilometre. On recalcule donc a chaque pas.
    const nearCutoff = this.vGoMag < 400;
    if (nearCutoff || t - this.lastSolveTime > 0.5) {
      this.lastSolveTime = t;
      const sol = solveIntercept(rEst, this.aimEcef, t, this.loft, nearCutoff ? 10 : 6);
      if (sol) this.solution = sol;
    }
    if (!this.solution) return V.normalize(vRelEst);

    // Correction du point vise : la solution keplerienne ignore la trainee de
    // rentree, qui raccourcit systematiquement la portee. On simule, on mesure
    // l'ecart, on decale la visee. Le planeur, lui, corrigera en manoeuvrant.
    // On resserre la cadence a l'approche de l'extinction, ou la prediction
    // est faite depuis un point de plus en plus proche du point reel.
    // On gele la visee juste avant l'extinction. Chaque correction deplace le
    // point vise de quelques kilometres, donc la vitesse requise de quelques
    // m/s : continuer a la corriger jusqu'au bout ferait courir la vitesse a
    // gagner apres une cible mouvante, et elle ne s'annulerait jamais.
    const aimPeriod = this.vGoMag < 600 ? 2 : 8;
    if (!this.veh.glide && !this.aimFrozen && t - this.lastAimUpdate > aimPeriod) {
      this.lastAimUpdate = t;
      this.refineAimPoint(t, rEst);
    }
    if (this.vGoMag < 50 && !this.aimFrozen) {
      this.aimFrozen = true;
    }

    this.prevVGoMag = this.vGoMag;
    this.vGo = V.sub(this.solution.v1, vEst);
    this.vGoMag = V.norm(this.vGo);

    // Critere d'extinction.
    //
    // Attendre que la vitesse a gagner s'annule ne marche pas avec un moteur
    // non modulable : le vehicule atteint le module de vitesse requis avant
    // d'avoir fini de s'orienter, et la vitesse a gagner repart a la hausse
    // sans jamais passer par zero. On coupe donc sur une grandeur scalaire et
    // monotone : la portee du point d'impact predit depuis l'etat estime, qui
    // ne fait que croitre tant que le moteur pousse. On s'eteint quand elle
    // atteint la portee de la cible.
    this.evaluateCutoff(t, rEst, vEst);

    let dir = V.normalize(this.vGo);
    // Raccord progressif depuis le virage gravitationnel : la direction a
    // gagner peut etre assez eloignee du vecteur vitesse au moment du passage.
    const blend = (tSince - this.turnEnd) / this.blendTime;
    if (blend < 1 && V.norm(vRelEst) > 10) {
      dir = V.normalize(V.lc2(V.normalize(vRelEst), 1 - blend, dir, blend));
    }
    return dir;
  }

  /**
   * Montee surbaissee du planeur.
   *
   * Un vecteur balistique monte tres haut puis retombe ; un planeur, non. Il
   * doit arriver a l'extinction PRESQUE A PLAT, vers 65 km, sans quoi il
   * redescend avec une pente de rentree trop forte et traverse son altitude
   * d'equilibre au lieu de s'y poser — c'est exactement ce qui le faisait
   * plonger. On asservit donc directement l'angle de pente sur l'ecart
   * d'altitude, et l'azimut sur le cap de la cible.
   */
  depressedAscentDirection(t, rEst, vEst, vRelEst, altEst) {
    const up = V.normalize(rEst);
    const g = this.veh.glide;
    const hTarget = g.ascentTargetAlt;

    // Profil de pente en fonction de l'altitude, et non du temps : c'est ce
    // qui rend le profil robuste aux variations de poussee. La pente part
    // franche au decollage et s'annule a l'altitude de mise en plane. Le
    // limiteur d'incidence en aval empeche de demander a la structure plus
    // que ce que l'air permet.
    const frac = Math.max(0, Math.min(1, altEst / hTarget));
    const gammaDeg = Math.max(-1.5, g.ascentGammaMax * (1 - frac));
    const gamma = gammaDeg * DEG;

    // Direction horizontale : celle du grand cercle vers la cible.
    const lla = ecefToLla(eciToEcef(rEst, t));
    const aimLla = ecefToLla(this.aimEcef);
    const brg = initialBearing(lla.lat, lla.lon, aimLla.lat, aimLla.lon) * DEG;
    const east = ecefToEci(enuToEcef([1, 0, 0], lla.lat, lla.lon), t);
    const north = ecefToEci(enuToEcef([0, 1, 0], lla.lat, lla.lon), t);
    const horiz = V.normalize(V.lc2(north, Math.cos(brg), east, Math.sin(brg)));

    this.diagnostics = {
      gammaCmd: gammaDeg,
      gammaActual: V.norm(vRelEst) > 10
        ? Math.asin(Math.max(-1, Math.min(1, V.dot(up, V.normalize(vRelEst))))) * RAD : 0,
      hTarget, altEst,
    };
    return V.normalize(V.lc2(horiz, Math.cos(gamma), up, Math.sin(gamma)));
  }

  /**
   * Suit la portee du point d'impact predit et decide de l'extinction.
   *
   * La prediction est faite depuis l'etat ESTIME, avec le modele de trainee
   * embarque : elle inclut donc le freinage de rentree, ce que la solution
   * keplerienne seule ne fait pas. Entre deux evaluations on extrapole
   * lineairement, ce qui donne au simulateur le temps restant exact et lui
   * permet de couper au milieu d'un pas.
   */
  evaluateCutoff(t, rEst, vEst) {
    // Inutile de predire tant qu'on est loin du compte : c'est la partie
    // couteuse du guidage.
    if (this.veh.glide) return this.evaluateCutoffGlide(t, rEst, vEst);
    if (this.vGoMag > 1400) { this.timeToCutoff = Infinity; return; }

    const period = 0.25;
    if (this.lastCutoffEval && t - this.lastCutoffEval.t < period) {
      // Extrapolation entre deux evaluations completes.
      if (this.rangeRate > 1) {
        const dtSince = t - this.lastCutoffEval.t;
        const err = this.lastCutoffEval.err + this.rangeRate * dtSince;
        this.rangeError = err;
        this.timeToCutoff = err >= 0 ? 0 : -err / this.rangeRate;
        if (err >= 0) this.cutoff = true;
      }
      return;
    }

    // Prediction grossiere tant qu'on est loin, fine des que l'extinction
    // approche : c'est la derniere prediction qui fixe la precision du tir.
    const imp = predictImpact(rEst, vEst, t, {
      ballisticCoef: this.veh.rv.ballisticCoef,
      gravityModel: this.gravityModel,
      coarse: this.rangeError === null || Math.abs(this.rangeError) > 40000,
      maxTime: 3000,
    });
    const reach = groundRange(
      this.launchLla.lat, this.launchLla.lon, imp.lla.lat, imp.lla.lon,
    );
    const err = reach - this.targetGroundRange;

    if (this.lastCutoffEval) {
      const dt = t - this.lastCutoffEval.t;
      if (dt > 1e-6) this.rangeRate = (err - this.lastCutoffEval.err) / dt;
    }
    this.lastCutoffEval = { t, err };
    this.rangeError = err;
    this.cutoffPrediction = imp;

    // --- Correction laterale ---
    //
    // Le critere d'extinction est scalaire : il ne regarde que la portee. Rien
    // ne garantit donc qu'a l'instant ou la portee est juste, l'ecart LATERAL
    // le soit aussi — la poussee s'arrete avec le residu qu'elle avait. Cela
    // laissait un biais deterministe d'environ un demi-kilometre, suffisant
    // pour masquer l'ecart entre deux classes de centrale.
    //
    // On mesure donc la deviation du point d'impact predit par rapport au plan
    // de tir, et l'on decale la visee du meme ecart, perpendiculairement. Le
    // guidage a alors le temps de la rattraper avant de s'eteindre.
    // On n'y touche qu'une fois la prediction proche en portee : tant qu'elle
    // tombe des centaines de kilometres trop court, sa deviation laterale ne
    // veut rien dire, et la corriger ferait diverger la visee.
    // Il subsiste apres correction un residu d'environ 250 m : dans les
    // dernieres secondes de poussee, la vitesse de rotation limitee empeche la
    // direction de vitesse de rallier completement la nouvelle visee. C'est le
    // plancher de precision du guidage lui-meme, independant des capteurs.
    // La fenetre est aussi bornee en proportion de la portee : 80 km ne
    // representent rien sur un tir de 5000 km, mais 14 % d'un tir de 588 km —
    // la correction demarrerait alors bien trop tot.
    const window = Math.min(CROSS_TRACK_WINDOW, 0.05 * this.targetGroundRange);
    if (!this.aimFrozen && Math.abs(err) < window) {
      const cross = crossTrackDistance(
        this.launchLla.lat, this.launchLla.lon,
        this.targetLla.lat, this.targetLla.lon,
        imp.lla.lat, imp.lla.lon,
      );
      this.crossTrackError = cross;
      if (Math.abs(cross) > 15) {
        const aim = ecefToLla(this.aimEcef);
        // Direction « a droite de la route », en composantes Nord/Est :
        // un cap b pointe vers (cos b, sin b), sa droite vers (-sin b, cos b).
        const b = (this.bearing ?? 0) * DEG;
        const gain = CROSS_TRACK_GAIN;
        const dNorth = gain * cross * Math.sin(b);
        const dEast = -gain * cross * Math.cos(b);
        this.aimEcef = llaToEcef(
          aim.lat + (dNorth / EARTH.Rmean) * RAD,
          aim.lon + (dEast / (EARTH.Rmean * Math.cos(aim.lat * DEG))) * RAD,
          this.targetLla.alt ?? 0,
        );
      }
    }

    this.timeToCutoff = this.rangeRate > 1 ? Math.max(0, -err / this.rangeRate) : Infinity;
    if (err >= 0) this.cutoff = true;
  }

  /**
   * Critere d'extinction du planeur.
   *
   * Un planeur ne doit surtout PAS etre eteint avec l'energie d'atteindre la
   * cible en balistique : il la survolerait avant meme d'avoir ressource.
   * La portee totale se decompose en deux :
   *   - l'arc balistique jusqu'a l'altitude de ressource,
   *   - puis la portee du vol plane, donnee par la formule d'equilibre.
   * On eteint quand la SOMME des deux atteint la portee de la cible. Le
   * planeur est donc coupe bien plus tot qu'un vecteur balistique — c'est
   * tout l'interet du corps porteur.
   */
  evaluateCutoffGlide(t, rEst, vEst) {
    const period = 0.3;
    if (this.lastCutoffEval && t - this.lastCutoffEval.t < period) {
      if (this.rangeRate > 1) {
        const err = this.lastCutoffEval.err + this.rangeRate * (t - this.lastCutoffEval.t);
        this.rangeError = err;
        this.timeToCutoff = err >= 0 ? 0 : -err / this.rangeRate;
        if (err >= 0) this.cutoff = true;
      }
      return;
    }

    // Simulation complete de ce que fera reellement le vehicule : arc
    // balistique, ressource, vol plane a finesse maximale, puis piquee une
    // fois sous la vitesse plancher. Aucune formule approchee, donc aucun
    // coefficient a calibrer — et la prediction reste juste a toutes les
    // portees, ce qu'aucun facteur constant ne parvenait a faire.
    const imp = predictImpact(rEst, vEst, t, {
      ballisticCoef: this.veh.rv.ballisticCoef,
      gravityModel: this.gravityModel,
      coarse: true,
      maxTime: 6000,
      glide: this.glideModel,
    });

    const reach = groundRange(
      this.launchLla.lat, this.launchLla.lon, imp.lla.lat, imp.lla.lon,
    );
    // La prediction suppose un vol sans gite ; or le maintien de cap en
    // impose, et chaque virage coute de la portee. On s'eteint donc avec une
    // marge deliberee : l'exces se brule en virages en S, un deficit ne se
    // rattrape pas.
    const margin = 0.025 * this.targetGroundRange;
    const err = reach - (this.targetGroundRange + margin);
    this.glidePlan = { reach, impact: imp.lla, margin };
    if (this.lastCutoffEval) {
      const dt = t - this.lastCutoffEval.t;
      if (dt > 1e-6) this.rangeRate = (err - this.lastCutoffEval.err) / dt;
    }
    this.lastCutoffEval = { t, err };
    this.rangeError = err;

    this.timeToCutoff = this.rangeRate > 1 ? Math.max(0, -err / this.rangeRate) : Infinity;
    if (err >= 0) this.cutoff = true;
  }

  /**
   * Decale le point vise de l'ecart constate en simulation.
   *
   * La prediction part de la position ESTIMEE courante avec la vitesse
   * requise — or le vehicule pousse encore et coupera ailleurs. Le point de
   * reference se deplace donc a chaque appel, et appliquer tout l'ecart d'un
   * coup fait osciller la visee. On n'en applique qu'une fraction : la visee
   * converge alors proprement vers la compensation de la trainee de rentree.
   */
  refineAimPoint(t, rEst) {
    if (!this.solution) return;
    const imp = predictImpact(rEst, this.solution.v1, t, {
      ballisticCoef: this.veh.rv.ballisticCoef,
      gravityModel: this.gravityModel,
    });
    this.predictedImpact = imp;
    const dLat = this.targetLla.lat - imp.lla.lat;
    const dLon = this.targetLla.lon - imp.lla.lon;
    this.aimResidual = Math.hypot(dLat, dLon) * 111000;
    if (Math.abs(dLat) < 2e-5 && Math.abs(dLon) < 2e-5) return;
    const gain = 0.6;
    const aim = ecefToLla(this.aimEcef);
    this.aimEcef = llaToEcef(
      aim.lat + gain * dLat,
      aim.lon + gain * dLon,
      this.targetLla.alt ?? 0,
    );
    this.aimIterations++;
  }

  /** Guidage apres separation : vol libre, correction mi-course, rentree, plane. */
  guideAfterSeparation(t, nav, env, cmd, altEst, vRelEst, qDynEst) {
    const rEst = nav.r;
    const vEst = nav.v;

    // --- Correction mi-course ---
    // Une petite reserve d'impulsion permet de rattraper l'erreur accumulee
    // pendant la poussee. Elle ne corrige que ce que la centrale VOIT : si
    // l'estimation est fausse, la correction l'est aussi.
    if (this.midcourse.enabled && !this.midcourseDone
      && altEst > 120000 && V.dot(V.normalize(rEst), V.normalize(vEst)) < 0.02) {
      const sol = solveIntercept(rEst, this.aimEcef, t, this.loft, 8);
      if (sol) {
        const dv = V.sub(sol.v1, vEst);
        const dvMag = V.norm(dv);
        const budget = this.midcourse.deltaV;
        cmd.mode = 'midcourse';
        this.phase = PHASE.MIDCOURSE;
        cmd.thrustDir = V.normalize(dv);
        cmd.midcourseDeltaV = Math.min(dvMag, budget - this.midcourseUsed);
        this.midcourseUsed += cmd.midcourseDeltaV;
        this.midcourseDone = true;
        cmd.phase = this.phase;
        return cmd;
      }
    }

    // --- Planeur hypersonique ---
    if (this.veh.glide) return this.guideGlide(t, nav, env, cmd, altEst, vRelEst, qDynEst);

    // --- Corps de rentree manoeuvrant ---
    if (this.veh.marv) return this.guideMarv(t, nav, cmd, altEst, vRelEst, qDynEst);

    // --- Corps de rentree balistique ---
    // Aucun controle : le nez se met dans le lit du vent, l'incidence est
    // nulle, la trajectoire ne depend plus que du coefficient balistique.
    this.phase = altEst < 100000 ? PHASE.REENTRY : PHASE.COAST;
    cmd.mode = 'ballistic';
    cmd.aoa = 0;
    cmd.bank = 0;
    cmd.phase = this.phase;
    return cmd;
  }

  /**
   * Guidage d'un corps de rentree manoeuvrant.
   *
   * Le troisieme regime du simulateur, et le plus instructif des trois parce
   * qu'il est intermediaire :
   *
   *   corps de rentree balistique  aucune correction — tout est scelle a l'extinction
   *   corps manoeuvrant            quelques dizaines de secondes d'autorite, tout en bas
   *   planeur hypersonique         des minutes de manoeuvre, jusqu'au but
   *
   * Deux bornes rendent cette autorite etroite, et ce sont elles qui font
   * l'interet du cas :
   *
   *   - les gouvernes ne mordent que dans l'air dense. Tant que la pression
   *     dynamique est faible, commander une incidence ne produit rien. Le
   *     vehicule est donc balistique pendant l'essentiel du vol, y compris une
   *     bonne partie de la rentree ;
   *   - l'incidence reste petite. Un corps elance ne se met pas en travers a
   *     Mach 8 sous forte pression dynamique.
   *
   * Consequence pedagogique : ce vecteur corrige une PARTIE de l'erreur, et
   * seulement celle que sa centrale percoit tard. Une capacite de manoeuvre
   * terminale ne rachete pas une mauvaise navigation — elle en rattrape la
   * fraction qui tient dans quelques kilometres de deport lateral.
   */
  guideMarv(t, nav, cmd, altEst, vRelEst, qDynEst) {
    const m = this.veh.marv;
    const rEst = nav.r;
    cmd.mode = 'marv';

    // Hors du domaine ou les gouvernes agissent : pure balistique.
    if (qDynEst < m.minQ) {
      this.phase = altEst < 100000 ? PHASE.REENTRY : PHASE.COAST;
      cmd.aoa = 0;
      cmd.bank = 0;
      cmd.phase = this.phase;
      this.marvAuthority = 0;
      return cmd;
    }

    this.phase = PHASE.TERMINAL;

    // Poursuite : on pointe le vecteur vitesse sur le point vise. L'incidence
    // fixe l'intensite de la correction, la gite en oriente le plan.
    const up = V.normalize(rEst);
    // On vise la CIBLE, et non le point vise.
    //
    // Le point vise porte un decalage volontaire, cale pendant la poussee pour
    // pre-compenser ce qu'une chute non guidee perd au freinage. Un corps
    // manoeuvrant, lui, corrige son impact reel : lui donner en plus la
    // pre-compensation revient a la compter deux fois, et il se pose
    // exactement a cote — de la valeur du decalage. Mesure a l'appui : point
    // vise decale de 1525 m, ecart final 1453 m.
    const aimEci = ecefToEci(this.targetEcef, t);
    const vHat = V.normalize(vRelEst);

    // Compensation de gravite.
    //
    // Pointer le vecteur vitesse SUR la cible fait tomber court, et
    // systematiquement : pendant le temps de vol restant, la gravite continue
    // de courber la trajectoire vers le bas. La poursuite pure ne le voit pas
    // — elle annule une erreur de pointage, pas une erreur d'impact.
    //
    // On vise donc au-dessus du point vise, de la hauteur exacte que la
    // gravite va reprendre : 1/2 g t^2, avec t le temps de vol restant estime.
    // Mesure a l'appui, cette seule correction valait plus d'un kilometre
    // d'ecart a 800 km de portee.
    const dist = V.dist(aimEci, rEst);
    const closing = Math.max(50, -V.dot(vRelEst, V.normalize(V.sub(rEst, aimEci))));
    const tGo = dist / closing;
    const gLocal = EARTH.mu / V.dot(rEst, rEst);
    const releve = 0.5 * gLocal * tGo * tGo;
    const aimLead = V.add(aimEci, V.scale(up, releve));

    const los = V.normalize(V.sub(aimLead, rEst));
    const corr = V.rejectFrom(V.sub(los, vHat), vHat);
    const need = V.norm(corr);

    const upPerp = V.normalize(V.rejectFrom(up, vHat));
    const rightPerp = V.cross(vHat, upPerp);

    // Bornage par la charge admissible AVANT le bornage par l'incidence
    // maximale : sous forte pression dynamique c'est la cellule qui limite, pas
    // la gouverne. On resout l'incidence qui produit exactement maxLoad.
    const S = this.veh.rv.refArea;
    const clMax = (m.maxLoad * this.veh.payloadMass * G0) / Math.max(1, qDynEst * S);
    const sin2 = Math.max(-1, Math.min(1, clMax / m.liftSlope));
    const aoaParCharge = 0.5 * Math.asin(sin2);

    const plafond = Math.min(m.maxAoA, aoaParCharge);
    const aoa = Math.max(0, Math.min(plafond, MARV_GAIN * need));
    const bank = Math.atan2(V.dot(corr, rightPerp), V.dot(corr, upPerp));

    // Autorite restante, exposee pour la telemetrie : c'est la grandeur qui
    // dit si le vehicule peut encore quelque chose, ou s'il ne fait plus que
    // tomber en pointant la cible.
    this.marvAuthority = plafond > 0 ? Math.min(1, aoa / plafond) : 0;

    cmd.aoa = aoa;
    cmd.bank = bank;
    cmd.phase = this.phase;
    this.diagnostics = {
      aoaDeg: aoa * RAD, bankDeg: bank * RAD, qDyn: qDynEst, altEst,
      pointingErrDeg: need * RAD, plafondDeg: plafond * RAD,
      limite: aoaParCharge < m.maxAoA ? 'charge' : 'gouverne',
    };
    return cmd;
  }

  /**
   * Guidage du planeur hypersonique.
   *
   * Au lieu de retomber, le corps porteur ressource dans la haute atmosphere
   * et se met en vol plane. Deux boucles independantes :
   *   - longitudinale : l'incidence tient une altitude de reference
   *   - laterale : la gite annule l'ecart de cap vers la cible
   * La portee ne depend alors plus seulement de l'energie a l'extinction, mais
   * aussi de la finesse aerodynamique.
   */
  guideGlide(t, nav, env, cmd, altEst, vRelEst, qDynEst) {
    const g = this.veh.glide;
    const rEst = nav.r;
    const up = V.normalize(rEst);
    const speed = V.norm(vRelEst);
    const rMag = V.norm(rEst);

    const lla = ecefToLla(eciToEcef(rEst, t));
    const aimLla = ecefToLla(this.aimEcef);
    const distToTarget = groundRange(lla.lat, lla.lon, aimLla.lat, aimLla.lon);

    cmd.mode = 'glide';

    // Tant qu'on descend depuis l'apogee sans avoir atteint l'altitude de
    // ressource, on reste en balistique : inutile de trainer plus haut.
    const descending = V.dot(up, vRelEst) < 0;
    if (!this.pullUpDone && (!descending || altEst > g.pullUpAlt)) {
      this.phase = altEst > 100000 ? PHASE.COAST : PHASE.REENTRY;

      // Descente vers la ressource. Elle se faisait a incidence NULLE, et
      // c'etait le vrai defaut : le vehicule accumulait une vitesse de chute
      // que sa portance maximale ne rattrapait plus ensuite. Mesure a l'appui,
      // il saturait 34 s a 22 degres sans parvenir a redresser, et encaissait
      // 12 g.
      //
      // La barriere de corridor s'applique donc DES LA DESCENTE : elle ne
      // demande rien tant que la chute reste freinable, et commence a cabrer
      // des qu'elle ne l'est plus. L'altitude de ressource devient une borne
      // haute — on plane au plus tard a 62 km — au lieu d'un declencheur.
      const vv = V.dot(up, vRelEst);
      this.corridor = corridorFloor(speed, this.veh, this.limits, 0);
      const rappel = corridorPullUp(altEst, vv, this.corridor, this.limits.maxLoad,
        maxLiftAcceleration(altEst, speed, this.veh));
      this.corridor.pullUpDeg = rappel * RAD;
      this.corridor.marginM = altEst - this.corridor.alt;

      if (rappel > 0) {
        // La barriere mord : on entre en plane, meme au-dessus de l'altitude
        // nominale de ressource.
        this.pullUpDone = true;
        this.pullUpSpeed = speed;
        this.pullUpAlt = altEst;
        this.pullUpLla = lla;
      } else {
        cmd.aoa = 0;
        cmd.bank = 0;
        cmd.phase = this.phase;
        return cmd;
      }
    }
    if (!this.pullUpDone) {
      this.pullUpDone = true;
      this.pullUpSpeed = speed;
      this.pullUpAlt = altEst;
      this.pullUpLla = lla;
    }
    this.phase = PHASE.GLIDE;

    // --- Identification en vol de la finesse reellement obtenue ---
    //
    // La finesse theorique (2.22 ici) n'est jamais atteinte : la ressource,
    // les virages et le piquee final en mangent une part. Plutot que de la
    // corriger par un coefficient devine, le calculateur la MESURE sur la
    // distance deja parcourue depuis la ressource — c'est exactement
    // l'inversion de la formule de portee. Toute la gestion d'energie qui suit
    // s'appuie ensuite sur cette valeur observee, et non sur la theorie.
    // --- Ou tomberait-on si l'on ne faisait plus rien ? ---
    //
    // On rejoue periodiquement la meme simulation que celle qui a decide de
    // l'extinction, mais depuis l'etat courant et sans gite : elle donne donc
    // la portee MAXIMALE encore atteignable. L'exces par rapport a la distance
    // restante est precisement ce qu'il faut bruler en virages.
    //
    // C'est plus sur que de raisonner sur la formule analytique : celle-ci
    // s'arrete a la vitesse plancher et ignore la distance parcourue pendant
    // la piquee finale — quelques dizaines de kilometres, soit exactement
    // l'ordre de grandeur de l'erreur que l'on cherche a corriger.
    if (t - (this.lastGlidePredict ?? -1e9) > 1.5) {
      this.lastGlidePredict = t;
      const imp = predictImpact(rEst, nav.v, t, {
        ballisticCoef: this.veh.rv.ballisticCoef,
        gravityModel: this.gravityModel,
        coarse: true,
        maxTime: 6000,
        glide: this.glideModel,
      });
      this.glideReach = groundRange(lla.lat, lla.lon, imp.lla.lat, imp.lla.lon);
    }

    // --- Boucle laterale et gestion de l'energie ---
    //
    // L'incidence ne permet pas de dissiper : la finesse ne tombe que de 2.22
    // a 2.0 entre l'optimum et l'incidence maximale, la courbe est bien trop
    // plate. Le seul vrai moyen de raccourcir la portee est la GITE. En virage,
    // la composante verticale de la portance vaut L.cos(gite) : il faut donc
    // produire L/cos(gite) pour tenir, et la trainee augmente d'autant. La
    // finesse effective devient E.cos(gite).
    //
    // En exces de portee, on incline donc fortement en alternant les cotes —
    // le classique virage en S, qui brule de l'energie sans deriver du cap.
    const bearingToTarget = initialBearing(lla.lat, lla.lon, aimLla.lat, aimLla.lon);
    const track = groundTrackHeading(rEst, vRelEst, t);
    const headingErr = ((bearingToTarget - track + 540) % 360) - 180;

    // Incliner de `bank` ramene la portance verticale a L.cos(bank), ce qui
    // raccourcit la portee restante dans le meme rapport. Pour bruler un exces
    // `e` sur une distance `d`, il faut donc cos(bank) = d / (d + e).
    // On dissipe DAVANTAGE que le strict necessaire (facteur d'anticipation).
    // Une correction juste suffisante ne s'annule qu'asymptotiquement : sur un
    // plane long il reste le temps de converger, sur un plane court non — et
    // l'exces se retrouve intact a l'entree en phase terminale, ou plus rien
    // ne peut l'absorber. En sur-dissipant, on efface l'exces tot ; s'il
    // devient negatif, la boucle relache d'elle-meme la gite.
    const excess = (this.glideReach ?? distToTarget) - distToTarget;
    const lead = excess * ENERGY_LEAD;
    const energyBank = lead > 0
      ? Math.acos(Math.max(0, Math.min(1, distToTarget / (distToTarget + lead))))
      : 0;

    const headingBank = Math.abs(headingErr * DEG * 2.5);
    let bankMag = Math.min(g.maxBank, Math.max(headingBank, energyBank));

    // Le signe suit l'ecart de cap, avec une hysteresis LARGE. Un seuil etroit
    // ferait basculer la gite en permanence : avec une vitesse de roulis finie,
    // le vehicule passerait son temps a traverser l'assiette a plat sans jamais
    // tenir d'inclinaison, et ne dissiperait rien. Il faut laisser le cap
    // s'ecarter de plusieurs degres pour que le virage en S soit reel.
    const flip = energyBank > 5 * DEG ? 5 : 0.4;
    if (headingErr > flip) this.bankSign = 1;
    else if (headingErr < -flip) this.bankSign = -1;
    else if (this.bankSign === undefined) this.bankSign = 1;

    // On ne relache la gite qu'au tout dernier moment : chaque seconde sans
    // correction laterale se paie en ecart lateral a l'impact.
    if (distToTarget < 6000) bankMag *= distToTarget / 6000;
    let bank = this.bankSign * bankMag;

    // --- Boucle longitudinale : incidence de finesse maximale ---
    //
    // Il serait tentant d'imposer une altitude et d'en deduire l'incidence
    // d'equilibre. C'est une erreur : a grande vitesse l'effet centrifuge
    // decharge tellement le vehicule que la portance requise devient minime,
    // l'incidence d'equilibre tombe vers 5°, et a cette incidence la trainee
    // axiale domine — la finesse s'effondre a 0.6 au lieu de 2.2.
    //
    // On fait donc l'inverse : on tient l'incidence de finesse maximale, et
    // c'est l'ALTITUDE qui s'ajuste toute seule. Le planeur descend jusqu'a
    // trouver la densite qui porte, puis continue de descendre lentement a
    // mesure qu'il ralentit. C'est le vol plane d'equilibre classique, et la
    // formule de portee ne vaut que dans ce regime.
    // L'incidence reste calee sur la finesse maximale : c'est la gite qui gere
    // l'energie. En virage il faut toutefois davantage de portance, donc une
    // incidence un peu plus forte pour ne pas s'enfoncer.
    const vVert = V.dot(up, vRelEst);
    let aoa = aoaForFinesse(this.veh, this.ldMax / Math.max(0.35, Math.cos(bankMag)));
    // Amortissement de la phugoide : sans ce terme le planeur rebondirait sur
    // l'atmosphere au lieu de s'y poser.
    aoa -= 1.2e-4 * vVert;

    // --- Plancher de corridor ---
    //
    // Le vol plane d'equilibre ne connait ni le flux thermique ni la charge :
    // il descend jusqu'a trouver la densite qui porte, et sur une rentree
    // rapide cela l'emmene beaucoup trop bas. On lui interdit donc le bas du
    // domaine, en cabrant a l'approche du plancher.
    //
    // Le supplement s'AJOUTE a l'incidence nominale au lieu de la remplacer :
    // hors du corridor il vaut zero et la boucle de finesse garde la main
    // entiere. On ne paie la contrainte que la ou elle mord.
    this.corridor = corridorFloor(speed, this.veh, this.limits, aoa);
    const rappel = corridorPullUp(altEst, vVert, this.corridor, this.limits.maxLoad,
        maxLiftAcceleration(altEst, speed, this.veh));
    aoa += rappel;
    this.corridor.pullUpDeg = rappel * RAD;
    this.corridor.marginM = altEst - this.corridor.alt;

    const reachable = equilibriumGlideRange(speed, g.minSpeed, this.glideFinesse);
    aoa = Math.max(2 * DEG, Math.min(g.maxAoA, aoa));

    // --- Fin du domaine de vol plane ---
    //
    // Le modele aerodynamique newtonien ne vaut qu'en hypersonique. En deca de
    // la vitesse plancher on cesse de porter et l'on pique : sans cette borne
    // le "planeur hypersonique" finirait sa course en plane subsonique sur des
    // centaines de kilometres, dans un regime ou ses coefficients n'ont plus
    // aucun sens — et la formule de portee, qui s'arrete elle aussi a cette
    // vitesse, cesserait de decrire ce qui se passe reellement.
    //
    // Cette borne ne s'applique PAS a l'interieur de la portee terminale : sur
    // les derniers kilometres, mieux vaut piloter avec un modele aerodynamique
    // approximatif que ne plus piloter du tout.
    // Sous la vitesse plancher, le modele newtonien cesse d'etre valide. On
    // cessait alors de piloter — et c'etait un trou : quand le planeur ralentit
    // encore loin du but, il tombait balistiquement sur les dernieres dizaines
    // de kilometres, et l'ecart final n'etait plus qu'une affaire de chance.
    // C'est ce trou qui produisait les points noirs isoles du balayage : selon
    // la portee, l'engin arrivait a la bonne place ou a trois kilometres.
    //
    // On applique donc ici le raisonnement deja tenu pour la phase terminale :
    // mieux vaut piloter avec un modele aerodynamique approximatif que ne plus
    // piloter du tout. La poursuite prend la main des que l'une OU l'autre
    // condition est remplie.
    const tropLent = speed < g.minSpeed;

    // --- Phase terminale : poursuite ---
    //
    // Laisser simplement retomber l'incidence a zero transformait la fin de vol
    // en piquee balistique : le vehicule cessait de piloter sur les 25 derniers
    // kilometres, et savoir precisement ou il se trouvait n'y changeait plus
    // rien. On le pilote donc jusqu'au bout, en pointant le vecteur vitesse sur
    // l'objectif — c'est du virage par la gite : l'incidence fixe l'intensite
    // de la portance, la gite en oriente le plan.
    if (distToTarget < TERMINAL_RANGE || tropLent) {
      this.phase = PHASE.TERMINAL;
      const aimEci = ecefToEci(this.aimEcef, t);
      const los = V.normalize(V.sub(aimEci, rEst));
      const vHat = V.normalize(vRelEst);

      // Correction a appliquer, perpendiculairement a la vitesse.
      const corr = V.rejectFrom(V.sub(los, vHat), vHat);
      const need = V.norm(corr);

      // Reperes du plan de manoeuvre : « au-dessus » et « a tribord ».
      const upPerp = V.normalize(V.rejectFrom(up, vHat));
      const rightPerp = V.cross(vHat, upPerp);

      aoa = Math.max(0, Math.min(g.maxAoA, TERMINAL_GAIN * need));
      // Une gite proche de 180° signifie voler sur le dos : c'est ainsi qu'un
      // corps porteur pousse vers le bas, et c'est le cas courant ici puisque
      // l'objectif est nettement sous le vecteur vitesse.
      bank = Math.atan2(V.dot(corr, rightPerp), V.dot(corr, upPerp));

      cmd.aoa = aoa;
      cmd.bank = bank;
      cmd.phase = this.phase;
      this.diagnostics = {
        distToTarget, aoaDeg: aoa * RAD, bankDeg: bank * RAD, speed,
        qDyn: qDynEst, pointingErrDeg: need * RAD, altEst,
      };
      return cmd;
    }
    // Si la cible est passee derriere, il est trop tard pour manoeuvrer :
    // mieux vaut piquer que boucler et s'en eloigner davantage.
    if (Math.abs(headingErr) > 100) {
      this.phase = PHASE.TERMINAL;
      aoa = 0;
      bank = 0;
    }

    aoa = Math.max(0, Math.min(g.maxAoA, aoa));

    cmd.aoa = aoa;
    cmd.bank = bank;
    cmd.phase = this.phase;
    const c = glideCoefficients(this.veh, Math.abs(aoa));
    this.diagnostics = {
      distToTarget, headingErr, aoaDeg: aoa * RAD, bankDeg: bank * RAD,
      speed, qDyn: qDynEst, reachable, altEst,
      glideReach: this.glideReach, excess,
      finesse: c.cd > 0 ? c.cl / c.cd : 0,
    };
    return cmd;
  }
}

/**
 * Finesse a tenir pour qu'un vol plane d'equilibre parcoure exactement
 * `distance` en partant de `vStart` et en s'arretant a `vEnd`.
 * C'est l'inversion directe de la formule de portee du plane.
 */
export function requiredFinesse(vStart, vEnd, distance) {
  const vc2 = EARTH.mu / EARTH.Rmean;
  const a = 1 - (vEnd * vEnd) / vc2;
  const b = 1 - (vStart * vStart) / vc2;
  if (a <= 0 || b <= 0 || a <= b) return Infinity;
  const denom = EARTH.Rmean * Math.log(a / b);
  return denom > 0 ? (2 * distance) / denom : Infinity;
}

/** Contraint `dir` a rester dans un cone d'angle `maxAngle` autour de `ref`. */
function clampToCone(dir, ref, maxAngle) {
  if (maxAngle >= Math.PI) return dir;
  const ang = V.angleBetween(dir, ref);
  if (ang <= maxAngle) return dir;
  const axis = V.cross(ref, dir);
  if (V.norm(axis) < 1e-9) return dir;
  return V.qRot(V.qFromAxisAngle(axis, maxAngle), ref);
}

/** Cap de la trace au sol [deg, 0 = Nord]. */
export function groundTrackHeading(rEci, vRel, t) {
  const lla = ecefToLla(eciToEcef(rEci, t));
  const vEcef = eciToEcef(vRel, t);
  const E = enuToEcef([1, 0, 0], lla.lat, lla.lon);
  const Nv = enuToEcef([0, 1, 0], lla.lat, lla.lon);
  return (Math.atan2(V.dot(vEcef, E), V.dot(vEcef, Nv)) * RAD + 360) % 360;
}
