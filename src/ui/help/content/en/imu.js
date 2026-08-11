// Fiches « centrale inertielle » — anglais (reference).
//
// Modele pour tous les autres groupes. Chaque fiche porte :
//   title    le titre de la fenetre
//   body     le texte, en HTML simple (<p>, <b>, <em>, <ul>/<li>)
//   caption  une legende courte sous le schema (facultatif)
//   labels   les textes DESSINES DANS le schema — ils doivent etre traduits
//            comme le reste, d'ou leur presence ici plutot qu'en dur dans le SVG
export default {
  'sensor.imu': {
    title: 'Inertial measurement unit',
    caption: 'The estimate feeds the gravity model, which feeds the estimate.',
    labels: {
      accel: 'Accelerometers + gyros',
      integrate: 'Integration',
      position: 'Believed position',
      gravity: 'Gravity model',
      loop: 'The loop closes on itself',
      loopNote: 'a wrong position computes a wrong gravity',
      caption: 'Nothing here is measured against the outside world.',
    },
    body: `<p>Three accelerometers and three gyros, rigidly bolted to the airframe — no gimbals. The gyros track how the vehicle has rotated; the accelerometers measure what it feels along each body axis. From those six numbers alone the computer reconstructs where it is.</p>
      <p><b>An accelerometer does not measure acceleration.</b> It measures <em>specific force</em> — everything except gravity. In free fall it reads exactly zero, which is why a coasting warhead's accelerometers go quiet. The computer must therefore add gravity itself, computed from the position it <em>believes</em> it occupies.</p>
      <p>That is the trap the diagram shows. A position error produces a gravity error, which produces a velocity error, which produces a larger position error. The loop feeds itself. This is why inertial drift is not merely accumulated noise but a genuinely unstable process, and why the fixes offered by the other sensors matter so much.</p>`,
  },

  'imu.grade': {
    title: 'Unit class',
    caption: 'Four decades separate a phone from a submarine.',
    labels: {
      consumer: 'Consumer', tactical: 'Tactical',
      navigation: 'Navigation', strategic: 'Strategic',
      current: 'current setting:', axis: 'gyro bias [°/h] — logarithmic scale',
      caption: 'Each step down costs roughly ten times the price.',
    },
    body: `<p>These are the conventional categories of the open navigation literature. They are not marketing tiers: they mark genuine technology breaks.</p>
      <ul>
        <li><b>Consumer (MEMS)</b> — silicon, a few euros, the class inside a phone. Drifts kilometres within a minute.</li>
        <li><b>Tactical</b> — fibre-optic gyros. Good for a missile that flies for a minute under a seeker's supervision.</li>
        <li><b>Navigation</b> — ring-laser gyros, the airliner standard. About one nautical mile of drift per hour.</li>
        <li><b>Strategic</b> — electrostatic or hemispherical resonator gyros, the class of a submarine or an intercontinental missile. Extraordinarily expensive.</li>
      </ul>
      <p>Move any individual slider afterwards and the class switches to <em>custom</em>: the presets are only starting points.</p>`,
  },

  'imu.gyroBias': {
    title: 'Gyro bias',
    caption: 'Both curves are computed from your current settings.',
    labels: {
      time: 'flight time', error: 'position error',
      accel: 'accelerometer', gyro: 'gyro',
      crossover: 'crossover', at: 'at',
      caption: 'Beyond the crossing, attitude drift dominates everything else.',
    },
    body: `<p>A constant rotation rate the gyro reports while the vehicle is perfectly still. Expressed in degrees per hour.</p>
      <p><b>It is the single most consequential parameter in the whole simulator</b>, and the diagram shows why. A gyro bias slowly tips the computer's idea of the vertical. Once the vertical is wrong by ψ, the computer mis-resolves gravity, and a component <em>g·sin ψ</em> leaks into what it takes for real acceleration. Since ψ itself grows linearly with time, the resulting position error grows as the <b>cube</b> of flight time — against the square for an accelerometer bias.</p>
      <p>The practical consequence: on a short flight the accelerometer dominates, on a long one the gyro always wins. That is the entire argument for carrying a star tracker — it measures attitude, kills ψ, and with it the cubic term.</p>`,
  },

  'imu.gyroARW': {
    title: 'Angle random walk',
    caption: 'Five draws from the same unit, same flight.',
    labels: {
      time: 'flight time', error: 'attitude error',
      caption: 'Noise does not bias — it disperses. The spread grows as √t.',
    },
    body: `<p>The white noise of the gyro, quoted in degrees per square-root hour. Unlike bias, it has no preferred direction: it is the random jitter of the measurement.</p>
      <p>Integrating white noise gives a <b>random walk</b>. The error does not grow proportionally with time but as its square root, and — decisively — <em>it is different on every flight</em>. Bias is repeatable and could in principle be calibrated out; random walk cannot, ever.</p>
      <p>This is the difference the dispersion run makes visible: fire 25 times with the same settings and the cloud you see is essentially the random terms. A cloud offset from the cross would instead reveal a systematic error, which more shots would never fix.</p>`,
  },

  'imu.accelBias': {
    title: 'Accelerometer bias',
    caption: 'Both curves are computed from your current settings.',
    labels: {
      time: 'flight time', error: 'position error',
      accel: 'accelerometer', gyro: 'gyro',
      crossover: 'crossover', at: 'at',
      caption: 'Below the crossing, the accelerometer is what limits you.',
    },
    body: `<p>A constant offset the accelerometer adds to every measurement, quoted in micro-g — millionths of the weight at the surface. 25 µg, the navigation-grade figure, is 0.00025 m/s².</p>
      <p>Integrated twice, that trifle becomes a position error of <b>½·b·t²</b>. Over ten minutes of flight, 25 µg alone puts you 44 m out.</p>
      <p>The bias grows as the square of time, the gyro's as the cube — so there is always a crossover, marked on the diagram. Before it, improving the accelerometers pays; after it, only the gyros matter. Shifting the sliders moves that instant, and it is worth watching where it lands relative to your flight time.</p>
      <p>One subtlety the filter runs into: a <em>scale factor</em> error — the accelerometer reading 1.0003 times the truth — looks exactly like a bias whenever thrust is constant. The Kalman filter absorbs it into the bias state, which is why it sometimes reports a bias far larger than the one you set.</p>`,
  },

  'imu.accelVRW': {
    title: 'Velocity random walk',
    caption: 'Five draws from the same unit, same flight.',
    labels: {
      time: 'flight time', error: 'velocity error',
      caption: 'Noise does not bias — it disperses. The spread grows as √t.',
    },
    body: `<p>The accelerometer's white noise, quoted in m/s per square-root hour. Its integral is a velocity random walk.</p>
      <p>It matters far less than bias here, and for a structural reason: over a flight lasting minutes, √t stays small while t² does not. On a vehicle that flew for hours the ranking would reverse.</p>
      <p>It does however set a floor on what the Kalman filter can achieve. Even a perfect fix cannot recover information the noise has already destroyed — which is why pushing the star tracker's sighting interval down indefinitely stops buying anything.</p>`,
  },

  'imu.alignment': {
    title: 'Initial alignment error',
    caption: 'The angle is drawn exaggerated — arcminutes do not show.',
    labels: {
      trueVertical: 'true vertical',
      believedVertical: 'believed vertical',
      alignment: 'alignment error',
      leak: 'leaks into horizontal',
      after: 'after 10 min',
      caption: 'Nothing aboard can tell this leak from a real acceleration.',
    },
    body: `<p>Before launch the unit must learn which way is up and which way is north. It does so by watching gravity and the Earth's rotation — a process called gyrocompassing, which takes minutes and never ends perfectly. What remains is quoted in arcminutes.</p>
      <p>The consequence is immediate and permanent. If the computer believes the vertical lies ψ away from where it really is, then it mis-resolves gravity, and a component <b>g·sin ψ</b> lands in the horizontal channel as a phantom acceleration. <b>Half an arcminute is already 143 µg</b> — several times a navigation-grade accelerometer's own bias.</p>
      <p>And nothing aboard can detect it. A real acceleration and a mis-resolved gravity are the same reading. Only an outside observation — a star, the ground — can break the ambiguity, which is exactly what the star tracker does.</p>`,
  },
};
