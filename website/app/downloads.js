import { computed, html, when } from 'zerolith';
import { icon } from './icons.js';
import { fmt } from './store.js';

export const PLATFORM_NAMES = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
const DOWNLOAD_PAGE = 'https://media.molex.cloud/download';

/**
 * Hands the download page link to the phone's share sheet, or copies it where sharing is not offered.
 * @returns {Promise<'shared'|'copied'|'canceled'|'failed'>}
 */
async function sendDownloadLink()
{
    if (navigator.share)
    {
        try
        {
            await navigator.share({ title: 'Download molexMedia', url: DOWNLOAD_PAGE });
            return 'shared';
        }
        catch (err)
        {
            if (err?.name === 'AbortError')
            {
                return 'canceled';
            }
        }
    }
    try
    {
        await navigator.clipboard.writeText(DOWNLOAD_PAGE);
        return 'copied';
    }
    catch
    {
        return 'failed';
    }
}

/**
 * The phone's send-to-computer button.
 * @param {import('zerolith').Signal<string>} sent Last result of sending the link, or ''.
 * @param {string} cls Button classes.
 */
export function SendLink(sent, cls)
{
    const glyph = computed(() => icon(sent.get() === 'copied' ? 'check' : 'share' in navigator ? 'link' : 'copy', 18));
    const label = computed(() => (sent.get() === 'copied' ? 'Link copied' : 'share' in navigator ? 'Send this link' : 'Copy link'));
    return html`<button type="button" class=${cls} @click=${async () => sent.set(await sendDownloadLink())}>${glyph}${label}</button>`;
}

/**
 * The link as text, shown when the browser blocked copying it.
 * @param {import('zerolith').Signal<string>} sent Last result of sending the link, or ''.
 */
export function SendLinkFallback(sent)
{
    return when(computed(() => sent.get() === 'failed'), () => html`<p class="get-file">This browser blocked copying. The link is <b class="mono">media.molex.cloud/download</b>.</p>`);
}

/**
 * An installer's file name and size, with an optional note.
 * @param {{name: string, size: number}} asset Release asset.
 * @param {string} [extra]
 */
export function fileMeta(asset, extra)
{
    return html`<b>${asset.name}</b>${` · ${fmt.bytes(asset.size)}${extra ? ` · ${extra}` : ''}`}`;
}
