// Fiches « altimetre » — anglais (reference).
//
// Meme structure que le groupe imu : title / caption / labels / body. Les
// `labels` sont TOUS les textes dessines dans le schema — le SVG n'en contient
// aucun en dur. Les cles doivent rester identiques en anglais et en francais.
export default {
  'sensor.alt': {
    title: 'Altimeter',
    caption: 'Which instrument answers, at which altitude — and when.',
    labels: {
      whereTitle: 'Which instrument answers, by altitude',
      whenTitle: 'When it answers, over the flight',
      radar: 'radio altimeter',
      baro: 'barometer',
      silence: 'no reading',
      noBias: 'no bias',
      bias: 'bias',
      ballistic: 'ballistic',
      glider: 'glider',
      cutoff: 'cut-off',
      silent: 'silent',
      lastSeconds: 'the last 20 seconds',
      steering: 'the glider is still steering inside the band',
      sealed: 'the ballistic vector was sealed at cut-off',
    },
    body: `<p>Two instruments behind one switch. Below 15 km the radio altimeter answers, between 15 and 32 km the barometer, above 32 km nothing at all. One reading every half second, each of them a single scalar update whose sensitivity vector is the local vertical.</p>
      <p><b>An altimeter corrects one dimension out of three.</b> In a default run — navigation-grade unit, star tracker on — the computer's position is about 140 m from the truth at impact, of which less than 10 m vertical. The altimeter has flattened the vertical to nothing and left the horizontal untouched, and it is the horizontal that misses the target.</p>
      <p>That does not make it a passenger. The vertical is the unstable channel of an inertial system: an altitude error makes the computer use the wrong gravity, which grows the altitude error, which multiplies by <em>e</em> roughly every 570 s. Holding the altitude also trims the vertical velocity and the accelerometer bias, through the correlations the filter carries between its states.</p>
      <p>The timing is the trap. On the ballistic vector the barometer goes quiet some 52 s after launch, at 32 km, and speaks again only 20 s before impact — while cut-off, the instant that seals the whole trajectory, falls at T+113 s and 180 km, in the middle of the silence. The glider is the opposite case: it spends minutes below 32 km, still flying, and there the measured altitude feeds the guidance law directly.</p>`,
  },

  'alt.baroSigma': {
    title: 'Barometric noise',
    caption: 'Every reading of one flight, and their running average.',
    labels: {
      axisErr: 'reading − truth [m]',
      axisN: 'successive readings',
      truth: 'true altitude',
      radar: 'radio altimeter',
      baro: 'barometer',
      mean: 'running average',
      collapse: 'The average falls as σ/√n. A bias would not move.',
    },
    body: `<p>The standard deviation of the white noise added to each barometric reading — 120 m by default, adjustable from 5 to 800 m. A reading arrives every half second for as long as the vehicle is inside the barometric slice.</p>
      <p>Noise averages away: n readings divide it by √n. The twenty-eight readings collected climbing through that slice already bring 120 m down to 23 m, which is the collapsing envelope on the diagram. Of all the numbers on this panel, the noise figure is the least alarming.</p>
      <p>What σ really sets is not accuracy but <b>the weight of the vote</b>. The filter weighs a reading against its own uncertainty, K = P/(P+σ²). Early in flight, the radio altimeter having just pinned the altitude to a few metres, P is around 25 m² against σ² = 14 400 m²: a reading 120 m off then moves the estimate by twenty centimetres. Twelve minutes of free flight later, the unit's own vertical uncertainty has overtaken the barometer's, and the same reading is followed almost blindly.</p>
      <p>Which is why lowering σ is not free. That number is the only thing telling the filter how far to trust the instrument, and the barometer's bias is not among the fifteen error states. Declare 5 m on an instrument that is 60 m off, and the filter will track the atmosphere's error with great confidence.</p>`,
  },

  'alt.baroBias': {
    title: 'Atmosphere model bias',
    caption: 'One pressure, two altitudes: the model\'s and the day\'s.',
    labels: {
      axisP: 'pressure — logarithmic scale',
      axisH: 'altitude',
      measured: 'measured pressure',
      bias: 'bias',
      standard: 'standard atmosphere',
      real: 'the day\'s atmosphere',
      setting: 'setting',
      ofPressure: 'of pressure near 10 km',
      exaggerated: 'Deviation drawn exaggerated — one per cent would not show.',
    },
    body: `<p>In the code this is not a value but a <b>draw</b>: one sample of a normal law at initialisation, then held constant until impact. The setting is the standard deviation of that draw, 60 m by default. Every flight gets its own offset; a given flight keeps it from launch to impact.</p>
      <p>Where it comes from: a barometer measures a pressure and converts it through the US 1976 standard atmosphere — the very model the simulator uses elsewhere for drag. The real air is warmer or colder, the day's pressure field higher or lower. Near 10 km the scale height is about 6.5 km, so <b>one per cent of pressure error is 65 m of altitude</b>. The instrument is not wrong; the conversion is.</p>
      <p>This is the whole difference between a bias and a noise. Noise falls as 1/√n; a bias is identical on all n readings and never averages. Worse, the error vector has no barometric-bias state, so the filter accounts only for the noise: the more it reads, the more confident it becomes about an altitude that is wrong by the same amount every time. The consistency gate does not catch it either — it rejects beyond χ² = 30, that is 5.5 σ, or 660 m when σ is 120 m.</p>
      <p>Measured in the simulator: radio altimeter off, setting pushed to 400 m, a flight that draws −1 079 m ends up 967 m below the truth in the vertical, its horizontal error unchanged. And note <em>when</em> the bias enters — the vertical error at cut-off was 2 m. The barometer only wins the argument once the inertial unit's own uncertainty has grown past its σ, which is to say long after the trajectory was sealed.</p>`,
  },

  'alt.radar': {
    title: 'Radar altimeter',
    caption: 'The reach of a radio altimeter is really a duration.',
    labels: {
      band: 'radio altimeter band',
      ballistic: 're-entry body',
      glider: 'glider',
      vspeed: 'vertical speed',
      readings: 'readings',
      noSteer: 'no longer steers',
      steering: 'still steering',
      cutoffAbove: 'cut-off: 180 km, twelve minutes earlier',
      off: 'radio altimeter off — the barometer then answers down to the ground',
    },
    body: `<p>Below 15 km, when enabled, the radio altimeter takes priority over the barometer: σ 8 m and — the point — no bias at all. It measures a distance instead of interpreting a pressure, so there is no atmosphere model to be wrong about. Everything it gets wrong it gets wrong differently each time, and that averages.</p>
      <p>The reach is the catch, and it reads best as a duration: 15 km divided by the vertical speed. A re-entry body arrives at more than a kilometre per second — some twelve seconds inside the band, two dozen readings, every one of them after cut-off, when a ballistic body no longer steers. A glider crosses the same slice at a few hundred metres per second, stays the better part of a minute, and is still flying.</p>
      <p>This is why the flight report gives two navigation errors, one at cut-off and one at impact. Only the first one decided anything. The second is read after the altimeter has spent the last twenty seconds tidying up an altitude that no longer commands anything — and whatever it does there, the miss distance does not move by a metre.</p>
      <p>One modelling simplification worth knowing: here the radio altimeter returns an altitude above the ellipsoid rather than a height above the ground, as though the elevation beneath were perfectly known. Turning a height above the ground into a position is precisely the job of the terrain-correlation module, and there the map's own error has to be paid for.</p>`,
  },

  'alt.radarSigma': {
    title: 'Radar altimeter noise',
    caption: 'Every reading of one flight, and their running average.',
    labels: {
      axisErr: 'reading − truth [m]',
      axisN: 'successive readings',
      truth: 'true altitude',
      radar: 'radio altimeter',
      baro: 'barometer',
      mean: 'running average',
      collapse: 'The average falls as σ/√n. A bias would not move.',
    },
    body: `<p>The standard deviation of a radio altimeter reading, 8 m by default, adjustable from 1 to 120 m. This channel carries no bias term at all — the code writes a plain zero — so the whole error is noise, and noise is the kind of error that repeated measurement defeats.</p>
      <p>8 m against the barometer's 120 is a factor of fifteen: the thin green band against the wide amber scatter on the diagram. While the radio altimeter answers, the filter has effectively stopped listening to the barometer, since for a given uncertainty the weight of a measurement goes as 1/σ² — and 120²/8² is 225.</p>
      <p>But a σ is only worth what the number of readings makes of it, and a ballistic descent offers barely two dozen: 8/√24 is 1.6 m, far below anything that decides a miss. Tightening this slider changes almost nothing on a re-entry body — what remains at impact is horizontal. On a glider, which lives inside the band, it buys genuine altitude control.</p>
      <p>Do not confuse it with the setting of the same name in the terrain panel. That one is the noise of the ground profile the correlator matches against its map: same instrument, separate setting, and it acts on the sharpness of the correlation minimum rather than on the altitude.</p>`,
  },
};
