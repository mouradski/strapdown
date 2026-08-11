// Fiches « télémétrie : capteurs » — français.
//
// Ce groupe décrit le flux de ce qui est MESURÉ. Règle commune : aucune de ces
// valeurs ne provient de la vérité terrain, et c'est précisément ce qui les
// rend intéressantes.
export default {
  'tlm.specificForce': {
    title: 'Force spécifique',
    caption: 'L\'écart vertical entre les deux courbes, c\'est la gravité — et elle n\'est jamais mesurée.',
    labels: {
      axis: 'force spécifique [g] — échelle brisée', pad: 'au sol', boost: 'montée',
      coast: 'vol libre', entry: 'rentrée',
      liftoff: 'au décollage :', entryPeak: 'des dizaines de g',
      gapNote: 'cet écart, c\'est la gravité',
      coastNote: 'mesuré : 0,00 g',
      measured: 'force spécifique, telle que mesurée',
      trueAccel: 'accélération vraie',
      caption: 'Le calculateur doit ajouter ce g manquant lui-même, à une position qu\'il ne fait que croire.',
    },
    body: `<p>La sortie brute des trois accéléromètres, dans le repère du corps, en g. Ce n'est pas une accélération : la <b>force spécifique</b> est tout ce que subit le véhicule <em>sauf</em> la gravité. Posée au pas de tir, la centrale indique un g vers le haut ; en chute libre elle indique exactement zéro.</p>
      <p>Suivez la ligne x, celle de l'axe longitudinal. Au décollage elle affiche la poussée divisée par la masse au décollage — 2,64 g pour le vecteur à deux étages, 1,78 g pour le planeur — puis elle monte à mesure que les réservoirs se vident, jusqu'à un peu moins de dix g avant l'extinction. Elle tombe alors à 0,00 et y reste pendant tout l'arc balistique, alors que le véhicule tombe à près d'un g. <em>Rien dans cette ligne ne dit que le véhicule bouge.</em> À la rentrée, la traînée la pousse au-delà de trente g.</p>
      <p>Les lignes y et z restent voisines de zéro sous poussée, celle-ci s'exerçant selon l'axe du corps. C'est là qu'apparaîtrait un à-coup de pilotage — et c'est là aussi que se cacherait une gravité mal décomposée, car aucun accéléromètre ne distingue une vraie force latérale d'une idée fausse de la verticale.</p>`,
  },

  'tlm.angularRate': {
    title: 'Vitesse de rotation',
    caption: 'Les deux lignes diffèrent de l\'erreur du gyromètre, et de rien d\'autre.',
    labels: {
      commanded: 'rotation commandée',
      measured: 'rotation mesurée',
      bias: 'biais — constant',
      scale: 'facteur d\'échelle — ∝ vitesse',
      noise: 'marche aléatoire — à chaque pas',
      note: 'Calculé avec les réglages courants de la centrale, au pas de 20 ms.',
      caption: 'Soustrayez une ligne de l\'autre : il ne reste que l\'erreur du capteur.',
    },
    body: `<p>Ce que les trois gyromètres rapportent autour des axes du corps, en degrés par seconde. Le calculateur l'intègre en attitude ; hormis le viseur stellaire, rien d'autre à bord n'a d'avis sur l'orientation.</p>
      <p>Cette ligne a une propriété rare. Celle qui lui fait face dans la colonne de droite — <em>rotation commandée</em> — est la vérité : le véhicule suit exactement sa consigne de rotation, si bien que la différence entre les deux lignes est l'erreur du gyromètre, et rien d'autre. Avec une centrale de classe navigation, elles coïncident jusqu'à la troisième décimale. Montez une centrale grand public et la ligne mesurée tremble de deux dixièmes de degré par seconde autour d'une consigne à 0,170 : c'est la marche aléatoire angulaire, échantillonnée toutes les 20 ms.</p>
      <p>Les vitesses elles-mêmes restent modestes. Le pilotage limite la commande à 0,12 rad/s — soit 6,9 °/s — tant que les étages sont accrochés, et à 0,25 rad/s une fois la charge libérée : d'où la pointe à −14 °/s juste après la séparation, quand le corps bascule vers son attitude de rentrée. Pour donner l'échelle, la Terre tourne à 15 °/h, c'est-à-dire 0,0042 °/s ; un biais de classe navigation, 0,01 °/h, en vaut le quinze-centième. Il faut savoir le résoudre pour trouver le nord avant le tir.</p>`,
  },

  'tlm.gyroBiasEst': {
    title: 'Biais gyrométrique estimé',
    caption: 'À gauche, rien ne l\'observe. À droite, chaque visée l\'observe.',
    labels: {
      accelPanel: 'biais accélérométrique [µg]',
      gyroPanel: 'biais gyrométrique [°/h]',
      truthLine: 'biais vrai tiré pour ce vol — inconnu du bord',
      startZero: "l'estimation du filtre, partie de zéro",
      scaleNote: 'surtout le facteur d\'échelle :',
      starNote: 'chaque visée mesure ψ = b·t, donc b',
      caption: 'Ces lignes sont un avis sur les capteurs, pas une lecture de capteur.',
    },
    body: `<p>Ce n'est pas un réglage : c'est l'opinion courante du filtre sur ses propres gyromètres, une valeur par axe, en degrés par heure. Elle vaut exactement 0,000 au départ. Le filtre connaît la <em>spécification</em> de sa centrale, jamais les trois constantes tirées pour ce vol-là ; il les porte comme des états dont l'incertitude initiale vaut cette spécification.</p>
      <p>Ce qui les rend apprenables, c'est le viseur stellaire. Un biais b fait basculer l'attitude calculée de ψ = b·t, et une visée mesure ψ contre le ciel ; deux visées mesurent donc b. Sur un vol de référence, l'estimation de l'axe x s'est fixée à 0,021 °/h contre une valeur vraie de 0,0204 — trois chiffres significatifs pour un état parti de zéro.</p>
      <p>Coupez le viseur : la ligne reste à 0,000 pendant tout le vol alors que les biais vrais tournent autour de 0,02 °/h. Non que les gyromètres soient devenus parfaits, mais parce que rien ne les a jamais contredits. Cette seule ligne suffit à justifier l'emport d'un viseur stellaire.</p>`,
  },

  'tlm.accelBiasEst': {
    title: 'Biais accélérométrique estimé',
    caption: 'À gauche, rien ne l\'observe. À droite, chaque visée l\'observe.',
    labels: {
      accelPanel: 'biais accélérométrique [µg]',
      gyroPanel: 'biais gyrométrique [°/h]',
      truthLine: 'biais vrai tiré pour ce vol — inconnu du bord',
      startZero: "l'estimation du filtre, partie de zéro",
      scaleNote: 'surtout le facteur d\'échelle :',
      starNote: 'chaque visée mesure ψ = b·t, donc b',
      caption: 'Ces lignes sont un avis sur les capteurs, pas une lecture de capteur.',
    },
    body: `<p>Le même principe, en micro-g, avec un résultat bien moins heureux. Comparez cette ligne au biais accélérométrique que vous avez réglé : elle en diffère presque toujours, et pour deux raisons distinctes.</p>
      <p>La première est l'observabilité. Pendant l'arc balistique, le viseur stellaire mesure l'attitude, et aucun terme du filtre ne relie une attitude à un biais accélérométrique ; au-dessus de 32 km, l'altimètre ne répond plus du tout. Sur le vol de référence, la ligne est restée à −1 µg pendant sept cents secondes alors que les biais vrais valaient 10, −31 et 5 µg. Elle n'a bougé qu'à la rentrée, quand la force spécifique est revenue et que le radioaltimètre s'est remis à parler — bien trop tard pour changer quoi que ce soit.</p>
      <p>La seconde est que cet état sert de fourre-tout. Les erreurs de facteur d'échelle ne font délibérément pas partie de l'état estimé — six états de plus pour un gain modeste — mais les ignorer rendrait le filtre trop confiant : on les provisionne donc comme un bruit de processus proportionnel à la sollicitation. Tout ce que le filtre parvient à absorber, il l'absorbe ici : à 30 ppm et 156 m/s² de force spécifique avant l'extinction, cela fait 480 µg à caser, vingt fois les 25 µg que vous avez réglés. Une ligne qui annonce deux ou trois fois le réglage n'est pas un défaut : c'est un état qui fait le travail d'un autre.</p>`,
  },

  'tlm.measuredAlt': {
    title: 'Altitude mesurée',
    caption: 'Deux voies, deux plafonds, et un long silence entre les deux.',
    labels: {
      radar: 'radioaltimètre — ± 8 m',
      baro: 'baromètre — ± 120 m',
      radarCeiling: 'plafond radar 15 km',
      baroCeiling: 'plafond barométrique 32 km',
      silent: 'au-dessus : plus personne ne répond',
      alt: 'altitude', sigma: '± annoncé',
      caption: 'Seul le baromètre porte un biais — l\'écart de l\'atmosphère réelle.',
    },
    body: `<p>La sortie brute de la voie qui a répondu, en mètres au-dessus du niveau de la mer. Sous 15 km, le radioaltimètre est prioritaire : il sonde directement, à ±8 m, sans aucun modèle d'atmosphère dans la boucle. Au-dessus, et jusqu'à 32 km, le baromètre prend le relais à ±120 m — et il porte en plus un biais tiré une fois pour le vol dans une dispersion de 60 m, qui représente l'écart entre l'atmosphère réelle et l'atmosphère standard qu'il inverse.</p>
      <p>Au-dessus de 32 km, aucune voie ne répond et le bloc se tait. Sur un arc balistique, c'est l'essentiel du vol : sur le tir de référence, la dernière mesure datait de 748 secondes à l'apogée. Ce silence n'est pas une panne, c'est l'état normal d'un altimètre dans l'espace.</p>
      <p>Le biais compte davantage que le bruit. Le bruit se moyenne sur les centaines de mesures d'un vol ; un décalage constant, jamais, et le filtre n'a aucun état pour le porter. Notez aussi ce que cette mesure n'est <em>pas</em> : une seule distance selon la verticale locale. Elle contraint l'altitude, et rien qu'elle — une dérive horizontale de dix kilomètres la traverserait sans laisser de trace.</p>`,
  },

  'tlm.uncertainty': {
    title: 'Incertitude',
    caption: 'Le ±σ du filtre — calculé sur sa covariance, jamais sur la vérité.',
    labels: {
      time: 'temps de vol', error: 'erreur de position',
      announced: '±σ annoncé, issu de la covariance',
      trueError: 'erreur vraie — n\'existe que dans le simulateur',
      fix: 'un recalage la rabat',
      note: 'Le calculateur ne peut pas comparer les deux courbes. Rien à bord ne le peut.',
      caption: 'Elle croît entre deux recalages, retombe à chacun — et se trompe parfois sur les deux.',
    },
    body: `<p>Le ± dont une mesure s'accompagne. Pour l'altimètre, c'est un réglage : 8 m au radioaltimètre, 120 m au baromètre. Pour la corrélation de terrain, ce n'est pas un réglage du tout — la valeur est recalculée à chaque recalage, à partir de la franchise du minimum de corrélation.</p>
      <p>Quelle que soit son origine, le filtre prend ce chiffre au mot. Il devient R dans la mise à jour, et R fixe le poids : une mesure déplace l'état proportionnellement à P/(P+R). Sous-estimez-le et le filtre avale une mauvaise mesure sans broncher ; surestimez-le et il ignore poliment une bonne. Le même chiffre entre dans le test de cohérence, dont la dispersion prédite vaut S = HPHᵀ + R — l'incertitude propre du filtre plus celle du capteur.</p>
      <p>Le schéma montre l'autre σ, celui que le filtre calcule sur lui-même et affiche comme incertitude de navigation : √trace P, rabattu à chaque recalage et croissant entre deux. Il se déduit sans jamais consulter la vérité, et les deux courbes ne peuvent pas être comparées à bord. Sur le vol plané de référence, le filtre annonçait ±108 m à l'impact et se trompait en fait de 165 m ; à un moment de la descente, il annonçait ±20 m en altitude alors qu'il était 127 m trop bas.</p>`,
  },

  'tlm.lastReading': {
    title: 'Dernière mesure',
    caption: 'Entre deux recalages, le calculateur ne navigue que sur sa propre intégration.',
    labels: {
      time: 'temps de vol', error: 'erreur de position',
      fix: 'recalage', between: 'entre deux recalages : intégration pure',
      caption: 'L\'âge d\'une mesure dit la quantité d\'estime que vous faites.',
    },
    body: `<p>Depuis combien de temps cet équipement s'est tu. Le baromètre est interrogé deux fois par seconde : le champ affiche donc normalement <em>à l'instant</em>, et la ligne se grise passé trois secondes.</p>
      <p>Ce qui rend ce champ intéressant, c'est qu'il indique en réalité une phase de vol. Au-dessus du plafond barométrique de 32 km, plus rien ne répond, et l'âge grimpe tant que le véhicule y reste — douze minutes sur le tir balistique de référence. Pendant tout ce temps, la position annoncée est de l'estime pure, et son erreur croît sans contrôle : en t² pour un biais accélérométrique, en t³ pour un biais gyrométrique.</p>
      <p>Une mesure qui vieillit n'est donc pas une avarie. C'est la définition même de la navigation inertielle, et ce champ vous dit exactement combien vous en faites à l'instant présent.</p>`,
  },

  'tlm.sightings': {
    title: 'Visées prises',
    caption: 'L\'horloge bat sans arrêt ; seule l\'altitude décide qu\'une visée ait lieu.',
    labels: {
      altitude: 'altitude — échelle comprimée', time: 'temps de vol',
      minAlt: 'plancher de visibilité', occulted: 'occulté — étoiles inexploitables',
      sighting: 'visée obtenue', tally: 'compte courant',
      caption: 'Même viseur, même intervalle : c\'est le profil de vol qui fait la récolte.',
    },
    body: `<p>Le nombre de recalages stellaires obtenus depuis le tir. Le viseur en tente un toutes les 20 secondes par défaut, mais seulement au-dessus de 45 km — plus bas, l'atmosphère dense rend les étoiles inexploitables.</p>
      <p>Le compte est donc fixé par le profil de vol, pas par l'équipement. Le tir balistique de référence passe la quasi-totalité de ses 865 secondes au-dessus du plancher et récolte 40 visées. Le planeur, qui monte à 154 km puis passe la seconde moitié de son vol sous 35 km, n'en obtient que 21 sur un vol pourtant plus long. Même viseur, même cadence, moitié moins de recalages — et c'est la seconde moitié du vol, celle qui décide du point d'impact, qui s'en trouve privée.</p>
      <p>Chaque visée vaut trois degrés de liberté d'attitude à 8 secondes d'arc, et c'est la seule mesure du bord qui touche ψ. D'où sa rentabilité, inégalée pour un vol sans satellite : elle tue la dérive d'attitude, et avec elle le terme en cube du temps dans l'erreur de position.</p>`,
  },

  'tlm.sightingAccuracy': {
    title: 'Précision de visée',
    caption: 'Une erreur d\'angle ne reste pas un angle : elle devient une accélération fantôme.',
    labels: {
      sigma: 'visée à 1σ', attitude: 'erreur d\'attitude ψ',
      leak: 'g·sin ψ fuit dans l\'horizontale',
      position: 'erreur de position après le vol libre',
      after: 'après 10 min',
      caption: 'Le viseur fixe le plancher de toute la solution de navigation.',
    },
    body: `<p>La précision à 1σ de la dernière visée, en secondes d'arc — la spécification du capteur, transmise telle quelle au filtre comme R. Huit secondes d'arc valent 39 microradians, soit à peu près l'angle sous lequel on voit une pièce d'un euro à 600 mètres.</p>
      <p>Ce résidu ne reste pas un angle. Dès que la verticale calculée est fausse de ψ, une composante g·sin ψ atterrit dans le canal horizontal comme une accélération qui n'a jamais eu lieu : 39 µrad valent 39 µg, et sur dix minutes de vol libre, ½·b·t² vous place 69 m à côté. C'est le plancher que le viseur impose à tout le reste.</p>
      <p>Cela explique aussi qu'à un moment, resserrer l'intervalle entre visées cesse de rapporter. Moyenner n visées divise le résidu par √n, mais laisse intactes la marche aléatoire des gyromètres et, surtout, les erreurs accélérométriques qu'aucune visée n'observe.</p>`,
  },

  'tlm.profileBuilt': {
    title: 'Profil accumulé',
    caption: 'Rangé en face de la position crue, sondé sous la position vraie.',
    labels: {
      profile: 'profil mesuré', samples: 'échantillons', step: 'espacement 120 m',
      span: '50 × 120 m = 6 km de route sol',
      caption: 'Le profil entier est décalé d\'exactement l\'erreur de navigation.',
    },
    body: `<p>Le nombre d'échantillons de sol présents dans la mémoire, sur les 50 que le corrélateur exige avant de tenter quoi que ce soit. Ils sont espacés en <em>distance</em> et non en temps — 120 m — pour que la longueur du profil, donc son pouvoir de localisation, ne dépende pas de la vitesse du véhicule. Cinquante points à 120 m, cela fait six kilomètres de route sol.</p>
      <p>Chaque échantillon est rangé en face de la position que le calculateur <b>croit</b> avoir occupée, alors que le radioaltimètre a sondé le sol sous la position qu'il occupait <b>réellement</b>. Le profil est donc décalé en bloc d'exactement l'erreur de navigation, et retrouver ce décalage est tout le principe de la méthode.</p>
      <p>Sur un vol balistique, la mémoire a tout juste le temps de se remplir : le véhicule n'entre dans la tranche sous 32 km que dans les dernières secondes, et le tir de référence a atteint 50 points quinze secondes avant l'impact — d'où un unique recalage. Un planeur la remplit tôt et la renouvelle sans cesse, ce qui est la vraie raison pour laquelle la corrélation de terrain va de pair avec un corps porteur.</p>`,
  },

  'tlm.fixesRejects': {
    title: 'Recalages / rejets',
    caption: 'Trois tamis en série — le bus n\'en compte que les deux premiers.',
    labels: {
      measurement: 'mesure',
      moduleGate: 'tamis du module',
      filterGate: 'tamis du filtre (χ²)',
      applied: 'appliquée',
      rejected: 'rejetée — jamais appliquée',
      expected: 'ce que le filtre s\'attend à voir',
      innovation: 'innovation z = prédiction − mesure',
      gateNote: '√30 ≈ 5,5 σ',
      outlier: 'écartée',
      caption: 'Le test juge la vraisemblance, pas la justesse — il ne sait pas les distinguer.',
    },
    body: `<p>Deux compteurs tenus par le module de corrélation lui-même. Une corrélation est rejetée quand la surface de coût n'a pas de vrai minimum — la courbure ressort négative — ou quand l'incertitude qu'il faudrait annoncer dépasse 1500 m. Dans les deux cas, cela signifie la même chose : le module n'a pas su dire où il était, et il le dit plutôt que de deviner.</p>
      <p>Un fort taux de rejet n'est pas un défaut. Un faux recalage ne se contente pas d'être inutile : il injecte une erreur de position de sa propre taille et la remet au filtre avec un petit σ, que le filtre croira. Refuser est le bon comportement. Au-dessus d'un relief mêlé, un vol plané de classe navigation retient environ deux tentatives sur trois — 99 recalages pour 53 rejets.</p>
      <p>Un troisième tamis se trouve en aval, et n'apparaît nulle part sur le bus. Avant d'appliquer quoi que ce soit, le filtre forme l'innovation normalisée d² = zᵀS⁻¹z et écarte la mesure si elle dépasse 30 — 40 pour une visée stellaire. Le seuil est large, √30 valant 5,5 σ, et pourtant il a joué 78 fois sur ce même vol, chaque fois sur une mesure d'altimètre. Dans les quarante dernières secondes, il a verrouillé une mesure radar juste à ±8 m près, alors que l'altitude du filtre était 127 m trop basse et son incertitude annoncée de ±20 m. Le test protège le filtre des mauvaises mesures ; rien ne le protège de lui-même.</p>`,
  },

  'tlm.contrast': {
    title: 'Contraste',
    caption: 'De combien le décalage gagnant se détache de tous les autres.',
    labels: {
      offset: 'décalage essayé [m]', cost: 'écart entre profil et carte',
      mean: 'moyenne sur la grille de recherche', min: 'minimum franc',
      wrongMin: 'un minimum, mais probablement le mauvais',
      rugged: 'relief marqué', flat: 'plaine',
      contrast: 'contraste = (moyenne − minimum) / moyenne',
      rejectedOut: 'recalage écarté',
      caption: 'Un minimum mou n\'est pas une position imprécise : c\'est une position tirée au hasard.',
    },
    body: `<p>Un nombre entre 0 et 1, recalculé à chaque corrélation : (moyenne − minimum) / moyenne sur la grille de recherche grossière. Il mesure de combien le décalage gagnant se détache de tous les autres candidats — autrement dit si le sol survolé possède une signature.</p>
      <p>C'est lui qui décide de la précision annoncée. La courbure du minimum fournit un σ de moindres carrés, mais une courbure ne veut dire quelque chose que si le minimum trouvé est <em>le bon</em>. Au-dessus d'une plaine, tous les décalages se valent, le gagnant l'emporte par accident, et sa courbure locale ne dit plus rien de l'erreur réelle. Le code divise donc σ par le contraste, avec un plancher à 0,08 qui plafonne la pénalité à ×12,5. Un relief marqué donne un contraste voisin de 0,78 et ±325 m ; un contraste de 0,09 pousse σ au-delà de la limite de 1500 m et le recalage part à la poubelle.</p>
      <p>Au-dessus de la mer, l'altitude du sol est identiquement nulle : tous les décalages obtiennent exactement le même score, le contraste s'effondre, et aucune longueur de profil n'y changera rien. C'est le champ qui vous dit si la corrélation de terrain peut fonctionner ici — avant que l'écart à l'impact ne vous le dise.</p>`,
  },

  'tlm.offsetFound': {
    title: 'Décalage trouvé',
    caption: 'L\'erreur de navigation, mesurée de l\'intérieur.',
    labels: {
      measured: 'profil mesuré', map: 'carte embarquée',
      offset: 'décalage qui les fait coïncider',
      believed: 'position crue', truth: 'position vraie',
      caption: 'Les deux profils sont d\'abord centrés : une erreur d\'altitude commune s\'annule.',
    },
    body: `<p>Le décalage est-ouest et nord-sud, en mètres, qui aligne au mieux le profil mesuré sur la carte embarquée. C'est l'erreur de navigation vue de l'intérieur — la seule grandeur du bord qui la <em>mesure</em> au lieu de l'estimer.</p>
      <p>Il s'exprime relativement à la position crue, ce qui le rend utilisable : ajouté à cette position, il devient un recalage horizontal, remis au filtre comme une mesure à deux composantes. Le filtre ne déplace pas simplement la position. Il répartit la correction entre position, vitesse, attitude et états de biais, dans les proportions que dicte sa covariance — c'est ainsi qu'un recalage de terrain finit par améliorer une estimation de biais gyrométrique.</p>
      <p>Les deux profils sont centrés avant comparaison : un décalage d'altitude commun s'annule donc. La corrélation de terrain rend une position horizontale et rien d'autre — une erreur barométrique constante laisse le résultat intact. Cette indépendance est exactement ce qu'on demande à un capteur dont le métier est de contredire la solution inertielle.</p>`,
  },
};
