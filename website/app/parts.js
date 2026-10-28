import { icon } from './icons.js';
import { SCREENS } from './screens.js';

export const MINUS = '−';

/**
 * Internal SPA link with a real href so it works without JavaScript and with modifier keys.
 * @param {string} path Route path.
 * @param {string} html Link content.
 * @param {string} [cls] Class list.
 */
export function link(path, html, cls = '')
{
    return `<a href="${path}" z-link="${path}" z-to-top${cls ? ` class="${cls}"` : ''}>${html}</a>`;
}

/**
 * A status word with its icon, in the app's status inks.
 * @param {'ready'|'queued'|'pending'|'analyzing'|'encoding'|'verifying'|'finalizing'|'done'|'warning'|'error'|'info'} status
 * @param {string} word Visible text.
 */
export function statusLabel(status, word)
{
    const glyph = {
        ready: 'pending', queued: 'queued', pending: 'pending',
        analyzing: 'spinner', encoding: 'spinner', verifying: 'spinner', finalizing: 'spinner',
        done: 'done', warning: 'warning', error: 'error', info: 'info',
    }[status] || 'pending';
    const spin = glyph === 'spinner' ? 'spin' : '';
    return `<span class="status" data-status="${status}">${icon(glyph, 14, undefined, spin)}<span>${word}</span></span>`;
}

/**
 * A finished job's stamp as the app draws it: the outcome icon and word, then the values measured in its output.
 * @param {'verified'|'returned'} outcome
 * @param {string} values Measured values, already formatted.
 */
export function stamp(outcome, values)
{
    const verified = outcome === 'verified';
    return `<span class="stamp" data-outcome="${outcome}">${icon(verified ? 'verified' : 'failed', 14)}<span class="word">${verified ? 'Verified' : 'Returned'}</span><span class="vals">${values}</span></span>`;
}

/**
 * A capture of the app as a figure. Wider screens get the whole window from a width ladder; phones get a crop of it
 * at a readable scale. Both come from scripts/website-screens.mjs.
 * @param {string} name Key in SCREENS.
 * @param {object} opts
 * @param {string} opts.alt Alternative text that holds for the whole window and for the phone crop.
 * @param {string} opts.caption Figure caption.
 * @param {string} opts.sizes Display width of the whole window, as a sizes list.
 * @param {boolean} [opts.priority] Loads at once with high priority, for an image in the first viewport.
 * @param {string} [opts.cls] Extra class names on the figure.
 */
export function screenshot(name, { alt, caption, sizes, priority = false, cls = '' })
{
    const s = SCREENS[name];
    const set = (stem, widths, ext) => widths.map((w) => `assets/screens/${stem}-${w}.${ext} ${w}w`).join(', ');
    const phone = (ext) => `<source media="(max-width: 760px)" type="image/${ext}" srcset="${set(`${name}-phone`, s.phone.widths, ext)}" sizes="calc(100vw - 32px)" width="${s.phone.width}" height="${s.phone.height}">`;
    const full = (ext) => `<source type="image/${ext}" srcset="${set(name, s.widths, ext)}" sizes="${sizes}">`;
    const fallback = s.widths.find((w) => w >= 1280) ?? s.width;
    const load = priority ? 'fetchpriority="high"' : 'loading="lazy"';
    return `<figure class="shot${cls ? ` ${cls}` : ''}"><picture>${phone('avif')}${phone('webp')}${full('avif')}${full('webp')}`
        + `<img src="assets/screens/${name}-${fallback}.webp" width="${s.width}" height="${s.height}" alt="${alt}" ${load} decoding="async"></picture>`
        + `<figcaption>${caption}</figcaption></figure>`;
}

const FOOTAGE = 'Video: Big Buck Bunny, Blender Foundation, CC BY 3.0.';

/**
 * The Editor capture, shown on Home and on the Editor page.
 * @param {string} sizes Display width of the whole window, as a sizes list.
 */
export function editorShot(sizes)
{
    return screenshot('editor', {
        alt: 'The Editor in Trim on a frame of Big Buck Bunny, above the In, Out, and Length readouts and the thumbnail strip.',
        caption: `Trim, with a section of 1:17 marked between the in and out points. ${FOOTAGE}`,
        sizes,
    });
}

/**
 * The Player capture, shown on Home and on the Player page.
 * @param {string} sizes Display width of the whole window, as a sizes list.
 */
export function playerShot(sizes)
{
    return screenshot('player', {
        alt: 'The Player paused on a frame of Big Buck Bunny, with the transport below it.',
        caption: `A local WebM in the Player, with its VP9 video and 5.1 Opus audio listed under the title. ${FOOTAGE}`,
        sizes,
    });
}

/**
 * Error or notice block with optional actions.
 * @param {string} title Bold first line.
 * @param {string} body Explanation.
 * @param {string} [actions] Action markup.
 */
export function notice(title, body, actions = '')
{
    return `<div class="state" data-kind="error" role="status">${icon('alert', 18)}<div><strong>${title}</strong> ${body}${actions ? `<div class="state-actions">${actions}</div>` : ''}</div></div>`;
}
