import { icon } from './icons.js';
import {
    store, loadReleases, loadNotes, installers, detectPlatform, linuxPackage, fmt, markdown, releaseSummary,
    LATEST_URL, RELEASES_URL,
} from './store.js';
import { link, notice } from './parts.js';

const PLATFORM_NAMES = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };
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
 * The phone's send-to-computer button and, when copying is blocked, the link as text.
 * @param {string} sent Last result of sendDownloadLink, or ''.
 * @param {string} cls Button classes.
 */
function sendLinkControl(sent, cls)
{
    const share = 'share' in navigator;
    const label = sent === 'copied' ? 'Link copied' : share ? 'Send this link' : 'Copy link';
    const glyph = sent === 'copied' ? 'check' : share ? 'link' : 'copy';
    const fallback = sent === 'failed'
        ? '<p class="get-file">This browser blocked copying. The link is <b class="mono">media.molex.cloud/download</b>.</p>'
        : '';
    return { button: `<button type="button" class="${cls}" @click="sendLink">${icon(glyph, 18)}${label}</button>`, fallback };
}

/**
 * Subscribes a component to the release store for its lifetime.
 * @param {object} cmp Component instance with a numeric state.tick.
 */
function watchStore(cmp)
{
    cmp._unsub = store.subscribe(() =>
    {
        cmp.state.tick++;
    });
}

function releaseState()
{
    const { status } = store.state;
    const rel = store.getters.latest;
    return {
        loading: status === 'idle' || status === 'loading',
        failed: status === 'error',
        rel,
        files: installers(rel),
        version: fmt.version(rel),
    };
}

function fileMeta(asset, extra)
{
    return `<b>${$.escapeHtml(asset.name)}</b> · ${fmt.bytes(asset.size)}${extra ? ` · ${extra}` : ''}`;
}

$.component('get-block', {
    state: () => ({ tick: 0, sent: '' }),

    mounted()
    {
        watchStore(this);
        loadReleases();
    },

    destroyed()
    {
        this._unsub?.();
    },

    retry()
    {
        loadReleases(true);
    },

    async sendLink()
    {
        this.state.sent = await sendDownloadLink();
    },

    render()
    {
        const platform = detectPlatform();
        const { loading, failed, files, version } = releaseState();
        const terms = '<p class="get-terms">Free and open source under the MIT license. No account needed.</p>';
        const more = `<p class="get-more">${link('/download', 'Other platforms and install notes')}${version ? link('/changelog', `What is new in ${version}`) : ''}</p>`;
        const retry = failed
            ? `<p class="get-file">Release details did not load, so the button opens the latest release on GitHub. <button type="button" class="link-btn" @click="retry">Try again</button></p>`
            : '';

        if (platform === 'mobile')
        {
            const send = sendLinkControl(this.state.sent, 'btn btn-primary btn-lg');
            return `<div class="get">
                <p class="get-note"><strong>molexMedia is a desktop app</strong> for Windows, macOS, and Linux. Send this page to your computer and download it there.</p>
                <p class="get-more get-phone">${send.button}${link('/download', 'See every download')}</p>
                ${send.fallback}${terms}
            </div>`;
        }

        if (platform === 'linux' && files.appimage)
        {
            const pkgLink = (kind) => (files[kind] ? `<a href="${$.escapeHtml(files[kind].browser_download_url)}">.${kind}</a>` : `.${kind}`);
            return `<div class="get">
                <a class="btn btn-primary btn-lg" href="${$.escapeHtml(files.appimage.browser_download_url)}">${icon('download', 20)}Download for Linux</a>
                <p class="get-meta">${fileMeta(files.appimage, 'x64 AppImage')}</p>
                <p class="get-file">The AppImage runs on most distributions and updates itself. Or install the ${pkgLink('deb')} or ${pkgLink('rpm')} package.</p>
                ${retry}${terms}${more}
            </div>`;
        }

        if (platform === 'linux')
        {
            const first = linuxPackage();
            const second = first === 'deb' ? 'rpm' : 'deb';
            const btn = (kind, cls) =>
            {
                const asset = files[kind];
                return `<a class="btn ${cls}" href="${asset ? $.escapeHtml(asset.browser_download_url) : LATEST_URL}">${icon('download', 18)}Download .${kind}</a>`;
            };
            const meta = loading
                ? '<span class="skel" style="--w:26ch"></span>'
                : files[first] ? fileMeta(files[first], 'x64') : '';
            return `<div class="get">
                <p class="get-more">${btn(first, 'btn-primary btn-lg')}${btn(second, 'btn-secondary btn-lg')}</p>
                <p class="get-meta">${meta}</p>
                <p class="get-file">.deb for Debian and Ubuntu, .rpm for Fedora and openSUSE.</p>
                ${retry}${terms}${more}
            </div>`;
        }

        if (platform === 'windows' || platform === 'mac')
        {
            const asset = platform === 'windows' ? files.windows : files.mac;
            const extra = platform === 'windows' ? 'x64 installer' : 'Universal: Apple Silicon and Intel';
            const meta = loading
                ? '<span class="skel" style="--w:30ch"></span>'
                : asset ? fileMeta(asset, extra) : '';
            return `<div class="get">
                <a class="btn btn-primary btn-lg" href="${asset ? $.escapeHtml(asset.browser_download_url) : LATEST_URL}">${icon('download', 20)}Download for ${PLATFORM_NAMES[platform]}</a>
                <p class="get-meta">${meta}</p>
                ${retry}${terms}${more}
            </div>`;
        }

        return `<div class="get">
            ${link('/download', `${icon('download', 20)}Choose your download`, 'btn btn-primary btn-lg')}
            ${terms}
        </div>`;
    },
});

$.component('platform-list', {
    state: () => ({ tick: 0, copied: '', sent: '' }),

    mounted()
    {
        watchStore(this);
        loadReleases();
    },

    destroyed()
    {
        this._unsub?.();
        clearTimeout(this._copyTimer);
    },

    retry()
    {
        loadReleases(true);
    },

    async copy(kind)
    {
        const cmd = this._el.querySelector(`[data-cmd="${kind}"]`)?.textContent || '';
        try
        {
            await navigator.clipboard.writeText(cmd);
            this.state.copied = kind;
            clearTimeout(this._copyTimer);
            this._copyTimer = setTimeout(() =>
            {
                this.state.copied = '';
            }, 2000);
        }
        catch
        {
            this.state.copied = '';
        }
    },

    async sendLink()
    {
        this.state.sent = await sendDownloadLink();
    },

    render()
    {
        const detail = this.props.detail === true || this.props.detail === 'true';
        const detected = detectPlatform();
        const pkg = linuxPackage();
        const { loading, failed, files } = releaseState();

        const spec = (parts) => (loading ? '<span class="skel" style="--w:24ch"></span>' : parts.filter(Boolean).join(' · '));
        const size = (asset) => (asset ? fmt.bytes(asset.size) : '');
        const button = (asset, label, primary) =>
            `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" href="${asset ? $.escapeHtml(asset.browser_download_url) : LATEST_URL}">${icon('download', 16)}${label}</a>`;
        const file = (asset) => (asset ? `<p class="plat-file">${$.escapeHtml(asset.name)}</p>` : '');
        const cmd = (kind, text) => `<div class="cmd"><code data-cmd="${kind}">${$.escapeHtml(text)}</code><button type="button" class="copy" @click="copy('${kind}')">${icon(this.state.copied === kind ? 'check' : 'copy', 14)}${this.state.copied === kind ? 'Copied' : 'Copy'}</button></div>`;
        const row = (p, name, specHtml, purpose, buttons, help) => `<div class="plat" data-detected="${detected === p}">
                <div class="plat-main">
                    <h3 class="plat-name">${name}${p === detected ? '<span class="plat-you">Your system</span>' : ''}</h3>
                    <p class="plat-spec">${specHtml}</p>
                    <p class="plat-purpose">${purpose}</p>
                </div>
                <div class="plat-actions">${buttons.join('')}</div>
                ${detail ? `<div class="plat-help">${help}</div>` : ''}
            </div>`;

        const rows = [
            row('windows', 'Windows',
                spec(['x64', '.exe installer', size(files.windows)]),
                'Choose the install folder. Updates itself from GitHub Releases.',
                [button(files.windows, 'Download .exe', detected === 'windows' || detected === 'unknown')],
                `${file(files.windows)}<p>The installer is not code-signed, so Windows SmartScreen may say it protected your PC. Choose <strong>More info</strong>, then <strong>Run anyway</strong>.</p>`),
            row('mac', 'macOS',
                spec(['Universal', '.dmg', size(files.mac)]),
                'Runs natively on Apple Silicon and Intel. Updates itself from GitHub Releases.',
                [button(files.mac, 'Download .dmg', detected === 'mac')],
                `${file(files.mac)}<p>Open the disk image and drag molexMedia to Applications. On Apple Silicon the app installs FFmpeg 7.1.1 rather than 9.0.2: the newer arm64 builds misread the loudness of surround sound, and 7.1.1 measures it correctly.</p>`),
            files.appimage
                ? row('linux', 'Linux',
                    spec(['x64', `AppImage ${size(files.appimage)}`, files.deb ? `.deb ${size(files.deb)}` : '.deb', files.rpm ? `.rpm ${size(files.rpm)}` : '.rpm']),
                    'The AppImage runs on most distributions and updates itself. .deb for Debian and Ubuntu, .rpm for Fedora and openSUSE.',
                    [button(files.appimage, 'AppImage', detected === 'linux'), button(files.deb, '.deb', false), button(files.rpm, '.rpm', false)],
                    `${file(files.appimage)}<p>Make the AppImage executable and run it:</p>${cmd('appimage', `chmod +x ./${files.appimage.name} && ./${files.appimage.name}`)}<p>Or install a package from the folder you saved it to:</p>${cmd('deb', `sudo apt install ./${files.deb?.name || 'molexMedia-VERSION-Linux-Installer.deb'}`)}${cmd('rpm', `sudo dnf install ./${files.rpm?.name || 'molexMedia-VERSION-Linux-Installer.rpm'}`)}<p>The AppImage updates itself like the Windows and macOS builds. The .deb and .rpm packages do not; download the new package when a release comes out.</p>`)
                : row('linux', 'Linux',
                    spec(['x64', files.deb ? `.deb ${size(files.deb)}` : '.deb', files.rpm ? `.rpm ${size(files.rpm)}` : '.rpm']),
                    '.deb for Debian and Ubuntu, .rpm for Fedora and openSUSE.',
                    [button(files.deb, '.deb', detected === 'linux' && pkg === 'deb'), button(files.rpm, '.rpm', detected === 'linux' && pkg === 'rpm')],
                    `<p>Install the package from the folder you saved it to:</p>${cmd('deb', `sudo apt install ./${files.deb?.name || 'molexMedia-VERSION-Linux-Installer.deb'}`)}${cmd('rpm', `sudo dnf install ./${files.rpm?.name || 'molexMedia-VERSION-Linux-Installer.rpm'}`)}<p>Linux packages do not update themselves. Download the new package when a release comes out.</p>`),
        ];

        const head = failed
            ? notice('Release details did not load.', 'The buttons below open the latest release on GitHub instead.', `<button type="button" class="link-btn" @click="retry">Try again</button><a href="${RELEASES_URL}" rel="noopener">All releases on GitHub</a>`)
            : '';
        let mobile = '';
        if (detected === 'mobile')
        {
            const send = sendLinkControl(this.state.sent, 'btn btn-primary');
            mobile = `<div class="get-note phone-note"><p><strong>You are on a phone or tablet.</strong> molexMedia runs on Windows, macOS, and Linux desktops. Send this page to your computer and download it there.</p>${send.button}${send.fallback}</div>`;
        }

        return `<div>${head}${mobile}<div class="platforms">${rows.join('')}</div></div>`;
    },
});

$.component('release-list', {
    state: () => ({ tick: 0 }),

    mounted()
    {
        watchStore(this);
        loadReleases();
        loadNotes();
    },

    destroyed()
    {
        this._unsub?.();
    },

    retry()
    {
        loadReleases(true);
        loadNotes(true);
    },

    render()
    {
        const { status, notes, notesStatus } = store.state;
        const releases = store.getters.published;
        const loadingAny = status === 'idle' || status === 'loading' || notesStatus === 'idle' || notesStatus === 'loading';

        if (loadingAny && !releases.length)
        {
            return `<div class="rel-list" aria-busy="true">${[1, 2, 3].map(() => `<div class="rel"><div class="rel-sum"><span class="skel" style="--w:6ch"></span><span class="skel" style="--w:28ch"></span><span class="skel" style="--w:14ch"></span></div></div>`).join('')}</div>`;
        }

        const noteBody = (ver) =>
        {
            const entries = notes[ver];
            if (!entries?.length)
            {
                return '';
            }
            if (entries.length === 1)
            {
                return markdown(entries[0].body);
            }
            return entries.map((e) => `<h3>${$.escapeHtml(e.title || ver)}</h3>${markdown(e.body)}`).join('');
        };

        let items;
        if (releases.length)
        {
            items = releases.map((r, i) =>
            {
                const ver = fmt.version(r);
                const entry = notes[ver]?.[0];
                const title = entry?.title || (r.name || '').replace(/^v?[\d.]+\s*[-:]?\s*/i, '') || releaseSummary(r.body);
                const body = noteBody(ver) || markdown(r.body || '') || '<p>No notes were published for this release.</p>';
                const files = installers(r);
                const dl = [['windows', 'Windows'], ['mac', 'macOS'], ['deb', 'Linux .deb'], ['rpm', 'Linux .rpm']]
                    .filter(([k]) => files[k])
                    .map(([k, label]) => `<a href="${$.escapeHtml(files[k].browser_download_url)}">${label} (${fmt.bytes(files[k].size)})</a>`)
                    .join('');
                return `<details class="rel" ${i === 0 ? 'open' : ''}>
                    <summary class="rel-sum">
                        <span class="rel-ver">${ver}</span>
                        <h2 class="rel-title">${$.escapeHtml(title)}${i === 0 ? '<span class="rel-latest-tag">Latest</span>' : ''}</h2>
                        <time class="rel-date" datetime="${r.published_at || ''}">${fmt.date(r.published_at)}</time>
                    </summary>
                    <div class="rel-body">
                        <div class="prose">${body}</div>
                        <p class="rel-links">${dl}<a href="${$.escapeHtml(r.html_url)}" rel="noopener">Release on GitHub</a></p>
                    </div>
                </details>`;
            }).join('');
        }
        else if (notesStatus === 'ready')
        {
            items = Object.entries(notes).map(([ver, entries], i) => `<details class="rel" ${i === 0 ? 'open' : ''}>
                    <summary class="rel-sum"><span class="rel-ver">${$.escapeHtml(ver)}</span><h2 class="rel-title">${$.escapeHtml(entries[0].title || ver)}</h2><span class="rel-date">${fmt.date(entries[0].date)}</span></summary>
                    <div class="rel-body"><div class="prose">${noteBody(ver)}</div></div>
                </details>`).join('');
        }

        const failed = status === 'error';
        const head = failed
            ? notice('Release data did not load.', releases.length || notesStatus === 'ready' ? 'Showing the notes that did load.' : 'Every release is still listed on GitHub.', `<button type="button" class="link-btn" @click="retry">Try again</button><a href="${RELEASES_URL}" rel="noopener">Releases on GitHub</a>`)
            : '';

        if (!items)
        {
            return `<div class="rel-list">${head || notice('Nothing to show yet.', 'No releases were found.', `<a href="${RELEASES_URL}" rel="noopener">Releases on GitHub</a>`)}</div>`;
        }
        return `<div class="rel-list">${head}${items}</div>`;
    },
});
