// Rendu du globe terrestre.
//
// La scene est en repere TERRESTRE (ECEF) et non inertiel : le globe reste
// immobile a l'ecran, les objectifs restent sous la souris, et c'est la
// trajectoire qui derive visiblement vers l'ouest — ce qui rend l'effet de la
// rotation terrestre lisible plutot qu'invisible.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';
import { EARTH, DEG } from '../core/constants.js';
import { llaToEcef, ecefToLla } from '../core/geodesy.js';
import { makeTerrain } from '../core/terrain.js';
import { SCENE_SCALE } from './scale.js';

export { SCENE_SCALE } from './scale.js';

// Nappe de sol local : 128 segments sur 60 km, soit un point tous les 470 m.
// L'horizon vrai depuis une dizaine de metres n'est qu'a 12 km, donc largement
// couvert.
const GROUND_SEGMENTS = 128;
const GROUND_HALF_WIDTH = 30000;

export const toScene = (ecef) => new THREE.Vector3(
  ecef[0] * SCENE_SCALE, ecef[2] * SCENE_SCALE, -ecef[1] * SCENE_SCALE,
);

/** Inverse de `toScene` : ramene un point de la scene en ECEF. */
export const fromScene = (v) => [v.x / SCENE_SCALE, -v.z / SCENE_SCALE, v.y / SCENE_SCALE];

const PALETTE = {
  ocean: '#08111d',
  oceanDeep: '#060d18',
  land: '#16291f',
  landEdge: '#3f7a5f',
  graticule: 'rgba(120, 170, 200, 0.16)',
  equator: 'rgba(150, 200, 230, 0.34)',
};

/**
 * Construit la texture equirectangulaire de la Terre a partir des contours
 * Natural Earth. Dessiner en projection plate puis plaquer sur la sphere evite
 * d'avoir a trianguler des polygones spheriques.
 *
 * Renvoie aussi un masque de terre basse resolution : la correlation de
 * terrain en a besoin pour savoir si le vehicule survole des terres.
 */
function buildEarthTexture(width = 4096, terrainSeed = 7) {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, PALETTE.oceanDeep);
  grad.addColorStop(0.5, PALETTE.ocean);
  grad.addColorStop(1, PALETTE.oceanDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const land = feature(landTopo, landTopo.objects.land);
  const project = (lon, lat) => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  const drawRings = (rings) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  };

  ctx.fillStyle = PALETTE.land;
  ctx.strokeStyle = PALETTE.landEdge;
  ctx.lineWidth = Math.max(1, width / 2048);
  for (const f of land.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') drawRings(g.coordinates);
    else if (g.type === 'MultiPolygon') for (const p of g.coordinates) drawRings(p);
  }

  // Masque de terre : releve AVANT le graticule, pour ne pas prendre les
  // meridiens pour des continents.
  const maskW = 720, maskH = 360;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskW;
  maskCanvas.height = maskH;
  const mctx = maskCanvas.getContext('2d');
  mctx.drawImage(canvas, 0, 0, maskW, maskH);
  const pixels = mctx.getImageData(0, 0, maskW, maskH).data;
  const mask = new Uint8Array(maskW * maskH);
  for (let i = 0; i < maskW * maskH; i++) {
    // La terre est plus verte que l'ocean : le canal vert suffit a trancher.
    mask[i] = pixels[i * 4 + 1] > pixels[i * 4 + 2] ? 1 : 0;
  }

  const isLand = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * maskW);
    const y = Math.floor(((90 - lat) / 180) * maskH);
    if (x < 0 || y < 0 || x >= maskW || y >= maskH) return false;
    return mask[y * maskW + x] === 1;
  };

  // --- Ombrage du relief ---
  //
  // On teinte les terres selon l'altitude et surtout selon la PENTE : les
  // regions accidentees ressortent en clair. Ce n'est pas decoratif — c'est
  // exactement la carte de la ou la correlation de terrain pourra travailler,
  // et le joueur peut ainsi choisir sa route en connaissance de cause.
  const terrain = makeTerrain({ seed: terrainSeed, isLand });
  const img = ctx.getImageData(0, 0, width, height);
  const px = img.data;
  const block = 2; // on echantillonne un pixel sur deux : invisible, deux fois plus rapide
  for (let py = 0; py < height; py += block) {
    const lat = 90 - (py / height) * 180;
    for (let pxx = 0; pxx < width; pxx += block) {
      const lon = (pxx / width) * 360 - 180;
      if (!isLand(lat, lon)) continue;

      const { height: e, rugged } = terrain.displayElevation(lat, lon);
      // Ombrage : on eclaire depuis le nord-ouest pour faire ressortir les
      // pentes, comme sur une carte en relief.
      const d = (360 / width) * block * 3;
      const gx = terrain.displayElevation(lat, lon + d).height - e;
      const gy = terrain.displayElevation(lat - d, lon).height - e;
      const shade = Math.max(-1, Math.min(1, (gx - gy) / 260));

      // Teinte hypsometrique : vert sombre en plaine, ocre puis clair en
      // altitude. La CLARTE traduit surtout la rugosite — donc, tres
      // concretement, la ou une correlation de relief pourra fonctionner.
      // Teinte volontairement sombre : elle sera ensuite multipliee par
      // l'eclairage de la scene. Une palette calibree pour « bien rendre »
      // telle quelle sature des que le soleil tombe droit dessus — ce qui
      // arrive precisement en vue au sol.
      const h = Math.min(1, e / 2400);
      const k = 1 + 0.45 * shade;
      const r0 = (17 + 96 * h + 42 * rugged) * k;
      const g0 = (33 + 72 * h + 34 * rugged) * k;
      const b0 = (27 + 48 * h + 25 * rugged) * k;

      for (let by = 0; by < block && py + by < height; by++) {
        for (let bx = 0; bx < block && pxx + bx < width; bx++) {
          const o = ((py + by) * width + (pxx + bx)) * 4;
          px[o] = Math.min(255, r0);
          px[o + 1] = Math.min(255, g0);
          px[o + 2] = Math.min(255, b0);
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // Graticule trace APRES l'ombrage : dessine avant, le relief l'effacerait
  // sur toutes les terres.
  ctx.lineWidth = Math.max(1, width / 4096);
  for (let lon = -180; lon <= 180; lon += 15) {
    ctx.strokeStyle = lon === 0 ? PALETTE.equator : PALETTE.graticule;
    const [x] = project(lon, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    ctx.strokeStyle = lat === 0 ? PALETTE.equator : PALETTE.graticule;
    const [, y] = project(0, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  return { canvas, isLand, terrain };
}

/** Halo atmospherique, obtenu par un simple effet de Fresnel sur une coque. */
function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0x4a9fd8) } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vView));
        float a = pow(rim, 3.0) * 0.85;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

export class GlobeView {
  constructor(canvas) {
    this.canvas = canvas;
    // Tampon de profondeur LOGARITHMIQUE : indispensable ici. La scene doit
    // contenir en meme temps un missile de quinze metres et une planete de
    // 6371 km, soit six ordres de grandeur. Un tampon lineaire y produirait un
    // z-fighting generalise des qu'on approche l'engin.
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x04070d, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 2e-7, 600);
    this.camera.position.set(14, 7, 14);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.45;
    this.controls.minDistance = EARTH.a * SCENE_SCALE * 1.06;
    this.controls.maxDistance = 90;
    this.controls.enablePan = false;

    // --- Modes de camera ---
    // 'orbite'    : on tourne autour de la Terre (controles orbitaux)
    // 'poursuite' : on suit l'engin de l'exterieur
    // 'sol'       : on est plante au sol pres du pas de tir, et l'on regarde
    this.mode = 'orbite';
    this.groundYaw = 0;
    this.groundPitch = 0.25;
    this.groundFov = 42;
    this.trackVehicle = true;
    this.groundOrigin = null; // position de l'observateur, en unites de scene
    this.followTarget = new THREE.Vector3();
    this.chaseDistance = 90; // metres derriere l'engin
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this.installLookControls();

    const R = EARTH.a * SCENE_SCALE;
    const { canvas: texCanvas, isLand, terrain } = buildEarthTexture(4096, 7);
    this.isLand = isLand;
    this.terrain = terrain;

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    // Sphere legerement aplatie, comme l'ellipsoide de reference.
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, 128, 96),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.0 }),
    );
    this.earth.scale.set(1, EARTH.b / EARTH.a, 1);
    // Aucune rotation : la parametrisation UV de SphereGeometry place u = 0 sur
    // l'axe -X local, ce qui correspond exactement au bord gauche de la texture
    // (longitude -180) une fois passe dans `toScene`. Faire tourner le maillage
    // decalerait la carte par rapport aux reperes, qui sont places, eux, par
    // conversion geodesique directe — et les clics ne tomberaient plus au bon
    // endroit.
    this.scene.add(this.earth);

    // Sphere de collision utilisee APRES redressement de l'aplatissement
    // (voir `pick`). Intersecter directement une sphere donnerait plusieurs
    // kilometres d'erreur aux latitudes moyennes et des dizaines pres des
    // poles, ce qui est inacceptable quand on mesure des ecarts d'impact de
    // quelques centaines de metres.
    this.pickSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R);
    this.flattening = EARTH.b / EARTH.a;

    const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 64, 48), atmosphereMaterial());
    halo.scale.set(1, EARTH.b / EARTH.a, 1);
    this.scene.add(halo);
    // Le halo est une coque rendue par l'INTERIEUR. Vu de l'exterieur il fait
    // un lisere atmospherique ; mais des qu'on passe dessous — en vue au sol —
    // il recouvre toute la scene d'un voile uniforme. On l'efface alors.
    this.halo = halo;
    this.haloRadius = R * 1.025;

    // Sol local, en relief.
    //
    // Le globe n'a que 128 segments : ses facettes s'ecartent de pres de deux
    // kilometres de la surface lisse entre leurs sommets. Une camera posee a
    // quatre cents metres d'altitude se retrouve donc A L'INTERIEUR de la coque
    // facettee, qui lui bouche la vue. On ne peut pas s'en servir de pres.
    //
    // On construit donc, autour du pas de tir, une nappe echantillonnee dans le
    // MEME champ de relief que celui qu'exploite la correlation de terrain.
    // Le sol qu'on voit est alors exactement celui que sonde le radioaltimetre.
    this.groundPatch = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, GROUND_SEGMENTS, GROUND_SEGMENTS),
      new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
      }),
    );
    this.groundPatch.visible = false;
    this.groundPatch.frustumCulled = false;
    this.scene.add(this.groundPatch);

    // Eclairage volontairement modere : la texture du globe contient DEJA un
    // ombrage de relief calcule au chargement. La reeclairer trop fort la fait
    // saturer — invisible depuis l'orbite, ou l'on voit surtout des angles
    // rasants, mais aveuglant en vue au sol quand le soleil est au zenith.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
    sun.position.set(1, 0.45, 0.8).normalize().multiplyScalar(50);
    this.scene.add(sun);

    this.scene.add(this.makeStarfield());
    this.raycaster = new THREE.Raycaster();
    this.resize();
  }

  makeStarfield() {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    // Repartition uniforme sur la sphere : il faut tirer le cosinus de la
    // colatitude, pas l'angle, sinon les etoiles s'agglutinent aux poles.
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 200 + Math.random() * 60;
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9fb8d0, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.75,
    }));
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Convertit une position de souris en coordonnees geodesiques.
   *
   * On ne peut pas intersecter une simple sphere : la Terre est aplatie de
   * 21 km entre equateur et pole, et l'ecart se traduirait par plusieurs
   * kilometres d'erreur sur le point designe. On redresse donc l'aplatissement
   * — dans cet espace l'ellipsoide redevient une sphere —, on intersecte, puis
   * on revient. Le resultat est exact.
   *
   * Renvoie null si le rayon ne rencontre pas le globe.
   */
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const f = this.flattening;

    const origin = ray.origin.clone();
    origin.y /= f;
    const dir = ray.direction.clone();
    dir.y /= f;
    dir.normalize();

    const hit = new THREE.Vector3();
    if (!new THREE.Ray(origin, dir).intersectSphere(this.pickSphere, hit)) return null;
    hit.y *= f;
    return ecefToLla(fromScene(hit));
  }

  /** Recentre la vue sur un point du globe. */
  focusOn(lat, lon, distance = 18) {
    const dir = toScene(llaToEcef(lat, lon, 0)).normalize();
    this.camera.position.copy(dir.multiplyScalar(distance));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Rotation libre a la souris pour les vues rapprochees. Les controles
   * orbitaux de Three.js tournent autour d'un point ; ici on veut tourner la
   * TETE, ce qui n'est pas la meme chose : depuis le sol, l'observateur ne se
   * deplace pas, il regarde ailleurs.
   */
  installLookControls() {
    let dragging = false;
    let lastX = 0, lastY = 0;
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      if (this.mode === 'orbite') return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging || this.mode === 'orbite') return;
      const k = (this.groundFov / 42) * 0.0032;
      this.groundYaw -= (e.clientX - lastX) * k;
      this.groundPitch += (e.clientY - lastY) * k;
      // On ne regarde ni tout a fait sous ses pieds ni a la verticale exacte.
      this.groundPitch = Math.max(-0.35, Math.min(1.52, this.groundPitch));
      lastX = e.clientX;
      lastY = e.clientY;
      // Des que l'on regarde soi-meme, on cesse de suivre automatiquement.
      this.trackVehicle = false;
    });
    el.addEventListener('wheel', (e) => {
      if (this.mode === 'orbite') return;
      e.preventDefault();
      if (this.mode === 'sol') {
        // Au sol, la molette fait zoomer comme des jumelles.
        this.groundFov = Math.max(1.2, Math.min(70, this.groundFov * (1 + Math.sign(e.deltaY) * 0.12)));
      } else {
        this.chaseDistance = Math.max(25, Math.min(4000, this.chaseDistance * (1 + Math.sign(e.deltaY) * 0.15)));
      }
    }, { passive: false });
  }

  /** Change de mode. `siteLla` sert a planter l'observateur au sol. */
  setMode(mode, siteLla) {
    this.mode = mode;
    this.controls.enabled = mode === 'orbite';
    if (mode === 'sol' && siteLla) this.placeGroundObserver(siteLla);
    if (mode !== 'orbite') this.trackVehicle = true;
    if (mode === 'orbite') {
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Place l'observateur au sol, a quelques centaines de metres du pas de tir :
   * assez pres pour voir l'engin, assez loin pour le suivre des yeux quand il
   * s'eleve.
   */
  placeGroundObserver(lla, offsetMetres = 320, heightMetres = 12) {
    // Altitude du SOL a cet endroit, telle que la donne le champ de relief.
    // C'est elle qui fait foi : l'observateur doit avoir les pieds dessus.
    const groundAlt = this.terrain ? this.terrain.elevation(lla.lat, lla.lon) : (lla.alt ?? 0);
    const pad = llaToEcef(lla.lat, lla.lon, groundAlt);
    // Decalage vers le sud-est du pas de tir, exprime dans le repere local.
    const up = new THREE.Vector3(...pad).normalize();
    const east = new THREE.Vector3(0, 0, 1).cross(up).normalize();
    const north = up.clone().cross(east).normalize();
    const p = new THREE.Vector3(...pad)
      .addScaledVector(east, offsetMetres * 0.7)
      .addScaledVector(north, -offsetMetres * 0.7)
      .addScaledVector(up, heightMetres);
    this.groundOrigin = toScene([p.x, p.y, p.z]);
    this.groundUp = toScene([up.x, up.y, up.z]).normalize();
    this.groundEast = toScene([east.x, east.y, east.z]).normalize();
    this.groundNorth = toScene([north.x, north.y, north.z]).normalize();
    this.groundYaw = Math.PI * 0.25;
    this.groundPitch = 0.25;
    this.groundFov = 42;
    this.trackVehicle = true;

    this.buildLocalGround(lla, pad, up, east, north);
  }

  /**
   * Echantillonne le relief autour du pas de tir et en fait une nappe.
   * Chaque sommet est calcule en coordonnees locales est/nord, eleve a
   * l'altitude du terrain, puis converti en repere terrestre — la courbure du
   * globe est donc respectee, et la nappe se raccorde naturellement a
   * l'horizon.
   */
  buildLocalGround(lla, pad, up, east, north) {
    if (!this.terrain) return;
    const geo = this.groundPatch.geometry;
    const pos = geo.attributes.position;
    const n = GROUND_SEGMENTS + 1;
    const colors = new Float32Array(n * n * 3);
    const mPerDegLat = 110570;
    const mPerDegLon = 111320 * Math.cos(lla.lat * DEG);

    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const dxE = (ix / GROUND_SEGMENTS - 0.5) * 2 * GROUND_HALF_WIDTH;
        const dyN = (0.5 - iy / GROUND_SEGMENTS) * 2 * GROUND_HALF_WIDTH;
        const lat = lla.lat + dyN / mPerDegLat;
        const lon = lla.lon + dxE / mPerDegLon;
        const h = this.terrain.elevation(lat, lon);

        // On passe par les coordonnees geodesiques ABSOLUES plutot que par un
        // deplacement relatif au pas de tir : l'altitude declaree du site ne
        // coincide pas forcement avec celle du champ de relief, et s'y referer
        // placerait le sol a cote — voire au-dessus de l'observateur.
        const sp = toScene(llaToEcef(lat, lon, h));
        const i = iy * n + ix;
        pos.setXYZ(i, sp.x, sp.y, sp.z);

        // Meme teinte hypsometrique que la texture du globe, pour que le
        // raccord entre le sol proche et le globe lointain ne saute pas.
        const rug = this.terrain.ruggedness(lat, lon);
        const t = Math.min(1, h / 2400);
        colors[i * 3] = (17 + 96 * t + 42 * rug) / 255;
        colors[i * 3 + 1] = (33 + 72 * t + 34 * rug) / 255;
        colors[i * 3 + 2] = (27 + 48 * t + 25 * rug) / 255;
      }
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    // Les sommets sont deja en coordonnees absolues de scene.
    this.groundPatch.position.set(0, 0, 0);
    this.groundPatch.quaternion.identity();
  }

  /** Cible suivie par les vues rapprochees (position de l'engin, en scene). */
  setFollowTarget(vec) {
    if (vec) this.followTarget.copy(vec);
    this.hasTarget = !!vec;
  }

  updateCamera() {
    const onGround = this.mode === 'sol';
    if (this.groundPatch) this.groundPatch.visible = onGround;
    // On efface le globe en vue au sol : ses facettes, hautes de deux
    // kilometres, engloutiraient la camera. La nappe locale le remplace.
    if (this.earth) this.earth.visible = !onGround;
    // Le halo n'a de sens que vu de l'exterieur. En vue rapprochee on est
    // dessous ou dedans : il ne ferait qu'un voile parasite.
    if (this.halo) {
      this.halo.visible = this.mode === 'orbite'
        && this.camera.position.length() > this.haloRadius * 1.001;
    }

    if (this.mode === 'orbite') { this.controls.update(); return; }

    if (this.mode === 'sol') {
      if (!this.groundOrigin) return;
      this.camera.position.copy(this.groundOrigin);
      this.camera.fov = this.groundFov;
      this.camera.updateProjectionMatrix();

      if (this.trackVehicle && this.hasTarget) {
        this.camera.up.copy(this.pickUpRef(
          this._tmp.copy(this.followTarget).sub(this.groundOrigin).normalize(),
        ));
        this.camera.lookAt(this.followTarget);
        // On garde la visee courante pour reprendre la main sans a-coup.
        const dir = this._tmp.copy(this.followTarget).sub(this.groundOrigin).normalize();
        this.groundPitch = Math.asin(Math.max(-1, Math.min(1, dir.dot(this.groundUp))));
        const flat = this._tmp2.copy(dir).addScaledVector(this.groundUp, -dir.dot(this.groundUp)).normalize();
        this.groundYaw = Math.atan2(flat.dot(this.groundEast), flat.dot(this.groundNorth));
      } else {
        const cp = Math.cos(this.groundPitch), sp = Math.sin(this.groundPitch);
        const dir = this._tmp.set(0, 0, 0)
          .addScaledVector(this.groundNorth, cp * Math.cos(this.groundYaw))
          .addScaledVector(this.groundEast, cp * Math.sin(this.groundYaw))
          .addScaledVector(this.groundUp, sp);
        this.camera.up.copy(this.pickUpRef(dir));
        this.camera.lookAt(this._tmp2.copy(this.groundOrigin).add(dir));
      }
      return;
    }

    if (this.mode === 'poursuite' && this.hasTarget) {
      const up = this._tmp.copy(this.followTarget).normalize();
      const d = this.chaseDistance * SCENE_SCALE;
      // On se place derriere et un peu au-dessus, en se referant a la verticale
      // locale : la vue reste lisible quelle que soit l'attitude de l'engin.
      const back = this.chaseDir || new THREE.Vector3(1, 0, 0);
      // Meme piege qu'au sol : si l'engin monte a la verticale, la direction
      // de poursuite s'aligne sur la verticale locale.
      this.camera.up.copy(Math.abs(back.dot(up)) > 0.985
        ? this._tmp2.set(0, 0, 1).cross(up).normalize()
        : up);
      this.camera.position.copy(this.followTarget)
        .addScaledVector(back, -d)
        .addScaledVector(up, d * 0.34);
      this.camera.fov = 46;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.followTarget);
    }
  }

  /**
   * Choisit une reference « haut » utilisable pour `lookAt`.
   *
   * Depuis le sol, un missile qui monte finit a la verticale de l'observateur :
   * la direction de visee devient alors colinéaire a la verticale locale, et
   * `lookAt` n'a plus de solution — l'image bascule brutalement. On se rabat
   * dans ce cas sur le nord local, qui reste perpendiculaire a la visee.
   */
  pickUpRef(dir) {
    if (!this.groundUp) return this._upRef || (this._upRef = new THREE.Vector3(0, 1, 0));
    if (!this._upRef) this._upRef = new THREE.Vector3();
    const aligned = Math.abs(dir.dot(this.groundUp));
    return this._upRef.copy(aligned > 0.985 ? this.groundNorth : this.groundUp);
  }

  /** Direction de deplacement de l'engin, pour orienter la vue de poursuite. */
  setChaseDirection(vec) {
    if (!this.chaseDir) this.chaseDir = new THREE.Vector3();
    if (vec && vec.lengthSq() > 0) this.chaseDir.copy(vec).normalize();
  }

  render() {
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
