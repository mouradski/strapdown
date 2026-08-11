# Strapdown

*Simulateur de trajectoire balistique et de navigation inertielle sans satellite.*

Le nom vient du terme technique : une centrale **strapdown** est boulonnée
rigidement à la structure, sans cardans — c'est celle que ce simulateur modélise,
et c'est elle qui décide de tout ici.

Simulateur pédagogique jouable dans le navigateur. On choisit un site de tir et
un objectif sur un globe terrestre, on règle une suite de capteurs, on lance, et
l'on regarde où l'engin tombe — et surtout **pourquoi il tombe là**.

```bash
npm install
npm run dev      # http://localhost:5178
npm test         # 1117 assertions
npm run build    # dist/ statique
```

## L'idée

Le sujet n'est pas la trajectoire : c'est **l'écart entre ce qui se passe et ce
que le calculateur de bord croit qu'il se passe**.

Sans constellation satellite, un engin ne connaît sa position qu'en intégrant ce
que lui rapportent ses capteurs inertiels. Or un accéléromètre ne mesure pas
l'accélération : il mesure la *force spécifique*, c'est-à-dire tout **sauf** la
gravité — en chute libre il indique zéro. Le calculateur doit donc rajouter
lui-même la gravité, calculée à partir de la position qu'il croit occuper,
position déjà entachée d'erreur. La boucle se referme sur elle-même.

Deux trajectoires sont donc tracées en permanence :

- **en vert**, la trajectoire réelle, issue de la simulation physique ;
- **en orange**, celle que le calculateur reconstruit depuis ses seuls capteurs.

Le calculateur n'a **jamais** accès à la verte. C'est l'invariant structurant de
tout le code : `src/guidance/` ne lit que `nav`, jamais `sim.y`.

## Ce qui est modélisé

**Physique** — gravité avec aplatissement J2, atmosphère standard US 1976
(couches jusqu'à 86 km puis table jusqu'à 1000 km), traînée fonction du nombre
de Mach, portance newtonienne pour le corps porteur, rotation terrestre,
géodésie WGS84, intégration Runge-Kutta 4.

**Capteurs** — centrale inertielle avec biais, marches aléatoires angulaire et
de vitesse, erreurs de facteur d'échelle et défaut d'alignement initial ; viseur
stellaire ; altimètre barométrique et radioaltimètre ; corrélation de terrain
(voir ci-dessous).

**Relief** — un champ synthétique, déterministe, évalué analytiquement en tout
point, sans aucune donnée stockée. Ce n'est pas le relief de la Terre : aucune
base d'altitude mondiale à la résolution utile (la centaine de mètres) n'est
embarquable dans un navigateur. Mais il est ancré sur les vraies côtes et
possède les propriétés qui décident du fonctionnement d'une corrélation :
un tiers environ des terres est accidenté, le reste est plat, la mer est
rigoureusement lisse. Le globe l'affiche — les zones claires sont celles où le
recalage fonctionnera.

**Corrélation de terrain** — réellement simulée, et non modélisée par un bruit :
le radioaltimètre relève le profil du sol sous la position vraie, le calculateur
le range en face de la position qu'il croit occuper, puis fait glisser ce profil
sur sa carte embarquée jusqu'à le faire coïncider. Le décalage trouvé est
l'erreur de navigation. La précision n'est donc **pas un réglage** : elle résulte
du relief survolé, de la finesse de la carte, du bruit de l'altimètre et de la
longueur du profil. L'incertitude annoncée se déduit de la courbure du minimum
et de son contraste — un minimum mou signifie un terrain ambigu, et le module
refuse alors de répondre plutôt que de mentir.

**Navigation** — mécanisation strapdown en repère inertiel, filtre de Kalman à
état d'erreur à 15 états (position, vitesse, attitude, biais accéléromètre,
biais gyromètre), forme de Joseph, test du khi-deux sur les mesures.

**Guidage** — solution balistique par le problème de Gauss (itération sur le
demi-latus rectum), correction du point visé par simulation complète, extinction
au passage de la portée prédite sur la cible, et pour le planeur : montée
surbaissée, vol plané d'équilibre et gestion d'énergie par virages en S.

## Trois vecteurs

| | portée utile | trajectoire |
|---|---|---|
| **A** — balistique 2 étages | 3 600 km | apogée ~590 km |
| **B** — balistique 3 étages | 13 000 km | apogée ~1 260 km |
| **C** — planeur hypersonique | 9 500 km | surbaissée, apogée ~160 km |

Les portées ont été **mesurées** par simulation, non déduites du Δv : les pertes
de montée sont un montant absolu (~2 km/s) et non une proportion, de sorte
qu'aucune règle simple ne les prédit d'un vecteur à l'autre.

## Ce que l'on observe

Un vecteur balistique ne pilote plus après l'extinction : sa précision se joue
entièrement à cet instant. La portée y est sensible à la vitesse d'environ
**2R/v**, soit près d'un kilomètre par m/s sur un tir de 2 000 km. Le bilan de
tir chiffre cette décomposition.

Un planeur, lui, manœuvre jusqu'au bout : il corrige tout ce que sa centrale
perçoit, et son écart final se rapproche de sa seule erreur de navigation
résiduelle.

Le bouton *Tirer 25 fois* distingue les deux natures d'erreur : la **dispersion**
du nuage vient des biais de capteurs, retirés à chaque tir ; un **décentrage**
par rapport à la croix révélerait au contraire une erreur systématique, que
davantage de tirs ne corrigeraient pas.

## Limites assumées

- Les vecteurs balistiques conservent un **plancher d'environ 240 m**, latéral
  et déterministe : dans les dernières secondes de poussée, la vitesse de
  rotation limitée empêche la direction de vitesse de rallier complètement la
  visée corrigée.
- Le planeur tient environ **300 m** sur toute sa plage, et descend vers 260 m
  avec un recalage terminal. Son résidu propre (mesuré centrale parfaite)
  est de l'ordre de 330 m.
- Les deux planchers sont verrouillés par des tests.

## Balistique ou planeur : lequel est le plus précis sans satellite ?

Le planeur — et le simulateur permet de le montrer plutôt que de l'affirmer.

Il faut distinguer deux erreurs : **ne pas savoir où l'on est** (navigation) et
**le savoir sans pouvoir s'y rendre** (guidage). En activant la corrélation de
terrain, on améliore la navigation des deux vecteurs de la même façon — mais un
seul en tire parti :

| | dérive à l'impact | écart à l'impact |
|---|---|---|
| balistique, sans recalage terminal | 164 m | 537 m |
| balistique, avec corrélation de terrain | **59 m** | 526 m |
| planeur, sans recalage terminal | 196 m | 289 m |
| planeur, avec corrélation de terrain | **68 m** | **264 m** |

Le corps de rentrée balistique voit sa position trois fois mieux connue et
manque exactement pareil : sa trajectoire est scellée depuis l'extinction, il
ne pilote plus. Le planeur, lui, manœuvre jusqu'au sol et convertit
l'information en précision.

C'est l'inverse de l'intuition : un engin manœuvrant n'est pas *handicapé* par
l'absence de satellite, il est le mieux placé pour s'en passer — à condition
d'embarquer un capteur qui regarde le sol.
- La propulsion est grossière (poussée et impulsion spécifique constantes,
  étagement instantané) : ce n'est pas le sujet.
- Les caractéristiques des vecteurs sont des ordres de grandeur génériques.

## Organisation

```
src/core/       géodésie, atmosphère, gravité, algèbre, intégrateur
src/sim/        véhicules, dynamique « vérité terrain », orchestration
src/avionics/   capteurs, centrale inertielle, filtre de Kalman
src/guidance/   solution balistique, calculateur de bord
src/render/     globe Three.js, tracés, sélection à la souris
src/ui/         panneaux, mise en forme
tests/          1117 assertions, lancées par `npm test`
```

Les tests valident surtout des **comportements** : lois de croissance des
erreurs inertielles (t² pour un biais accéléromètre, t³ pour un biais
gyromètre, amplitudes vérifiées à 2 %), conservation de l'énergie orbitale,
concordance de l'angle de pente d'énergie minimale avec la formule fermée
45° − Ψ/4, cohérence interne de la table atmosphérique, et effet réel de chaque
recalage.
