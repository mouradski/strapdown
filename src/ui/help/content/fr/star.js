// Fiches « viseur stellaire » — français.
export default {
  'sensor.star': {
    title: 'Viseur stellaire',
    caption: 'La même étoile, vue de deux endroits distants de mille kilomètres.',
    labels: {
      star: 'une étoile — à l\'infini',
      parallel: 'visées parallèles',
      apart: '1000 km d\'écart',
      noPosition: 'aucune information de position',
      trueRay: 'où l\'étoile est vraiment',
      expectedRay: 'où le calculateur l\'attendait',
      attitudeOnly: 'l\'erreur d\'attitude, mesurée',
    },
    body: `<p>Toutes les vingt secondes par défaut, et seulement au-dessus de 45 km, le viseur regarde le ciel, reconnaît ce qu'il voit et remet au filtre une attitude — entachée d'un bruit de quelques secondes d'arc, tiré à neuf à chaque visée. Le filtre l'exploite par une mise à jour à trois lignes, qui touche les trois états d'attitude et rien d'autre.</p>
      <p><b>Il ne donne aucune position, et il ne le peut pas.</b> Les étoiles sont, pour cet usage, à l'infini : déplacez-vous de mille kilomètres et la plus proche d'entre elles se décale de cinq millionièmes de seconde d'arc — un million de fois moins que le bruit propre du capteur. Les deux lignes de visée du schéma sont parallèles, et un couple de parallèles ne dit rien de l'extrémité de la base où l'on se tient.</p>
      <p>Ce qu'il mesure, en revanche, c'est l'écart entre la direction où l'étoile se trouve et celle où le calculateur, se fiant à sa propre attitude, l'attendait. Cet écart <em>est</em> l'erreur d'attitude. Or c'est l'attitude qui gouverne le pire terme de la dérive : un basculement ψ fait mal décomposer la gravité, <em>g·sin ψ</em> fuit dans le canal horizontal, et comme ψ croît linéairement l'erreur de position croît en <b>t³</b>. Recaler l'attitude toutes les vingt secondes empêche ψ de croître : le terme cubique s'en va avec lui, et il ne reste que le t² de l'accéléromètre. Dix tirs identiques donnent environ 125 m d'erreur de navigation finale avec le viseur, contre environ 500 m sans.</p>
      <p>Une conséquence est moins évidente. La mesure ne touche que l'attitude, et pourtant la position s'améliore aussi. La covariance n'est pas diagonale : le filtre accumule depuis le départ la corrélation entre le basculement et l'erreur de position que ce basculement a produite, de sorte que le gain <em>K = P·Hᵀ·S⁻¹</em> répand une observation purement angulaire dans la position, la vitesse et le biais gyrométrique estimé. Voir ce biais estimé se poser après les premières visées, c'est le même mécanisme vu de l'autre côté.</p>`,
  },

  'star.sigma': {
    title: 'Précision de visée',
    caption: 'Trois erreurs angulaires sur la même échelle, toutes tirées de vos réglages.',
    labels: {
      alignment: 'alignement initial',
      sighting: 'une visée stellaire',
      drift: 'dérive gyro entre deux visées',
      verdictQuiet: 'La dérive reste sous le bruit — resserrer n\'apporte rien.',
      verdictLoud: 'La dérive dépasse le bruit — c\'est l\'intervalle qui limite.',
      axis: 'erreur angulaire, échelle log',
      conversion: '1″ = 4,85 µrad = 4,85 µg',
    },
    body: `<p>L'écart-type d'une visée isolée, en secondes d'arc, réglable de 0,5″ à 200″. Une seconde d'arc vaut 4,85 microradians — une pièce d'un euro vue de cinq kilomètres.</p>
      <p>Pour rendre le chiffre tangible, convertissez-le comme le véhicule le subit. Une erreur d'attitude ψ fait mal décomposer la gravité de g·sin ψ, ce qui, rapporté à g, vaut simplement ψ : <b>une seconde d'arc vaut 4,85 µg</b>. Les 8″ par défaut laissent donc 39 µg d'accélération fantôme — davantage que les 25 µg de biais de l'accéléromètre de classe navigation posé à côté. Maintenus dix minutes, ces 39 µg suffiraient à vous placer 68 m à côté.</p>
      <p>Sauf qu'ils ne sont pas maintenus, et c'est toute la différence. Le code tire une nouvelle gaussienne à trois axes à chaque visée : c'est un bruit, pas un biais. Quarante visées le divisent par √40, quand un biais accélérométrique, lui, ne se moyenne jamais. Un viseur médiocre employé souvent l'emporte sur un bon viseur employé rarement.</p>
      <p>Le schéma place σ entre les deux angles qu'il doit battre. Au-dessus, l'alignement initial en minutes d'arc avec lequel le vol a commencé — c'est ce que la première visée jette. En dessous, la dérive que le gyromètre accumule entre deux visées. Tant que cette troisième barre reste plus courte que σ, c'est le bruit de visée qui vous limite et la cadence n'y change rien.</p>`,
  },

  'star.period': {
    title: 'Intervalle entre visées',
    caption: 'Deux cadences, le même plancher.',
    labels: {
      time: 'temps',
      error: 'erreur',
      slow: 'intervalle long',
      fast: 'intervalle court',
      floor: 'plancher : le bruit du recalage',
      age: 'âge du dernier recalage',
      caption: 'Diviser l\'intervalle par deux divise la rampe — jamais le plancher.',
    },
    body: `<p>Le viseur refuse toute visée tant que l'intervalle n'est pas écoulé : 20 s par défaut, réglable de 2 s à 180 s. Entre deux visées l'attitude court en boucle ouverte et dérive à la vitesse propre du gyromètre.</p>
      <p>La conversion est d'une netteté inhabituelle : <b>un degré par heure vaut exactement une seconde d'arc par seconde</b>. Un gyromètre de classe navigation à 0,01 °/h bascule donc de 0,01″ par seconde — 0,2″ sur l'intervalle par défaut, quarante fois moins que les 8″ de bruit d'une visée isolée. L'intervalle auquel la dérive rejoindrait enfin le bruit vaut σ/b = 800 s, soit plus que la durée du vol. Passer de 20 s à 2 s, dix fois plus de visées, fait descendre l'erreur finale moyenne de 124 m à 110 m.</p>
      <p>Changez de classe de centrale et l'arithmétique s'inverse. Un gyromètre tactique à 1 °/h atteint 8″ en huit secondes : la cadence par défaut est déjà trop lente, et chaque seconde d'intervalle se paie. Une centrale grand public à 150 °/h y parvient en un vingtième de seconde — aucune cadence ne la sauve.</p>
      <p>L'allure générale est sur le schéma. L'erreur juste avant un recalage vaut à peu près √(σ² + (b·T)²) : diviser T par deux divise la rampe, mais ne touche jamais au plancher, et sous le point d'équilibre on ne fait plus que remesurer le même bruit. L'âge du dernier recalage, affiché en télémétrie, dit où l'on se trouve sur cette rampe.</p>`,
  },

  'star.minAlt': {
    title: 'Altitude minimale de visée',
    caption: 'Le seuil coupe l\'échelle des altitudes en deux, et décide qui vit au-dessus de la ligne.',
    labels: {
      threshold: 'seuil de visée :',
      ceiling: 'plafond baromètre et terrain :',
      murk: 'le ciel diffusé noie les étoiles',
      coast: 'vol libre balistique',
      glide: 'vol plané',
    },
    body: `<p>Sous cette altitude, le viseur ne rend rien du tout. La raison est photométrique et non mécanique : de jour, l'air diffuse la lumière solaire en un fond bien plus brillant que n'importe quelle étoile, et c'est de ce fond qu'il faut extraire l'astre. Les 45 km par défaut correspondent à une pression tombée à 149 Pa, 0,15 % de la valeur au niveau de la mer — 99,85 % de la masse de l'atmosphère est déjà sous vous. Le curseur va de 20 km à 120 km.</p>
      <p>Pour un tir balistique, le seuil coûte peu, mais pas rien. Sur la mission de 1900 km par défaut, le ciel s'ouvre à T+59 s et se referme à T+841 s, 23 s avant l'impact : 40 visées, et la plage aveugle du début couvre tout le premier étage et le basculement — la minute la plus manœuvrante du vol, exactement là où les erreurs de facteur d'échelle des gyromètres font le plus de dégâts.</p>
      <p>Pour le corps porteur, il décide de tout. Le ciel s'ouvre à T+92 s et se referme à T+587 s : les <b>370 secondes qui restent — tout le vol plané — se passent sans une seule visée</b>. L'erreur d'attitude qui subsiste à la dernière visée est celle que le véhicule emporte jusqu'au sol. Portez le seuil à 70 km et le planeur ne vise plus rien après la ressource.</p>
      <p>Un détail structurel mérite l'attention : le baromètre et la corrélation de terrain s'arrêtent tous deux à 32 km, le viseur ne commence qu'à 45 km. Entre les deux s'étend une tranche de 13 km où aucune source de recalage ne fonctionne — et tout véhicule qui descend la traverse.</p>`,
  },
};
