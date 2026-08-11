// Fiches mission — anglais (reference).
//
// Fil du groupe : le site de tir est la seule position vraie que le bord
// possede, l'objectif n'est qu'une constante, et la distance mesuree a
// l'arrivee est ce qui s'est accumule entre les deux.
export default {
  'mission.launchSite': {
    title: 'Launch site',
    caption: 'The altitude you type does not survive; the relief decides.',
    labels: {
      entered: 'altitude entered',
      snapped: 'read back from the relief',
      pad: 'pad',
      ledger: 'What the site hands over',
      position: 'Position',
      velocity: 'Velocity',
      attitude: 'Attitude',
      posNote: 'surveyed —',
      velNote: 'exact: Ω × r =',
      attNote: 'gyrocompassed',
      caption: 'Two conditions come free. The third is the one that costs kilometres.',
    },
    body: `<p>The pad is surveyed: latitude, longitude and altitude enter the computer as exact numbers. The altitude you type, however, does not survive — it is replaced by the elevation the terrain field returns at those coordinates, so the pad sits <em>on</em> the ground instead of buried under it or hanging above it. Two independent sources described the same place, and only one of them is also the ground the vehicle will fly over.</p>
      <p>At initialisation the navigator is placed on that position with 3 m of scatter per axis — about 5 m in space. <b>That is the smallest the navigation error will ever be.</b> Everything afterwards is dead reckoning away from this single anchor, and the diagram's ledger says why one of the three initial conditions is not like the others:</p>
      <ul>
        <li><b>Position</b> — surveyed. Exact to a few metres, free.</li>
        <li><b>Velocity</b> — the pad is motionless on a rotating Earth, so its inertial velocity is Ω × r: 465 m/s eastward at the equator, times the cosine of latitude. Known exactly, because the position is.</li>
        <li><b>Attitude</b> — not given. Which way the instrument cluster points has to be discovered by watching gravity and the Earth's rotation, and what that process leaves behind is the alignment error.</li>
      </ul>
      <p>Choosing a site is therefore already an accuracy decision, before any instrument is considered. The site fixes the range to the target, range fixes flight time, and flight time is the multiplier on every defect the unit has. The firing solution is computed in inertial axes, so an eastward shot from low latitude starts with several hundred m/s the Earth is already providing, and the burnout speed the trajectory demands falls by that much.</p>`,
  },

  'mission.target': {
    title: 'Target',
    caption: 'One term of the subtraction is exact. The whole miss lives in the other.',
    labels: {
      truePos: 'True position',
      believed: 'Believed position',
      targetBox: 'Target coordinates',
      vGo: 'Velocity to gain',
      noLink: 'no receiver, no seeker, no link',
      noLinkNote: 'nothing aboard observes the outside world',
      believedNote: 'inertial estimate — the only uncertain term',
      targetNote: 'loaded before launch, exact, constant',
      vGoNote: 'steered on the difference',
      caption: 'Knowing exactly where the target is says nothing about where you are.',
    },
    body: `<p>Two numbers you declare, loaded before launch as a fixed vector in Earth-fixed axes. They are exact by construction: nobody measures a target coordinate in flight. <b>There is no satellite receiver, no seeker and no data link aboard</b> — nothing ever looks at the ground to confirm anything.</p>
      <p>What the guidance loop does with them is a subtraction. It solves for the velocity that would carry it from where it <em>believes</em> it is to the target, and steers on the difference. One term is exact and never moves; the other is the inertial estimate. All the error of that subtraction sits on the second side, which is exactly why an exact target coordinate is useless as a position fix. Knowing where the target is tells you nothing about where you are.</p>
      <p>The consequence is the whole point of the simulator. Apart from re-entry dispersion, the distance measured at impact <b>is</b> the navigation error, read directly in metres. Placing the target is how you hand yourself a ruler, not how you hand the vehicle information.</p>
      <p>One refinement worth knowing: the point actually aimed at is not the target. The Keplerian solution ignores atmospheric braking, which always falls short, so the computer displaces its aim point by whatever its own prediction says it will lose, and solves again. That correction is made against the vehicle's own model of the flight — still not an observation from outside.</p>`,
  },

  'mission.loft': {
    title: 'Trajectory profile',
    caption: 'Same two points, same range on the ground, five different flights.',
    labels: {
      axisAlt: 'altitude [km]',
      launch: 'launch',
      target: 'target',
      groundRange: 'ground range',
      apogee: 'apogee',
      flightTime: 'flight time',
      required: 'required speed',
      minEnergy: 'minimum energy',
      current: 'current setting',
    },
    body: `<p>Between two points there is one ballistic arc that costs less speed than any other. The solver finds it by golden-section search on the orbit parameter, and its departure slope follows the classical <b>φ = 45° − Ψ/4</b>, where Ψ is the angle the two points subtend at the Earth's centre. Nearly 45° for a short hop, 36.9° over 3600 km, 18° over 13000 km. That is loft = 0.</p>
      <p>Move the slider and the same pair of points is solved again on the high branch: the code asks for an apogee of <b>(1 + 2.2·loft)</b> times the minimum-energy one, plus 60 km per unit of loft, then bisects until it gets it. Over 3600 km the apogee climbs from 835 km to about 3000 km and the required speed from 5.44 to 6.69 km/s — the same range for 23 % more speed to buy, which a vehicle near its limit simply does not have.</p>
      <p>What loft buys is a steeper, faster re-entry, and a way to spend a long-range vehicle's energy over a short ground range. What it costs is measured in metres. Flight time goes from 1076 s to 2305 s, and a gyro bias grows position error as <em>t³</em>: 2.14 cubed is close to a factor of ten on the final miss. <b>Loft is paid for in accuracy</b>, in the very currency the simulator measures.</p>
      <p>The glider has no such setting and the panel hides it. Its profile is not a Kepler arc but a deliberately depressed ascent followed by a pull-up at 62 km, after which it flies rather than falls.</p>`,
  },

  'mission.range': {
    title: 'Useful range',
    caption: 'A rule proportional to Δv, calibrated on vehicle A, is wrong by a factor of 2.5.',
    labels: {
      bal2: 'Vehicle A', bal3: 'Vehicle B', glide: 'Vehicle C',
      axisDv: 'ideal Δv [km/s]',
      axisRange: 'measured range [km]',
      rule: 'rule proportional to Δv',
      glideNote: 'does not fall back — it glides',
      caption: 'Losses are subtracted from the speed, not scaled with it.',
    },
    body: `<p>Each vehicle carries a single number, its <em>useful range</em>: 3600 km, 13000 km, 9500 km. Those figures were obtained by flying the simulation and reading where it landed — not by evaluating a formula. The mission readout compares your ground range against them and warns when you ask for more.</p>
      <p>Deducing them from the rocket equation does not work, and the diagram shows how badly. Vehicle A has 7.21 km/s of ideal Δv and reaches 3600 km; vehicle B has 10.45 km/s, 45 % more, and reaches 13000 km, 260 % more. Anchor a proportional rule on A and it puts B at 5200 km.</p>
      <p>The reason is that losses are <b>subtracted, not scaled</b>. Climbing out of the dense layers costs an absolute amount of speed — roughly 1.8 km/s for A and 2.9 km/s for B here — and what reaches the trajectory is Δv minus that amount. Range then grows explosively with the remainder, because the ballistic range of a given speed diverges as it approaches circular orbital speed, 7.9 km/s. A modest surplus at the top of the ladder buys an enormous distance.</p>
      <p>The glider breaks the rule from the other side: 2 % more Δv than A, and 9500 km instead of 3600, because it does not fall back at all. No relation written in Δv describes both vehicles. Ask for more than the figure and the vehicle will still fly, and fall short — worth watching once, because the computer keeps steering at a target it can no longer reach.</p>`,
  },
};
