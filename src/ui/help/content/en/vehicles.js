// Fiches « vecteurs » — anglais (reference).
//
// Trois vecteurs, une seule question : ou se joue la precision. Les chiffres
// cites sont mesures en simulation (centrale de classe navigation) ou lus
// dans src/sim/vehicle.js.
export default {
  'veh.bal2': {
    title: 'Vehicle A — two-stage ballistic',
    caption: 'Two minutes of thrust decide what the next sixteen will do.',
    labels: {
      cutoff: 'Cutoff',
      cutoffNote: '120 s of thrust, then 950 s of free flight',
      apogee: 'apogee',
      sealed: 'The trajectory is sealed at cutoff',
      sealedNote: 'no control surface, no thrust, no seeker',
      target: 'target',
      atCutoff: 'at cutoff',
      exaggerated: 'divergence drawn exaggerated',
      caption: 'The whole flight hangs on one instant, 3 % of the way there.',
    },
    body: `<p>Two solid stages, 24.7 t at lift-off, some 7.2 km/s of ideal velocity increment, and a 600 kg re-entry body. Useful range 3600 km. Cutoff is not a stopwatch: at every cycle the computer solves the ballistic problem from the position it <em>believes</em> it occupies, predicts where the impact would fall, and shuts the engine down when that predicted range reaches the target's. One vehicle therefore covers every range up to its maximum, with no pre-set flight programme.</p>
      <p><b>After cutoff nothing can be retrieved.</b> No control surface, no thrust, no seeker: the rest of the flight is an ellipse fixed by one position and one velocity vector. Over 2890 km the engine burns for 120 s and the vehicle then coasts for 950. The precision of the shot is settled in the last milliseconds of that burn.</p>
      <p>The sensitivity is brutal and simple — roughly <b>2R/v</b>. Measured at 2890 km, cutoff at 4725 m/s, one extra m/s carries the impact point 1446 m further. And the second stage still pushes at 16 g when it stops, so <em>one millisecond of late cutoff is 0.16 m/s, hence 225 m at the target</em>. That is why the simulator shortens its integration step near cutoff, and why the computer extrapolates its criterion to shut down in the middle of a step.</p>
      <p>One correction is made before cutoff, and only before: the Kepler solution ignores re-entry drag, which always shortens the range. The computer simulates its own descent, sees the shortfall, and displaces its aim point beyond the target — 4.7 km here, reached in ten iterations. How deep the body sinks before the air bites is set by the ballistic coefficient, 3800 kg/m² (600 kg over 0.15 m²): peak deceleration 46 g at 1.7 MPa, 17 s spent below 30 km, ground contact at 970 m/s.</p>`,
  },

  'veh.bal3': {
    title: 'Vehicle B — three-stage ballistic',
    caption: 'The rule of thumb holds at 1000 km and lies by a factor of three at 13 000.',
    labels: {
      sensitivity: 'metres of range gained per m/s at cutoff',
      range: 'range [km]',
      vehA: 'vehicle A',
      vehB: 'vehicle B',
      measured: 'shots measured in the simulator',
      real: 'spherical Earth',
      flatRule: '2R/v — flat Earth',
      at: 'at',
      caption: 'The further the shot, the dearer each metre per second.',
    },
    body: `<p>Three stages, 66.7 t at lift-off, 10.5 km/s of ideal velocity increment, a 500 kg re-entry body, useful range 13 000 km. A shot to 11 800 km climbs to 1440 km of apogee and lasts 41 minutes, of which 3.4 are powered.</p>
      <p><b>Range is bought with precision, and the exchange rate worsens with distance.</b> The flat-Earth rule 2R/v is nearly exact at short range: 684 m per m/s predicted at 1060 km against 702 measured. At 13 000 km it announces 3.4 km and the truth is 10.1 — close to maximum range the trajectory approaches the limit where a small velocity increment sweeps a large range angle. Since the third stage is still accelerating at 14 g when it stops, <em>a millisecond of extra burn moves the impact point by 1.2 km</em>.</p>
      <p>Everything the inertial unit misjudges at that instant is multiplied by the same factor. A navigation-grade unit leaves about 0.4 m/s of velocity error at cutoff; a tactical unit leaves 1.3, and the miss grows by five kilometres. The flight also lasts 41 minutes, exactly the regime in which gyro drift — growing as the cube of time — takes over everything else: the star tracker gets 119 sightings on such a shot, and without them the vehicle would have no reason to exist.</p>
      <p>Its re-entry body is denser for its frontal area than vehicle A's: 6500 kg/m² against 3800, being 500 kg over 0.12 m². It sinks deeper before the atmosphere slows it, reaches 3.15 MPa of dynamic pressure and arrives at 1131 m/s. Drag still eats range, and the computer offsets it by aiming 14.1 km beyond the target — a correction it can only make while the engine is still burning.</p>`,
  },

  'veh.glide': {
    title: 'Vehicle C — hypersonic glider',
    caption: 'Apogee 167 km instead of 797, and it is still flying when it arrives.',
    labels: {
      altitude: 'altitude',
      rangeFlown: '% of the range flown',
      vehA: 'Vehicle A — ballistic',
      vehANote: 'apogee 797 km for 2890 km of range',
      zoom: 'the low band, magnified',
      offScale: 'A leaves the frame',
      apogee: 'apogee',
      pullUp: 'pull-up',
      vehC: 'Vehicle C — hypersonic glider',
      glideNote: 'equilibrium glide, L/D',
      steering: 'still steering when it arrives',
      caption: 'One flies through vacuum, the other never leaves the air it needs.',
    },
    body: `<p>Two boost stages, then a lifting body that does not fall back. The ascent is <b>depressed on purpose</b>: the commanded flight-path angle decreases linearly with altitude and vanishes at 72 km, so the vehicle reaches cutoff nearly flat. Thrust-to-weight is deliberately held at 1.8 — any higher and dynamic pressure builds before the vehicle has had time to lie down, the incidence limiter blocks the pitch-over, and it leaves on a ballistic arc far too steep to glide from.</p>
      <p>What makes a body <em>lifting</em> is its wing loading. 1400 kg spread over 4 m² is 350 kg/m²; a re-entry body carries 600 kg on 0.15 m², which is 4000. The Newtonian model gives a best lift-to-drag ratio of 2.2 at 16° of incidence. Pull-up comes at 62 km and 5110 m/s, 38 % of the way there, then an equilibrium glide of some 1130 s in which the computer holds the best-L/D incidence and lets the altitude settle by itself. Energy is managed by <b>bank</b>, not by incidence: banking μ leaves only L·cos μ to carry the weight, so the range left shortens in the same ratio — that is what the S-turns are burning.</p>
      <p>Cutoff comes far earlier than on a ballistic vehicle, since the range accounted for is the ballistic arc <em>plus</em> the glide. And the vehicle keeps manoeuvring: 248 s below 30 km against 17 for vehicle A, steering right up to impact. It never displaces its aim point to compensate for drag — zero correction, measured — because it simply flies to where it believes the target to be.</p>
      <p><b>Hence the essential point: its miss is its residual navigation error.</b> With a tactical-grade unit, 3.15 km of miss for 3.23 km of navigation error at impact. The glider corrects everything its inertial unit perceives, and only that — which makes it the vehicle on which a terrain fix pays best.</p>`,
  },

  'veh.marv': {
    title: 'Vehicle D — manoeuvring re-entry body',
    caption: 'The width of each band is the whole point.',
    labels: {
      ballistic: 'Ballistic', ballisticNote: 'nothing after cut-off — the trajectory is sealed there',
      marv: 'Manoeuvring', marvNote: 'a few tens of seconds, once the fins bite dense air',
      glider: 'Glider', gliderNote: 'minutes of manoeuvre, all the way to the target',
      launch: 'launch', impact: 'impact',
      caption: 'Correction authority, on a common time axis.',
    },
    body: `<p>One liquid stage, then a re-entry body carrying four control fins at its base. It fills the gap between the other two vehicles, and that is its only purpose.</p>
      <p><b>It is ballistic for almost the whole flight.</b> Fins need dynamic pressure to bite: below about 12 kPa, commanding an angle of attack produces nothing at all. So the vehicle only gains authority around 40 km, some 25 to 30 seconds before impact — and its angle of attack stays under 9°, because a slender body cannot turn broadside at Mach 8 without breaking.</p>
      <p>That narrow window buys a few kilometres of cross-range. Enough to correct the accumulated drift, <b>not enough to rescue a bad estimate</b>. Watch the flight report: its final miss tracks its navigation error almost exactly, where a ballistic vehicle's miss is frozen at cut-off and a glider's approaches zero.</p>
      <p>One subtlety worth knowing, because it cost a kilometre of accuracy to find. A ballistic vehicle aims at a <em>deliberately offset</em> point, to pre-compensate what an unguided fall loses to drag. A homing vehicle must not inherit that offset: it corrects its real impact, so the pre-compensation would be counted twice and it would land beside the target by exactly the offset. This one aims at the target itself.</p>`,
  },
};
