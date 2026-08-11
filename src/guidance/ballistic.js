// Solution balistique : probleme de Gauss et propagation en vol libre.
//
// Le probleme de Gauss (ou probleme de Lambert) consiste a trouver l'orbite
// qui passe par deux points donnes. C'est exactement la question que se pose
// le calculateur : « depuis ou je suis, quelle vitesse me faut-il pour
// retomber sur la cible ? »
//
// On utilise l'iteration sur le parametre p (le demi-latus rectum), telle
// qu'exposee dans les traites classiques d'astrodynamique. C'est la meme
// mathematique que pour un transfert orbital ou une trajectoire de sonde :
// rien de specifique a un engin militaire.

import { EARTH } from '../core/constants.js';
import * as V from '../core/vec.js';
import { gravity } from '../core/gravity.js';
import { atmosphere } from '../core/atmosphere.js';
import { ecefToEci, eciToEcef, ecefToLla, llaToEcef, groundRange } from '../core/geodesy.js';
import { rk4 } from '../core/integrator.js';

/**
 * Resout l'orbite passant par r1 et r2 pour un parametre p donne.
 * Renveoie null si p est hors du domaine admissible.
 */
export function gaussFromP(r1v, r2v, p) {
  const r1 = V.norm(r1v);
  const r2 = V.norm(r2v);
  const cosDnu = Math.max(-1, Math.min(1, V.dot(r1v, r2v) / (r1 * r2)));
  const sinDnu = Math.sqrt(Math.max(0, 1 - cosDnu * cosDnu));
  if (sinDnu < 1e-12) return null; // points confondus ou diametralement opposes

  const k = r1 * r2 * (1 - cosDnu);
  const l = r1 + r2;
  const m = r1 * r2 * (1 + cosDnu);

  const denom = (2 * m - l * l) * p * p + 2 * k * l * p - k * k;
  if (Math.abs(denom) < 1e-30) return null;
  const a = (m * k * p) / denom;

  const f = 1 - (r2 / p) * (1 - cosDnu);
  const g = (r1 * r2 * sinDnu) / Math.sqrt(EARTH.mu * p);
  if (!Number.isFinite(g) || Math.abs(g) < 1e-12) return null;
  const gdot = 1 - (r1 / p) * (1 - cosDnu);
  const fdot = Math.sqrt(EARTH.mu / p) * Math.tan(Math.acos(cosDnu) / 2)
    * ((1 - cosDnu) / p - 1 / r1 - 1 / r2);

  const v1 = V.scale(V.sub(r2v, V.scale(r1v, f)), 1 / g);
  const v2 = V.add(V.scale(r1v, fdot), V.scale(v1, gdot));

  // Temps de vol par l'equation de Kepler.
  let tof;
  if (a > 0) {
    const cosDE = 1 - (r1 / a) * (1 - f);
    const sinDE = (-r1 * r2 * fdot) / Math.sqrt(EARTH.mu * a);
    let dE = Math.atan2(sinDE, cosDE);
    if (dE < 0) dE += 2 * Math.PI;
    tof = g + Math.sqrt((a * a * a) / EARTH.mu) * (dE - Math.sin(dE));
  } else {
    const coshDH = 1 + ((f - 1) * r1) / a;
    if (coshDH < 1) return null;
    const dH = Math.acosh(coshDH);
    tof = g + Math.sqrt((-a) ** 3 / EARTH.mu) * (Math.sinh(dH) - dH);
  }
  if (!Number.isFinite(tof) || tof <= 0) return null;

  // Apogee de l'orbite obtenue (utile pour choisir le degre de cloche).
  const energy = 0.5 * V.norm2(v1) - EARTH.mu / r1;
  const hVec = V.cross(r1v, v1);
  const hMag = V.norm(hVec);
  const ecc = Math.sqrt(Math.max(0, 1 + (2 * energy * hMag * hMag) / (EARTH.mu * EARTH.mu)));
  const apogee = a > 0 ? a * (1 + ecc) - EARTH.Rmean : Infinity;

  return { v1, v2, tof, a, p, apogee, ecc, energy, speed: V.norm(v1) };
}

/** Borne inferieure du parametre p pour un transfert de moins d'un demi-tour. */
export function pBounds(r1v, r2v) {
  const r1 = V.norm(r1v);
  const r2 = V.norm(r2v);
  const cosDnu = Math.max(-1, Math.min(1, V.dot(r1v, r2v) / (r1 * r2)));
  const k = r1 * r2 * (1 - cosDnu);
  const l = r1 + r2;
  const m = r1 * r2 * (1 + cosDnu);
  const s2m = Math.sqrt(2 * m);
  return { pMin: k / (l + s2m), pMax: k / Math.max(l - s2m, 1e-9), k, l, m };
}

/**
 * Trajectoire d'energie minimale entre deux points : c'est celle qui demande
 * la plus petite vitesse initiale, donc la portee maximale pour un vecteur
 * donne. On la trouve par section doree sur p, la vitesse requise etant
 * unimodale sur le domaine admissible.
 */
export function gaussMinEnergy(r1v, r2v) {
  const { pMin, pMax } = pBounds(r1v, r2v);
  let lo = pMin * 1.0000001;
  let hi = Number.isFinite(pMax) && pMax > lo ? pMax * 0.9999999 : pMin * 40;

  const speedAt = (p) => {
    const s = gaussFromP(r1v, r2v, p);
    return s ? s.speed : Infinity;
  };

  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let fc = speedAt(c), fd = speedAt(d);
  for (let i = 0; i < 90; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = speedAt(c); }
    else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = speedAt(d); }
  }
  return gaussFromP(r1v, r2v, 0.5 * (a + b));
}

/**
 * Trajectoire en cloche : meme couple de points, mais apogee plus haute et
 * vitesse requise plus grande. `loft` va de 0 (energie minimale) a 1 (cloche
 * prononcee). Au-dela de p_energie-min l'apogee croit de facon monotone, ce
 * qui permet une simple dichotomie.
 */
export function gaussLofted(r1v, r2v, loft) {
  const me = gaussMinEnergy(r1v, r2v);
  if (!me || loft <= 1e-6) return me;

  const { pMin } = pBounds(r1v, r2v);
  const targetApogee = me.apogee * (1 + 2.2 * loft) + 60000 * loft;

  // L'apogee croit quand p diminue vers pMin : c'est la branche "haute".
  let lo = pMin * 1.0000001;
  let hi = me.p;
  let best = me;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    const s = gaussFromP(r1v, r2v, mid);
    if (!s) { lo = mid; continue; }
    best = s;
    if (s.apogee > targetApogee) lo = mid; else hi = mid;
  }
  return best;
}

/**
 * Solution de tir complete : tient compte de la rotation de la Terre pendant
 * le vol. La cible est fixe au sol, donc sa position inertielle depend du
 * temps de vol — lequel depend de la trajectoire choisie. On itere.
 */
export function solveIntercept(r1Eci, targetEcef, t0, loft = 0, iterations = 12) {
  const groundDist = groundRange(
    ...(() => { const a = ecefToLla(eciToEcef(r1Eci, t0)); return [a.lat, a.lon]; })(),
    ...(() => { const b = ecefToLla(targetEcef); return [b.lat, b.lon]; })(),
  );
  // Premiere estimation du temps de vol : ordre de grandeur balistique.
  let tof = Math.max(120, 1.9 * Math.sqrt(groundDist));
  let sol = null;

  for (let i = 0; i < iterations; i++) {
    const r2Eci = ecefToEci(targetEcef, t0 + tof);
    const s = loft > 1e-6 ? gaussLofted(r1Eci, r2Eci, loft) : gaussMinEnergy(r1Eci, r2Eci);
    if (!s) return sol;
    sol = s;
    const delta = s.tof - tof;
    // Amortissement : l'iteration nue peut osciller sur les grandes portees.
    tof += 0.7 * delta;
    if (Math.abs(delta) < 0.01) break;
  }
  if (sol) sol.tof = tof;
  return sol;
}

/**
 * Propagation en vol libre jusqu'a l'impact, avec trainee.
 *
 * Sert a deux choses : au calculateur pour predire ou il va tomber (et donc
 * corriger sa visee), et a l'affichage pour montrer le point d'impact prevu.
 * Le pas d'integration s'adapte : grand dans le vide, fin dans l'atmosphere.
 */
export function predictImpact(r0, v0, t0, opts = {}) {
  const {
    ballisticCoef = 4000,
    gravityModel = 'j2',
    maxTime = 4000,
    groundAlt = 0,
    // Modele de corps porteur. Quand il est fourni, la propagation applique
    // la portance du vol plane au lieu de la seule trainee balistique, avec
    // exactement la loi que suivra le guidage : incidence de finesse maximale,
    // sans gite. La prediction represente donc la portee MAXIMALE atteignable,
    // ce qui garantit que l'extinction laisse un exces d'energie plutot qu'un
    // deficit — le premier se dissipe en virages, le second est irrattrapable.
    // { area, mass, cl, cd, pullUpAlt, minSpeed }
    glide = null,
    // Altitude d'arret : la propagation cesse a la traversee DESCENDANTE de
    // ce niveau. Sert au planeur, dont la trajectoire cesse d'etre balistique
    // au moment de la ressource.
    stopAlt = null,
  } = opts;

  const omega = [0, 0, EARTH.omega];
  const deriv = (t, y) => {
    const r = [y[0], y[1], y[2]];
    const v = [y[3], y[4], y[5]];
    const g = gravity(r, gravityModel);
    const alt = ecefToLla(eciToEcef(r, t)).alt;
    let a = g;
    if (alt < 130000) {
      const vRel = V.sub(v, V.cross(omega, r));
      const vm = V.norm(vRel);
      const rho = atmosphere(alt).rho;
      if (vm > 1 && rho > 1e-13) {
        const up = V.normalize(r);
        // Le regime de plane est determine par le seul etat courant : sous
        // l'altitude de ressource, au-dessus de la vitesse plancher, et en
        // descente (ou deja bien engage sous l'altitude de ressource).
        const gliding = glide
          && alt <= glide.pullUpAlt
          && vm >= glide.minSpeed
          && (V.dot(up, vRel) < 0 || alt < glide.pullUpAlt - 5000);

        if (gliding) {
          const qS = 0.5 * rho * vm * vm * glide.area;
          a = V.add(a, V.scale(vRel, -(qS * glide.cd) / glide.mass / vm));
          // Portance dans le plan vertical, perpendiculaire au vent relatif.
          const lDir = V.normalize(V.rejectFrom(up, V.scale(vRel, 1 / vm)));
          a = V.add(a, V.scale(lDir, (qS * glide.cl) / glide.mass));
        } else {
          const dec = (0.5 * rho * vm * vm) / ballisticCoef;
          a = V.add(a, V.scale(vRel, -dec / vm));
        }
      }
    }
    return [v[0], v[1], v[2], a[0], a[1], a[2]];
  };

  let y = [...r0, ...v0];
  let t = t0;
  let apogee = -Infinity;
  let apogeeTime = t0;
  const trace = [];

  let stoppedAtAlt = false;
  while (t - t0 < maxTime) {
    const r = [y[0], y[1], y[2]];
    const alt = ecefToLla(eciToEcef(r, t)).alt;
    if (alt > apogee) { apogee = alt; apogeeTime = t; }
    if (alt <= groundAlt && t > t0 + 1) break;
    // Arret a la traversee descendante du niveau demande.
    if (stopAlt !== null && alt <= stopAlt
      && V.dot(V.normalize(r), [y[3], y[4], y[5]]) < 0 && t > t0 + 1) {
      stoppedAtAlt = true;
      break;
    }

    // Pas adapte au regime : fin la ou la trainee agit, large dans le vide.
    // Le mode grossier sert aux predictions repetees du guidage, ou seule la
    // variation d'une prediction a l'autre compte.
    const dt = opts.coarse
      ? (alt > 140000 ? 10 : alt > 60000 ? 2 : 0.5)
      : (alt > 140000 ? 4 : alt > 60000 ? 1 : 0.2);

    if (opts.trace && trace.length < 4000) trace.push({ t, r: V.clone(r), alt });

    const next = rk4(deriv, t, y, dt);
    const altNext = ecefToLla(eciToEcef([next[0], next[1], next[2]], t + dt)).alt;
    if (altNext <= groundAlt && t + dt > t0 + 1) {
      // Raffinement de l'instant d'impact par dichotomie.
      let lo = 0, hi = dt;
      for (let i = 0; i < 30; i++) {
        const mid = 0.5 * (lo + hi);
        const ym = rk4(deriv, t, y, mid);
        const am = ecefToLla(eciToEcef([ym[0], ym[1], ym[2]], t + mid)).alt;
        if (am > groundAlt) lo = mid; else hi = mid;
      }
      y = rk4(deriv, t, y, 0.5 * (lo + hi));
      t += 0.5 * (lo + hi);
      break;
    }
    y = next;
    t += dt;
  }

  const rImp = [y[0], y[1], y[2]];
  const vImp = [y[3], y[4], y[5]];
  const ecef = eciToEcef(rImp, t);
  return {
    r: rImp, v: vImp, t, tof: t - t0,
    ecef, lla: ecefToLla(ecef),
    apogee, apogeeTime,
    impactSpeed: V.norm(vImp),
    stoppedAtAlt,
    alt: ecefToLla(ecef).alt,
    trace,
  };
}

/**
 * Corrige le point vise pour compenser tout ce que la solution keplerienne
 * ignore — d'abord la trainee de rentree, qui raccourcit systematiquement la
 * portee. On simule, on mesure l'ecart, on decale la visee d'autant, et on
 * recommence. Deux ou trois iterations suffisent.
 */
export function correctAimPoint(r1Eci, targetEcef, t0, loft, predictOpts, iterations = 4) {
  const targetLla = ecefToLla(targetEcef);
  let aimEcef = V.clone(targetEcef);
  let sol = null;
  let impact = null;

  for (let i = 0; i < iterations; i++) {
    sol = solveIntercept(r1Eci, aimEcef, t0, loft);
    if (!sol) return null;
    impact = predictImpact(r1Eci, sol.v1, t0, predictOpts);

    const impLla = impact.lla;
    const dLat = targetLla.lat - impLla.lat;
    const dLon = targetLla.lon - impLla.lon;
    if (Math.abs(dLat) < 1e-7 && Math.abs(dLon) < 1e-7) break;

    const aimLla = ecefToLla(aimEcef);
    aimEcef = llaToEcef(aimLla.lat + dLat, aimLla.lon + dLon, targetLla.alt);
  }

  return { aimEcef, solution: sol, impact };
}
