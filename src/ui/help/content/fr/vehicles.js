// Fiches « vecteurs » — français.
export default {
  'veh.bal2': {
    title: 'Vecteur A — balistique à deux étages',
    caption: 'Deux minutes de poussée décident de ce que feront les seize suivantes.',
    labels: {
      cutoff: 'Extinction',
      cutoffNote: '120 s de poussée, puis 950 s de vol libre',
      apogee: 'apogée',
      sealed: 'La trajectoire est scellée dès l\'extinction',
      sealedNote: 'aucune gouverne, aucune poussée, aucun autodirecteur',
      target: 'objectif',
      atCutoff: 'à l\'extinction',
      exaggerated: 'écart dessiné exagéré',
      caption: 'Tout le vol tient à un instant, à 3 % du chemin.',
    },
    body: `<p>Deux étages à propergol solide, 24,7 t au décollage, quelque 7,2 km/s d'incrément de vitesse idéal, et un corps de rentrée de 600 kg. Portée utile 3600 km. L'extinction n'est pas un chronomètre : à chaque cycle le calculateur résout le problème balistique depuis la position qu'il <em>croit</em> occuper, prédit où tomberait l'engin, et coupe le moteur quand cette portée prédite rejoint celle de la cible. Un même vecteur couvre ainsi toutes les portées jusqu'à son maximum, sans programme de vol figé d'avance.</p>
      <p><b>Après l'extinction, plus rien n'est rattrapable.</b> Aucune gouverne, aucune poussée, aucun autodirecteur : le reste du vol est une ellipse fixée par une position et un vecteur vitesse. Sur 2890 km, le moteur brûle 120 s et l'engin vole librement pendant 950. La précision du tir se joue dans les dernières millisecondes de cette combustion.</p>
      <p>La sensibilité est brutale et simple — environ <b>2R/v</b>. Mesuré à 2890 km, extinction à 4725 m/s : un m/s de plus emporte le point d'impact 1446 m plus loin. Or le second étage pousse encore à 16 g quand il s'arrête, si bien qu'<em>une milliseconde de retard à la coupure vaut 0,16 m/s, donc 225 m à l'arrivée</em>. C'est pourquoi le simulateur raccourcit son pas d'intégration à l'approche de l'extinction, et pourquoi le calculateur extrapole son critère afin de couper au milieu d'un pas.</p>
      <p>Une correction est faite avant l'extinction, et seulement avant : la solution képlérienne ignore la traînée de rentrée, qui raccourcit toujours la portée. Le calculateur simule sa propre descente, constate le manque et décale son point visé au-delà de la cible — 4,7 km ici, atteints en dix itérations. La profondeur à laquelle le corps s'enfonce avant que l'air ne morde est fixée par le coefficient balistique, 3800 kg/m² (600 kg sur 0,15 m²) : pic de décélération à 46 g sous 1,7 MPa, 17 s passées sous 30 km, contact au sol à 970 m/s.</p>`,
  },

  'veh.bal3': {
    title: 'Vecteur B — balistique à trois étages',
    caption: 'La règle de pouce tient à 1000 km et ment d\'un facteur trois à 13 000.',
    labels: {
      sensitivity: 'mètres de portée gagnés par m/s à l\'extinction',
      range: 'portée [km]',
      vehA: 'vecteur A',
      vehB: 'vecteur B',
      measured: 'tirs mesurés dans le simulateur',
      real: 'Terre sphérique',
      flatRule: '2R/v — Terre plate',
      at: 'à',
      caption: 'Plus le tir est long, plus chaque mètre par seconde coûte cher.',
    },
    body: `<p>Trois étages, 66,7 t au décollage, 10,5 km/s d'incrément de vitesse idéal, un corps de rentrée de 500 kg, portée utile 13 000 km. Un tir à 11 800 km culmine à 1440 km d'apogée et dure 41 minutes, dont 3,4 de propulsion.</p>
      <p><b>La portée s'achète avec la précision, et le taux de change empire avec la distance.</b> La règle de Terre plate 2R/v est presque exacte à courte portée : 684 m par m/s annoncés à 1060 km contre 702 mesurés. À 13 000 km elle annonce 3,4 km là où la vérité est de 10,1 — près de la portée maximale, la trajectoire approche la limite où un petit incrément de vitesse balaie un grand angle au centre. Comme le troisième étage accélère encore à 14 g quand il s'arrête, <em>une milliseconde de combustion en plus déplace le point d'impact de 1,2 km</em>.</p>
      <p>Tout ce que la centrale se figure de travers à cet instant est multiplié par le même facteur. Une centrale de classe navigation laisse environ 0,4 m/s d'erreur de vitesse à l'extinction ; une centrale tactique en laisse 1,3, et l'écart à l'arrivée grandit de cinq kilomètres. Le vol dure en outre 41 minutes, exactement le régime où la dérive gyrométrique — qui croît comme le cube du temps — prend le pas sur tout le reste : le viseur stellaire obtient 119 visées sur un tel tir, et sans elles ce vecteur n'aurait pas de raison d'être.</p>
      <p>Son corps de rentrée est plus dense, rapporté à sa section, que celui du vecteur A : 6500 kg/m² contre 3800, soit 500 kg sur 0,12 m². Il s'enfonce donc plus profond avant que l'atmosphère ne le freine, atteint 3,15 MPa de pression dynamique et arrive à 1131 m/s. La traînée mange malgré tout de la portée, et le calculateur la compense en visant 14,1 km au-delà de la cible — une correction qu'il ne peut faire que tant que le moteur brûle.</p>`,
  },

  'veh.glide': {
    title: 'Vecteur C — planeur hypersonique',
    caption: 'Apogée 167 km au lieu de 797, et il vole encore quand il arrive.',
    labels: {
      altitude: 'altitude',
      rangeFlown: '% de la portée parcourue',
      vehA: 'Vecteur A — balistique',
      vehANote: 'apogée 797 km pour 2890 km de portée',
      zoom: 'la bande basse, dilatée',
      offScale: 'A sort du cadre',
      apogee: 'apogée',
      pullUp: 'ressource',
      vehC: 'Vecteur C — planeur hypersonique',
      glideNote: 'vol plané d\'équilibre, finesse',
      steering: 'il pilote encore quand il arrive',
      caption: 'L\'un traverse le vide, l\'autre ne quitte jamais l\'air dont il a besoin.',
    },
    body: `<p>Deux étages accélérateurs, puis un corps porteur qui ne retombe pas. La montée est <b>surbaissée à dessein</b> : l'angle de pente commandé décroît linéairement avec l'altitude et s'annule à 72 km, de sorte que l'engin arrive à l'extinction presque à plat. Le rapport poussée/poids est délibérément tenu à 1,8 — au-delà, la pression dynamique monte avant que le véhicule ait eu le temps de se coucher, le limiteur d'incidence empêche le basculement, et il part sur un arc balistique bien trop cabré pour pouvoir ensuite planer.</p>
      <p>Ce qui fait un corps <em>porteur</em>, c'est sa charge alaire. 1400 kg répartis sur 4 m² font 350 kg/m² ; un corps de rentrée, lui, porte 600 kg sur 0,15 m², soit 4000. Le modèle newtonien donne une finesse maximale de 2,2 à 16° d'incidence. La ressource intervient à 62 km et 5110 m/s, à 38 % du chemin, puis vient un vol plané d'équilibre d'environ 1130 s où le calculateur tient l'incidence de finesse maximale et laisse l'altitude se trouver toute seule. L'énergie se gère à la <b>gîte</b>, pas à l'incidence : incliner de μ ne laisse que L·cos μ pour porter le poids, et la portée restante se raccourcit dans le même rapport — c'est ce que brûlent les virages en S.</p>
      <p>L'extinction tombe bien plus tôt que sur un vecteur balistique, puisque la portée comptabilisée est l'arc balistique <em>plus</em> le plané. Et l'engin continue de manœuvrer : 248 s sous 30 km contre 17 pour le vecteur A, en pilotant jusqu'à l'impact. Il ne décale jamais son point visé pour compenser la traînée — correction nulle, mesurée — parce qu'il se contente de voler jusqu'où il croit la cible.</p>
      <p><b>D'où l'essentiel : son écart, c'est son erreur de navigation résiduelle.</b> Avec une centrale de classe tactique, 3,15 km d'écart pour 3,23 km d'erreur de navigation à l'impact. Le planeur corrige tout ce que sa centrale perçoit, et rien d'autre — ce qui en fait le vecteur sur lequel un recalage de terrain rapporte le plus.</p>`,
  },
};
