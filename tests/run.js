// Lanceur de tests minimal, sans dependance.
// Usage : npm test  [nom-partiel-de-suite]

const suites = [
  ['core', () => import('./core.test.js')],
  ['terrain', () => import('./terrain.test.js')],
  ['vehicle', () => import('./vehicle.test.js')],
  ['navigation', () => import('./navigation.test.js')],
  ['guidance', () => import('./guidance.test.js')],
];

let pass = 0, fail = 0;
const failures = [];
let quietPass = 0;

const t = {
  /** `quiet` regroupe les assertions repetitives pour ne pas noyer la sortie. */
  ok(cond, msg, quiet = false) {
    if (cond) {
      pass++;
      if (quiet) quietPass++;
      else console.log(`  \x1b[32mok\x1b[0m   ${msg}`);
    } else {
      fail++;
      failures.push(msg);
      console.log(`  \x1b[31mFAIL\x1b[0m ${msg}`);
    }
  },
  close(actual, expected, tol, msg, quiet = false) {
    const d = Math.abs(actual - expected);
    const good = Number.isFinite(d) && d <= tol;
    this.ok(good, good ? msg : `${msg} (obtenu ${actual}, attendu ${expected} +/- ${tol})`, quiet);
  },
};

const filter = process.argv[2];
for (const [name, load] of suites) {
  if (filter && !name.includes(filter)) continue;
  console.log(`\n\x1b[1m# ${name}\x1b[0m`);
  const before = fail;
  try {
    const mod = await load();
    await mod.default(t);
  } catch (e) {
    fail++;
    failures.push(`${name}: exception`);
    console.log(`  \x1b[31mFAIL\x1b[0m exception : ${e.stack}`);
  }
  if (fail === before) console.log(`  \x1b[90m(suite ok)\x1b[0m`);
}

console.log(`\n${pass} reussis (dont ${quietPass} groupes), ${fail} echecs`);
if (fail) {
  console.log('\nEchecs :');
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
