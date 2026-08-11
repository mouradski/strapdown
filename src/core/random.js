// Generateur pseudo-aleatoire deterministe.
// Le tirage doit etre reproductible : sans graine, deux tirs identiques
// donneraient des impacts differents et il serait impossible de savoir si un
// ecart vient d'un reglage ou du bruit. Le mode Monte-Carlo fait au contraire
// varier la graine a chaque tir pour explorer la dispersion.

/** PRNG mulberry32 : rapide, periode 2^32, largement suffisant ici. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare = null;
  /** Tirage normal centre reduit (Box-Muller, forme polaire). */
  const gauss = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u, v, s;
    do {
      u = next() * 2 - 1;
      v = next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };

  return {
    next,
    gauss,
    /** Tirage normal de moyenne mu et d'ecart-type sigma. */
    normal: (mu = 0, sigma = 1) => mu + sigma * gauss(),
    /** Vecteur 3D dont chaque composante est normale N(0, sigma). */
    gauss3: (sigma = 1) => [sigma * gauss(), sigma * gauss(), sigma * gauss()],
    /** Tirage uniforme dans [lo, hi]. */
    range: (lo, hi) => lo + (hi - lo) * next(),
  };
}
