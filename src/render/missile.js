// Modele 3D du vecteur, avec panache et fumee.
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
// fait voler.

import * as THREE from 'three';
import { SCENE_SCALE } from './scale.js';

const PROPELLANT_DENSITY = 1750; // propergol solide [kg/m^3]

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
  return {
    diameter,
    stages,
    payloadDiameter,
    payloadLength,
    total: stages.reduce((s, x) => s + x.length, 0) + payloadLength,
  };
}

/**
 * Construit le modele. L'axe longitudinal est +X, comme le repere du corps :
 * l'orientation se pose alors directement depuis le quaternion d'attitude.
 */
export function buildMissile(veh) {
  const dim = vehicleDimensions(veh);
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd6dbe1, roughness: 0.5, metalness: 0.3,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x262c33, roughness: 0.75, metalness: 0.2,
  });
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0x39404a, roughness: 0.4, metalness: 0.45,
  });

  // Les etages sont empiles vers -X : la pointe est en +X, la tuyere du
  // premier etage tout en bas. On largue donc du bas vers le haut.
  const stageMeshes = [];

  // --- Charge utile ---
  const payload = new THREE.Group();
  if (veh.glide) {
    // Corps porteur : une pyramide aplatie, silhouette de planeur hypersonique.
    const L = dim.payloadLength;
    const w = dim.payloadDiameter * 1.5;
    const h = dim.payloadDiameter * 0.55;
    const geo = new THREE.CylinderGeometry(0.06 * w, w * 0.5, L, 4, 1);
    geo.rotateZ(-Math.PI / 2); // axe le long de +X
    geo.translate(L / 2, 0, 0);
    geo.scale(1, h / (w * 0.5), 1);
    const body = new THREE.Mesh(geo, noseMat);
    payload.add(body);
    // Deux derives verticales en bout.
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(L * 0.25, h * 1.6, w * 0.04),
        darkMat,
      );
      fin.position.set(L * 0.12, h * 0.5, s * w * 0.32);
      payload.add(fin);
    }
  } else {
    // Corps de rentree : cone elance.
    const geo = new THREE.ConeGeometry(dim.payloadDiameter / 2, dim.payloadLength, 24);
    geo.rotateZ(-Math.PI / 2);
    geo.translate(dim.payloadLength / 2, 0, 0);
    payload.add(new THREE.Mesh(geo, noseMat));
  }
  group.add(payload);

  // --- Etages, empiles vers -X ---
  let x = 0;
  for (let i = 0; i < dim.stages.length; i++) {
    const st = dim.stages[i];
    const g = new THREE.Group();

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(st.diameter / 2, st.diameter / 2, st.length, 28, 1),
      i === 0 ? bodyMat : darkMat,
    );
    tube.rotation.z = Math.PI / 2;
    tube.position.x = -st.length / 2;
    g.add(tube);

    // Bandeau d'interetage, pour que le largage se voie.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(st.diameter / 2 + 0.02, st.diameter / 2 + 0.02, st.length * 0.05, 24),
      darkMat,
    );
    band.rotation.z = Math.PI / 2;
    band.position.x = -st.length * 0.03;
    g.add(band);

    // Tuyere.
    const nozzleLen = st.diameter * 0.45;
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(st.diameter * 0.16, st.diameter * 0.3, nozzleLen, 20, 1, true),
      darkMat,
    );
    nozzle.rotation.z = -Math.PI / 2;
    nozzle.position.x = -st.length - nozzleLen / 2;
    nozzle.material.side = THREE.DoubleSide;
    g.add(nozzle);

    // Ailettes sur le premier etage seulement.
    if (i === 0) {
      for (let k = 0; k < 4; k++) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(st.length * 0.16, st.diameter * 0.5, st.diameter * 0.05),
          darkMat,
        );
        fin.position.set(-st.length + st.length * 0.09, 0, 0);
        const a = (k * Math.PI) / 2;
        fin.rotation.x = a;
        fin.position.y = Math.cos(a) * st.diameter * 0.42;
        fin.position.z = Math.sin(a) * st.diameter * 0.42;
        g.add(fin);
      }
    }

    g.position.x = x;
    g.userData.nozzleX = x - st.length - nozzleLen;
    group.add(g);
    stageMeshes.push(g);
    x -= st.length;
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
    },
    /** Position de la tuyere active, en unites du modele. */
    nozzleX(index) {
      const g = stageMeshes[index];
      return g ? g.userData.nozzleX : 0;
    },
  };
}

/**
 * Panache de tuyere.
 *
 * Sa longueur suit la poussee ET la pression ambiante : dans le vide le jet
 * s'epanouit sans rien pour le contenir et devient enorme, alors qu'au niveau
 * de la mer il reste court et resserre. C'est une des differences les plus
 * visibles entre un decollage et une poussee en altitude.
 */
export function buildPlume(diameter) {
  const group = new THREE.Group();

  const coneGeo = new THREE.ConeGeometry(1, 1, 20, 1, true);
  coneGeo.rotateZ(Math.PI / 2); // pointe vers +X, evasement vers -X
  coneGeo.translate(-0.5, 0, 0);

  const core = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2d0, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const halo = new THREE.Mesh(coneGeo.clone(), new THREE.MeshBasicMaterial({
    color: 0xff8c2a, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  group.add(halo, core);
  group.visible = false;

  return {
    group,
    /**
     * @param {number} thrustRatio 0..1, poussee courante rapportee au maximum
     * @param {number} pressureRatio 0..1, pression ambiante rapportee au sol
     */
    update(thrustRatio, pressureRatio, flicker) {
      if (thrustRatio <= 0.01) { group.visible = false; return; }
      group.visible = true;
      // Au sol le jet est court et etroit ; dans le vide il triple.
      const expand = 1 + 2.2 * (1 - pressureRatio);
      const len = diameter * (2.6 + 5.5 * thrustRatio) * expand * (0.94 + 0.12 * flicker);
      const rad = diameter * (0.42 + 0.2 * thrustRatio) * (0.6 + 0.55 * expand);
      core.scale.set(len * 0.55, rad * 0.55, rad * 0.55);
      halo.scale.set(len, rad, rad);
      core.material.opacity = 0.85 + 0.12 * flicker;
      halo.material.opacity = 0.35 + 0.2 * thrustRatio;
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
    vertexShader: `
      attribute float aSize;   // rayon REEL de la bouffee, en unites de scene
      attribute float aAlpha;
      uniform float uProj;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uProj / max(1e-7, -mv.z), 1.0, 380.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
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

/**
 * Halo d'echauffement a la rentree. L'intensite suit le flux de chaleur, qui
 * varie comme la racine de la densite et le CUBE de la vitesse : d'ou une
 * apparition tres brutale a l'entree dans l'atmosphere.
 */
export function buildReentryGlow() {
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff5518, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return {
    mesh,
    update(rho, speed, size) {
      const heat = Math.sqrt(Math.max(0, rho)) * (speed / 1000) ** 3;
      const k = Math.min(1, heat / 12);
      mesh.visible = k > 0.02;
      mat.opacity = 0.65 * k;
      mesh.scale.setScalar(size * (1.4 + 1.6 * k));
    },
  };
}
