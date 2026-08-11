// Boite a outils de dessin des schemas pedagogiques.
//
// Tous les schemas partagent le meme langage visuel : meme grille, memes
// epaisseurs de trait, memes couleurs tirees des variables CSS du theme. Un
// schema qui code ses propres couleurs jure aussitot ; celui qui passe par ces
// primitives reste coherent avec le reste de l'interface, et suit
// automatiquement un changement de theme.
//
// Convention de couleurs, identique a celle du simulateur :
//   truth    (vert)  = la verite physique, inconnue du bord
//   estimate (ambre) = ce que le calculateur croit
//   accent   (bleu)  = la commande, l'ordre envoye
//   danger   (rouge) = l'objectif, l'erreur
//   dim/muted        = decor, axes, annotations

export const VB = { w: 480, h: 230 };

/** Enveloppe un contenu dans un SVG a l'echelle du panneau de fiche. */
export function svg(content, { w = VB.w, h = VB.h } = {}) {
  return `<svg class="help-fig" viewBox="0 0 ${w} ${h}" role="img" preserveAspectRatio="xMidYMid meet">
    <defs>
      <marker id="hArrow" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="context-stroke" />
      </marker>
    </defs>
    ${content}
  </svg>`;
}

const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** Repere cartesien avec fleches et libelles d'axes. */
export function axes(x0, y0, x1, y1, { xLabel = '', yLabel = '' } = {}) {
  return `
    <g class="fig-axis">
      <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" marker-end="url(#hArrow)" />
      <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" marker-end="url(#hArrow)" />
    </g>
    ${xLabel ? text(x1, y0 + 15, esc(xLabel), { anchor: 'end', cls: 'fig-axis-label' }) : ''}
    ${yLabel ? text(x0 - 4, y1 - 6, esc(yLabel), { anchor: 'start', cls: 'fig-axis-label' }) : ''}`;
}

/** Texte. `cls` choisit la couleur : fig-truth, fig-est, fig-cmd, fig-danger, fig-dim. */
export function text(x, y, s, { anchor = 'start', cls = 'fig-dim', size = null, weight = null } = {}) {
  const st = [size ? `font-size:${size}px` : '', weight ? `font-weight:${weight}` : ''].filter(Boolean).join(';');
  // Un libelle manquant s'efface. Voir « undefined » imprime sur un schema est
  // pire que ne rien voir : cela ressemble a une panne de l'application.
  const body = String(s ?? '').replace(/\bundefined\b/g, '').trim();
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}"${st ? ` style="${st}"` : ''}>${body}</text>`;
}

/** Courbe passant par une liste de points [[x,y], ...]. */
export function polyline(points, { cls = 'fig-line', dash = null, width = null } = {}) {
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<path d="${d}" class="${cls}" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''}${width ? ` stroke-width="${width}"` : ''} />`;
}

/** Echantillonne f sur [t0,t1] et projette dans le rectangle donne. */
export function curve(f, t0, t1, box, { cls = 'fig-line', dash = null, n = 60, yMax = null } = {}) {
  const xs = [];
  let peak = yMax;
  if (peak == null) {
    peak = 0;
    for (let i = 0; i <= n; i++) peak = Math.max(peak, f(t0 + ((t1 - t0) * i) / n));
  }
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const v = Math.min(1, peak > 0 ? f(t) / peak : 0);
    xs.push([box.x + (box.w * i) / n, box.y + box.h - v * box.h]);
  }
  return polyline(xs, { cls, dash });
}

export function arrow(x1, y1, x2, y2, { cls = 'fig-cmd', dash = null } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"
    marker-end="url(#hArrow)" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;
}

export function line(x1, y1, x2, y2, { cls = 'fig-dim', dash = null } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;
}

export function dot(x, y, { r = 3.5, cls = 'fig-danger-fill' } = {}) {
  return `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}" />`;
}

export function circle(x, y, r, { cls = 'fig-dim', dash = null } = {}) {
  return `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;
}

/** Arc de cercle, pour coter un angle. */
export function arc(cx, cy, r, a0, a1, { cls = 'fig-cmd', dash = null } = {}) {
  const p = (a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  return `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} ${sweep} ${x1.toFixed(1)},${y1.toFixed(1)}"
    class="${cls}" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''} />`;
}

/** Aplat translucide, pour une zone (tranche d'altitude, enveloppe d'incertitude). */
export function band(points, { cls = 'fig-band' } = {}) {
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<path d="${d} Z" class="${cls}" />`;
}

export function rect(x, y, w, h, { cls = 'fig-band', rx = 3 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}" />`;
}

/** Vignette de legende : un trait de couleur suivi d'un libelle. */
export function legend(x, y, entries) {
  return entries.map((e, i) => {
    const yy = y + i * 15;
    return `${line(x, yy, x + 16, yy, { cls: e.cls, dash: e.dash })}
      ${text(x + 22, yy + 3.5, esc(e.label), { cls: 'fig-dim', size: 10 })}`;
  }).join('');
}

/** Le sol, avec sa hachure — repere present dans presque tous les schemas. */
export function ground(x0, x1, y) {
  const ticks = [];
  for (let x = x0; x < x1; x += 9) ticks.push(line(x, y, x - 5, y + 5, { cls: 'fig-ground' }));
  return `${line(x0, y, x1, y, { cls: 'fig-ground' })}${ticks.join('')}`;
}

export { esc };
