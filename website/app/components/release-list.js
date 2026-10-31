import { computed, each, html, unsafeHtml, when } from 'zerolith';
import { notice, skeleton } from '../parts.js';
import {
    RELEASES_URL, escapeHtml, fmt, installers, markdown, notes, published, releaseSummary, releases, releasesFailed,
    releasesLoading, requestNotes, retryFailedReleases,
} from '../store.js';

const DOWNLOADS = [['windows', 'Windows'], ['mac', 'macOS'], ['deb', 'Linux .deb'], ['rpm', 'Linux .rpm']];

/**
 * The notes for a version from CHANGELOG.md as HTML: one entry as it is, several under their own titles.
 * @param {Record<string, {title: string, body: string}[]>} byVersion
 * @param {string} ver
 * @returns {string}
 */
function noteBody(byVersion, ver)
{
    const entries = byVersion[ver];
    if (!entries?.length)
    {
        return '';
    }
    if (entries.length === 1)
    {
        return markdown(entries[0].body);
    }
    return entries.map((e) => `<h3>${escapeHtml(e.title || ver)}</h3>${markdown(e.body)}`).join('');
}

/**
 * A field of a row as its own signal, so an update to the row touches only what changed.
 * @param {import('zerolith').ReadableSignal<object>} row
 * @param {string} name
 */
function field(row, name)
{
    return computed(() => row.get()[name]);
}

/**
 * A published release: its notes from CHANGELOG.md, or from the GitHub release when the changelog has no entry.
 * @param {import('zerolith').ReadableSignal<object>} row
 */
function ReleaseRow(row)
{
    const body = field(row, 'body');
    return html`<details class="rel" ?open=${field(row, 'open')}>
                    <summary class="rel-sum">
                        <span class="rel-ver">${field(row, 'ver')}</span>
                        <h2 class="rel-title">${field(row, 'title')}${when(field(row, 'latest'), () => html`<span class="rel-latest-tag">Latest</span>`)}</h2>
                        <time class="rel-date" datetime=${field(row, 'published')}>${field(row, 'date')}</time>
                    </summary>
                    <div class="rel-body">
                        <div class="prose">${computed(() => unsafeHtml(body.get()))}</div>
                        <p class="rel-links">${computed(() => row.get().links.map((l) => html`<a href=${l.href}>${l.label}</a>`))}<a href=${field(row, 'url')} rel="noopener">Release on GitHub</a></p>
                    </div>
                </details>`;
}

/**
 * A version known only from CHANGELOG.md, shown when the release data did not load.
 * @param {import('zerolith').ReadableSignal<object>} row
 */
function NoteRow(row)
{
    const body = field(row, 'body');
    return html`<details class="rel" ?open=${field(row, 'open')}>
                    <summary class="rel-sum"><span class="rel-ver">${field(row, 'ver')}</span><h2 class="rel-title">${field(row, 'title')}</h2><span class="rel-date">${field(row, 'date')}</span></summary>
                    <div class="rel-body"><div class="prose">${computed(() => unsafeHtml(body.get()))}</div></div>
                </details>`;
}

/** Every release, newest first, with its notes, downloads, and a link to it on GitHub. */
export function ReleaseList()
{
    retryFailedReleases();
    requestNotes();
    const byVersion = computed(() => notes.get() ?? {});
    const notesReady = computed(() => notes.status.get() === 'resolved');
    const loading = computed(() => releasesLoading.get() || ['idle', 'pending'].includes(notes.status.get()));

    const releaseRows = computed(() => published.get().map((r, i) =>
    {
        const ver = fmt.version(r);
        const files = installers(r);
        return {
            key: `release:${r.tag_name}`,
            open: i === 0,
            latest: i === 0,
            ver,
            title: byVersion.get()[ver]?.[0]?.title || (r.name || '').replace(/^v?[\d.]+\s*[-:]?\s*/i, '') || releaseSummary(r.body),
            body: noteBody(byVersion.get(), ver) || markdown(r.body || '') || '<p>No notes were published for this release.</p>',
            published: r.published_at || '',
            date: fmt.date(r.published_at),
            links: DOWNLOADS.filter(([k]) => files[k]).map(([k, label]) => ({ href: files[k].browser_download_url, label: `${label} (${fmt.bytes(files[k].size)})` })),
            url: r.html_url,
        };
    }));
    const noteRows = computed(() => (published.get().length || !notesReady.get() ? [] : Object.entries(byVersion.get()).map(([ver, entries], i) => ({
        key: `notes:${ver}`,
        open: i === 0,
        ver,
        title: entries[0].title || ver,
        body: noteBody(byVersion.get(), ver),
        date: fmt.date(entries[0].date),
    }))));
    const mode = computed(() =>
    {
        if (loading.get() && !published.get().length)
        {
            return 'loading';
        }
        return releaseRows.get().length || noteRows.get().length ? 'rows' : 'empty';
    });

    const retry = () =>
    {
        releases.reload();
        notes.reload();
    };
    const failed = () => notice('Release data did not load.', computed(() => (published.get().length || notesReady.get() ? 'Showing the notes that did load.' : 'Every release is still listed on GitHub.')), html`<button type="button" class="link-btn" @click=${retry}>Try again</button><a href=${RELEASES_URL} rel="noopener">Releases on GitHub</a>`);
    const empty = () => notice('Nothing to show yet.', 'No releases were found.', html`<a href=${RELEASES_URL} rel="noopener">Releases on GitHub</a>`);

    return html`${computed(() =>
    {
        switch (mode.get())
        {
            case 'loading':
                return html`<div class="rel-list" aria-busy="true">${[1, 2, 3].map(() => html`<div class="rel"><div class="rel-sum">${skeleton('6ch')}${skeleton('28ch')}${skeleton('14ch')}</div></div>`)}</div>`;
            case 'rows':
                return html`<div class="rel-list">${when(releasesFailed, failed)}${each(releaseRows, (r) => r.key, ReleaseRow)}${each(noteRows, (r) => r.key, NoteRow)}</div>`;
            default:
                return html`<div class="rel-list">${when(releasesFailed, failed, empty)}</div>`;
        }
    })}`;
}
