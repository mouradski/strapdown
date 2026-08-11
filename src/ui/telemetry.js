// Affichage du bus de donnees de bord.
//
// Deux flux, volontairement separes : ce que les capteurs MESURENT, et ce que
// le calculateur COMMANDE aux equipements. C'est la distinction que tout le
// simulateur cherche a rendre tangible — les mesures sont la seule information
// dont dispose le bord, et les ordres n'en sont que la consequence.
//
// Aucune valeur affichee ici ne provient de la verite terrain. Un enregistreur
// embarque n'y aurait pas acces davantage.

import { t } from './i18n.js';
import { infoButton } from './help/modal.js';

const fmt = {
  /** Triplet d'axes, aligne, avec les etiquettes du repere du corps. */
  axes(v, digits = 2, unit = '') {
    if (!v) return '<span class="k">—</span>';
    const [x, y, z] = v.map((n) => n.toFixed(digits).padStart(digits + 5));
    return `<b>x</b>${x} <b>y</b>${y} <b>z</b>${z}${unit ? ` <b>${unit}</b>` : ''}`;
  },
  age(a) {
    if (a == null) return '—';
    if (a < 1) return t('telemetry.justNow');
    if (a < 90) return t('telemetry.ago', { s: a.toFixed(0) });
    return t('telemetry.agoMin', { m: (a / 60).toFixed(1) });
  },
  km(v, d = 1) { return v == null ? '—' : `${(v / 1000).toFixed(d)} km`; },
};

/** Une ligne clé / valeur. `stale` la grise : la donnée n'est plus fraîche. */
const row = (k, v, stale = false, topic = null) =>
  `<div class="tlm-row${stale ? ' stale' : ''}"><span class="k">${k}${topic ? infoButton(topic, { small: true }) : ''}</span><span class="v">${v}</span></div>`;

/** Un bloc d'équipement, avec son état en en-tête. */
function block(name, state, stateClass, rows, kind = 'on', topic = null) {
  return `<div class="tlm-block ${kind}">
    <div class="name"><span>${name}${topic ? infoButton(topic) : ''}</span><span class="state ${stateClass}">${state}</span></div>
    ${rows.join('')}
  </div>`;
}

/** Les modes de pilotage sont des identifiants stables cote calculateur. */
const MODE_KEY = {
  boost: 'telemetry.modeBoost',
  ballistic: 'telemetry.modeBallistic',
  midcourse: 'telemetry.modeMidcourse',
  glide: 'telemetry.modeGlide',
};

/** Rend les deux flux dans leurs conteneurs respectifs. */
export function renderTelemetry(frame, sensorsEl, commandsEl) {
  if (!frame) {
    sensorsEl.innerHTML = `<p class="hint">${t('telemetry.idle')}</p>`;
    commandsEl.innerHTML = '';
    return;
  }
  const c = frame.capteurs;
  const p = frame.instructions;

  // ------------------------------------------------------------- capteurs
  const blocks = [];

  // La centrale est le seul capteur qui parle en permanence : tous les autres
  // ne repondent qu'a certaines conditions.
  blocks.push(block(t('telemetry.imu'), t('telemetry.imuAlways'), 'live', [
    row(t('telemetry.specificForce'), `<span class="tlm-axes">${fmt.axes(c.imu.fBody, 2, 'g')}</span>`, false, 'tlm.specificForce'),
    row(t('telemetry.angularRate'), `<span class="tlm-axes">${fmt.axes(c.imu.wBody, 2, '°/s')}</span>`, false, 'tlm.angularRate'),
    row(t('telemetry.gyroBiasEst'), `<span class="tlm-axes">${fmt.axes(c.imu.biaisEstimeGyro, 3, '°/h')}</span>`, false, 'tlm.gyroBiasEst'),
    row(t('telemetry.accelBiasEst'), `<span class="tlm-axes">${fmt.axes(c.imu.biaisEstimeAccel, 0, 'µg')}</span>`, false, 'tlm.accelBiasEst'),
  ], 'on', 'sensor.imu'));

  const alt = c.altimetre;
  const altStale = alt && alt.age > 3;
  blocks.push(block(
    t('telemetry.altimeter'),
    alt
      ? (altStale ? t('telemetry.altSilent')
        : t(alt.source === 'radar' ? 'telemetry.altRadar' : 'telemetry.altBaro'))
      : t('telemetry.altOffline'),
    alt && !altStale ? 'live' : 'idle',
    alt ? [
      row(t('telemetry.measuredAlt'), `${alt.alt.toFixed(0)} m`, altStale, 'tlm.measuredAlt'),
      row(t('telemetry.uncertainty'), `± ${alt.sigma.toFixed(0)} m`, altStale, 'tlm.uncertainty'),
      row(t('telemetry.lastReading'), fmt.age(alt.age), altStale, 'tlm.lastReading'),
    ] : [row(t('telemetry.state'), t('telemetry.noReading'))],
    alt && !altStale ? 'on' : 'off', 'sensor.alt',
  ));

  const star = c.stellaire;
  blocks.push(block(
    t('telemetry.star'),
    t(star.disponible ? 'telemetry.skyVisible' : 'telemetry.occulted'),
    star.disponible ? 'live' : 'idle',
    [
      row(t('telemetry.sightings'), String(star.visees), false, 'tlm.sightings'),
      row(t('telemetry.sightingAccuracy'), star.sigmaArcsec != null ? `± ${star.sigmaArcsec.toFixed(1)}″` : '—', false, 'tlm.sightingAccuracy'),
      row(t('telemetry.lastSighting'), fmt.age(star.age), false, 'tlm.lastReading'),
    ],
    star.disponible ? 'on' : 'off', 'sensor.star',
  ));

  const ter = c.terrain;
  blocks.push(block(
    t('telemetry.terrain'),
    t(!ter.actif ? 'telemetry.disabled'
      : ter.dansLaTranche ? 'telemetry.standby' : 'telemetry.outOfBand'),
    ter.actif && ter.dansLaTranche ? 'live' : 'idle',
    ter.actif ? [
      row(t('telemetry.profileBuilt'), `${ter.profil} pts`, false, 'tlm.profileBuilt'),
      row(t('telemetry.fixesRejects'), `${ter.recalages} / ${ter.rejets}`, false, 'tlm.fixesRejects'),
      row(t('telemetry.contrast'), ter.contraste != null ? ter.contraste.toFixed(3) : '—', false, 'tlm.contrast'),
      row(t('telemetry.offsetFound'), ter.dE != null
        ? `E ${ter.dE.toFixed(0)}  N ${ter.dN.toFixed(0)} m` : '—', false, 'tlm.offsetFound'),
      row(t('telemetry.uncertainty'), ter.sigma != null ? `± ${ter.sigma.toFixed(0)} m` : '—', false, 'tlm.uncertainty'),
      row(t('telemetry.lastFix'), fmt.age(ter.age), false, 'tlm.lastReading'),
    ] : [row(t('telemetry.state'), t('telemetry.notFitted'))],
    ter.actif && ter.dansLaTranche ? 'on' : 'off', 'sensor.terrain',
  ));

  sensorsEl.innerHTML = `<div class="tlm-group sensors">
    <h3>${t('telemetry.sensorsHeader')}</h3>${blocks.join('')}</div>`;

  // --------------------------------------------------------- instructions
  const cmds = [];
  const pr = p.propulsion;
  cmds.push(block(
    t('telemetry.propulsion', { n: pr.etage, total: pr.nbEtages }),
    t(pr.separe ? 'telemetry.separated' : pr.allume ? 'telemetry.lit' : 'telemetry.unlit'),
    pr.allume ? 'live' : 'idle',
    [
      row(t('telemetry.thrustCmd'), pr.pousseeMaxN
        ? `${(pr.pousseeN / 1000).toFixed(0)} / ${(pr.pousseeMaxN / 1000).toFixed(0)} kN` : '—', false, 'tlm.thrustCmd'),
      row(t('telemetry.propellant'), `${pr.ergolsKg.toFixed(0)} kg`, false, 'tlm.propellant'),
      row(t('telemetry.cutoff'), pr.extinctionDemandee ? t('telemetry.cutoffRequested')
        : pr.tempsAvantExtinction != null
          ? t('telemetry.cutoffIn', { s: pr.tempsAvantExtinction.toFixed(1) }) : '—', false, 'tlm.cutoff'),
    ],
    'cmd', 'tlm.thrustCmd',
  ));

  const pi = p.pilotage;
  cmds.push(block(t('telemetry.steering'), MODE_KEY[pi.mode] ? t(MODE_KEY[pi.mode]) : pi.mode, 'live', [
    row(t('telemetry.rateCmd'), `<span class="tlm-axes">${fmt.axes(pi.rotationCmd, 2, '°/s')}</span>`, false, 'tlm.rateCmd'),
    row(t('telemetry.aoaCmd'), `${pi.incidenceCmd.toFixed(1)}°`, false, 'tlm.aoaCmd'),
    row(t('telemetry.bankCmd'), `${pi.giteCmd.toFixed(1)}°`, false, 'tlm.bankCmd'),
  ], 'cmd', 'tlm.steeringMode'));

  const co = p.correction;
  cmds.push(block(
    t('telemetry.correction'),
    t(!co.active ? 'telemetry.notCarried'
      : co.pousseeN > 0 ? 'telemetry.firing' : 'telemetry.inReserve'),
    co.pousseeN > 0 ? 'live' : 'idle',
    co.active ? [
      row(t('telemetry.thrust'), `${co.pousseeN.toFixed(0)} N`, false, 'tlm.correctionThrust'),
      row(t('telemetry.impulseUsed'), `${co.deltaVUtilise.toFixed(1)} / ${co.deltaVBudget} m/s`, false, 'tlm.impulseUsed'),
    ] : [row(t('telemetry.state'), t('telemetry.noReserve'))],
    'cmd', 'computer.midcourse',
  ));

  const gu = p.guidage;
  cmds.push(block(t('telemetry.guidance'), t(`phase.${gu.phase}`), 'live', [
    row(t('telemetry.velocityToGain'), gu.vitesseAGagner != null && gu.vitesseAGagner < 1e6
      ? `${gu.vitesseAGagner.toFixed(0)} m/s` : '—', false, 'tlm.velocityToGain'),
    row(t('telemetry.rangeError'), gu.erreurPortee != null ? fmt.km(gu.erreurPortee) : '—', false, 'tlm.rangeError'),
    row(t('telemetry.aimOffset'), `N ${gu.viseeDecalageN.toFixed(0)}  E ${gu.viseeDecalageE.toFixed(0)} m`, false, 'tlm.aimOffset'),
    row(t('telemetry.aim'), t(gu.viseeGelee ? 'telemetry.aimFrozen' : 'telemetry.aimAdjustable'), false, 'tlm.aim'),
  ], 'cmd', 'flight.phases'));

  commandsEl.innerHTML = `<div class="tlm-group commands">
    <h3>${t('telemetry.commandsHeader')}</h3>${cmds.join('')}</div>`;
}
