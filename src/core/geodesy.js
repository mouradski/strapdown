// Conversions de reperes et geometrie sur l'ellipsoide.
//
// Reperes utilises :
//   ECI  : inertiel geocentrique, axe Z = axe de rotation. C'est la que l'on integre.
//   ECEF : lie a la Terre, tourne a `omega`. C'est la que sont fixes les objectifs.
//   ENU  : local Est / Nord / Haut, pour l'affichage et l'orientation au sol.
//
// A t = 0 les deux reperes ECI et ECEF coincident (l'epoque absolue n'a aucune
// importance ici : il n'y a ni ephemeride ni visee astronomique reelle).

import { EARTH, DEG, RAD } from './constants.js';
import { cross, add, sub, normalize, dot, m3v, m3tv } from './vec.js';

/** Angle de rotation de la Terre depuis t = 0 [rad]. */
export const earthAngle = (t) => EARTH.omega * t;

/** ECEF -> ECI (rotation Rz(+theta)). */
export function ecefToEci(r, t) {
  const th = earthAngle(t);
  const c = Math.cos(th), s = Math.sin(th);
  return [c * r[0] - s * r[1], s * r[0] + c * r[1], r[2]];
}

/** ECI -> ECEF (rotation Rz(-theta)). */
export function eciToEcef(r, t) {
  const th = earthAngle(t);
  const c = Math.cos(th), s = Math.sin(th);
  return [c * r[0] + s * r[1], -s * r[0] + c * r[1], r[2]];
}

/** Vitesse ECEF -> ECI : il faut ajouter l'entrainement omega ^ r. */
export function velEcefToEci(vEcef, rEci, t) {
  const w = [0, 0, EARTH.omega];
  return add(ecefToEci(vEcef, t), cross(w, rEci));
}

/** Vitesse ECI -> ECEF (vitesse "sol"). */
export function velEciToEcef(vEci, rEci, t) {
  const w = [0, 0, EARTH.omega];
  return eciToEcef(sub(vEci, cross(w, rEci)), t);
}

/** Coordonnees geodesiques (deg, deg, m) -> ECEF. */
export function llaToEcef(latDeg, lonDeg, alt = 0) {
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  const sLat = Math.sin(lat), cLat = Math.cos(lat);
  const N = EARTH.a / Math.sqrt(1 - EARTH.e2 * sLat * sLat);
  return [
    (N + alt) * cLat * Math.cos(lon),
    (N + alt) * cLat * Math.sin(lon),
    (N * (1 - EARTH.e2) + alt) * sLat,
  ];
}

/**
 * ECEF -> geodesiques, methode de Bowring (non iterative).
 * Precision sub-millimetrique jusqu'a plusieurs rayons terrestres.
 */
export function ecefToLla(r) {
  const [x, y, z] = r;
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  if (p < 1e-9) {
    // Cas polaire : la longitude est indeterminee.
    const sign = z >= 0 ? 1 : -1;
    return { lat: sign * 90, lon: 0, alt: Math.abs(z) - EARTH.b };
  }
  const theta = Math.atan2(z * EARTH.a, p * EARTH.b);
  const st = Math.sin(theta), ct = Math.cos(theta);
  const lat = Math.atan2(
    z + EARTH.ep2 * EARTH.b * st * st * st,
    p - EARTH.e2 * EARTH.a * ct * ct * ct,
  );
  const sLat = Math.sin(lat);
  const N = EARTH.a / Math.sqrt(1 - EARTH.e2 * sLat * sLat);
  const alt = p / Math.cos(lat) - N;
  return { lat: lat * RAD, lon: lon * RAD, alt };
}

/** Position geodesique a partir d'un vecteur ECI et de la date. */
export function eciToLla(rEci, t) {
  return ecefToLla(eciToEcef(rEci, t));
}

/**
 * Matrice ENU -> ECEF pour un point (colonnes Est, Nord, Haut).
 * La transposee donne ECEF -> ENU.
 */
export function enuMatrix(latDeg, lonDeg) {
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  const sLat = Math.sin(lat), cLat = Math.cos(lat);
  const sLon = Math.sin(lon), cLon = Math.cos(lon);
  // Colonnes : E = (-sLon, cLon, 0), N = (-sLat cLon, -sLat sLon, cLat), U = (cLat cLon, cLat sLon, sLat)
  return [
    -sLon, -sLat * cLon, cLat * cLon,
    cLon, -sLat * sLon, cLat * sLon,
    0, cLat, sLat,
  ];
}

export const enuToEcef = (enu, latDeg, lonDeg) => m3v(enuMatrix(latDeg, lonDeg), enu);
export const ecefToEnu = (v, latDeg, lonDeg) => m3tv(enuMatrix(latDeg, lonDeg), v);

/** Distance orthodromique sur la sphere moyenne [m]. */
export function groundRange(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG, dl = (lon2 - lon1) * DEG;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH.Rmean * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Azimut initial de la route orthodromique 1 -> 2 [deg, 0 = Nord]. */
export function initialBearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * RAD + 360) % 360;
}

/**
 * Ecart lateral signe d'un point par rapport au grand cercle 1 -> 2 [m].
 * Positif a droite de la route. Sert a mesurer la deviation d'un impact
 * perpendiculairement au plan de tir, independamment de l'erreur en portee.
 */
export function crossTrackDistance(lat1, lon1, lat2, lon2, latP, lonP) {
  const d13 = groundRange(lat1, lon1, latP, lonP) / EARTH.Rmean;
  const th13 = initialBearing(lat1, lon1, latP, lonP) * DEG;
  const th12 = initialBearing(lat1, lon1, lat2, lon2) * DEG;
  return Math.asin(Math.max(-1, Math.min(1, Math.sin(d13) * Math.sin(th13 - th12)))) * EARTH.Rmean;
}

/** Distance horizontale approchee entre deux points proches, en projection locale [m]. */
export function localMiss(latA, lonA, latB, lonB) {
  const dLat = (latB - latA) * DEG * EARTH.Rmean;
  const dLon = (lonB - lonA) * DEG * EARTH.Rmean * Math.cos(((latA + latB) / 2) * DEG);
  return { north: dLat, east: dLon, dist: Math.hypot(dLat, dLon) };
}

/** Altitude geodesique d'un point ECI (au-dessus de l'ellipsoide) [m]. */
export function altitudeOf(rEci, t) {
  return ecefToLla(eciToEcef(rEci, t)).alt;
}

/**
 * Rayon de l'ellipsoide dans la direction du point, utilise par les modeles
 * embarques qui n'ont pas besoin de la precision geodesique complete.
 */
export function ellipsoidRadiusAt(rUnit) {
  const s2 = rUnit[2] * rUnit[2];
  return EARTH.a * Math.sqrt((1 - EARTH.e2) / (1 - EARTH.e2 * (1 - s2)));
}

/** Formatage lisible d'une coordonnee : 36.7538 N / 3.0588 E */
export function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}  ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

/** Vecteur unitaire "vertical local" (normale a l'ellipsoide) en ECI. */
export function localUpEci(rEci, t) {
  const lla = eciToLla(rEci, t);
  const up = enuToEcef([0, 0, 1], lla.lat, lla.lon);
  return normalize(ecefToEci(up, t));
}

/** Angle de pente (flight path angle) par rapport a l'horizontale locale [rad]. */
export function flightPathAngle(r, v) {
  const ru = normalize(r);
  const vu = normalize(v);
  return Math.asin(Math.max(-1, Math.min(1, dot(ru, vu))));
}
