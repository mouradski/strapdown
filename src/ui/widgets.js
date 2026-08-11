// Petits composants d'interface et mise en forme des grandeurs physiques.

import { num as i18nNum } from './i18n.js';
import { infoButtonEl } from './help/modal.js';

/** Curseur avec libelle et valeur formatee. Renvoie un element pret a inserer. */
export function slider({ label, min, max, step, value, format, onChange, log = false, info = null }) {
  const wrap = document.createElement('div');
  wrap.className = 'slider';

  const head = document.createElement('label');
  head.className = 'field-label';
  const name = document.createElement('span');
  name.textContent = label;
  // La fiche se pose contre le libelle, pas contre la valeur : c'est la
  // notion qu'on explique, pas le nombre courant.
  const btn = info ? infoButtonEl(info, { small: true }) : null;
  if (btn) name.append(btn);
  const val = document.createElement('span');
  val.className = 'val';
  head.append(name, val);

  const input = document.createElement('input');
  input.type = 'range';
  // En echelle logarithmique le curseur parcourt les decades : indispensable
  // quand un reglage couvre quatre ordres de grandeur, comme un biais gyro.
  if (log) {
    input.min = '0';
    input.max = '1000';
    input.step = '1';
    input.value = String(Math.round(1000 * (Math.log(value / min) / Math.log(max / min))));
  } else {
    input.min = String(min);
    input.max = String(max);
    input.step = String(step ?? (max - min) / 100);
    input.value = String(value);
  }

  const decode = () => (log
    ? min * (max / min) ** (Number(input.value) / 1000)
    : Number(input.value));

  const refresh = () => { val.textContent = format(decode()); };
  input.addEventListener('input', () => { refresh(); onChange(decode()); });
  refresh();

  wrap.append(head, input);
  wrap.setValue = (v) => {
    input.value = log
      ? String(Math.round(1000 * (Math.log(v / min) / Math.log(max / min))))
      : String(v);
    refresh();
  };
  return wrap;
}

/** Case a cocher simple avec libelle. */
export function toggleRow(label, checked, onChange, info = null) {
  const row = document.createElement('label');
  row.className = 'row';
  const span = document.createElement('span');
  span.textContent = label;
  if (info) { const b = infoButtonEl(info, { small: true }); if (b) span.append(b); }
  const sw = document.createElement('label');
  sw.className = 'switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  sw.append(input, document.createElement('span'));
  row.append(span, sw);
  return row;
}

// --- Mise en forme ---

export function distance(m) {
  if (!Number.isFinite(m)) return '—';
  if (Math.abs(m) < 1000) return `${m.toFixed(0)} m`;
  if (Math.abs(m) < 100000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(0)} km`;
}

export function altitude(m) {
  if (!Number.isFinite(m)) return '—';
  return m < 10000 ? `${(m / 1000).toFixed(2)}` : `${(m / 1000).toFixed(0)}`;
}

export function speed(ms) {
  if (!Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${ms.toFixed(0)} m/s` : `${(ms / 1000).toFixed(2)} km/s`;
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Nombre avec separateur de milliers. Le separateur suit la langue courante :
 * un espace en francais, une virgule en anglais, et des chiffres propres a
 * l'ecriture dans les langues qui en ont.
 */
export const num = i18nNum;
