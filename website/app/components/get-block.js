import { computed, html, signal, when } from 'zerolith';
import { PLATFORM_NAMES, SendLink, SendLinkFallback, fileMeta } from '../downloads.js';
import { icon } from '../icons.js';
import { link, skeleton } from '../parts.js';
import { router } from '../router.js';
import {
    LATEST_URL, detectPlatform, latestFiles, latestVersion, linuxPackage, releases, releasesFailed, releasesLoading,
    retryFailedReleases,
} from '../store.js';

/**
 * The download for the visitor's system: the installer button with its file name and size, or on a phone a way to
 * send the page to a computer.
 */
export function GetBlock()
{
    retryFailedReleases();
    const platform = detectPlatform();
    const href = (kind) => computed(() => latestFiles.get()[kind]?.browser_download_url ?? LATEST_URL);
    const terms = () => html`<p class="get-terms">Free and open source under the MIT license. No account needed.</p>`;
    const more = () => html`<p class="get-more">${link(router.href('download'), 'Other platforms and install notes')}${when(latestVersion, () => link(router.href('changelog'), computed(() => `What is new in ${latestVersion.get()}`)))}</p>`;
    const retry = () => when(releasesFailed, () => html`<p class="get-file">Release details did not load, so the button opens the latest release on GitHub. <button type="button" class="link-btn" @click=${() => releases.reload()}>Try again</button></p>`);

    if (platform === 'mobile')
    {
        const sent = signal('');
        return html`<div class="get">
                <p class="get-note"><strong>molexMedia is a desktop app</strong> for Windows, macOS, and Linux. Send this page to your computer and download it there.</p>
                <p class="get-more get-phone">${SendLink(sent, 'btn btn-primary btn-lg')}${link(router.href('download'), 'See every download')}</p>
                ${SendLinkFallback(sent)}${terms()}
            </div>`;
    }

    if (platform === 'linux')
    {
        const appImage = () =>
        {
            const pkgLink = (kind) => computed(() =>
            {
                const asset = latestFiles.get()[kind];
                return asset ? html`<a href=${asset.browser_download_url}>.${kind}</a>` : `.${kind}`;
            });
            return html`<div class="get">
                <a class="btn btn-primary btn-lg" href=${href('appimage')}>${icon('download', 20)}Download for Linux</a>
                <p class="get-meta">${computed(() => fileMeta(latestFiles.get().appimage, 'x64 AppImage'))}</p>
                <p class="get-file">The AppImage runs on most distributions and updates itself. Or install the ${pkgLink('deb')} or ${pkgLink('rpm')} package.</p>
                ${retry()}${terms()}${more()}
            </div>`;
        };
        const packages = () =>
        {
            const first = linuxPackage();
            const second = first === 'deb' ? 'rpm' : 'deb';
            const btn = (kind, cls) => html`<a class=${`btn ${cls}`} href=${href(kind)}>${icon('download', 18)}Download .${kind}</a>`;
            const meta = computed(() =>
            {
                const asset = latestFiles.get()[first];
                return releasesLoading.get() ? skeleton('26ch') : asset ? fileMeta(asset, 'x64') : null;
            });
            return html`<div class="get">
                <p class="get-more">${btn(first, 'btn-primary btn-lg')}${btn(second, 'btn-secondary btn-lg')}</p>
                <p class="get-meta">${meta}</p>
                <p class="get-file">.deb for Debian and Ubuntu, .rpm for Fedora and openSUSE.</p>
                ${retry()}${terms()}${more()}
            </div>`;
        };
        return html`${when(computed(() => Boolean(latestFiles.get().appimage)), appImage, packages)}`;
    }

    if (platform === 'windows' || platform === 'mac')
    {
        const kind = platform === 'windows' ? 'windows' : 'mac';
        const extra = platform === 'windows' ? 'x64 installer' : 'Universal: Apple Silicon and Intel';
        const meta = computed(() =>
        {
            const asset = latestFiles.get()[kind];
            return releasesLoading.get() ? skeleton('30ch') : asset ? fileMeta(asset, extra) : null;
        });
        return html`<div class="get">
                <a class="btn btn-primary btn-lg" href=${href(kind)}>${icon('download', 20)}${`Download for ${PLATFORM_NAMES[platform]}`}</a>
                <p class="get-meta">${meta}</p>
                ${retry()}${terms()}${more()}
            </div>`;
    }

    return html`<div class="get">
            ${link(router.href('download'), html`${icon('download', 20)}Choose your download`, 'btn btn-primary btn-lg')}
            ${terms()}
        </div>`;
}
