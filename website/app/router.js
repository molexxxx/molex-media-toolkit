import { effect } from 'zerolith';
import { createRouter } from '@zerolith/router';
import { NotFound } from './components/not-found.js';
import { routes } from './routes.js';
import { scrollPage } from './smooth.js';

/** The path and query of the page on screen. */
let shown = location.pathname + location.search;

/**
 * Leaves a history step within the page shown, such as a fragment typed into the address bar, to the browser instead
 * of letting the router render the page again. It is added before the router's own listener so it can stop it.
 * @param {PopStateEvent} e
 */
function onSamePagePop(e)
{
    if (location.pathname + location.search === shown)
    {
        e.stopImmediatePropagation();
    }
}

/**
 * Keeps a plain click on a link to the page shown from pushing a second history entry and rendering the page again;
 * it returns to the top instead.
 * @param {MouseEvent} e
 */
function onSamePageLink(e)
{
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    {
        return;
    }
    const link = e.target.closest?.('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download'))
    {
        return;
    }
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname + url.search === shown && !url.hash && !location.hash)
    {
        e.preventDefault();
        scrollPage(0, true);
    }
}

window.addEventListener('popstate', onSamePagePop);
document.addEventListener('click', onSamePageLink, true);

/**
 * The router, in its own module so components can import it for links while the route table imports the components.
 * Scrolling stays with app/smooth.js, which lands each route through the smooth scroller.
 * @type {import('@zerolith/router').Router<typeof routes>}
 */
export const router = createRouter(routes, { fallback: () => NotFound(), scroll: false });

effect(() =>
{
    const { pathname, search } = router.url.get();
    shown = pathname + search;
});
