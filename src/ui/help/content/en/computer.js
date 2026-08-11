// Fiches « calculateur de bord » — anglais.
//
// Fil conducteur du groupe : le calculateur ne recoit jamais l'etat vrai. Tout
// ce qu'il decide, il le decide sur une croyance — et c'est l'ecart entre
// cette croyance et le monde qui se mesure au sol a l'arrivee.
export default {
  'sensor.computer': {
    title: 'Flight computer',
    caption: 'One arrow crosses upward, and the sensors have already spoiled it.',
    labels: {
      onboard: 'on board',
      world: 'physical world',
      sensors: 'Sensors',
      filter: 'Kalman filter',
      estimate: 'Believed state',
      guidance: 'Guidance law',
      truth: 'True state  r, v, q',
      actuators: 'Actuators',
      measured: 'measurements',
      noisy: 'biased, noisy',
      orders: 'orders',
      forces: 'thrust, lift, drag',
      never: 'this link does not exist',
      caption: 'The truth never crosses the line.',
    },
    body: `<p>The computer decides three things: where to point the thrust, when to cut off, and — after separation — what angle of attack and bank to hold. Its guidance cycle takes exactly one argument about the world: <b>the inertial navigator</b>. It never sees the true state. That is not a simplification of the simulator, it is an invariant of the code: no function in the guidance module has access to the physical state vector.</p>
      <p>The chain is the one drawn above. The sensors read the physical world and hand over readings already spoiled by bias and noise; the Kalman filter builds a best estimate from them; the guidance law re-solves the ballistic problem <em>from the position it believes it holds</em> and thrusts along the resulting velocity-to-gain; the orders go to the actuators, which act on the real vehicle. The loop is closed — but it is closed through a belief.</p>
      <p>Cutoff illustrates it well. Waiting for the velocity-to-gain to vanish does not work with a motor that cannot throttle, so the computer cuts on a scalar that only grows while thrust lasts: the range of the impact point it <em>predicts</em>, re-evaluated four times a second and re-solved every cycle once the velocity-to-gain drops below 400 m/s. The prediction is excellent. It is simply made from the wrong starting point.</p>
      <p>Hence the reading of the final miss. On a 1912 km shot the vehicle cuts off at 3987 m/s, and <b>one metre per second of velocity error there is worth about 870 m of range</b> — the classical 2R/v. The computer can be exact and still put the warhead kilometres away, because the distance measured on the ground is, for the most part, the navigation error it never knew it had.</p>`,
  },

  'computer.gravityModel': {
    title: 'Onboard gravity model',
    caption: 'A model error hides in no measurement — and in no filter state.',
    labels: {
      sphere: 'point mass',
      real: 'real Earth, J2',
      gravityGap: 'gravity gap, equator / pole',
      noSensor: 'nothing measures it',
      currentModel: 'current model',
      modelJ2: 'with oblateness',
      modelPoint: 'point mass',
      matches: 'onboard model matches the truth',
      j2Curve: 'unmodelled J2',
      navCurve: 'accelerometer bias, 25 µg',
      time: 'flight time',
      error: 'position error',
      caption: 'Both curves are ½·b·t². Only the name of b changes.',
    },
    body: `<p>The Earth is not a sphere: it bulges at the equator by 21 km. The main term of that departure is the zonal harmonic <b>J2 = 1.08·10⁻³</b>, and the simulator carries two versions of gravity — the true one, which always includes J2, and the onboard one, which this selector switches. Choosing <em>point mass</em> does not make the world simpler; it makes the computer wrong about a world that stays oblate.</p>
      <p>The gap looks negligible. At the surface it is <b>+1.62·10⁻³</b> of g at the equator and <b>−3.27·10⁻³</b> at the pole — a thousandth. But translate it into the unit used for accelerometers and it reads <b>1623 µg</b>, sixty-five times the bias of a navigation-grade unit. It is constant, it never averages out, and it is integrated twice: ½·b·t² over a fifteen-minute flight gives about 6 km.</p>
      <p>Measured in the simulator, with every sensor error set to zero so that only the model is at fault: a 1912 km shot misses by 0.24 km with J2 and <b>4.4 km with the point mass</b>; a 6748 km shot goes from 1.6 km to <b>14 km</b>.</p>
      <p>What makes it a different animal from a sensor error is that <b>it appears in no measurement</b>. The star tracker reads attitude, not gravity. The barometer only works below 32 km, at the very end of the flight. The filter carries bias states for the gyros and the accelerometers, and none for gravity — so it cannot even name the culprit. It will faithfully estimate everything else while the whole solution walks away.</p>`,
  },

  'computer.midcourse': {
    title: 'Midcourse correction',
    caption: 'The burn puts the believed trajectory on the target. The real one keeps its error.',
    labels: {
      truth: 'true trajectory',
      believed: 'believed trajectory',
      target: 'target',
      windowLabel: 'window · γ < 1.15° · ≈ 14 s',
      fire: 'a single burn, ≈ 8 s before apogee',
      altFloor: 'working floor',
      gap: 'navigation error, unchanged',
      caption: 'Correcting an error you cannot see moves you, not it.',
    },
    body: `<p>A small reserve of impulse, fired once during the coast. The computer opens the window on two conditions, and they are exactly those written in the code: <b>estimated altitude above 120 km</b>, and radial velocity below 2 % of speed — a flight path angle under 1.15°. In other words, near apogee. On a 1912 km shot the burn goes off at T+443 s, <b>8.5 s before an apogee of 584 km</b>: the altitude floor was crossed minutes earlier, so it is the angle that picks the instant.</p>
      <p>What is computed then is a fresh intercept solution from the <em>estimated</em> position, and the impulse is the difference between the velocity that solution requires and the current one, clipped to the reserve and applied at 4 m/s². The demand is of the order of a kilometre per second, so the reserve always saturates: it leaves in one burn, in that direction.</p>
      <p>And here is the whole point of the card. <b>The correction only addresses the error the unit sees.</b> If the estimate has drifted two kilometres, the computer sees a trajectory that misses by whatever its own drift makes it look like, and aims the impulse accordingly. The impulse is applied to the real vehicle as well — so the believed trajectory lands neatly on the target while the true one keeps its two kilometres, or gains a few more. A correction is a lever, and the lever rests on the estimate.</p>
      <p>Which is why the midcourse correction is worth the most on the vehicles that have something to correct <em>with</em>: a star tracker fixing attitude before apogee, an accurate estimate at the moment of the burn. On a unit that has drifted freely for seven minutes, it mostly relocates the miss.</p>`,
  },

  'computer.midcourseBudget': {
    title: 'Impulse reserve',
    caption: 'A few m/s already move the impact further than the navigation error ever will.',
    labels: {
      reserve: 'reserve [m/s]',
      atApogee: 'at apogee',
      reach: 'impact displacement [km]',
      navError: 'a typical navigation error: 2 km',
      perMs: 'one m/s, at apogee / at cutoff',
      burn: 'spent in a single burn at 4 m/s²',
      caption: 'The reserve is not what limits you. The estimate is.',
    },
    body: `<p>How many metres per second the correction block may spend, from 5 to 400. The figure only becomes readable once converted into ground distance, and that conversion is measured rather than guessed: propagating the same coast state twice, one m/s added along track at apogee moves the impact point by <b>456 m</b>, and 391 m if applied crosswise.</p>
      <p>The same metre per second is worth <b>868 m at cutoff</b>, nearly twice as much — the vehicle still has the whole arc ahead of it, so the lever is longer. That is the general rule of ballistic guidance, and the reason cutoff timing is fought over to the millisecond while the midcourse burn can afford a few seconds of slack.</p>
      <p>Run the arithmetic the other way and the setting loses much of its drama. A navigation error of two kilometres would be cancelled by <b>4.4 m/s</b> — below the minimum the slider allows. The default 60 m/s can shift the impact 27 km, far more than any error a navigation-grade unit will produce on this flight. The reserve is essentially never the binding constraint.</p>
      <p>What binds is the accuracy of the estimate the impulse is aimed with. Raising the reserve buys more displacement, not more truth — and displacement applied in a slightly wrong direction is simply a larger mistake, delivered faster.</p>`,
  },
};
