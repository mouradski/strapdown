// Atmosphere standard US 1976.
// Modele en couches jusqu'a 86 km, puis interpolation logarithmique sur la
// table publiee jusqu'a 1000 km. Au-dela de ~120 km la trainee est negligeable
// pour ce simulateur, mais la continuite du modele evite des a-coups.

import { AIR, G0 } from './constants.js';

// [altitude geopotentielle de base (m), temperature (K), gradient (K/m), pression (Pa)]
const LAYERS = [
  [0, 288.15, -0.0065, 101325],
  [11000, 216.65, 0.0, 22632.06],
  [20000, 216.65, 0.001, 5474.889],
  [32000, 228.65, 0.0028, 868.0187],
  [47000, 270.65, 0.0, 110.9063],
  [51000, 270.65, -0.0028, 66.93887],
  [71000, 214.65, -0.002, 3.956420],
  [84852, 186.946, 0.0, 0.3733836],
];

// Densite (kg/m^3) au-dessus de 86 km, altitude geometrique en m.
const HIGH = [
  [86000, 6.958e-6], [90000, 3.416e-6], [100000, 5.604e-7], [110000, 9.708e-8],
  [120000, 2.222e-8], [130000, 8.152e-9], [150000, 2.076e-9], [180000, 5.194e-10],
  [200000, 2.541e-10], [250000, 6.073e-11], [300000, 1.916e-11], [400000, 2.803e-12],
  [500000, 5.215e-13], [600000, 1.137e-13], [800000, 1.136e-14], [1000000, 3.561e-15],
];

const RE = 6356766; // rayon terrestre effectif de l'atmosphere standard [m]
const geopotential = (z) => (RE * z) / (RE + z);

/**
 * Etat de l'atmosphere a l'altitude geometrique z [m].
 * Renvoie { rho, T, p, a } (densite, temperature, pression, vitesse du son).
 */
export function atmosphere(z) {
  if (z <= 0) return sample(0);
  if (z >= 1000000) return { rho: 0, T: 186.946, p: 0, a: 274 };
  if (z <= 86000) return sample(z);

  // Interpolation log-lineaire sur la table haute.
  let i = 0;
  while (i < HIGH.length - 2 && z > HIGH[i + 1][0]) i++;
  const [z0, r0] = HIGH[i];
  const [z1, r1] = HIGH[i + 1];
  const f = (z - z0) / (z1 - z0);
  const rho = Math.exp(Math.log(r0) + f * (Math.log(r1) - Math.log(r0)));
  // Au-dessus de 86 km la notion de vitesse du son n'a plus de sens pratique :
  // on garde une valeur constante pour que le nombre de Mach reste borne.
  const T = 186.946;
  return { rho, T, p: rho * AIR.R * T, a: Math.sqrt(AIR.gamma * AIR.R * T) };
}

function sample(z) {
  const h = geopotential(z);
  let i = 0;
  while (i < LAYERS.length - 1 && h > LAYERS[i + 1][0]) i++;
  const [hb, Tb, L, Pb] = LAYERS[i];
  const dh = h - hb;
  let T, p;
  if (L === 0) {
    T = Tb;
    p = Pb * Math.exp((-G0 * dh) / (AIR.R * Tb));
  } else {
    T = Tb + L * dh;
    p = Pb * Math.pow(T / Tb, -G0 / (AIR.R * L));
  }
  const rho = p / (AIR.R * T);
  return { rho, T, p, a: Math.sqrt(AIR.gamma * AIR.R * T) };
}

/** Densite seule, chemin rapide utilise dans la boucle d'integration. */
export function density(z) {
  return atmosphere(z).rho;
}

/**
 * Pression dynamique [Pa] et nombre de Mach pour une vitesse relative a l'air.
 */
export function dynamicPressure(z, vRel) {
  const { rho, a } = atmosphere(z);
  return { q: 0.5 * rho * vRel * vRel, mach: vRel / a, rho };
}
