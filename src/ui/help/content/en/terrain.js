// Fiches terrain — anglais (reference).
//
// Le sujet du groupe : le seul capteur qui rende une POSITION, et dont la
// precision ne se regle pas — elle resulte du relief survole.
export default {
  'sensor.terrain': {
    title: 'Terrain correlation',
    caption: 'The shift that makes the two profiles coincide is the navigation error itself.',
    labels: {
      truePos: 'true position',
      believedPos: 'believed position',
      radar: 'radar altimeter',
      map: 'onboard map',
      filed: 'filed where it believes it is',
      matched: 'slid until it matches',
      offset: 'offset found = navigation error',
      ssd: 'Σ (differences)²',
      minimum: 'minimum',
    },
    body: `<p>The radar altimeter reads the height of the ground below, one sample every 120 m of track — spaced by <em>distance</em> and not by time, so the profile does not shrink when the vehicle flies faster. Fifty of them make a 6 km strip of relief. The computer files each sample against the position it <em>believes</em> it occupies, then slides the whole strip across its onboard map until the sum of squared differences is smallest. The shift that achieves the match is precisely the gap between belief and truth.</p>
      <p><b>It is the only sensor here that returns a position.</b> The star tracker measures attitude, the altimeter returns a single number; this one returns east and north. One detail makes it robust: both profiles are mean-centred before comparison, so a constant altitude error — the computer wrong about its own height — cancels out completely. Only the horizontal shift survives.</p>
      <p><b>Accuracy is not a setting.</b> The uncertainty announced with each fix is computed from the curvature of that minimum, then inflated by how far the best offset stands out from all the others — the <em>contrast</em>. Over rugged ground the minimum is sharp and the contrast approaches 0.9. Over a plain every offset fits about as well, the minimum flattens, and the announced figure grows until the fix is discarded. Over the sea the profile is exactly flat, the curvature is zero, and the module returns nothing at all.</p>
      <p>The scale of the thing is worth holding on to: along 6 km of plain the ground rises and falls by some <b>2 m rms</b> — less than the error of the onboard map. There is simply nothing there to recognise.</p>`,
  },

  'terrain.mapError': {
    title: 'Onboard map fidelity',
    caption: 'An error that does not average out sets a floor the rest cannot cross.',
    labels: {
      ground: 'true ground',
      map: 'onboard map',
      wavelength: 'map error: a kilometre-scale undulation',
      profile: 'profile:',
      variance: 'measurement variance',
      mapShare: 'map',
      radarShare: 'radar',
    },
    body: `<p>How well the stored map matches the ground it claims to describe. ±12 m by default; the slider runs from 1 m to 200 m. In the simulator the map is the true relief plus an undulation of kilometre wavelength — the error of a real survey, <em>correlated in space</em>, not a scatter of independent mistakes.</p>
      <p>That distinction decides everything. The radar's white noise averages down as 1/√n over the samples of the profile; the map error is very nearly the same beneath the whole strip, so it survives untouched however long the profile grows. Both enter the announced uncertainty through <b>σ² = radar² + map²</b> — at the defaults, 6² + 12², or 13.4 m, of which <b>the map alone is 80 % of the variance</b>. Halving the map error buys far more than halving the radar noise.</p>
      <p>It is also why the module applies a further factor of 1.4 to everything it announces. The least-squares curvature that gives the uncertainty assumes independent errors; a spatially correlated map error breaks that assumption, and without the correction the fix would arrive looking better than it is. A Kalman filter that is lied to about the quality of a measurement over-weights it and degrades.</p>`,
  },

  'terrain.radarSigma': {
    title: 'Radar altimeter noise',
    caption: 'The same noise is nothing over a massif and everything over a plain.',
    labels: {
      rugged: 'rugged ground',
      plain: 'plain',
      reliefSd: 'relief over 6 km:',
      ratio: 'relief / noise ratio',
      noise: 'radar noise',
      caption: 'Same vertical scale, same noise — only the relief differs.',
    },
    body: `<p>The white noise added to each height reading, ±6 m by default, adjustable from 0.5 m to 60 m. Unlike the map error it is drawn afresh at every sample, so it averages down along the profile.</p>
      <p>What matters is not its size in metres but its size <em>compared with the relief</em>. Measured on the synthetic terrain along a 6 km profile: about <b>±24 m rms over a massif, ±2 m over a plain</b>. At the default setting the massif's signature stands four times above the noise while the plain's is buried beneath it — and that single ratio, not any accuracy setting, is what makes the module work in one place and fail in the other.</p>
      <p>The failure is not silent. The noise enters the announced uncertainty directly, so degrading the altimeter inflates every σ the module reports; past the 1500 m ceiling the fix is discarded. Set the noise to 30 m on a flight that worked at 6 m and the correlator keeps computing and stops answering — every attempt rejected, the counter of rejects climbing while the counter of fixes stays at zero.</p>`,
  },

  'terrain.samples': {
    title: 'Profile length',
    caption: 'A short profile is ambiguous: several places in the relief look like it.',
    labels: {
      short: 'short profile:',
      long: 'your setting:',
      trueOffset: 'true offset',
      offset: 'offset tried',
      ssd: 'Σ (differences)²',
      count: 'marked minima, short / yours:',
      caption: 'Lengthen the profile and the false minima rise. One survives.',
    },
    body: `<p>The number of points held in the rolling profile — 50 by default, spaced 120 m apart, so 6.0 km of track. The slider runs from 10 to 120 points, that is from 1.2 km to 14.4 km.</p>
      <p><b>This is where ambiguity lives.</b> One kilometre of relief resembles a great many other kilometres, and the correlation then shows several minima of comparable depth with nothing to designate the right one. The figure computes them: eight points give three candidate minima and the deepest is not the true offset; past about twenty the false ones have risen and a single minimum remains. Lengthening the profile does not sharpen the answer so much as it removes the competitors.</p>
      <p>Measured across a glider flight, the uncertainty the module announces follows directly: <b>15 points → about 475 m, 50 points → 250 m, 100 points → 125 m</b>. The price is patience — nothing is returned until the buffer is full, so the first fix waits for n × 120 m of track, and a long profile answers for the average of the positions it spans rather than for the present one. A turn during accumulation costs nothing, however: each point keeps its own coordinates and the whole set is translated rigidly.</p>`,
  },

  'terrain.period': {
    title: 'Interval between fixes',
    caption: 'Between two fixes nothing stops the inertial drift from resuming.',
    labels: {
      time: 'time',
      error: 'position error',
      fix: 'fix',
      period: 'interval',
      caption: 'Each fix caps the drift; between them it grows again.',
    },
    body: `<p>How long the module waits before attempting another correlation — 6 s by default, adjustable from 1 s to 60 s. Between two fixes the inertial drift resumes, so the interval sets how tightly it is capped.</p>
      <p>Fixes are not free. Each one is a two-stage grid search: a coarse sweep over ±600 m to ±2 km, then a fine sweep at 12 m steps, and every trial offset re-reads the map under all n points of the profile — thousands of map lookups per fix. The search span is bounded by three times the uncertainty the filter announces, which is what makes later fixes cheap. It also means the correlator only looks where the filter already suspects it might be: a navigation error grown past ±2 km cannot be found at all, and the strip will match <em>somewhere</em>, with an honest-looking figure attached.</p>
      <p>Shortening the interval below the time it takes to renew the profile buys less than it appears to. At 6 s and 2 km/s the vehicle covers 12 km, twice the profile length, so consecutive fixes share no data. At 1 s, five sixths of the profile is common to both — and so is the map error beneath it. The filter treats each fix as fresh evidence and grows confident on repeated readings of the same error.</p>`,
  },

  'terrain.maxAlt': {
    title: 'Maximum working altitude',
    caption: 'The band decides which vehicle can use the module at all.',
    labels: {
      ceiling: 'ceiling',
      floor: 'floor',
      glider: 'glider',
      rv: 're-entry body',
      inBand: 'inside the band:',
      toImpact: 'time to impact',
      altitude: 'altitude',
      caption: 'Horizontal axis: seconds before impact. The band is the whole opportunity.',
    },
    body: `<p>The top of the working band, 32 km by default, adjustable from 3 km to 40 km; the floor sits at 300 m. Outside the band nothing is recorded — no profile accumulates and no fix can be attempted.</p>
      <p>What sets the ceiling in reality is the radar altimeter: reaching the ground from 32 km is already a generous claim, and the simulator's own altimeter module stops its radar channel at 15 km. The model does not degrade the reading with height — there is no beam footprint smearing the profile — so raising the ceiling only opens the window earlier. It is a statement about the hardware you assume you carry, not accuracy for free.</p>
      <p><b>The band is also what decides the choice of vehicle.</b> Over a full flight the glider spends some <b>380 s</b> inside it, most of that in a shallow final descent while it is still manoeuvring, and collects two hundred fixes. The two-stage ballistic vehicle crosses the same band in about <b>18 s</b> on the way down, at several km/s, and gathers two — by which time it has no control authority left to use them. This is the module to switch on with a glider, and to leave off with a re-entry body.</p>`,
  },
};
