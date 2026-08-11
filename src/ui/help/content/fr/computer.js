// Fiches « calculateur de bord » — français.
export default {
  'sensor.computer': {
    title: 'Calculateur de bord',
    caption: 'Une seule flèche monte, et les capteurs l\'ont déjà abîmée.',
    labels: {
      onboard: 'à bord',
      world: 'monde physique',
      sensors: 'Capteurs',
      filter: 'Filtre de Kalman',
      estimate: 'État cru',
      guidance: 'Loi de guidage',
      truth: 'État vrai  r, v, q',
      actuators: 'Actionneurs',
      measured: 'mesures',
      noisy: 'biaisées, bruitées',
      orders: 'ordres',
      forces: 'poussée, portance, traînée',
      never: 'ce lien n\'existe pas',
      caption: 'La vérité ne franchit jamais la ligne.',
    },
    body: `<p>Le calculateur décide de trois choses : où pointer la poussée, quand éteindre, et — après séparation — quelle incidence et quelle gîte tenir. Son cycle de guidage ne reçoit qu'un seul argument sur le monde : <b>la centrale inertielle</b>. Il ne voit jamais l'état vrai. Ce n'est pas une simplification du simulateur, c'est un invariant du code : aucune fonction du module de guidage n'a accès au vecteur d'état physique.</p>
      <p>La chaîne est celle du schéma. Les capteurs relèvent le monde physique et livrent des mesures déjà gâtées par le biais et le bruit ; le filtre de Kalman en tire une estimation ; la loi de guidage résout à nouveau le problème balistique <em>depuis la position qu'elle croit occuper</em> et pousse selon la vitesse à gagner qui en résulte ; les ordres partent aux actionneurs, qui agissent sur le véhicule réel. La boucle est bien fermée — mais elle est fermée sur une croyance.</p>
      <p>L'extinction l'illustre bien. Attendre que la vitesse à gagner s'annule ne marche pas avec un moteur non modulable : le calculateur coupe donc sur une grandeur scalaire qui ne fait que croître tant que la poussée dure, la portée du point d'impact qu'il <em>prédit</em>, réévaluée quatre fois par seconde et recalculée à chaque cycle dès que la vitesse à gagner passe sous 400 m/s. La prédiction est excellente. Elle est simplement faite depuis le mauvais point de départ.</p>
      <p>D'où la lecture de l'écart final. Sur un tir de 1912 km le vecteur s'éteint à 3987 m/s, et <b>un mètre par seconde d'erreur de vitesse y vaut environ 870 m de portée</b> — le classique 2R/v. Le calculateur peut viser juste et poser la charge à des kilomètres, parce que la distance mesurée au sol est, pour l'essentiel, l'erreur de navigation qu'il n'a jamais soupçonnée.</p>`,
  },

  'computer.gravityModel': {
    title: 'Modèle de gravité embarqué',
    caption: 'Une erreur de modèle ne se cache dans aucune mesure — ni dans aucun état du filtre.',
    labels: {
      sphere: 'masse ponctuelle',
      real: 'Terre réelle, J2',
      gravityGap: 'écart de gravité, équateur / pôle',
      noSensor: 'rien ne la mesure',
      currentModel: 'modèle courant',
      modelJ2: 'avec aplatissement',
      modelPoint: 'masse ponctuelle',
      matches: 'le modèle du bord colle à la vérité',
      j2Curve: 'J2 ignoré',
      navCurve: 'biais accélérométrique, 25 µg',
      time: 'temps de vol',
      error: 'erreur de position',
      caption: 'Les deux courbes sont ½·b·t². Seul le nom de b change.',
    },
    body: `<p>La Terre n'est pas une sphère : elle est renflée de 21 km à l'équateur. Le terme principal de cet écart est l'harmonique zonal <b>J2 = 1,08·10⁻³</b>, et le simulateur porte deux gravités — la vraie, qui inclut toujours J2, et celle du bord, que ce sélecteur commute. Choisir <em>masse ponctuelle</em> ne rend pas le monde plus simple ; cela rend le calculateur faux sur un monde qui, lui, reste aplati.</p>
      <p>L'écart paraît négligeable. À la surface il vaut <b>+1,62·10⁻³</b> de g à l'équateur et <b>−3,27·10⁻³</b> au pôle — un millième. Mais traduit dans l'unité des accéléromètres, cela fait <b>1623 µg</b>, soixante-cinq fois le biais d'une centrale de classe navigation. Il est constant, il ne se moyenne jamais, et il s'intègre deux fois : ½·b·t² sur un vol d'un quart d'heure donne environ 6 km.</p>
      <p>Mesuré dans le simulateur, toutes erreurs de capteurs annulées pour ne laisser que la faute du modèle : un tir de 1912 km tombe à 0,24 km avec J2 et à <b>4,4 km avec la masse ponctuelle</b> ; un tir de 6748 km passe de 1,6 km à <b>14 km</b>.</p>
      <p>Ce qui en fait une bête différente d'une erreur de capteur, c'est qu'<b>elle n'apparaît dans aucune mesure</b>. Le viseur stellaire lit l'attitude, pas la gravité. Le baromètre ne travaille qu'en dessous de 32 km, tout à la fin du vol. Le filtre porte des états de biais pour les gyromètres et pour les accéléromètres, aucun pour la gravité — il ne peut donc même pas nommer le coupable. Il estimera fidèlement tout le reste pendant que la solution entière s'en va.</p>`,
  },

  'computer.midcourse': {
    title: 'Correction mi-course',
    caption: 'La poussée pose la trajectoire crue sur l\'objectif. La vraie garde son écart.',
    labels: {
      truth: 'trajectoire vraie',
      believed: 'trajectoire crue',
      target: 'objectif',
      windowLabel: 'fenêtre · γ < 1,15° · ≈ 14 s',
      fire: 'un seul tir, ≈ 8 s avant l\'apogée',
      altFloor: 'plancher d\'emploi',
      gap: 'erreur de navigation, inchangée',
      caption: 'Corriger une erreur qu\'on ne voit pas déplace le tireur, pas l\'erreur.',
    },
    body: `<p>Une petite réserve d'impulsion, tirée une seule fois pendant le vol libre. Le calculateur ouvre la fenêtre à deux conditions, exactement celles écrites dans le code : <b>altitude estimée supérieure à 120 km</b>, et vitesse radiale sous 2 % du module — soit une pente inférieure à 1,15°. Autrement dit, près de l'apogée. Sur un tir de 1912 km la poussée part à T+443 s, <b>8,5 s avant une apogée de 584 km</b> : le plancher d'altitude était franchi depuis des minutes, c'est donc l'angle qui choisit l'instant.</p>
      <p>Ce qui est calculé alors est une nouvelle solution d'interception depuis la position <em>estimée</em>, et l'impulsion est la différence entre la vitesse que cette solution exige et la vitesse courante, écrêtée à la réserve et appliquée à 4 m/s². La demande se compte en kilomètres par seconde : la réserve sature donc toujours, et part en une seule fois, dans cette direction.</p>
      <p>Et voici tout le propos de la fiche. <b>La correction ne traite que l'erreur que la centrale voit.</b> Si l'estimation a dérivé de deux kilomètres, le calculateur observe une trajectoire fautive de ce que sa propre dérive lui fait croire, et oriente l'impulsion en conséquence. L'impulsion s'applique aussi au véhicule réel — la trajectoire crue se pose donc proprement sur l'objectif tandis que la vraie conserve ses deux kilomètres, quand elle n'en gagne pas davantage. Une correction est un levier, et le levier prend appui sur l'estimation.</p>
      <p>C'est pourquoi la correction mi-course vaut surtout sur les vecteurs qui ont de quoi corriger <em>avec</em> : un viseur stellaire qui recale l'attitude avant l'apogée, une estimation saine au moment du tir. Sur une centrale qui a dérivé librement pendant sept minutes, elle ne fait guère que déplacer l'écart.</p>`,
  },

  'computer.midcourseBudget': {
    title: 'Réserve d\'impulsion',
    caption: 'Quelques m/s déplacent déjà l\'impact plus loin que l\'erreur de navigation ne le fera jamais.',
    labels: {
      reserve: 'réserve [m/s]',
      atApogee: 'à l\'apogée',
      reach: 'déplacement de l\'impact [km]',
      navError: 'une erreur de navigation courante : 2 km',
      perMs: 'un m/s, à l\'apogée / à l\'extinction',
      burn: 'dépensée en un seul tir, à 4 m/s²',
      caption: 'Ce n\'est pas la réserve qui vous limite. C\'est l\'estimation.',
    },
    body: `<p>Combien de mètres par seconde le bloc de correction a le droit de dépenser, de 5 à 400. Le chiffre ne devient lisible qu'une fois converti en distance au sol, et cette conversion se mesure plutôt qu'elle ne se devine : en propageant deux fois le même état de vol libre, un m/s ajouté dans l'axe à l'apogée déplace le point d'impact de <b>456 m</b>, et de 391 m s'il est appliqué en travers.</p>
      <p>Le même mètre par seconde vaut <b>868 m à l'extinction</b>, presque le double — il reste alors tout l'arc à parcourir, donc le levier est plus long. C'est la règle générale du guidage balistique, et la raison pour laquelle l'instant d'extinction se dispute à la milliseconde quand le tir mi-course peut se permettre quelques secondes de flou.</p>
      <p>Faites le calcul dans l'autre sens et le réglage perd beaucoup de son mordant. Une erreur de navigation de deux kilomètres serait annulée par <b>4,4 m/s</b> — sous le minimum que le curseur autorise. Les 60 m/s par défaut déplacent l'impact de 27 km, bien au-delà de ce que produira jamais une centrale de classe navigation sur ce vol. La réserve n'est pratiquement jamais la contrainte qui mord.</p>
      <p>Ce qui mord, c'est la justesse de l'estimation avec laquelle on vise. Augmenter la réserve achète du déplacement, pas de la vérité — et un déplacement appliqué dans une direction légèrement fausse n'est qu'une erreur plus grande, livrée plus vite.</p>`,
  },
};
