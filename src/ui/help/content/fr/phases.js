// Fiches phases — français.
export default {
  'flight.phases': {
    title: 'Phases de vol',
    caption: 'Après l\'extinction, la branche balistique ne commande plus rien ; le planeur pilote jusqu\'au sol.',
    labels: {
      legCmd: 'ordre commandé',
      legFree: 'la physique seule',
      legEst: 'seuil lu sur l\'estimation',

      pPrelaunch: 'Avant lancement',
      sPrelaunch: 'alignement',
      pVertical: 'Montée verticale',
      pKick: 'Basculement',
      pTurn: 'Virage gravitationnel',
      sTurnSkipped: 'fenêtre vide',
      pClosed: 'Boucle fermée',
      sToCutoff: '→ extinction',

      cutoffTitle: 'Extinction · séparation',
      cutoffRule: 'portée du point d\'impact prédit = portée de la cible',
      cutoffRuleGlide: 'arc balistique + plané = portée de la cible + 2,5 %',

      pCoast: 'Vol libre',
      sAbove: 'au-dessus de',
      pMid: 'Correction mi-course',
      sMid: 'en option · une impulsion',
      pReentry: 'Rentrée',
      sBelow: 'sous',

      laneBal: 'Corps de rentrée balistique',
      laneGlide: 'Planeur hypersonique',

      pFreeFall: 'Plus aucun ordre',
      sFreeFall: 'incidence 0 · gîte 0',
      sSealed: 'un recalage tardif ne change plus rien',

      pGlide: 'Vol plané hypersonique',
      sPullUp: 'ressource à',
      pTerminal: 'Phase terminale',
      sWithin: 'à moins de',

      pImpact: 'Impact',
      sImpactBal: 'l\'écart s\'est décidé à l\'extinction',
      sImpactGlide: 'l\'écart se décide à la dernière seconde',
    },
    body: `<p>Onze phases, mais la phase elle-même n'est jamais l'intéressant : ce qui compte, c'est ce qui bascule l'aiguillage. Trois de ces aiguillages sont de simples horloges, lues sur le temps de mission. Tous les autres sont des seuils, et <b>chaque seuil est lu sur l'état estimé</b> : l'engin déclare la rentrée quand il <em>croit</em> franchir 100 km, pas quand il les franchit. Le calculateur ne dispose d'aucune autre altitude.</p>
      <p>La première minute est le passage élégant. La montée verticale dégage la rampe — environ 800 m pour le vecteur à deux étages — sans le moindre effort latéral. Le basculement incline ensuite l'axe de poussée hors de la verticale et l'y maintient six secondes : <b>3,5°</b> pour le vecteur à deux étages, 3,0° pour celui à trois. C'est là tout l'effort de gouverne délibéré jusqu'à la reprise en boucle fermée, une minute plus tard. Ensuite, le calculateur pointe la poussée dans le lit du vecteur vitesse relatif — incidence nulle — et cesse de piloter. <b>C'est la gravité qui fait le reste</b> : elle couche le vecteur vitesse vers l'aval, la poussée le suit docilement, et la trajectoire s'incline d'elle-même sans qu'aucune force latérale ne s'exerce sur la structure pendant les secondes de plus forte pression dynamique. Quarante-huit secondes plus tard, le vecteur à deux étages passe 51 km à 2,3 km/s, déjà largement couché. Le planeur fait exception : son basculement court jusqu'à T+11 s alors que sa fenêtre de virage se ferme à T+10, si bien que le virage gravitationnel ne s'ouvre jamais et que son profil de montée surbaissée prend directement la main.</p>
      <p>Le guidage en boucle fermée résout alors le problème balistique complet depuis la position estimée, à chaque cycle, et pousse selon la <em>vitesse à gagner</em>. L'extinction, elle, ne se décide pas sur ce vecteur : avec un moteur non modulable, son module peut cesser de décroître avant d'atteindre zéro. Elle se décide sur une grandeur scalaire qui, elle, ne fait que croître : la portée du point d'impact prédit depuis l'état estimé, traînée de rentrée comprise. Quand elle rejoint la portée de la cible, on coupe. La précision de cet instant fait tout, car sur un arc balistique 1 m/s d'erreur à l'extinction coûte environ <b>2R/v</b> en portée — près de 1,9 km pour un tir de 5500 km, de sorte qu'un demi-mètre par seconde suffit à manquer d'un kilomètre. C'est pourquoi le code cesse de recalculer la solution toutes les demi-secondes et la recalcule à chaque pas dès que la vitesse à gagner passe sous 400 m/s. Le planeur est coupé sur le même critère, appliqué à une prédiction qui inclut la ressource et le plané, majorée d'une marge délibérée de 2,5 % : un excédent de portée se brûle en virages en S, un déficit ne se rattrape jamais.</p>
      <ul>
        <li><b>verticale → basculement</b>, <b>basculement → virage gravitationnel</b>, <b>virage → boucle fermée</b> : l'horloge seule, à T+8 s, +6 s et T+62 s pour le vecteur à deux étages.</li>
        <li><b>boucle fermée → extinction</b> : la portée du point d'impact prédit rejoint celle de la cible.</li>
        <li><b>vol libre → mi-course</b> : facultative, une seule fois, juste avant l'apogée — altitude estimée au-dessus de 120 km et pente estimée passant par zéro.</li>
        <li><b>vol libre → rentrée</b> : altitude estimée sous 100 km.</li>
        <li><b>rentrée → plané</b> : passage descendant des 62 km, planeur seulement.</li>
        <li><b>plané → terminale</b> : moins de 45 km restants, ou vitesse sous 900 m/s, là où le modèle aérodynamique hypersonique cesse d'être valable.</li>
      </ul>
      <p>La bifurcation qui suit la rentrée sépare les deux familles. Le corps de rentrée ne reçoit plus aucun ordre : incidence nulle, gîte nulle, le nez se met dans le lit du vent et seul le coefficient balistique compte encore. <b>Sa trajectoire a été scellée à l'extinction</b> — et c'est bien pour cela que le simulateur relève à part l'erreur de navigation à cet instant. Les visées stellaires du vol libre et les recalages altimétriques de la descente continuent d'améliorer ce que le calculateur <em>sait</em>, mais il n'existe plus aucun moyen d'agir dessus. Le planeur, lui, pilote jusqu'à la dernière seconde : la gîte dissipe l'énergie excédentaire et tient le cap, puis la poursuite prend le relais sous 45 km. Un recalage tardif rapporte donc encore de la précision — mais le plané allonge aussi le vol : une dizaine de minutes entre la ressource et l'impact, là où un corps de rentrée avale les derniers 100 km en quarante secondes, et la centrale dérive pendant tout ce temps. Les deux effets tirent en sens contraire, et savoir lequel l'emporte est exactement ce que deux tirs comparés vous montreront.</p>`,
  },
};
