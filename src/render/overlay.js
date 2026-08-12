// Surcouche graphique : traces, reperes et arc de grand cercle.
//
// Deux traces sont dessinees en permanence : la trajectoire REELLE et celle
// que le calculateur croit suivre. L'ecart entre les deux courbes est le sujet
// meme du simulateur, et il doit se voir a l'oeil.

import * as THREE from 'three';
import { llaToEcef, eciToEcef } from '../core/geodesy.js';
import { EARTH, DEG } from '../core/constants.js';
import * as V from '../core/vec.js';
import { atmosphere } from '../core/atmosphere.js';
import { computeForces, airRelativeVelocity } from '../sim/dynamics.js';
import { toScene, SCENE_SCALE } from './globe.js';
import { buildMissile, buildPlume, buildSmoke, buildReentryGlow } from './missile.js';
import { buildDetonation } from './detonation.js';

const MAX_POINTS = 4200;

// Un cone de three.js pointe vers +Y : c'est l'axe a faire tourner pour aligner
// le dard sur la trajectoire.
const CONE_AXIS = new THREE.Vector3(0, 1, 0);

// --- Tailles apparentes ---------------------------------------------------
//
// Un repere au sol n'est pas un objet : c'est un signe. Il doit donc occuper
// toujours la meme place a l'ecran, qu'on le regarde depuis l'orbite ou depuis
// vingt kilometres d'altitude. Toutes les tailles qui suivent sont donc
// exprimees en FRACTION DE LA HAUTEUR DE L'IMAGE, et retraduites en unites de
// scene a chaque image par `_screenSpan` — une constante en unites de scene
// n'aurait aucun sens ici, 0,25 unite valant deux cent cinquante kilometres.
const MARKER_SCREEN_R = 0.020;
const VEHICLE_SCREEN_H = 0.019;
const GHOST_SCREEN_R = 0.009;
const DASH_SCREEN = 0.024;

// Tailles au repos, qui servent d'etalon a la conversion ci-dessus. Les quatre
// reperes gardent ainsi entre eux la hierarchie voulue : l'objectif est le plus
// gros, le jalon de ressource le plus discret.
const MARKER_REF_R = 0.115;
const VEHICLE_REF_H = 0.15;
const GHOST_REF_R = 0.075;

// Bornes de l'echelle des reperes.
//
// Plancher : en vue au sol la camera est PLANTEE a trois cents metres du pas de
// tir. La regle de taille apparente y reduirait l'anneau a un point ; en dessous
// de ce seuil il cesse donc de retrecir et redevient ce qu'il figure, un cercle
// d'une trentaine de metres pose sur l'aire de lancement.
// Plafond : recule au maximum, le globe ne fait plus qu'un pouce a l'ecran, et
// un repere de taille constante finirait par l'avaler.
const MARKER_MIN = 1.6e-4;
const MARKER_MAX = 7;

// Opacite du bout de queue des traces.
const TAIL_MIN = 0.14;

export const COLORS = {
  truth: 0x3ddc84,
  estimate: 0xffb038,
  plan: 0x5b8fc9,
  target: 0xff4d5a,
  launch: 0x49e3a0,
  impact: 0xff9f1c,
  aim: 0xc77dff,
};

function makeLine(color, opacity = 1, width = 2) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity, linewidth: width, depthTest: true,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  return line;
}

/**
 * Trace de vol : meme tampon pre-alloue que ci-dessus, plus deux attributs.
 *
 * La couleur est portee par un vec4 et non un vec3 : c'est la seule facon
 * d'obtenir une opacite VARIABLE le long d'une meme ligne, three.js n'allant
 * chercher l'alpha des sommets que si l'attribut a quatre composantes. Les
 * trois premieres restent a 1 — la teinte vient du materiau, l'attribut ne sert
 * qu'a faire mourir la queue.
 *
 * `lineDistance` n'existe que pour la trace en pointilles : c'est la distance
 * cumulee que lit le nuanceur pour savoir ou couper. On la remplit a la main
 * dans `updateTrail` plutot que d'appeler `computeLineDistances`, qui realloue
 * un tableau a chaque appel — donc a chaque image.
 */
function makeTrail(color, opacity, dashed) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 4).fill(1), 4));
  if (dashed) {
    geo.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(MAX_POINTS), 1));
  }
  geo.setDrawRange(0, 0);

  const opts = {
    color, vertexColors: true, transparent: true, opacity,
    // Une ligne d'un pixel n'a rien a masquer : elle se teste contre la
    // profondeur du globe, mais n'ecrit pas la sienne. C'est ce qui permet a la
    // trace estimee, dessinee ensuite, de passer PAR-DESSUS la trace vraie au
    // lieu de se battre avec elle au pixel pres — les deux courbes sont
    // separees de quelques kilometres, soit un dixieme de pixel vu de l'orbite.
    depthWrite: false,
  };
  const mat = dashed
    ? new THREE.LineDashedMaterial({ ...opts, dashSize: 0.05, gapSize: 0.03 })
    : new THREE.LineBasicMaterial(opts);

  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  line.userData = { count: -1, tipRef: null, span: 0, tip: new THREE.Vector3() };
  return line;
}

// Tache ronde et floue, construite une seule fois. Elle sert de halo : dans
// WebGL `linewidth` ne fait rien, et la seule facon d'epaissir une ligne sans
// la reconstruire en ruban est de semer un point lumineux sur chacun de ses
// sommets.
let discTexture = null;
function softDisc() {
  if (discTexture) return discTexture;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  discTexture = new THREE.CanvasTexture(c);
  return discTexture;
}

/**
 * Pictogramme d'un repere, dessine a plat et toujours tourne vers la camera.
 *
 * La couleur ne suffit pas a distinguer quatre roles : un observateur daltonien
 * ne separe ni le vert du rouge, ni l'ambre du vert. La SILHOUETTE, elle, se
 * lit toujours — et de trois quarts, quand l'anneau au sol se reduit a un trait,
 * elle reste le seul indice lisible.
 */
function glyphGeometry(role, r) {
  if (role === 'launch') {
    // Triangle plein pointe en haut : ce qui part.
    return new THREE.CircleGeometry(r * 0.5, 3).rotateZ(Math.PI / 2);
  }
  if (role === 'impact') {
    // Losange creux : un point CALCULE, pas un lieu choisi. Quatre segments
    // suffisent a une couronne — three.js en fait un carre pose sur la pointe.
    return new THREE.RingGeometry(r * 0.4, r * 0.6, 4, 1);
  }
  if (role === 'pullup') {
    // Arc ouvert vers le bas : la ou le planeur cesse de tomber et se redresse.
    return new THREE.RingGeometry(r * 0.42, r * 0.62, 14, 1, Math.PI * 0.14, Math.PI * 0.72);
  }
  // Objectif : un reticule. Quatre traits qui visent le centre sans l'atteindre,
  // pour laisser voir le sol exactement la ou l'on tire.
  const inner = r * 0.28;
  const outer = r * 0.72;
  const half = r * 0.07;
  const pos = new Float32Array(4 * 6 * 3);
  let k = 0;
  for (let a = 0; a < 4; a++) {
    const c = Math.cos(a * Math.PI / 2);
    const s = Math.sin(a * Math.PI / 2);
    const put = (u, v) => { pos[k++] = u * c - v * s; pos[k++] = u * s + v * c; pos[k++] = 0; };
    put(inner, -half); put(outer, -half); put(outer, half);
    put(inner, -half); put(outer, half); put(inner, half);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geo;
}

/** Repere au sol : un anneau pose a plat sur la surface, et son pictogramme. */
function makeMarker(color, role, radius, opacity) {
  const group = new THREE.Group();
  const flat = (o) => new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: o, depthTest: false,
  });

  // Anneau FIN : ces reperes doivent se laisser trouver sans masquer le globe
  // ni la trajectoire, qui sont le vrai sujet.
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.87, radius, 48), flat(opacity));
  ring.renderOrder = 10;

  // Le pictogramme n'est PAS enfant de l'anneau : l'anneau est couche dans le
  // plan tangent, le pictogramme doit faire face a la camera. Deux enfants
  // freres d'un groupe sans rotation, chacun oriente pour son compte.
  const glyph = new THREE.Mesh(glyphGeometry(role, radius), flat(Math.min(1, opacity * 1.45)));
  glyph.renderOrder = 11;

  group.add(ring, glyph);
  group.visible = false;
  group.userData = { shown: false, ring, glyph };
  return group;
}

export class Overlay {
  constructor(view) {
    this.view = view;
    const s = view.scene;

    this.planLine = makeLine(COLORS.plan, 0.5);

    this.truthLine = makeTrail(COLORS.truth, 1, false);
    this.truthLine.renderOrder = 3;

    // Halo de la trace vraie : les memes sommets, semes en taches additives.
    // La geometrie est PARTAGEE avec la ligne — un appel de dessin de plus, pas
    // un octet de sommet de plus, et la queue s'estompe toute seule puisque
    // l'alpha vient du meme attribut.
    this.truthGlow = new THREE.Points(this.truthLine.geometry, new THREE.PointsMaterial({
      color: COLORS.truth,
      map: softDisc(),
      // Quelques pixels a peine, et une opacite tres faible : les points se
      // recouvrent largement le long de la trace, et leurs contributions
      // s'additionnent. Une tache un peu trop franche transforme la ligne en
      // gros ver lumineux et noie la trace estimee au lieu de la souligner.
      size: 6 * view.renderer.getPixelRatio(),
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.truthGlow.frustumCulled = false;
    this.truthGlow.renderOrder = 2;

    // La trace estimee est en POINTILLES. Vu de l'orbite, cinq kilometres
    // d'erreur de navigation valent un demi-pixel : pleine, la courbe ambre
    // recouvrirait purement et simplement la verte et l'on croirait a une seule
    // trajectoire. Coupee, elle laisse voir la verte entre ses tirets tant que
    // les deux se confondent, et se detache d'elle-meme quand elles divergent.
    this.estLine = makeTrail(COLORS.estimate, 0.95, true);
    this.estLine.renderOrder = 4;

    s.add(this.planLine, this.truthGlow, this.truthLine, this.estLine);

    // L'objectif reste le plus lisible des quatre ; le site de tir et le point
    // de ressource ne sont que des jalons et s'effacent davantage.
    this.markers = {
      launch: makeMarker(COLORS.launch, 'launch', 0.085, 0.62),
      target: makeMarker(COLORS.target, 'target', 0.115, 0.9),
      impact: makeMarker(COLORS.impact, 'impact', 0.10, 0.72),
      pullup: makeMarker(COLORS.aim, 'pullup', 0.075, 0.55),
    };
    for (const m of Object.values(this.markers)) s.add(m);

    // Les deux reperes de la vue orbitale. Ils forment une PAIRE, et leur
    // opposition doit se lire d'un coup d'oeil, car c'est le sujet meme du
    // simulateur : un dard plein qui vole vraiment, et un cercle vide a
    // l'endroit ou le calculateur s'imagine etre.
    //
    // Le dard est oriente sur la trajectoire : a cette distance c'est le seul
    // moyen de voir dans quel sens l'engin va.
    this.vehicle = new THREE.Mesh(
      new THREE.ConeGeometry(0.032, VEHICLE_REF_H, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    this.vehicle.renderOrder = 12;
    this.vehicle.visible = false;
    s.add(this.vehicle);

    // Position estimee : un anneau fin, toujours face camera. Creux parce
    // qu'il ne designe rien de materiel — seulement une croyance de bord.
    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.055, GHOST_REF_R, 32),
      new THREE.MeshBasicMaterial({
        color: COLORS.estimate, side: THREE.DoubleSide, transparent: true,
        opacity: 0.95, depthTest: false,
      }),
    );
    this.ghost.renderOrder = 12;
    this.ghost.visible = false;
    s.add(this.ghost);

    this.detonation = buildDetonation();
    s.add(this.detonation.group);
    // Vol dont on a deja montre le fonctionnement : sans ce garde-fou, l'effet
    // se rejouerait a chaque image une fois le vol termine.
    this.burstShown = null;

    this._v = new THREE.Vector3();
    this._tmpv = new THREE.Vector3();
    this._occ = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this.missile = null;
    this.smoke = null;

    // three.js n'offre pas de rappel « une fois par image » ; celui d'un objet
    // en tient lieu. Ce jeton ne dessine rien — sa plage de trace est vide — et
    // n'existe que pour recevoir le signal. Il en faut un : la taille des
    // reperes suit la camera, or celle-ci bouge aussi AVANT le tir, quand
    // `update` n'est pas appele faute de simulation. C'est le moment ou l'on
    // choisit son objectif a la souris, et ou les reperes doivent donc etre le
    // plus justes.
    const beat = new THREE.BufferGeometry();
    beat.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    beat.setDrawRange(0, 0);
    this._ticker = new THREE.Line(beat, new THREE.LineBasicMaterial());
    this._ticker.frustumCulled = false;
    this._ticker.onBeforeRender = () => {
      for (const m of Object.values(this.markers)) this._layout(m);
    };
    s.add(this._ticker);
  }

  /**
   * Longueur, en unites de scene, que couvre la HAUTEUR DE L'IMAGE a la
   * distance d'un point donne. Toute taille apparente se ramene a une fraction
   * de cette longueur : c'est ce qui permet a un signe de garder la meme place
   * a l'ecran vu de quarante mille kilometres comme vu de deux cents metres,
   * et de suivre au passage les changements d'ouverture — la vue au sol zoome
   * comme une paire de jumelles.
   */
  _screenSpan(point) {
    const cam = this.view.camera;
    const d = Math.max(1e-9, cam.position.distanceTo(point));
    return 2 * d * Math.tan(cam.fov * 0.5 * DEG);
  }

  /** Le point est-il passe derriere le globe ? */
  _occluded(p) {
    const toCam = this._occ.copy(this.view.camera.position).sub(p);
    return p.dot(toCam) < -0.02 * p.length() * toCam.length();
  }

  /**
   * Met un repere a sa taille et lui presente son pictogramme.
   *
   * On en profite pour l'effacer sous l'horizon : dessine sans test de
   * profondeur, il traverserait la planete et l'on verrait l'objectif briller
   * a travers six mille kilometres de roche — alors que son etiquette HTML,
   * elle, disparait bien (meme test dans `project`).
   */
  _layout(m) {
    if (!m.userData.shown) { m.visible = false; return; }
    if (this._occluded(m.position)) { m.visible = false; return; }
    m.visible = true;
    const k = MARKER_SCREEN_R * this._screenSpan(m.position) / MARKER_REF_R;
    m.scale.setScalar(Math.min(MARKER_MAX, Math.max(MARKER_MIN, k)));
    m.userData.glyph.quaternion.copy(this.view.camera.quaternion);
    // Le calcul peut arriver alors que le graphe est deja parcouru : on force
    // la mise a jour des matrices, faute de quoi la nouvelle taille ne serait
    // prise en compte qu'a l'image suivante.
    m.updateMatrixWorld(true);
  }

  /** Place un repere annulaire a plat sur la surface. */
  placeMarker(name, lat, lon, altitude) {
    const m = this.markers[name];
    if (!m) return;
    // Le repere se pose SUR le relief. Il est dessine sans test de profondeur :
    // inutile de le surelever pour empecher le globe de l'avaler, et en vue au
    // sol un anneau flottant a trente kilometres au-dessus du pas de tir
    // designerait le ciel plutot que l'aire de lancement.
    const ground = this.view.terrain ? this.view.terrain.elevation(lat, lon) : 0;
    const p = toScene(llaToEcef(lat, lon, altitude === undefined ? ground : altitude));
    m.position.copy(p);
    // L'anneau est couche dans le plan tangent : la verticale locale est la
    // droite qui joint le point au centre de la Terre.
    m.userData.ring.lookAt(0, 0, 0);
    m.userData.shown = true;
    this._layout(m);
  }

  hideMarker(name) {
    const m = this.markers[name];
    if (!m) return;
    m.userData.shown = false;
    m.visible = false;
  }

  /** Arc de grand cercle entre le site de tir et l'objectif. */
  setPlan(launch, target) {
    const a = toScene(llaToEcef(launch.lat, launch.lon, 0)).normalize();
    const b = toScene(llaToEcef(target.lat, target.lon, 0)).normalize();
    const n = 220;
    const R = EARTH.a * SCENE_SCALE * 1.004;
    const pos = this.planLine.geometry.attributes.position;
    const omega = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // Interpolation spherique : suit reellement le grand cercle.
      let p;
      if (omega < 1e-6) {
        p = a.clone();
      } else {
        const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
        const s2 = Math.sin(t * omega) / Math.sin(omega);
        p = a.clone().multiplyScalar(s1).add(b.clone().multiplyScalar(s2)).normalize();
      }
      p.multiplyScalar(R);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    this.planLine.geometry.setDrawRange(0, n + 1);
    this.planLine.geometry.computeBoundingSphere();
  }

  setPlanVisible(v) { this.planLine.visible = v; }

  /** Met a jour une trace a partir d'un tableau de positions ECEF. */
  updateTrail(line, points) {
    const n = Math.min(points.length, MAX_POINTS);
    const tip = points[points.length - 1];
    // La trace n'est echantillonnee que toutes les 0,4 s de vol : elle ne change
    // pas d'une image a l'autre, et il n'y a rien a reecrire tant que le dernier
    // point est le meme. Le test porte sur l'IDENTITE du dernier tableau et non
    // sur la longueur : une fois pleine, la trace glisse sans grandir.
    if (tip === line.userData.tipRef && n === line.userData.count) return;
    line.userData.tipRef = tip;
    line.userData.count = n;

    const pos = line.geometry.attributes.position;
    const col = line.geometry.attributes.color;
    const dist = line.geometry.attributes.lineDistance;
    const offset = points.length - n;
    let run = 0;
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let i = 0; i < n; i++) {
      const p = points[offset + i];
      const x = p[0] * SCENE_SCALE;
      const y = p[2] * SCENE_SCALE;
      const z = -p[1] * SCENE_SCALE;
      pos.setXYZ(i, x, y, z);
      if (dist) {
        if (i > 0) run += Math.hypot(x - px, y - py, z - pz);
        dist.setX(i, run);
        px = x; py = y; pz = z;
      }
      // La queue s'estompe : l'oeil lit alors le sens du vol sans qu'on ait a
      // planter une fleche. Le degre deux garde la trace franche presque
      // partout et ne l'efface que sur sa toute fin.
      const age = n > 1 ? (n - 1 - i) / (n - 1) : 0;
      col.setW(i, 1 - (1 - TAIL_MIN) * age * age);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    if (dist) dist.needsUpdate = true;
    line.geometry.setDrawRange(0, n);
    line.geometry.computeBoundingSphere();
    line.userData.span = run;
    if (n > 0) line.userData.tip.set(px, py, pz);
  }

  /**
   * Longueur des tirets de la trace estimee.
   *
   * Elle suit la distance d'observation, comme les reperes : figee, elle
   * donnerait un moire de pointilles vu de loin et une ligne pleine vu de pres.
   * Les bornes ne sont pas cosmetiques — le nuanceur prend un reste de division
   * entre une distance cumulee de plusieurs milliers de kilometres et le pas du
   * motif ; laisser ce rapport depasser quelques centaines fait perdre au calcul
   * ses chiffres significatifs, et le pointille devient du bruit.
   */
  _updateDash() {
    const span = this.estLine.userData.span;
    if (!(span > 0)) return;
    const wanted = DASH_SCREEN * this._screenSpan(this.estLine.userData.tip);
    const period = Math.min(span / 12, Math.max(span / 400, wanted));
    this.estLine.material.dashSize = period * 0.6;
    this.estLine.material.gapSize = period * 0.4;
  }

  update(sim, showEstimate = true, closeUp = false) {
    this.updateTrail(this.truthLine, sim.trailTruth);
    this.updateTrail(this.estLine, sim.trailEst);
    this.estLine.visible = showEstimate;
    this.ghost.visible = showEstimate && sim.running;
    this._updateDash();

    if (sim.running || sim.finished) {
      const trail = sim.trailTruth;
      const last = trail[trail.length - 1];
      if (last) {
        this.vehicle.position.set(last[0] * SCENE_SCALE, last[2] * SCENE_SCALE, -last[1] * SCENE_SCALE);
        this.vehicle.visible = true;

        // Sens de vol, pris sur la trace elle-meme plutot que sur la vitesse :
        // pas de changement de repere a refaire, et le dard suit exactement la
        // courbe dessinee. Au tout debut les deux derniers points peuvent
        // coincider — on garde alors l'orientation precedente.
        const prev = trail[trail.length - 2];
        if (prev) {
          this._v.set(
            (last[0] - prev[0]) * SCENE_SCALE,
            (last[2] - prev[2]) * SCENE_SCALE,
            -(last[1] - prev[1]) * SCENE_SCALE,
          );
          if (this._v.lengthSq() > 1e-14) {
            this.vehicle.quaternion.setFromUnitVectors(CONE_AXIS, this._v.normalize());
          }
        }
      }
      const lastEst = sim.trailEst[sim.trailEst.length - 1];
      if (lastEst) {
        this.ghost.position.set(lastEst[0] * SCENE_SCALE, lastEst[2] * SCENE_SCALE, -lastEst[1] * SCENE_SCALE);
        // L'anneau se presente toujours de face : de profil il disparaitrait.
        this.ghost.quaternion.copy(this.view.camera.quaternion);
      }
    } else {
      this.vehicle.visible = false;
      this.ghost.visible = false;
    }

    // En vue rapprochee ces deux-la n'ont plus de sens : un dard dimensionne
    // pour etre visible depuis l'orbite mesure des dizaines de kilometres et
    // masquerait entierement l'engin. On les efface, le modele 3D prend le
    // relais. Les reperes au sol, eux, restent : correctement dimensionnes ils
    // situent l'objectif dans le paysage.
    if (closeUp) {
      this.vehicle.visible = false;
      this.ghost.visible = false;
    } else {
      if (this.vehicle.visible) {
        this.vehicle.scale.setScalar(
          VEHICLE_SCREEN_H * this._screenSpan(this.vehicle.position) / VEHICLE_REF_H,
        );
      }
      if (this.ghost.visible) {
        this.ghost.scale.setScalar(
          GHOST_SCREEN_R * this._screenSpan(this.ghost.position) / GHOST_REF_R,
        );
      }
    }
  }

  clearTrails() {
    this.detonation.clear();
    this.burstShown = null;
    for (const line of [this.truthLine, this.estLine]) {
      line.geometry.setDrawRange(0, 0);
      line.userData.count = -1;
      line.userData.tipRef = null;
      line.userData.span = 0;
    }
    this.vehicle.visible = false;
    this.ghost.visible = false;
  }

  /**
   * Installe le modele 3D du vecteur choisi. On le reconstruit a chaque
   * changement de vecteur : les proportions se deduisent de ses
   * caracteristiques, elles ne sont donc pas les memes d'un engin a l'autre.
   */
  setVehicle(veh) {
    if (this.missile) {
      this.view.scene.remove(this.missile.group);
      this.view.scene.remove(this.plume.group);
      this.view.scene.remove(this.glow.mesh);
    }
    this.missile = buildMissile(veh);
    this.plume = buildPlume(this.missile.dim.diameter);
    this.glow = buildReentryGlow();
    // Le panache est enfant du modele : il suit donc son attitude sans calcul.
    this.missile.group.add(this.plume.group);
    this.view.scene.add(this.missile.group, this.glow.mesh);
    if (!this.smoke) {
      this.smoke = buildSmoke();
      this.view.scene.add(this.smoke.points);
    }
    this.vehLength = this.missile.dim.total;
  }

  /**
   * Place et oriente le modele. L'attitude vient du quaternion du corps :
   * on convertit ses trois axes de l'inertiel vers le repere terrestre, puis
   * vers la scene, et l'on en fait directement la base du modele.
   */
  updateVehicle(sim, dtWall) {
    this.detonation.update(dtWall);

    // La charge fonctionne au terme du vol, si l'option est armee. On repere
    // le tir par son instant d'impact : deux tirs successifs ne peuvent pas
    // partager la meme valeur, et un vol rejoue ne redeclenche donc rien.
    const r = sim.finished ? sim.result : null;
    if (r && r.burstMode && r.burstMode !== 'none' && this.burstShown !== r.flightTime) {
      this.burstShown = r.flightTime;
      const ecefB = eciToEcef(sim.rTrue, sim.t);
      // Rayon purement visuel, cale sur la DISTANCE DE LA CAMERA et non sur
      // l'engin. En vue de poursuite la camera se tient a une centaine de
      // metres : un effet dimensionne en metres l'engloutissait, et l'on ne
      // voyait qu'un ecran uniforme. En vue orbitale, a l'inverse, il aurait
      // ete invisible. Le rapporter au champ garde l'effet lisible partout —
      // ce qui est legitime ici, puisqu'il ne represente aucune grandeur
      // physique : il marque un instant et un lieu, rien d'autre.
      const posB = toScene(ecefB);
      const distCam = this.view.camera.position.distanceTo(posB);
      // Le globe est centre sur l'origine de la scene : la verticale locale est
      // donc simplement la direction du point depuis le centre.
      this.detonation.fire(posB, (distCam * 0.055) / SCENE_SCALE, posB.clone().normalize());
    }
    if (!sim.finished) this.burstShown = null;

    if (!this.missile) return;
    const visible = sim.running || sim.finished;
    this.missile.group.visible = visible;
    if (!visible) {
      this.plume.group.visible = false;
      this.glow.mesh.visible = false;
      return;
    }

    const t = sim.t;
    const ecef = eciToEcef(sim.rTrue, t);
    const pos = toScene(ecef);
    this.missile.group.position.copy(pos);

    // Axes du corps, ramenes en repere scene.
    const C = V.qToM3(sim.qTrue);
    const axis = (col) => {
      const eci = [C[col], C[3 + col], C[6 + col]];
      const e = eciToEcef(eci, t);
      return new THREE.Vector3(e[0], e[2], -e[1]).normalize();
    };
    const bx = axis(0), by = axis(1), bz = axis(2);
    this._basis.makeBasis(bx, by, bz);
    this.missile.group.quaternion.setFromRotationMatrix(this._basis);

    this.missile.setStage(sim.ctrl.stageIndex, sim.ctrl.separated);

    // --- Propulsion ---
    //
    // Tout ce qui suit est pilote par la POUSSEE REELLEMENT CALCULEE, en
    // newtons, et non par un drapeau d'etat. Consequence directe : pas un
    // photon de flamme quand le moteur est eteint, et une flamme des qu'il
    // pousse — y compris pendant la correction mi-course, qui est une vraie
    // poussee meme si elle ne vient pas d'un etage.
    const alt = sim.altTrue;
    const air = atmosphere(Math.max(0, alt));
    const pressureRatio = Math.min(1, air.p / 101325);
    const f = computeForces(t, sim.y, sim.ctrl);

    const st = sim.veh.stages[sim.ctrl.stageIndex];
    const mainThrust = sim.ctrl.separated ? 0 : (f.thrust || 0);
    // Poussee de la reserve de correction, exprimee en newtons pour etre
    // comparable a celle des etages.
    const rcs = sim.ctrl.rcsAccel
      ? V.norm(sim.ctrl.rcsAccel) * sim.veh.payloadMass
      : 0;

    let thrustRatio = 0;
    let nozzle = 0;
    if (mainThrust > 0 && st) {
      thrustRatio = Math.min(1, mainThrust / st.thrustVac);
      nozzle = this.missile.nozzleX(sim.ctrl.stageIndex);
    } else if (rcs > 0) {
      // Le moteur de correction est minuscule devant un etage : sa flamme
      // doit rester discrete, sans quoi elle mentirait sur son importance.
      thrustRatio = Math.min(0.18, rcs / 4000);
      nozzle = -this.missile.dim.payloadLength * 0.5;
    }

    this.plume.group.position.x = nozzle;
    this.plume.update(thrustRatio, pressureRatio, Math.random() * 2 - 1);

    // --- Fumee ---
    // Elle n'existe que dans l'atmosphere : plus haut, il n'y a rien pour
    // diffuser les gaz et la trainee visible disparait. Elle est emise par la
    // meme condition que la flamme : moteur eteint, plus rien n'est cree.
    if (thrustRatio > 0) {
      const nz = this._tmpv.set(nozzle, 0, 0)
        .applyQuaternion(this.missile.group.quaternion)
        .multiplyScalar(SCENE_SCALE)
        .add(pos);
      this.smoke.emit(nz.x, nz.y, nz.z, Math.min(1, air.rho / 1.225) * thrustRatio);
    }

    // Etat exportable : permet de verifier, depuis les tests comme depuis la
    // console, que les effets suivent bien la propulsion.
    this.propulsion = {
      mainThrustN: mainThrust,
      rcsThrustN: rcs,
      thrustRatio,
      flameVisible: this.plume.group.visible,
      pressureRatio,
    };
    // La taille apparente des bouffees depend de l'ouverture courante : en vue
    // au sol on zoome comme avec des jumelles, il faut en tenir compte.
    this.smoke.setProjection(
      this.view.renderer.getContext().drawingBufferHeight,
      this.view.camera.fov,
    );
    this.smoke.update(dtWall);

    // --- Echauffement de rentree ---
    const vRel = airRelativeVelocity(sim.rTrue, sim.vTrue);
    this.glow.mesh.position.copy(pos);
    this.glow.update(air.rho, V.norm(vRel), this.vehLength * SCENE_SCALE * 0.6);
  }

  /**
   * Projette un point ECEF en coordonnees ecran, pour poser une etiquette HTML.
   * Renvoie null si le point passe derriere le globe.
   */
  project(ecef) {
    const p = toScene(ecef);
    const cam = this.view.camera;
    if (this._occluded(p)) return null;

    const v = p.project(cam);
    if (v.z > 1) return null;
    const rect = this.view.canvas.getBoundingClientRect();
    return {
      x: ((v.x + 1) / 2) * rect.width,
      y: ((-v.y + 1) / 2) * rect.height,
    };
  }
}
