// Catalogue de fiches — francais.
import vehicles from './vehicles.js';
import mission from './mission.js';
import imu from './imu.js';
import star from './star.js';
import alt from './alt.js';
import terrain from './terrain.js';
import computer from './computer.js';
import tlmSensors from './tlmSensors.js';
import tlmCommands from './tlmCommands.js';
import hud from './hud.js';
import phases from './phases.js';

export default {
  ...vehicles,
  ...mission,
  ...imu,
  ...star,
  ...alt,
  ...terrain,
  ...computer,
  ...tlmSensors,
  ...tlmCommands,
  ...hud,
  ...phases,
};
