import { icon } from './icons.js';
import { SCREENS } from './screens.js';
import { holdScroll } from './smooth.js';

/** How far the pointer moves before a press on the image counts as a pan rather than a click. */
const DRAG_SLOP = 4;

/**
 * The full-quality screenshot viewer: one modal dialog, created on first use, that shows the whole capture (never the
 * phone crop) fitted to the screen or at actual pixels, with previous and next across the captures on the page.
 */
const viewer = {
    dialog: null,
    stage: null,
    img: null,
    list: [],
    index: 0,
    actual: false,
    opener: null,
    drag: null,
    dragged: false,
};

function build()
{
    const d = document.createElement('dialog');
    d.className = 'viewer';
    d.setAttribute('aria-label', 'Screenshot viewer');
    d.setAttribute('aria-describedby', 'viewer-caption');
    d.innerHTML = `
        <div class="viewer-bar">
            <p class="viewer-caption" id="viewer-caption"></p>
            <div class="viewer-controls">
                <div class="viewer-nav">
                    <button type="button" class="viewer-btn viewer-icon" data-act="prev" aria-label="Previous screenshot">${icon('chevronLeft', 18)}</button>
                    <span class="viewer-count" aria-live="polite"></span>
                    <button type="button" class="viewer-btn viewer-icon" data-act="next" aria-label="Next screenshot">${icon('chevronRight', 18)}</button>
                </div>
                <button type="button" class="viewer-btn viewer-toggle" data-act="toggle" aria-pressed="false"></button>
                <button type="button" class="viewer-btn viewer-icon" data-act="close" aria-label="Close" autofocus>${icon('close', 18)}</button>
            </div>
        </div>
        <div class="viewer-stage"></div>`;
    document.body.append(d);

    viewer.dialog = d;
    viewer.stage = d.querySelector('.viewer-stage');

    d.addEventListener('click', onClick);
    d.addEventListener('keydown', onKey);
    d.addEventListener('close', onClose);
    viewer.stage.addEventListener('pointerdown', onPointerDown);
    viewer.stage.addEventListener('pointermove', onPointerMove);
    viewer.stage.addEventListener('pointerup', onPointerUp);
    viewer.stage.addEventListener('pointercancel', onPointerUp);
    new ResizeObserver(() => size()).observe(viewer.stage);
}

/** The capture shown now, with its pixel size at the top of its ladder. */
function current()
{
    const figure = viewer.list[viewer.index];
    const name = figure.dataset.shot;
    return { figure, name, s: SCREENS[name] };
}

/** Sizes the image for the mode: the largest fit that never passes its natural pixels, or exactly its natural pixels. */
function size()
{
    if (!viewer.dialog?.open)
    {
        return;
    }
    const { s } = current();
    const natural = s.width / (window.devicePixelRatio || 1);
    if (viewer.actual)
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
 * @param {boolean} actual
 * @param {{x: number, y: number}} [at]
 */
function setMode(actual, at = { x: 0.5, y: 0.5 })
{
    viewer.actual = actual;
    const { stage } = viewer;
    const toggle = viewer.dialog.querySelector('[data-act="toggle"]');
    toggle.setAttribute('aria-pressed', String(actual));
    toggle.innerHTML = actual ? `${icon('minimize', 16)}Fit to screen` : `${icon('maximize', 16)}Actual size`;
    stage.toggleAttribute('data-actual', actual);
    if (actual)
    {
        stage.tabIndex = 0;
        stage.setAttribute('role', 'group');
        stage.setAttribute('aria-label', 'Screenshot at actual size. Use the arrow keys to pan.');
    }
    else
    {
        stage.removeAttribute('tabindex');
        stage.removeAttribute('role');
        stage.removeAttribute('aria-label');
    }
    size();
    if (actual)
    {
        stage.scrollLeft = at.x * stage.scrollWidth - stage.clientWidth / 2;
        stage.scrollTop = at.y * stage.scrollHeight - stage.clientHeight / 2;
        stage.focus({ preventScroll: true });
    }
}

/** Shows the capture at viewer.index, fitted to the screen. */
function show()
{
    const { figure, name, s } = current();
    const top = `assets/screens/${name}-${s.width}`;
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.type = 'image/avif';
    source.srcset = `${top}.avif`;
    const img = document.createElement('img');
    img.src = `${top}.webp`;
    img.width = s.width;
    img.height = s.height;
    img.alt = figure.querySelector('img')?.alt || '';
    img.decoding = 'async';
    img.draggable = false;
    picture.append(source, img);
    viewer.stage.replaceChildren(picture);
    viewer.img = img;
    viewer.dialog.querySelector('.viewer-caption').textContent = figure.querySelector('figcaption')?.textContent || '';
    const many = viewer.list.length > 1;
    viewer.dialog.querySelector('.viewer-nav').hidden = !many;
    viewer.dialog.querySelector('.viewer-count').textContent = many ? `${viewer.index + 1} of ${viewer.list.length}` : '';
    setMode(false);
}

/**
 * Steps to the previous or next capture on the page, wrapping at the ends.
 * @param {number} delta -1 or 1.
 */
function step(delta)
{
    const n = viewer.list.length;
    if (n > 1)
    {
        viewer.index = (viewer.index + delta + n) % n;
        show();
    }
}

/**
 * Opens the viewer on a figure rendered by screenshot().
 * @param {HTMLElement} figure
 */
function open(figure)
{
    if (!viewer.dialog)
    {
        build();
    }
    viewer.list = [...document.querySelectorAll('main .shot[data-shot]')];
    viewer.index = Math.max(0, viewer.list.indexOf(figure));
    viewer.opener = figure.querySelector('.shot-open');
    show();
    viewer.dialog.showModal();
    holdScroll(true);
    size();
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
        setMode(!viewer.actual);
    }
    else if (act === 'close')
    {
        viewer.dialog.close();
    }
    else if (e.target === viewer.img)
    {
        const box = viewer.img.getBoundingClientRect();
        setMode(!viewer.actual, { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height });
    }
    else if (e.target === viewer.stage || e.target === viewer.dialog)
    {
        viewer.dialog.close();
    }
}

function onKey(e)
{
    if (viewer.actual || e.altKey || e.ctrlKey || e.metaKey)
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
    if (!viewer.actual || e.button !== 0 || e.pointerType === 'touch')
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

document.addEventListener('click', (e) =>
{
    const button = e.target.closest?.('.shot-open');
    const figure = button?.closest('.shot[data-shot]');
    if (figure && SCREENS[figure.dataset.shot])
    {
        open(figure);
    }
});
