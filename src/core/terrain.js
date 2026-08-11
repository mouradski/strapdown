// Champ de relief synthetique.
//
// POURQUOI SYNTHETIQUE
// La corrélation de terrain se localise en reconnaissant des accidents du
// relief de l'ordre de la centaine de metres. Une base d'altitude mondiale a
// cette resolution pese des gigaoctets : rien d'embarquable dans un navigateur.
// On genere donc un relief a la volee, deterministe et evaluable
// analytiquement en tout point, sans aucune donnee stockee.
//
// Ce relief n'est PAS celui de la Terre : les Alpes ne sont pas au bon endroit.
// Mais il est ancre sur les vraies cotes (via le masque terre/mer), et surtout
// il possede les proprietes qui decident du fonctionnement d'une correlation :
// des regions accidentees et des regions plates, avec des pentes realistes.
// C'est ce qui compte, car ce que l'on veut simuler n'est pas la geographie —
// c'est le fait qu'un recalage par le relief marche en montagne et echoue
// au-dessus d'une plaine ou de la mer.

import { DEG } from './constants.js';

/** Hachage entier 2D -> [0, 1). Deterministe, sans table. */
function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bruit de valeur, interpolation quintique (derivee continue). */
function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * Somme d'octaves. Avec un gain de 0.5 et une lacunarite de 2, chaque octave
 * contribue autant que les autres a la PENTE — c'est la signature en 1/f des
 * reliefs naturels, et c'est la pente qui permet a la correlation de localiser.
 */
function fbm(x, y, octaves, seed) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise(x * freq, y * freq, seed + i * 1013) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/**
 * Construit un champ de relief.
 * `isLand(lat, lon)` fixe ou se trouvent les terres ; en mer l'altitude est
 * nulle et parfaitement plate, ce qui rend toute correlation impossible.
 */
export function makeTerrain({ seed = 7, isLand = () => true } = {}) {
  // Coordonnees locales en kilometres. La deformation aux hautes latitudes est
  // sans consequence : seule compte la statistique locale du relief.
  const toKm = (lat, lon) => [lon * 111.32 * Math.cos(lat * DEG), lat * 110.57];

  /**
   * Caractere accidente de la region, de 0 (plaine) a 1 (montagne).
   * Longueur d'onde de l'ordre du millier de kilometres : on traverse donc
   * des massifs et des plaines au cours d'un meme vol.
   */
  function ruggedness(lat, lon) {
    if (!isLand(lat, lon)) return 0;
    const [x, y] = toKm(lat, lon);
    // On remappe dans [0, 1] au lieu de tronquer a zero : tronquer laissait la
    // moitie des terres parfaitement plates, et la correlation de relief n'y
    // fonctionnait donc quasiment jamais. L'exposant regle la proportion de
    // terrain accidente — ici environ un tiers, ordre de grandeur terrestre.
    return Math.pow(0.5 + 0.5 * fbm(x / 1400, y / 1400, 3, seed + 9001), 1.2);
  }

  /** Altitude du sol au-dessus du niveau de la mer [m]. */
  function elevation(lat, lon) {
    if (!isLand(lat, lon)) return 0;
    const [x, y] = toKm(lat, lon);
    const rug = ruggedness(lat, lon);
    // Une plaine garde quelques dizaines de metres d'ondulation, un massif
    // depasse les deux mille metres.
    const amp = 40 + 4000 * rug * rug;
    // Longueurs d'onde de 40 km a environ 300 m. C'est la partie FINE qui
    // porte l'information exploitable : tronquer le spectre au kilometre
    // rendait la correlation deux fois moins precise, alors qu'un relief
    // naturel a du contenu a toutes les echelles.
    return amp * (fbm(x / 40, y / 40, 8, seed) * 0.5 + 0.5);
  }

  /**
   * Carte embarquee : le relief tel que le calculateur le CROIT.
   * Son erreur est correlee spatialement, comme celle d'une vraie carte —
   * elle ne se moyenne donc pas en accumulant des mesures, et impose un
   * plancher de precision au recalage.
   */
  function mapElevation(lat, lon, mapError = 12) {
    const base = elevation(lat, lon);
    if (base === 0 && !isLand(lat, lon)) return 0;
    const [x, y] = toKm(lat, lon);
    return base + mapError * fbm(x / 6, y / 6, 2, seed + 4242);
  }

  /**
   * Relief filtre pour l'AFFICHAGE.
   *
   * Une texture de globe donne un pixel pour une dizaine de kilometres : y
   * echantillonner les octaves fines ne produit pas du relief mais du bruit
   * d'aliasing. On ne garde donc que les composantes que l'image peut
   * reellement resoudre. La valeur renvoyee sert a colorer, jamais a naviguer.
   */
  function displayElevation(lat, lon) {
    if (!isLand(lat, lon)) return { height: 0, rugged: 0 };
    const [x, y] = toKm(lat, lon);
    const rug = ruggedness(lat, lon);
    const amp = 40 + 4000 * rug * rug;
    return {
      height: amp * (fbm(x / 90, y / 90, 3, seed) * 0.5 + 0.5),
      rugged: rug,
    };
  }

  /** Pente locale [m/m], par differences finies. Sert au diagnostic. */
  function slope(lat, lon, stepKm = 0.5) {
    const dLat = stepKm / 110.57;
    const dLon = stepKm / (111.32 * Math.max(0.05, Math.cos(lat * DEG)));
    const ex = elevation(lat, lon + dLon) - elevation(lat, lon - dLon);
    const ey = elevation(lat + dLat, lon) - elevation(lat - dLat, lon);
    return Math.hypot(ex, ey) / (2 * stepKm * 1000);
  }

  return { elevation, mapElevation, displayElevation, ruggedness, slope, isLand, toKm };
}
