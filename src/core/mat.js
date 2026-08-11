// Algebre matricielle dense de petite taille, pour le filtre de Kalman.
// Une matrice n x m est un Float64Array de n*m elements en ordre ligne-major,
// accompagne de ses dimensions : { n, m, d }.

export function mat(n, m, fill = 0) {
  const d = new Float64Array(n * m);
  if (fill !== 0) d.fill(fill);
  return { n, m, d };
}

export function eye(n, s = 1) {
  const A = mat(n, n);
  for (let i = 0; i < n; i++) A.d[i * n + i] = s;
  return A;
}

export function diag(values) {
  const n = values.length;
  const A = mat(n, n);
  for (let i = 0; i < n; i++) A.d[i * n + i] = values[i];
  return A;
}

export const get = (A, i, j) => A.d[i * A.m + j];
export const set = (A, i, j, v) => { A.d[i * A.m + j] = v; };

/** Copie le bloc 3x3 `B` (tableau de 9, ligne-major) dans A a partir de (r, c). */
export function setBlock3(A, r, c, B) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) A.d[(r + i) * A.m + (c + j)] = B[i * 3 + j];
  }
}

export function copy(A) {
  return { n: A.n, m: A.m, d: A.d.slice() };
}

/** C = A * B */
export function mul(A, B) {
  if (A.m !== B.n) throw new Error(`mul: dimensions incompatibles ${A.n}x${A.m} * ${B.n}x${B.m}`);
  const C = mat(A.n, B.m);
  const { n, m: k } = A;
  const m = B.m;
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const a = A.d[i * k + p];
      if (a === 0) continue;
      const bRow = p * m;
      const cRow = i * m;
      for (let j = 0; j < m; j++) C.d[cRow + j] += a * B.d[bRow + j];
    }
  }
  return C;
}

/** C = A * B^T */
export function mulT(A, B) {
  if (A.m !== B.m) throw new Error('mulT: dimensions incompatibles');
  const C = mat(A.n, B.n);
  for (let i = 0; i < A.n; i++) {
    for (let j = 0; j < B.n; j++) {
      let s = 0;
      for (let p = 0; p < A.m; p++) s += A.d[i * A.m + p] * B.d[j * B.m + p];
      C.d[i * C.m + j] = s;
    }
  }
  return C;
}

/** y = A * x, avec x et y des tableaux simples. */
export function mulVec(A, x) {
  const y = new Array(A.n).fill(0);
  for (let i = 0; i < A.n; i++) {
    let s = 0;
    for (let j = 0; j < A.m; j++) s += A.d[i * A.m + j] * x[j];
    y[i] = s;
  }
  return y;
}

export function addInto(A, B, s = 1) {
  for (let i = 0; i < A.d.length; i++) A.d[i] += s * B.d[i];
  return A;
}

export function add(A, B, s = 1) {
  return addInto(copy(A), B, s);
}

export function scaleInto(A, s) {
  for (let i = 0; i < A.d.length; i++) A.d[i] *= s;
  return A;
}

export function transpose(A) {
  const B = mat(A.m, A.n);
  for (let i = 0; i < A.n; i++) {
    for (let j = 0; j < A.m; j++) B.d[j * A.n + i] = A.d[i * A.m + j];
  }
  return B;
}

/** Force la symetrie : A <- (A + A^T)/2. Limite la derive numerique de P. */
export function symmetrize(A) {
  for (let i = 0; i < A.n; i++) {
    for (let j = i + 1; j < A.n; j++) {
      const v = 0.5 * (A.d[i * A.m + j] + A.d[j * A.m + i]);
      A.d[i * A.m + j] = v;
      A.d[j * A.m + i] = v;
    }
  }
  return A;
}

/**
 * Inverse par Gauss-Jordan avec pivot partiel.
 * Renvoie null si la matrice est numeriquement singuliere.
 */
export function inverse(A) {
  const n = A.n;
  const a = A.d.slice();
  const inv = eye(n).d;
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(a[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(a[r * n + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-300) return null;
    if (piv !== col) {
      for (let j = 0; j < n; j++) {
        let t = a[col * n + j]; a[col * n + j] = a[piv * n + j]; a[piv * n + j] = t;
        t = inv[col * n + j]; inv[col * n + j] = inv[piv * n + j]; inv[piv * n + j] = t;
      }
    }
    const d = a[col * n + col];
    for (let j = 0; j < n; j++) { a[col * n + j] /= d; inv[col * n + j] /= d; }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r * n + col];
      if (f === 0) continue;
      for (let j = 0; j < n; j++) {
        a[r * n + j] -= f * a[col * n + j];
        inv[r * n + j] -= f * inv[col * n + j];
      }
    }
  }
  return { n, m: n, d: inv };
}
