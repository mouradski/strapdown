// Fiches « altimètre » — français.
export default {
  'sensor.alt': {
    title: 'Altimètre',
    caption: 'Quel instrument répond, à quelle altitude — et quand.',
    labels: {
      whereTitle: 'Qui répond, selon l\'altitude',
      whenTitle: 'Quand il répond, sur la durée du vol',
      radar: 'radioaltimètre',
      baro: 'baromètre',
      silence: 'aucune mesure',
      noBias: 'sans biais',
      bias: 'biais',
      ballistic: 'balistique',
      glider: 'planeur',
      cutoff: 'extinction',
      silent: 'muet',
      lastSeconds: 'les 20 dernières secondes',
      steering: 'le planeur pilote encore dans la tranche',
      sealed: 'le balistique, lui, était scellé à l\'extinction',
    },
    body: `<p>Deux instruments derrière un seul interrupteur. Sous 15 km le radioaltimètre répond, entre 15 et 32 km le baromètre, au-dessus de 32 km plus rien du tout. Une mesure toutes les demi-secondes, chacune traitée comme un recalage scalaire dont le vecteur de sensibilité est la verticale locale.</p>
      <p><b>Un altimètre ne corrige qu'une dimension sur trois.</b> Sur un tir par défaut — centrale de classe navigation, viseur stellaire actif — le calculateur se croit à 140 m environ de sa position vraie à l'impact, dont moins de 10 m sur la verticale. L'altimètre a écrasé la verticale et laissé l'horizontale intacte, or c'est l'horizontale qui rate la cible.</p>
      <p>Il n'est pas pour autant passager. La verticale est le canal instable d'une centrale inertielle : une erreur d'altitude fait employer une gravité fausse, qui creuse l'erreur d'altitude, laquelle se multiplie par <em>e</em> toutes les 570 s environ. Tenir l'altitude resserre aussi la vitesse verticale et le biais accélérométrique, par les corrélations que le filtre entretient entre ses états.</p>
      <p>Le piège est dans la chronologie. Sur le vecteur balistique le baromètre se tait vers T+52 s, à 32 km, et ne reparle que 20 s avant l'impact — alors que l'extinction, l'instant qui scelle toute la trajectoire, tombe à T+113 s et 180 km, en plein silence. Le planeur est le cas inverse : il passe des minutes sous 32 km, en vol piloté, et l'altitude mesurée y alimente directement la loi de guidage.</p>`,
  },

  'alt.baroSigma': {
    title: 'Bruit barométrique',
    caption: 'Toutes les mesures d\'un vol, et leur moyenne courante.',
    labels: {
      axisErr: 'mesure − vérité [m]',
      axisN: 'mesures successives',
      truth: 'altitude vraie',
      radar: 'radioaltimètre',
      baro: 'baromètre',
      mean: 'moyenne courante',
      collapse: 'La moyenne décroît en σ/√n. Un biais, lui, ne bougerait pas.',
    },
    body: `<p>L'écart-type du bruit blanc ajouté à chaque mesure barométrique — 120 m par défaut, réglable de 5 à 800 m. Une mesure arrive toutes les demi-secondes tant que le véhicule reste dans la tranche barométrique.</p>
      <p>Un bruit se moyenne : n mesures le divisent par √n. Les vingt-huit relevés recueillis en traversant cette tranche à la montée ramènent déjà 120 m à 23 m — c'est l'enveloppe qui s'effondre sur le schéma. De tous les nombres de ce panneau, celui du bruit est le moins inquiétant.</p>
      <p>Ce que règle vraiment σ, ce n'est pas la justesse mais <b>le poids du vote</b>. Le filtre pèse la mesure contre sa propre incertitude, K = P/(P+σ²). En début de vol, le radioaltimètre venant de fixer l'altitude à quelques mètres près, P vaut environ 25 m² contre σ² = 14 400 m² : une mesure fausse de 120 m déplace alors l'estimation de vingt centimètres. Douze minutes de vol libre plus tard, l'incertitude verticale de la centrale a dépassé celle du baromètre, et la même mesure est suivie presque aveuglément.</p>
      <p>C'est pourquoi baisser σ n'est pas gratuit. Ce nombre est la seule chose qui dise au filtre jusqu'où faire confiance à l'instrument, et le biais du baromètre ne figure pas parmi les quinze états d'erreur. Annoncez 5 m sur un appareil décalé de 60 m, et le filtre suivra l'erreur de l'atmosphère avec une belle assurance.</p>`,
  },

  'alt.baroBias': {
    title: 'Biais du modèle d\'atmosphère',
    caption: 'Une pression, deux altitudes : celle du modèle et celle du jour.',
    labels: {
      axisP: 'pression — échelle logarithmique',
      axisH: 'altitude',
      measured: 'pression mesurée',
      bias: 'biais',
      standard: 'atmosphère standard',
      real: 'atmosphère du jour',
      setting: 'réglage',
      ofPressure: 'de pression vers 10 km',
      exaggerated: 'Écart dessiné exagéré — un pour cent ne se verrait pas.',
    },
    body: `<p>Dans le code ce n'est pas une valeur mais un <b>tirage</b> : un échantillon de loi normale à l'initialisation, tenu constant jusqu'à l'impact. Le réglage est l'écart-type de ce tirage, 60 m par défaut. Chaque vol reçoit son décalage propre ; un vol donné le garde du départ à l'arrivée.</p>
      <p>D'où vient-il : un baromètre mesure une pression et l'inverse par l'atmosphère standard US 1976 — le modèle même dont le simulateur se sert par ailleurs pour la traînée. L'air réel est plus chaud ou plus froid, le champ de pression du jour plus haut ou plus bas. Vers 10 km la hauteur d'échelle vaut environ 6,5 km, de sorte qu'<b>un pour cent d'erreur de pression fait 65 m d'altitude</b>. L'instrument n'est pas fautif ; c'est la conversion qui l'est.</p>
      <p>Là est toute la différence entre un biais et un bruit. Le bruit décroît en 1/√n ; un biais est identique sur les n mesures et ne se moyenne jamais. Pire : le vecteur d'erreur ne comporte aucun état de biais barométrique, le filtre ne provisionne donc que le bruit. Plus il mesure, plus il devient sûr d'une altitude fausse de la même quantité à chaque fois. Le test de cohérence ne l'arrête pas davantage : il ne rejette qu'au-delà de χ² = 30, soit 5,5 σ, c'est-à-dire 660 m quand σ vaut 120 m.</p>
      <p>Mesuré dans le simulateur : radioaltimètre coupé, réglage poussé à 400 m, un vol qui tire −1 079 m finit 967 m sous la vérité en altitude, son erreur horizontale inchangée. Et remarquez <em>quand</em> le biais entre : à l'extinction l'erreur verticale valait 2 m. Le baromètre ne gagne la discussion qu'une fois l'incertitude propre de la centrale devenue plus grande que son σ — soit bien après que la trajectoire a été scellée.</p>`,
  },

  'alt.radar': {
    title: 'Radioaltimètre',
    caption: 'La portée d\'un radioaltimètre est en réalité une durée.',
    labels: {
      band: 'tranche du radioaltimètre',
      ballistic: 'corps de rentrée',
      glider: 'planeur',
      vspeed: 'vitesse verticale',
      readings: 'mesures',
      noSteer: 'ne pilote plus',
      steering: 'pilote encore',
      cutoffAbove: 'extinction : 180 km, douze minutes plus tôt',
      off: 'radioaltimètre coupé — le baromètre répond alors jusqu\'au sol',
    },
    body: `<p>Sous 15 km, s'il est armé, le radioaltimètre passe devant le baromètre : σ de 8 m et — c'est l'essentiel — aucun biais. Il mesure une distance au lieu d'interpréter une pression : il n'y a donc pas de modèle d'atmosphère sur lequel se tromper. Tout ce qu'il rate, il le rate différemment à chaque fois, et cela se moyenne.</p>
      <p>La portée est la contrepartie, et elle se lit comme une durée : 15 km divisés par la vitesse verticale. Un corps de rentrée arrive à plus d'un kilomètre par seconde — une douzaine de secondes dans la tranche, deux douzaines de mesures, toutes postérieures à l'extinction, quand un corps balistique ne pilote plus. Un planeur traverse la même tranche à quelques centaines de mètres par seconde, y demeure près d'une minute, et vole encore.</p>
      <p>C'est pour cela que le bilan de tir affiche deux erreurs de navigation, l'une à l'extinction, l'autre à l'impact. Seule la première a décidé de quelque chose. La seconde se lit après que l'altimètre a passé les vingt dernières secondes à remettre en ordre une altitude qui ne commande plus rien — et quoi qu'il y fasse, l'écart au but ne bouge pas d'un mètre.</p>
      <p>Une simplification de modélisation à connaître : ici le radioaltimètre rend une altitude au-dessus de l'ellipsoïde et non une hauteur/sol, comme si l'altitude du relief survolé était parfaitement connue. Transformer une hauteur/sol en position, c'est justement le métier de la corrélation de terrain — et là, l'erreur de la carte se paie.</p>`,
  },

  'alt.radarSigma': {
    title: 'Bruit du radioaltimètre',
    caption: 'Toutes les mesures d\'un vol, et leur moyenne courante.',
    labels: {
      axisErr: 'mesure − vérité [m]',
      axisN: 'mesures successives',
      truth: 'altitude vraie',
      radar: 'radioaltimètre',
      baro: 'baromètre',
      mean: 'moyenne courante',
      collapse: 'La moyenne décroît en σ/√n. Un biais, lui, ne bougerait pas.',
    },
    body: `<p>L'écart-type d'une mesure du radioaltimètre, 8 m par défaut, réglable de 1 à 120 m. Cette voie ne porte aucun terme de biais — le code y écrit un zéro franc — si bien que toute son erreur est du bruit, c'est-à-dire l'erreur que la répétition des mesures fait céder.</p>
      <p>8 m contre les 120 m du baromètre, c'est un facteur quinze : le mince liseré vert contre le large nuage ambre du schéma. Tant que le radioaltimètre répond, le filtre a pratiquement cessé d'écouter le baromètre, puisque à incertitude donnée le poids d'une mesure va comme 1/σ² — et 120²/8² vaut 225.</p>
      <p>Mais un σ ne vaut que ce que le nombre de mesures en fait, et une descente balistique n'en offre qu'une vingtaine : 8/√24 fait 1,6 m, très en dessous de ce qui décide d'un écart. Resserrer ce curseur ne change presque rien sur un corps de rentrée — ce qui reste à l'impact est horizontal. Sur un planeur, qui vit dans la tranche, il achète une vraie tenue d'altitude.</p>
      <p>À ne pas confondre avec le réglage du même nom dans le panneau de corrélation de terrain : celui-là est le bruit du profil de sol que le corrélateur compare à sa carte. Même instrument, réglage séparé, et il agit sur la netteté du minimum de corrélation plutôt que sur l'altitude.</p>`,
  },
};
