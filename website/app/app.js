import { effect, render, signal, untracked } from 'zerolith';
import { mediaQuery } from '@zerolith/a11y';
import { router } from './router.js';
import { NOT_FOUND } from './routes.js';
import { startSmoothScroll, landRoute, holdScroll } from './smooth.js';
import { closeViewer } from './viewer.js';

const nav = document.getElementById('nav');
const toggle = document.getElementById('nav-toggle');
const toggleLabel = toggle.querySelector('.sr');
const menu = document.getElementById('nav-links');
const description = document.querySelector('meta[name="description"]');
const narrow = mediaQuery('(max-width: 760px)');

/** Whether the mobile menu is open. */
const menuOpen = signal(false);

/**
 * Opens or closes the mobile menu. While it is open the page behind it is inert and does not scroll.
 * @param {boolean} open Desired state; ignored above the mobile breakpoint, where the links are always shown.
 */
function setMenu(open)
{
    const on = open && narrow.get();
    if (!on && menu.contains(document.activeElement))
    {
        toggle.focus();
    }
    menuOpen.set(on);
}

/** Shows the menu state on the static header, and makes the page behind an open menu inert. */
effect(() =>
{
    const on = menuOpen.get();
    nav.dataset.open = String(on);
    toggle.setAttribute('aria-expanded', String(on));
    toggleLabel.textContent = on ? 'Close menu' : 'Open menu';
    document.documentElement.classList.toggle('menu-open', on);
    holdScroll(on);
    for (const el of document.querySelectorAll('#skip-link, main, .foot'))
    {
        el.inert = on;
    }
});

/** Closes the menu whenever the window crosses the mobile breakpoint. */
effect(() =>
{
    narrow.get();
    untracked(() => setMenu(false));
});

/** Marks the nav link for the current section. */
for (const a of document.querySelectorAll('[data-route]'))
{
    const here = router.matches(a.dataset.route);
    effect(() =>
    {
        if (here.get())
        {
            a.setAttribute('aria-current', 'page');
        }
        else
        {
            a.removeAttribute('aria-current');
        }
    });
}

toggle.addEventListener('click', () => setMenu(!menuOpen.get()));
document.getElementById('nav-scrim').addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) =>
{
    if (e.key === 'Escape' && menuOpen.get())
    {
        setMenu(false);
        toggle.focus();
    }
});

startSmoothScroll();
await router.ready;
render(router.outlet(), '#main');

let first = true;

/**
 * After each navigation: the head for an address no route matches, the menu and the viewer closed, focus on the new
 * heading, and the page landed at the top or at the anchor its URL names.
 */
effect(() =>
{
    const match = router.current.get();
    untracked(() =>
    {
        if (!match)
        {
            document.title = NOT_FOUND.title;
            description.content = NOT_FOUND.description;
        }
        setMenu(false);
        closeViewer();
        if (!first && !location.hash)
        {
            requestAnimationFrame(() =>
            {
                const heading = document.querySelector('main h1');
                if (heading)
                {
                    heading.setAttribute('tabindex', '-1');
                    heading.focus({ preventScroll: true });
                }
            });
        }
        landRoute(first);
        first = false;
    });
});
