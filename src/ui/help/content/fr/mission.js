// Fiches mission — français.
export default {
  'mission.launchSite': {
    title: 'Site de lancement',
    caption: 'L\'altitude saisie ne survit pas : c\'est le relief qui tranche.',
    labels: {
      entered: 'altitude saisie',
      snapped: 'relevée sur le relief',
      pad: 'pas de tir',
      ledger: 'Ce que le site fournit',
      position: 'Position',
      velocity: 'Vitesse',
      attitude: 'Attitude',
      posNote: 'levée —',
      velNote: 'exacte : Ω × r =',
      attNote: 'gyrocompassage',
      caption: 'Deux conditions sont données. La troisième est celle qui coûte des kilomètres.',
    },
    body: `<p>Le pas de tir est levé : latitude, longitude et altitude entrent dans le calculateur comme des nombres exacts. L'altitude que vous saisissez, elle, ne survit pas — elle est remplacée par celle que renvoie le champ de relief en ce point, de sorte que le pas de tir repose <em>sur</em> le sol au lieu d'être enterré dessous ou suspendu au-dessus. Deux sources indépendantes décrivaient le même endroit ; une seule est aussi le terrain que l'engin va survoler.</p>
      <p>À l'initialisation, la centrale est posée sur cette position avec 3 m de dispersion par axe — environ 5 m dans l'espace. <b>C'est la plus petite erreur de navigation que le vol connaîtra.</b> Tout ce qui suit est une estime à partir de ce seul point d'ancrage, et le bilan du schéma dit pourquoi l'une des trois conditions initiales n'est pas comme les autres :</p>
      <ul>
        <li><b>Position</b> — levée. Exacte à quelques mètres, gratuitement.</li>
        <li><b>Vitesse</b> — le pas de tir est immobile sur une Terre qui tourne : sa vitesse inertielle vaut Ω × r, soit 465 m/s vers l'est à l'équateur, multipliés par le cosinus de la latitude. Connue exactement, parce que la position l'est.</li>
        <li><b>Attitude</b> — non fournie. L'orientation du bloc d'instruments doit être découverte en observant la gravité et la rotation terrestre, et ce que ce gyrocompassage laisse derrière lui est l'erreur d'alignement.</li>
      </ul>
      <p>Choisir un site est donc déjà une décision de précision, avant même de parler d'instruments. Le site fixe la portée jusqu'à l'objectif, la portée fixe la durée de vol, et la durée de vol est le multiplicateur de tous les défauts de la centrale. La solution de tir étant calculée en repère inertiel, un tir vers l'est depuis une basse latitude part avec les quelques centaines de m/s que la Terre fournit déjà, et la vitesse d'extinction exigée baisse d'autant.</p>`,
  },

  'mission.target': {
    title: 'Objectif',
    caption: 'Un terme de la soustraction est exact. Tout l\'écart tient dans l\'autre.',
    labels: {
      truePos: 'Position vraie',
      believed: 'Position crue',
      targetBox: 'Coordonnées de l\'objectif',
      vGo: 'Vitesse à gagner',
      noLink: 'ni récepteur, ni autodirecteur, ni liaison',
      noLinkNote: 'rien à bord n\'observe le monde extérieur',
      believedNote: 'estimation inertielle — le seul terme incertain',
      targetNote: 'chargées avant le tir, exactes, constantes',
      vGoNote: 'piloté sur la différence',
      caption: 'Savoir exactement où est l\'objectif ne dit rien de l\'endroit où l\'on est.',
    },
    body: `<p>Deux nombres que vous déclarez, chargés avant le tir comme un vecteur fixe en repère terrestre. Ils sont exacts par construction : personne ne mesure une coordonnée d'objectif en vol. <b>Il n'y a à bord ni récepteur satellite, ni autodirecteur, ni liaison de données</b> — rien ne regarde jamais le sol pour confirmer quoi que ce soit.</p>
      <p>Ce que la boucle de guidage en fait est une soustraction. Elle cherche la vitesse qui la mènerait de là où elle <em>croit</em> être jusqu'à l'objectif, et pilote sur la différence. Un terme est exact et ne bouge jamais ; l'autre est l'estimation inertielle. Toute l'erreur du calcul se loge du second côté, et c'est précisément pourquoi une coordonnée d'objectif exacte ne vaut rien comme recalage de position. Savoir où est l'objectif ne renseigne en rien sur l'endroit où l'on se trouve.</p>
      <p>La conséquence est tout le propos du simulateur. À la dispersion de rentrée près, la distance mesurée à l'impact <b>est</b> l'erreur de navigation, lue directement en mètres. Poser l'objectif, c'est se donner une règle graduée, pas donner une information à l'engin.</p>
      <p>Une nuance mérite d'être connue : le point réellement visé n'est pas l'objectif. La solution képlérienne ignore le freinage atmosphérique, qui fait toujours tomber court ; le calculateur décale donc son point visé de ce que sa propre prédiction annonce comme manque, puis résout de nouveau. Cette correction est faite contre le modèle de vol embarqué — toujours pas contre une observation extérieure.</p>`,
  },

  'mission.loft': {
    title: 'Profil de trajectoire',
    caption: 'Mêmes deux points, même portée au sol, cinq vols différents.',
    labels: {
      axisAlt: 'altitude [km]',
      launch: 'départ',
      target: 'objectif',
      groundRange: 'portée au sol',
      apogee: 'apogée',
      flightTime: 'durée de vol',
      required: 'vitesse requise',
      minEnergy: 'énergie minimale',
      current: 'réglage courant',
    },
    body: `<p>Entre deux points, un arc balistique coûte moins de vitesse que tous les autres. Le solveur le trouve par section dorée sur le paramètre de l'orbite, et sa pente de départ suit la relation classique <b>φ = 45° − Ψ/4</b>, où Ψ est l'angle sous lequel les deux points sont vus du centre de la Terre. Près de 45° pour un saut de puce, 36,9° sur 3600 km, 18° sur 13000 km. C'est le profil à cloche nulle.</p>
      <p>Tirez le curseur et le même couple de points est résolu sur la branche haute : le code demande une apogée valant <b>(1 + 2,2·cloche)</b> fois celle d'énergie minimale, plus 60 km par unité de cloche, puis dichotomie jusqu'à l'obtenir. Sur 3600 km, l'apogée passe de 835 km à près de 3000 km et la vitesse requise de 5,44 à 6,69 km/s — la même portée pour 23 % de vitesse à gagner en plus, que le vecteur proche de sa limite n'a tout simplement pas.</p>
      <p>Ce que la cloche achète : une rentrée plus raide et plus rapide, et le moyen de dépenser l'énergie d'un vecteur de longue portée sur une courte distance au sol. Ce qu'elle coûte se mesure en mètres. La durée de vol passe de 1076 s à 2305 s, et un biais gyrométrique fait croître l'erreur de position comme <em>t³</em> : 2,14 au cube, soit près d'un facteur dix sur l'écart final. <b>La cloche se paie en précision</b>, dans la monnaie même que le simulateur mesure.</p>
      <p>Le planeur n'a pas ce réglage et le panneau le masque. Son profil n'est pas un arc képlérien mais une montée volontairement surbaissée suivie d'une ressource à 62 km, après quoi il vole au lieu de retomber.</p>`,
  },

  'mission.range': {
    title: 'Portée utile',
    caption: 'Une règle proportionnelle au Δv, calée sur le vecteur A, se trompe d\'un facteur 2,5.',
    labels: {
      bal2: 'Vecteur A', bal3: 'Vecteur B', glide: 'Vecteur C',
      axisDv: 'Δv idéal [km/s]',
      axisRange: 'portée mesurée [km]',
      rule: 'règle proportionnelle au Δv',
      glideNote: 'ne retombe pas — il plane',
      caption: 'Les pertes se soustraient à la vitesse, elles ne lui sont pas proportionnelles.',
    },
    body: `<p>Chaque vecteur porte un seul nombre, sa <em>portée utile</em> : 3600 km, 13000 km, 9500 km. Ces chiffres ont été obtenus en faisant voler la simulation et en relevant le point de chute — pas en évaluant une formule. Le bandeau de mission compare votre portée au sol à ces valeurs et alerte quand vous demandez davantage.</p>
      <p>Les déduire de l'équation de Tsiolkovski ne marche pas, et le schéma dit à quel point. Le vecteur A dispose de 7,21 km/s de Δv idéal et atteint 3600 km ; le vecteur B dispose de 10,45 km/s, soit 45 % de plus, et atteint 13000 km, soit 260 % de plus. Calez une règle proportionnelle sur A et elle place B à 5200 km.</p>
      <p>La raison est que les pertes se <b>soustraient au lieu de se multiplier</b>. Arracher le vecteur à la couche dense coûte un montant absolu de vitesse — de l'ordre de 1,8 km/s pour A et 2,9 km/s pour B ici — et ce qui parvient à la trajectoire, c'est le Δv moins ce montant. La portée croît alors de façon explosive avec le reste, parce que la portée balistique d'une vitesse donnée diverge à l'approche de la vitesse orbitale circulaire, 7,9 km/s. Un excédent modeste en haut de l'échelle achète une distance énorme.</p>
      <p>Le planeur casse la règle par l'autre bout : 2 % de Δv de plus que A, et 9500 km au lieu de 3600, parce qu'il ne retombe pas. Aucune relation écrite en Δv ne décrit les deux à la fois. Demandez plus que la valeur affichée et l'engin volera quand même, et tombera court — cela vaut d'être vu une fois, car le calculateur continue de piloter vers un objectif qu'il n'atteint plus.</p>`,
  },
};
