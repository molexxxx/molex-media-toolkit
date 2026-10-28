/** The vendored Lenis build, loaded at run time so it stays byte for byte as published (vendor/lenis/README.md). */
const LENIS_URL = new URL('vendor/lenis/lenis.mjs', document.baseURI).href;

const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');

/** The running smooth scroller, or null under reduced motion. */
let lenis = null;

/** Whether the wheel gesture being handled is mostly sideways; read before Lenis sees the event. */
let sideways = false;

/**
 * True for nodes that keep native scrolling: the screenshot viewer, any pane that overflows vertically (the open
 * mobile menu), and, for sideways gestures, panes that overflow horizontally (spec tables, command lines).
 * @param {HTMLElement} node An element the wheel event passed through.
 */
function keepsNativeScroll(node)
{
    if (node.matches?.('dialog'))
    {
        return true;
    }
    const style = getComputedStyle(node);
    const scrollsY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    const scrollsX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
    return scrollsY || (sideways && scrollsX);
}

window.addEventListener('wheel', (e) =>
{
    sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
}, { capture: true, passive: true });

/**
 * Starts inertial wheel scrolling for the page unless the visitor prefers reduced motion, in which case Lenis is never
 * fetched. Touch stays native. If the module cannot load, the page keeps native scrolling.
 */
export async function startSmoothScroll()
{
    if (still.matches || lenis)
    {
        return;
    }
    try
    {
        const { default: Lenis } = await import(LENIS_URL);
        lenis ??= new Lenis({ autoRaf: true, lerp: 0.15, prevent: keepsNativeScroll });
    }
    catch
    {
        lenis = null;
    }
}

/**
 * Scrolls the page to a position, through the smooth scroller when it runs, and reports when it lands.
 * @param {number} top Target scroll position in pixels.
 * @param {boolean} immediate Jumps without animating.
 * @param {() => void} [onComplete] Called once the page is there.
 */
export function scrollPage(top, immediate, onComplete = () => {})
{
    if (lenis)
    {
        lenis.scrollTo(top, { immediate, force: true, onComplete });
        return;
    }
    if (immediate || still.matches)
    {
        window.scrollTo({ top, behavior: 'instant' });
        onComplete();
        return;
    }
    window.addEventListener('scrollend', onComplete, { once: true });
    window.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Holds the page still while an overlay is open, and releases it afterward.
 * @param {boolean} held
 */
export function holdScroll(held)
{
    if (held)
    {
        lenis?.stop();
    }
    else
    {
        lenis?.start();
    }
}

/**
 * The page position that puts an element at the top, minus its scroll margin.
 * @param {Element} el
 */
function topOf(el)
{
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    return Math.max(0, window.scrollY + el.getBoundingClientRect().top - margin);
}

/**
 * Brings an in-page target into view and gives it focus, jumping straight there when it is more than two screens
 * away or when the visitor prefers reduced motion.
 * @param {Element} el
 * @param {boolean} [instant] Always jump, as after a route change.
 */
function goTo(el, instant = false)
{
    const top = topOf(el);
    const far = Math.abs(top - window.scrollY) > window.innerHeight * 2;
    if (!el.hasAttribute('tabindex'))
    {
        el.setAttribute('tabindex', '-1');
    }
    el.focus({ preventScroll: true });
    scrollPage(top, instant || far || still.matches);
}

/** The element a URL fragment names, if the page has it. */
function fragmentTarget(hash)
{
    const id = decodeURIComponent((hash || '').slice(1));
    return id ? document.getElementById(id) : null;
}

/**
 * Lands a route change at the top, or at the anchor its URL names, with any scroll still in flight canceled.
 * @param {boolean} first True for the page's first route, which keeps the browser's position unless there is an anchor.
 */
export function landRoute(first)
{
    requestAnimationFrame(() =>
    {
        const target = fragmentTarget(location.hash);
        if (target)
        {
            goTo(target, true);
        }
        else if (!first)
        {
            scrollPage(0, true);
        }
        warmCaptures();
    });
}

/**
 * Takes over links to an anchor on the current page so they travel through the smooth scroller. The URL is updated
 * with replaceState, as the router does for same-route fragments, so Back returns to the previous page.
 * @param {MouseEvent} e
 */
function onAnchorClick(e)
{
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    {
        return;
    }
    const link = e.target.closest?.('a[href*="#"]');
    if (!link || link.target === '_blank')
    {
        return;
    }
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash)
    {
        return;
    }
    const target = fragmentTarget(url.hash);
    if (!target)
    {
        return;
    }
    e.preventDefault();
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    goTo(target);
}

/**
 * On desktop, fetches the remaining lazy captures once the page is idle, so none of them decodes in the middle of a
 * scroll. Phones keep lazy loading to save data.
 */
function warmCaptures()
{
    if (!desktop.matches)
    {
        return;
    }
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const warm = () => idle(() =>
    {
        for (const img of document.querySelectorAll('.shot img[loading="lazy"]'))
        {
            img.loading = 'eager';
        }
    });
    if (document.readyState === 'complete')
    {
        warm();
    }
    else
    {
        window.addEventListener('load', warm, { once: true });
    }
}

document.addEventListener('click', onAnchorClick);
