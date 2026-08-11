// Fiches « télémétrie des instructions » — français.
export default {
  'tlm.thrustCmd': {
    title: 'Poussée commandée',
    caption: 'La seule décision de propulsion que prenne le guidage, c\'est l\'instant où il coupe.',
    labels: {
      time: 'temps de vol',
      thrust: 'poussée commandée',
      onOff: 'la manette n\'a que deux crans : allumé, ou éteint',
      propellant: 'ergols de l\'étage courant',
      stage: 'étage',
      cutoff: 'extinction commandée',
      unused: 'jamais brûlés',
      vacuum: 'dans le vide',
      caption: 'Aucun niveau intermédiaire n\'est accessible.',
    },
    body: `<p>Deux nombres : la poussée que le moteur délivre, et celle que l'étage peut délivrer. Ils diffèrent, mais rien de tout cela n'a été commandé — la position de manette vaut toujours 1 dans ce simulateur. L'ordre n'a que deux valeurs, <b>allumé</b> ou <b>éteint</b>, et le guidage n'envoie jamais rien entre les deux.</p>
      <p>La poussée bouge quand même, pour deux raisons qui appartiennent au matériel et non au calculateur. Elle monte pendant le premier étage parce que la pression ambiante cesse de s'exercer sur la section de sortie de tuyère — 640 kN au niveau de la mer, 700 kN dans le vide, quelque 9 % gagnés simplement en quittant l'atmosphère. Et elle chute brutalement à l'étagement, quand un premier étage de 700 kN laisse la place à un second de 190 kN.</p>
      <p>La conséquence traverse tout le groupe. Faute de pouvoir doser la poussée, le guidage ne peut pas ramener doucement à zéro la vitesse à gagner : il ne peut choisir que l'<em>instant</em> où il s'arrête. Tout l'ajustement de la portée tient dans cette unique décision, et c'est pourquoi le critère d'extinction est construit avec autant de soin.</p>`,
  },

  'tlm.propellant': {
    title: 'Ergols restants',
    caption: 'Couper avec les réservoirs encore pleins n\'est pas un raté : c\'est le principe.',
    labels: {
      time: 'temps de vol',
      thrust: 'poussée commandée',
      onOff: 'la manette n\'a que deux crans : allumé, ou éteint',
      propellant: 'ergols de l\'étage courant',
      stage: 'étage',
      cutoff: 'extinction commandée',
      unused: 'jamais brûlés',
      vacuum: 'dans le vide',
      caption: 'Ce qui reste en soute, c\'est la portée dont on n\'a pas eu besoin.',
    },
    body: `<p>La masse restant dans l'étage en cours de combustion — elle repart à plein à chaque séparation, d'où l'allure en dents de scie. Sur le tir de référence, le second étage est éteint avec <b>587 kg de ses 3900 kg encore à bord</b>, soit environ 15 % du réservoir.</p>
      <p>Ce reliquat n'est pas du gaspillage : c'est ce qui permet à un même vecteur de couvrir toutes les portées jusqu'à son maximum. Un engin qui brûle ses réservoirs jusqu'à la dernière goutte n'a qu'une seule portée. Un engin éteint sur un critère calculé en a un continuum, et les ergols qu'il n'utilise pas mesurent exactement la distance entre la cible et le bord de son domaine.</p>
      <p>Un détail vaut d'être connu, parce qu'il se paie ailleurs en précision : un moteur qui s'arrête au milieu d'un pas d'intégration fournit à l'accéléromètre une moyenne — une poussée qui n'a jamais existé à ce niveau. Le simulateur termine donc le pas exactement à l'épuisement. Sans cette précaution, il reste dans la centrale environ un demi-mètre par seconde de vitesse fictive, et elle se propage jusqu'à l'impact.</p>`,
  },

  'tlm.cutoff': {
    title: 'Extinction',
    caption: 'On coupe sur une grandeur scalaire qui ne fait que croître, jamais sur un vecteur.',
    labels: {
      time: 'temps de vol',
      targetRange: 'portée de la cible',
      cutoff: 'extinction',
      rise: 'repartirait à la hausse',
      rangeErr: 'portée prédite − portée cible',
      vGo: 'vitesse à gagner',
      cadence: 'reprédite toutes les 0,25 s',
      sensitivity: '1 m/s à l\'extinction vaut',
      caption: 'La portée prédite ne fait que croître tant que le moteur pousse.',
    },
    body: `<p>À chaque cycle, le calculateur intègre — depuis l'état qu'il <em>croit</em> occuper et avec le modèle de traînée qu'il embarque — le point où l'engin tomberait si le moteur s'arrêtait maintenant. Il compare cette portée à celle de la cible, et coupe quand l'écart franchit zéro. Entre deux prédictions complètes, une toutes les 0,25 s, il extrapole linéairement : c'est précisément le compte à rebours affiché <em>dans x s</em>.</p>
      <p>Le critère évident serait d'attendre que la vitesse à gagner s'annule. Il ne fonctionne pas avec un moteur non modulable : le véhicule atteint le <em>module</em> de vitesse requis avant d'avoir fini de s'orienter sur la <em>direction</em> requise, de sorte que cette grandeur peut passer par un minimum puis repartir à la hausse sans jamais franchir zéro. La portée prédite, elle, n'a pas ce défaut — tant que la poussée est là, elle ne fait que croître.</p>
      <p>Le dernier instant vaut très cher. Une trajectoire balistique répond à une erreur de vitesse à l'extinction par environ <b>960 m de portée par m/s</b> ; couper à la fin d'un pas d'intégration ordinaire, jusqu'à 0,7 m/s trop tard, coûterait déjà 700 m. Le simulateur raccourcit donc le pas pour tomber exactement sur le franchissement.</p>
      <p>Reste la réserve qui gouverne tout ce simulateur : la prédiction part de l'état <em>estimé</em>. L'erreur de portée que l'on annule est celle d'un vol imaginaire. Ce dont la navigation se trompe à l'extinction, la trajectoire réelle en hérite intégralement, et aucun affichage du bord ne le dira.</p>`,
  },

  'tlm.steeringMode': {
    title: 'Mode de pilotage',
    caption: 'Le mode nomme la voie de commande qui est lue — rien de plus.',
    labels: {
      boost: 'montée propulsée',
      midcourse: 'correction mi-course',
      ballistic: 'balistique',
      glide: 'vol plané',
      chanThrust: 'direction de poussée',
      chanZero: 'α = 0, μ = 0',
      chanAngles: 'incidence et gîte',
      thrustBuilder: 'attitude sur la poussée',
      thrustBuilderSub: 'roulis sur le plan de tir',
      windBuilder: 'attitude sur le vent',
      windBuilderSub: 'gîte, puis incidence',
      output: 'attitude commandée',
      outputSub: 'puis une rotation',
      noControl: 'En balistique les deux angles sont nuls : rien n\'est piloté du tout.',
      caption: 'Deux façons de construire une attitude, quatre étiquettes devant.',
    },
    body: `<p>Quatre étiquettes, mais deux machines seulement derrière. En <b>montée propulsée</b> et pendant une <b>correction mi-course</b>, le calculateur produit une direction de poussée, et l'attitude se construit autour d'elle — axe du corps selon la poussée, roulis référencé sur la normale au plan de tir plutôt que sur la verticale locale, qui serait dégénérée au décollage précisément quand la poussée <em>est</em> verticale.</p>
      <p>En <b>vol plané</b>, le calculateur produit deux angles, et l'attitude se construit dans le repère vent : on part du vecteur vitesse relative, on applique la gîte commandée, puis l'incidence commandée autour de l'axe de tangage déjà incliné. L'ordre compte — la gîte d'abord, l'incidence ensuite — parce que c'est la gîte qui décide dans quel plan l'incidence va agir.</p>
      <p>Le mode <b>balistique</b> est le plus intéressant, car ce n'est pas une loi de pilotage. L'incidence et la gîte sont mises à zéro et le corps de rentrée se met simplement dans le lit du vent ; sa trajectoire ne dépend alors plus que du coefficient balistique. Les affichages restent à 0,0° non parce qu'une boucle les y tient, mais parce que personne ne pilote. Pour un vecteur purement balistique, c'est l'essentiel de la mission : tout s'est joué à l'extinction.</p>`,
  },

  'tlm.rateCmd': {
    title: 'Rotation commandée',
    caption: 'Tourner le corps n\'est pas une manœuvre : cela décide seulement où pointera la force.',
    labels: {
      order: 'attitude commandée',
      error: 'écart d\'attitude ψ',
      rate: 'rotation commandée ω',
      body: 'le corps tourne',
      satBoost: 'sous poussée, au plus',
      satCoast: 'après séparation, au plus',
      ifForce: 'avec poussée, ou avec l\'air',
      ifNone: 'vide, moteur éteint',
      force: 'la force tourne avec le corps',
      forceSub: 'c\'est la seule façon de piloter',
      none: 'il ne se passe rien',
      noneSub: 'la trajectoire ne bouge pas',
      caption: 'La rotation oriente. Elle n\'accélère jamais.',
    },
    body: `<p>Trois vitesses de rotation, une par axe du corps, en degrés par seconde — ce que le pilote automatique demande aux actionneurs. La loi est délibérément simple : l'écart d'attitude devient une vitesse qui lui est proportionnelle, <b>ω = 1,4 · ψ</b>, puis saturée. Le plafond vaut 0,12 rad/s (6,9 °/s) tant que la pile pousse, 0,25 rad/s (14,3 °/s) une fois le corps de rentrée seul et léger. Tout écart d'attitude au-delà de 5° environ commande donc le régime maximal.</p>
      <p><b>Une rotation ne produit aucune accélération par elle-même.</b> Elle réoriente le corps, et c'est tout. Si le moteur pousse, le vecteur poussée suit ; s'il y a de la pression dynamique, la force aérodynamique suit. Dans le vide et moteur éteint, la même commande ne change strictement rien — ce qui explique que l'affichage montre des rotations pendant tout le vol libre sans que la trajectoire bouge d'un mètre.</p>
      <p>La saturation n'est pas non plus un détail. Dans les dernières secondes de poussée, le guidage décale latéralement son point visé, et la direction de la vitesse ne peut pas la rallier complètement à 6,9 °/s. Il reste environ <b>250 m d'écart latéral à l'impact</b> — un plancher fixé par la vitesse de rotation de l'engin, sans qu'aucun capteur intervienne dans l'affaire.</p>`,
  },

  'tlm.aoaCmd': {
    title: 'Incidence commandée',
    caption: 'L\'incidence fixe l\'intensité de la force — c\'est la gîte qui en oriente le plan.',
    labels: {
      velocity: 'vent relatif',
      bodyAxis: 'axe du corps',
      lift: 'portance',
      drag: 'traînée',
      perp: 'la portance est perpendiculaire au vent, pas au corps',
      aoaAxis: 'incidence',
      finesse: 'finesse',
      best: 'optimum',
      maxA: 'à la butée',
      drop: 'toute la plage ne vaut que',
      caption: 'Une courbe aussi plate ne peut pas servir de frein.',
    },
    body: `<p>L'angle entre l'axe du corps et le vent relatif — l'écoulement, pas la trace au sol. C'est lui qui fixe l'<em>intensité</em> de la force aérodynamique : avec le modèle newtonien modifié employé ici, CN = 2 sin²α contre un coefficient axial constant de 0,022. La portance sort perpendiculaire au vent, la traînée dans son axe, et ni l'une ni l'autre n'est alignée sur le corps.</p>
      <p>Regardez maintenant la platitude de la courbe. La finesse culmine à <b>2,22 vers 16°</b> et vaut encore <b>2,01 à la butée de 22°</b> — toute la plage d'incidence utilisable ne pèse que dix pour cent de finesse. Un planeur ne peut donc <em>pas</em> dissiper de l'énergie en jouant de l'incidence, et la boucle longitudinale n'essaie même pas : elle tient l'incidence de finesse maximale et laisse l'altitude se placer là où la densité de l'air la porte. C'est la gîte qui fait le travail énergétique.</p>
      <p>Pendant la phase propulsée l'affichage reste à zéro, mais une limite agit tout de même en silence : tant que la pression dynamique dépasse 20 kPa, la direction de poussée est contrainte à 2° du vent relatif, 6° au-dessus de 5 kPa, 20° au-dessus de 500 Pa. Dans la couche dense, c'est la structure qui décide de la brutalité admissible, pas le guidage.</p>
      <p>L'exception est celle des 45 derniers kilomètres. L'incidence y cesse d'être un réglage d'équilibre pour devenir un gain de poursuite — six fois l'erreur de pointage, saturée à 22° — afin que l'engin pilote jusqu'au bout au lieu de finir en piqué balistique sur l'approche, là où savoir précisément où il se trouve ne changerait plus rien.</p>`,
  },

  'tlm.bankCmd': {
    title: 'Gîte commandée',
    caption: 'Le seul vrai frein dont dispose un corps porteur.',
    labels: {
      lift: 'portance L',
      vertical: 'L · cos μ',
      horizontal: 'L · sin μ',
      weight: 'poids',
      sTurn: 'virages en S : brûler sans dériver du cap',
      bankAxis: 'gîte',
      rangeAxis: 'portée du plané',
      aoaOnly: 'tout ce que peut l\'incidence =',
      maxBank: 'butée à',
      caption: 'La portée suit cos μ, et cos μ descend vite.',
    },
    body: `<p>Rotation autour du vecteur vitesse. Elle ne change rien à la quantité de portance produite — c'est l'affaire de l'incidence — et tout au plan dans lequel celle-ci agit. Inclinez de μ et il ne reste que <b>L · cos μ</b> dirigé vers le haut : il faut donc produire L / cos μ pour tenir, et la traînée augmente dans le même rapport. La finesse effective devient <b>E · cos μ</b>, et la portée du vol plané d'équilibre lui est proportionnelle.</p>
      <p>C'est là que loge la gestion d'énergie. À la butée de 55°, la finesse tombe de 2,22 à 1,27 et la portée disponible entre 6000 et 900 m/s passe d'environ 5970 km à 3420 km. Dit dans l'autre sens, voici le chiffre à retenir : <b>tout ce que l'incidence peut concéder vaut 25° de gîte</b> — et la gîte va jusqu'à 55°.</p>
      <p>Comme un virage change aussi le cap, l'excès de portée se brûle en <em>alternant</em> la gîte : c'est le classique virage en S. Le signe suit l'écart de cap à travers une hystérésis volontairement large, 5° quand il y a vraiment de l'énergie à dissiper et 0,4° sinon. Un seuil étroit serait pire qu'inutile : avec une vitesse de roulis finie, le véhicule passerait son temps à traverser l'assiette à plat sans jamais tenir d'inclinaison, et ne dissiperait rien. Sur un plané de référence, la boucle se stabilise entre ±19 et ±22°.</p>
      <p>En phase terminale, le sens change encore. La gîte n'est plus une commande d'énergie mais de pointage, et elle affiche couramment près de 180°. Voler sur le dos, c'est ainsi qu'un corps porteur se pousse <em>vers le bas</em>, et l'objectif est alors nettement sous le vecteur vitesse.</p>`,
  },

  'tlm.velocityToGain': {
    title: 'Vitesse à gagner',
    caption: 'Un triangle résolu en un point que le véhicule n\'occupe peut-être pas.',
    labels: {
      vEst: 'vitesse actuelle (crue)',
      vReq: 'vitesse requise',
      vGo: 'vitesse à gagner',
      shrinks: 'se referme en poussant',
      posEst: 'position crue',
      posTrue: 'position vraie',
      trueReq: 'ce que la vérité exigerait',
      formula: 'v_à_gagner = v_requise − v_crue',
      caption: 'Le calculateur ferme parfaitement son triangle, et se trompe quand même.',
    },
    body: `<p>La différence entre la vitesse que le véhicule devrait avoir et celle qu'il croit avoir. La vitesse requise est la solution d'un problème aux deux extrémités — partir d'ici, arriver au point visé — recalculée toutes les demi-secondes, puis à chaque cycle dès que l'extinction approche. La poussée est dirigée selon cette différence, si bien qu'au fil de la combustion la vitesse actuelle bascule vers la vitesse requise et l'écart se referme : 2849 m/s à l'entrée en boucle fermée vers T+63 s, 4 m/s à l'extinction sur le tir de référence.</p>
      <p>Elle frôle donc zéro, mais rien ne le garantit, et le guidage ne s'appuie pas dessus : un moteur non modulable dépasse en module tout en tournant encore, de sorte que le critère réellement employé est la portée prédite.</p>
      <p>Le schéma montre ce que le nombre ne dit pas. Le triangle est tracé depuis la position <em>crue</em>. Déplacez l'origine de l'erreur de navigation et la vitesse requise devient un autre vecteur — celui que la vérité aurait demandé. Le calculateur annule au mètre par seconde près le triangle qu'il voit, et livre l'engin en un point décalé d'exactement l'erreur qu'il n'a jamais connue.</p>`,
  },

  'tlm.rangeError': {
    title: 'Erreur de portée',
    caption: 'Près de l\'extinction, un mètre par seconde et un kilomètre sont la même grandeur.',
    labels: {
      burnout: 'extinction',
      target: 'cible',
      dvShift: '+1 m/s à l\'extinction',
      navShift: '2 km d\'erreur inertielle',
      zoom: 'impact, agrandi',
      invisible: 'Le guidage annule sa propre erreur. Celle de la navigation, il ne la voit pas.',
      caption: 'À l\'échelle de l\'arc, un kilomètre fait un cinquième de pixel.',
    },
    body: `<p>La portée du point d'impact prédit moins celle de la cible, en kilomètres. Négative, elle signifie que l'on tombe court. C'est la grandeur que surveille le critère d'extinction, et elle n'apparaît en télémétrie que dans la dernière partie de la poussée : la prédiction est la partie coûteuse du cycle de guidage, on la saute donc entièrement tant que la vitesse à gagner dépasse 1400 m/s, et on la mène grossièrement tant que l'écart dépasse 40 km.</p>
      <p>Sa sensibilité est le nombre qui gouverne la précision balistique. Près de l'extinction, erreur de portée et erreur de vitesse sont la même chose à un facteur <b>2R/v</b> près : sur le tir de référence, 2 × 1912 km / 3987 m/s, soit environ <b>960 m de portée par m/s de vitesse</b>. C'est pourquoi la boucle fermée refuse de réutiliser une solution vieille d'une demi-seconde à l'approche de l'extinction, et pourquoi le pas d'intégration est raccourci pour tomber exactement sur le franchissement.</p>
      <p>Et là encore, la lecture est honnête à propos du vol qu'elle imagine, non de celui qui a lieu. La prédiction part de l'état estimé : une erreur de navigation à l'extinction déplace toute la trajectoire sans faire bouger ce nombre d'un pouce. Deux kilomètres de dérive, et l'erreur de portée affiche toujours zéro.</p>`,
  },

  'tlm.aimOffset': {
    title: 'Décalage de visée',
    caption: 'Viser à côté de la cible, volontairement, pour deux raisons sans rapport.',
    labels: {
      route: 'plan de tir, grand cercle',
      target: 'cible',
      predicted: 'impact prédit',
      shortfall: 'manque mesuré',
      aim: 'point visé',
      downrange: 'en portée',
      crossTrack: 'latéral',
      why: 'La solution képlérienne ignore la traînée de rentrée : elle tombe toujours court.',
      gain: '60 % de l\'écart mesuré par passe — neuf passes ici, environ 2 km au total',
      caption: 'Ce que l\'on corrige, c\'est l\'angle mort du modèle, pas celui de la navigation.',
    },
    body: `<p>De combien le point visé s'écarte de la cible, en mètres vers le Nord et vers l'Est. Ce n'est pas un défaut : le calculateur résout délibérément pour un point qui n'est pas la cible, et pour deux raisons indépendantes.</p>
      <ul>
        <li><b>En portée.</b> La solution képlérienne ignore la traînée de rentrée, qui raccourcit toujours le vol. Le calculateur simule donc la descente avec son propre modèle de traînée, mesure de combien il tombe court, et décale la visée au-delà de la cible d'autant — en n'appliquant que 60 % par passe, car le point d'où il prédit se déplace pendant que l'engin vole, et tout appliquer d'un coup fait osciller la visée au lieu de la faire converger.</li>
        <li><b>Latéralement.</b> Le critère d'extinction est scalaire : il ne regarde que la portée. Rien ne garantit qu'à l'instant où la portée est juste, l'écart latéral le soit aussi — la poussée s'arrête avec le résidu qu'elle avait, ce qui laissait un biais déterministe d'un demi-kilomètre. On mesure donc la déviation de l'impact prédit par rapport au plan de tir et on la reporte sur la visée, perpendiculairement, là encore avec un gain de 0,6.</li>
      </ul>
      <p>La correction latérale n'entre en jeu qu'une fois la prédiction proche en portée — à 5 % de la portée de la cible, plafonnés à 80 km. Avant cela, la déviation latérale d'une prédiction qui tombe des centaines de kilomètres trop court ne veut rien dire, et la corriger ferait errer la visée. Sur le tir de référence, le décalage se stabilise autour de 2 km, l'essentiel en portée.</p>
      <p>Il en subsiste environ 250 m. Dans les dernières secondes de poussée, la vitesse de rotation limitée empêche la direction de la vitesse de rallier complètement la visée qui vient de bouger. Ce résidu est le plancher propre du guidage : il est là avec des capteurs parfaits, et aucune centrale meilleure ne l'effacera. Un planeur, lui, ne porte aucun décalage — il corrige en manœuvrant, et l'affichage reste à zéro.</p>`,
  },

  'tlm.aim': {
    title: 'Visée',
    caption: 'Une boucle dont la sortie déplace sa propre cible ne converge pas. On la coupe.',
    labels: {
      refine: 'la visée est corrigée',
      required: 'la vitesse requise bouge',
      vGoNode: 'la vitesse à gagner bouge',
      steer: 'le guidage lui court après',
      freeze: 'gelée sous 50 m/s',
      cadence: 'toutes les 8 s, puis toutes les 2 s',
      equivalence: 'un pas de visée est un pas de vitesse requise',
      caption: 'Geler n\'est pas renoncer : c\'est ce qui fait converger la fin de poussée.',
    },
    body: `<p>Deux états, <em>ajustable</em> et <em>gelée</em>. Tant qu'elle est ajustable, la visée est corrigée toutes les 8 secondes, puis toutes les 2 secondes dès que la vitesse à gagner passe sous 600 m/s — la prédiction se fait alors depuis un point de plus en plus proche de l'extinction réelle, et il vaut la peine de la répéter plus souvent. Sous 50 m/s, la visée est gelée et ne bouge plus.</p>
      <p>La raison est la boucle dessinée ici. Chaque correction déplace le point visé de quelques kilomètres ; par le même facteur 2R/v qui gouverne tout le reste près de l'extinction, <b>3 km de visée valent environ 3 m/s de vitesse requise</b>. Continuer à corriger tout en cherchant à ramener la vitesse à gagner à quelques m/s revient à courir après une cible qui recule aussi vite qu'on l'approche. Le résidu ne se pose jamais — non que la boucle soit mal réglée, mais parce que c'est sa propre sortie qui déplace son objectif.</p>
      <p>Le gel arrête aussi la correction latérale, et c'est pourquoi l'ordonnancement est délibéré. La boucle latérale dispose exactement de la fenêtre comprise entre <em>la prédiction de portée devient exploitable</em> et <em>la visée est gelée</em> — quelques dizaines de secondes — pour faire son travail. Élargissez la fenêtre et la visée erre ; resserrez-la et le biais latéral survit jusqu'à l'impact.</p>`,
  },

  'tlm.correctionThrust': {
    title: 'Poussée de correction',
    caption: 'La fenêtre s\'ouvre près de l\'apogée et ne se rouvre jamais.',
    labels: {
      truth: 'trajectoire vraie', believed: 'trajectoire crue', target: 'objectif',
      windowLabel: 'fenêtre de correction', fire: 'poussée', altFloor: 'plancher : 120 km',
      gap: 'l\'erreur corrigée est celle qu\'il voit', caption: 'Un seul tir, calculé sur une estimation.',
    },
    body: `<p>La poussée réellement délivrée par le petit moteur de correction, en newtons. Elle reste à zéro presque tout le vol : la poussée dure quelques secondes, une seule fois, près de l'apogée.</p>
      <p>Le calculateur n'allume que si deux conditions sont réunies en même temps — au-dessus de 120 km, et avec une vitesse radiale quasi nulle. C'est le sommet de l'arc, et c'est le bon endroit : une impulsion donnée y achète le plus grand changement de portée, et il reste assez de trajectoire devant pour que la correction porte.</p>
      <p><b>Mais il corrige l'erreur qu'il <em>voit</em>, pas celle qu'il a.</b> Le calculateur compare sa position estimée au point visé et résout le changement de vitesse qui refermerait l'écart. Si l'estimation est fausse, la correction l'est exactement dans le même sens — et la poussée éloigne alors l'engin de la cible au lieu de l'en rapprocher. Une réserve n'est pas un filet de sécurité : c'est un amplificateur de ce que la centrale croit.</p>`,
  },

  'tlm.impulseUsed': {
    title: 'Impulsion consommée',
    caption: 'Ce que vaut un mètre par seconde d\'impulsion à l\'apogée.',
    labels: {
      reserve: 'réserve d\'impulsion', atApogee: 'dépensé à l\'apogée', navError: 'erreur de navigation',
      reach: 'décalage de portée obtenu', perMs: 'par m/s', burn: 'poussée', caption: 'Dépenser plus que l\'erreur, c\'est dépenser contre soi.',
    },
    body: `<p>La part de la réserve déjà dépensée, rapportée au budget que vous avez fixé. Une fois consommée, elle est perdue : il n'y a pas de seconde poussée dans ce simulateur, et aucun engin réel n'en emporte beaucoup.</p>
      <p>Le taux de change est brutal. Près de l'apogée, un mètre par seconde d'impulsion déplace le point d'impact d'environ un kilomètre — c'est la même sensibilité <b>2R/v</b> qui rend la vitesse d'extinction si critique. Une réserve de 60 m/s vaut donc quelque 60 km d'autorité de correction, bien plus que n'importe quelle erreur de navigation plausible.</p>
      <p>Ce qui signifie que le budget n'est presque jamais la limite. Ce qui limite la correction, c'est la <em>qualité de l'estimation</em> qui la commande. Monter la réserve au-delà de quelques dizaines de m/s n'achète rien : vous savez déjà corriger bien plus que vous ne savez percevoir.</p>`,
  },
};
