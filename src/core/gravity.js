// Champ de gravite terrestre.
//
// Deux niveaux de fidelite sont exposes volontairement : la simulation
// "verite terrain" utilise le modele J2, tandis que le calculateur embarque
// peut etre configure pour n'utiliser qu'un modele de masse ponctuelle.
// L'ecart entre les deux est une source d'erreur de navigation a part entiere,
// et c'est un levier de reglage interessant.

import { EARTH } from './constants.js';

/** Acceleration gravitationnelle en ECI, masse ponctuelle [m/s^2]. */
export function gravityPoint(r) {
  const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
  const rn = Math.sqrt(r2);
  const k = -EARTH.mu / (r2 * rn);
  return [k * r[0], k * r[1], k * r[2]];
}

/** Acceleration gravitationnelle en ECI avec l'aplatissement J2 [m/s^2]. */
export function gravityJ2(r) {
  const [x, y, z] = r;
  const r2 = x * x + y * y + z * z;
  const rn = Math.sqrt(r2);
  const k = -EARTH.mu / (r2 * rn);
  const zr2 = (z * z) / r2;
  const c = 1.5 * EARTH.J2 * (EARTH.a / rn) * (EARTH.a / rn);
  const fxy = 1 + c * (1 - 5 * zr2);
  const fz = 1 + c * (3 - 5 * zr2);
  return [k * x * fxy, k * y * fxy, k * z * fz];
}

/** Selecteur de modele : 'j2' ou 'point'. */
export function gravity(r, model = 'j2') {
  return model === 'point' ? gravityPoint(r) : gravityJ2(r);
}

/**
 * Gradient de gravite d(a)/d(r), modele de masse ponctuelle, en ligne-major 3x3.
 * Utilise par le filtre de Kalman : c'est ce terme qui couple l'erreur de
 * position a l'erreur de vitesse et qui produit l'oscillation de Schuler.
 */
export function gravityGradient(r) {
  const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
  const rn = Math.sqrt(r2);
  const k = EARTH.mu / (r2 * rn);
  const ux = r[0] / rn, uy = r[1] / rn, uz = r[2] / rn;
  return [
    k * (3 * ux * ux - 1), k * 3 * ux * uy, k * 3 * ux * uz,
    k * 3 * uy * ux, k * (3 * uy * uy - 1), k * 3 * uy * uz,
    k * 3 * uz * ux, k * 3 * uz * uy, k * (3 * uz * uz - 1),
  ];
}
