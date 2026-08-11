// Fiches « telemetrie des instructions » — anglais (reference).
//
// Ce que le calculateur ORDONNE. Fil conducteur du groupe : un ordre est
// toujours calcule sur l'etat ESTIME, et rien dans la boucle ne verifie qu'il a
// produit l'effet espere.
export default {
  'tlm.thrustCmd': {
    title: 'Commanded thrust',
    caption: 'The only propulsion decision the guidance ever makes is when to stop.',
    labels: {
      time: 'flight time',
      thrust: 'commanded thrust',
      onOff: 'the throttle has two positions: lit, or shut',
      propellant: 'propellant in the current stage',
      stage: 'stage',
      cutoff: 'commanded cut-off',
      unused: 'never burnt',
      vacuum: 'in vacuum',
      caption: 'Nothing between the two levels is reachable.',
    },
    body: `<p>Two numbers: the thrust the engine is producing, and the thrust that stage can produce. They differ, but not because anything was commanded — the throttle setting in this simulator is always 1. The command has exactly two values, <b>burning</b> or <b>shut down</b>, and the guidance never sends anything in between.</p>
      <p>Thrust still moves, for two reasons that belong to the hardware rather than to the computer. It climbs during the first stage because ambient pressure stops pushing back on the nozzle exit — 640 kN at sea level, 700 kN in vacuum, some 9 % gained simply by leaving the atmosphere. And it drops abruptly at staging, when a 700 kN first stage gives way to a 190 kN second one.</p>
      <p>The consequence runs through the whole group. With no way to trim thrust, the guidance cannot ease the velocity to be gained down to zero: it can only choose the <em>instant</em> it stops. Everything about matching the range to the target is packed into that one decision, which is why the cut-off criterion is built with such care.</p>`,
  },

  'tlm.propellant': {
    title: 'Propellant left',
    caption: 'Shutting down with full tanks is the point, not a failure.',
    labels: {
      time: 'flight time',
      thrust: 'commanded thrust',
      onOff: 'the throttle has two positions: lit, or shut',
      propellant: 'propellant in the current stage',
      stage: 'stage',
      cutoff: 'commanded cut-off',
      unused: 'never burnt',
      vacuum: 'in vacuum',
      caption: 'What stays in the tank is the range the vehicle did not need.',
    },
    body: `<p>The mass remaining in the stage now burning — it resets at every separation, which is why the figure is a sawtooth. On the reference shot the second stage is shut down with <b>587 kg of its 3900 kg still aboard</b>, about 15 % of the tank.</p>
      <p>That leftover is not waste; it is the whole reason one vehicle can cover every range up to its maximum. A missile that burns its tanks dry has exactly one range. A missile that is shut down on a computed criterion has a continuum of them, and the propellant it does not use is the distance between the target and the edge of its reach.</p>
      <p>One detail worth knowing, because it costs accuracy elsewhere: an engine that quits halfway through an integration step feeds the accelerometer an average — a thrust that never existed at that level. The simulator therefore ends the step exactly on depletion. Skipping that care leaves about half a metre per second of phantom velocity in the inertial unit, and it propagates all the way to impact.</p>`,
  },

  'tlm.cutoff': {
    title: 'Cut-off',
    caption: 'Cut on a scalar that only ever grows, never on a vector.',
    labels: {
      time: 'flight time',
      targetRange: 'range of the target',
      cutoff: 'cut-off',
      rise: 'would climb again',
      rangeErr: 'predicted range − target range',
      vGo: 'velocity to be gained',
      cadence: 're-predicted every 0.25 s, extrapolated in between',
      sensitivity: '1 m/s at cut-off is worth',
      caption: 'The predicted range only grows while the engine burns.',
    },
    body: `<p>Once each cycle the computer integrates, from the state it <em>believes</em> it is in and with the drag model it carries, where the vehicle would land if the engine stopped now. It compares that range with the target's, and shuts down when the difference crosses zero. Between two full predictions — one every 0.25 s — it extrapolates linearly, which is exactly the countdown shown as <em>in x s</em>.</p>
      <p>The obvious criterion would be to wait for the velocity to be gained to vanish. It does not work with an engine that cannot be throttled: the vehicle reaches the required <em>magnitude</em> of speed before it has finished swinging onto the required <em>direction</em>, so that quantity can bottom out and climb again without ever passing through zero. The predicted range has no such defect — while thrust is on, it only grows.</p>
      <p>The last instant is worth a great deal. A ballistic trajectory answers a speed error at cut-off with about <b>960 m of range per m/s</b>, so shutting down at the end of an ordinary integration step, up to 0.7 m/s late, would already cost 700 m. The simulator shortens the step to land exactly on the crossing.</p>
      <p>And then the reservation that governs this whole simulator: the prediction starts from the <em>estimated</em> state. The range error driven to zero is the error of an imagined flight. Whatever the navigation is wrong by at cut-off, the real trajectory inherits in full, and no readout aboard will say so.</p>`,
  },

  'tlm.steeringMode': {
    title: 'Steering mode',
    caption: 'The mode names which command channel is read — nothing more.',
    labels: {
      boost: 'powered ascent',
      midcourse: 'midcourse burn',
      ballistic: 'ballistic',
      glide: 'lifting glide',
      chanThrust: 'thrust direction',
      chanZero: 'α = 0, μ = 0',
      chanAngles: 'incidence and bank',
      thrustBuilder: 'attitude from thrust',
      thrustBuilderSub: 'roll on the firing plane',
      windBuilder: 'attitude from the wind',
      windBuilderSub: 'bank first, then incidence',
      output: 'commanded attitude',
      outputSub: 'then a rotation rate',
      noControl: 'In ballistic mode both angles are zero: nothing is being steered at all.',
      caption: 'Two ways to build an attitude, four labels on the front of them.',
    },
    body: `<p>Four labels, but only two machines behind them. In <b>powered ascent</b> and during a <b>midcourse burn</b>, the computer produces a thrust direction, and the attitude is built around it — body axis along the thrust, roll referenced on the normal to the firing plane rather than on the local vertical, which would be degenerate at lift-off precisely when the thrust <em>is</em> vertical.</p>
      <p>In <b>lifting glide</b> the computer produces two angles instead, and the attitude is built in the wind frame: start from the relative velocity, roll by the commanded bank, then pitch by the commanded incidence about the already-tilted axis. Order matters — bank first, incidence second — because bank is what decides in which plane the incidence will act.</p>
      <p><b>Ballistic</b> is the interesting one, because it is not a control law. Incidence and bank are set to zero and the reentry body simply weathercocks into the airflow; from then on the trajectory depends only on the ballistic coefficient. The steering readouts sit at 0.0° not because a loop is holding them there, but because nobody is flying. For a purely ballistic vehicle, that is most of the mission: everything was decided at cut-off.</p>`,
  },

  'tlm.rateCmd': {
    title: 'Commanded rate',
    caption: 'Turning the body is not a manoeuvre; it only decides where the force will point.',
    labels: {
      order: 'commanded attitude',
      error: 'attitude error ψ',
      rate: 'commanded rate ω',
      body: 'the body turns',
      satBoost: 'under thrust, at most',
      satCoast: 'after separation, at most',
      ifForce: 'with thrust, or with air',
      ifNone: 'vacuum, engine off',
      force: 'the force turns with the body',
      forceSub: 'this is the only way to steer anything',
      none: 'nothing happens at all',
      noneSub: 'the trajectory does not change',
      caption: 'Rotation orients. It never accelerates.',
    },
    body: `<p>Three rotation rates, one per body axis, in degrees per second — what the autopilot asks of the actuators. The law is deliberately simple: the attitude error is turned into a rate proportional to it, <b>ω = 1.4 · ψ</b>, then saturated. The ceiling is 0.12 rad/s (6.9 °/s) while the stack is under thrust, 0.25 rad/s (14.3 °/s) once the light reentry body is on its own. Any attitude error beyond about 5° therefore commands full rate.</p>
      <p><b>A rotation produces no acceleration by itself.</b> It reorients the body, and that is all. If the engine is burning, the thrust vector follows; if there is dynamic pressure, the aerodynamic force follows. In vacuum with the engine shut down, the same command changes strictly nothing — which is why the readout keeps showing rates all through the coast while the trajectory does not move a metre.</p>
      <p>The saturation is not a detail either. In the final seconds of the burn the guidance shifts its aim point sideways, and the velocity direction cannot follow it all the way at 6.9 °/s. What is left is about <b>250 m of lateral residue at impact</b> — a floor set by the airframe's turning rate, with no sensor anywhere in the story.</p>`,
  },

  'tlm.aoaCmd': {
    title: 'Commanded angle of attack',
    caption: 'Incidence sets how strong the force is — bank decides where it points.',
    labels: {
      velocity: 'relative wind',
      bodyAxis: 'body axis',
      lift: 'lift',
      drag: 'drag',
      perp: 'lift is perpendicular to the wind, not to the body',
      aoaAxis: 'angle of attack',
      finesse: 'lift-to-drag',
      best: 'best',
      maxA: 'at the stop',
      drop: 'the whole span is worth only',
      caption: 'A curve this flat cannot be used as a brake.',
    },
    body: `<p>The angle between the body axis and the relative wind — the airflow, not the ground track. It is what sets the <em>magnitude</em> of the aerodynamic force: with the modified Newtonian model used here, CN = 2 sin²α against a constant axial coefficient of 0.022. Lift comes out perpendicular to the wind, drag along it, and neither is aligned with the body.</p>
      <p>Now look at how flat the curve is. Lift-to-drag peaks at <b>2.22 around 16°</b> and is still <b>2.01 at the 22° stop</b> — the entire usable span of incidence buys ten percent of finesse. A glider therefore <em>cannot</em> dissipate energy by playing with incidence, and the longitudinal loop does not even try: it holds the best-finesse incidence and lets the altitude settle wherever the air density happens to carry it. Bank does the energy work.</p>
      <p>During powered flight the readout stays at zero, but a limit is quietly active all the same: while dynamic pressure exceeds 20 kPa the thrust direction is clamped to within 2° of the relative wind, 6° above 5 kPa, 20° above 500 Pa. Down in the dense layer it is the structure that decides how hard the vehicle may be steered, not the guidance.</p>
      <p>The exception is the last 45 km. There incidence stops being a trim setting and becomes a pursuit gain — six times the pointing error, saturated at 22°, so that the vehicle keeps flying to the end instead of sliding into a ballistic dive on the run-in, where knowing precisely where it is would no longer change anything.</p>`,
  },

  'tlm.bankCmd': {
    title: 'Commanded bank',
    caption: 'The only real brake a lifting body has.',
    labels: {
      lift: 'lift L',
      vertical: 'L · cos μ',
      horizontal: 'L · sin μ',
      weight: 'weight',
      sTurn: 'S-turns: burn energy without drifting off course',
      bankAxis: 'bank',
      rangeAxis: 'glide range',
      aoaOnly: 'all the incidence can give =',
      maxBank: 'stop at',
      caption: 'Range follows cos μ, and cos μ is a steep function.',
    },
    body: `<p>Rotation about the velocity vector. It changes nothing about how much lift is produced — that is incidence's business — and everything about the plane in which it acts. Tilt by μ and only <b>L · cos μ</b> is left pointing upward, so the vehicle must generate L / cos μ to stay level, and drag rises in the same proportion. The effective lift-to-drag becomes <b>E · cos μ</b>, and equilibrium glide range is proportional to it.</p>
      <p>That is where the energy control lives. At the 55° stop the finesse drops from 2.22 to 1.27, and the range available between 6000 and 900 m/s falls from about 5970 km to 3420 km. Put the other way round, and this is the number worth remembering: <b>everything the incidence can give up is worth 25° of bank</b> — and the bank goes to 55°.</p>
      <p>Since a turn also changes heading, excess range is burnt with the bank <em>alternating</em> — the classic S-turn. The sign follows the heading error through a deliberately wide hysteresis, 5° when there is real energy to shed and 0.4° otherwise. A narrow threshold would be worse than useless: with a finite roll rate the vehicle would spend its time crossing wings-level without ever holding a bank, and would dissipate nothing. On a reference glide the loop settles into ±19 to ±22°.</p>
      <p>In the terminal phase the meaning changes again. Bank is no longer an energy control but a pointing one, and it commonly reads near 180°. Flying inverted is how a lifting body pushes itself <em>down</em>, and by then the target sits well below the velocity vector.</p>`,
  },

  'tlm.velocityToGain': {
    title: 'Velocity to be gained',
    caption: 'A triangle solved at a point the vehicle may not actually occupy.',
    labels: {
      vEst: 'velocity now (believed)',
      vReq: 'required velocity',
      vGo: 'velocity to be gained',
      shrinks: 'closes as the burn goes on',
      posEst: 'believed position',
      posTrue: 'true position',
      trueReq: 'what the truth would require',
      formula: 'v_go = v_required − v_believed',
      caption: 'The computer closes its own triangle perfectly, and can be wrong all the same.',
    },
    body: `<p>The difference between the velocity the vehicle ought to have and the one it believes it has. The required velocity is the solution of a two-point boundary problem — leave from here, arrive at the aim point — recomputed every half second, and every single cycle once cut-off is near. Thrust is pointed along that difference, so as the burn proceeds the current velocity swings toward the required one and the gap closes: 2849 m/s when the closed loop takes over around T+63 s, 4 m/s at cut-off on the reference shot.</p>
      <p>It nearly reaches zero there, but nothing guarantees it, and the guidance does not rely on it: an engine that cannot throttle overshoots in magnitude while still turning, so the criterion actually used is the predicted range instead.</p>
      <p>The figure shows what the number cannot. The triangle is drawn from the <em>believed</em> position. Move the origin by the navigation error and the required velocity becomes a different vector — the one the truth would have asked for. The computer nulls the triangle it can see, to the last metre per second, and delivers the vehicle to a point displaced by exactly the error it never knew it had.</p>`,
  },

  'tlm.rangeError': {
    title: 'Range error',
    caption: 'Near cut-off, a metre per second and a kilometre are the same quantity.',
    labels: {
      burnout: 'cut-off',
      target: 'target',
      dvShift: '+1 m/s at cut-off',
      navShift: '2 km of nav error',
      zoom: 'impact, magnified',
      invisible: 'The guidance drives its own error to zero. The navigation error it never sees.',
      caption: 'At the scale of the arc, a kilometre is a fifth of a pixel.',
    },
    body: `<p>The range of the predicted impact point minus the range of the target, in kilometres. Negative means falling short. This is the quantity the cut-off criterion watches, and it appears in the telemetry only in the last stretch of the burn — the prediction is the expensive part of the guidance cycle, so it is skipped entirely while the velocity to be gained is above 1400 m/s, and run coarsely until the error is under 40 km.</p>
      <p>Its sensitivity is the number that governs ballistic accuracy. Near cut-off, range error and speed error are the same thing scaled by <b>2R/v</b>: on the reference shot, 2 × 1912 km / 3987 m/s, that is about <b>960 m of range per m/s of speed</b>. It is why the closed loop refuses to reuse a half-second-old solution as cut-off approaches, and why the integration step is shortened to land exactly on the crossing.</p>
      <p>And here too the reading is honest about the flight it imagines, not the flight that happens. The prediction starts from the estimated state, so a navigation error at cut-off displaces the whole trajectory without moving this number at all. Two kilometres of drift, and the range error still reads zero.</p>`,
  },

  'tlm.aimOffset': {
    title: 'Aim offset',
    caption: 'Aiming beside the target, on purpose, for two unrelated reasons.',
    labels: {
      route: 'firing plane, great circle',
      target: 'target',
      predicted: 'predicted impact',
      shortfall: 'measured shortfall',
      aim: 'aim point',
      downrange: 'downrange',
      crossTrack: 'cross-track',
      why: 'A Keplerian solution ignores reentry drag, and always falls short.',
      gain: '60 % of the measured gap per pass — nine passes here, about 2 km in the end',
      caption: 'What is corrected is the model’s blind spot, not the navigation’s.',
    },
    body: `<p>How far the aim point sits from the target, north and east, in metres. It is not a defect: the computer deliberately solves for a point that is not the target, and for two independent reasons.</p>
      <ul>
        <li><b>Downrange.</b> The Keplerian solution knows nothing of reentry drag, which always shortens the flight. So the computer simulates the descent with its own drag model, measures how short it falls, and moves the aim beyond the target by that much — applying only 60 % per pass, because the point it predicts from moves as the vehicle flies, and applying the whole correction makes the aim oscillate instead of converge.</li>
        <li><b>Cross-track.</b> The cut-off criterion is a scalar: it watches range and nothing else. Nothing guarantees that at the instant the range is right, the lateral offset is right too — the thrust simply stops with whatever residue it had, which used to leave a deterministic half-kilometre bias. So the deviation of the predicted impact from the firing plane is measured and applied to the aim, perpendicular, again at a gain of 0.6.</li>
      </ul>
      <p>The lateral correction only starts once the range prediction is close — within 5 % of the target range, capped at 80 km. Before that, the sideways deviation of a prediction landing hundreds of kilometres short means nothing, and correcting on it would send the aim wandering. On the reference shot the offset settles around 2 km, most of it downrange.</p>
      <p>About 250 m survive anyway. In the last seconds of the burn the limited rotation rate prevents the velocity direction from fully catching the aim that has just moved. That residue is the guidance's own floor: it is there with perfect sensors, and no better inertial unit will remove it. A glider carries no offset at all — it corrects by manoeuvring, and the readout stays at zero.</p>`,
  },

  'tlm.aim': {
    title: 'Aim point',
    caption: 'A loop whose output moves its own target cannot converge. So it is cut.',
    labels: {
      refine: 'the aim is refined',
      required: 'required velocity moves',
      vGoNode: 'velocity to gain moves',
      steer: 'the steering chases it',
      freeze: 'frozen below 50 m/s',
      cadence: 'every 8 s, then every 2 s',
      equivalence: 'one step of aim is one step of required velocity',
      caption: 'Freezing is not giving up: it is what makes the last seconds converge.',
    },
    body: `<p>Two states, <em>adjustable</em> and <em>frozen</em>. While adjustable, the aim point is refined every 8 seconds, and every 2 seconds once the velocity to be gained falls below 600 m/s — the prediction is made from a point closer and closer to the real cut-off, so it is worth repeating more often. Below 50 m/s the aim is frozen and does not move again.</p>
      <p>The reason is the loop drawn here. Each refinement shifts the aim by a few kilometres; through the same 2R/v factor that governs everything else near cut-off, <b>3 km of aim is about 3 m/s of required velocity</b>. Keep refining while trying to drive the velocity to be gained down to a handful of m/s and the target moves as fast as the vehicle closes on it. The residue never settles — not because the loop is badly tuned, but because its own output is what displaces its objective.</p>
      <p>Freezing also stops the cross-track correction, which is why the ordering is deliberate. The lateral loop has exactly the window between <em>the range prediction has become meaningful</em> and <em>the aim is frozen</em> — a few tens of seconds — to do its work. Widen the window and the aim wanders; narrow it and the lateral bias survives to impact.</p>`,
  },

  'tlm.correctionThrust': {
    title: 'Correction thrust',
    caption: 'The window opens near apogee and never reopens.',
    labels: {
      truth: 'true trajectory', believed: 'believed trajectory', target: 'target',
      windowLabel: 'correction window', fire: 'burn', altFloor: 'floor: 120 km',
      gap: 'the error it corrects is the one it sees', caption: 'One shot, computed on an estimate.',
    },
    body: `<p>The thrust actually being delivered by the small correction motor, in newtons. It reads zero almost the whole flight: the burn lasts a few seconds, once, near apogee.</p>
      <p>The computer only fires when two conditions hold at the same time — above 120 km, and with the radial velocity close to zero. That is the top of the arc, and it is the right place: a given impulse buys the most range change there, and the trajectory ahead is still long enough for the correction to take effect.</p>
      <p><b>But it corrects the error it <em>sees</em>, not the error it has.</b> The computer compares its own estimated position against the aim point and solves for the velocity change that would close the gap. If the estimate is off, the correction is off in exactly the same direction — and the burn then carries the vehicle further from the target, not closer. A reserve is not a safety net; it is an amplifier of whatever the unit believes.</p>`,
  },

  'tlm.impulseUsed': {
    title: 'Impulse used',
    caption: 'What a metre per second of impulse is worth at apogee.',
    labels: {
      reserve: 'impulse reserve', atApogee: 'spent at apogee', navError: 'navigation error',
      reach: 'range shift obtained', perMs: 'per m/s', burn: 'burn', caption: 'Spending more than the error is spending against yourself.',
    },
    body: `<p>How much of the reserve has been spent, against the budget you set. Once spent, it is gone: there is no second burn in this simulator, and no real vehicle carries many.</p>
      <p>The exchange rate is steep. Near apogee, one metre per second of impulse moves the impact point by roughly a kilometre — the same <b>2R/v</b> sensitivity that makes cut-off velocity so critical. A 60 m/s reserve is therefore worth some 60 km of correction authority, far more than any plausible navigation error.</p>
      <p>Which means the budget is almost never the limit. What limits the correction is the <em>quality of the estimate</em> that commands it. Raising the reserve past a few tens of m/s buys nothing: you are already able to correct much more than you can perceive.</p>`,
  },
};
