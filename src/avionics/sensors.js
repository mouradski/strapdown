// Modules capteurs.
//
// C'est ici que se joue tout l'interet du simulateur. Sans recalage satellite,
// le calculateur ne connait sa position que par integration de ce que lui
// racontent ses capteurs. Or aucun capteur n'est parfait :
//
//   - le gyrometre a un biais, donc l'attitude estimee derive lentement ;
//   - une attitude fausse fait projeter l'acceleration dans la mauvaise
//     direction, ce qui cree une erreur de vitesse qui croit en t ;
//   - l'erreur de position, elle, croit alors en t^2 pour le biais
//     accelerometrique, et en t^3 pour le biais gyrometrique.
//
// C'est ce dernier terme qui domine sur un vol long, et c'est pour cela que
// la qualite du gyrometre pese bien plus lourd que celle de l'accelerometre.
//
// Les recalages (altimetre, viseur stellaire, correlation de terrain) servent
// a couper cette croissance. Aucun n'utilise de constellation satellite.

import * as V from '../core/vec.js';
import { eciToEcef, ecefToLla, enuToEcef, llaToEcef } from '../core/geodesy.js';
import { atmosphere } from '../core/atmosphere.js';

// --- Conversions d'unites vers le systeme international ---
export const U = {
  degPerHour: (Math.PI / 180) / 3600, // -> rad/s
  degPerSqrtHour: (Math.PI / 180) / 60, // -> rad/sqrt(s)
  microG: 9.80665e-6, // -> m/s^2
  mPerSPerSqrtHour: 1 / 60, // -> m/s/sqrt(s)
  arcmin: (Math.PI / 180) / 60, // -> rad
  arcsec: (Math.PI / 180) / 3600, // -> rad
  ppm: 1e-6,
};

/**
 * Classes de centrale inertielle. Ce sont les categories usuelles de la
 * litterature ouverte en navigation ; les valeurs sont indicatives et servent
 * de points de depart reglables.
 */
export const IMU_GRADES = {
  consumer: {
    gyroBias: 150, gyroARW: 1.5, gyroBiasWalk: 30, gyroScale: 5000,
    accelBias: 4000, accelVRW: 0.4, accelBiasWalk: 500, accelScale: 5000,
    alignment: 40,
  },
  tactical: {
    gyroBias: 1.0, gyroARW: 0.08, gyroBiasWalk: 0.3, gyroScale: 300,
    accelBias: 250, accelVRW: 0.05, accelBiasWalk: 40, accelScale: 300,
    alignment: 5,
  },
  navigation: {
    gyroBias: 0.01, gyroARW: 0.002, gyroBiasWalk: 0.003, gyroScale: 20,
    accelBias: 25, accelVRW: 0.015, accelBiasWalk: 5, accelScale: 30,
    alignment: 0.5,
  },
  strategic: {
    gyroBias: 0.0005, gyroARW: 0.0002, gyroBiasWalk: 0.0002, gyroScale: 2,
    accelBias: 1.5, accelVRW: 0.004, accelBiasWalk: 0.3, accelScale: 4,
    alignment: 0.05,
  },
};

/**
 * Unite de mesure inertielle.
 *
 * Les biais sont tires une fois pour toutes au demarrage : sur un vol donne
 * un biais est une constante inconnue, pas un bruit. C'est precisement ce qui
 * le rend estimable par le filtre — et redoutable s'il ne l'est pas.
 */
export class IMU {
  constructor(cfg, rng) {
    this.cfg = cfg;
    this.rng = rng;

    const gb = cfg.gyroBias * U.degPerHour;
    const ab = cfg.accelBias * U.microG;
    this.biasGyro = rng.gauss3(gb);
    this.biasAccel = rng.gauss3(ab);

    // Erreurs de facteur d'echelle, constantes elles aussi.
    this.scaleGyro = rng.gauss3(cfg.gyroScale * U.ppm);
    this.scaleAccel = rng.gauss3(cfg.accelScale * U.ppm);

    // Coefficients de bruit blanc et de marche aleatoire des biais.
    this.arw = cfg.gyroARW * U.degPerSqrtHour;
    this.vrw = cfg.accelVRW * U.mPerSPerSqrtHour;
    // Le biais derive d'autant sur une heure : on convertit en rad/s/sqrt(s).
    this.gyroWalk = (cfg.gyroBiasWalk * U.degPerHour) / 60;
    this.accelWalk = (cfg.accelBiasWalk * U.microG) / 60;

    this.alignmentSigma = cfg.alignment * U.arcmin;
  }

  /**
   * Erreur d'alignement initial : le calculateur ne connait pas exactement
   * l'orientation de la centrale au moment du lancement. Sur un tir long,
   * quelques minutes d'arc suffisent a manquer la cible de plusieurs km.
   */
  initialAlignmentError() {
    return this.rng.gauss3(this.alignmentSigma);
  }

  /**
   * Mesure la force specifique et la vitesse de rotation vraies, et renvoie
   * ce que le capteur en rapporte. `dt` sert a l'echelle du bruit blanc :
   * un bruit blanc echantillonne sur un pas court est plus grand, de sorte
   * que la marche aleatoire integree ne depende pas du pas de calcul.
   */
  measure(fBodyTrue, wBodyTrue, dt) {
    const sdt = Math.sqrt(Math.max(dt, 1e-9));

    // Marche aleatoire des biais.
    for (let i = 0; i < 3; i++) {
      this.biasGyro[i] += this.gyroWalk * sdt * this.rng.gauss();
      this.biasAccel[i] += this.accelWalk * sdt * this.rng.gauss();
    }

    const f = new Array(3);
    const w = new Array(3);
    for (let i = 0; i < 3; i++) {
      f[i] = fBodyTrue[i] * (1 + this.scaleAccel[i])
        + this.biasAccel[i]
        + (this.vrw / sdt) * this.rng.gauss();
      w[i] = wBodyTrue[i] * (1 + this.scaleGyro[i])
        + this.biasGyro[i]
        + (this.arw / sdt) * this.rng.gauss();
    }
    // Derniere mesure BRUTE, telle que la centrale la recoit. C'est ce que
    // l'affichage de telemetrie montre : la sortie du capteur, avant toute
    // correction de biais par le filtre.
    this.lastSample = { f, w };
    return { f, w };
  }
}

/**
 * Altimetre barometrique et/ou radar.
 *
 * Le barometre mesure une pression et la convertit en altitude : il est donc
 * sensible a l'ecart entre l'atmosphere reelle et l'atmosphere standard, ce
 * qu'on modelise par un biais tire au depart. Le radioaltimetre est plus
 * precis mais ne porte qu'a basse altitude.
 */
export class Altimeter {
  constructor(cfg, rng) {
    this.cfg = cfg;
    this.rng = rng;
    // Biais du modele d'atmosphere : constant sur le vol.
    this.baroBias = rng.normal(0, cfg.baroBias ?? 60);
    this.last = -1e9;
  }

  /** Renvoie { alt, sigma } ou null si aucune mesure n'est disponible. */
  sample(t, altTrue) {
    const c = this.cfg;
    if (!c.enabled) return null;
    if (t - this.last < (c.period ?? 1)) return null;

    let sigma, bias;
    if (c.radarEnabled && altTrue <= (c.radarMaxAlt ?? 15000)) {
      // Le radioaltimetre mesure une hauteur/sol vraie : pas de biais modele.
      sigma = c.radarSigma ?? 8;
      bias = 0;
    } else if (altTrue <= (c.baroMaxAlt ?? 32000)) {
      sigma = c.baroSigma ?? 120;
      bias = this.baroBias;
      // Au-dela de la stratosphere la pression devient trop faible pour etre
      // exploitable : la mesure se degrade rapidement.
      const p = atmosphere(altTrue).p;
      if (p < 20) sigma *= 20 / Math.max(p, 1);
    } else {
      return null;
    }

    this.last = t;
    const value = altTrue + bias + this.rng.normal(0, sigma);
    // Trace pour l'affichage : quelle voie a repondu, et avec quelle valeur.
    this.lastSample = {
      t, alt: value, sigma,
      source: (c.radarEnabled && altTrue <= (c.radarMaxAlt ?? 15000)) ? 'radar' : 'baro',
    };
    return { alt: value, sigma };
  }
}

/**
 * Viseur stellaire (navigation stellaire-inertielle).
 *
 * Mesure l'attitude par rapport aux etoiles. Il ne donne aucune position,
 * mais il supprime la derive d'attitude — donc le terme en t^3 de l'erreur de
 * position, qui est le plus penalisant. C'est le recalage le plus rentable
 * pour un vol sans satellite, et il fonctionne d'autant mieux qu'on est haut :
 * il faut etre au-dessus de l'atmosphere dense pour voir les etoiles.
 */
export class StarTracker {
  constructor(cfg, rng) {
    this.cfg = cfg;
    this.rng = rng;
    this.last = -1e9;
    this.fixes = 0;
  }

  available(altTrue) {
    return this.cfg.enabled && altTrue >= (this.cfg.minAlt ?? 45000);
  }

  /**
   * Renvoie { q, sigma } : l'attitude mesuree (bruitee) et son incertitude,
   * ou null si la visee n'est pas possible.
   */
  sample(t, altTrue, qTrue) {
    if (!this.available(altTrue)) return null;
    if (t - this.last < (this.cfg.period ?? 10)) return null;
    this.last = t;
    this.fixes++;
    const sigma = (this.cfg.sigma ?? 8) * U.arcsec;
    const err = this.rng.gauss3(sigma);
    this.lastSample = { t, sigmaArcsec: sigma / U.arcsec, altTrue };
    return { q: V.qNormalize(V.qMul(V.qFromRotVec(err), qTrue)), sigma };
  }
}

/**
 * Correlation de terrain.
 *
 * Compare le relief survole a une carte embarquee et en deduit une position
 * horizontale. Ne fonctionne qu'au-dessus des terres et dans une tranche
 * d'altitude ou le relief reste discernable ; inutile au-dessus de la mer ou
 * d'une plaine sans signature. C'est le seul module qui donne une VRAIE
 * position sans satellite, d'ou son interet en phase terminale.
 */
export class TerrainCorrelator {
  constructor(cfg, rng, terrain) {
    this.cfg = cfg;
    this.rng = rng;
    this.terrain = terrain;
    this.profile = []; // echantillons { lat, lon, ground } le long de la route
    this.lastFix = -1e9;
    this.fixes = 0;
    this.rejected = 0;
    this.lastSigma = null;
    this.lastRuggedness = null;
  }

  inBand(altTrue) {
    const c = this.cfg;
    return c.enabled
      && altTrue <= (c.maxAlt ?? 32000)
      && altTrue >= (c.minAlt ?? 300);
  }

  /**
   * Un pas de mesure : le radioaltimetre sonde la hauteur/sol SOUS LA POSITION
   * VRAIE, tandis que le calculateur enregistre cette mesure en face de la
   * position qu'il CROIT occuper. C'est ce decalage entre les deux qui rend la
   * correlation capable de retrouver l'erreur de navigation.
   */
  observe(altTrueMsl, trueLla, navLla) {
    if (!this.inBand(altTrueMsl)) return;

    // Espacement en DISTANCE et non en temps : la longueur du profil, donc son
    // pouvoir de localisation, ne doit pas dependre de la vitesse.
    const step = this.cfg.sampleStep ?? 400;
    const last = this.profile[this.profile.length - 1];
    if (last) {
      const d = Math.hypot(
        (navLla.lat - last.lat) * 110570,
        (navLla.lon - last.lon) * 111320 * Math.cos(navLla.lat * Math.PI / 180),
      );
      if (d < step) return;
    }

    const hGround = this.terrain.elevation(trueLla.lat, trueLla.lon);
    const noise = this.rng.normal(0, this.cfg.radarSigma ?? 6);
    const agl = altTrueMsl - hGround + noise;
    // Le calculateur soustrait sa PROPRE altitude : une erreur d'altitude
    // decale tout le profil d'une constante, que la correlation eliminera.
    this.profile.push({ lat: navLla.lat, lon: navLla.lon, ground: navLla.alt - agl });

    const n = this.cfg.samples ?? 20;
    while (this.profile.length > n) this.profile.shift();
  }

  /**
   * Correlation proprement dite : on fait glisser le profil mesure sur la carte
   * embarquee et l'on cherche le decalage qui les fait coincider. La precision
   * n'est PAS un reglage — elle se deduit de la nettete du minimum trouve,
   * donc du relief reellement survole. Au-dessus d'une plaine ou de la mer,
   * tous les decalages se valent, le minimum est plat, et le recalage est
   * rejete de lui-meme.
   *
   * Renvoie { rEcef, sigma } ou null.
   */
  correlate(t, navLla, navSigma) {
    const c = this.cfg;
    if (!c.enabled) return null;
    const n = c.samples ?? 20;
    if (this.profile.length < n) return null;
    if (t - this.lastFix < (c.period ?? 6)) return null;
    this.lastFix = t;

    const mapError = c.mapError ?? 12;
    const measured = this.profile.map((p) => p.ground);
    const meanMeasured = measured.reduce((a, b) => a + b, 0) / n;

    const mPerDegLat = 110570;
    const mPerDegLon = 111320 * Math.cos(navLla.lat * Math.PI / 180);

    // Somme des ecarts quadratiques entre profil mesure et carte, pour un
    // decalage donne. Les deux profils sont centres : un biais d'altitude
    // commun n'influence donc pas le resultat.
    // `stride` permet de ne prendre qu'un point sur k : la passe grossiere
    // n'a pas besoin de tout le profil pour designer le bon bassin, et c'est
    // elle qui domine le cout.
    const ssd = (dE, dN, stride = 1) => {
      let sum = 0, mean = 0, count = 0;
      const pred = [];
      for (let i = 0; i < n; i += stride) {
        const p = this.profile[i];
        const v = this.terrain.mapElevation(
          p.lat + dN / mPerDegLat,
          p.lon + dE / mPerDegLon,
          mapError,
        );
        pred.push(v);
        mean += v;
        count++;
      }
      mean /= count;
      for (let k = 0, i = 0; i < n; i += stride, k++) {
        const r = (pred[k] - mean) - (measured[i] - meanMeasured);
        sum += r * r;
      }
      return sum;
    };

    // Etendue de la recherche : inutile de ratisser deux kilometres quand le
    // filtre s'annonce sur a cent metres pres. On la borne par l'incertitude
    // courante, ce qui accelere enormement les recalages suivants.
    const span = Math.max(600, Math.min(c.searchSpan ?? 2000, 3 * (navSigma ?? 1e9)));

    let bE = 0, bN = 0;
    let coarseMin = Infinity, coarseSum = 0, coarseCount = 0;
    const stages = [
      { span, step: Math.max(30, span / 12), stride: 1, survey: true },
      { span: Math.max(60, span / 8), step: 12, stride: 1 },
    ];
    for (const st of stages) {
      let best = Infinity, bestE = bE, bestN = bN;
      for (let dE = bE - st.span; dE <= bE + st.span + 1e-6; dE += st.step) {
        for (let dN = bN - st.span; dN <= bN + st.span + 1e-6; dN += st.step) {
          const s = ssd(dE, dN, st.stride);
          if (st.survey) { coarseSum += s; coarseCount++; }
          if (s < best) { best = s; bestE = dE; bestN = dN; }
        }
      }
      if (st.survey) coarseMin = best;
      bE = bestE; bN = bestN;
    }

    // CONTRASTE de la correlation : de combien le meilleur decalage se
    // detache-t-il de tous les autres ? Sur un relief marque, le minimum est
    // franc et le contraste proche de 1. Sur une plaine, tous les decalages se
    // valent, le contraste s'effondre — et la courbure locale du minimum ne
    // dit alors plus rien de l'erreur reelle, puisqu'on s'est simplement
    // trompe de minimum. C'est ce qui rendait l'incertitude annoncee deux fois
    // trop optimiste.
    const coarseMean = coarseSum / Math.max(1, coarseCount);
    const contrast = coarseMean > 0 ? (coarseMean - coarseMin) / coarseMean : 0;
    this.lastContrast = contrast;

    // Incertitude deduite de la courbure du minimum. Pour un ajustement aux
    // moindres carres, var = sigma_bruit^2 / (0.5 * d2SSD/dd2) : un minimum
    // franc donne une position sure, un minimum mou une position vague.
    const h = 25;
    const s0 = ssd(bE, bN);
    const cE = (ssd(bE + h, bN) - 2 * s0 + ssd(bE - h, bN)) / (h * h);
    const cN = (ssd(bE, bN + h) - 2 * s0 + ssd(bE, bN - h)) / (h * h);
    const noiseVar = (c.radarSigma ?? 6) ** 2 + mapError * mapError;

    if (!(cE > 0) || !(cN > 0)) { this.rejected++; return null; }
    const sigE = Math.sqrt((2 * noiseVar) / cE);
    const sigN = Math.sqrt((2 * noiseVar) / cN);
    // La courbure locale suppose qu'on a trouve le BON minimum. On corrige
    // donc par le contraste : peu contraste, donc probablement ambigu, donc
    // incertitude bien plus grande que ce que la courbure laisse croire.
    // Le facteur 1.4 est empirique : meme corrigee du contraste, la courbure
    // reste un peu optimiste, l'erreur de carte etant correlee spatialement et
    // ne se moyennant donc pas comme un bruit blanc.
    const sigma = 1.4 * Math.max(sigE, sigN) / Math.max(0.08, contrast);

    this.lastSigma = sigma;
    this.lastRuggedness = this.terrain.ruggedness(navLla.lat, navLla.lon);

    // Un recalage trop vague n'apporte rien et risque de degrader le filtre.
    if (!Number.isFinite(sigma) || sigma > (c.maxSigma ?? 1500)) {
      this.rejected++;
      return null;
    }

    this.fixes++;
    this.lastSample = { t, dE: bE, dN: bN, sigma, contrast };
    const ecefNav = llaToEcef(navLla.lat, navLla.lon, navLla.alt);
    const offset = enuToEcef([bE, bN, 0], navLla.lat, navLla.lon);
    return { rEcef: V.add(ecefNav, offset), sigma, dE: bE, dN: bN };
  }
}

/** Configuration par defaut de la suite de capteurs. */
export function defaultSensorConfig() {
  return {
    imuGrade: 'navigation',
    imu: { ...IMU_GRADES.navigation },
    altimeter: {
      enabled: true, period: 0.5,
      baroSigma: 120, baroBias: 60, baroMaxAlt: 32000,
      radarEnabled: true, radarSigma: 8, radarMaxAlt: 15000,
    },
    starTracker: { enabled: true, period: 20, sigma: 8, minAlt: 45000 },
    // Le plafond couvre la phase terminale du planeur, qui commence vers 30 km.
    // `sigma` n'existe plus : la precision n'est pas un reglage, elle resulte
    // du relief survole. Ce qui se regle, c'est la QUALITE DU MATERIEL —
    // finesse de la carte embarquee, bruit du radioaltimetre, longueur du
    // profil accumule.
    terrain: {
      enabled: false,
      period: 6, // intervalle entre deux correlations [s]
      minAlt: 300,
      maxAlt: 32000,
      radarSigma: 6, // bruit du radioaltimetre [m]
      mapError: 12, // erreur de la carte embarquee [m]
      samples: 50, // nombre de points du profil
      sampleStep: 120, // espacement des points [m]
      searchSpan: 2000, // demi-largeur de la recherche [m]
      maxSigma: 1500, // au-dela, le recalage est juge inexploitable [m]
    },
    // Fidelite du modele de gravite embarque : 'j2' (comme la realite) ou
    // 'point' (modele simplifie, source d'erreur supplementaire).
    gravityModel: 'j2',
  };
}
