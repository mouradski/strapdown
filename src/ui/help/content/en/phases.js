// Fiches phases — anglais (reference).
export default {
  'flight.phases': {
    title: 'Flight phases',
    caption: 'After cutoff the ballistic branch commands nothing at all; the glider steers to the ground.',
    labels: {
      legCmd: 'commanded',
      legFree: 'physics alone',
      legEst: 'threshold read on the estimate',

      pPrelaunch: 'Pre-launch',
      sPrelaunch: 'alignment',
      pVertical: 'Vertical rise',
      pKick: 'Pitch-over',
      pTurn: 'Gravity turn',
      sTurnSkipped: 'window empty',
      pClosed: 'Closed loop',
      sToCutoff: '→ cutoff',

      cutoffTitle: 'Cutoff · separation',
      cutoffRule: 'predicted impact range = target range',
      cutoffRuleGlide: 'ballistic arc + glide = target range + 2.5 %',

      pCoast: 'Coast',
      sAbove: 'above',
      pMid: 'Midcourse',
      sMid: 'optional · one impulse',
      pReentry: 'Re-entry',
      sBelow: 'below',

      laneBal: 'Ballistic re-entry body',
      laneGlide: 'Hypersonic glider',

      pFreeFall: 'No further command',
      sFreeFall: 'incidence 0 · bank 0',
      sSealed: 'a later fix changes nothing',

      pGlide: 'Hypersonic glide',
      sPullUp: 'pull-up at',
      pTerminal: 'Terminal',
      sWithin: 'closer than',

      pImpact: 'Impact',
      sImpactBal: 'the miss was decided at cutoff',
      sImpactGlide: 'the miss is decided in the last second',
    },
    body: `<p>Eleven phases, but the phase itself is never the interesting part — what matters is what throws the switch. Three of the switches are plain clocks read off the mission timer. All the others are thresholds, and <b>every threshold is read on the estimated state</b>: the vehicle declares re-entry when it <em>believes</em> it is crossing 100 km, not when it does. The flight computer has no other altitude to consult.</p>
      <p>The first minute is the elegant part. The vertical rise buys clearance — about 800 m on the two-stage — with no lateral load at all. The pitch-over then tilts the thrust axis away from the vertical and holds it for six seconds: <b>3.5°</b> on the two-stage, 3.0° on the three-stage. That is the whole of the deliberate steering until the closed loop takes over, a minute later. From there the computer aims the thrust straight along the relative velocity vector — zero angle of attack — and stops steering. <b>Gravity does the rest</b>: it bends the velocity vector downrange, the thrust obediently follows it, and the trajectory lays itself over without a single lateral force on the airframe during the seconds of highest dynamic pressure. Forty-eight seconds later the two-stage is passing 51 km at 2.3 km/s, already well tilted. The glider is the exception: its pitch-over runs to T+11 s while its turn window closes at T+10, so the gravity turn never opens and its depressed-ascent pitch programme takes over directly.</p>
      <p>Closed-loop guidance then re-solves the whole ballistic problem from the estimated position on every cycle and thrusts along the <em>velocity to gain</em>. Cutoff, however, is not decided on that vector — with a non-throttleable motor it can stop shrinking before reaching zero. It is decided on a scalar that only grows: the range of the impact point predicted from the estimated state, drag included. When it reaches the target's range, the motor stops. The precision of that instant is everything, because on a ballistic arc an error of 1 m/s at cutoff costs roughly <b>2R/v</b> in range — about 1.9 km at 5500 km, so half a metre per second already misses by a kilometre. That is why the code stops recomputing the solution every half-second and starts recomputing it every step once the velocity to gain falls under 400 m/s. The glider is cut off on the same criterion applied to a prediction that includes the pull-up and the glide, plus a deliberate 2.5 % margin: surplus range can be burnt off in S-turns, a shortfall can never be recovered.</p>
      <ul>
        <li><b>vertical → pitch-over</b>, <b>pitch-over → gravity turn</b>, <b>gravity turn → closed loop</b>: the clock alone, at T+8 s, +6 s, and T+62 s for the two-stage.</li>
        <li><b>closed loop → cutoff</b>: the predicted impact range reaches the target's range.</li>
        <li><b>coast → midcourse</b>: optional, once only, just before apogee — estimated altitude above 120 km and the estimated flight path angle through zero.</li>
        <li><b>coast → re-entry</b>: estimated altitude below 100 km.</li>
        <li><b>re-entry → glide</b>: descending through 62 km, glider only.</li>
        <li><b>glide → terminal</b>: less than 45 km to go, or below 900 m/s, where the hypersonic aerodynamic model stops being valid.</li>
      </ul>
      <p>The fork after re-entry is what separates the two families. The ballistic body is commanded nothing at all: incidence zero, bank zero, the nose falls into the wind and only the ballistic coefficient matters. <b>Its trajectory was sealed at cutoff</b> — which is why the simulator records the navigation error at that instant separately. Star fixes during the coast and altimeter fixes during the descent keep improving what the computer <em>knows</em>, but there is no longer any way to act on it. The glider, on the contrary, keeps steering to the last second: bank angle to bleed energy and hold heading, then pursuit inside 45 km. A late fix therefore still buys accuracy — but the glide also stretches the flight: roughly ten minutes between pull-up and impact, where a ballistic body covers the last 100 km in forty seconds, and the inertial unit drifts throughout. The two effects pull in opposite directions, and which one wins is exactly what a couple of runs will show you.</p>`,
  },
};
