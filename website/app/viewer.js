import { batch, computed, html, render, signal } from 'zerolith';
import { icon } from './icons.js';
import { SCREENS } from './screens.js';
import { holdScroll } from './smooth.js';

/** How far the pointer moves before a press on the image counts as a pan rather than a click. */
const DRAG_SLOP = 4;

/** The captures on the page when the viewer opened. */
const figures = signal([]);
/** The position in `figures` of the capture shown. */
const index = signal(0);
/** True at actual pixels, false fitted to the screen. */
const actual = signal(false);

const figure = computed(() => figures.get()[index.get()]);
const many = computed(() => figures.get().length > 1);

/**
 * The full-quality screenshot viewer: one modal dialog, created on first use, that shows the whole capture (never the
 * phone crop) fitted to the screen or at actual pixels, with previous and next across the captures on the page.
 * These are its elements and the state of a pan in progress.
 */
const viewer = {
    dialog: null,
    stage: null,
    img: null,
    picture: null,
    opener: null,
    drag: null,
    dragged: false,
};

/** The dialog, with its caption, counter, and controls bound to the viewer's state. */
function Viewer()
{
    const caption = computed(() => figure.get()?.querySelector('figcaption')?.textContent || '');
    const count = computed(() => (many.get() ? `${index.get() + 1} of ${figures.get().length}` : ''));
    const toggleIcon = computed(() => icon(actual.get() ? 'minimize' : 'maximize', 16));
    const toggleLabel = computed(() => (actual.get() ? 'Fit to screen' : 'Actual size'));
    const atActual = (value) => computed(() => (actual.get() ? value : undefined));
    return html`<dialog class="viewer" aria-label="Screenshot viewer" aria-describedby="viewer-caption" ref=${(el) => { viewer.dialog = el; }} @click=${onClick} @keydown=${onKey} @close=${onClose}>
        <div class="viewer-bar">
            <p class="viewer-caption" id="viewer-caption">${caption}</p>
            <div class="viewer-controls">
                <div class="viewer-nav" ?hidden=${computed(() => !many.get())}>
                    <button type="button" class="viewer-btn viewer-icon" data-act="prev" aria-label="Previous screenshot">${icon('chevronLeft', 18)}</button>
                    <span class="viewer-count" aria-live="polite">${count}</span>
                    <button type="button" class="viewer-btn viewer-icon" data-act="next" aria-label="Next screenshot">${icon('chevronRight', 18)}</button>
                </div>
                <button type="button" class="viewer-btn viewer-toggle" data-act="toggle" aria-pressed=${computed(() => String(actual.get()))}>${toggleIcon}${toggleLabel}</button>
                <button type="button" class="viewer-btn viewer-icon" data-act="close" aria-label="Close" autofocus>${icon('close', 18)}</button>
            </div>
        </div>
        <div class="viewer-stage" ref=${attachStage} ?data-actual=${actual} tabindex=${atActual('0')} role=${atActual('group')} aria-label=${atActual('Screenshot at actual size. Use the arrow keys to pan.')} @pointerdown=${onPointerDown} @pointermove=${onPointerMove} @pointerup=${onPointerUp} @pointercancel=${onPointerUp}></div>
    </dialog>`;
}

/**
 * Keeps the stage element and refits the image whenever the stage changes size.
 * @param {HTMLElement} el
 */
function attachStage(el)
{
    viewer.stage = el;
    new ResizeObserver(() => size()).observe(el);
}

/**
 * The top of a capture's width ladder, which the viewer always shows.
 * @param {string} src Path without the extension.
 * @param {{width: number, height: number}} s The capture's pixel size.
 * @param {string} alt
 */
function Picture(src, s, alt)
{
    return html`<picture><source type="image/avif" srcset=${`${src}.avif`}><img src=${`${src}.webp`} width=${s.width} height=${s.height} alt=${alt} decoding="async" draggable="false" ref=${(el) => { viewer.img = el; }}></picture>`;
}

/** Sizes the image for the mode: the largest fit that never passes its natural pixels, or exactly its natural pixels. */
function size()
{
    if (!viewer.dialog?.open || !viewer.img)
    {
        return;
    }
    const s = SCREENS[figure.get().dataset.shot];
    const natural = s.width / (window.devicePixelRatio || 1);
    if (actual.get())
    {
        viewer.img.style.width = `${natural}px`;
        return;
    }
    const pad = getComputedStyle(viewer.stage);
    const room = {
        w: viewer.stage.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight),
        h: viewer.stage.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom),
    };
    const scale = Math.min(1, room.w / natural, room.h / (natural * s.height / s.width));
    viewer.img.style.width = `${Math.max(1, Math.floor(natural * scale))}px`;
}

/**
 * Switches between fit and actual size. Actual size opens centered on a point of the image, given as fractions.
 * @param {boolean} next
 * @param {{x: number, y: number}} [at]
 */
function setMode(next, at = { x: 0.5, y: 0.5 })
{
    actual.set(next);
    size();
    if (next)
    {
        const { stage } = viewer;
        stage.scrollLeft = at.x * stage.scrollWidth - stage.clientWidth / 2;
        stage.scrollTop = at.y * stage.scrollHeight - stage.clientHeight / 2;
        stage.focus({ preventScroll: true });
    }
}

/** Shows the capture at the current index in a new picture element, fitted to the screen. */
function show()
{
    const shown = figure.get();
    const name = shown.dataset.shot;
    const s = SCREENS[name];
    viewer.picture?.dispose();
    viewer.picture = render(Picture(`assets/screens/${name}-${s.width}`, s, shown.querySelector('img')?.alt || ''), viewer.stage);
    setMode(false);
}

/**
 * Steps to the previous or next capture on the page, wrapping at the ends.
 * @param {number} delta -1 or 1.
 */
function step(delta)
{
    const n = figures.get().length;
    if (n > 1)
    {
        index.set((index.get() + delta + n) % n);
        show();
    }
}

/**
 * Opens the viewer on a figure rendered by screenshot().
 * @param {HTMLElement} target
 */
function open(target)
{
    if (!viewer.dialog)
    {
        render(Viewer(), document.body);
    }
    const list = [...document.querySelectorAll('main .shot[data-shot]')];
    batch(() =>
    {
        figures.set(list);
        index.set(Math.max(0, list.indexOf(target)));
    });
    viewer.opener = target.querySelector('.shot-open');
    show();
    viewer.dialog.showModal();
    holdScroll(true);
    size();
}

/**
 * Opens the viewer from a screenshot's button.
 * @param {MouseEvent} e
 */
export function openViewer(e)
{
    const target = e.currentTarget.closest('.shot[data-shot]');
    if (target && SCREENS[target.dataset.shot])
    {
        open(target);
    }
}

/** Closes the viewer if it is open, as on a route change. */
export function closeViewer()
{
    if (viewer.dialog?.open)
    {
        viewer.dialog.close();
    }
}

function onClose()
{
    holdScroll(false);
    viewer.drag = null;
    if (viewer.opener?.isConnected)
    {
        viewer.opener.focus({ preventScroll: true });
    }
    viewer.opener = null;
}

function onClick(e)
{
    if (viewer.dragged)
    {
        viewer.dragged = false;
        return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'prev' || act === 'next')
    {
        step(act === 'prev' ? -1 : 1);
    }
    else if (act === 'toggle')
    {
        setMode(!actual.get());
    }
    else if (act === 'close')
    {
        viewer.dialog.close();
    }
    else if (e.target === viewer.img)
    {
        const box = viewer.img.getBoundingClientRect();
        setMode(!actual.get(), { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height });
    }
    else if (e.target === viewer.stage || e.target === viewer.dialog)
    {
        viewer.dialog.close();
    }
}

function onKey(e)
{
    if (actual.get() || e.altKey || e.ctrlKey || e.metaKey)
    {
        return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    {
        e.preventDefault();
        step(e.key === 'ArrowLeft' ? -1 : 1);
    }
}

function onPointerDown(e)
{
    if (!actual.get() || e.button !== 0 || e.pointerType === 'touch')
    {
        return;
    }
    viewer.drag = { x: e.clientX, y: e.clientY, left: viewer.stage.scrollLeft, top: viewer.stage.scrollTop, id: e.pointerId, moving: false };
    viewer.dragged = false;
}

function onPointerMove(e)
{
    const d = viewer.drag;
    if (!d || e.pointerId !== d.id)
    {
        return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moving && Math.hypot(dx, dy) < DRAG_SLOP)
    {
        return;
    }
    if (!d.moving)
    {
        d.moving = true;
        viewer.stage.setPointerCapture(e.pointerId);
        viewer.stage.dataset.panning = '';
    }
    viewer.stage.scrollLeft = d.left - dx;
    viewer.stage.scrollTop = d.top - dy;
}

function onPointerUp(e)
{
    const d = viewer.drag;
    if (!d || e.pointerId !== d.id)
    {
        return;
    }
    viewer.dragged = d.moving;
    viewer.drag = null;
    delete viewer.stage.dataset.panning;
}
