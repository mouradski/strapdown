// Surcouche graphique : traces, reperes et arc de grand cercle.
//
// Deux traces sont dessinees en permanence : la trajectoire REELLE et celle
// que le calculateur croit suivre. L'ecart entre les deux courbes est le sujet
// meme du simulateur, et il doit se voir a l'oeil.

import * as THREE from 'three';
import { llaToEcef, eciToEcef } from '../core/geodesy.js';
import { EARTH } from '../core/constants.js';
import * as V from '../core/vec.js';
import { atmosphere } from '../core/atmosphere.js';
import { computeForces, airRelativeVelocity } from '../sim/dynamics.js';
import { toScene, SCENE_SCALE } from './globe.js';
import { buildMissile, buildPlume, buildSmoke, buildReentryGlow } from './missile.js';

const MAX_POINTS = 4200;

// Un cone de three.js pointe vers +Y : c'est l'axe a faire tourner pour aligner
// le dard sur la trajectoire.
const CONE_AXIS = new THREE.Vector3(0, 1, 0);

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

/** Petit repere annulaire pose a la surface, oriente selon la verticale locale. */
function makeRing(color, radius = 0.16, opacity = 0.55) {
  const group = new THREE.Group();
  // Anneau FIN et translucide : ces reperes doivent se laisser trouver sans
  // masquer le globe ni la trajectoire, qui sont le vrai sujet.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.88, radius, 48),
    new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide, transparent: true, opacity, depthTest: false,
    }),
  );
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.13, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 1.3, depthTest: false }),
  );
  group.add(ring, dot);
  group.renderOrder = 10;
  return group;
}

export class Overlay {
  constructor(view) {
    this.view = view;
    const s = view.scene;

    this.planLine = makeLine(COLORS.plan, 0.5);
    this.truthLine = makeLine(COLORS.truth);
    this.estLine = makeLine(COLORS.estimate, 0.85);
    s.add(this.planLine, this.truthLine, this.estLine);

    // L'objectif reste le plus lisible des trois ; le site de tir et le point
    // de ressource ne sont que des jalons et s'effacent davantage.
    this.markers = {
      launch: makeRing(COLORS.launch, 0.085, 0.42),
      target: makeRing(COLORS.target, 0.115, 0.7),
      impact: makeRing(COLORS.impact, 0.10, 0.5),
      pullup: makeRing(COLORS.aim, 0.075, 0.4),
    };
    for (const m of Object.values(this.markers)) { m.visible = false; s.add(m); }
    this.markers.launch.visible = true;
    this.markers.target.visible = true;

    // Les deux reperes de la vue orbitale. Ils forment une PAIRE, et leur
    // opposition doit se lire d'un coup d'oeil, car c'est le sujet meme du
    // simulateur : un dard plein qui vole vraiment, et un cercle vide a
    // l'endroit ou le calculateur s'imagine etre.
    //
    // Le dard est oriente sur la trajectoire : a cette distance c'est le seul
    // moyen de voir dans quel sens l'engin va.
    this.vehicle = new THREE.Mesh(
      new THREE.ConeGeometry(0.032, 0.15, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    this.vehicle.renderOrder = 12;
    this.vehicle.visible = false;
    s.add(this.vehicle);

    // Position estimee : un anneau fin, toujours face camera. Creux parce
    // qu'il ne designe rien de materiel — seulement une croyance de bord.
    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.075, 32),
      new THREE.MeshBasicMaterial({
        color: COLORS.estimate, side: THREE.DoubleSide, transparent: true,
        opacity: 0.95, depthTest: false,
      }),
    );
    this.ghost.renderOrder = 12;
    this.ghost.visible = false;
    s.add(this.ghost);

    this._v = new THREE.Vector3();
    this._tmpv = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this.missile = null;
    this.smoke = null;
  }

  /** Place un repere annulaire a plat sur la surface. */
  placeMarker(name, lat, lon, altitude = 30000) {
    const m = this.markers[name];
    if (!m) return;
    const p = toScene(llaToEcef(lat, lon, altitude));
    m.position.copy(p);
    m.lookAt(0, 0, 0);
    m.visible = true;
  }

  hideMarker(name) {
    if (this.markers[name]) this.markers[name].visible = false;
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
    const pos = line.geometry.attributes.position;
    const n = Math.min(points.length, MAX_POINTS);
    const offset = points.length - n;
    for (let i = 0; i < n; i++) {
      const p = points[offset + i];
      pos.setXYZ(i, p[0] * SCENE_SCALE, p[2] * SCENE_SCALE, -p[1] * SCENE_SCALE);
    }
    pos.needsUpdate = true;
    line.geometry.setDrawRange(0, n);
    line.geometry.computeBoundingSphere();
  }

  update(sim, showEstimate = true, closeUp = false) {
    this.updateTrail(this.truthLine, sim.trailTruth);
    this.updateTrail(this.estLine, sim.trailEst);
    this.estLine.visible = showEstimate;
    this.ghost.visible = showEstimate && sim.running;

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

    // En vue rapprochee les reperes n'ont plus de sens : un octaedre
    // dimensionne pour etre visible depuis l'orbite mesure des dizaines de
    // kilometres et masquerait entierement l'engin. On les efface, le modele
    // 3D prend le relais.
    if (closeUp) {
      this.vehicle.visible = false;
      this.ghost.visible = false;
      for (const m of Object.values(this.markers)) m.scale.setScalar(0.25);
      return;
    }

    // Sinon les reperes gardent une taille apparente constante : sans cela ils
    // disparaissent quand on s'eloigne et ecrasent le globe quand on approche.
    const d = this.view.camera.position.length();
    const k = Math.max(0.35, Math.min(2.6, d / 16));
    for (const m of Object.values(this.markers)) m.scale.setScalar(k);
    this.vehicle.scale.setScalar(k);
    this.ghost.scale.setScalar(k);
  }

  clearTrails() {
    this.truthLine.geometry.setDrawRange(0, 0);
    this.estLine.geometry.setDrawRange(0, 0);
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
    // Test d'occultation : le point est-il cache par la Terre ?
    const toCam = this._v.copy(cam.position).sub(p);
    if (p.dot(toCam) < -0.02 * p.length() * toCam.length()) return null;

    const v = p.clone().project(cam);
    if (v.z > 1) return null;
    const rect = this.view.canvas.getBoundingClientRect();
    return {
      x: ((v.x + 1) / 2) * rect.width,
      y: ((-v.y + 1) / 2) * rect.height,
    };
  }
}
