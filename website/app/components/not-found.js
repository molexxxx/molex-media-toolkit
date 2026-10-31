import { html } from 'zerolith';
import { icon } from '../icons.js';
import { link } from '../parts.js';
import { router } from '../router.js';

/** The page for an address no route matches, with links to the pages that exist. */
export function NotFound()
{
    return html`
<div class="wrap nf">
    <h1>This page does not exist.</h1>
    <p class="lead">The link may be old, or the address may have a typo. These are the pages that do exist:</p>
    <p class="get-more">
        ${link(router.href('home'), 'Home', 'btn btn-secondary')}
        ${link(router.href('features'), 'Features', 'btn btn-secondary')}
        ${link(router.href('download'), html`${icon('download', 16)}Download`, 'btn btn-primary')}
    </p>
</div>`;
}
