// Catalogue des fiches pedagogiques.
//
// Une fiche par notion : un vecteur, un reglage, une donnee de telemetrie, un
// ordre envoye aux equipements. C'est la carte du sujet, independante de la
// langue : elle dit quels sujets existent et quel schema les illustre. Le
// texte, lui, vit dans les catalogues de langue (content/<langue>/).
//
// `diagram` nomme une fonction du registre de schemas. `reactive: true` signale
// que le schema lit les reglages courants et doit etre redessine a chaque
// ouverture — c'est le cas des fiches ou voir l'effet du curseur vaut mieux
// qu'une phrase.
//
// L'ordre des groupes suit celui de l'interface, de haut en bas.

export const TOPICS = {
  // ------------------------------------------------------------- vecteurs
  'veh.bal2': { group: 'vehicles', diagram: 'trajectoryBallistic' },
  'veh.bal3': { group: 'vehicles', diagram: 'trajectoryRange' },
  'veh.glide': { group: 'vehicles', diagram: 'trajectoryGlide' },

  // -------------------------------------------------------------- mission
  'mission.launchSite': { group: 'mission', diagram: 'launchSite' },
  'mission.target': { group: 'mission', diagram: 'targetNoReceiver' },
  'mission.loft': { group: 'mission', diagram: 'loftProfiles', reactive: true },
  'mission.range': { group: 'mission', diagram: 'reachEnvelope' },

  // ------------------------------------------------------- modules (titres)
  'sensor.imu': { group: 'imu', diagram: 'strapdownLoop' },
  'sensor.star': { group: 'star', diagram: 'starGeometry' },
  'sensor.alt': { group: 'alt', diagram: 'altimeterPair' },
  'sensor.terrain': { group: 'terrain', diagram: 'tercomPrinciple' },
  'sensor.computer': { group: 'computer', diagram: 'guidanceLoop' },

  // ---------------------------------------------------- centrale inertielle
  'imu.grade': { group: 'imu', diagram: 'gradeLadder', reactive: true },
  'imu.gyroBias': { group: 'imu', diagram: 'errorGrowth', reactive: true },
  'imu.gyroARW': { group: 'imu', diagram: 'randomWalk' },
  'imu.accelBias': { group: 'imu', diagram: 'errorGrowth', reactive: true },
  'imu.accelVRW': { group: 'imu', diagram: 'randomWalk' },
  'imu.alignment': { group: 'imu', diagram: 'alignmentTilt', reactive: true },

  // -------------------------------------------------------- viseur stellaire
  'star.sigma': { group: 'star', diagram: 'starAccuracy', reactive: true },
  'star.period': { group: 'star', diagram: 'fixCadence' },
  'star.minAlt': { group: 'star', diagram: 'starVisibility' },

  // --------------------------------------------------------------- altimetre
  'alt.baroSigma': { group: 'alt', diagram: 'baroNoise' },
  'alt.baroBias': { group: 'alt', diagram: 'atmosphereDeviation' },
  'alt.radar': { group: 'alt', diagram: 'radarReach' },
  'alt.radarSigma': { group: 'alt', diagram: 'baroNoise' },

  // --------------------------------------------------- correlation de terrain
  'terrain.mapError': { group: 'terrain', diagram: 'mapFidelity' },
  'terrain.radarSigma': { group: 'terrain', diagram: 'profileNoise' },
  'terrain.samples': { group: 'terrain', diagram: 'profileLength', reactive: true },
  'terrain.period': { group: 'terrain', diagram: 'fixCadence' },
  'terrain.maxAlt': { group: 'terrain', diagram: 'terrainBand' },

  // -------------------------------------------------------------- calculateur
  'computer.gravityModel': { group: 'computer', diagram: 'oblateness' },
  'computer.midcourse': { group: 'computer', diagram: 'midcourseWindow' },
  'computer.midcourseBudget': { group: 'computer', diagram: 'impulseBudget' },

  // -------------------------------------------------- telemetrie : capteurs
  'tlm.specificForce': { group: 'tlmSensors', diagram: 'specificForce' },
  'tlm.angularRate': { group: 'tlmSensors', diagram: 'bodyRates' },
  'tlm.gyroBiasEst': { group: 'tlmSensors', diagram: 'biasEstimation' },
  'tlm.accelBiasEst': { group: 'tlmSensors', diagram: 'biasEstimation' },
  'tlm.measuredAlt': { group: 'tlmSensors', diagram: 'altimeterPair' },
  'tlm.uncertainty': { group: 'tlmSensors', diagram: 'sigmaEnvelope' },
  'tlm.lastReading': { group: 'tlmSensors', diagram: 'fixCadence' },
  'tlm.sightings': { group: 'tlmSensors', diagram: 'starTally' },
  'tlm.sightingAccuracy': { group: 'tlmSensors', diagram: 'starAccuracy' },
  'tlm.profileBuilt': { group: 'tlmSensors', diagram: 'profileLength' },
  'tlm.fixesRejects': { group: 'tlmSensors', diagram: 'chiSquareGate' },
  'tlm.contrast': { group: 'tlmSensors', diagram: 'terrainContrast' },
  'tlm.offsetFound': { group: 'tlmSensors', diagram: 'tercomPrinciple' },

  // ---------------------------------------------- telemetrie : instructions
  'tlm.thrustCmd': { group: 'tlmCommands', diagram: 'thrustTimeline' },
  'tlm.propellant': { group: 'tlmCommands', diagram: 'thrustTimeline' },
  'tlm.cutoff': { group: 'tlmCommands', diagram: 'cutoffDecision' },
  'tlm.steeringMode': { group: 'tlmCommands', diagram: 'steeringModes' },
  'tlm.rateCmd': { group: 'tlmCommands', diagram: 'attitudeChain' },
  'tlm.aoaCmd': { group: 'tlmCommands', diagram: 'windFrame' },
  'tlm.bankCmd': { group: 'tlmCommands', diagram: 'bankLift' },
  'tlm.correctionThrust': { group: 'tlmCommands', diagram: 'midcourseWindow' },
  'tlm.impulseUsed': { group: 'tlmCommands', diagram: 'impulseBudget' },
  'tlm.velocityToGain': { group: 'tlmCommands', diagram: 'velocityToGain' },
  'tlm.rangeError': { group: 'tlmCommands', diagram: 'rangeSensitivity' },
  'tlm.aimOffset': { group: 'tlmCommands', diagram: 'aimOffset' },
  'tlm.aim': { group: 'tlmCommands', diagram: 'aimFreeze' },

  // ---------------------------------------------------------------- bandeau
  'hud.altitude': { group: 'hud', diagram: 'altitudeProfile' },
  'hud.speed': { group: 'hud', diagram: 'speedProfile' },
  'hud.mach': { group: 'hud', diagram: 'machRegimes' },
  'hud.dynPressure': { group: 'hud', diagram: 'dynamicPressure' },
  'hud.accel': { group: 'hud', diagram: 'accelProfile' },
  'hud.fpa': { group: 'hud', diagram: 'flightPathAngle' },
  'hud.downrange': { group: 'hud', diagram: 'greatCircle' },
  'hud.toGo': { group: 'hud', diagram: 'greatCircle' },
  'hud.navError': { group: 'hud', diagram: 'truthVsEstimate' },
  'hud.navSigma': { group: 'hud', diagram: 'sigmaEnvelope' },
  'hud.attError': { group: 'hud', diagram: 'attitudeError' },
  'hud.starFixes': { group: 'hud', diagram: 'starTally' },
  'hud.terrainRugged': { group: 'hud', diagram: 'terrainContrast' },
  'hud.terrainFixes': { group: 'hud', diagram: 'chiSquareGate' },

  // ------------------------------------------------------------ phases de vol
  'flight.phases': { group: 'phases', diagram: 'phaseTimeline' },
};

/** Les groupes, dans l'ordre ou ils apparaissent dans l'interface. */
export const GROUPS = [
  'vehicles', 'mission', 'imu', 'star', 'alt', 'terrain',
  'computer', 'tlmSensors', 'tlmCommands', 'hud', 'phases',
];

export const topicIds = () => Object.keys(TOPICS);
export const topicsOfGroup = (g) => topicIds().filter((id) => TOPICS[id].group === g);
