// Constantes physiques et geodesiques.
// Valeurs standard WGS84 / EGM, telles que publiees dans la litterature ouverte.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

// --- Terre (WGS84) ---
export const EARTH = {
  a: 6378137.0, // demi-grand axe [m]
  f: 1 / 298.257223563, // aplatissement
  mu: 3.986004418e14, // parametre gravitationnel [m^3/s^2]
  J2: 1.08262668e-3, // harmonique zonal principal
  omega: 7.292115e-5, // vitesse de rotation [rad/s]
  Rmean: 6371008.8, // rayon moyen [m]
};
EARTH.b = EARTH.a * (1 - EARTH.f); // demi-petit axe
EARTH.e2 = EARTH.f * (2 - EARTH.f); // premiere excentricite au carre
EARTH.ep2 = EARTH.e2 / (1 - EARTH.e2); // seconde excentricite au carre

export const G0 = 9.80665; // gravite standard, sert a convertir l'Isp [m/s^2]

// --- Air ---
export const AIR = {
  R: 287.05287, // constante specifique de l'air sec [J/(kg.K)]
  gamma: 1.4, // rapport des chaleurs specifiques
};

// Altitude au-dela de laquelle on considere le vol exo-atmospherique.
// Ce n'est pas une frontiere physique nette : la densite y est ~1e-7 kg/m^3.
export const KARMAN = 100000;
