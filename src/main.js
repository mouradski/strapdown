// Assemblage : globe, simulation, interface.
//
// Rappel de l'invariant central du projet : le calculateur de bord n'accede
// jamais a l'etat vrai. Tout ce qui est affiche en vert vient de la simulation
// physique, tout ce qui est affiche en orange vient de la centrale inertielle,
// et l'ecart entre les deux est ce que le simulateur cherche a rendre visible.

import { GlobeView } from './render/globe.js';
import { Overlay, COLORS } from './render/overlay.js';
import { Simulation, runHeadless } from './sim/world.js';
import { VEHICLES, totalDeltaV, liftoffMass } from './sim/vehicle.js';
import { IMU_GRADES, defaultSensorConfig } from './avionics/sensors.js';
import * as THREE from 'three';
import { llaToEcef, eciToEcef, groundRange, initialBearing } from './core/geodesy.js';
import { RAD } from './core/constants.js';
import { SCENE_SCALE } from './render/scale.js';
import * as W from './ui/widgets.js';
import { renderTelemetry } from './ui/telemetry.js';
import { t, initLocale, onLocaleChange, setLocale, getLocale, LOCALES } from './ui/i18n.js';
import {
  installHelp, setHelpContext, infoButton, openHelp, getOpenTopic, pruneInfoButtons,
} from './ui/help/modal.js';

// ---------------------------------------------------------------- état global

const LAUNCH_PRESETS = [
  { key: 'sahara', lat: 28.0, lon: 2.0, alt: 400 },
  { key: 'atlantic', lat: -12.4, lon: -38.0, alt: 20 },
  { key: 'steppe', lat: 47.8, lon: 62.5, alt: 210 },
  { key: 'equatorial', lat: 5.2, lon: -52.8, alt: 10 },
  { key: 'nordic', lat: 67.9, lon: 21.1, alt: 340 },
  { key: 'pacific', lat: -8.5, lon: 159.0, alt: 15 },
];

const state = {
  vehicleId: 'bal2',
  launch: { ...LAUNCH_PRESETS[0] },
  target: { lat: 36.0, lon: 20.0, alt: 0 },
  loft: 0,
  sensors: defaultSensorConfig(),
  midcourse: { enabled: false, deltaV: 60 },
  seed: 1337,
  speed: 10,
  paused: false,
  pickMode: 'target',
};
state.sensors.imu = { ...IMU_GRADES[state.sensors.imuGrade] };

let sim = null;
let preview = null;

// ---------------------------------------------------------------- scène 3D

const view = new GlobeView(document.getElementById('scene'));
const overlay = new Overlay(view);
const labelLayer = document.getElementById('labels');
state.isLand = view.isLand;

window.addEventListener('resize', () => view.resize());

// ---------------------------------------------------------------- utilitaires

const $ = (id) => document.getElementById(id);

// Portees utiles, mesurees par simulation et inscrites dans la definition de
// chaque vecteur. On ne les recalcule pas ici a partir du delta-v : une regle
// du type « 55 % du delta-v ideal » se trompait d'un facteur deux, parce que
// les pertes de montee sont un montant absolu et non une proportion.
const MAX_RANGE = Object.fromEntries(
  Object.entries(VEHICLES).map(([id, v]) => [id, v.usefulRange]),
);

/**
 * Cale l'altitude du site de tir sur le relief.
 * Sans cela le pas de tir peut se retrouver enterre ou suspendu : le champ de
 * relief et l'altitude saisie sont deux sources independantes, et seule la
 * premiere fait foi pour ce qui est dessine et sonde.
 */
function snapLaunchToTerrain() {
  if (!view.terrain) return;
  state.launch.alt = Math.round(view.terrain.elevation(state.launch.lat, state.launch.lon));
}

function buildConfig() {
  return {
    vehicleId: state.vehicleId,
    launch: { ...state.launch },
    target: { ...state.target },
    sensors: JSON.parse(JSON.stringify(state.sensors)),
    midcourse: { ...state.midcourse },
    loft: state.loft,
    seed: state.seed,
    isLand: state.isLand,
  };
}

/** Recree la simulation sans la lancer, pour rafraichir la solution affichee. */
function refreshPreview() {
  snapLaunchToTerrain();
  preview = new Simulation(buildConfig());
  overlay.setVehicle(VEHICLES[state.vehicleId]);
  overlay.setPlan(state.launch, state.target);
  overlay.placeMarker('launch', state.launch.lat, state.launch.lon);
  overlay.placeMarker('target', state.target.lat, state.target.lon);
  renderMissionReadout();
}

// ---------------------------------------------------------------- panneau mission

function renderVehicles() {
  const host = $('vehicle-list');
  host.innerHTML = '';
  for (const [id, veh] of Object.entries(VEHICLES)) {
    const el = document.createElement('div');
    el.className = `vehicle-option${id === state.vehicleId ? ' selected' : ''}`;
    const stages = veh.stages.length;
    el.innerHTML = `
      <div class="name">${t(`vehicles.${id}Name`)}${infoButton(`veh.${id}`)}</div>
      <div class="blurb">${t(`vehicles.${id}Blurb`)}</div>
      <div class="spec">${t(stages > 1 ? 'mission.stagesPlural' : 'mission.stages', { n: stages })}
        · ${W.num(liftoffMass(veh) / 1000, 1)} t · Δv ${W.num(totalDeltaV(veh) / 1000, 2)} km/s
        · ${t('mission.range')} ≈ ${W.num(MAX_RANGE[id] / 1000)} km</div>`;
    el.addEventListener('click', () => {
      state.vehicleId = id;
      renderVehicles();
      $('loft-section').style.display = veh.glide ? 'none' : '';
      refreshPreview();
    });
    host.append(el);
  }
}

function renderMissionReadout() {
  const el = $('mission-readout');
  const range = groundRange(state.launch.lat, state.launch.lon, state.target.lat, state.target.lon);
  const bearing = initialBearing(state.launch.lat, state.launch.lon, state.target.lat, state.target.lon);
  const max = MAX_RANGE[state.vehicleId];
  const plan = preview?.plan;
  const over = range > max;

  el.innerHTML = `
    <div class="line"><span>${t('mission.readoutRange')}</span><span class="${over ? 'bad' : ''}">${W.distance(range)}</span></div>
    <div class="line"><span>${t('mission.readoutBearing')}</span><span>${bearing.toFixed(1)}°</span></div>
    ${plan ? `
      <div class="line"><span>${t('mission.readoutSpeed')}</span><span>${W.speed(plan.requiredSpeed)}</span></div>
      <div class="line"><span>${t('mission.readoutApogee')}</span><span>${W.distance(plan.apogee)}</span></div>
      <div class="line"><span>${t('mission.readoutTof')}</span><span>${W.clock(plan.tof)}</span></div>` : ''}
    ${over ? `<div class="line warn" style="margin-top:6px">${t('mission.outOfRange')}</div>` : ''}
  `;
}

function setupMissionPanel() {
  renderVehicles();

  const presetSel = $('launch-preset');
  fillLaunchPresets();

  presetSel.addEventListener('change', () => {
    if (presetSel.value === 'custom') return;
    const p = LAUNCH_PRESETS[Number(presetSel.value)];
    state.launch = { ...p };
    syncCoordInputs();
    refreshPreview();
  });

  const bind = (id, key, obj) => {
    $(id).addEventListener('change', () => {
      const v = Number($(id).value);
      if (!Number.isFinite(v)) return;
      obj[key] = key === 'lat' ? Math.max(-89.9, Math.min(89.9, v)) : ((v + 540) % 360) - 180;
      syncCoordInputs();
      refreshPreview();
    });
  };
  bind('launch-lat', 'lat', state.launch);
  bind('launch-lon', 'lon', state.launch);
  bind('target-lat', 'lat', state.target);
  bind('target-lon', 'lon', state.target);

  for (const [btnId, mode] of [['pick-launch', 'launch'], ['pick-target', 'target']]) {
    $(btnId).addEventListener('click', () => {
      state.pickMode = state.pickMode === mode ? null : mode;
      $('pick-launch').classList.toggle('active', state.pickMode === 'launch');
      $('pick-target').classList.toggle('active', state.pickMode === 'target');
    });
  }

  $('loft').addEventListener('input', (e) => {
    state.loft = Number(e.target.value) / 100;
    renderLoftValue();
    refreshPreview();
  });
  renderLoftValue();

  $('btn-launch').addEventListener('click', startFlight);
  $('btn-reset').addEventListener('click', resetFlight);
  $('btn-montecarlo').addEventListener('click', runMonteCarlo);
}

/** Remplit la liste des sites, en conservant la selection courante. */
function fillLaunchPresets() {
  const sel = $('launch-preset');
  const keep = sel.value;
  sel.innerHTML = '';
  LAUNCH_PRESETS.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = t(`sites.${p.key}`);
    sel.append(o);
  });
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = t('mission.freePosition');
  sel.append(custom);
  if (keep) sel.value = keep;
}

function renderLoftValue() {
  $('loft-value').textContent = state.loft < 0.02
    ? t('mission.loftMinimum')
    : t('mission.loftValue', { pct: Math.round(state.loft * 100) });
}

function syncCoordInputs() {
  $('launch-lat').value = state.launch.lat.toFixed(4);
  $('launch-lon').value = state.launch.lon.toFixed(4);
  $('target-lat').value = state.target.lat.toFixed(4);
  $('target-lon').value = state.target.lon.toFixed(4);
}

// ---------------------------------------------------------------- panneau capteurs

// Le panneau se construit en deux temps : le cablage des interrupteurs et des
// listes, qui n'a lieu qu'une fois, et les curseurs, reconstruits a chaque
// changement de langue. Les valeurs vivent dans `state`, jamais dans le DOM,
// de sorte qu'une reconstruction ne perd aucun reglage.

function setupSensorPanel() {
  const gradeSel = $('imu-grade');
  for (const id of Object.keys(IMU_GRADES)) {
    const o = document.createElement('option');
    o.value = id;
    gradeSel.append(o);
  }
  gradeSel.value = state.sensors.imuGrade;
  gradeSel.addEventListener('change', () => {
    state.sensors.imuGrade = gradeSel.value;
    state.sensors.imu = { ...IMU_GRADES[gradeSel.value] };
    buildImuDetail();
    refreshPreview();
  });

  bindSwitch('star-enabled', $('star-detail'), state.sensors.starTracker);
  bindSwitch('alt-enabled', $('alt-detail'), state.sensors.altimeter);
  bindSwitch('terrain-enabled', $('terrain-detail'), state.sensors.terrain);
  bindSwitch('midcourse-enabled', $('midcourse-detail'), state.midcourse);

  $('gravity-model').addEventListener('change', (e) => {
    state.sensors.gravityModel = e.target.value;
    refreshPreview();
  });

  buildSensorControls();
}

/** (Re)construit tous les curseurs. Appelable a chaque changement de langue. */
function buildSensorControls() {
  const gradeSel = $('imu-grade');
  const cap = (id) => id[0].toUpperCase() + id.slice(1);
  for (const o of gradeSel.options) o.textContent = t(`sensors.grade${cap(o.value)}`);

  buildImuDetail();

  // --- Viseur stellaire ---
  const star = state.sensors.starTracker;
  const starDetail = $('star-detail');
  starDetail.innerHTML = '';
  starDetail.append(
    W.slider({
      label: t('sensors.starSigma'), info: 'star.sigma', min: 0.5, max: 200, value: star.sigma, log: true,
      format: (v) => `${v.toFixed(1)}″`, onChange: (v) => { star.sigma = v; },
    }),
    W.slider({
      label: t('sensors.starPeriod'), info: 'star.period', min: 2, max: 180, step: 1, value: star.period,
      format: (v) => `${v.toFixed(0)} s`, onChange: (v) => { star.period = v; },
    }),
    W.slider({
      label: t('sensors.starMinAlt'), info: 'star.minAlt', min: 20000, max: 120000, step: 1000, value: star.minAlt,
      format: (v) => `${(v / 1000).toFixed(0)} km`, onChange: (v) => { star.minAlt = v; },
    }),
  );

  // --- Altimètre ---
  const alt = state.sensors.altimeter;
  const altDetail = $('alt-detail');
  altDetail.innerHTML = '';
  altDetail.append(
    W.slider({
      label: t('sensors.altBaroSigma'), info: 'alt.baroSigma', min: 5, max: 800, value: alt.baroSigma, log: true,
      format: (v) => `${v.toFixed(0)} m`, onChange: (v) => { alt.baroSigma = v; },
    }),
    W.slider({
      label: t('sensors.altBaroBias'), info: 'alt.baroBias', min: 0, max: 400, step: 5, value: alt.baroBias,
      format: (v) => `± ${v.toFixed(0)} m`, onChange: (v) => { alt.baroBias = v; },
    }),
    W.toggleRow(t('sensors.altRadar'), alt.radarEnabled, (v) => { alt.radarEnabled = v; }, 'alt.radar'),
    W.slider({
      label: t('sensors.altRadarSigma'), info: 'alt.radarSigma', min: 1, max: 120, value: alt.radarSigma, log: true,
      format: (v) => `${v.toFixed(0)} m`, onChange: (v) => { alt.radarSigma = v; },
    }),
  );

  // --- Corrélation de terrain ---
  // Aucun réglage de « précision » ici : elle n'est pas choisie, elle résulte
  // du relief survolé. Ce qui se règle, c'est la qualité du matériel.
  const ter = state.sensors.terrain;
  const terDetail = $('terrain-detail');
  terDetail.innerHTML = '';
  terDetail.append(
    W.slider({
      label: t('sensors.terrainMapError'), info: 'terrain.mapError', min: 1, max: 200, value: ter.mapError, log: true,
      format: (v) => `± ${v.toFixed(0)} m`, onChange: (v) => { ter.mapError = v; },
    }),
    W.slider({
      label: t('sensors.terrainRadarSigma'), info: 'terrain.radarSigma', min: 0.5, max: 60, value: ter.radarSigma, log: true,
      format: (v) => `${v.toFixed(1)} m`, onChange: (v) => { ter.radarSigma = v; },
    }),
    W.slider({
      label: t('sensors.terrainSamples'), info: 'terrain.samples', min: 10, max: 120, step: 5, value: ter.samples,
      format: (v) => t('sensors.terrainSamplesValue', {
        n: v.toFixed(0), km: ((v * ter.sampleStep) / 1000).toFixed(1),
      }),
      onChange: (v) => { ter.samples = Math.round(v); },
    }),
    W.slider({
      label: t('sensors.terrainPeriod'), info: 'terrain.period', min: 1, max: 60, step: 1, value: ter.period,
      format: (v) => `${v.toFixed(0)} s`, onChange: (v) => { ter.period = v; },
    }),
    W.slider({
      label: t('sensors.terrainMaxAlt'), info: 'terrain.maxAlt', min: 3000, max: 40000, step: 500, value: ter.maxAlt,
      format: (v) => `${(v / 1000).toFixed(1)} km`, onChange: (v) => { ter.maxAlt = v; },
    }),
  );

  // --- Calculateur ---
  const mcDetail = $('midcourse-detail');
  mcDetail.innerHTML = '';
  mcDetail.append(W.slider({
    label: t('sensors.midcourseBudget'), info: 'computer.midcourseBudget', min: 5, max: 400, step: 5, value: state.midcourse.deltaV,
    format: (v) => `${v.toFixed(0)} m/s`, onChange: (v) => { state.midcourse.deltaV = v; },
  }));
}

function bindSwitch(id, detailEl, target) {
  const el = $(id);
  el.checked = !!target.enabled;
  detailEl.classList.toggle('disabled', !target.enabled);
  el.addEventListener('change', () => {
    target.enabled = el.checked;
    detailEl.classList.toggle('disabled', !el.checked);
    refreshPreview();
  });
}

function buildImuDetail() {
  const host = $('imu-detail');
  host.innerHTML = '';
  const imu = state.sensors.imu;
  // La cle d'etat (2e colonne) est aussi l'identifiant de fiche : gyroBias ->
  // imu.gyroBias. Le libelle, lui, suit une autre convention historique.
  const specs = [
    ['imuGyroBias', 'gyroBias', 0.0001, 500, (v) => `${fmtSci(v)} °/h`],
    ['imuARW', 'gyroARW', 0.0001, 5, (v) => `${fmtSci(v)} °/√h`],
    ['imuAccelBias', 'accelBias', 0.1, 10000, (v) => `${fmtSci(v)} µg`],
    ['imuVRW', 'accelVRW', 0.001, 1, (v) => `${fmtSci(v)} m/s/√h`],
    ['imuAlignment', 'alignment', 0.005, 120, (v) => `${fmtSci(v)}′`],
  ];
  for (const [labelKey, key, min, max, format] of specs) {
    host.append(W.slider({
      label: t(`sensors.${labelKey}`), info: `imu.${key}`,
      min, max, value: Math.max(min, imu[key] || min), log: true, format,
      onChange: (v) => { imu[key] = v; state.sensors.imuGrade = 'custom'; },
    }));
  }
}

const fmtSci = (v) => {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
};

// ---------------------------------------------------------------- vol

function startFlight() {
  state.seed = (Math.random() * 1e9) | 0;
  sim = new Simulation(buildConfig());
  overlay.clearTrails();
  overlay.hideMarker('impact');
  overlay.hideMarker('aim');
  sim.launch();
  resultShown = false;
  state.paused = false;
  $('btn-launch').disabled = true;
  $('btn-pause').textContent = '❚❚';
  $('result').classList.add('hidden');
}

function resetFlight() {
  sim = null;
  resultShown = false;
  overlay.clearTrails();
  overlay.hideMarker('impact');
  overlay.hideMarker('aim');
  $('btn-launch').disabled = false;
  $('result').classList.add('hidden');
  refreshPreview();
}

function setupTimeControls() {
  for (const b of $('speeds').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      state.speed = Number(b.dataset.speed);
      for (const o of $('speeds').querySelectorAll('button')) o.classList.remove('active');
      b.classList.add('active');
    });
  }
  for (const b of $('views').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      for (const o of $('views').querySelectorAll('button')) o.classList.remove('active');
      b.classList.add('active');
      view.setMode(b.dataset.view, state.launch);
      $('view-hint').style.display = b.dataset.view === 'orbite' ? 'none' : '';
    });
  }

  $('btn-track').addEventListener('click', () => { view.trackVehicle = true; });
  $('phase-label').addEventListener('click', () => openHelp('flight.phases'));

  $('btn-pause').addEventListener('click', () => {
    state.paused = !state.paused;
    $('btn-pause').textContent = state.paused ? '▶' : '❚❚';
  });
  for (const [btn, modal] of [['btn-help', 'help'], ['help-close', 'help']]) {
    $(btn).addEventListener('click', () => $(modal).classList.toggle('hidden'));
  }
  $('result-close').addEventListener('click', () => $('result').classList.add('hidden'));
  $('result-again').addEventListener('click', () => { $('result').classList.add('hidden'); startFlight(); });
  $('mc-close').addEventListener('click', () => $('montecarlo').classList.add('hidden'));

  for (const b of $('right-tabs').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      for (const o of $('right-tabs').querySelectorAll('button')) o.classList.remove('active');
      b.classList.add('active');
      $('pane-config').hidden = b.dataset.pane !== 'pane-config';
      $('pane-telemetry').hidden = b.dataset.pane !== 'pane-telemetry';
    });
  }

  for (const t of document.querySelectorAll('.panel-toggle')) {
    t.addEventListener('click', () => $(t.dataset.target).classList.toggle('open'));
  }
}

// ---------------------------------------------------------------- sélection souris

let dragged = false;
const canvas = document.getElementById('scene');
canvas.addEventListener('pointerdown', () => { dragged = false; });
canvas.addEventListener('pointermove', (e) => { if (e.buttons) dragged = true; });
canvas.addEventListener('pointerup', (e) => {
  if (dragged || !state.pickMode) return;
  const hit = view.pick(e.clientX, e.clientY);
  if (!hit) return;
  const dest = state.pickMode === 'launch' ? state.launch : state.target;
  dest.lat = hit.lat;
  dest.lon = hit.lon;
  if (state.pickMode === 'launch') {
    $('launch-preset').value = 'custom';
    dest.alt = Math.max(0, state.launch.alt ?? 0);
  }
  syncCoordInputs();
  refreshPreview();
});

// ---------------------------------------------------------------- HUD

const HUD_CELLS = [
  ['altitude', (s) => `${W.altitude(s.alt)}<small>km</small>`, ''],
  ['speed', (s) => `${(s.speed / 1000).toFixed(2)}<small>km/s</small>`, ''],
  ['mach', (s) => (s.mach > 0.05 && s.alt < 100000 ? s.mach.toFixed(1) : '—'), ''],
  ['dynPressure', (s) => `${(s.qDyn / 1000).toFixed(1)}<small>kPa</small>`, ''],
  ['accel', (s) => `${s.accel.toFixed(1)}<small>g</small>`, ''],
  ['fpa', (s) => `${s.fpa.toFixed(1)}°`, ''],
  ['downrange', (s) => W.distance(s.downrange), ''],
  ['toGo', (s) => W.distance(s.toTarget), ''],
  ['navError', (s) => W.distance(s.navError), 'truth'],
  ['navSigma', (s) => W.distance(s.navSigma), 'est'],
  ['attError', (s) => `${(s.attError * 60).toFixed(1)}<small>′</small>`, 'truth'],
  ['starFixes', (s) => `${s.starFixes}`, 'est'],
  // Relief survolé : c'est lui qui décide si la corrélation de terrain peut
  // fonctionner. Sur mer ou en plaine, elle refusera de rendre une position.
  ['terrainRugged', (s) => (s.ruggedness > 0.001
    ? `${(s.ruggedness * 100).toFixed(0)}<small>%</small>`
    : `<span style="color:var(--dim)">${t('hud.sea')}</span>`), ''],
  ['terrainFixes', (s) => (state.sensors.terrain.enabled
    ? `${s.terrainFixes}<small>/${s.terrainFixes + s.terrainRejected}</small>`
    : `<span style="color:var(--dim)">${t('hud.inactive')}</span>`), 'est'],
];

function buildHud() {
  const host = $('hud-grid');
  host.innerHTML = '';
  for (const [key] of HUD_CELLS) {
    const cell = document.createElement('div');
    cell.className = 'hud-cell';
    cell.innerHTML = `<div class="k">${t(`hud.${key}`)}${infoButton(`hud.${key}`, { small: true })}</div><div class="v">—</div>`;
    host.append(cell);
  }
}

function updateHud(snap) {
  const cells = $('hud-grid').children;
  for (let i = 0; i < HUD_CELLS.length; i++) {
    const [, fn, cls] = HUD_CELLS[i];
    const v = cells[i].querySelector('.v');
    v.innerHTML = snap ? fn(snap) : '—';
    v.className = `v ${snap ? cls : ''}`;
  }
}

// ---------------------------------------------------------------- étiquettes

const labels = {};
function label(key, text, color) {
  if (!labels[key]) {
    const el = document.createElement('div');
    el.className = 'map-label';
    labelLayer.append(el);
    labels[key] = el;
  }
  labels[key].textContent = text;
  labels[key].style.color = color;
  return labels[key];
}

function place(key, ecef, text, color) {
  const el = label(key, text, color);
  const p = overlay.project(ecef);
  if (!p) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
}

function hideLabel(key) {
  if (labels[key]) labels[key].style.display = 'none';
}

function updateLabels() {
  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  place('launch', llaToEcef(state.launch.lat, state.launch.lon, 30000), t('map.launch'), hex(COLORS.launch));
  place('target', llaToEcef(state.target.lat, state.target.lon, 30000), t('map.target'), hex(COLORS.target));

  if (sim && (sim.running || sim.finished)) {
    const pred = sim.predictedImpact();
    if (pred && !sim.finished) {
      overlay.placeMarker('impact', pred.lla.lat, pred.lla.lon);
      place('impact', llaToEcef(pred.lla.lat, pred.lla.lon, 30000), t('map.predicted'), hex(COLORS.impact));
    } else if (!sim.finished) {
      // Les premieres secondes de vol ne donnent pas encore de prediction
      // exploitable. Sans cela l'etiquette du tir precedent resterait affichee,
      // et l'on croirait lire l'arrivee de celui-ci.
      overlay.hideMarker('impact');
      hideLabel('impact');
    }
    if (sim.finished && sim.result) {
      overlay.placeMarker('impact', sim.result.impact.lat, sim.result.impact.lon);
      place('impact', llaToEcef(sim.result.impact.lat, sim.result.impact.lon, 30000),
        t('map.arrival', { miss: W.distance(sim.result.missDistance) }), hex(COLORS.impact));
    }

    // Jalon propre au planeur : la ou il cessera de tomber pour commencer a
    // planer. Ce n'est pas un point d'arrivee, et le nommer « impact »
    // laisserait croire qu'il tombe des centaines de kilometres trop court.
    if (sim.pullUpPoint && !sim.finished) {
      overlay.placeMarker('pullup', sim.pullUpPoint.lat, sim.pullUpPoint.lon);
      place('pullup', llaToEcef(sim.pullUpPoint.lat, sim.pullUpPoint.lon, 30000),
        t('map.pullup'), hex(COLORS.aim));
    } else {
      overlay.hideMarker('pullup');
      hideLabel('pullup');
    }
  } else {
    hideLabel('impact');
    hideLabel('pullup');
    overlay.hideMarker('impact');
    overlay.hideMarker('pullup');
  }
}

// ---------------------------------------------------------------- boucle

let lastFrame = performance.now();
let resultShown = false;
let lastTelemetry = 0;

function frame(now) {
  const dtWall = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (sim && sim.running && !state.paused) {
    // On avance d'autant de pas que le budget de temps le permet : la
    // simulation ne doit jamais faire tomber l'affichage sous 60 images/s.
    const wanted = dtWall * state.speed;
    const budget = performance.now() + 11;
    let advanced = 0;
    while (advanced < wanted && performance.now() < budget) {
      const before = sim.t;
      if (!sim.step()) { onImpact(); break; }
      advanced += sim.t - before;
    }
  }

  if (sim) {
    // Filet de securite : si le vol s'est acheve alors que l'onglet etait en
    // arriere-plan (le navigateur y suspend les images), le bilan n'a pas pu
    // etre presente. On le rattrape des le retour a l'ecran.
    if (sim.finished && sim.result && !resultShown) onImpact();

    const closeUp = view.mode !== 'orbite';
    overlay.update(sim, true, closeUp);
    overlay.updateVehicle(sim, dtWall);

    // Les vues rapprochees suivent l'engin ; la poursuite se place derriere
    // lui, dans l'axe de sa vitesse.
    if (closeUp && (sim.running || sim.finished)) {
      const ecef = eciToEcef(sim.rTrue, sim.t);
      view.setFollowTarget(new THREE.Vector3(
        ecef[0] * SCENE_SCALE, ecef[2] * SCENE_SCALE, -ecef[1] * SCENE_SCALE,
      ));
      const vEcef = eciToEcef(sim.vTrue, sim.t);
      view.setChaseDirection(new THREE.Vector3(vEcef[0], vEcef[2], -vEcef[1]));
    } else {
      view.setFollowTarget(null);
    }
    const snap = sim.snapshot();
    updateHud(snap);
    $('mission-time').textContent = `T+ ${W.clock(snap.t)}`;
    $('phase-label').textContent = t(`phase.${snap.phase}`);
  } else {
    updateHud(null);
    $('mission-time').textContent = 'T− 00:00';
    $('phase-label').textContent = t('phase.prelaunch');
  }

  updateLabels();

  if (!$('pane-telemetry').hidden && now - lastTelemetry > 80) {
    lastTelemetry = now;
    renderTelemetry(
      sim && (sim.running || sim.finished) ? sim.telemetryFrame() : null,
      $('tlm-sensors'), $('tlm-commands'),
    );
  }

  view.render();
  requestAnimationFrame(frame);
}

function onImpact() {
  resultShown = true;
  $('btn-launch').disabled = false;
  showResult(sim.result);
}

// ---------------------------------------------------------------- bilan

function showResult(r) {
  if (!r) return;
  const veh = VEHICLES[state.vehicleId];

  $('result-title').textContent = t('result.title');
  $('result-body').innerHTML = `
    <div class="result-hero">
      <div class="big" style="color:${r.missDistance < 500 ? 'var(--ok)' : r.missDistance < 5000 ? 'var(--warn)' : 'var(--danger)'}">
        ${W.distance(r.missDistance)}
      </div>
      <div class="cap">${t('result.missCaption')}</div>
    </div>
    <table class="result-table">
      <tr><td>${t('result.rangeAimed')}</td><td>${W.distance(r.targetRange)} / ${W.distance(r.groundRange)}</td></tr>
      <tr><td>${t('result.missNE')}</td><td>${r.missNorth >= 0 ? '+' : ''}${r.missNorth.toFixed(0)} m &nbsp; ${r.missEast >= 0 ? '+' : ''}${r.missEast.toFixed(0)} m</td></tr>
      <tr><td>${t('result.flightTime')}</td><td>${W.clock(r.flightTime)}</td></tr>
      <tr><td>${t('result.apogee')}</td><td>${W.distance(r.apogee)}</td></tr>
      <tr><td>${t('result.burnout')}</td><td>${t('result.burnoutAt', { speed: W.speed(r.burnoutSpeed), t: r.burnoutTime?.toFixed(0) })}</td></tr>
      <tr><td>${t('result.impactSpeed')}</td><td>${W.speed(r.impactSpeed)}</td></tr>
      <tr><td>${t('result.maxAccel')}</td><td>${(r.maxAccel / 9.80665).toFixed(1)} g</td></tr>
      <tr><td><b>${t('result.navAtBurnout')}</b></td><td style="color:var(--truth)"><b>${W.distance(r.burnoutNavError)}</b>${
  r.burnoutVelError != null ? ` <span style="color:var(--dim)">· ${r.burnoutVelError.toFixed(2)} m/s</span>` : ''}</td></tr>
      <tr><td>${t('result.navAtImpact')}</td><td>${W.distance(r.navError)}</td></tr>
      <tr><td>${t('result.navSigma')}</td><td style="color:var(--estimate)">${W.distance(r.navSigma)}</td></tr>
      <tr><td>${t('result.alignment')}</td><td>${(r.alignmentError * RAD * 60).toFixed(2)}′</td></tr>
      <tr><td>${t('result.fixesApplied')}</td><td>${t('result.fixesDetail', {
    star: r.updates.star, alt: r.updates.alt, terrain: r.updates.terrain,
  })}</td></tr>
    </table>
    <p class="verdict">${verdict(r, veh)}</p>`;
  $('result').classList.remove('hidden');
}

function verdict(r, veh) {
  const parts = [];
  if (r.groundRange < r.targetRange * 0.97) {
    parts.push(t('result.verdictShort', { d: W.distance(r.targetRange - r.groundRange) }));
  } else if (veh.glide) {
    parts.push(t('result.verdictGlider', { miss: W.distance(r.missDistance) }));
  } else {
    // Sensibilite de la portee a une erreur de vitesse a l'extinction :
    // environ 2R/v pour une trajectoire d'energie minimale.
    const sensitivity = (2 * r.groundRange) / Math.max(r.burnoutSpeed, 1);
    const attributable = (r.burnoutVelError ?? 0) * sensitivity;
    parts.push(t('result.verdictBallistic', {
      pos: W.distance(r.burnoutNavError),
      vel: (r.burnoutVelError ?? 0).toFixed(2),
      sens: W.distance(sensitivity),
      share: W.distance(attributable),
    }));
    if (r.navError < r.burnoutNavError * 0.5) {
      parts.push(t('result.verdictLateFix', { nav: W.distance(r.navError) }));
    }
  }

  if (r.navSigma * 3 < r.navError) {
    parts.push(t('result.verdictOverconfident', {
      sigma: W.distance(r.navSigma), actual: W.distance(r.navError),
    }));
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------- dispersion

function runMonteCarlo() {
  const N = 25;
  const results = [];
  $('montecarlo').classList.remove('hidden');
  $('mc-status').textContent = t('mc.running', { i: 0, n: N });
  $('mc-stats').innerHTML = '';
  drawScatter([], 0);

  let i = 0;
  const tick = () => {
    const deadline = performance.now() + 90;
    while (i < N && performance.now() < deadline) {
      const cfg = buildConfig();
      // Chaque tir tire de nouveaux biais de capteurs : c'est cette
      // variabilite-la que la dispersion mesure.
      cfg.seed = 100000 + i * 7919;
      const s = runHeadless(cfg);
      if (s.result) results.push(s.result);
      i++;
    }
    $('mc-status').textContent = t('mc.running', { i, n: N });
    drawScatter(results, i / N);
    if (i < N) {
      // setTimeout et non requestAnimationFrame : le navigateur suspend
      // totalement les images d'un onglet en arriere-plan, ce qui laisserait
      // la serie a l'arret des que l'utilisateur regarde ailleurs.
      setTimeout(tick, 0);
    } else {
      finishMonteCarlo(results);
    }
  };
  setTimeout(tick, 0);
}

function drawScatter(results, progress) {
  const c = $('mc-canvas');
  const ctx = c.getContext('2d');
  const W_ = c.width, H = c.height;
  ctx.clearRect(0, 0, W_, H);
  ctx.fillStyle = '#060d18';
  ctx.fillRect(0, 0, W_, H);

  const maxR = Math.max(500, ...results.map((r) => Math.hypot(r.missNorth, r.missEast))) * 1.15;
  const cx = W_ / 2, cy = H / 2;
  const scale = (Math.min(W_, H) / 2 - 30) / maxR;

  // Cercles de distance.
  ctx.strokeStyle = 'rgba(120,165,205,0.18)';
  ctx.fillStyle = 'rgba(142,163,186,0.85)';
  ctx.font = '10px ui-monospace, monospace';
  const step = niceStep(maxR / 3);
  for (let r = step; r <= maxR; r += step) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(r < 1000 ? `${r.toFixed(0)} m` : `${(r / 1000).toFixed(1)} km`, cx + 4, cy - r * scale - 3);
  }
  ctx.strokeStyle = 'rgba(120,165,205,0.3)';
  ctx.beginPath();
  ctx.moveTo(cx, 12); ctx.lineTo(cx, H - 12);
  ctx.moveTo(12, cy); ctx.lineTo(W_ - 12, cy);
  ctx.stroke();
  ctx.fillText('N', cx + 5, 20);
  ctx.fillText('E', W_ - 16, cy - 5);

  // Impacts.
  for (const r of results) {
    const x = cx + r.missEast * scale;
    const y = cy - r.missNorth * scale;
    ctx.fillStyle = 'rgba(61,220,132,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cercle d'erreur probable : la moitie des tirs tombent a l'interieur.
  if (results.length >= 5) {
    const cep = median(results.map((r) => Math.hypot(r.missNorth, r.missEast)));
    ctx.strokeStyle = 'rgba(255,176,56,0.9)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, cep * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Objectif.
  ctx.strokeStyle = '#ff4d5a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
  ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
  ctx.stroke();
  ctx.lineWidth = 1;

  if (progress < 1) {
    ctx.fillStyle = 'rgba(74,159,216,0.9)';
    ctx.fillRect(0, H - 3, W_ * progress, 3);
  }
}

function finishMonteCarlo(results) {
  const misses = results.map((r) => Math.hypot(r.missNorth, r.missEast));
  const navs = results.map((r) => r.navError);
  const cep = median(misses);
  const mean = misses.reduce((a, b) => a + b, 0) / misses.length;
  const worst = Math.max(...misses);
  const biasN = results.reduce((a, r) => a + r.missNorth, 0) / results.length;
  const biasE = results.reduce((a, r) => a + r.missEast, 0) / results.length;

  $('mc-status').textContent = t('mc.done', { n: results.length });
  $('mc-stats').innerHTML = `
    <div class="line"><span>${t('mc.cep')}</span><span>${W.distance(cep)}</span></div>
    <div class="line"><span>${t('mc.mean')}</span><span>${W.distance(mean)}</span></div>
    <div class="line"><span>${t('mc.worst')}</span><span>${W.distance(worst)}</span></div>
    <div class="line"><span>${t('mc.bias')}</span><span>${biasN.toFixed(0)} m / ${biasE.toFixed(0)} m</span></div>
    <div class="line"><span>${t('mc.medianNav')}</span><span>${W.distance(median(navs))}</span></div>
    <p class="hint">${t('mc.hint')}</p>`;
  drawScatter(results, 1);
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : 0.5 * (s[s.length / 2 - 1] + s[s.length / 2]);
};

function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const n = x / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

// ---------------------------------------------------------------- démarrage

// Accroche de mise au point : permet d'inspecter la simulation depuis la
// console du navigateur, et de verifier que projection et selection a la
// souris sont bien inverses l'une de l'autre.
window.strapdown = {
  state,
  view,
  overlay,
  get sim() { return sim; },
  get preview() { return preview; },
  pick: (x, y) => view.pick(x, y),
  project: (lat, lon) => overlay.project(llaToEcef(lat, lon, 0)),
};

/**
 * Selecteur de langue. Le choix est memorise ; au premier chargement on suit
 * celle du navigateur, et a defaut l'anglais.
 */
function setupLocaleSelect() {
  const sel = $('locale-select');
  for (const [code, def] of Object.entries(LOCALES)) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = def.label;
    sel.append(o);
  }
  sel.value = getLocale();
  sel.addEventListener('change', () => setLocale(sel.value));
}

// Les schemas reactifs lisent les reglages a l'instant ou la fiche s'ouvre,
// et non au demarrage : un curseur deplace doit se voir sur le dessin.
setHelpContext(() => ({
  sensors: state.sensors,
  veh: VEHICLES[state.vehicleId],
  midcourse: state.midcourse,
  loft: state.loft,
}));
installHelp();

initLocale();
setupLocaleSelect();
setupMissionPanel();
setupSensorPanel();
setupTimeControls();
buildHud();
syncCoordInputs();
refreshPreview();
view.focusOn(32, 11, 20);

// Tout ce qui est ecrit par du JavaScript doit etre reconstruit a la volee :
// l'attribut data-i18n ne couvre que le balisage statique.
onLocaleChange(() => {
  $('locale-select').value = getLocale();
  renderVehicles();
  fillLaunchPresets();
  renderLoftValue();
  buildSensorControls();
  buildHud();
  renderMissionReadout();
  if (sim && sim.finished && sim.result && !$('result').classList.contains('hidden')) {
    showResult(sim.result);
  }
  // Une fiche ouverte doit suivre : elle a ete rendue dans l'ancienne langue.
  pruneInfoButtons();
  const open = getOpenTopic();
  if (open && !$('help-topic').classList.contains('hidden')) openHelp(open);
  lastTelemetry = 0;
});

requestAnimationFrame(frame);
