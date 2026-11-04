import { defineRoutes, route } from '@zerolith/router';
import { Batch } from './components/batch.js';
import { Changelog } from './components/changelog.js';
import { Download } from './components/download.js';
import { Editor } from './components/editor.js';
import { Features } from './components/features.js';
import { Home } from './components/home.js';
import { Player } from './components/player.js';

const HOME_DESCRIPTION = 'molexMedia is a free desktop app for Windows, macOS, and Linux. It normalizes, converts, and compresses batches of media to named standards, trims and edits on a timeline, and plays files and links, all on FFmpeg.';

/** The head for an address no route matches, given to the router as the fallback's head. */
export const NOT_FOUND = { title: 'Page not found | molexMedia', description: HOME_DESCRIPTION };

export const routes = defineRoutes({
    home: route({
        path: '/',
        view: () => Home(),
        head: {
            title: 'molexMedia: batch, trim, and play media on FFmpeg',
            description: HOME_DESCRIPTION,
        },
    }),
    features: route({
        path: '/features',
        view: () => Features(),
        head: {
            title: 'Features | molexMedia',
            description: 'What Batch, the Editor, and the Player do, plus first-run setup, hardware encoding, logs, and updates.',
        },
    }),
    batch: route({
        path: '/features/batch',
        view: () => Batch(),
        head: {
            title: 'Batch | molexMedia',
            description: 'Normalize to named loudness standards, apply gain, convert, compress, and extract across a queue, with a Review step and a measured stamp on every finished job.',
        },
    }),
    editor: route({
        path: '/features/editor',
        view: () => Editor(),
        head: {
            title: 'Editor | molexMedia',
            description: 'Trim one file between in and out points, arrange clips from several files on a timeline, and inspect streams and tags.',
        },
    }),
    player: route({
        path: '/features/player',
        view: () => Player(),
        head: {
            title: 'Player | molexMedia',
            description: 'Play local files and links through yt-dlp, with video, subtitles, audio tracks, real full screen, visualizations, and a pop-out window.',
        },
    }),
    download: route({
        path: '/download',
        view: () => Download(),
        head: {
            title: 'Download | molexMedia',
            description: 'Download molexMedia for Windows, macOS, or Linux, with install notes for each system.',
        },
    }),
    changelog: route({
        path: '/changelog',
        view: () => Changelog(),
        head: {
            title: 'Changelog | molexMedia',
            description: 'Every molexMedia release and what changed.',
        },
    }),
});
