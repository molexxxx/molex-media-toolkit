import { html } from 'zerolith';
import { ReleaseList } from './release-list.js';

/** The Changelog page: every release, newest first. */
export function Changelog()
{
    return html`
<div class="wrap">
    <header class="page-head">
        <h1>Changelog</h1>
        <p class="lead">Every release, newest first. Notes come from the project's CHANGELOG.md where it has an entry, and from the GitHub release otherwise.</p>
    </header>
    ${ReleaseList()}
</div>`;
}
