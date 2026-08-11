// Fiches « centrale inertielle » — français.
export default {
  'sensor.imu': {
    title: 'Centrale inertielle',
    caption: 'L\'estimation nourrit le modèle de gravité, qui nourrit l\'estimation.',
    labels: {
      accel: 'Accéléromètres + gyros',
      integrate: 'Intégration',
      position: 'Position crue',
      gravity: 'Modèle de gravité',
      loop: 'La boucle se referme sur elle-même',
      loopNote: 'une position fausse calcule une gravité fausse',
      caption: 'Rien ici n\'est mesuré contre le monde extérieur.',
    },
    body: `<p>Trois accéléromètres et trois gyromètres, boulonnés rigidement à la structure — sans cardans. Les gyros suivent les rotations du véhicule, les accéléromètres mesurent ce qu'il subit selon chaque axe du corps. De ces six nombres seuls, le calculateur reconstruit sa position.</p>
      <p><b>Un accéléromètre ne mesure pas l'accélération.</b> Il mesure la <em>force spécifique</em> — tout sauf la gravité. En chute libre il indique exactement zéro, et c'est pourquoi les accéléromètres d'une charge en vol libre se taisent. Le calculateur doit donc ajouter lui-même la gravité, calculée à partir de la position qu'il <em>croit</em> occuper.</p>
      <p>C'est le piège que montre le schéma. Une erreur de position produit une erreur de gravité, qui produit une erreur de vitesse, qui produit une erreur de position plus grande encore. La boucle s'alimente elle-même. Voilà pourquoi la dérive inertielle n'est pas un simple cumul de bruit mais un processus réellement instable — et pourquoi les recalages des autres capteurs comptent autant.</p>`,
  },

  'imu.grade': {
    title: 'Classe de centrale',
    caption: 'Quatre décades séparent un téléphone d\'un sous-marin.',
    labels: {
      consumer: 'Grand public', tactical: 'Tactique',
      navigation: 'Navigation', strategic: 'Stratégique',
      current: 'réglage courant :', axis: 'biais gyrométrique [°/h] — échelle logarithmique',
      caption: 'Chaque marche descendue coûte environ dix fois plus cher.',
    },
    body: `<p>Ce sont les catégories usuelles de la littérature ouverte en navigation. Ce ne sont pas des gammes commerciales : elles marquent de vraies ruptures technologiques.</p>
      <ul>
        <li><b>Grand public (MEMS)</b> — du silicium, quelques euros, la classe qui équipe un téléphone. Dérive de kilomètres en une minute.</li>
        <li><b>Tactique</b> — gyromètres à fibre optique. Suffisant pour un engin qui vole une minute sous la surveillance d'un autodirecteur.</li>
        <li><b>Navigation</b> — gyrolasers, le standard de l'aviation de ligne. Environ un mille nautique de dérive par heure.</li>
        <li><b>Stratégique</b> — gyromètres électrostatiques ou à résonateur hémisphérique, la classe d'un sous-marin ou d'un engin intercontinental. Extraordinairement coûteux.</li>
      </ul>
      <p>Bougez ensuite n'importe quel curseur et la classe bascule sur <em>personnalisée</em> : les préréglages ne sont que des points de départ.</p>`,
  },

  'imu.gyroBias': {
    title: 'Biais gyrométrique',
    caption: 'Les deux courbes sont calculées avec vos réglages courants.',
    labels: {
      time: 'temps de vol', error: 'erreur de position',
      accel: 'accéléromètre', gyro: 'gyromètre',
      crossover: 'croisement', at: 'à',
      caption: 'Passé le croisement, la dérive d\'attitude domine tout le reste.',
    },
    body: `<p>Une vitesse de rotation constante que le gyromètre annonce alors que le véhicule est parfaitement immobile. Exprimée en degrés par heure.</p>
      <p><b>C'est le paramètre le plus lourd de conséquence de tout le simulateur</b>, et le schéma dit pourquoi. Un biais gyro fait lentement basculer l'idée que le calculateur se fait de la verticale. Dès que celle-ci est fausse de ψ, le calculateur décompose mal la gravité, et une composante <em>g·sin ψ</em> fuit dans ce qu'il prend pour une vraie accélération. Comme ψ croît lui-même linéairement avec le temps, l'erreur de position qui en résulte croît comme le <b>cube</b> du temps de vol — contre le carré pour un biais accélérométrique.</p>
      <p>Conséquence pratique : sur un vol court l'accéléromètre domine, sur un vol long le gyromètre l'emporte toujours. C'est là tout l'argument du viseur stellaire — il mesure l'attitude, tue ψ, et avec lui le terme cubique.</p>`,
  },

  'imu.gyroARW': {
    title: 'Marche aléatoire angulaire',
    caption: 'Cinq tirages de la même centrale, le même vol.',
    labels: {
      time: 'temps de vol', error: 'erreur d\'attitude',
      caption: 'Le bruit ne biaise pas — il disperse. L\'écart croît en √t.',
    },
    body: `<p>Le bruit blanc du gyromètre, coté en degrés par racine d'heure. Contrairement au biais, il n'a aucune direction privilégiée : c'est le tremblement aléatoire de la mesure.</p>
      <p>Intégrer un bruit blanc donne une <b>marche aléatoire</b>. L'erreur ne croît pas proportionnellement au temps mais comme sa racine carrée, et — c'est décisif — <em>elle diffère à chaque tir</em>. Un biais est reproductible et pourrait en principe se calibrer ; une marche aléatoire, jamais.</p>
      <p>C'est la différence que rend visible le tir de dispersion : lancez 25 fois avec les mêmes réglages, et le nuage obtenu est pour l'essentiel la part aléatoire. Un nuage décalé par rapport à la croix révélerait au contraire une erreur systématique, que davantage de tirs ne corrigeraient jamais.</p>`,
  },

  'imu.accelBias': {
    title: 'Biais accélérométrique',
    caption: 'Les deux courbes sont calculées avec vos réglages courants.',
    labels: {
      time: 'temps de vol', error: 'erreur de position',
      accel: 'accéléromètre', gyro: 'gyromètre',
      crossover: 'croisement', at: 'à',
      caption: 'Avant le croisement, c\'est l\'accéléromètre qui vous limite.',
    },
    body: `<p>Un décalage constant que l'accéléromètre ajoute à toutes ses mesures, coté en micro-g — des millionièmes du poids à la surface. 25 µg, la valeur de classe navigation, vaut 0,00025 m/s².</p>
      <p>Intégrée deux fois, cette broutille devient une erreur de position de <b>½·b·t²</b>. Sur dix minutes de vol, 25 µg suffisent à vous placer 44 m à côté.</p>
      <p>Le biais croît comme le carré du temps, celui du gyro comme le cube : il existe donc toujours un croisement, marqué sur le schéma. Avant lui, améliorer les accéléromètres paie ; après lui, seuls les gyromètres comptent. Déplacer les curseurs déplace cet instant, et il vaut la peine de regarder où il tombe par rapport à votre durée de vol.</p>
      <p>Une subtilité sur laquelle bute le filtre : une erreur de <em>facteur d'échelle</em> — l'accéléromètre lisant 1,0003 fois la vérité — ressemble exactement à un biais tant que la poussée est constante. Le filtre de Kalman l'absorbe dans l'état de biais, ce qui explique qu'il annonce parfois un biais bien plus grand que celui que vous avez réglé.</p>`,
  },

  'imu.accelVRW': {
    title: 'Marche aléatoire de vitesse',
    caption: 'Cinq tirages de la même centrale, le même vol.',
    labels: {
      time: 'temps de vol', error: 'erreur de vitesse',
      caption: 'Le bruit ne biaise pas — il disperse. L\'écart croît en √t.',
    },
    body: `<p>Le bruit blanc de l'accéléromètre, coté en m/s par racine d'heure. Son intégrale est une marche aléatoire de vitesse.</p>
      <p>Il compte ici bien moins que le biais, et pour une raison structurelle : sur un vol de quelques minutes, √t reste petit là où t² ne l'est pas. Sur un véhicule volant des heures, le classement s'inverserait.</p>
      <p>Il fixe en revanche un plancher à ce que le filtre de Kalman peut atteindre. Aucun recalage, même parfait, ne rattrape une information que le bruit a déjà détruite — c'est pourquoi resserrer indéfiniment l'intervalle entre visées stellaires cesse à un moment de rien rapporter.</p>`,
  },

  'imu.alignment': {
    title: 'Erreur d\'alignement initial',
    caption: 'L\'angle est dessiné exagéré — des minutes d\'arc ne se voient pas.',
    labels: {
      trueVertical: 'verticale vraie',
      believedVertical: 'verticale crue',
      alignment: 'erreur d\'alignement',
      leak: 'fuite dans l\'horizontale',
      after: 'après 10 min',
      caption: 'Rien à bord ne distingue cette fuite d\'une vraie accélération.',
    },
    body: `<p>Avant le tir, la centrale doit apprendre où est le haut et où est le nord. Elle le fait en observant la gravité et la rotation de la Terre — c'est le gyrocompassage, qui prend des minutes et ne finit jamais parfaitement. Ce qui subsiste se cote en minutes d'arc.</p>
      <p>La conséquence est immédiate et définitive. Si le calculateur croit la verticale à ψ de là où elle est réellement, il décompose mal la gravité, et une composante <b>g·sin ψ</b> atterrit dans le canal horizontal comme une accélération fantôme. <b>Une demi-minute d'arc vaut déjà 143 µg</b> — plusieurs fois le biais propre d'un accéléromètre de classe navigation.</p>
      <p>Et rien à bord ne peut la détecter. Une vraie accélération et une gravité mal décomposée donnent la même lecture. Seule une observation extérieure — une étoile, le sol — lève l'ambiguïté, et c'est exactement ce que fait le viseur stellaire.</p>`,
  },
};
