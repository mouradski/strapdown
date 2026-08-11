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

// Point subsolaire, et de la la direction du Soleil dans la scene.
//
// Une seule source de verite : le terminateur peint sur le globe, la teinte du
// halo atmospherique et la lumiere qui eclaire l'engin doivent designer le
// MEME astre. Deux valeurs qui derivent l'une de l'autre et l'ombre tombe d'un
// cote pendant que les reflets brillent de l'autre.
//
// Position choisie pour la vue d'ouverture (bassin mediterraneen) : le site de
// tir reste en plein jour, mais le terminateur mord assez sur le disque pour
// que la sphere se lise comme une sphere et non comme un disque colorie.
const SUN_LLA = { lat: 16, lon: -32 };
const SUN_DIR = toScene(llaToEcef(SUN_LLA.lat, SUN_LLA.lon, 0)).normalize();

const PALETTE = {
  ocean: '#08111d',
  oceanDeep: '#060d18',
  land: '#16291f',
  landEdge: '#3f7a5f',
  graticule: 'rgba(120, 170, 200, 0.16)',
  equator: 'rgba(150, 200, 230, 0.34)',
};

/** Interpolation adoucie entre deux bornes, comme la fonction GLSL homonyme. */
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Rampe hypsometrique, partagee par la texture du globe et par la nappe de sol
 * local. Les deux DOIVENT lire la meme : le raccord entre le sol proche et la
 * planete lointaine se verrait sinon comme une couture de couleur.
 *
 * La clarte suit surtout la RUGOSITE, pas l'altitude — c'est tres concretement
 * la carte des regions ou une correlation de relief a des chances d'accrocher,
 * et le joueur peut y choisir sa route en connaissance de cause.
 *
 * Teintes volontairement sombres : elles sont ensuite multipliees par
 * l'eclairage de la scene. Une palette calibree pour « bien rendre » telle
 * quelle sature des que le soleil tombe droit dessus, ce qui arrive
 * precisement en vue au sol.
 *
 * `shade` est le facteur d'ombrage du relief ; il vaut 1 sur la nappe locale,
 * qui recoit le vrai eclairage de la scene et n'a pas besoin d'ombrage peint.
 * Ecrit trois octets dans `out` a partir de `o`.
 */
function hypsometric(h, rugged, absLat, shade, out, o = 0) {
  const t = Math.min(1, h / 2400);
  let r = 18 + 88 * t + 40 * rugged;
  let g = 40 + 64 * t + 28 * rugged;
  let b = 26 + 42 * t + 23 * rugged;

  // Ligne des neiges. Elle descend de trois mille metres sous les tropiques
  // jusqu'au niveau de la mer aux hautes latitudes : sans elle le Groenland et
  // l'Antarctique sortaient en vert de plaine, et le globe n'avait plus ni
  // haut ni bas.
  const snow = Math.max(
    smoothstep(66, 79, absLat),
    smoothstep(0, 700, h - (3100 - 2500 * Math.pow(absLat / 90, 1.5))),
  );
  if (snow > 0) {
    r += (208 - r) * snow;
    g += (219 - g) * snow;
    b += (215 - b) * snow;
  }

  r *= shade; g *= shade; b *= shade;
  // On sature en PROPORTION plutot que canal par canal. Tronquer chaque canal
  // separement vire au blanc rose sur les versants au soleil, et surtout
  // detruit l'ordre vert > bleu dont le shader du globe se sert pour
  // reconnaitre la mer.
  const m = Math.max(r, g, b);
  if (m > 252) { const s = 252 / m; r *= s; g *= s; b *= s; }
  out[o] = r; out[o + 1] = g; out[o + 2] = b;
}

/**
 * Bathymetrie schematique, peinte sous les continents.
 *
 * Un aplat bleu ne dit rien : une mer bordiere et une plaine abyssale y ont la
 * meme couleur, et les continents flottent sur du vide. On teinte donc l'eau
 * selon sa DISTANCE A LA COTE, seul parametre bathymetrique lisible a cette
 * echelle — plateau continental clair, puis chute vers l'abysse.
 *
 * Calculee sur la grille du masque terre/mer puis etiree par le canvas : l'eau
 * n'a aucun detail fin a rendre, et la faire en pleine resolution couterait
 * trente fois plus cher pour une image identique.
 */
function buildBathymetry(mask, w, h, seed) {
  // Distance a la cote, par double balayage de chanfrein. Une propagation
  // exacte demanderait une file de priorite pour deux pour cent de precision
  // en plus, dont une teinte d'eau n'a que faire.
  const BIG = 1e6;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = mask[i] ? 0 : BIG;
  const D1 = 1, D2 = 1.41421356;
  // Les balayages enjambent l'antimeridien : sans cela une fausse cote
  // apparait au beau milieu du Pacifique, la ou la carte se referme.
  const wrap = (x) => (x < 0 ? x + w : (x >= w ? x - w : x));
  for (let y = 0; y < h; y++) {
    const row = y * w, prev = row - w;
    for (let x = 0; x < w; x++) {
      let d = dist[row + x];
      if (d === 0) continue;
      if (y > 0) {
        d = Math.min(d, dist[prev + x] + D1,
          dist[prev + wrap(x - 1)] + D2, dist[prev + wrap(x + 1)] + D2);
      }
      dist[row + x] = Math.min(d, dist[row + wrap(x - 1)] + D1);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w, next = row + w;
    for (let x = w - 1; x >= 0; x--) {
      let d = dist[row + x];
      if (d === 0) continue;
      if (y < h - 1) {
        d = Math.min(d, dist[next + x] + D1,
          dist[next + wrap(x - 1)] + D2, dist[next + wrap(x + 1)] + D2);
      }
      dist[row + x] = Math.min(d, dist[row + wrap(x + 1)] + D1);
    }
  }

  // On reutilise le generateur de relief plutot que d'ecrire un second bruit :
  // une autre graine suffit, et sa longueur d'onde — le millier de kilometres —
  // est justement celle des bassins et des dorsales.
  const basins = makeTerrain({ seed: seed + 31, isLand: () => true });

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    const lat = 90 - ((y + 0.5) / h) * 180;
    // Banquise. Sans elle le pole nord reste un trou noir au milieu des
    // calottes — un ocean, precisement, mais l'oeil y lit un defaut.
    const iceLat = smoothstep(73, 82, Math.abs(lat));
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const lon = ((x + 0.5) / w) * 360 - 180;
      const f = basins.ruggedness(lat, lon);
      // Le plateau s'etend sur une a deux cellules, la chute vers l'abysse sur
      // une demi-douzaine ; le champ de bassins deforme la bordure pour
      // qu'elle ne suive pas servilement le trait de cote.
      const shelf = 1 - smoothstep(0.8, 7.0, dist[i] * (0.7 + 0.6 * f));
      let r = 5 + 13 * shelf + 4 * f;
      let g = 13 + 34 * shelf + 7 * f;
      let b = 26 + 42 * shelf + 11 * f;
      const ice = iceLat * (0.55 + 0.45 * f);
      if (ice > 0) { r += (138 - r) * ice; g += (152 - g) * ice; b += (149 - b) * ice; }
      const o = i * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

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

  const ringPath = (rings) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  };

  const eachLandPath = (fn) => {
    for (const f of land.features) {
      const g = f.geometry;
      if (g.type === 'Polygon') { ringPath(g.coordinates); fn(); }
      else if (g.type === 'MultiPolygon') for (const p of g.coordinates) { ringPath(p); fn(); }
    }
  };

  const fillLand = () => {
    ctx.fillStyle = PALETTE.land;
    eachLandPath(() => ctx.fill());
  };
  const strokeCoast = () => {
    ctx.strokeStyle = PALETTE.landEdge;
    ctx.lineWidth = Math.max(1, width / 2048);
    eachLandPath(() => ctx.stroke());
  };
  fillLand();
  strokeCoast();

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

  // L'eau est repeinte PAR-DESSUS tout, continents compris, puis les terres
  // sont retracees. C'est plus simple et plus rapide que de n'atteindre que
  // les pixels d'ocean, et cela ne coute qu'un second trace des contours ; le
  // masque, lui, a deja ete releve et reste donc rigoureusement inchange.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buildBathymetry(mask, maskW, maskH, terrainSeed), 0, 0, width, height);
  fillLand();

  // --- Ombrage du relief ---
  //
  // On teinte les terres selon l'altitude et surtout selon la PENTE : les
  // regions accidentees ressortent en clair.
  const terrain = makeTerrain({ seed: terrainSeed, isLand });
  const img = ctx.getImageData(0, 0, width, height);
  const px = img.data;
  const block = 2; // on echantillonne un pixel sur deux : invisible, deux fois plus rapide
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);

  // Ecart des differences finies, en blocs. Plus court, on echantillonne le
  // relief d'affichage sous sa plus fine longueur d'onde et l'ombrage devient
  // du bruit ; plus long, les cretes s'emoussent.
  const GAP = 3;

  // Chaque altitude sert a TROIS pixels : le sien, celui dont il est le voisin
  // est, celui dont il est le voisin sud. On garde donc les lignes deja
  // calculees dans un anneau au lieu de les evaluer trois fois — le champ de
  // relief coute a lui seul l'essentiel du temps de chargement.
  const ring = [];
  for (let i = 0; i <= GAP; i++) {
    ring.push({
      row: -1,
      h: new Float32Array(cols),
      rug: new Float32Array(cols),
      land: new Uint8Array(cols),
    });
  }
  const rowAt = (j) => {
    const jj = Math.min(j, rows - 1);
    const slot = ring[jj % (GAP + 1)];
    if (slot.row === jj) return slot;
    const lat = 90 - ((jj * block) / height) * 180;
    for (let i = 0; i < cols; i++) {
      const lon = ((i * block) / width) * 360 - 180;
      if (isLand(lat, lon)) {
        const e = terrain.displayElevation(lat, lon);
        slot.land[i] = 1; slot.h[i] = e.height; slot.rug[i] = e.rugged;
      } else {
        slot.land[i] = 0; slot.h[i] = 0; slot.rug[i] = 0;
      }
    }
    slot.row = jj;
    return slot;
  };

  // Soleil de carte : nord-ouest, trente degres au-dessus de l'horizon. C'est
  // l'angle des cartes en relief depuis toujours — assez rasant pour dessiner
  // les lignes de crete, assez haut pour ne pas noyer les versants a l'ombre.
  const LX = -0.612, LY = 0.612, LZ = 0.5;
  // Exageration verticale. A 4096 pixels un point couvre une cinquantaine de
  // kilometres : les pentes vraies y sont de l'ordre du centieme et un ombrage
  // honnete rendrait la carte parfaitement lisse. Les cartes en relief
  // exagerent depuis toujours ; ici d'un facteur soixante.
  const EXAG = 60;
  const dLonDeg = (360 / width) * block * GAP;
  const dym = (180 / height) * block * GAP * 110570;
  const rgb = [0, 0, 0];

  for (let j = 0; j < rows; j++) {
    const r0 = rowAt(j);
    const r3 = rowAt(j + GAP);
    const lat = 90 - ((j * block) / height) * 180;
    const absLat = Math.abs(lat);
    // Plancher sur la largeur d'un pas en longitude : au-dela de 86 degres les
    // meridiens se resserrent au point que la moindre bosse produirait une
    // pente infinie, et la calotte partirait en eclairs blancs.
    const dxm = Math.max(4000, dLonDeg * 111320 * Math.cos(lat * DEG));
    const py = j * block;
    for (let i = 0; i < cols; i++) {
      if (!r0.land[i]) continue;
      const e = r0.h[i];

      const sx = Math.max(-4, Math.min(4, (r0.h[(i + GAP) % cols] - e) / dxm * EXAG));
      const sy = Math.max(-4, Math.min(4, (e - r3.h[i]) / dym * EXAG));
      const inv = 1 / Math.sqrt(sx * sx + sy * sy + 1);
      const illum = (LZ - sx * LX - sy * LY) * inv;
      // Rapporte au terrain plat, pour que la plaine garde exactement la
      // teinte de la rampe et que seul le relief s'en ecarte.
      const shade = Math.min(1.7, 0.30 + 0.70 * Math.pow(Math.max(0, illum) / LZ, 1.15));

      hypsometric(e, r0.rug[i], absLat, shade, rgb);
      const pxx = i * block;
      for (let by = 0; by < block && py + by < height; by++) {
        for (let bx = 0; bx < block && pxx + bx < width; bx++) {
          const o = ((py + by) * width + (pxx + bx)) * 4;
          // Le masque terre/mer n'a qu'un demi-degre de cote : peindre le bloc
          // entier deborderait dans l'eau et redecouperait toutes les cotes en
          // escalier. On ne recouvre donc que les pixels que le trace des
          // contours a effectivement remplis — ceux ou le vert l'emporte
          // encore sur le bleu. Les mers interieures restent de l'eau, et le
          // littoral garde la finesse du trace vectoriel.
          if (px[o + 1] <= px[o + 2]) continue;
          px[o] = rgb[0];
          px[o + 1] = rgb[1];
          px[o + 2] = rgb[2];
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Le trait de cote passe APRES le relief, qui l'aurait sinon efface partout
  // ou le masque voit de la terre.
  strokeCoast();

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

// Sommet commun au globe et a sa coque atmospherique.
//
// La normale d'une coque spherique centree sur l'origine est sa propre
// position : inutile de la transporter par la matrice normale, et l'on evite
// au passage le piege classique de l'echelle non uniforme (les deux maillages
// sont aplatis en Y). L'aplatissement de trois millièmes ne devie cette
// normale que de deux dixiemes de degre, sous le seuil du visible.
//
// `#include <logdepthbuf_*>` : ces deux coques doivent ecrire la MEME
// profondeur logarithmique que le reste de la scene, sans quoi leur test de
// profondeur se compare a une echelle differente et le resultat n'a plus de
// sens — halo qui recouvre les etoiles, ou globe qui disparait derriere elles.
const SHELL_VERTEX = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNrm;
  varying vec3 vEye;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNrm = normalize(wp.xyz);
    vEye = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }`;

/**
 * Materiau du globe.
 *
 * On abandonne MeshStandardMaterial : il n'y a rien a eclairer physiquement
 * ici — un astre unique, aucune ombre portee, une surface mate — et surtout il
 * ne sait pas faire de terminateur. Un simple max(N.L, 0) donne une frontiere
 * jour/nuit NETTE, ce qui est faux : l'atmosphere diffuse la lumiere bien
 * au-dela du point de tangence geometrique, et la penombre s'etale en realite
 * sur une dizaine de degres de longitude.
 *
 * La nuit n'est pas eteinte pour autant. Elle garde un fond bleute d'environ
 * un huitieme du jour, ce qui correspond a peu pres a ce que la Lune et la
 * lueur du ciel nocturne rendent visible — et ce qui laisse surtout au joueur
 * de quoi designer un objectif du cote sombre.
 */
function earthMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uSun: { value: SUN_DIR },
      uNight: { value: new THREE.Color(0.042, 0.052, 0.082) },
      uHaze: { value: new THREE.Color(0.030, 0.058, 0.100) },
      uGlint: { value: new THREE.Color(0.60, 0.56, 0.46) },
    },
    vertexShader: SHELL_VERTEX,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      #include <tonemapping_pars_fragment>
      uniform sampler2D uMap;
      uniform vec3 uSun;
      uniform vec3 uNight;
      uniform vec3 uHaze;
      uniform vec3 uGlint;
      varying vec2 vUv;
      varying vec3 vNrm;
      varying vec3 vEye;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 albedo = texture2D(uMap, vUv).rgb;
        vec3 n = normalize(vNrm);
        vec3 e = normalize(vEye);
        float ndl = dot(n, uSun);

        // Terminateur : une dizaine de degres de penombre de part et d'autre.
        float day = smoothstep(-0.16, 0.21, ndl);
        // Le terme constant est l'eclairement du ciel : sous une atmosphere,
        // meme un versant tourne a l'oppose du Soleil recoit du bleu diffus.
        float diff = day * (0.09 + 0.30 * max(ndl, 0.0));

        // Mer ou terre ? La rampe hypsometrique garde partout le vert
        // au-dessus du bleu, la bathymetrie l'inverse partout. On lit donc le
        // meme critere que le masque construit au chargement — et en RAPPORT,
        // pour qu'il reste valable a l'ombre comme en plein soleil.
        float lm = (albedo.g - albedo.b) / (albedo.g + albedo.b + 2e-4);
        float sea = 1.0 - smoothstep(-0.06, 0.04, lm);

        // Reflet du Soleil sur la mer : un lobe etroit pour l'eclat, un large
        // pour la trainee argentee qui l'entoure. C'est ce qui trahit l'eau.
        vec3 hv = normalize(uSun + e);
        float nh = max(dot(n, hv), 0.0);
        float glint = (pow(nh, 320.0) * 0.9 + pow(nh, 95.0) * 0.12) * sea * day;

        vec3 col = albedo * diff + albedo * uNight * (1.0 - day);
        col += uGlint * glint;

        // Diffusion vue de face : la couche d'air s'epaissit vers le bord du
        // disque, exactement comme au limbe, et voile le sol d'autant.
        float rim = 1.0 - max(dot(n, e), 0.0);
        col += uHaze * pow(rim, 3.0) * day * (0.30 + 0.70 * max(ndl, 0.0));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Halo atmospherique.
 *
 * Un Fresnel uniforme donne un lisere de meme couleur et de meme epaisseur
 * tout autour du disque, ce que l'atmosphere ne fait jamais. Au limbe, un
 * rayon traverse des dizaines de fois plus d'air qu'au zenith ; pres du
 * terminateur il rase en outre la surface sur des milliers de kilometres, et
 * la diffusion de Rayleigh a largement le temps d'evacuer tout le bleu. Il ne
 * reste que l'orange — c'est le lever de soleil, vu d'en haut. On fait donc
 * varier la TEINTE avec l'angle du Soleil, et pas seulement l'opacite.
 *
 * L'atmosphere s'eleve a cent kilometres : elle reste eclairee un peu apres
 * que le sol soit passe dans l'ombre. Son terminateur a elle est donc en
 * retard de quelques degres sur celui du globe, et c'est ce decalage qui fait
 * le lisere lumineux du cote nuit.
 */
function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uZenith: { value: new THREE.Color(0x4a9fd8) },
      uLimb: { value: new THREE.Color(0xffa96b) },
      uSun: { value: SUN_DIR },
    },
    vertexShader: SHELL_VERTEX,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uZenith;
      uniform vec3 uLimb;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying vec3 vNrm;
      varying vec3 vEye;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vNrm);
        vec3 e = normalize(vEye);
        float rim = 1.0 - abs(dot(n, e));
        float ndl = dot(n, uSun);

        float lit = smoothstep(-0.28, 0.18, ndl);
        // Bande crepusculaire : maximale la ou le Soleil rase l'horizon.
        float dusk = 1.0 - smoothstep(0.0, 0.42, abs(ndl));

        // Diffusion vers l'avant : en regardant vers le Soleil a travers le
        // limbe, l'air renvoie plusieurs fois plus de lumiere qu'en le prenant
        // de dos. C'est ce qui fait qu'un croissant est toujours cercle d'un
        // halo plus vif que la pleine face.
        float fwd = 0.80 + 0.95 * pow(max(-dot(e, uSun), 0.0), 3.0);

        vec3 col = mix(uZenith, uLimb, dusk * dusk * 0.60);
        float a = pow(rim, 3.0) * lit * (0.82 + 0.48 * dusk * dusk) * fwd;
        gl_FragColor = vec4(col, min(a, 1.0));
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
    const _t0 = performance.now();
    const { canvas: texCanvas, isLand, terrain } = buildEarthTexture(4096, 7);
    window.__texMs = performance.now() - _t0;
    this.isLand = isLand;
    this.terrain = terrain;

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    // Sphere legerement aplatie, comme l'ellipsoide de reference.
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, 128, 96),
      earthMaterial(texture),
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

    // Eclairage volontairement modere : la nappe de sol local, le seul objet
    // etendu que ces lampes eclairent encore, porte DEJA sa teinte de relief.
    // La reeclairer trop fort la fait saturer — sans consequence depuis
    // l'orbite ou l'on voit surtout des angles rasants, mais aveuglant en vue
    // au sol quand le soleil tombe droit dessus.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
    sun.position.copy(SUN_DIR).multiplyScalar(50);
    this.scene.add(sun);

    this.scene.add(this.makeStarfield());
    this.raycaster = new THREE.Raycaster();
    this.resize();
    window.__globe = this;
  }

  /**
   * Voute etoilee.
   *
   * Le ciel reel n'est pas une poussiere uniforme : le nombre d'etoiles
   * environ triple a chaque magnitude, si bien que l'oeil accroche quelques
   * points francs sur un fond de points a peine perceptibles. C'est ce
   * contraste, et non le nombre, qui donne au ciel son grain — ce qui compte
   * surtout en vue de poursuite, ou il occupe la moitie de l'image.
   */
  makeStarfield() {
    const n = 4200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Repartition uniforme sur la sphere : il faut tirer le cosinus de la
      // colatitude, pas l'angle, sinon les etoiles s'agglutinent aux poles.
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 200 + Math.random() * 60;
      pos[i * 3] = r * s * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(th);

      // Eclat en loi de puissance : le cube d'un tirage uniforme reproduit
      // assez bien le fait qu'il y a une centaine de fois plus d'etoiles a la
      // limite de visibilite que de vraiment brillantes.
      const b = Math.pow(Math.random(), 3);

      // Indice de couleur : negatif pour les etoiles chaudes (bleutees),
      // positif pour les naines froides (orangees). Les brillantes penchent
      // vers le bleu — une geante chaude rayonne des milliers de fois plus
      // qu'une naine rouge, et se voit donc de bien plus loin.
      const bv = (Math.random() * 2 - 1) * 0.85 - 0.35 * b;
      const warm = Math.max(0, bv), cold = Math.max(0, -bv);
      const lum = 0.26 + 0.74 * b;
      col[i * 3] = (1 - 0.24 * cold) * lum;
      col[i * 3 + 1] = (1 - 0.10 * warm - 0.09 * cold) * lum;
      col[i * 3 + 2] = (1 - 0.36 * warm) * lum;
      size[i] = 1.05 + 2.4 * b * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    // Taille en pixels et NON attenuee par la distance : les etoiles sont a
    // l'infini optique, et les faire grossir quand la camera recule — ce que
    // fait l'attenuation de Three.js — donnerait un ciel qui respire.
    this.starMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      // Le drapeau declare l'attribut `color` ; le nom est impose par Three.js.
      vertexColors: true,
      uniforms: { uPixelRatio: { value: 1 } },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aSize;
        uniform float uPixelRatio;
        varying vec3 vTint;
        void main() {
          vTint = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vTint;
        void main() {
          #include <logdepthbuf_fragment>
          // Profil gaussien : un point carre se remarque immediatement, et un
          // disque a bord net scintille des que l'image bouge d'un demi-pixel.
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-d * d * 3.2);
          if (a < 0.02) discard;
          gl_FragColor = vec4(vTint * a, a);
        }`,
    });
    return new THREE.Points(geo, this.starMaterial);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // gl_PointSize compte en pixels du tampon, pas en pixels CSS : sans ce
    // facteur les etoiles maigrissent de moitie sur un ecran a haute densite.
    if (this.starMaterial) this.starMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
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
    const rgb = [0, 0, 0];

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

        // Meme rampe hypsometrique que la texture du globe, pour que le
        // raccord entre le sol proche et le globe lointain ne saute pas. Sans
        // ombrage peint, en revanche : cette nappe a de vraies normales et
        // recoit le vrai eclairage de la scene.
        hypsometric(h, this.terrain.ruggedness(lat, lon), Math.abs(lat), 1, rgb);
        colors[i * 3] = rgb[0] / 255;
        colors[i * 3 + 1] = rgb[1] / 255;
        colors[i * 3 + 2] = rgb[2] / 255;
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
