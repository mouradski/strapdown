// Fiches « telemetrie : capteurs » — anglais (reference).
//
// Ce groupe decrit le flux de ce qui est MESURE. Regle commune a toutes ces
// fiches : aucune de ces valeurs ne vient de la verite terrain, et c'est
// exactement ce qui les rend interessantes.
export default {
  'tlm.specificForce': {
    title: 'Specific force',
    caption: 'The vertical gap between the two curves is gravity — and it is never measured.',
    labels: {
      axis: 'specific force [g] — broken scale', pad: 'pad', boost: 'ascent',
      coast: 'free flight', entry: 're-entry',
      liftoff: 'lift-off:', entryPeak: 'tens of g',
      gapNote: 'this gap is gravity',
      coastNote: 'measured: 0.00 g',
      measured: 'specific force, as measured',
      trueAccel: 'true acceleration',
      caption: 'The computer must supply the missing g itself, from a position it only believes.',
    },
    body: `<p>The raw output of the three accelerometers, in body axes, in g. It is not an acceleration: <b>specific force</b> is everything the vehicle feels <em>except</em> gravity. Sitting on its pad the unit reads one g upward; in free fall it reads exactly zero.</p>
      <p>Watch the x row, the one along the airframe. At lift-off it shows thrust divided by lift-off mass — 2.64 g for the two-stage vector, 1.78 g for the glider — and climbs as the tanks empty, to just under ten g before cut-off. Then it falls to 0.00 and stays there for the whole ballistic arc, while the vehicle is falling at nearly one g. <em>Nothing in this row says the vehicle is moving at all.</em> On re-entry drag pushes it past thirty g.</p>
      <p>The y and z rows sit near zero under power, since thrust acts along the airframe. They are where a steering transient would show — and also where a mis-resolved gravity would hide, because no accelerometer can tell a genuine lateral force from a wrong idea of which way is down.</p>`,
  },

  'tlm.angularRate': {
    title: 'Angular rate',
    caption: 'The two rows differ by the gyro error, and by nothing else.',
    labels: {
      commanded: 'commanded rate',
      measured: 'measured rate',
      bias: 'bias — constant',
      scale: 'scale factor — ∝ rate',
      noise: 'random walk — new every sample',
      note: 'Computed from the current unit settings, at a 20 ms step.',
      caption: 'Subtract one row from the other and only the sensor error is left.',
    },
    body: `<p>What the three gyros report about the body axes, in degrees per second. The computer integrates it into an attitude; apart from the star tracker, nothing else aboard has an opinion about orientation.</p>
      <p>This row has a rare property. The row facing it in the right-hand column — <em>commanded rate</em> — is the truth: the vehicle follows its rate command exactly, so the difference between the two rows is the gyro error and nothing else. With a navigation-grade unit they agree to the third decimal. Fit a consumer unit and the measured row jitters by a couple of tenths of a degree per second around a commanded 0.170: that is angle random walk, sampled every 20 ms.</p>
      <p>The rates themselves are modest. Steering is limited to 0.12 rad/s — 6.9 °/s — while the stages are attached and 0.25 rad/s once the payload is free, which is why a −14 °/s spike appears just after separation, as the body swings to its entry attitude. For scale: the Earth turns at 15 °/h, that is 0.0042 °/s, and a navigation-grade bias of 0.01 °/h is one fifteen-hundredth of it. The unit has to resolve that to find north before launch.</p>`,
  },

  'tlm.gyroBiasEst': {
    title: 'Estimated gyro bias',
    caption: 'Left: nothing observes it. Right: every sighting does.',
    labels: {
      accelPanel: 'accelerometer bias [µg]',
      gyroPanel: 'gyro bias [°/h]',
      truthLine: 'true bias drawn for this flight — unknown aboard',
      startZero: "the filter's estimate, from zero",
      scaleNote: 'mostly the scale factor:',
      starNote: 'each sighting measures ψ = b·t, hence b',
      caption: 'These rows are an opinion about the sensors, not a reading from them.',
    },
    body: `<p>Not a setting: the filter's current opinion of its own gyros, one figure per axis in degrees per hour. It begins the flight at exactly 0.000. The filter knows the <em>specification</em> of its unit, never the three constants drawn for this particular flight, and carries them as states whose initial uncertainty is that specification.</p>
      <p>What makes them learnable is the star tracker. A bias b tilts the computed attitude by ψ = b·t, and a sighting measures ψ against the sky; two sightings therefore measure b. On one reference flight the x-axis estimate settled at 0.021 °/h against a true 0.0204 — three significant figures out of a state that started at zero.</p>
      <p>Switch the tracker off and the row stays at 0.000 for the whole flight while the true biases sit around 0.02 °/h. Not because the gyros became perfect, but because nothing ever contradicted them. That single line is the argument for carrying a star tracker, stated in the plainest possible terms.</p>`,
  },

  'tlm.accelBiasEst': {
    title: 'Estimated accelerometer bias',
    caption: 'Left: nothing observes it. Right: every sighting does.',
    labels: {
      accelPanel: 'accelerometer bias [µg]',
      gyroPanel: 'gyro bias [°/h]',
      truthLine: 'true bias drawn for this flight — unknown aboard',
      startZero: "the filter's estimate, from zero",
      scaleNote: 'mostly the scale factor:',
      starNote: 'each sighting measures ψ = b·t, hence b',
      caption: 'These rows are an opinion about the sensors, not a reading from them.',
    },
    body: `<p>The same idea in micro-g, with a much worse outcome. Compare this row with the accelerometer bias you set: it will usually disagree, for two separate reasons.</p>
      <p>The first is observability. Through the ballistic arc the star tracker measures attitude, and no term in the filter links an attitude to an accelerometer bias; above 32 km the altimeter answers nothing at all. On the reference flight the row stayed at −1 µg for seven hundred seconds while the true biases were 10, −31 and 5 µg. It only moved during re-entry, when specific force came back and the radar altimeter started answering — far too late to change anything.</p>
      <p>The second is that this state is a catch-all. Scale-factor errors are deliberately left out of the estimated state — six more states for a modest return — but ignoring them entirely would make the filter overconfident, so they are provisioned as process noise proportional to the stimulus. Whatever the filter can absorb, it absorbs here: at 30 ppm and 156 m/s² of specific force before cut-off, that is 480 µg looking for a home, twenty times the 25 µg you set. A row reading twice or three times the setting is not a fault; it is one state doing another's work.</p>`,
  },

  'tlm.measuredAlt': {
    title: 'Measured altitude',
    caption: 'Two channels, two ceilings, and a long silence in between.',
    labels: {
      radar: 'radar altimeter — ± 8 m',
      baro: 'barometer — ± 120 m',
      radarCeiling: 'radar ceiling 15 km',
      baroCeiling: 'barometric ceiling 32 km',
      silent: 'above: nothing answers',
      alt: 'altitude', sigma: 'announced ±',
      caption: 'Only the barometer carries a bias — the deviation of the real atmosphere.',
    },
    body: `<p>The raw output of whichever channel answered, in metres above sea level. Below 15 km the radar altimeter has priority: it sounds directly, ±8 m, with no atmospheric model in the loop. Above that and up to 32 km the barometer takes over at ±120 m, and it also carries a bias drawn once per flight from a 60 m spread — that bias stands for the deviation between the real atmosphere and the standard one the instrument inverts.</p>
      <p>Above 32 km neither channel answers and the block falls silent. On a ballistic arc that is most of the flight: in the reference run the last reading was 748 seconds old at apogee. Silence here is not a failure, it is the normal condition of an altimeter in space.</p>
      <p>The bias matters more than the noise. Noise averages down over the hundreds of readings a flight collects; a constant offset never does, and the filter has no state for it. Note also what this measurement is <em>not</em>: one distance along the local vertical. It constrains altitude, and only altitude — a horizontal drift of ten kilometres would pass through it untouched.</p>`,
  },

  'tlm.uncertainty': {
    title: 'Uncertainty',
    caption: "The filter's own ±σ — computed from its covariance, never from the truth.",
    labels: {
      time: 'flight time', error: 'position error',
      announced: 'announced ±σ, from the covariance',
      trueError: 'true error — exists only in the simulator',
      fix: 'a fix cuts it back',
      note: 'The computer cannot compare the two curves. Nothing aboard can.',
      caption: 'Growing between fixes, cut at each one — and sometimes wrong about both.',
    },
    body: `<p>The ± a measurement comes with. For the altimeter it is a setting: 8 m for the radar, 120 m for the barometer. For terrain correlation it is not a setting at all — it is computed afresh for each fix, from the sharpness of the correlation minimum.</p>
      <p>Whatever its origin, the filter takes the figure literally. It becomes R in the update, and R sets the weight: a measurement moves the state in proportion to P/(P+R). Understate it and the filter swallows a bad reading whole; overstate it and it politely ignores a good one. The same figure enters the consistency test, whose predicted spread is S = HPHᵀ + R — the filter's own uncertainty plus the sensor's.</p>
      <p>The figure shows the other σ, the one the filter computes about itself and displays as the navigation uncertainty: √trace P, cut back at every fix and growing in between. It is derived without ever consulting the truth, and the two curves cannot be compared aboard. On the reference glide the filter announced ±108 m at impact and was in fact 165 m out; at one point in the descent it claimed ±20 m in altitude while sitting 127 m low.</p>`,
  },

  'tlm.lastReading': {
    title: 'Last reading',
    caption: 'Between two fixes, the computer navigates on nothing but its own integration.',
    labels: {
      time: 'flight time', error: 'position error',
      fix: 'fix', between: 'between two fixes: pure integration',
      caption: 'The age of a reading measures how much dead reckoning you are doing.',
    },
    body: `<p>How long ago this equipment last spoke. The barometer is polled twice a second, so the field normally reads <em>just now</em>; past three seconds the row greys out.</p>
      <p>What makes it worth watching is that it is really a phase indicator. Above the barometer's 32 km ceiling nothing answers, and the age climbs for as long as the vehicle stays up there — twelve minutes on the reference ballistic flight. Throughout that time the position the computer reports is pure dead reckoning, and its error grows unchecked: as t² for an accelerometer bias, as t³ for a gyro one.</p>
      <p>An ageing reading is therefore not a malfunction. It is the definition of inertial navigation, and this field tells you precisely how much of it you are doing at the moment.</p>`,
  },

  'tlm.sightings': {
    title: 'Sightings taken',
    caption: 'The clock ticks throughout; altitude alone decides whether a sighting happens.',
    labels: {
      altitude: 'altitude — compressed scale', time: 'flight time',
      minAlt: 'visibility floor', occulted: 'occulted — stars unusable',
      sighting: 'sighting obtained', tally: 'running count',
      caption: 'Same tracker, same interval: the flight profile decides the harvest.',
    },
    body: `<p>The number of star fixes obtained since launch. The tracker attempts one every 20 seconds by default, but only above 45 km — lower down the dense atmosphere makes the stars unusable.</p>
      <p>So the count is set by the flight profile, not by the equipment. The reference ballistic flight spends almost all of its 865 seconds above the floor and collects 40 sightings. The glider, which climbs to 154 km and then spends the second half of its flight below 35 km, gets 21 out of a slightly longer flight. Same tracker, same interval, half the fixes — and it is the second half of the flight, the one that decides the impact point, that goes without.</p>
      <p>Each fix is three degrees of freedom of attitude at 8 arcsec, and it is the only measurement aboard that touches ψ. That is what makes it the most profitable correction available without satellites: it kills the attitude drift, and with it the cubic growth term of the position error.</p>`,
  },

  'tlm.sightingAccuracy': {
    title: 'Sighting accuracy',
    caption: 'An angular error does not stay angular: it becomes a phantom acceleration.',
    labels: {
      sigma: 'sighting 1σ', attitude: 'attitude error ψ',
      leak: 'g·sin ψ leaks into the horizontal',
      position: 'position error after the coast',
      after: 'after 10 min',
      caption: 'The tracker sets the floor for the whole navigation solution.',
    },
    body: `<p>The 1σ accuracy of the last sighting, in arcseconds — the sensor's own specification, handed to the filter unchanged as R. Eight arcseconds is 39 microradians, roughly the angle a one-euro coin subtends at 600 metres.</p>
      <p>That residual does not stay an angle. Once the computed vertical is wrong by ψ, a component g·sin ψ lands in the horizontal channel as an acceleration that never happened: 39 µrad is 39 µg, and over ten minutes of coasting ½·b·t² puts you 69 m out. That is the floor the star tracker sets under everything else.</p>
      <p>It also explains why shortening the sighting interval eventually stops paying. Averaging n sightings divides the residual by √n, but leaves untouched the gyro random walk and, above all, the accelerometer errors that no sighting can observe.</p>`,
  },

  'tlm.profileBuilt': {
    title: 'Profile built',
    caption: 'Filed against the believed position, sounded under the true one.',
    labels: {
      profile: 'measured profile', samples: 'samples', step: 'spacing 120 m',
      span: '50 × 120 m = 6 km of ground track',
      caption: 'The whole profile is shifted by exactly the navigation error.',
    },
    body: `<p>How many ground samples sit in the buffer, out of the 50 the correlator wants before it will attempt anything. They are spaced by <em>distance</em>, not by time — 120 m apart — so that the length of the profile, and with it its power to localise, does not depend on how fast the vehicle happens to be going. Fifty points at 120 m is six kilometres of ground track.</p>
      <p>Each sample is filed against the position the computer <b>believes</b> it occupied, while the radar sounded the ground under the position it <b>actually</b> occupied. The profile is therefore displaced, as a whole, by exactly the navigation error. Recovering that displacement is the entire principle of the method.</p>
      <p>On a ballistic flight the buffer barely has time to fill: the vehicle only enters the band below 32 km in the final seconds, and the reference run reached 50 points fifteen seconds before impact — hence exactly one fix. A glider fills it early and keeps refilling it, which is the real reason terrain correlation belongs on a lifting body.</p>`,
  },

  'tlm.fixesRejects': {
    title: 'Fixes / rejects',
    caption: 'Three screens in series — the bus counts only the first two.',
    labels: {
      measurement: 'measurement',
      moduleGate: 'module screens',
      filterGate: 'filter gate (χ²)',
      applied: 'applied',
      rejected: 'rejected — never applied',
      expected: 'what the filter expects to see',
      innovation: 'innovation z = prediction − measurement',
      gateNote: '√30 ≈ 5.5 σ',
      outlier: 'dropped',
      caption: 'The gate tests plausibility, not correctness — it cannot tell them apart.',
    },
    body: `<p>Two counters kept by the correlation module itself. A correlation is rejected when the cost surface has no proper minimum — the curvature comes out negative — or when the uncertainty it would have to announce exceeds 1500 m. Both mean the same thing: the module could not tell where it was, and says so instead of guessing.</p>
      <p>A high reject rate is not a defect. A false fix does not merely fail to help: it injects a position error of its own size and hands it over with a small σ attached, which the filter will duly believe. Refusing is the correct behaviour. Over mixed terrain a navigation-grade glide keeps roughly two thirds of its attempts — 99 fixes against 53 rejects.</p>
      <p>A third screen sits downstream and appears nowhere on the bus. Before applying anything the filter forms the normalised squared innovation d² = zᵀS⁻¹z and drops the measurement if it exceeds 30 — 40 for a star sighting. That is a loose gate, √30 being 5.5 σ, and yet it fired 78 times on that same flight, every one an altimeter reading. In the last forty seconds it locked out a radar reading that was right to ±8 m, while the filter's own altitude was 127 m low and its claimed uncertainty ±20 m. The gate protects the filter from bad measurements; nothing protects it from itself.</p>`,
  },

  'tlm.contrast': {
    title: 'Contrast',
    caption: 'How far the winning offset stands out from all the others.',
    labels: {
      offset: 'trial offset [m]', cost: 'mismatch between profile and map',
      mean: 'mean over the search grid', min: 'sharp minimum',
      wrongMin: 'a minimum, but probably the wrong one',
      rugged: 'rough relief', flat: 'plain',
      contrast: 'contrast = (mean − minimum) / mean',
      rejectedOut: 'fix discarded',
      caption: 'A flat minimum is not an imprecise position: it is a position picked at random.',
    },
    body: `<p>A number between 0 and 1, recomputed at every correlation: (mean − minimum) / mean across the coarse search grid. It measures how far the winning offset stands out from every other candidate — in other words, whether the ground below has any signature at all.</p>
      <p>It decides the accuracy the module announces. The curvature of the minimum yields a least-squares σ, but curvature only means something if the minimum found is the <em>right</em> one. Over a plain every offset scores nearly the same, the winner wins by accident, and its local curvature says nothing about the real error. The code therefore divides σ by the contrast, with a floor at 0.08 that caps the penalty at ×12.5. Rough ground gives a contrast around 0.78 and ±325 m; a contrast of 0.09 pushes σ past the 1500 m limit and the fix is thrown away.</p>
      <p>Over the sea the elevation is identically zero: every offset scores exactly the same, contrast collapses, and no amount of extra profile will help. This field is the one that tells you whether terrain correlation can work here at all — before the miss distance tells you.</p>`,
  },

  'tlm.offsetFound': {
    title: 'Offset found',
    caption: 'The navigation error, measured from the inside.',
    labels: {
      measured: 'measured profile', map: 'onboard map',
      offset: 'offset that makes them coincide',
      believed: 'believed position', truth: 'true position',
      caption: 'Both profiles are centred first: a common altitude error cancels out.',
    },
    body: `<p>The east and north shift, in metres, that best aligns the measured profile with the onboard map. It is the navigation error seen from the inside — the only quantity aboard that <em>measures</em> that error rather than estimating it.</p>
      <p>It is expressed relative to the believed position, which is what makes it usable: added to that position it becomes a horizontal fix, handed to the filter as a two-component measurement. The filter does not simply move the position there. It distributes the correction across position, velocity, attitude and the bias states, in whatever proportions its covariance dictates — which is how a terrain fix ends up improving a gyro bias estimate.</p>
      <p>Both profiles are centred before matching, so a common altitude offset cancels. Terrain correlation therefore returns horizontal position and nothing else: a constant barometric error leaves the result untouched. That independence is exactly what one wants from a sensor whose job is to contradict the inertial solution.</p>`,
  },
};
