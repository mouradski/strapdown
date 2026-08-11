// Tests du relief synthetique et de la correlation de terrain.
//
// Le point a verifier n'est pas une valeur de precision : c'est que la
// precision EMERGE du terrain survole. Un recalage par le relief doit etre bon
// en montagne, mediocre en plaine, impossible en mer — et le calculateur doit
// savoir dans lequel de ces cas il se trouve.

import { makeTerrain } from '../src/core/terrain.js';
import { TerrainCorrelator, defaultSensorConfig } from '../src/avionics/sensors.js';
import { makeRng } from '../src/core/random.js';

/** Fait voler un profil rectiligne avec une erreur de navigation imposee. */
function essai(terrain, lat0, lon0, errE, errN, seed, over = {}) {
  const cfg = { ...defaultSensorConfig().terrain, enabled: true, period: 1e9, ...over };
  const c = new TerrainCorrelator(cfg, makeRng(seed), terrain);
  const mLat = 110570;
  const mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  let nav = null;
  for (let i = 0; i < 90; i++) {
    const tLat = lat0;
    const tLon = lon0 + (i * 140) / mLon;
    nav = { lat: tLat - errN / mLat, lon: tLon - errE / mLon, alt: 8000 };
    c.observe(8000, { lat: tLat, lon: tLon, alt: 8000 }, nav);
  }
  c.lastFix = -1e9;
  const fix = c.correlate(0, nav, 900);
  return { fix, correlator: c };
}

/** Trouve une zone de rugosite donnee. */
function zone(terrain, lo, hi) {
  for (let i = 0; i < 4000; i++) {
    const lat = -55 + 110 * ((i * 37) % 1000) / 1000;
    const lon = -175 + 350 * ((i * 73) % 1000) / 1000;
    const r = terrain.ruggedness(lat, lon);
    if (r >= lo && r < hi) return { lat, lon, r };
  }
  return null;
}

export default function run(t) {
  const land = makeTerrain({ seed: 7, isLand: () => true });
  const sea = makeTerrain({ seed: 7, isLand: () => false });

  // --- Le champ de relief ---
  {
    t.close(sea.elevation(20, 10), 0, 1e-12, 'altitude nulle en mer');
    t.close(sea.ruggedness(20, 10), 0, 1e-12, 'rugosite nulle en mer');
    t.close(sea.slope(20, 10), 0, 1e-12, 'pente nulle en mer');

    // Deterministe : deux appels, deux instances, meme resultat.
    const a = makeTerrain({ seed: 7, isLand: () => true });
    t.close(a.elevation(31.4, 12.7), land.elevation(31.4, 12.7), 1e-12,
      'le relief est deterministe pour une graine donnee');
    t.ok(Math.abs(makeTerrain({ seed: 8, isLand: () => true }).elevation(31.4, 12.7)
      - land.elevation(31.4, 12.7)) > 1, 'une autre graine donne un autre monde');

    // Continuite : pas de saut entre deux points voisins.
    let maxJump = 0;
    for (let i = 0; i < 400; i++) {
      const lat = 20 + i * 0.001;
      maxJump = Math.max(maxJump, Math.abs(land.elevation(lat, 10) - land.elevation(lat + 0.001, 10)));
    }
    t.ok(maxJump < 60, `relief continu (plus grand saut sur 110 m : ${maxJump.toFixed(1)} m)`);

    // Statistiques plausibles : altitudes positives, distribution variee.
    let neg = 0, sum = 0, max = 0, usable = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const lat = -60 + 120 * ((i * 97) % 1000) / 1000;
      const lon = -180 + 360 * ((i * 211) % 1000) / 1000;
      const e = land.elevation(lat, lon);
      if (e < 0) neg++;
      sum += e;
      max = Math.max(max, e);
      if (land.slope(lat, lon) > 0.01) usable++;
    }
    t.ok(neg === 0, 'aucune altitude negative sur les terres');
    t.ok(max > 800 && max < 6000, `sommets plausibles (${max.toFixed(0)} m)`);
    t.ok(sum / N > 50 && sum / N < 1200, `altitude moyenne plausible (${(sum / N).toFixed(0)} m)`);
    // Il faut une proportion notable de terrain exploitable, sinon le module de
    // correlation ne servirait jamais a rien.
    const pct = (100 * usable) / N;
    t.ok(pct > 15 && pct < 65, `part de terrain exploitable par correlation : ${pct.toFixed(0)} %`);

    // La carte embarquee doit differer du terrain reel, mais pas trop.
    let maxDiff = 0;
    for (let i = 0; i < 500; i++) {
      const lat = 30 + i * 0.002;
      maxDiff = Math.max(maxDiff, Math.abs(land.mapElevation(lat, 12, 12) - land.elevation(lat, 12)));
    }
    t.ok(maxDiff > 1 && maxDiff < 60, `erreur de carte du bon ordre (${maxDiff.toFixed(1)} m)`);
    t.close(land.mapElevation(30, 12, 0), land.elevation(30, 12), 1e-9,
      'carte parfaite si l erreur est nulle');
  }

  // --- La correlation retrouve l'erreur de navigation ---
  {
    const rough = zone(land, 0.55, 1);
    t.ok(rough !== null, 'une zone accidentee existe');

    // Sans bruit ni erreur de carte, la correlation doit etre quasi exacte.
    const clean = essai(land, rough.lat, rough.lon, 500, -300, 1,
      { radarSigma: 0, mapError: 0 });
    t.ok(clean.fix !== null, 'recalage obtenu en terrain accidente');
    if (clean.fix) {
      const err = Math.hypot(clean.fix.dE - 500, clean.fix.dN + 300);
      t.ok(err < 60, `sans bruit, la correlation est quasi exacte (${err.toFixed(0)} m)`);
    }

    // Avec du bruit realiste, elle reste utilisable.
    let sum = 0, n = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const e = 300 + seed * 90;
      const r = essai(land, rough.lat, rough.lon, e, -e / 2, seed);
      if (r.fix) { sum += Math.hypot(r.fix.dE - e, r.fix.dN + e / 2); n++; }
    }
    t.ok(n >= 3, `recalages obtenus en terrain accidente (${n}/5)`);
    t.ok(sum / Math.max(n, 1) < 900,
      `precision utilisable en terrain accidente (${(sum / Math.max(n, 1)).toFixed(0)} m)`);
  }

  // --- Sur mer, aucun recalage possible ---
  {
    let fixes = 0, rejected = 0;
    for (const seed of [1, 2, 3]) {
      const r = essai(sea, 20, 10, 400, -200, seed);
      if (r.fix) fixes++;
      rejected += r.correlator.rejected;
    }
    t.ok(fixes === 0, 'aucun recalage au-dessus de la mer');
    t.ok(rejected >= 3, `les tentatives en mer sont rejetees (${rejected})`);
  }

  // --- La qualite s'ordonne avec le relief ---
  {
    const rough = zone(land, 0.55, 1);
    const mild = zone(land, 0.15, 0.3);
    const measure = (z) => {
      let sig = 0, n = 0;
      for (const seed of [1, 2, 3, 4]) {
        const r = essai(land, z.lat, z.lon, 300, -200, seed);
        if (r.fix) { sig += r.fix.sigma; n++; }
      }
      return n ? sig / n : Infinity;
    };
    const sRough = measure(rough);
    const sMild = measure(mild);
    t.ok(sRough < sMild,
      `l incertitude annoncee suit le relief (${sRough.toFixed(0)} m en montagne contre ${sMild.toFixed(0)} m en terrain doux)`);
  }

  // --- L'incertitude annoncee doit etre honnete ---
  // C'est la propriete la plus importante : un filtre de Kalman a qui l'on
  // ment sur la qualite d'une mesure la surpondere et se degrade.
  {
    const ratios = [];
    for (let i = 0; i < 40; i++) {
      const lat = -50 + 100 * ((i * 37) % 100) / 100;
      const lon = -170 + 340 * ((i * 73) % 100) / 100;
      const seed = i + 1;
      const e = 200 + (i % 5) * 120;
      const r = essai(land, lat, lon, e, -e / 3, seed);
      if (!r.fix) continue;
      const err = Math.hypot(r.fix.dE - e, r.fix.dN + e / 3);
      ratios.push(err / r.fix.sigma);
    }
    t.ok(ratios.length >= 8, `echantillon suffisant (${ratios.length} recalages)`);
    ratios.sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    // Un rapport proche de 1 signifie que le module dit vrai. En dessous il est
    // prudent, ce qui est sans danger ; nettement au-dessus il serait
    // dangereusement optimiste.
    t.ok(median > 0.25 && median < 2.2,
      `incertitude annoncee credible (rapport median erreur/sigma = ${median.toFixed(2)})`);
  }

  // --- Un meilleur materiel doit donner un meilleur recalage ---
  {
    const rough = zone(land, 0.55, 1);
    const avg = (over) => {
      let sig = 0, n = 0;
      for (const seed of [1, 2, 3, 4]) {
        const r = essai(land, rough.lat, rough.lon, 300, -200, seed, over);
        if (r.fix) { sig += r.fix.sigma; n++; }
      }
      return n ? sig / n : Infinity;
    };
    t.ok(avg({ mapError: 3 }) < avg({ mapError: 40 }),
      'une carte plus fine ameliore le recalage');
    t.ok(avg({ samples: 70 }) < avg({ samples: 15 }),
      'un profil plus long ameliore le recalage');
  }
}
