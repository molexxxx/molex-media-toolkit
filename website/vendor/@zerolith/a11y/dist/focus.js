/**
 * Focus management: the trap a dialog needs, the roving tabindex a composite
 * widget needs, and a monitor that tells keyboard focus from pointer focus.
 * The trap and the roving tabindex are `ref` callbacks, so they attach when
 * the element is created and clean up when its template is removed.
 */
import { onDispose, signal } from "zerolith";
const FOCUSABLE = "a[href], area[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"]), [contenteditable=\"true\"], audio[controls], video[controls], details > summary, iframe";
/** The elements inside `root` that take Tab focus, in document order, skipping anything hidden. */
export function focusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((element) => element.getClientRects().length > 0 && element.closest("[inert]") === null);
}
/**
 * A `ref` that keeps Tab and Shift+Tab inside the element, pulls focus back
 * when it lands outside, moves focus in once the element is in the document,
 * and returns it where it came from when the element's template is removed.
 */
export function focusTrap(options = {}) {
    return (element) => {
        const doc = element.ownerDocument;
        const previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
        const fallback = () => {
            const first = focusables(element)[0];
            if (first !== undefined) {
                return first;
            }
            if (!element.hasAttribute("tabindex")) {
                element.setAttribute("tabindex", "-1");
            }
            return element;
        };
        let disposed = false;
        const initial = options.initial;
        const focusInitial = () => {
            if (disposed || !element.isConnected || initial === false) {
                return;
            }
            const target = typeof initial === "string" ? element.querySelector(initial) ?? fallback() : initial ?? fallback();
            target.focus();
        };
        if (initial !== false) {
            if (element.isConnected) {
                focusInitial();
            }
            else {
                queueMicrotask(focusInitial);
            }
        }
        const onKeydown = (event) => {
            const key = event;
            if (key.key !== "Tab") {
                return;
            }
            const list = focusables(element);
            const first = list[0];
            const last = list.at(-1);
            if (first === undefined || last === undefined) {
                key.preventDefault();
                return;
            }
            const active = doc.activeElement;
            if (key.shiftKey && (active === first || !element.contains(active))) {
                key.preventDefault();
                last.focus();
            }
            else if (!key.shiftKey && (active === last || !element.contains(active))) {
                key.preventDefault();
                first.focus();
            }
        };
        const onFocusIn = (event) => {
            if (!element.contains(event.target)) {
                fallback().focus();
            }
        };
        element.addEventListener("keydown", onKeydown);
        doc.addEventListener("focusin", onFocusIn);
        onDispose(() => {
            disposed = true;
            element.removeEventListener("keydown", onKeydown);
            doc.removeEventListener("focusin", onFocusIn);
            if (options.restore !== false && previous !== null && previous.isConnected) {
                previous.focus();
            }
        });
    };
}
const ROVING_ITEMS = "[data-roving], [role=\"tab\"], [role=\"menuitem\"], [role=\"menuitemcheckbox\"], [role=\"menuitemradio\"], [role=\"option\"], [role=\"radio\"], [role=\"treeitem\"], [role=\"gridcell\"]";
/**
 * A `ref` for a composite widget: exactly one item is in the Tab order, the
 * arrow keys, Home, and End move between items, and the item that was
 * selected or checked starts as the current one.
 */
export function rovingTabindex(options = {}) {
    const selector = options.items ?? ROVING_ITEMS;
    const orientation = options.orientation ?? "both";
    const loop = options.loop !== false;
    return (element) => {
        const items = () => [...element.querySelectorAll(selector)].filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true");
        let current;
        const apply = (next) => {
            const list = items();
            current = next !== undefined && list.includes(next) ? next : list.find((item) => item.getAttribute("aria-selected") === "true" || item.getAttribute("aria-checked") === "true") ?? list[0];
            for (const item of list) {
                item.tabIndex = item === current ? 0 : -1;
            }
        };
        const move = (step, edge) => {
            const list = items();
            if (list.length === 0) {
                return;
            }
            let index = edge === "first" ? 0 : edge === "last" ? list.length - 1 : list.indexOf(current ?? list[0]) + step;
            if (index < 0 || index >= list.length) {
                if (!loop) {
                    return;
                }
                index = (index + list.length) % list.length;
            }
            const target = list[index];
            if (target !== undefined) {
                apply(target);
                target.focus();
            }
        };
        const onKeydown = (event) => {
            const key = event;
            const horizontal = orientation !== "vertical";
            const vertical = orientation !== "horizontal";
            if ((key.key === "ArrowRight" && horizontal) || (key.key === "ArrowDown" && vertical)) {
                move(1);
            }
            else if ((key.key === "ArrowLeft" && horizontal) || (key.key === "ArrowUp" && vertical)) {
                move(-1);
            }
            else if (key.key === "Home") {
                move(0, "first");
            }
            else if (key.key === "End") {
                move(0, "last");
            }
            else {
                return;
            }
            key.preventDefault();
        };
        const onFocusIn = (event) => {
            const target = event.target.closest(selector);
            if (target !== null && element.contains(target)) {
                apply(target);
            }
        };
        apply(undefined);
        const observer = new MutationObserver(() => apply(current));
        observer.observe(element, { childList: true, subtree: true });
        element.addEventListener("keydown", onKeydown);
        element.addEventListener("focusin", onFocusIn);
        onDispose(() => {
            observer.disconnect();
            element.removeEventListener("keydown", onKeydown);
            element.removeEventListener("focusin", onFocusIn);
        });
    };
}
/**
 * Watches how focus arrives, the way Angular CDK's focus monitor does: a key
 * pressed before focus moves means keyboard, a pointer pressed means pointer
 * or touch, anything else means program. The origin is a signal and a
 * `data-focus-origin` attribute on the root element, so a stylesheet can
 * show focus rings for keyboard users only: `[data-focus-origin="keyboard"] :focus { outline: ... }`.
 */
export function focusOrigin(doc = document) {
    const origin = signal(null);
    let last;
    let timer;
    const remember = (value) => {
        last = value;
        clearTimeout(timer);
        timer = setTimeout(() => {
            last = undefined;
        }, 650);
    };
    const onKeydown = () => remember("keyboard");
    const onPointerdown = (event) => remember(event.pointerType === "touch" ? "touch" : "pointer");
    const onFocusIn = () => {
        const value = last ?? "program";
        origin.set(value);
        doc.documentElement.setAttribute("data-focus-origin", value);
    };
    const onFocusOut = (event) => {
        if (event.relatedTarget === null) {
            origin.set(null);
            doc.documentElement.removeAttribute("data-focus-origin");
        }
    };
    doc.addEventListener("keydown", onKeydown, true);
    doc.addEventListener("pointerdown", onPointerdown, true);
    doc.addEventListener("focusin", onFocusIn, true);
    doc.addEventListener("focusout", onFocusOut, true);
    return {
        origin,
        dispose() {
            clearTimeout(timer);
            doc.removeEventListener("keydown", onKeydown, true);
            doc.removeEventListener("pointerdown", onPointerdown, true);
            doc.removeEventListener("focusin", onFocusIn, true);
            doc.removeEventListener("focusout", onFocusOut, true);
            doc.documentElement.removeAttribute("data-focus-origin");
        }
    };
}
//# sourceMappingURL=focus.js.map