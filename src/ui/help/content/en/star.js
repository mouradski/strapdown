// Fiches « viseur stellaire » — anglais (reference).
//
// Fil conducteur du groupe : le viseur ne donne AUCUNE position, et c'est
// pourtant le recalage le plus rentable d'un vol sans satellite.
export default {
  'sensor.star': {
    title: 'Star tracker',
    caption: 'The same star, seen from two places a thousand kilometres apart.',
    labels: {
      star: 'a star — at infinity',
      parallel: 'parallel sightlines',
      apart: '1000 km apart',
      noPosition: 'no position information',
      trueRay: 'where the star really is',
      expectedRay: 'where the computer expected it',
      attitudeOnly: 'the attitude error, measured',
    },
    body: `<p>Every twenty seconds by default, and only above 45 km, the tracker looks at the sky, recognises what it sees, and hands the filter an attitude — perturbed by a few arcseconds of noise drawn afresh each time. The filter uses it in a three-row update that touches the three attitude states and nothing else.</p>
      <p><b>It gives no position, and it cannot.</b> Stars are, for this purpose, infinitely far away: displace yourself by a thousand kilometres and the nearest of them moves by about five millionths of an arcsecond — a million times below the sensor's own noise. The two sightlines in the diagram are parallel, and a parallel pair carries no information about which end of the baseline you are standing on.</p>
      <p>What it does measure is the gap between where the star actually is and where the computer, trusting its own attitude, expected to find it. That gap <em>is</em> the attitude error. And attitude is what drives the worst term of the drift: a tilt ψ makes the computer mis-resolve gravity, <em>g·sin ψ</em> leaks into the horizontal channel, and since ψ grows linearly the position error grows as <b>t³</b>. Pin the attitude every twenty seconds and ψ stops growing — the cubic term goes with it, leaving only the accelerometer's t². Ten runs of the same shot: about 125 m of final navigation error with the tracker, about 500 m without.</p>
      <p>One consequence is less obvious. The measurement touches only attitude, yet position improves too. The covariance is not diagonal: the filter has been accumulating the correlation between the tilt and the position error that tilt produced, so the gain <em>K = P·Hᵀ·S⁻¹</em> spreads a purely angular observation into position, velocity and the estimated gyro bias. Watching that bias estimate settle after the first few sightings is the same mechanism seen from the other side.</p>`,
  },

  'star.sigma': {
    title: 'Sighting accuracy',
    caption: 'Three angular errors on one scale, all read from your current settings.',
    labels: {
      alignment: 'initial alignment',
      sighting: 'one star sighting',
      drift: 'gyro drift between two sightings',
      verdictQuiet: 'Drift stays under the noise — a tighter interval buys nothing.',
      verdictLoud: 'Drift outruns the noise — the interval is what limits you.',
      axis: 'angular error, log scale',
      conversion: '1″ = 4.85 µrad = 4.85 µg',
    },
    body: `<p>The one-sigma error of a single sighting, in arcseconds, adjustable from 0.5″ to 200″. An arcsecond is 4.85 microradians — a one-euro coin seen from five kilometres.</p>
      <p>To make that tangible, convert it the way the vehicle feels it. An attitude error ψ mis-resolves gravity by g·sin ψ, which relative to g is simply ψ: <b>one arcsecond is worth 4.85 µg</b>. The default 8″ therefore leaves 39 µg of phantom acceleration — more than the 25 µg bias of the navigation-grade accelerometer sitting beside it. Held for ten minutes, 39 µg alone would put you 68 m out.</p>
      <p>It is not held, though, and that is the whole difference. The code draws a new three-axis Gaussian at every sighting, so this is noise, not bias: forty sightings average it down by √40, while an accelerometer bias never averages down at all. A mediocre tracker used often beats a good one used rarely.</p>
      <p>The diagram places σ between the two angles it has to beat. Above it, the arcminute-class alignment the flight started with — that is what the first sighting throws away. Below it, the drift the gyro accumulates between two sightings. As long as that third bar stays shorter than σ, the sighting noise is what limits you and the cadence is irrelevant.</p>`,
  },

  'star.period': {
    title: 'Interval between sightings',
    caption: 'Two cadences, the same floor.',
    labels: {
      time: 'time',
      error: 'error',
      slow: 'long interval',
      fast: 'short interval',
      floor: 'floor: the fix\'s own noise',
      age: 'age of the last fix',
      caption: 'Halving the interval halves the ramp — never the floor.',
    },
    body: `<p>The tracker refuses a sighting until the interval has elapsed: 20 s by default, adjustable from 2 s to 180 s. Between two sightings the attitude runs open loop and drifts at the gyro's own rate.</p>
      <p>The conversion is unusually clean: <b>one degree per hour is exactly one arcsecond per second</b>. A navigation-grade gyro at 0.01 °/h therefore tips by 0.01″ per second — 0.2″ over the default interval, forty times less than the 8″ noise of a single sighting. The interval at which the drift would finally match the noise is σ/b = 800 s, longer than most of the flight. Cutting from 20 s to 2 s, ten times as many sightings, moves the mean final error from 124 m to 110 m.</p>
      <p>Change the unit class and the arithmetic inverts. A tactical gyro at 1 °/h reaches 8″ in eight seconds: the default cadence is already too slow, and every second of interval costs. A consumer unit at 150 °/h gets there in a twentieth of a second — no cadence saves it.</p>
      <p>The general shape is on the diagram. The error just before a fix goes roughly as √(σ² + (b·T)²): halving T halves the ramp but never touches the floor, and below the break-even you are only re-measuring the same noise. The age of the last reading, shown in telemetry, tells you where on that ramp you currently stand.</p>`,
  },

  'star.minAlt': {
    title: 'Minimum sighting altitude',
    caption: 'The threshold cuts the altitude scale in two, and decides who lives above the line.',
    labels: {
      threshold: 'sighting floor:',
      ceiling: 'barometer and terrain ceiling:',
      murk: 'scattered daylight drowns the stars',
      coast: 'ballistic coast',
      glide: 'glide cruise',
    },
    body: `<p>Below this altitude the tracker returns nothing at all. The reason is photometric rather than mechanical: in daylight the air scatters sunlight into a background far brighter than any star, and the star has to be picked out of it. The default 45 km is where the pressure has fallen to 149 Pa, 0.15 % of sea level — 99.85 % of the atmosphere's mass is already beneath you. The slider spans 20 km to 120 km.</p>
      <p>For a ballistic shot the threshold costs little but not nothing. On the default 1900 km mission the sky opens at T+59 s and closes again at T+841 s, 23 s before impact: 40 sightings, and the blind stretch at the start covers the whole of the first stage and the pitch-over — the most dynamic minute of the flight, precisely when the gyros' scale-factor errors are at their worst.</p>
      <p>For the boost-glide vehicle it decides everything. The sky opens at T+92 s and closes at T+587 s, and the remaining <b>370 seconds — the entire glide — are flown without a single sighting</b>. Whatever attitude error stands at that last sighting is what the vehicle carries all the way to the ground. Raise the threshold to 70 km and the glider never sights again after pull-up.</p>
      <p>One structural detail worth noticing: the barometer and the terrain correlator both stop at 32 km, the tracker starts at 45 km. Between the two lies a 13 km band where no aiding source works at all — and a descending vehicle crosses it every time.</p>`,
  },
};
