// Fenetre des fiches pedagogiques.
//
// Un seul bouton d'ouverture, partout : le petit « i » pose a cote d'un
// libelle. La fenetre se remplit a l'ouverture et non a l'avance — un schema
// reactif doit lire les reglages au moment ou on le regarde, pas au demarrage.
//
// L'ecoute est deleguee au document : les panneaux se reconstruisent a chaque
// changement de langue, et des ecouteurs poses sur chaque bouton seraient
// perdus a la premiere reconstruction.

import { TOPICS } from './registry.js';
import DIAGRAMS from './diagrams/index.js';
import EN from './content/en/index.js';
import FR from './content/fr/index.js';
import { getLocale, t } from '../i18n.js';

const CATALOGUES = { en: EN, fr: FR };

// Un meme schema sert souvent plusieurs fiches : la cadence de recalage
// illustre aussi bien le reglage du viseur stellaire que la ligne « derniere
// mesure » de la telemetrie. Les libelles qu'il dessine appartiennent alors au
// SCHEMA, pas a la fiche — et exiger que chaque fiche les redeclare revient a
// recopier le meme texte a plusieurs endroits, avec la derive que cela promet.
//
// On rassemble donc, pour chaque schema, les libelles de toutes les fiches qui
// s'en servent. Une fiche garde la priorite sur les siens : elle peut nuancer
// une annotation sans priver les autres des leurs.
function sharedLabels(catalogue, diagram, exceptId) {
  const merged = {};
  for (const [id, def] of Object.entries(TOPICS)) {
    if (id === exceptId || def.diagram !== diagram) continue;
    Object.assign(merged, catalogue[id]?.labels ?? {});
  }
  return merged;
}

/** Contenu d'une fiche, avec repli sur l'anglais champ par champ. */
export function topicContent(id) {
  const local = CATALOGUES[getLocale()]?.[id];
  const ref = EN[id];
  if (!local && !ref) return null;
  const diagram = TOPICS[id]?.diagram;
  const localCat = CATALOGUES[getLocale()] ?? EN;
  return {
    title: local?.title ?? ref?.title ?? id,
    body: local?.body ?? ref?.body ?? '',
    caption: local?.caption ?? ref?.caption ?? '',
    labels: {
      ...(diagram ? sharedLabels(EN, diagram, id) : {}),
      ...(diagram ? sharedLabels(localCat, diagram, id) : {}),
      ...(ref?.labels ?? {}),
      ...(local?.labels ?? {}),
    },
  };
}

let ctxProvider = () => ({});
/** Sujet actuellement affiche, pour pouvoir le re-rendre sur changement de langue. */
let openTopic = null;
export const getOpenTopic = () => openTopic;

/**
 * Branche la source d'etat des schemas reactifs. On passe une fonction et non
 * un objet : les reglages changent en permanence, et le schema doit refleter
 * ceux de l'instant ou la fiche s'ouvre.
 */
export function setHelpContext(fn) { ctxProvider = fn; }

/**
 * Bouton d'ouverture, a inserer dans n'importe quel libelle.
 *
 * On ne le pose que si la fiche existe reellement. Un bouton qui ne repond pas
 * est pire que pas de bouton : l'utilisateur clique, rien ne vient, et il ne
 * sait pas si l'application est cassee ou si le sujet n'a rien a dire.
 */
export function infoButton(topicId, { small = false } = {}) {
  if (!TOPICS[topicId] || !topicContent(topicId)) return '';
  return `<button type="button" class="info-btn${small ? ' sm' : ''}" data-help="${topicId}"
    aria-label="${t('help.info')}" title="${t('help.info')}">i</button>`;
}

/** Variante DOM, pour les composants construits par script (curseurs). */
export function infoButtonEl(topicId, opts) {
  const html = infoButton(topicId, opts);
  if (!html) return null;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content.firstElementChild;
}

function el(id) { return document.getElementById(id); }

export function openHelp(topicId) {
  const topic = TOPICS[topicId];
  const content = topicContent(topicId);
  // Filet de securite : si l'on arrive ici pour un sujet sans fiche (bouton
  // pose en dur dans le balisage, par exemple), on le dit plutot que de rester
  // muet.
  if (!topic || !content) {
    console.warn(`fiche « ${topicId} » absente du catalogue`);
    return;
  }

  const draw = DIAGRAMS[topic.diagram];
  let figure = '';
  if (typeof draw === 'function') {
    try {
      figure = draw({ labels: content.labels, ...ctxProvider() }) || '';
    } catch (err) {
      // Un schema qui echoue ne doit pas emporter la fiche : le texte reste
      // la partie utile.
      console.warn(`schema « ${topic.diagram} » en echec`, err);
      figure = '';
    }
  }

  el('help-topic-title').textContent = content.title;
  el('help-topic-figure').innerHTML = figure;
  el('help-topic-figure').hidden = !figure;
  el('help-topic-caption').innerHTML = content.caption ?? '';
  el('help-topic-caption').hidden = !content.caption;
  el('help-topic-body').innerHTML = content.body;
  el('help-topic').classList.remove('hidden');

  // La carte s'ouvre en haut, sur le schema. Donner le focus au bouton de
  // fermeture sans `preventScroll` ferait defiler jusqu'en bas, et l'on
  // arriverait sur la fiche par sa fin.
  const card = el('help-topic').querySelector('.modal-card');
  if (card) card.scrollTop = 0;
  el('help-topic-close').focus({ preventScroll: true });
  openTopic = topicId;
}

export function closeHelp() {
  el('help-topic')?.classList.add('hidden');
  openTopic = null;
}

/**
 * Efface les boutons poses en dur dans le balisage dont la fiche n'existe pas.
 * Les boutons construits par script sont deja filtres a la source ; ceux
 * d'index.html, non.
 */
export function pruneInfoButtons(root = document) {
  for (const btn of root.querySelectorAll('[data-help]')) {
    if (btn.id === 'phase-label') continue; // ce n'est pas une pastille
    btn.hidden = !topicContent(btn.dataset.help);
  }
}

/** Pose les ecouteurs. A appeler une fois au demarrage. */
export function installHelp() {
  pruneInfoButtons();
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-help]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      openHelp(btn.dataset.help);
      return;
    }
    // Clic hors de la carte : on ferme.
    const modal = el('help-topic');
    if (modal && !modal.classList.contains('hidden') && e.target === modal) closeHelp();
  });

  el('help-topic-close')?.addEventListener('click', closeHelp);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHelp();
  });
}
