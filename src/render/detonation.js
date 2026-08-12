// Effet visuel de fonctionnement de la charge.
//
// Ce module ne modelise AUCUN effet d'arme : ni energie, ni souffle, ni rayon
// d'effet, ni retombees. Il ne rend qu'un evenement — l'instant et le lieu ou
// la charge fonctionne — et sa seule fonction dans le simulateur est de rendre
// visible la difference entre un declenchement au contact et un declenchement
// en altitude. C'est cette difference-la qui est le sujet, parce qu'elle
// appartient au guidage.
//
// L'animation est une SEQUENCE, et c'est ce qui la rend lisible : un eclair
// tres bref, un noyau qui s'epanouit en refroidissant, un front qui s'ecarte
// et s'efface. Une boule unique qui grossit ne se lit pas comme un evenement ;
// elle se lit comme un defaut d'affichage.
//
// Aucune de ces durees ni aucun de ces rayons n'a de signification physique.
// Ils sont regles pour la lisibilite, a une distance de camera quelconque.

import * as THREE from 'three';
import { SCENE_SCALE } from './scale.js';

const DUREE = 3.0; // [s] duree totale

/** Interpolation douce, pour eviter les demarrages et arrets brutaux. */
const lissage = (x) => x * x * (3 - 2 * x);
/** Fenetre : vaut 1 entre a et b, 0 en dehors, avec des bords adoucis. */
function fenetre(u, a, b) {
  if (u <= a || u >= b) return 0;
  return lissage(Math.min(1, Math.min(u - a, b - u) / ((b - a) * 0.5)));
}

export function buildDetonation() {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 14;

  const mat = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });

  // L'eclair : tres bref, tres brillant, et plus large que le noyau. C'est lui
  // qui donne l'impression d'un evenement instantane plutot que d'une boule
  // qui apparait.
  const eclair = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xffffff, 0));
  const coeur = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xfff6e0, 0));
  const enveloppe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xff8420, 0));

  // Le front, en anneau PLAT et non en sphere : une sphere translucide qui
  // grossit se confond avec le noyau, alors qu'un anneau qui s'ecarte se lit
  // immediatement comme une propagation. Il est oriente perpendiculairement a
  // la verticale locale.
  const front = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), mat(0xa8c8ff, 0));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xffb060, 0));

  group.add(front, halo, enveloppe, coeur, eclair);

  let age = -1;
  let echelle = 1;

  return {
    group,

    /**
     * @param {THREE.Vector3} pos position, en unites de scene
     * @param {number} rayonRef rayon de reference [m], purement visuel
     * @param {THREE.Vector3} [up] verticale locale, pour poser l'anneau a plat
     */
    fire(pos, rayonRef, up = null) {
      group.position.copy(pos);
      echelle = Math.max(1, rayonRef) * SCENE_SCALE;
      if (up) front.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up.clone().normalize());
      age = 0;
      group.visible = true;
    },

    clear() { age = -1; group.visible = false; },

    update(dt) {
      if (age < 0) return;
      age += dt;
      if (age > DUREE) { this.clear(); return; }
      const u = age / DUREE;

      // --- Eclair : les 4 premiers pour cent, puis plus rien ---
      const fEclair = fenetre(u, 0, 0.04);
      eclair.material.opacity = fEclair;
      eclair.scale.setScalar(echelle * (0.5 + 1.4 * u * 12));

      // --- Noyau : croissance rapide qui sature, extinction en un tiers ---
      const r = echelle * (0.18 + 0.95 * Math.cbrt(u));
      coeur.scale.setScalar(r * 0.30);
      coeur.material.opacity = Math.max(0, 0.9 * (1 - u * 3.4));

      // --- Enveloppe : plus lente, et elle REFROIDIT — c'est ce virage de
      // couleur qui donne la duree, bien plus que la taille.
      enveloppe.scale.setScalar(r * 0.62);
      enveloppe.material.opacity = Math.max(0, 0.6 * (1 - u * 1.5));
      enveloppe.material.color.setRGB(1, 0.62 - 0.42 * u, 0.26 - 0.22 * u);

      // --- Halo residuel : prend le relais quand le noyau s'eteint ---
      halo.scale.setScalar(r * 1.05);
      halo.material.opacity = 0.14 * fenetre(u, 0.05, 1);

      // --- Front : part vite, s'elargit et s'affine jusqu'a disparaitre ---
      const rf = echelle * (0.3 + 4.2 * lissage(Math.min(1, u * 1.35)));
      front.scale.setScalar(rf);
      front.material.opacity = 0.5 * (1 - lissage(Math.min(1, u * 1.2))) ** 1.4;
    },
  };
}
