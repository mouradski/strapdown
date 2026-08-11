// Algebre vectorielle 3D et quaternions.
// Les vecteurs sont des tableaux [x, y, z], les quaternions [w, x, y, z].
// Les matrices 3x3 sont des tableaux de 9 elements en ordre ligne-major :
//   [ m0 m1 m2 ]
//   [ m3 m4 m5 ]
//   [ m6 m7 m8 ]

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const clone = (a) => [a[0], a[1], a[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const neg = (a) => [-a[0], -a[1], -a[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm2 = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

export function normalize(a) {
  const n = norm(a);
  return n > 0 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0];
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Combinaison lineaire a*sa + b*sb, evite les allocations intermediaires. */
export const lc2 = (a, sa, b, sb) => [
  a[0] * sa + b[0] * sb,
  a[1] * sa + b[1] * sb,
  a[2] * sa + b[2] * sb,
];

/**
 * Angle non signe entre deux vecteurs [rad].
 * Formulation en atan2(|a^b|, a.b) et non en acos(a.b) : pres de 0 et de pi,
 * acos perd la moitie des chiffres significatifs (une erreur eps sur le produit
 * scalaire donne sqrt(2 eps) sur l'angle). Ici l'incidence est souvent quasi
 * nulle, donc ce detail compte.
 */
export function angleBetween(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  return Math.atan2(norm(cross(na, nb)), dot(na, nb));
}

/** Composante de `a` orthogonale a la direction unitaire `u`. */
export function rejectFrom(a, u) {
  const d = dot(a, u);
  return [a[0] - u[0] * d, a[1] - u[1] * d, a[2] - u[2] * d];
}

// --- Matrices 3x3 ---

export const M3_I = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Produit matrice-vecteur M*v. */
export function m3v(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Produit matrice-vecteur par la transposee, M^T*v. */
export function m3tv(m, v) {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

/** Produit matriciel A*B. */
export function m3mul(a, b) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return o;
}

export const m3transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/** Matrice antisymetrique [v x] telle que [v x] u = v ^ u. */
export const skew = (v) => [0, -v[2], v[1], v[2], 0, -v[0], -v[1], v[0], 0];

/**
 * Repere orthonorme a partir d'un axe X impose et d'une reference laterale Y.
 * A preferer quand la reference "haut" risque d'etre colineaire a X — c'est
 * exactement le cas au decollage, ou la poussee est selon la verticale locale.
 * Renvoie la matrice colonnes [X | Y | Z].
 */
export function frameFromXY(xAxis, yHint) {
  const X = normalize(xAxis);
  let Y = rejectFrom(yHint, X);
  if (norm(Y) < 1e-9) {
    Y = rejectFrom(Math.abs(X[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], X);
  }
  Y = normalize(Y);
  const Z = cross(X, Y);
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}

/**
 * Repere orthonorme a partir d'un axe X impose et d'une reference "haut".
 * Renvoie la matrice colonnes [X | Y | Z] (donc corps -> reference).
 */
export function frameFromXUp(xAxis, upHint) {
  const X = normalize(xAxis);
  let up = upHint;
  if (Math.abs(dot(X, normalize(up))) > 0.999) {
    // La reference est colineaire a X : on en prend une autre.
    up = Math.abs(X[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  }
  const Z = normalize(cross(X, cross(up, X)));
  const Y = cross(Z, X);
  // Colonnes X, Y, Z rangees en ligne-major.
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}

// --- Quaternions (w, x, y, z), rotation corps -> reference ---

export const qIdentity = () => [1, 0, 0, 0];

export function qMul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

export function qNormalize(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return n > 0 ? [q[0] / n, q[1] / n, q[2] / n, q[3] / n] : qIdentity();
}

export const qConj = (q) => [q[0], -q[1], -q[2], -q[3]];

/** Derivee du quaternion pour une vitesse angulaire w exprimee dans le corps. */
export function qDot(q, wBody) {
  const [qw, qx, qy, qz] = q;
  const [wx, wy, wz] = wBody;
  return [
    0.5 * (-qx * wx - qy * wy - qz * wz),
    0.5 * (qw * wx + qy * wz - qz * wy),
    0.5 * (qw * wy - qx * wz + qz * wx),
    0.5 * (qw * wz + qx * wy - qy * wx),
  ];
}

/** Matrice de rotation corps -> reference. */
export function qToM3(q) {
  const [w, x, y, z] = q;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
  ];
}

/** Quaternion depuis une matrice de rotation (methode de Shepperd, stable). */
export function m3ToQ(m) {
  const tr = m[0] + m[4] + m[8];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [0.25 * s, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s];
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
    q = [(m[7] - m[5]) / s, 0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s];
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
    q = [(m[2] - m[6]) / s, (m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s];
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
    q = [(m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s];
  }
  return qNormalize(q);
}

/** Quaternion d'une rotation d'angle `ang` autour de l'axe unitaire `axis`. */
export function qFromAxisAngle(axis, ang) {
  const h = ang / 2;
  const s = Math.sin(h);
  const u = normalize(axis);
  return [Math.cos(h), u[0] * s, u[1] * s, u[2] * s];
}

/** Quaternion depuis un petit vecteur rotation (approximation au 1er ordre + renormalisation). */
export function qFromRotVec(r) {
  const a = norm(r);
  if (a < 1e-12) return qIdentity();
  return qFromAxisAngle(r, a);
}

/** Rotation d'un vecteur par un quaternion (corps -> reference). */
export function qRot(q, v) {
  return m3v(qToM3(q), v);
}

/**
 * Petit vecteur rotation menant de `qb` a `qa` (soit qa = dq * qb), exprime
 * dans le repere de reference. Utilise pour les residus d'attitude.
 */
export function rotVecBetween(qa, qb) {
  let dq = qMul(qa, qConj(qb));
  if (dq[0] < 0) dq = [-dq[0], -dq[1], -dq[2], -dq[3]];
  const vn = Math.hypot(dq[1], dq[2], dq[3]);
  if (vn < 1e-12) return [0, 0, 0];
  const ang = 2 * Math.atan2(vn, dq[0]);
  return [(dq[1] / vn) * ang, (dq[2] / vn) * ang, (dq[3] / vn) * ang];
}
