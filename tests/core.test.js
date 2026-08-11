// Tests du noyau : conversions de reperes, atmosphere, gravite, algebre.
import { EARTH, DEG } from '../src/core/constants.js';
import * as V from '../src/core/vec.js';
import * as M from '../src/core/mat.js';
import * as G from '../src/core/geodesy.js';
import { atmosphere } from '../src/core/atmosphere.js';
import { gravityJ2, gravityPoint, gravityGradient } from '../src/core/gravity.js';
import { rk4 } from '../src/core/integrator.js';
import { makeRng } from '../src/core/random.js';

export default function run(t) {
  // --- Geodesie : aller-retour LLA <-> ECEF ---
  for (const [lat, lon, alt] of [[36.75, 3.06, 0], [-33.9, 151.2, 1200], [78.2, -15.6, 300000], [0, 0, 0]]) {
    const r = G.llaToEcef(lat, lon, alt);
    const back = G.ecefToLla(r);
    t.close(back.lat, lat, 1e-8, `lat aller-retour ${lat}`);
    t.close(((back.lon - lon + 540) % 360) - 180, 0, 1e-8, `lon aller-retour ${lon}`);
    // Bowring est une approximation non iterative : sub-micrometrique au sol,
    // sub-millimetrique a quelques centaines de km. C'est trois ordres de
    // grandeur sous la moindre erreur de navigation qui nous interesse.
    t.close(back.alt, alt, 1e-3, `alt aller-retour ${alt}`);
  }

  // Rayon a l'equateur et au pole.
  t.close(V.norm(G.llaToEcef(0, 0, 0)), EARTH.a, 1e-6, 'rayon equatorial');
  t.close(V.norm(G.llaToEcef(90, 0, 0)), EARTH.b, 1e-6, 'rayon polaire');

  // --- ECI <-> ECEF ---
  const rE = G.llaToEcef(45, 10, 0);
  const tt = 1234.5;
  t.close(V.dist(G.eciToEcef(G.ecefToEci(rE, tt), tt), rE), 0, 1e-6, 'aller-retour ECI/ECEF');
  // Un point fixe au sol a une vitesse ECI de omega * r * cos(lat).
  const rEci = G.ecefToEci(rE, tt);
  const vEci = G.velEcefToEci([0, 0, 0], rEci, tt);
  t.close(V.norm(vEci), EARTH.omega * Math.hypot(rE[0], rE[1]), 1e-9, 'vitesse d entrainement');
  // ...et une vitesse sol nulle.
  t.close(V.norm(G.velEciToEcef(vEci, rEci, tt)), 0, 1e-9, 'vitesse sol nulle');

  // --- ENU ---
  const up = G.enuToEcef([0, 0, 1], 45, 10);
  const nAtEq = G.enuToEcef([0, 1, 0], 0, 0);
  t.close(V.dot(up, V.normalize(G.llaToEcef(45, 10, 0))), 1, 1e-3, 'verticale locale ~ radiale');
  t.close(V.dist(nAtEq, [0, 0, 1]), 0, 1e-12, 'Nord a l equateur = +Z');
  const E = G.enuMatrix(33, -7);
  t.close(V.dist(V.m3v(E, V.m3tv(E, [1, 2, 3])), [1, 2, 3]), 0, 1e-12, 'ENU orthogonale');

  // --- Distances ---
  t.close(G.groundRange(0, 0, 0, 90), (Math.PI / 2) * EARTH.Rmean, 1, 'quart de circonference');
  t.close(G.initialBearing(0, 0, 10, 0), 0, 1e-9, 'azimut plein Nord');
  t.close(G.initialBearing(0, 0, 0, 10), 90, 1e-9, 'azimut plein Est');

  // --- Atmosphere ---
  const sl = atmosphere(0);
  t.close(sl.rho, 1.225, 1e-3, 'densite au niveau de la mer');
  t.close(sl.p, 101325, 1, 'pression au niveau de la mer');
  t.close(sl.a, 340.294, 0.01, 'vitesse du son au sol');
  // Les tables de l'atmosphere standard sont indexees en altitude
  // GEOPOTENTIELLE, alors que le modele prend une altitude geometrique.
  // On convertit pour comparer aux valeurs publiees.
  const RE_ATM = 6356766;
  const geometricOf = (h) => (RE_ATM * h) / (RE_ATM - h);
  t.close(atmosphere(geometricOf(11000)).T, 216.65, 0.01, 'temperature a la tropopause');
  t.close(atmosphere(geometricOf(20000)).rho, 0.08803, 1e-4, 'densite a 20 km');
  t.close(atmosphere(geometricOf(0)).rho, 1.225, 1e-4, 'densite de reference');

  // Coherence interne de la table : la pression de base de chaque couche doit
  // se deduire de la couche precedente par la formule barometrique. Cela
  // valide toute la table d'un coup, sans dependre de valeurs recopiees.
  {
    const R = 287.05287, g = 9.80665;
    const LAY = [
      [0, 288.15, -0.0065, 101325], [11000, 216.65, 0.0, 22632.06],
      [20000, 216.65, 0.001, 5474.889], [32000, 228.65, 0.0028, 868.0187],
      [47000, 270.65, 0.0, 110.9063], [51000, 270.65, -0.0028, 66.93887],
      [71000, 214.65, -0.002, 3.956420], [84852, 186.946, 0.0, 0.3733836],
    ];
    for (let i = 0; i < LAY.length - 1; i++) {
      const [hb, Tb, L, Pb] = LAY[i];
      const dh = LAY[i + 1][0] - hb;
      const pNext = L === 0
        ? Pb * Math.exp((-g * dh) / (R * Tb))
        : Pb * Math.pow((Tb + L * dh) / Tb, -g / (R * L));
      t.close(pNext / LAY[i + 1][3], 1, 2e-5, `raccord de pression couche ${i}`);
      t.close(Tb + L * dh, LAY[i + 1][1], 0.01, `raccord de temperature couche ${i}`);
    }
  }
  // L'ecart geometrique/geopotentiel doit rester du bon ordre : ~19 m a 11 km.
  t.close(geometricOf(11000) - 11000, 19.0, 0.5, 'correction geopotentielle a 11 km');
  t.ok(atmosphere(200000).rho < 1e-9, 'densite negligeable a 200 km');
  // Continuite au raccord des deux modeles.
  const below = atmosphere(85990).rho, above = atmosphere(86010).rho;
  t.ok(Math.abs(below - above) / below < 0.02, 'raccord continu a 86 km');
  // Monotonie decroissante.
  let prev = Infinity;
  for (let z = 0; z <= 300000; z += 1000) {
    const r = atmosphere(z).rho;
    t.ok(r <= prev, `densite decroissante a ${z} m`, true);
    prev = r;
  }

  // --- Gravite ---
  const rSurf = G.llaToEcef(0, 0, 0);
  t.close(V.norm(gravityPoint(rSurf)), 9.7983, 1e-3, 'g a l equateur (masse ponctuelle)');
  const gp = gravityJ2(G.llaToEcef(90, 0, 0));
  const ge = gravityJ2(G.llaToEcef(0, 0, 0));
  t.ok(V.norm(gp) > V.norm(ge), 'g plus fort au pole qu a l equateur (J2)');
  t.close(V.norm(gp), 9.83, 0.02, 'g au pole ~ 9.83');
  t.close(V.norm(ge), 9.81, 0.02, 'g a l equateur ~ 9.81');

  // Le gradient doit approcher la difference finie de l'acceleration.
  const rTest = G.llaToEcef(30, 40, 500000);
  const Ggrad = gravityGradient(rTest);
  const h = 50;
  for (let axis = 0; axis < 3; axis++) {
    const rp = [...rTest]; rp[axis] += h;
    const rm = [...rTest]; rm[axis] -= h;
    const fd = V.scale(V.sub(gravityPoint(rp), gravityPoint(rm)), 1 / (2 * h));
    const col = [Ggrad[axis], Ggrad[3 + axis], Ggrad[6 + axis]];
    t.close(V.dist(fd, col), 0, 1e-12, `gradient de gravite, axe ${axis}`);
  }

  // --- Quaternions ---
  const rng = makeRng(7);
  for (let i = 0; i < 20; i++) {
    const q = V.qNormalize([rng.gauss(), rng.gauss(), rng.gauss(), rng.gauss()]);
    const m = V.qToM3(q);
    // Orthogonalite.
    const mmT = V.m3mul(m, V.m3transpose(m));
    t.close(V.dist([mmT[0], mmT[4], mmT[8]], [1, 1, 1]), 0, 1e-12, 'matrice de rotation orthonormee', true);
    // Aller-retour quaternion <-> matrice.
    const q2 = V.m3ToQ(m);
    const same = V.dist(V.qToM3(q2), m) < 1e-12;
    t.ok(same, 'aller-retour quaternion/matrice', true);
    // qRot equivaut au produit matriciel.
    const v = [rng.gauss(), rng.gauss(), rng.gauss()];
    t.close(V.dist(V.qRot(q, v), V.m3v(m, v)), 0, 1e-12, 'qRot == M*v', true);
  }

  // rotVecBetween doit retrouver une petite rotation imposee.
  const qa = V.qNormalize([1, 0.02, -0.01, 0.03]);
  const dr = [1e-4, -2e-4, 3e-4];
  const qb = V.qMul(V.qFromRotVec(dr), qa);
  t.close(V.dist(V.rotVecBetween(qb, qa), dr), 0, 1e-10, 'rotVecBetween sur petite rotation');

  // La derivee du quaternion doit reproduire une rotation d'axe fixe.
  {
    const w = [0, 0, 0.1];
    let q = V.qIdentity();
    const dt = 0.001;
    for (let i = 0; i < 1000; i++) {
      const d = V.qDot(q, w);
      q = V.qNormalize([q[0] + d[0] * dt, q[1] + d[1] * dt, q[2] + d[2] * dt, q[3] + d[3] * dt]);
    }
    const v = V.qRot(q, [1, 0, 0]);
    t.close(V.dist(v, [Math.cos(0.1), Math.sin(0.1), 0]), 0, 1e-6, 'integration de qDot');
  }

  // frameFromXUp doit produire une matrice de rotation propre.
  {
    const F = V.frameFromXUp([0.3, 0.5, 0.8], [0, 0, 1]);
    const FFt = V.m3mul(F, V.m3transpose(F));
    t.close(V.dist([FFt[0], FFt[4], FFt[8]], [1, 1, 1]), 0, 1e-12, 'frameFromXUp orthonormee');
    t.close(V.dist(V.m3v(F, [1, 0, 0]), V.normalize([0.3, 0.5, 0.8])), 0, 1e-12, 'frameFromXUp axe X');
    // Cas degenere : X colineaire a la reference.
    const F2 = V.frameFromXUp([0, 0, 1], [0, 0, 1]);
    t.ok(Number.isFinite(F2[0]) && Number.isFinite(F2[4]), 'frameFromXUp gere le cas colineaire');
  }

  // --- Matrices ---
  {
    const A = M.mat(3, 3);
    A.d.set([4, 1, 2, 1, 5, 3, 2, 3, 6]);
    const Ainv = M.inverse(A);
    const I = M.mul(A, Ainv);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        t.close(M.get(I, i, j), i === j ? 1 : 0, 1e-10, `inverse 3x3 (${i},${j})`, true);
      }
    }
    t.ok(M.inverse(M.mat(2, 2)) === null, 'inverse renvoie null si singuliere');

    // mulT equivaut a mul(A, transpose(B)).
    const B = M.mat(2, 3);
    B.d.set([1, 2, 3, 4, 5, 6]);
    const C = M.mat(4, 3);
    C.d.set([1, 0, 2, 3, 1, 0, 0, 2, 1, 5, 4, 3]);
    const p1 = M.mulT(B, C);
    const p2 = M.mul(B, M.transpose(C));
    t.close(Math.max(...p1.d.map((v, i) => Math.abs(v - p2.d[i]))), 0, 1e-12, 'mulT == mul(A, B^T)');

    // Bloc 3x3 et symetrisation.
    const P = M.eye(15, 1);
    M.setBlock3(P, 3, 6, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    t.close(M.get(P, 4, 7), 5, 1e-15, 'setBlock3 place bien le bloc');
    M.symmetrize(P);
    t.close(M.get(P, 3, 6) - M.get(P, 6, 3), 0, 1e-15, 'symmetrize');
  }

  // --- RK4 : orbite circulaire, la periode doit etre celle de Kepler ---
  {
    const r0 = 7000000;
    const v0 = Math.sqrt(EARTH.mu / r0);
    const period = 2 * Math.PI * Math.sqrt(r0 ** 3 / EARTH.mu);
    const deriv = (_t, y) => {
      const a = gravityPoint([y[0], y[1], y[2]]);
      return [y[3], y[4], y[5], a[0], a[1], a[2]];
    };
    let y = [r0, 0, 0, 0, v0, 0];
    // Le pas doit diviser exactement la periode, sinon le reste de division
    // domine largement l'erreur de troncature de RK4.
    const n = 6000;
    const dt = period / n;
    for (let i = 0; i < n; i++) y = rk4(deriv, i * dt, y, dt);
    t.close(V.dist([y[0], y[1], y[2]], [r0, 0, 0]) / r0, 0, 1e-9, 'RK4 boucle une orbite circulaire');
    t.close(V.norm([y[0], y[1], y[2]]) / r0, 1, 1e-9, 'rayon conserve sur une orbite');
  }

  // --- Statistiques du generateur aleatoire ---
  {
    const r = makeRng(42);
    let s = 0, s2 = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) { const g = r.gauss(); s += g; s2 += g * g; }
    t.close(s / N, 0, 0.01, 'moyenne du tirage normal');
    t.close(Math.sqrt(s2 / N), 1, 0.01, 'ecart-type du tirage normal');
    // Reproductibilite a graine egale.
    t.close(makeRng(5).gauss() - makeRng(5).gauss(), 0, 0, 'graine identique => tirage identique');
  }
}
