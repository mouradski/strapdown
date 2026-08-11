// Fiches « bandeau de vol » — français.
export default {
  'hud.altitude': {
    title: 'Altitude',
    caption: 'Chaque recalage a sa tranche de ciel.',
    labels: {
      time: 'temps de vol', altitude: 'altitude [km]',
      star: 'viseur stellaire', baro: 'baromètre', radar: 'radioaltimètre',
      blind: 'plus rien ne répond',
      offscale: 'hors cadre — apogée',
      crossing: 'traversée en',
      aboveStar: '90 % du vol au-dessus de 45 km',
      caption: 'L\'altitude décide de quels capteurs sont encore éveillés.',
    },
    body: `<p>Hauteur au-dessus de l'ellipsoïde de référence, calculée depuis la position <em>vraie</em> — et non hauteur au-dessus du sol survolé. Au-dessus d'un plateau à 900 m, le radioaltimètre annonce 900 m de moins que ce chiffre, et c'est précisément de cette différence que vit la corrélation de terrain.</p>
      <p>L'altitude est aussi le distributeur de toute la suite de capteurs. Chacun a sa tranche : le viseur stellaire ne voit rien sous 45 km, le baromètre est abandonné au-dessus de 32 km, le radioaltimètre porte à 15 km, la corrélation de terrain travaille entre 300 m et 32 km. Il subsiste donc, entre 32 et 45 km, une bande où <b>plus rien ne répond</b> — elle ne résulte d'aucune intention, seulement des réglages par défaut.</p>
      <p>Les deux familles de vecteurs la traitent de façon opposée. Le balistique la franchit en sept secondes à la montée et passe 90 % de ses 865 s de vol au-dessus de 45 km, où le viseur stellaire est son seul témoin. Le planeur, lui, croise entre 25 et 60 km pendant un quart d'heure, à cheval sur la bande — d'où le fait que la corrélation de terrain soit son affaire et non celle d'un corps de rentrée.</p>`,
  },

  'hud.speed': {
    title: 'Vitesse',
    caption: 'Immobile sur son pas de tir, le vecteur file déjà à 411 m/s.',
    labels: {
      time: 'temps de vol', speed: 'vitesse [km/s]',
      floor: 'rotation terrestre à 28° N —',
      burnout: 'extinction', apogee: 'apogée', impact: 'impact',
      brake: 'l\'atmosphère reprend 3,3 km/s en 25 s',
      caption: 'Vitesse inertielle : elle ne part pas de zéro et n\'y revient jamais.',
    },
    body: `<p>Module de la vitesse dans le repère inertiel. Sur son pas de tir, parfaitement immobile, le bandeau affiche déjà 411 m/s : un site à 28° de latitude est emporté vers l'est par la rotation terrestre à 465·cos φ. Ce n'est pas un artefact d'affichage mais une vraie quantité de mouvement — la solution de tir compte dessus, et l'azimut de lancement en est infléchi.</p>
      <p>La courbe ne revient pas davantage à zéro. À l'apogée, 586 km plus haut, il reste 2,97 km/s, les trois quarts des 3,99 km/s de l'extinction : une trajectoire balistique est un arc d'orbite, et sa composante horizontale traverse tout le vol. Seule l'atmosphère la reprend : 4,28 km/s à 48 km, 0,95 km/s au sol, vingt-cinq secondes plus tard.</p>
      <p>Une précaution. C'est la vitesse par rapport au repère inertiel, alors que la traînée, le Mach et la pression dynamique se calculent par rapport à l'<em>air</em>, qui tourne avec la planète. L'écart atteint 465 m/s selon le cap, et c'est pourquoi ce chiffre et le nombre de Mach ne racontent jamais tout à fait la même histoire.</p>`,
  },

  'hud.mach': {
    title: 'Nombre de Mach',
    caption: 'La vitesse du son selon l\'altitude ; le coefficient de traînée selon le Mach.',
    labels: {
      sound: 'vitesse du son [m/s]', altitude: 'altitude [km]',
      mach: 'Mach', drag: 'coefficient de traînée',
      warm: 'stratopause, 271 K', cold: 'mésopause, 187 K',
      peak: 'pic transsonique', floorCd: 'hypersonique',
      example: 'À la descente, 4,17 km/s à 103 km donnent Mach 14,2 ;',
      example2: '4,28 km/s à 49 km — plus vite — donnent Mach 12,2.',
      caption: 'Le Mach mesure une compressibilité, pas une vitesse.',
    },
    body: `<p>Vitesse relative à l'air divisée par la vitesse du son locale. Celle-ci ne dépend que de la température : 340 m/s au niveau de la mer, 295 m/s dans la tropopause, 330 m/s à la stratopause vers 50 km, où l'ozone réchauffe l'air, puis 274 m/s à 86 km.</p>
      <p>D'où une lecture déroutante à la descente : entre 103 km et 49 km, le bandeau montre la vitesse qui <em>monte</em>, de 4,17 à 4,28 km/s, tandis que le Mach <em>descend</em> de 14,2 à 12,2. Rien n'a ralenti ; l'air est simplement 84 K plus chaud. Au-dessus de 100 km, le bandeau cesse d'afficher le nombre — il n'y a plus assez d'air pour qu'il veuille dire quelque chose.</p>
      <p>Pourquoi l'embarquer : dans ce simulateur, le coefficient de traînée est fonction du Mach et de rien d'autre. Il triple à la traversée du transsonique — 0,15 en subsonique, 0,44 à Mach 1,05 — avant de se stabiliser à 0,19 en hypersonique. Cette bosse, franchie vers T+20 s, est un péage que l'on paie une fois et que l'on ne récupère pas.</p>`,
  },

  'hud.dynPressure': {
    title: 'Pression dynamique',
    caption: 'Une densité qui s\'effondre multipliée par une vitesse qui grimpe.',
    labels: {
      altitude: 'altitude [km]', pressure: 'pression dynamique [kPa]',
      density: 'densité', speed: 'vitesse air',
      limit2: 'incidence ≤ 2°', limit6: '≤ 6°',
      reentry: 'À la rentrée, 1,3 MPa vers 11 km — treize fois le maximum de la montée.',
      caption: 'Sans pression dynamique, aucune gouverne ne mord.',
    },
    body: `<p><b>½ρv²</b>, la pression qu'exerce l'écoulement. La densité est divisée par trois sur les dix premiers kilomètres et par quatorze sur vingt, pendant que la vitesse grimpe régulièrement : le produit passe donc par un maximum franc — <b>98 kPa vers 11 km, à T+32 s</b>, une tonne par mètre carré de maître-couple.</p>
      <p>Elle commande l'autorité de manœuvre par les deux bouts. Par le haut, le limiteur du calculateur bride l'incidence à 2° au-delà de 20 kPa et à 6° au-delà de 5 kPa : en demander plus casserait la structure. Par le bas, plus aucune gouverne ne mord, et c'est toute la difficulté d'un planeur : tenant son incidence de finesse maximale, il descend jusqu'à trouver la densité qui le porte et se stabilise vers 20 kPa. Son altitude est une conséquence, jamais un réglage.</p>
      <p>Le maximum de la montée n'est pas celui du vol. En revenant à 4,3 km/s, un corps de rentrée atteint <b>1,3 MPa vers 11 km</b> — treize fois plus, et 35 g de décélération avec.</p>`,
  },

  'hud.accel': {
    title: 'Accélération',
    caption: 'Le champ indique zéro pendant l\'essentiel du vol.',
    labels: {
      time: 'temps de vol', accel: 'force spécifique [g]',
      boost: 'extinction', reentry: 'rentrée',
      freefall: 'chute libre — les accéléromètres ne lisent rien',
      note: 'Un résidu de 0,15 m/s à l\'extinction devient 90 m sur le vol libre.',
      caption: 'Ce que lisent les accéléromètres, non l\'accélération.',
    },
    body: `<p>Module de la <em>force spécifique</em>, en g — ce que lisent les accéléromètres, c'est-à-dire tout sauf la gravité. D'où un champ qui affiche exactement zéro pendant 713 des 865 secondes du vol de référence, précisément quand le vecteur tombe vers la Terre à près de 9 m/s². Rien n'est en panne : un instrument en chute libre n'a rien à mesurer.</p>
      <p>Pendant la poussée, la valeur monte de 2,6 à 10,5 g. La poussée est constante — elle augmente même un peu avec l'altitude, la pression ambiante cessant de s'exercer sur la section de sortie de tuyère — pendant que la masse diminue avec les ergols brûlés. Le maximum tombe donc toujours à l'extinction, jamais au décollage.</p>
      <p>La longue plage silencieuse n'est pas pour autant inoffensive. Ce que la centrale y emporte — 0,15 m/s d'erreur de vitesse résiduelle à l'extinction sur le vol de référence — est intégré tout droit, sans correction, et devient une centaine de mètres d'erreur de position. Aucune lecture accélérométrique de ces douze minutes n'aurait pu le révéler.</p>`,
  },

  'hud.fpa': {
    title: 'Angle de pente',
    caption: 'Il passe par zéro une seule fois : à l\'apogée.',
    labels: {
      horizon: 'horizontale locale', up: 'verticale locale', velocity: 'vitesse',
      time: 'temps de vol', angle: 'pente',
      apogee: 'apogée : γ = 0', climb: 'montée', descent: 'descente',
      caption: 'Positif en montée, négatif en descente — rien d\'autre.',
    },
    body: `<p>Angle entre le vecteur vitesse et l'horizontale locale, <b>sin γ = r̂·v̂</b>. Positif en montée, négatif en descente, et nul à un seul instant — cet instant, c'est la définition de l'apogée.</p>
      <p>Au sol il affiche 0,0°, la seule vitesse présente étant l'entraînement terrestre, qui est horizontal. Il atteint ensuite 78° en fin de virage gravitationnel, est retombé à 37° à l'extinction, franchit zéro à T+452 s et arrive à −41° au sommet de l'atmosphère. Pour un tir d'énergie minimale, l'angle de départ suit une formule fermée, 45° − ψ/4 où ψ est l'arc au sol : 40,7° pour 1912 km, ce que les tests du code vérifient à 0,02° près.</p>
      <p>Chez un planeur, ce chiffre résume tout le vol. Après la ressource il oscille autour de −1° pendant 2350 km, à quelques degrés près de part et d'autre — la phugoïde, le vecteur rebondissant doucement sur l'atmosphère. Le petit terme d'amortissement retranché à l'incidence commandée n'existe que pour empêcher ces oscillations de croître.</p>`,
  },

  'hud.downrange': {
    title: 'Distance parcourue',
    caption: 'Mesurée au sol, pas le long de la trajectoire.',
    labels: {
      launch: 'départ', target: 'objectif', vehicle: 'apogée',
      downrange: 'parcourus', toGo: 'restants', straight: 'en ligne droite',
      sum: 'vrai tant qu\'il reste sur sa route',
    },
    body: `<p>Distance orthodromique du pas de tir au point du sol situé sous le vecteur, sur une sphère de rayon moyen 6371 km. Ni l'altitude ni le chemin réellement parcouru n'y entrent.</p>
      <p>L'écart n'est pas mince. À l'apogée du vol de référence, le bandeau annonce 892 km alors que le vecteur est à 1100 km du pas de tir en ligne droite — 23 % de plus — et qu'il en a parcouru davantage encore le long de son arc. C'est une comptabilité de la trace au sol, et rien de plus.</p>
      <p>Ce chiffre est calculé depuis la position <em>vraie</em> : il appartient à l'observateur, pas au vecteur. Le calculateur en a sa propre version, tirée de son estimation et fausse de l'erreur de navigation — et c'est celle-là, jamais celle-ci, qui décide de l'extinction.</p>`,
  },

  'hud.toGo': {
    title: 'Reste à parcourir',
    caption: 'La somme des deux arcs ne fait la portée que si le vecteur reste sur sa route.',
    labels: {
      launch: 'départ', target: 'objectif', vehicle: 'apogée',
      downrange: 'parcourus', toGo: 'restants', straight: 'en ligne droite',
      sum: 'vrai tant qu\'il reste sur sa route',
    },
    body: `<p>La même mesure orthodromique, prise cette fois du point situé sous le vecteur jusqu'à l'objectif. Sur le vol de référence, 892 km parcourus et 1021 km restants font exactement les 1912 km du tir : c'est à cela que ressemble un vecteur posé sur sa route directe.</p>
      <p>Tout écart latéral rompt la somme — deux côtés d'un triangle dépassent toujours le troisième —, et l'excédent sur la portée totale devient une lecture grossière mais honnête de la déviation latérale. Elle vaut la peine d'être surveillée pendant qu'un planeur brûle son excès d'énergie en virages en S.</p>
      <p>Le chiffre, seul, ne décide de rien : un vecteur balistique s'éteint sur la portée de son point d'impact <em>prédit</em>, non sur la distance restante. Chez un planeur, en revanche, c'est un seuil : sous 45 km le guidage passe en poursuite terminale et pointe le vecteur vitesse sur l'objectif ; sous 6 km il relâche la gîte, corriger latéralement coûtant alors plus de portée qu'il n'en rattrape.</p>`,
  },

  'hud.navError': {
    title: 'Erreur de navigation',
    caption: 'L\'écart est dessiné exagéré — quelques centaines de mètres sur 1900 km ne se voient pas.',
    labels: {
      truth: 'trajectoire vraie', estimate: 'ce que croit le calculateur',
      cutoff: 'extinction', atCutoff: 'les deux états diffèrent déjà',
      gap: 'écart = erreur de navigation',
      blindNote: 'le guidage ne lit que cette courbe',
      blindNote2: 'la vraie est inconnue du bord',
      caption: 'Rien à bord ne pourrait produire ce nombre.',
    },
    body: `<p>Distance entre l'endroit où le vecteur se trouve réellement et celui où son calculateur croit être. <b>Ce nombre n'existe pas à bord.</b> Il s'affiche parce que ceci est une simulation ; aucun instrument embarqué ne saurait le produire. La règle est tenue dans le code lui-même : on remet au calculateur l'estimation inertielle, jamais l'état vrai.</p>
      <p>Il en découle que l'écart à l'arrivée <em>est</em> cette erreur, pour l'essentiel. Chez un planeur, qui manœuvre jusqu'au dernier kilomètre, les deux nombres se confondent presque : 158 m d'erreur de navigation, 158 m d'écart, sur un vol recalé par le relief.</p>
      <p>Chez un balistique, c'est plus subtil, parce que tout est scellé à l'extinction. La centrale y était fausse de 4 m en position et de 0,15 m/s en vitesse. Or la portée répond à une erreur de vitesse à l'extinction comme <b>2R/v</b> — ici 960 m par m/s : ces 15 cm/s expliquent à eux seuls 144 m des 382 m d'écart. Les 142 m qu'affiche le bandeau à l'impact se sont accumulés après, pendant une descente où le vecteur ne pilote plus : c'est un chiffre de spectateur.</p>`,
  },

  'hud.navSigma': {
    title: 'Incertitude annoncée',
    caption: 'Ce que le filtre croit de lui-même — pas ce qu\'il est.',
    labels: {
      time: 'temps de vol', error: 'erreur de position', fix: 'visée',
      announced: 'incertitude annoncée', trueError: 'erreur vraie',
      note: 'Rien à bord ne peut comparer les deux courbes.',
      caption: 'Un filtre plus sûr de lui qu\'il ne le mérite est un vrai mode de défaillance.',
    },
    body: `<p>L'opinion que le filtre de Kalman a de sa propre erreur de position : la racine de la trace du bloc position de sa covariance. Rien ne la mesure, elle se déduit du modèle de bruit qu'on lui a donné avant le tir.</p>
      <p><b>La comparer à la ligne précédente est le geste central de ce simulateur.</b> Sur le vol de référence, le filtre annonce 102 m et se trompe de 142. Sur un tir de 6700 km, il annonce 304 m et se trompe de 601 — un facteur deux.</p>
      <p>Cet excès de confiance a des causes repérables. Le filtre est réglé sur la <em>spécification</em> de la centrale, jamais sur les biais réellement tirés pour ce vol ; les erreurs de facteur d'échelle ne figurent pas parmi ses quinze états, elles sont seulement provisionnées en bruit de processus ; le biais du baromètre n'est pas modélisé du tout — un décalage constant qui ressemble exactement à une vraie altitude. Quand l'erreur vraie dépasse trois fois le chiffre annoncé, le bilan de tir le dit en toutes lettres.</p>
      <p>L'inverse est un défaut aussi. Avec la corrélation de terrain, le filtre peut annoncer 216 m alors qu'il se trompe de 158. Un filtre pessimiste jette une précision qu'il possède déjà ; un filtre trop sûr resserre son test de cohérence et se met à refuser de bons recalages.</p>`,
  },

  'hud.attError': {
    title: 'Erreur d\'attitude',
    caption: 'Ce que coûte une erreur d\'attitude est proportionnel à ce que le vecteur subit.',
    labels: {
      trueAxis: 'axe vrai', believedAxis: 'axe cru',
      phase: 'phase', force: 'force spécifique', leak: 'dans le mauvais axe',
      phaseBoost: 'poussée', phaseCoast: 'chute libre', phaseReentry: 'rentrée',
      note: 'En chute libre, l\'erreur ne coûte rien — et continue de croître.',
      caption: 'Une visée stellaire mesure l\'attitude avant qu\'elle ne coûte cher.',
    },
    body: `<p>Angle entre l'attitude vraie et l'attitude crue, en minutes d'arc. Juste après le décollage, c'est simplement ce qu'a laissé l'alignement initial — environ 0,8′ pour une centrale de classe navigation — et les visées stellaires le ramènent au dixième.</p>
      <p>Son coût n'est pas constant : il est proportionnel à la force spécifique. Le filtre le dit littéralement, puisque le bloc qui couple l'attitude à la vitesse vaut −[f ×]. Orienter de travers de ψ une force mesurée f, c'est verser <b>f·sin ψ</b> dans le mauvais axe. Sous 4 g de poussée, une minute d'arc vaut 1,2 mg d'accélération fantôme — près de cinquante fois le biais propre de 25 µg de l'accéléromètre.</p>
      <p>D'où le régime que montre le schéma. En chute libre l'erreur ne coûte rigoureusement rien, f étant nul ; mais elle continue de croître sur le biais gyrométrique, et elle attend la prochaine fois que le vecteur subira quelque chose — une correction de mi-course, ou une rentrée à 35 g. C'est tout l'argument du viseur stellaire.</p>`,
  },

  'hud.starFixes': {
    title: 'Visées stellaires',
    caption: 'Une visée achète de l\'attitude, jamais une position.',
    labels: {
      time: 'temps de vol', altitude: 'altitude', minAlt: 'plancher de visibilité',
      occulted: 'en dessous, rien à voir', sighting: 'visée prise',
      tally: 'cumul des visées',
      caption: 'Au-dessus de l\'air dense, et seulement là.',
    },
    body: `<p>Nombre de visées prises depuis le décollage. Le viseur en tente une toutes les 20 s par défaut, et seulement au-dessus de 45 km, là où l'air est assez ténu pour distinguer une étoile en plein jour : 40 visées sur les 865 s du vol de référence, c'est-à-dire pratiquement tout le vol libre.</p>
      <p>Ce qu'elles achètent, c'est de l'attitude et rien d'autre. Aucune étoile ne dit au vecteur où il se trouve. Mais en maintenant ψ bas, elles suppriment le terme de l'erreur de position qui croît comme le <em>cube</em> du temps de vol — celui qui, sur un vol long, domine tout ce que font les accéléromètres.</p>
      <p>Lisez le compteur comme des tentatives, non comme des succès : il s'incrémente au moment où la mesure est produite, en amont du test de cohérence du filtre. Une visée peut être comptée ici et refusée ensuite. Le bilan de tir distingue les deux.</p>`,
  },

  'hud.terrainRugged': {
    title: 'Relief survolé',
    caption: 'Une plaine ne porte aucune information — et la mer moins encore.',
    labels: {
      offset: 'décalage essayé [m]', cost: 'coût de désaccord',
      mean: 'moyenne de la recherche', min: 'minimum vrai',
      wrongMin: 'un minimum — mais le mauvais',
      rugged: 'relief marqué', flat: 'plaine', rejectedOut: 'rejeté',
      contrast: 'Le contraste : de combien le meilleur décalage se détache des autres.',
      caption: 'La précision d\'un recalage est une propriété du sol, pas du matériel.',
    },
    body: `<p>Rugosité du sol sous la position vraie, de 0 à 100 %, lue directement dans le générateur de relief. Au-dessus de l'eau elle vaut exactement zéro, puisque l'altitude du sol y vaut zéro.</p>
      <p>C'est une condition, pas un confort. L'amplitude du relief suit 40 + 4000·r² mètres : 270 m à 24 %, 1040 m à 50 %, plus de 3 km à 90 %. En dessous, le minimum de la corrélation s'aplatit — tous les décalages candidats collent à peu près aussi bien, et rien ne désigne le bon.</p>
      <p>Le code en fait un nombre qu'il appelle contraste, et divise par lui la précision annoncée : une corrélation peu contrastée annonce une grande incertitude, et au-delà de 1500 m le recalage est jeté. Au-dessus d'une plaine ou de la mer, le module continue de tourner et ne rend rien — c'est le comportement honnête, une réponse assurée y serait pire que le silence.</p>`,
  },

  'hud.terrainFixes': {
    title: 'Recalages terrain',
    caption: 'Les refus sont le module qui travaille, non qui échoue.',
    labels: {
      measurement: 'corrélation', moduleGate: 'contrôle du module',
      filterGate: 'test du filtre', applied: 'recalage appliqué',
      rejected: 'seul le premier refus arrive au bandeau',
      expected: 'ce que le filtre attend', gateNote: 'seuil', outlier: 'aberrante',
      innovation: 'innovation : prédiction − mesure',
      caption: 'Un recalage produit n\'est pas encore un recalage appliqué.',
    },
    body: `<p>Recalages retenus sur corrélations tentées. Sur un plané au-dessus d'un relief varié : 81 sur 240.</p>
      <p>Chaque corrélation déduit sa propre précision de la netteté du minimum trouvé, corrigée du contraste du sol survolé. Si le résultat dépasse 1500 m, le recalage est jeté plutôt que remis au filtre. Deux tiers de refus n'est pas une panne : c'est le module qui refuse de répondre là où le sol n'a rien à dire.</p>
      <p>Un second filtre se tient en aval, que ce compteur ne montre pas : le test de cohérence du Kalman peut encore rejeter un recalage dont le corrélateur s'était satisfait. Ce qui est compté ici, c'est un recalage <em>produit</em> — pas nécessairement un recalage appliqué.</p>`,
  },
};
