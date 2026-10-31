import { computed, html, signal, when } from 'zerolith';
import { SendLink, SendLinkFallback } from '../downloads.js';
import { icon } from '../icons.js';
import { notice, skeleton } from '../parts.js';
import {
    LATEST_URL, RELEASES_URL, detectPlatform, fmt, latestFiles, linuxPackage, releases, releasesFailed, releasesLoading,
    retryFailedReleases,
} from '../store.js';

/**
 * Every system's installers with their sizes, the detected system first in emphasis; with `detail`, each row also
 * carries the file name and the install steps.
 * @param {object} [props]
 * @param {boolean} [props.detail] Shows the install steps under each system.
 */
export function PlatformList({ detail = false } = {})
{
    retryFailedReleases();
    const detected = detectPlatform();
    const pkg = linuxPackage();
    const copied = signal('');
    const sent = signal('');
    let copyTimer;

    const commands = computed(() =>
    {
        const files = latestFiles.get();
        return {
            appimage: files.appimage ? `chmod +x ./${files.appimage.name} && ./${files.appimage.name}` : '',
            deb: `sudo apt install ./${files.deb?.name || 'molexMedia-VERSION-Linux-Installer.deb'}`,
            rpm: `sudo dnf install ./${files.rpm?.name || 'molexMedia-VERSION-Linux-Installer.rpm'}`,
        };
    });

    /**
     * Copies a command line and shows that it did for two seconds.
     * @param {'appimage'|'deb'|'rpm'} kind
     */
    async function copy(kind)
    {
        try
        {
            await navigator.clipboard.writeText(commands.get()[kind]);
            copied.set(kind);
            clearTimeout(copyTimer);
            copyTimer = setTimeout(() => copied.set(''), 2000);
        }
        catch
        {
            copied.set('');
        }
    }

    const size = (asset) => (asset ? fmt.bytes(asset.size) : '');
    const spec = (parts) => computed(() => (releasesLoading.get() ? skeleton('24ch') : parts(latestFiles.get()).filter(Boolean).join(' · ')));
    const button = (kind, label, primary) => html`<a class=${primary ? 'btn btn-primary' : 'btn btn-secondary'} href=${computed(() => latestFiles.get()[kind]?.browser_download_url ?? LATEST_URL)}>${icon('download', 16)}${label}</a>`;
    const file = (kind) => computed(() =>
    {
        const asset = latestFiles.get()[kind];
        return asset ? html`<p class="plat-file">${asset.name}</p>` : null;
    });
    const cmd = (kind) => html`<div class="cmd"><code data-cmd=${kind}>${computed(() => commands.get()[kind])}</code><button type="button" class="copy" @click=${() => copy(kind)}>${computed(() => icon(copied.get() === kind ? 'check' : 'copy', 14))}${computed(() => (copied.get() === kind ? 'Copied' : 'Copy'))}</button></div>`;
    const row = (p, name, specView, purpose, buttons, help) => html`<div class="plat" data-detected=${String(detected === p)}>
                <div class="plat-main">
                    <h3 class="plat-name">${name}${p === detected ? html`<span class="plat-you">Your system</span>` : null}</h3>
                    <p class="plat-spec">${specView}</p>
                    <p class="plat-purpose">${purpose}</p>
                </div>
                <div class="plat-actions">${buttons}</div>
                ${detail ? html`<div class="plat-help">${help()}</div>` : null}
            </div>`;

    const appImage = computed(() => Boolean(latestFiles.get().appimage));
    const either = (withAppImage, without) => computed(() => (appImage.get() ? withAppImage : without));
    const linux = row('linux', 'Linux',
        spec((files) => ['x64', files.appimage && `AppImage ${size(files.appimage)}`, files.deb ? `.deb ${size(files.deb)}` : '.deb', files.rpm ? `.rpm ${size(files.rpm)}` : '.rpm']),
        either('The AppImage runs on most distributions and updates itself. .deb for Debian and Ubuntu, .rpm for Fedora and openSUSE.', '.deb for Debian and Ubuntu, .rpm for Fedora and openSUSE.'),
        computed(() => (appImage.get()
            ? [button('appimage', 'AppImage', detected === 'linux'), button('deb', '.deb', false), button('rpm', '.rpm', false)]
            : [button('deb', '.deb', detected === 'linux' && pkg === 'deb'), button('rpm', '.rpm', detected === 'linux' && pkg === 'rpm')])),
        () => html`${when(appImage, () => [file('appimage'), html`<p>Make the AppImage executable and run it:</p>`, cmd('appimage')])}<p>${either('Or install a package from the folder you saved it to:', 'Install the package from the folder you saved it to:')}</p>${cmd('deb')}${cmd('rpm')}<p>${either('The AppImage updates itself like the Windows and macOS builds. The .deb and .rpm packages do not; download the new package when a release comes out.', 'Linux packages do not update themselves. Download the new package when a release comes out.')}</p>`);

    const rows = [
        row('windows', 'Windows',
            spec((files) => ['x64', '.exe installer', size(files.windows)]),
            'Choose the install folder. Updates itself from GitHub Releases.',
            [button('windows', 'Download .exe', detected === 'windows' || detected === 'unknown')],
            () => html`${file('windows')}<p>The installer is not code-signed, so Windows SmartScreen may say it protected your PC. Choose <strong>More info</strong>, then <strong>Run anyway</strong>.</p>`),
        row('mac', 'macOS',
            spec((files) => ['Universal', '.dmg', size(files.mac)]),
            'Runs natively on Apple Silicon and Intel. Updates itself from GitHub Releases.',
            [button('mac', 'Download .dmg', detected === 'mac')],
            () => html`${file('mac')}<p>Open the disk image and drag molexMedia to Applications. On Apple Silicon the app installs FFmpeg 7.1.1 rather than 9.0.2: the newer arm64 builds misread the loudness of surround sound, and 7.1.1 measures it correctly.</p>`),
        linux,
    ];

    const head = when(releasesFailed, () => notice('Release details did not load.', 'The buttons below open the latest release on GitHub instead.', html`<button type="button" class="link-btn" @click=${() => releases.reload()}>Try again</button><a href=${RELEASES_URL} rel="noopener">All releases on GitHub</a>`));
    const mobile = detected === 'mobile'
        ? html`<div class="get-note phone-note"><p><strong>You are on a phone or tablet.</strong> molexMedia runs on Windows, macOS, and Linux desktops. Send this page to your computer and download it there.</p>${SendLink(sent, 'btn btn-primary')}${SendLinkFallback(sent)}</div>`
        : null;

    return html`<div>${head}${mobile}<div class="platforms">${rows}</div></div>`;
}
