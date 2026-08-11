// Internationalisation.
//
// L'anglais fait reference : c'est lui qui definit les cles, et toute autre
// langue qui laisse un trou retombe dessus plutot que d'afficher un vide.
//
// L'arabe et le persan s'ecrivent de droite a gauche. Ce n'est pas qu'une
// affaire de sens du texte : la disposition entiere se reflete, panneaux
// compris. On le declare sur la racine du document et la feuille de style
// s'adapte.

import en from './locales/en.js';
import fr from './locales/fr.js';
import ar from './locales/ar.js';
import zh from './locales/zh.js';
import fa from './locales/fa.js';

export const LOCALES = {
  en: { label: 'English', dir: 'ltr', strings: en },
  fr: { label: 'Français', dir: 'ltr', strings: fr },
  ar: { label: 'العربية', dir: 'rtl', strings: ar },
  zh: { label: '中文', dir: 'ltr', strings: zh },
  fa: { label: 'فارسی', dir: 'rtl', strings: fa },
};

const STORAGE_KEY = 'strapdown.locale';
let current = 'en';
const listeners = new Set();

/** Descend une cle pointee (« panel.mission.title ») dans un objet. */
function lookup(obj, key) {
  let node = obj;
  for (const part of key.split('.')) {
    if (node == null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Traduit une cle. Les variables sont injectees par {nom}.
 * Une cle absente de la langue courante retombe sur l'anglais ; absente
 * partout, elle s'affiche telle quelle — un texte etrange est plus facile a
 * reperer et a corriger qu'un blanc silencieux.
 */
export function t(key, vars) {
  let s = lookup(LOCALES[current].strings, key)
    ?? lookup(LOCALES.en.strings, key)
    ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

export const getLocale = () => current;
export const isRTL = () => LOCALES[current].dir === 'rtl';

/** Change de langue et notifie l'interface. */
export function setLocale(code) {
  if (!LOCALES[code]) return;
  current = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* mode prive */ }
  const html = document.documentElement;
  html.lang = code;
  html.dir = LOCALES[code].dir;
  applyStatic();
  for (const fn of listeners) fn(code);
}

/** S'abonne aux changements de langue (pour re-rendre le contenu dynamique). */
export function onLocaleChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/**
 * Remplit tous les elements porteurs d'un attribut de traduction.
 *   data-i18n       -> texte simple
 *   data-i18n-html  -> contenu riche (gras, italique)
 *   data-i18n-title -> infobulle
 */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
}

/**
 * Langue de depart : le choix memorise s'il existe, sinon l'anglais.
 *
 * On ne suit deliberement pas la langue du navigateur. L'anglais est la langue
 * de reference du catalogue, celle dont on sait qu'aucune chaine n'y manque ;
 * partir de la et laisser l'utilisateur choisir vaut mieux que de deviner.
 */
export function initLocale() {
  let code = null;
  try { code = localStorage.getItem(STORAGE_KEY); } catch { /* mode prive */ }
  setLocale(code && LOCALES[code] ? code : 'en');
}

/**
 * Formatage des nombres selon la langue. Les chiffres arabes orientaux et les
 * separateurs varient d'une locale a l'autre ; on laisse la plateforme s'en
 * charger plutot que de coder des regles a la main.
 */
export function num(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(current, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
