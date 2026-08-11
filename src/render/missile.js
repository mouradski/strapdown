// Modele 3D du vecteur, avec panache, fumee et gaine de plasma.
//
// ECHELLE
// Le modele est a la VRAIE echelle : une quinzaine de metres dans une scene ou
// la Terre fait 6371 km. Depuis l'orbite il est donc invisible, et c'est
// normal — c'est le repere annulaire qui signale alors la position. Il n'a de
// sens qu'en vue rapprochee, ou l'on voit reellement l'engin.
//
// Les proportions ne sont pas inventees : le diametre se deduit de la section
// de reference du vecteur, et la longueur de chaque etage de sa masse d'ergols
// divisee par leur masse volumique. Le modele reflete donc la physique qui le
// fait voler, et les trois vecteurs du simulateur ne se ressemblent pas.
//
// EFFETS
// Panache et plasma sont dessines en billboards additifs plutot qu'en solides :
// un jet et un gaz ionise n'ont pas de surface, et toute geometrie fermee leur
// donne un bord franc que l'oeil lit immediatement comme du carton. Le bord
// doux vient d'une gaussienne dans le fragment, pas d'une texture — on evite
// ainsi de transporter un atlas d'images dans un rendu qui doit rester
// autonome.

import * as THREE from 'three';
import { SCENE_SCALE } from './scale.js';

const PROPELLANT_DENSITY = 1750; // propergol solide [kg/m^3]

// Aerothermique de REPLI, utilisee seulement si l'appelant ne fournit pas de
// releve. Ce sont les memes lois que le module de simulation (correlation de
// Sutton-Graves puis equilibre radiatif de paroi) : les deux chemins donnent
// donc la meme couleur, et le rendu ne depend pas de la presence du module.
const SUTTON_GRAVES_K = 1.7415e-4;
const STEFAN_BOLTZMANN = 5.670374419e-8;
const TPS_EMISSIVITY = 0.85;
const FALLBACK_NOSE_RADIUS = 0.05; // [m], nez de corps de rentree typique

const AXIS_X = new THREE.Vector3(1, 0, 0);

/** Dimensions physiques du vecteur, deduites de ses caracteristiques. */
export function vehicleDimensions(veh) {
  const diameter = Math.sqrt((4 * veh.refArea) / Math.PI);
  const area = Math.PI * (diameter / 2) ** 2;
  const stages = veh.stages.map((st) => ({
    // Volume d'ergols + une part de structure : on majore de 15 %.
    length: (st.propMass / (PROPELLANT_DENSITY * area)) * 1.15,
    diameter,
  }));
  // Corps de rentree ou planeur : sa section propre est plus faible.
  const payloadDiameter = Math.sqrt((4 * veh.rv.refArea) / Math.PI);
  const payloadLength = veh.glide
    ? payloadDiameter * 2.6 // corps porteur : allonge et aplati
    : Math.max(1.6, payloadDiameter * 3.2); // cone de rentree elance
  // Envergure et epaisseur du corps porteur. Il est PLUS LARGE que le lanceur
  // qui le porte — c'est la consequence directe de ses 4 m^2 de surface
  // portante pour 1.77 m^2 de maitre-couple — et c'est pour cela que sa coiffe
  // est renflee au lieu d'etre dans le prolongement du corps.
  const payloadSpan = veh.glide ? payloadDiameter * 1.06 : payloadDiameter;
  const payloadHeight = veh.glide ? payloadDiameter * 0.42 : payloadDiameter;

  const stack = stages.reduce((s, x) => s + x.length, 0);
  // Coiffe : elle doit contenir la charge, gouvernes comprises, quelle que
  // soit sa forme. La marge n'est pas cosmetique — sans elle une derive de
  // planeur traverse la coiffe pendant toute la montee.
  const shroudRadius = Math.max(diameter / 2, payloadSpan * 0.62, payloadHeight * 1.05);
  const shroudLength = Math.max(payloadLength * 1.3, shroudRadius * 3.0);

  return {
    diameter,
    stages,
    payloadDiameter,
    payloadLength,
    payloadSpan,
    payloadHeight,
    shroudRadius,
    shroudLength,
    // `total` reste la longueur lanceur + charge : c'est la reference que
    // l'appelant utilise pour dimensionner les effets, et la changer
    // deplacerait tout ce qui s'y accroche.
    total: stack + payloadLength,
    overall: stack + shroudLength,
  };
}

// ---------------------------------------------------------------------------
// Fabriques de geometrie
//
// Tout est construit autour de l'axe +X, qui est l'axe longitudinal du corps :
// l'orientation se pose alors directement depuis le quaternion d'attitude,
// sans rotation intermediaire a entretenir.
// ---------------------------------------------------------------------------

/** Tube ou tronc de cone plein, de x0 a x1. `rPlus` est le rayon cote +X. */
function tubeX(rPlus, rMinus, x0, x1, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(rPlus, rMinus, Math.abs(x1 - x0), seg, 1, open);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

/** Surface de revolution. `dir` = -1 couche le profil vers -X. */
function latheX(points, seg, dir = 1) {
  const g = new THREE.LatheGeometry(points, seg);
  g.rotateZ(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  return g;
}

/**
 * Profil d'ogive TANGENTE : l'arc raccorde le corps sans cassure de pente.
 * C'est la forme reelle des coiffes, et elle ne coute qu'un rayon de courbure
 * a calculer — le cone droit, lui, laisse une arete a la jonction que l'oeil
 * repere aussitot comme une approximation.
 */
function ogiveProfile(radius, length, n = 16) {
  const rho = (radius * radius + length * length) / (2 * radius);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    // Echantillonnage resserre vers la pointe, ou la courbure est maximale.
    const h = length * Math.sin(((i / n) * Math.PI) / 2);
    const r = Math.sqrt(Math.max(0, rho * rho - h * h)) + radius - rho;
    pts.push(new THREE.Vector2(Math.max(0, r), h));
  }
  return pts;
}

/**
 * Profil de cone de rentree a nez SPHERIQUE. Un corps de rentree n'est jamais
 * parfaitement pointu : le flux de chaleur varie en 1/sqrt(rayon de nez), et
 * une pointe mathematique s'ablate en quelques secondes.
 */
function bluntConeProfile(radius, length, bluntness = 0.1, n = 12) {
  const theta = Math.atan2(radius, length);
  const rn = Math.max(1e-4, radius * bluntness);
  const ht = length * (1 - (rn * Math.cos(theta)) / radius); // raccord cone/sphere
  const hc = ht - rn * Math.sin(theta); // centre de la sphere de nez
  // Emousser raccourcit le cone : on redilate pour que la charge occupe bien
  // la longueur annoncee par vehicleDimensions().
  const k = length / (hc + rn);
  const pts = [new THREE.Vector2(radius, 0)];
  for (let i = 1; i <= 4; i++) {
    pts.push(new THREE.Vector2(radius * (1 - (i / 4) * (ht / length)), (i / 4) * ht * k));
  }
  for (let i = 1; i <= n; i++) {
    const a = theta + (i / n) * (Math.PI / 2 - theta);
    pts.push(new THREE.Vector2(rn * Math.cos(a), (hc + rn * Math.sin(a)) * k));
  }
  return pts;
}

/**
 * Profil d'une tuyere : convergent, GORGE, puis divergent en cloche.
 *
 * La gorge est le seul endroit ou l'ecoulement est sonique et c'est elle qui
 * fixe le debit ; la cloche qui la suit ne fait que detendre le gaz. Le profil
 * en racine reproduit la detente rapide d'une tuyere a contour parabolique,
 * bien plus courte qu'un cone a meme rapport de section.
 */
function nozzleProfile(rBody, length, n = 9) {
  const rChamber = rBody * 0.30;
  const rThroat = rBody * 0.145;
  const rExit = rBody * 0.46;
  const hThroat = length * 0.24;
  const pts = [new THREE.Vector2(rChamber, 0)];
  for (let i = 1; i <= 3; i++) {
    const t = i / 3;
    pts.push(new THREE.Vector2(rChamber + (rThroat - rChamber) * (1 - Math.cos((t * Math.PI) / 2)), hThroat * t));
  }
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector2(rThroat + (rExit - rThroat) * Math.pow(t, 0.55), hThroat + (length - hThroat) * t));
  }
  // Levre : le bord de sortie est une piece epaisse, pas une arete de papier.
  pts.push(new THREE.Vector2(rExit * 1.035, length));
  return { points: pts, rExit };
}

/** Panneau portant trapezoidal, dans le plan (x = corde, y = envergure). */
function panelGeometry(rootChord, tipChord, span, sweep, thickness) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(rootChord, 0);
  s.lineTo(Math.max(tipChord * 0.2, rootChord - sweep), span);
  s.lineTo(Math.max(0, rootChord - sweep - tipChord), span);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/**
 * Corps porteur hypersonique.
 *
 * Ce n'est PAS un cone de rentree, et la silhouette doit le dire : plat
 * dessous, bombe dessus, plus large que haut. Le dessous est la surface de
 * compression — c'est lui qui porte, et c'est lui qui prend la chaleur, d'ou
 * un materiau distinct sur toute la face inferieure.
 *
 * Les groupes de la geometrie separent dessus, dessous et culot pour pouvoir
 * leur donner trois materiaux sans tripler le nombre d'objets dessines.
 */
function liftingBodyGeometry(length, halfSpan, height) {
  const NS = 18; // stations le long du corps
  const NC = 20; // points par section
  const upper = height * 0.78;
  const lower = height * 0.22; // ventre presque plat
  const pos = [];
  const idx = [];

  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1); // 0 au nez, 1 au culot
    const x = length * (1 - u);
    const w = halfSpan * Math.pow(Math.max(u, 1e-3), 0.62);
    const hu = upper * Math.pow(Math.max(u, 1e-3), 0.55);
    const hd = lower * Math.pow(Math.max(u, 1e-3), 0.8);
    for (let k = 0; k < NC; k++) {
      const phi = (2 * Math.PI * k) / NC;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      // Superellipse : exposants sous 1 pour aplatir les flancs et donner des
      // bords d'attaque francs, comme sur un waverider.
      const z = w * Math.sign(c) * Math.pow(Math.abs(c), 0.72);
      const y = (s >= 0 ? hu : hd) * Math.sign(s) * Math.pow(Math.abs(s), 0.62);
      pos.push(x, y, z);
    }
  }

  const top = [];
  const bottom = [];
  for (let i = 0; i < NS - 1; i++) {
    for (let k = 0; k < NC; k++) {
      const k2 = (k + 1) % NC;
      const a = i * NC + k, b = i * NC + k2, c = (i + 1) * NC + k2, d = (i + 1) * NC + k;
      const phi = (2 * Math.PI * (k + 0.5)) / NC;
      (Math.sin(phi) >= 0 ? top : bottom).push(a, b, c, a, c, d);
    }
  }
  // Culot plat : sans lui on verrait l'interieur du corps par l'arriere.
  const base = [];
  const centre = pos.length / 3;
  pos.push(0, 0, 0);
  for (let k = 0; k < NC; k++) {
    base.push((NS - 1) * NC + k, (NS - 1) * NC + ((k + 1) % NC), centre);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex([...top, ...bottom, ...base]);
  geo.addGroup(0, top.length, 0);
  geo.addGroup(top.length, bottom.length, 1);
  geo.addGroup(top.length + bottom.length, base.length, 2);
  geo.computeVertexNormals();
  return geo;
}

function buildMaterials() {
  return {
    // Contraste MAT / SPECULAIRE : sans environnement, c'est la rugosite qui
    // porte toute la difference de matiere, la metallicite n'y suffit pas.
    body: new THREE.MeshStandardMaterial({ color: 0xb9c1ca, roughness: 0.34, metalness: 0.34 }),
    matte: new THREE.MeshStandardMaterial({ color: 0x7f8892, roughness: 0.94, metalness: 0.04 }),
    band: new THREE.MeshStandardMaterial({ color: 0x6c7683, roughness: 0.55, metalness: 0.25 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.82, metalness: 0.18 }),
    tps: new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.96, metalness: 0.02 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9d9484, roughness: 0.26, metalness: 0.58 }),
    // Refractaire : vu de l'exterieur ET de l'interieur, puisqu'en vue de
    // poursuite la camera regarde droit dans la cloche.
    throat: new THREE.MeshStandardMaterial({
      color: 0x1d1a17, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide,
    }),
  };
}

/** Tuyere complete : cloche, levre et attache, orientee vers -X. */
function buildNozzle(rBody, length, mats) {
  const g = new THREE.Group();
  const { points, rExit } = nozzleProfile(rBody, length);
  g.add(new THREE.Mesh(latheX(points, 22, -1), mats.throat));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rExit, rBody * 0.022, 5, 22), mats.metal);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = -length;
  g.add(lip);
  return g;
}

/**
 * Construit le modele. L'axe longitudinal est +X, comme le repere du corps :
 * l'orientation se pose alors directement depuis le quaternion d'attitude.
 */
export function buildMissile(veh) {
  const dim = vehicleDimensions(veh);
  const mats = buildMaterials();
  const group = new THREE.Group();
  const R = dim.diameter / 2;
  const n = dim.stages.length;

  // --- Charge utile, de x = 0 vers +X ---
  const payload = new THREE.Group();
  if (veh.glide) {
    const L = dim.payloadLength;
    const hs = dim.payloadSpan / 2;
    const h = dim.payloadHeight;
    const body = new THREE.Mesh(
      liftingBodyGeometry(L, hs, h),
      [mats.matte, mats.tps, mats.dark], // dessus / dessous / culot
    );
    payload.add(body);

    // Bord d'attaque emousse : c'est la piece la plus chaude du vehicule, et
    // c'est elle qui impose le materiau de toute la face inferieure.
    const nose = new THREE.Mesh(new THREE.SphereGeometry(h * 0.14, 10, 8), mats.tps);
    nose.position.x = L * 0.985;
    payload.add(nose);

    // Derives cantees en bout d'aile : le corps porteur manoeuvre en gite
    // jusqu'a 55 degres, il lui faut de quoi tenir en lacet. Elles sont
    // enracinees SOUS la surface pour qu'aucun jour n'apparaisse au raccord.
    const finGeo = panelGeometry(L * 0.26, L * 0.11, h * 0.7, L * 0.13, h * 0.06);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, mats.dark);
      fin.rotation.x = s * 0.42; // cantee vers l'exterieur
      fin.position.set(L * 0.1, h * 0.25, s * hs * 0.62);
      payload.add(fin);
    }
    // Volets de culot : les gouvernes de tangage. Elles debordent derriere le
    // culot, sinon elles n'auraient aucun bras de levier.
    const flapGeo = panelGeometry(L * 0.13, L * 0.13, hs * 0.45, 0, h * 0.05);
    for (const s of [-1, 1]) {
      const flap = new THREE.Mesh(flapGeo, mats.dark);
      flap.rotation.x = s * (Math.PI / 2 - 0.18);
      flap.position.set(-L * 0.1, h * 0.02, s * hs * 0.22);
      payload.add(flap);
    }
  } else {
    const body = new THREE.Mesh(
      latheX(bluntConeProfile(dim.payloadDiameter / 2, dim.payloadLength), 22),
      mats.tps,
    );
    payload.add(body);
    // Jupe de culot : la seule piece claire du corps de rentree, elle donne
    // l'echelle et marque le sens du cone.
    payload.add(new THREE.Mesh(
      tubeX(dim.payloadDiameter * 0.5, dim.payloadDiameter * 0.52, 0, dim.payloadLength * 0.07, 22),
      mats.band,
    ));
  }
  group.add(payload);

  // --- Coiffe ---
  // Elle enveloppe la charge pendant toute la propulsion et disparait a la
  // separation : c'est ce qui rend l'evenement visible en vue de poursuite,
  // et ce qui explique qu'un planeur plus large que son lanceur soit portable.
  const shroud = new THREE.Group();
  shroud.add(new THREE.Mesh(
    latheX(ogiveProfile(dim.shroudRadius, dim.shroudLength), 26),
    mats.body,
  ));
  shroud.add(new THREE.Mesh(
    latheX(ogiveProfile(dim.shroudRadius * 0.28, dim.shroudLength * 0.16), 16),
    mats.tps,
  ).translateX(dim.shroudLength * 0.84));
  shroud.add(new THREE.Mesh(
    tubeX(dim.shroudRadius * 1.012, dim.shroudRadius * 1.012, 0.02, dim.shroudLength * 0.05, 26, true),
    mats.dark,
  ));
  group.add(shroud);

  // --- Etages ---
  // Le premier etage est celui qui allume en premier, il est donc TOUT EN BAS.
  // On empile depuis la coiffe vers -X en partant du dernier etage : sans quoi
  // la flamme du decollage sortirait du milieu de l'engin.
  const front = new Array(n);
  let x = 0;
  for (let i = n - 1; i >= 0; i--) {
    front[i] = x;
    x -= dim.stages[i].length;
  }

  const stageMeshes = [];
  for (let i = 0; i < n; i++) {
    const L = dim.stages[i].length;
    const g = new THREE.Group();
    const aft = front[i] - L;
    const nozzleLen = R * 1.05;
    // Carenage d'interetage : plus etroit que les corps qu'il relie, et assez
    // long pour loger la cloche de l'etage superieur, qui vit dedans jusqu'au
    // largage. Il part avec l'etage qu'il coiffe — d'ou la cloche nue qui
    // apparait a l'etagement.
    const inter = Math.min(L * 0.34, Math.max(R * 0.34, nozzleLen * 1.12));

    // Corps. Le premier etage est verni, les suivants sont mats : deux etages
    // superposes ne doivent pas se lire comme un seul tube.
    g.add(new THREE.Mesh(tubeX(R, R, aft, front[i] - inter, 26), i === 0 ? mats.body : mats.matte));

    // Le carenage est en DEUX pieces, une taille cylindrique puis une
    // evasee : un simple tronc de cone se confondrait avec le bandeau qu'on y
    // pose, et les deux surfaces se disputeraient le meme z.
    const topR = i === n - 1 ? dim.shroudRadius : R;
    g.add(new THREE.Mesh(tubeX(R * 0.86, R * 0.86, front[i] - inter, front[i] - inter * 0.42, 26), mats.dark));
    g.add(new THREE.Mesh(tubeX(topR * 0.955, R * 0.86, front[i] - inter * 0.42, front[i], 26), mats.band));

    // Bandes : elles marquent les liaisons et donnent une echelle au tube nu.
    g.add(new THREE.Mesh(tubeX(R * 1.008, R * 1.008, aft + L * 0.06, aft + L * 0.1, 26, true), mats.band));
    g.add(new THREE.Mesh(tubeX(R * 1.02, R * 1.02, aft, aft + L * 0.045, 26, true), mats.dark));

    // Chemin de cables : un detail reel, et surtout le seul repere de ROULIS
    // dont dispose l'oeil sur un cylindre de revolution.
    const race = new THREE.Mesh(
      tubeX(R * 0.055, R * 0.055, aft + L * 0.04, front[i] - inter, 8),
      mats.dark,
    );
    race.position.y = R * 1.02;
    g.add(race);

    g.add(buildNozzle(R, nozzleLen, mats).translateX(aft));

    // Empennage sur le premier etage des vecteurs courts. Un tri-etage est
    // pilote au braquage de tuyere et n'en porte pas : c'est une difference de
    // conception, pas une decoration.
    if (i === 0 && n < 3) {
      const finGeo = panelGeometry(L * 0.17, R * 0.55, R * 0.8, R * 0.75, R * 0.045);
      finGeo.translate(aft + L * 0.02, R * 0.97, 0);
      for (let k = 0; k < 4; k++) {
        const fin = new THREE.Mesh(finGeo, mats.dark);
        fin.rotation.x = (k * Math.PI) / 2;
        g.add(fin);
      }
    }

    g.userData.nozzleX = aft - nozzleLen;
    group.add(g);
    stageMeshes.push(g);
  }

  group.scale.setScalar(SCENE_SCALE);

  return {
    group,
    dim,
    payload,
    stages: stageMeshes,
    /** Masque les etages deja largues. */
    setStage(index, separated) {
      for (let i = 0; i < stageMeshes.length; i++) {
        stageMeshes[i].visible = !separated && i >= index;
      }
      payload.visible = true;
      shroud.visible = !separated;
    },
    /** Position de la tuyere active, en unites du modele. */
    nozzleX(index) {
      const g = stageMeshes[index];
      return g ? g.userData.nozzleX : 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Panache
// ---------------------------------------------------------------------------

/**
 * Empilement de disques orientes camera, repartis le long de l'axe du jet.
 *
 * Pourquoi des disques et non un cone : un cone montre sa silhouette, et cette
 * silhouette est une arete. Des disques additifs a profil gaussien se fondent
 * les uns dans les autres et n'ont de bord nulle part, quel que soit l'angle —
 * y compris en vue de poursuite, ou l'on regarde le jet PRESQUE dans l'axe et
 * ou tout billboard cylindrique s'effondrerait.
 */
function discStackGeometry(count) {
  const pos = new Float32Array(count * 4 * 3);
  const corner = new Float32Array(count * 4 * 2);
  const seed = new Float32Array(count * 4);
  const idx = new Uint16Array(count * 6);
  const CX = [-1, 1, 1, -1];
  const CY = [-1, -1, 1, 1];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1);
    // Graine deterministe : le scintillement doit etre irregulier, pas
    // aleatoire d'une execution a l'autre.
    const s = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      pos[v * 3] = u;
      corner[v * 2] = CX[k];
      corner[v * 2 + 1] = CY[k];
      seed[v] = s;
    }
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

const PLUME_VERT = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec2 aCorner;
  attribute float aSeed;
  uniform float uLen, uR0, uFlare, uCellAmp, uCellFreq, uTime, uJitter;
  varying vec2 vC;
  varying float vU, vCell, vSeed;
  void main() {
    float u = position.x;
    vU = u;
    vC = aCorner;
    vSeed = aSeed;
    // Cellules de choc : le jet sur-detendu se pince periodiquement, et
    // l'amplitude s'amortit vers l'aval.
    vCell = cos(u * uCellFreq * 6.28318 + 0.6) * exp(-2.2 * u);
    float r = uR0 * (1.0 + uFlare * pow(max(u, 1e-4), 0.72));
    r *= 1.0 - uCellAmp * vCell;
    r *= 1.0 + uJitter * sin(uTime * (5.0 + 11.0 * aSeed) + aSeed * 43.0);
    // Le jet part vers -X : la tuyere regarde vers l'arriere de l'engin.
    vec4 mv = modelViewMatrix * vec4(-u * uLen, 0.0, 0.0, 1.0);
    // Facteur d'echelle du modele. Les rayons sont exprimes en metres du
    // modele, la position en unites de vue : sans ce facteur le panache
    // mesurerait un millier de kilometres.
    float sc = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    mv.xy += aCorner * r * sc;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const PLUME_FRAG = `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uHot, uMid, uCool;
  uniform float uAlpha, uSoft, uNode, uTail;
  varying vec2 vC;
  varying float vU, vCell, vSeed;
  void main() {
    #include <logdepthbuf_fragment>
    float d2 = dot(vC, vC);
    if (d2 > 1.0) discard;
    // Gaussienne recalee a zero sur le bord : c'est ELLE qui supprime l'arete.
    float g = (exp(-uSoft * d2) - exp(-uSoft)) / (1.0 - exp(-uSoft));
    if (g <= 0.0) discard;
    float axial = exp(-uTail * vU) * (1.0 - smoothstep(0.7, 1.0, vU));
    float node = uNode * pow(max(0.0, vCell), 3.0);
    float b = axial * (1.0 + node);
    vec3 col = mix(uCool, uMid, clamp(b * 1.7, 0.0, 1.0));
    col = mix(col, uHot, clamp((b - 0.5) * 2.4, 0.0, 1.0));
    gl_FragColor = vec4(col, clamp(g * b * uAlpha, 0.0, 1.0));
  }`;

function plumeLayer(geo, colors, soft, tail) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLUME_VERT,
    fragmentShader: PLUME_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uLen: { value: 1 }, uR0: { value: 1 }, uFlare: { value: 1 },
      uCellAmp: { value: 0 }, uCellFreq: { value: 4 }, uTime: { value: 0 },
      uJitter: { value: 0 }, uAlpha: { value: 1 }, uSoft: { value: soft },
      uNode: { value: 0 }, uTail: { value: tail },
      uHot: { value: new THREE.Color(colors[0]) },
      uMid: { value: new THREE.Color(colors[1]) },
      uCool: { value: new THREE.Color(colors[2]) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Le panache mesure quelques metres dans une scene de milliers de
  // kilometres : sa sphere englobante est en dessous de la precision du test
  // de frustum, qui l'eliminerait au hasard.
  mesh.frustumCulled = false;
  return mesh;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1e-3;

/**
 * Panache de tuyere.
 *
 * Trois couches, parce qu'un jet de fusee en a trois : un coeur tres court et
 * quasi blanc juste apres la gorge, le panache principal ou apparaissent les
 * disques de Mach, et un halo diffus de gaz brules qui n'a plus de forme.
 *
 * Sa longueur suit la poussee ET la pression ambiante : dans le vide le jet
 * s'epanouit sans rien pour le contenir et devient enorme, alors qu'au niveau
 * de la mer il reste court et resserre. Les disques de Mach suivent la meme
 * cause en sens inverse : ils naissent du desaccord entre pression de sortie
 * et pression ambiante, donc ils sont marques au sol et s'effacent en altitude
 * — dans le vide il n'y a plus rien pour reflechir un choc.
 */
export function buildPlume(diameter) {
  const group = new THREE.Group();
  const longGeo = discStackGeometry(30);
  const shortGeo = discStackGeometry(10);

  const halo = plumeLayer(longGeo, [0xff9a3c, 0xff5a18, 0x7d2406], 1.8, 0.9);
  const jet = plumeLayer(longGeo, [0xfff3d2, 0xffb457, 0xff5e15], 3.0, 1.2);
  const core = plumeLayer(shortGeo, [0xffffff, 0xffeec4, 0xffb562], 4.2, 1.8);
  group.add(halo, jet, core);
  group.visible = false;

  // Uniformes captures une fois : la mise a jour n'ecrit ensuite que des
  // nombres, sans creer le moindre objet — c'est la boucle de rendu.
  const uh = halo.material.uniforms;
  const uj = jet.material.uniforms;
  const uc = core.material.uniforms;

  let slow = 0;
  let fast = 0;

  return {
    group,
    /**
     * @param {number} thrustRatio 0..1, poussee courante rapportee au maximum
     * @param {number} pressureRatio 0..1, pression ambiante rapportee au sol
     * @param {number} flicker bruit blanc -1..1 fourni par l'appelant
     */
    update(thrustRatio, pressureRatio = 1, flicker = 0) {
      if (thrustRatio <= 0.01) { group.visible = false; return; }
      group.visible = true;
      const p = Math.min(1, Math.max(0, pressureRatio));
      const vac = 1 - p;

      // Le bruit blanc recu est filtre a DEUX constantes de temps : une
      // combustion n'a ni la regularite d'une sinusoide ni l'agitation d'un
      // tirage independant a chaque image.
      slow += (flicker - slow) * 0.05;
      fast += (flicker - fast) * 0.4;
      const flick = 0.65 * slow + 0.35 * fast;

      // L'epanouissement se joue dans la DERNIERE decade de pression : tant
      // qu'il reste de l'air, il contient le jet. Une loi lineaire en altitude
      // donnerait un panache deja demesure a cinq kilometres.
      const expand = 1 + 3.4 * vac * vac;
      const len = diameter * (2.6 + 5.4 * thrustRatio) * expand * (0.95 + 0.1 * flick);
      // Le profil gaussien s'eteint bien avant le bord du disque : il faut
      // donc un rayon de disque nettement plus grand que le rayon PHYSIQUE du
      // jet pour que le jet visible fasse la bonne taille a la sortie.
      const r0 = diameter * 0.6;
      const flare = 0.65 + 5.0 * vac * vac;
      const t = now();
      // Les disques de Mach ne vivent que dans un jet SOUS-DETENDU : c'est le
      // desaccord avec la pression ambiante qui reflechit le choc de proche en
      // proche. Dans le vide il n'y a plus rien pour le renvoyer, ils
      // disparaissent — et le jet s'ouvre d'autant.
      const cellAmp = 0.26 * Math.pow(p, 0.6) * thrustRatio;

      uh.uLen.value = len * 1.45;
      uh.uR0.value = r0 * 2.1;
      uh.uFlare.value = flare * 1.25;
      uh.uCellAmp.value = 0;
      uh.uNode.value = 0;
      uh.uJitter.value = 0.05 + 0.05 * vac;
      uh.uAlpha.value = (0.13 + 0.1 * thrustRatio) * (0.75 + 0.45 * vac);
      uh.uTime.value = t;

      uj.uLen.value = len;
      uj.uR0.value = r0;
      uj.uFlare.value = flare;
      uj.uCellAmp.value = cellAmp;
      uj.uCellFreq.value = 2.5 + 4.5 * p;
      uj.uNode.value = 1.9 * Math.pow(p, 0.7);
      uj.uJitter.value = 0.03 + 0.04 * (1 - thrustRatio);
      uj.uAlpha.value = 0.55 + 0.3 * thrustRatio + 0.06 * flick;
      uj.uTime.value = t;

      uc.uLen.value = diameter * (0.7 + 1.1 * thrustRatio) * (1 + 0.7 * vac);
      uc.uR0.value = r0 * 0.72;
      uc.uFlare.value = 0.25 + 0.9 * vac;
      uc.uCellAmp.value = 0.3 * p;
      uc.uCellFreq.value = 6;
      uc.uNode.value = 1.2 * p;
      uc.uJitter.value = 0.02;
      uc.uAlpha.value = 0.55 + 0.12 * flick;
      uc.uTime.value = t;
    },
  };
}

/**
 * Fumee laissee derriere l'engin.
 *
 * Elle n'a de sens que dans l'atmosphere : au-dessus, il n'y a rien pour
 * diffuser les gaz et le panache disparait aussitot. Les particules sont
 * emises en repere terrestre puis grossissent et s'effacent.
 */
export function buildSmoke(maxParticles = 900) {
  const positions = new Float32Array(maxParticles * 3);
  const ages = new Float32Array(maxParticles);
  const sizes = new Float32Array(maxParticles);
  const alphas = new Float32Array(maxParticles);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setDrawRange(0, 0);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xcfd6dd) },
      // Facteur de projection : hauteur du viewport / (2 tan(fov/2)). Sans lui,
      // la taille a l'ecran ne correspondrait a aucune taille physique, et une
      // bouffee de fumee de trente metres remplirait l'ecran vue de pres.
      uProj: { value: 800 },
    },
    // Les chunks de profondeur logarithmique sont OBLIGATOIRES ici : le tampon
    // contient des log2, et un fragment qui ecrirait un z lineaire echouerait
    // le test contre tout ce qui a deja ete dessine — la fumee disparaitrait
    // des qu'elle passe devant le sol.
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize;   // rayon REEL de la bouffee, en unites de scene
      attribute float aAlpha;
      uniform float uProj;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uProj / max(1e-7, -mv.z), 1.0, 380.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float a = vAlpha * (1.0 - smoothstep(0.15, 0.5, r));
        gl_FragColor = vec4(uColor, a);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let count = 0;
  let head = 0;

  return {
    points,
    /** A rappeler quand la camera change d'ouverture ou la fenetre de taille. */
    setProjection(viewportHeight, fovDegrees) {
      mat.uniforms.uProj.value = viewportHeight / (2 * Math.tan((fovDegrees * Math.PI) / 360));
    },
    clear() { count = 0; head = 0; geo.setDrawRange(0, 0); },
    /** Emet une bouffee a la position donnee (unites de scene). */
    emit(x, y, z, densityRatio) {
      if (densityRatio < 0.002) return; // plus rien a diffuser en altitude
      positions[head * 3] = x;
      positions[head * 3 + 1] = y;
      positions[head * 3 + 2] = z;
      ages[head] = 0;
      sizes[head] = 12 * SCENE_SCALE; // 12 m au moment de l'emission
      alphas[head] = Math.min(0.55, 0.15 + densityRatio * 1.2);
      head = (head + 1) % maxParticles;
      count = Math.min(count + 1, maxParticles);
      geo.setDrawRange(0, count);
    },
    /** Vieillit les bouffees : elles grossissent et s'effacent. */
    update(dt) {
      if (!count) return;
      for (let i = 0; i < count; i++) {
        ages[i] += dt;
        const a = ages[i];
        // La bouffee se dilate de douze metres a environ deux cents.
        sizes[i] = (12 + 190 * Math.min(1, a / 20)) * SCENE_SCALE;
        alphas[i] = Math.max(0, alphas[i] - dt * 0.02);
      }
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------
// Gaine de plasma
// ---------------------------------------------------------------------------

// Echelle de couleur du gaz de choc, indexee par la temperature de paroi.
// L'ordre rouge sombre -> orange -> blanc bleute n'est pas un choix
// esthetique : c'est la sequence d'un corps qui monte en temperature, et elle
// dit a elle seule si la rentree est douce ou brutale.
const PLASMA_STOPS = [
  [1800, new THREE.Color(0x3a0a02)],
  [2200, new THREE.Color(0xa32406)],
  [2700, new THREE.Color(0xff6a16)],
  [3200, new THREE.Color(0xffbe7a)],
  [4200, new THREE.Color(0xcfe2ff)],
];

function plasmaColor(temp, out) {
  if (temp <= PLASMA_STOPS[0][0]) return out.copy(PLASMA_STOPS[0][1]);
  for (let i = 1; i < PLASMA_STOPS.length; i++) {
    if (temp <= PLASMA_STOPS[i][0]) {
      const [t0, c0] = PLASMA_STOPS[i - 1];
      const [t1, c1] = PLASMA_STOPS[i];
      return out.copy(c0).lerp(c1, (temp - t0) / (t1 - t0));
    }
  }
  return out.copy(PLASMA_STOPS[PLASMA_STOPS.length - 1][1]);
}

/** Profil de la gaine : calotte devant le nez, puis sillage qui s'etire. */
function plasmaProfile(nose, radius, wake, n = 26) {
  const pts = [];
  for (let i = n; i >= 0; i--) {
    // Echantillonnage resserre vers l'avant, ou tout se passe.
    const h = nose - (nose + wake) * Math.pow(i / n, 1.35);
    let r;
    if (h >= 0) {
      r = radius * Math.sqrt(Math.max(0, 1 - (h / nose) ** 2));
    } else {
      const q = -h / wake;
      r = radius * (1 + 0.75 * Math.sqrt(q)) * (1 - q * q);
    }
    pts.push(new THREE.Vector2(Math.max(1e-4, r), h));
  }
  return pts;
}

const PLASMA_VERT = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying float vRim, vAx;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nrm = normalize(normalMatrix * normal);
    // Terme de bord : la couche de choc est une COQUILLE, et une coquille
    // brille sur son contour, la ou le regard la traverse en biais.
    vRim = 1.0 - abs(dot(nrm, normalize(-mv.xyz)));
    vAx = position.x;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const PLASMA_FRAG = `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uCore, uEdge;
  uniform float uIntensity, uRim;
  varying float vRim, vAx;
  void main() {
    #include <logdepthbuf_fragment>
    // La geometrie est normalisee : le nez est vers x = 0.55, le sillage en
    // x < 0. Le maximum est atteint des l'avant du corps, pas a la pointe de
    // la coque : c'est la region d'arret qui chauffe, et elle est courte.
    float front = smoothstep(-0.35, 0.3, vAx);
    float tail = exp(-1.35 * max(0.0, -vAx));
    float b = (0.28 + 0.72 * front) * tail;
    // Une coque optiquement mince brille la ou le regard la traverse en
    // biais. On amortit tout de meme l'incidence rasante extreme, sinon la
    // silhouette se dessine au trait et redonne le bord franc qu'on fuit.
    float rim = pow(clamp(vRim, 0.0, 1.0), 1.6) * (1.0 - 0.7 * smoothstep(0.82, 1.0, vRim));
    vec3 col = mix(uEdge, uCore, clamp(b * 1.3, 0.0, 1.0));
    gl_FragColor = vec4(col, clamp(uIntensity * b * (0.3 + uRim * rim), 0.0, 1.0));
  }`;

function plasmaLayer(nose, radius, wake, rim) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLASMA_VERT,
    fragmentShader: PLASMA_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCore: { value: new THREE.Color(0xff6a16) },
      uEdge: { value: new THREE.Color(0x6b1404) },
      uIntensity: { value: 0 },
      uRim: { value: rim },
    },
  });
  const mesh = new THREE.Mesh(latheX(plasmaProfile(nose, radius, wake), 22), mat);
  mesh.frustumCulled = false;
  return mesh;
}

// Objet reutilise a chaque image pour lire le releve aerothermique : la boucle
// de rendu ne doit rien allouer.
const _thermal = { q: 0, temp: 0 };

/**
 * Normalise ce que l'appelant fournit. On accepte aussi bien un instantane
 * `{ heatRate, surfaceTemp }` qu'un objet portant `snapshot()` ou une fonction
 * qui le rend : le module de simulation peut evoluer sans casser le rendu, et
 * son absence n'est pas une erreur.
 */
function readThermal(src) {
  if (!src) return null;
  let s = src;
  if (typeof s === 'function') s = s();
  else if (typeof s.snapshot === 'function') s = s.snapshot();
  if (!s) return null;
  const q = Number.isFinite(s.heatRate) ? s.heatRate : null;
  const temp = Number.isFinite(s.surfaceTemp) ? s.surfaceTemp : null;
  if (q === null && temp === null) return null;
  _thermal.q = q;
  _thermal.temp = temp;
  return _thermal;
}

/**
 * Gaine de plasma de rentree.
 *
 * L'intensite suit le flux de chaleur, qui varie comme la racine de la densite
 * et le CUBE de la vitesse : d'ou une apparition tres brutale a l'entree dans
 * l'atmosphere. La couleur, elle, suit la temperature de paroi — c'est la
 * meme grandeur que celle qu'affiche la telemetrie, et l'oeil doit pouvoir la
 * lire sans regarder les chiffres.
 *
 * L'orientation n'est pas fournie par l'appelant : on la deduit du deplacement
 * de la gaine entre deux images. C'est suffisant, et cela evite d'imposer un
 * argument de plus a un contrat que d'autres modules appellent.
 */
export function buildReentryGlow(options = {}) {
  const noseRadius = options.noseRadius > 0 ? options.noseRadius : FALLBACK_NOSE_RADIUS;

  const mesh = plasmaLayer(0.55, 0.16, 2.6, 1.5);
  // Couche externe : l'air choque lumineux qui deborde de la gaine. Plus
  // large, plus froide, presque pas de bord.
  const outer = plasmaLayer(0.78, 0.32, 3.2, 0.8);
  mesh.add(outer);
  mesh.visible = false;

  const prev = new THREE.Vector3();
  const dir = new THREE.Vector3(1, 0, 0);
  const step = new THREE.Vector3();
  const core = new THREE.Color();
  const edge = new THREE.Color();
  let havePrev = false;

  return {
    mesh,
    /**
     * @param {number} rho masse volumique de l'air [kg/m^3]
     * @param {number} speed vitesse par rapport a l'air [m/s]
     * @param {number} size echelle du vehicule, en unites de scene
     * @param {object} [thermal] releve aerothermique, s'il en existe un
     */
    update(rho, speed, size, thermal) {
      // Le suivi de direction se fait AVANT toute sortie anticipee : sinon la
      // gaine apparaitrait orientee sur un deplacement vieux de plusieurs
      // secondes le jour ou elle s'allume.
      if (havePrev) {
        step.copy(mesh.position).sub(prev);
        if (step.lengthSq() > 1e-18) {
          dir.lerp(step.normalize(), 0.3).normalize();
          mesh.quaternion.setFromUnitVectors(AXIS_X, dir);
        }
      }
      prev.copy(mesh.position);
      havePrev = true;

      const th = readThermal(thermal);
      let q = th && th.q !== null ? th.q : null;
      if (q === null && !(th && th.temp !== null)) {
        q = rho > 0 && speed > 0
          ? SUTTON_GRAVES_K * Math.sqrt(rho / noseRadius) * speed ** 3
          : 0;
      }
      const temp = th && th.temp !== null
        ? th.temp
        : Math.pow(Math.max(0, q) / (TPS_EMISSIVITY * STEFAN_BOLTZMANN), 0.25);

      // Seuil haut a dessein : au maximum de pression dynamique de la montee,
      // le nez du lanceur depasse deja 1600 K. Une gaine visible a ce
      // moment-la mentirait — c'est a la rentree, deux fois plus chaud, que le
      // gaz s'ionise et rayonne.
      const k = Math.min(1, Math.max(0, (temp - 1900) / 1500));
      mesh.visible = k > 0.015;
      if (!mesh.visible) return;

      plasmaColor(temp, core);
      plasmaColor(temp * 0.82, edge);
      mesh.material.uniforms.uCore.value.copy(core);
      mesh.material.uniforms.uEdge.value.copy(edge);
      outer.material.uniforms.uCore.value.copy(edge);
      outer.material.uniforms.uEdge.value.copy(edge).multiplyScalar(0.6);
      mesh.material.uniforms.uIntensity.value = 0.95 * k;
      outer.material.uniforms.uIntensity.value = 0.3 * k * k;
      mesh.scale.setScalar(size * (0.8 + 0.45 * k));
    },
  };
}
