// Effet visuel de fonctionnement de la charge.
//
// Ce module ne modelise AUCUN effet d'arme : ni energie, ni souffle, ni rayon
// d'effet, ni retombees. Il ne rend qu'un evenement — l'instant et le lieu ou
// la charge fonctionne — et sa seule fonction dans le simulateur est de rendre
// visible la difference entre un declenchement au contact et un declenchement
// en altitude. C'est cette difference-la qui est le sujet, parce qu'elle
// appartient au guidage.
//
// L'animation est volontairement breve et sobre. Une boule de feu spectaculaire
// donnerait a l'outil un registre qui n'est pas le sien.

import * as THREE from 'three';
import { SCENE_SCALE } from './scale.js';

const DUREE = 2.6; // [s] duree totale de l'effet

/**
 * Construit l'effet, masque. Il vit dans la scene et ne coute rien tant qu'il
 * n'est pas declenche.
 */
export function buildDetonation() {
  const group = new THREE.Group();
  group.visible = false;
  group.renderOrder = 14;

  // Trois couches concentriques : le coeur, l'enveloppe, et l'onde qui s'ecarte.
  // Le melange additif fait qu'elles s'additionnent au lieu de se masquer.
  const mat = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });

  const coeur = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xfff6e0, 0.85));
  const enveloppe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xff8420, 0.55));
  // L'onde est une COQUE et non une boule pleine : en mélange additif, une
  // sphere pleine sature son centre en blanc et se lit comme un disque plat.
  const onde = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(0x8fb4e8, 0.16));
  group.add(onde, enveloppe, coeur);

  let age = -1;
  let echelle = 1;

  return {
    group,

    /**
     * Declenche l'effet a la position donnee.
     * @param {THREE.Vector3} pos position en unites de scene
     * @param {number} rayonRef rayon de reference [m] — l'effet s'y cale pour
     *   rester lisible quel que soit le niveau de zoom
     */
    fire(pos, rayonRef) {
      group.position.copy(pos);
      echelle = Math.max(1, rayonRef) * SCENE_SCALE;
      age = 0;
      group.visible = true;
    },

    clear() { age = -1; group.visible = false; },

    /** Avance l'animation. `dt` en secondes de temps reel. */
    update(dt) {
      if (age < 0) return;
      age += dt;
      if (age > DUREE) { this.clear(); return; }
      const u = age / DUREE;

      // Croissance rapide puis saturation : la racine cubique reproduit
      // grossierement l'allure d'une expansion qui ralentit.
      const r = echelle * (0.18 + 0.95 * Math.cbrt(u));
      coeur.scale.setScalar(r * 0.30);
      enveloppe.scale.setScalar(r * 0.62);
      onde.scale.setScalar(r * (1 + 1.4 * u));

      // Le coeur s'eteint vite, l'enveloppe refroidit, l'onde s'efface en
      // s'elargissant.
      coeur.material.opacity = Math.max(0, 0.85 * (1 - u * 4));
      enveloppe.material.opacity = Math.max(0, 0.55 * (1 - u * 1.7));
      onde.material.opacity = Math.max(0, 0.16 * (1 - u) ** 1.5);
      // Refroidissement : blanc chaud vers orange sombre.
      enveloppe.material.color.setRGB(1, 0.6 - 0.35 * u, 0.24 - 0.2 * u);
    },
  };
}
