// Fiches « bandeau de vol » — anglais (reference).
//
// Le bandeau melange deux natures de nombres que rien ne distingue a l'oeil :
// des grandeurs vraies, qu'aucun instrument de bord ne pourrait produire, et
// ce que le calculateur croit. Chaque fiche doit dire de quel cote elle tombe.
export default {
  'hud.altitude': {
    title: 'Altitude',
    caption: 'Every fix has its own slice of sky.',
    labels: {
      time: 'flight time', altitude: 'altitude [km]',
      star: 'star tracker', baro: 'barometer', radar: 'radio altimeter',
      blind: 'nothing answers here',
      offscale: 'off the frame — apogee',
      crossing: 'crossed in',
      aboveStar: '90 % of the flight above 45 km',
      caption: 'Altitude decides which sensors are still awake.',
    },
    body: `<p>Height above the reference ellipsoid, computed from the <em>true</em> position — not the height above the ground below. Over a 900 m plateau the radio altimeter reads 900 m less than this figure, and that difference is exactly what terrain correlation lives on.</p>
      <p>Altitude is also the switchboard of the whole sensor suite. Each module has its slice: the star tracker sees nothing below 45 km, the barometer is dropped above 32 km, the radio altimeter reaches 15 km, terrain correlation works between 300 m and 32 km. Between 32 and 45 km, therefore, <b>nothing answers at all</b> — a gap that falls out of the default settings rather than from any deliberate design.</p>
      <p>The two kinds of vehicle treat that gap in opposite ways. A ballistic vehicle crosses it in about seven seconds on the way up and spends 90 % of its 865 s flight above 45 km, where the star tracker is its only witness. A glider cruises between 25 and 60 km for a quarter of an hour, straddling the band — which is why terrain correlation is its business and not a re-entry body's.</p>`,
  },

  'hud.speed': {
    title: 'Speed',
    caption: 'Motionless on the pad, the vehicle is already doing 411 m/s.',
    labels: {
      time: 'flight time', speed: 'speed [km/s]',
      floor: "Earth's rotation at 28° N —",
      burnout: 'cut-off', apogee: 'apogee', impact: 'impact',
      brake: 'the atmosphere takes back 3.3 km/s in 25 s',
      caption: 'Inertial speed: it starts above zero and never returns to it.',
    },
    body: `<p>Magnitude of the velocity in the inertial frame. On the pad, perfectly still, the panel already reads 411 m/s: a launch site at 28° N is carried eastward by the Earth's rotation at 465·cos φ. This is not a display artefact but genuine momentum — the firing solution counts on it, and the launch azimuth is bent by it.</p>
      <p>The curve never comes back to zero either. At apogee, 586 km up, 2.97 km/s remain — three quarters of the 3.99 km/s at cut-off — because a ballistic trajectory is an arc of an orbit, and its horizontal component survives the whole flight. Only the atmosphere takes it back: 4.28 km/s at 48 km, 0.95 km/s at the ground, twenty-five seconds later.</p>
      <p>One caution. This is speed with respect to the inertial frame, whereas drag, Mach and dynamic pressure are computed against the <em>air</em>, which turns with the planet. The two differ by up to 465 m/s depending on heading, which is why this figure and the Mach number never quite tell the same story.</p>`,
  },

  'hud.mach': {
    title: 'Mach number',
    caption: 'Speed of sound against altitude; drag coefficient against Mach.',
    labels: {
      sound: 'speed of sound [m/s]', altitude: 'altitude [km]',
      mach: 'Mach', drag: 'drag coefficient',
      warm: 'stratopause, 271 K', cold: 'mesopause, 187 K',
      peak: 'transonic peak', floorCd: 'hypersonic',
      example: 'On the way down, 4.17 km/s at 103 km reads Mach 14.2;',
      example2: '4.28 km/s at 49 km — faster — reads Mach 12.2.',
      caption: 'Mach measures compressibility, not speed.',
    },
    body: `<p>Air-relative speed divided by the local speed of sound. That speed depends on temperature alone — 340 m/s at sea level, 295 m/s through the tropopause, 330 m/s at the stratopause near 50 km where ozone warms the air, back down to 274 m/s at 86 km.</p>
      <p>Hence a reading that surprises on the way down: between 103 km and 49 km the panel shows the speed <em>rising</em>, 4.17 to 4.28 km/s, while Mach <em>falls</em> from 14.2 to 12.2. Nothing has slowed down; the air has simply become 84 K warmer. Above 100 km the panel stops showing the number altogether — there is no longer enough air for it to mean anything.</p>
      <p>Why carry it at all: in this simulator the drag coefficient is a function of Mach and of nothing else. It triples across the transonic region — 0.15 subsonic, 0.44 at Mach 1.05 — before settling at 0.19 in hypersonic flight. That hump, crossed around T+20 s, is a toll paid once and never recovered.</p>`,
  },

  'hud.dynPressure': {
    title: 'Dynamic pressure',
    caption: 'A collapsing density multiplied by a rising speed.',
    labels: {
      altitude: 'altitude [km]', pressure: 'dynamic pressure [kPa]',
      density: 'density', speed: 'air-relative speed',
      limit2: 'angle of attack ≤ 2°', limit6: '≤ 6°',
      reentry: 'On re-entry, 1.3 MPa around 11 km — thirteen times the ascent peak.',
      caption: 'Without dynamic pressure, no control surface bites.',
    },
    body: `<p><b>½ρv²</b>, the pressure the airflow exerts. Density falls by a factor of three over the first 10 km and by fourteen over 20 km, while speed climbs steadily: the product therefore has a sharp maximum — <b>98 kPa around 11 km, at T+32 s</b>, a tonne per square metre of frontal area.</p>
      <p>It governs manoeuvre authority from both ends. Above, the computer's own limiter clamps the angle of attack to 2° beyond 20 kPa and to 6° beyond 5 kPa; asking for more would break the airframe. Below, no control surface bites at all, which is the whole predicament of a glider: holding its best-finesse angle of attack, it descends until it finds the density that carries it and settles near 20 kPa. Its altitude is a consequence, never a setting.</p>
      <p>The ascent peak is not the flight's maximum. Coming back in at 4.3 km/s, a re-entry body reaches <b>1.3 MPa around 11 km</b> — thirteen times as much, and 35 g of deceleration with it.</p>`,
  },

  'hud.accel': {
    title: 'Acceleration',
    caption: 'The field reads zero for most of the flight.',
    labels: {
      time: 'flight time', accel: 'specific force [g]',
      boost: 'cut-off', reentry: 're-entry',
      freefall: 'free fall — the accelerometers read nothing',
      note: 'A residual 0.15 m/s at cut-off becomes about 90 m over the coast, unseen.',
      caption: 'What the accelerometers read, not the acceleration.',
    },
    body: `<p>Magnitude of the <em>specific force</em>, in g — what the accelerometers read, which is everything except gravity. Hence a field that shows exactly zero for 713 of the 865 seconds of the reference flight, precisely while the vehicle is falling towards the Earth at nearly 9 m/s². Nothing is broken: an instrument in free fall has nothing to measure.</p>
      <p>During boost it climbs from 2.6 to 10.5 g. Thrust is constant — it even rises slightly with altitude, since ambient pressure stops pushing back on the nozzle exit — while the mass falls with the propellant burnt. The peak is therefore always at cut-off, never at lift-off.</p>
      <p>The long silent stretch is not harmless, though. Whatever the unit carries into it — 0.15 m/s of residual velocity error at cut-off on the reference flight — is integrated straight, uncorrected, and becomes some 90 m of position error over the coast. No accelerometer reading during those twelve minutes could have revealed it.</p>`,
  },

  'hud.fpa': {
    title: 'Flight path angle',
    caption: 'It crosses zero exactly once: at apogee.',
    labels: {
      horizon: 'local horizontal', up: 'local vertical', velocity: 'velocity',
      time: 'flight time', angle: 'path angle',
      apogee: 'apogee: γ = 0', climb: 'climb', descent: 'descent',
      caption: 'Positive climbing, negative descending — nothing else.',
    },
    body: `<p>Angle between the velocity vector and the local horizontal, <b>sin γ = r̂·v̂</b>. Positive climbing, negative descending, and zero at exactly one instant — that instant is the definition of apogee.</p>
      <p>On the pad it reads 0.0°, since the only velocity there is the Earth's entrainment, and that is horizontal. It then reaches 78° at the end of the gravity turn, is back down to 37° at cut-off, crosses zero at T+452 s and arrives at −41° at the top of the atmosphere. For a minimum-energy shot the departure angle obeys a closed formula, 45° − ψ/4 with ψ the ground arc: 40.7° for 1912 km, which the code's own tests check to within 0.02°.</p>
      <p>For a glider the number tells the whole story. After pull-up it hovers around −1° for 2350 km, swinging a few degrees either side — the phugoid, the vehicle bouncing gently off the atmosphere. The small damping term subtracted from the commanded angle of attack exists for no other reason than to stop those swings from growing.</p>`,
  },

  'hud.downrange': {
    title: 'Distance flown',
    caption: 'Measured along the ground, not along the trajectory.',
    labels: {
      launch: 'launch', target: 'target', vehicle: 'apogee',
      downrange: 'flown', toGo: 'to go', straight: 'in a straight line',
      sum: 'true only while it stays on the route',
    },
    body: `<p>Great-circle distance from the launch site to the point on the ground beneath the vehicle, on a sphere of mean radius 6371 km. Neither the altitude nor the path actually flown enters into it.</p>
      <p>The difference is not small. At apogee of the reference flight the panel reads 892 km while the vehicle is 1100 km from the pad in a straight line — 23 % more — and has covered more still along its arc. This is a bookkeeping figure for the ground track, and only that.</p>
      <p>It is computed from the <em>true</em> position, so it belongs to the observer and not to the vehicle. The computer has its own version, drawn from its estimate and differing by the navigation error, and it is that version — never this one — which decides when to shut the engine down.</p>`,
  },

  'hud.toGo': {
    title: 'Distance to go',
    caption: 'The two arcs add up to the range only while the vehicle stays on its route.',
    labels: {
      launch: 'launch', target: 'target', vehicle: 'apogee',
      downrange: 'flown', toGo: 'to go', straight: 'in a straight line',
      sum: 'true only while it stays on the route',
    },
    body: `<p>The same great-circle measure, taken from the point beneath the vehicle to the target. On the reference flight, 892 km flown and 1021 km to go add up to exactly the 1912 km of the shot — which is what a vehicle sitting on its direct route looks like.</p>
      <p>Any lateral deviation breaks the sum: two sides of a triangle always exceed the third, so the excess over the total range is a crude but honest read-out of the cross-track error. It is worth watching while a glider burns off surplus energy in S-turns.</p>
      <p>By itself the number decides nothing. A ballistic vehicle cuts off on the range of its <em>predicted</em> impact point, not on the distance remaining. For a glider, though, it is a threshold: inside 45 km the guidance switches to terminal pursuit and points the velocity vector at the target; inside 6 km it releases the bank, because correcting laterally at that point costs more range than it recovers.</p>`,
  },

  'hud.navError': {
    title: 'Navigation error',
    caption: 'The gap is drawn exaggerated — a few hundred metres over 1900 km would not show.',
    labels: {
      truth: 'true trajectory', estimate: 'what the computer believes',
      cutoff: 'cut-off', atCutoff: 'the two states already differ',
      gap: 'miss = navigation error',
      blindNote: 'the guidance reads only this curve',
      blindNote2: 'the true one is unknown aboard',
      caption: 'Nothing aboard could produce this number.',
    },
    body: `<p>Distance between where the vehicle really is and where its computer believes it is. <b>This number does not exist aboard.</b> It is shown because this is a simulation; a real vehicle would carry no instrument capable of producing it. The rule is enforced in the code itself: the flight computer is handed the inertial estimate, never the true state.</p>
      <p>Which means the miss at arrival essentially <em>is</em> this error. For a glider, which steers to the last kilometre, the two are nearly the same number: 158 m of navigation error and 158 m of miss on a terrain-aided flight.</p>
      <p>For a ballistic vehicle it is subtler, because everything is settled at cut-off. There the unit was off by 4 m in position and 0.15 m/s in velocity. Range responds to a cut-off velocity error by roughly <b>2R/v</b> — 960 m per m/s here — so those 15 cm/s alone account for 144 m of the 382 m miss. The 142 m the panel shows at impact accumulated afterwards, during a descent in which the vehicle no longer steers: a spectator's number.</p>`,
  },

  'hud.navSigma': {
    title: 'Reported uncertainty',
    caption: 'What the filter believes about itself — not what it is.',
    labels: {
      time: 'flight time', error: 'position error', fix: 'a fix',
      announced: 'reported uncertainty', trueError: 'true error',
      note: 'Nothing aboard can compare the two curves.',
      caption: 'A filter more confident than it deserves is a genuine failure mode.',
    },
    body: `<p>The Kalman filter's own opinion of its position error: the square root of the trace of the position block of its covariance. Nothing measures it; it is deduced from the noise model the filter was given before launch.</p>
      <p><b>Comparing it with the line above is the central gesture of this simulator.</b> On the reference flight the filter announces 102 m and is 142 m out. On a 6700 km shot it announces 304 m and is 601 m out — a factor of two.</p>
      <p>The over-confidence has traceable causes. The filter is tuned from the <em>specification</em> of the unit, never from the biases actually drawn for this flight; scale-factor errors are not among its fifteen states, merely provisioned as process noise; the barometer's bias is not modelled at all — a constant offset that looks exactly like a real altitude. When the true error exceeds three times the reported figure, the flight report says so in as many words.</p>
      <p>The reverse is a failure too. With terrain correlation running, the filter may announce 216 m while being 158 m out. A pessimistic filter throws away accuracy it already has; an over-confident one keeps its consistency gate too tight and starts refusing perfectly good fixes.</p>`,
  },

  'hud.attError': {
    title: 'Attitude error',
    caption: 'What an attitude error costs is proportional to what the vehicle feels.',
    labels: {
      trueAxis: 'true axis', believedAxis: 'believed axis',
      phase: 'phase', force: 'specific force', leak: 'into the wrong axis',
      phaseBoost: 'boost', phaseCoast: 'free fall', phaseReentry: 're-entry',
      note: 'In free fall the error costs nothing — and keeps growing.',
      caption: 'A star sighting measures attitude before attitude becomes expensive.',
    },
    body: `<p>Angle between the true attitude and the believed one, in arcminutes. Just after lift-off it is simply what the initial alignment left behind — about 0.8′ for a navigation-grade unit — and star sightings take it down to a tenth of that.</p>
      <p>Its cost is not constant: it is proportional to the specific force. The filter says so literally, since the block coupling attitude to velocity is −[f×]. Mis-resolving a measured force f by ψ pours <b>f·sin ψ</b> into the wrong axis. Under 4 g of thrust, one arcminute is 1.2 mg of phantom acceleration — nearly fifty times the accelerometer's own 25 µg bias.</p>
      <p>Hence the pattern the diagram shows. In free fall the error costs nothing at all, f being zero; but it keeps growing on gyro bias throughout, and it is waiting there for the next time the vehicle feels something — a mid-course burn, or re-entry at 35 g. That is the entire argument for carrying a star tracker.</p>`,
  },

  'hud.starFixes': {
    title: 'Star sightings',
    caption: 'A sighting buys attitude, never position.',
    labels: {
      time: 'flight time', altitude: 'altitude', minAlt: 'visibility floor',
      occulted: 'below it, nothing to see', sighting: 'sighting taken',
      tally: 'running tally',
      caption: 'Above the dense air, and only there.',
    },
    body: `<p>Number of sightings taken since lift-off. The tracker attempts one every 20 s by default, and only above 45 km, where the air is thin enough to pick out a star in daylight: 40 sightings over the 865 s reference flight, which is essentially the whole coast.</p>
      <p>What it buys is attitude and attitude only. No star tells the vehicle where it is. But by holding ψ down it removes the term of the position error that grows as the <em>cube</em> of flight time, and on any long flight that term dominates everything the accelerometers contribute.</p>
      <p>Read the counter as attempts rather than successes: it is incremented when the measurement is produced, upstream of the filter's consistency test. A sighting can be counted here and still be refused downstream. The flight report separates the two.</p>`,
  },

  'hud.terrainRugged': {
    title: 'Ground relief',
    caption: 'Flat ground carries no information — and the sea carries none at all.',
    labels: {
      offset: 'offset tried [m]', cost: 'mismatch cost',
      mean: 'average over the search', min: 'true minimum',
      wrongMin: 'a minimum — but the wrong one',
      rugged: 'rugged ground', flat: 'plain', rejectedOut: 'discarded',
      contrast: 'Contrast: how far the best offset stands out from the rest.',
      caption: 'The precision of a fix is a property of the ground, not of the hardware.',
    },
    body: `<p>Ruggedness of the ground under the true position, from 0 to 100 %, read straight from the terrain generator. Over water it is identically zero, because the elevation is.</p>
      <p>It is a precondition, not a comfort. Relief amplitude follows 40 + 4000·r² metres: 270 m at 24 %, 1040 m at 50 %, more than 3 km at 90 %. Below that, the correlation's minimum goes flat — every candidate offset fits about as well as the next, and nothing singles out the right one.</p>
      <p>The code turns this into a figure it calls contrast and divides the reported precision by it: a poorly contrasted correlation announces a large uncertainty, and beyond 1500 m the fix is discarded. Over a plain or over the sea the module keeps running and returns nothing, which is the honest behaviour — a confident answer there would be worse than silence.</p>`,
  },

  'hud.terrainFixes': {
    title: 'Terrain fixes',
    caption: 'Refusals are the module working, not failing.',
    labels: {
      measurement: 'correlation', moduleGate: 'module check',
      filterGate: 'filter gate', applied: 'fix applied',
      rejected: 'only the first refusal reaches the panel',
      expected: 'what the filter expects', gateNote: 'gate', outlier: 'outlier',
      innovation: 'innovation: prediction − measurement',
      caption: 'A fix produced is not yet a fix applied.',
    },
    body: `<p>Accepted fixes over attempted correlations. On a glide across varied ground: 81 out of 240.</p>
      <p>Each correlation deduces its own precision from the sharpness of the minimum it found, corrected by the contrast of the ground beneath. If the result exceeds 1500 m the fix is thrown away rather than fed to the filter. Two thirds refused is not a malfunction; it is the module declining to answer where the ground has nothing to say.</p>
      <p>A second filter sits downstream, and this counter does not show it: the Kalman consistency gate can still reject a fix the correlator was happy with. What is counted here is a fix <em>produced</em> — not necessarily a fix applied.</p>`,
  },
};
