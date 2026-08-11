// Fiches « corrélation de terrain » — français.
export default {
  'sensor.terrain': {
    title: 'Corrélation de terrain',
    caption: 'Le décalage qui fait coïncider les deux profils est l\'erreur de navigation elle-même.',
    labels: {
      truePos: 'position vraie',
      believedPos: 'position crue',
      radar: 'radioaltimètre',
      map: 'carte embarquée',
      filed: 'rangé là où il se croit',
      matched: 'glissé jusqu\'à coïncider',
      offset: 'décalage trouvé = erreur de navigation',
      ssd: 'Σ (écarts)²',
      minimum: 'minimum',
    },
    body: `<p>Le radioaltimètre relève la hauteur du sol sous le véhicule, un point tous les 120 m de route — espacés en <em>distance</em> et non en temps, de sorte que le profil ne rétrécit pas quand l'engin va plus vite. Cinquante points forment une bande de relief de 6 km. Le calculateur range chaque mesure en face de la position qu'il <em>croit</em> occuper, puis fait glisser la bande entière sur sa carte embarquée jusqu'à rendre minimale la somme des carrés des écarts. Le décalage qui réalise la coïncidence est exactement l'écart entre ce qu'il croit et ce qui est.</p>
      <p><b>C'est le seul capteur du bord qui rende une position.</b> Le viseur stellaire mesure une attitude, l'altimètre rend un seul nombre ; celui-ci rend un est et un nord. Un détail le rend robuste : les deux profils sont centrés sur leur moyenne avant comparaison, si bien qu'une erreur d'altitude constante — le calculateur qui se trompe sur sa propre hauteur — disparaît entièrement. Seul le décalage horizontal subsiste.</p>
      <p><b>La précision n'est pas un réglage.</b> L'incertitude annoncée avec chaque recalage se déduit de la courbure du minimum, puis se trouve gonflée selon la netteté avec laquelle le meilleur décalage se détache de tous les autres — le <em>contraste</em>. Sur un relief marqué le minimum est franc et le contraste approche 0,9. Sur une plaine tous les décalages se valent à peu près, le minimum s'aplatit, et le chiffre annoncé enfle jusqu'à ce que le recalage soit écarté. Au-dessus de la mer le profil est rigoureusement plat, la courbure est nulle, et le module ne répond rien.</p>
      <p>L'ordre de grandeur mérite d'être retenu : sur 6 km de plaine, le sol monte et descend d'environ <b>2 m d'écart-type</b> — moins que l'erreur de la carte embarquée. Il n'y a tout simplement rien à reconnaître.</p>`,
  },

  'terrain.mapError': {
    title: 'Fidélité de la carte embarquée',
    caption: 'Une erreur qui ne se moyenne pas impose un plancher que rien d\'autre ne franchit.',
    labels: {
      ground: 'sol réel',
      map: 'carte embarquée',
      wavelength: 'erreur de carte : une ondulation kilométrique',
      profile: 'profil :',
      variance: 'variance de mesure',
      mapShare: 'carte',
      radarShare: 'radar',
    },
    body: `<p>L'écart entre la carte stockée et le sol qu'elle prétend décrire. ± 12 m par défaut, réglable de 1 m à 200 m. Dans le simulateur, la carte est le relief vrai augmenté d'une ondulation de longueur d'onde kilométrique — l'erreur d'un vrai levé, <em>corrélée dans l'espace</em>, et non une poussière d'erreurs indépendantes.</p>
      <p>Cette distinction décide de tout. Le bruit blanc du radar se moyenne en 1/√n sur les points du profil ; l'erreur de carte, elle, est à peu près la même sous toute la bande, et survit donc intacte quelle que soit la longueur du profil. Les deux entrent dans l'incertitude annoncée par <b>σ² = radar² + carte²</b> — soit, aux valeurs par défaut, 6² + 12², c'est-à-dire 13,4 m, dont <b>la carte fournit à elle seule 80 % de la variance</b>. Diviser par deux l'erreur de carte rapporte bien davantage que diviser par deux le bruit du radar.</p>
      <p>C'est aussi pourquoi le module applique un facteur 1,4 supplémentaire à tout ce qu'il annonce. La courbure au sens des moindres carrés, dont sort l'incertitude, suppose des erreurs indépendantes ; une erreur de carte corrélée spatialement rompt cette hypothèse, et sans la correction le recalage arriverait plus flatteur qu'il n'est. Un filtre de Kalman à qui l'on ment sur la qualité d'une mesure la surpondère et se dégrade.</p>`,
  },

  'terrain.radarSigma': {
    title: 'Bruit du radioaltimètre',
    caption: 'Le même bruit n\'est rien sur un massif et tout sur une plaine.',
    labels: {
      rugged: 'relief accidenté',
      plain: 'plaine',
      reliefSd: 'relief sur 6 km :',
      ratio: 'rapport relief / bruit',
      noise: 'bruit du radar',
      caption: 'Même échelle verticale, même bruit — seul le relief change.',
    },
    body: `<p>Le bruit blanc ajouté à chaque mesure de hauteur, ± 6 m par défaut, réglable de 0,5 m à 60 m. Contrairement à l'erreur de carte, il est retiré à chaque point, et se moyenne donc le long du profil.</p>
      <p>Ce qui compte n'est pas sa valeur en mètres mais sa valeur <em>rapportée au relief</em>. Mesuré sur le terrain synthétique, le long d'un profil de 6 km : environ <b>± 24 m d'écart-type sur un massif, ± 2 m sur une plaine</b>. Au réglage par défaut, la signature du massif se tient quatre fois au-dessus du bruit tandis que celle de la plaine est enfouie dessous — et c'est ce seul rapport, non un réglage de précision, qui fait marcher le module ici et échouer là.</p>
      <p>L'échec n'est pas silencieux. Le bruit entre directement dans l'incertitude annoncée, si bien que dégrader l'altimètre gonfle tous les σ rendus par le module ; passé le plafond de 1500 m, le recalage est écarté. Portez le bruit à 30 m sur un vol qui fonctionnait à 6 m et le corrélateur continue de calculer et cesse de répondre — toutes les tentatives rejetées, le compteur de rejets qui monte et celui des recalages qui reste à zéro.</p>`,
  },

  'terrain.samples': {
    title: 'Longueur du profil',
    caption: 'Un profil court est ambigu : plusieurs endroits du relief lui ressemblent.',
    labels: {
      short: 'profil court :',
      long: 'votre réglage :',
      trueOffset: 'décalage vrai',
      offset: 'décalage essayé',
      ssd: 'Σ (écarts)²',
      count: 'minima marqués, court / vôtre :',
      caption: 'Allongez le profil et les faux minima remontent. Un seul subsiste.',
    },
    body: `<p>Le nombre de points conservés dans le profil glissant — 50 par défaut, espacés de 120 m, soit 6,0 km de route. Le curseur va de 10 à 120 points, c'est-à-dire de 1,2 km à 14,4 km.</p>
      <p><b>C'est là que loge l'ambiguïté.</b> Un kilomètre de relief ressemble à beaucoup d'autres kilomètres, et la corrélation présente alors plusieurs minima de profondeur comparable sans que rien ne désigne le bon. La figure les calcule : à huit points, trois minima candidats, et le plus creux n'est pas le décalage vrai ; passé la vingtaine, les faux sont remontés et un seul minimum demeure. Allonger le profil affine moins la réponse qu'il n'élimine les concurrents.</p>
      <p>Mesurée sur un vol de planeur, l'incertitude annoncée suit directement : <b>15 points → environ 475 m, 50 points → 250 m, 100 points → 125 m</b>. Le prix à payer est l'attente — rien n'est rendu tant que la mémoire n'est pas pleine, le premier recalage attend donc n × 120 m de route, et un long profil répond pour la moyenne des positions qu'il couvre plutôt que pour celle de l'instant. Une manœuvre pendant l'accumulation, en revanche, ne coûte rien : chaque point garde ses propres coordonnées et l'ensemble est translaté en bloc.</p>`,
  },

  'terrain.period': {
    title: 'Intervalle entre recalages',
    caption: 'Entre deux recalages, rien n\'empêche la dérive inertielle de reprendre.',
    labels: {
      time: 'temps',
      error: 'erreur de position',
      fix: 'recalage',
      period: 'intervalle',
      caption: 'Chaque recalage rabat la dérive ; entre eux, elle repart.',
    },
    body: `<p>Le temps que le module attend avant de tenter une nouvelle corrélation — 6 s par défaut, réglable de 1 s à 60 s. Entre deux recalages la dérive inertielle reprend : l'intervalle fixe donc la hauteur à laquelle elle est rabattue.</p>
      <p>Un recalage n'est pas gratuit. C'est une recherche en grille à deux passes : un balayage grossier sur ± 600 m à ± 2 km, puis un balayage fin au pas de 12 m, chaque décalage essayé relisant la carte sous les n points du profil — des milliers de lectures par recalage. L'étendue de la recherche est bornée par trois fois l'incertitude qu'annonce le filtre, ce qui rend les recalages suivants très rapides. Cela signifie aussi que le corrélateur ne cherche que là où le filtre se soupçonne déjà d'être : une erreur de navigation qui a dépassé ± 2 km ne peut plus être retrouvée, et la bande coïncidera <em>quelque part</em>, assortie d'un chiffre d'apparence honnête.</p>
      <p>Descendre l'intervalle sous le temps de renouvellement du profil rapporte moins qu'il n'y paraît. À 6 s et 2 km/s, l'engin parcourt 12 km, deux fois la longueur du profil : deux recalages consécutifs ne partagent aucune donnée. À 1 s, les cinq sixièmes du profil leur sont communs — et l'erreur de carte qui se trouve dessous l'est aussi. Le filtre prend chaque recalage pour une information nouvelle et s'assure sur des lectures répétées de la même erreur.</p>`,
  },

  'terrain.maxAlt': {
    title: 'Altitude maximale d\'emploi',
    caption: 'La tranche décide à elle seule quel vecteur peut employer le module.',
    labels: {
      ceiling: 'plafond',
      floor: 'plancher',
      glider: 'planeur',
      rv: 'corps de rentrée',
      inBand: 'dans la tranche :',
      toImpact: 'temps avant impact',
      altitude: 'altitude',
      caption: 'En abscisse, les secondes avant l\'impact. La tranche est toute l\'occasion.',
    },
    body: `<p>Le sommet de la tranche utile, 32 km par défaut, réglable de 3 km à 40 km ; le plancher est à 300 m. Hors de cette tranche rien n'est enregistré : aucun profil ne s'accumule et aucun recalage n'est tenté.</p>
      <p>Ce qui fixe le plafond dans la réalité, c'est le radioaltimètre : atteindre le sol depuis 32 km est déjà une prétention généreuse, et le module altimètre du simulateur, lui, arrête sa voie radar à 15 km. Le modèle ne dégrade pas la mesure avec l'altitude — aucune empreinte de faisceau ne vient lisser le profil — de sorte que relever le plafond ne fait qu'ouvrir la fenêtre plus tôt. C'est une affirmation sur le matériel que l'on suppose embarquer, pas de la précision gratuite.</p>
      <p><b>La tranche décide aussi du choix du vecteur.</b> Sur un vol complet, le planeur y passe quelque <b>380 s</b>, pour l'essentiel dans une descente finale très couchée où il manœuvre encore, et récolte deux cents recalages. Le vecteur balistique à deux étages traverse la même tranche en <b>18 s</b> à la descente, à plusieurs km/s, et en récolte deux — alors qu'il n'a plus aucune autorité de pilotage pour les exploiter. C'est le module qu'on active avec un planeur et qu'on laisse éteint avec un corps de rentrée.</p>`,
  },
};
