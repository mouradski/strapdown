// Integrateur Runge-Kutta d'ordre 4 sur des vecteurs d'etat en tableau simple.
// Suffisant ici : le pas est petit devant les constantes de temps du probleme
// et l'on n'a pas besoin de pas adaptatif pour un simulateur temps reel.

/**
 * Avance l'etat `y` de `dt` en resolvant dy/dt = deriv(t, y).
 * `deriv` doit renvoyer un tableau de meme longueur que `y`.
 */
export function rk4(deriv, t, y, dt) {
  const n = y.length;
  const k1 = deriv(t, y);
  const y2 = new Array(n);
  for (let i = 0; i < n; i++) y2[i] = y[i] + 0.5 * dt * k1[i];
  const k2 = deriv(t + 0.5 * dt, y2);
  const y3 = new Array(n);
  for (let i = 0; i < n; i++) y3[i] = y[i] + 0.5 * dt * k2[i];
  const k3 = deriv(t + 0.5 * dt, y3);
  const y4 = new Array(n);
  for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i];
  const k4 = deriv(t + dt, y4);

  const out = new Array(n);
  const h = dt / 6;
  for (let i = 0; i < n; i++) {
    out[i] = y[i] + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return out;
}

/**
 * Recherche par dichotomie de l'instant ou `f(t, y)` change de signe entre
 * t0 et t0 + dt. Sert a raffiner l'instant d'impact au sol.
 * Renvoie { t, y } au passage par zero.
 */
export function refineEvent(deriv, f, t0, y0, dt, iterations = 24) {
  let lo = 0, hi = dt;
  let bestT = t0 + dt;
  let bestY = rk4(deriv, t0, y0, dt);
  for (let i = 0; i < iterations; i++) {
    const mid = 0.5 * (lo + hi);
    const ym = rk4(deriv, t0, y0, mid);
    if (f(t0 + mid, ym) > 0) {
      lo = mid;
    } else {
      hi = mid;
      bestT = t0 + mid;
      bestY = ym;
    }
  }
  return { t: bestT, y: bestY };
}
