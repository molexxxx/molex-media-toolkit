/**
 * The router: a route table, the current match as a signal, navigation
 * through the History API, delegated handling of plain anchors, loaders
 * that run before the URL changes, head metadata, and scroll restoration.
 */
import { batch, computed, signal, untracked } from "zerolith";
import { build, compile, match } from "./match.js";
/** Declares one route, inferring its parameters from the path and its data from the loader. */
export function route(definition) {
    return definition;
}
/** Declares the route table, preserving every name and path for `href()`; it returns its argument. */
export function defineRoutes(routes) {
    return routes;
}
/** Marks a view to be imported on first navigation. */
export function lazy(loader) {
    return { lazy: loader };
}
function isLazy(view) {
    return typeof view === "object" && view !== null && "lazy" in view;
}
/** The selector of the script `renderRouteState` writes. */
export const ROUTE_STATE_SELECTOR = "script[type=\"application/json\"][data-zerolith-route]";
/** Reads and removes the embedded route state, if the server left one; used once, for the initial navigation. */
function readEmbeddedState(doc) {
    const script = doc.querySelector(ROUTE_STATE_SELECTOR);
    if (script === null) {
        return undefined;
    }
    script.remove();
    try {
        const parsed = JSON.parse(script.textContent ?? "");
        return typeof parsed.name === "string" && typeof parsed.href === "string" ? { name: parsed.name, href: parsed.href, data: parsed.data } : undefined;
    }
    catch {
        return undefined;
    }
}
function headOf(resolved) {
    if (resolved.compiled === undefined || resolved.match === undefined) {
        return {};
    }
    const { head: declared } = resolved.compiled.route;
    if (declared === undefined) {
        return {};
    }
    return typeof declared === "function" ? declared({ params: resolved.match.params, data: resolved.match.data, url: resolved.match.url }) : declared;
}
/** Creates a router over the given table and attaches it to the window when one exists. */
export function createRouter(routes, options = {}) {
    const win = options.window === null ? undefined : (options.window ?? (typeof window === "undefined" ? undefined : window));
    let embedded = win === undefined ? undefined : readEmbeddedState(win.document);
    const compiledRoutes = Object.entries(routes).map(([name, definition]) => ({
        name,
        pattern: compile(definition.path),
        route: definition,
        view: isLazy(definition.view) ? undefined : definition.view
    }));
    const byName = new Map(compiledRoutes.map((entry) => [entry.name, entry]));
    const initial = win === undefined ? new URL("http://localhost/") : new URL(win.location.href);
    const url = signal(initial, { equals: (a, b) => a.href === b.href });
    const current = signal(undefined);
    const pending = signal(false);
    const head = signal({});
    const views = new Map();
    let controller;
    let generation = 0;
    const scrollPositions = new Map();
    const find = (pathname) => {
        for (const compiled of compiledRoutes) {
            const params = match(compiled.pattern, pathname);
            if (params !== undefined) {
                return { compiled, params };
            }
        }
        return undefined;
    };
    const resolve = async (target) => {
        const found = find(target.pathname);
        if (found === undefined) {
            return { match: undefined, view: undefined, compiled: undefined };
        }
        const { compiled, params } = found;
        controller?.abort();
        const abort = new AbortController();
        controller = abort;
        let view = compiled.view ?? views.get(compiled.name);
        if (view === undefined) {
            view = await compiled.route.view.lazy();
            views.set(compiled.name, view);
        }
        const reusable = embedded;
        embedded = undefined;
        let data;
        if (reusable !== undefined && reusable.name === compiled.name && reusable.href === target.pathname + target.search) {
            data = reusable.data;
        }
        else {
            data = compiled.route.load === undefined ? undefined : await compiled.route.load({ params, url: target, abort: abort.signal });
        }
        return { match: { name: compiled.name, params, url: target, data }, view, compiled };
    };
    const applyHead = (value) => {
        if (win === undefined) {
            return;
        }
        const doc = win.document;
        if (value.title !== undefined) {
            doc.title = value.title;
        }
        if (value.description !== undefined) {
            let meta = doc.querySelector("meta[name=\"description\"]");
            if (meta === null) {
                meta = doc.createElement("meta");
                meta.name = "description";
                doc.head.append(meta);
            }
            meta.content = value.description;
        }
    };
    const scrollTo = (target, restored) => {
        if (win === undefined || options.scroll === false) {
            return;
        }
        if (restored !== undefined) {
            win.scrollTo(0, restored);
            return;
        }
        if (target.hash !== "") {
            const element = win.document.getElementById(decodeURIComponent(target.hash.slice(1)));
            if (element !== null) {
                element.scrollIntoView();
                return;
            }
        }
        win.scrollTo(0, 0);
    };
    let matchedView;
    const commit = (target, resolved, restored) => {
        matchedView = resolved.view;
        const value = headOf(resolved);
        batch(() => {
            url.set(target);
            current.set(resolved.match);
            head.set(value);
            pending.set(false);
        });
        applyHead(value);
        scrollTo(target, restored);
    };
    const go = async (target, mode, restored) => {
        const run = ++generation;
        pending.set(true);
        options.observe?.({ type: "start", id: run, url: target, mode });
        let resolved;
        try {
            resolved = await resolve(target);
        }
        catch (error) {
            if (run === generation) {
                pending.set(false);
            }
            options.observe?.({ type: "error", id: run, url: target, mode, error });
            if (options.onError === undefined) {
                throw error;
            }
            options.onError(error, target);
            return;
        }
        if (run !== generation) {
            return;
        }
        if (win !== undefined && mode !== "pop") {
            if (mode === "push") {
                scrollPositions.set(win.history.state?.key ?? "", win.scrollY);
                win.history.pushState({ key: String(run) }, "", target.href);
            }
            else {
                win.history.replaceState({ key: win.history.state?.key ?? String(run) }, "", target.href);
            }
        }
        commit(target, resolved, restored);
        options.observe?.({ type: "commit", id: run, url: target, mode, name: resolved.match?.name });
    };
    const toUrl = (to) => new URL(to, win === undefined ? "http://localhost/" : win.location.href);
    const onClick = (event) => {
        if (win === undefined || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        const anchor = event.target?.closest("a[href]");
        if (!(anchor instanceof HTMLAnchorElement)) {
            return;
        }
        if (anchor.hasAttribute("download") || (anchor.target !== "" && anchor.target !== "_self") || anchor.relList.contains("external")) {
            return;
        }
        const target = new URL(anchor.href, win.location.href);
        if (target.origin !== win.location.origin) {
            return;
        }
        if (target.pathname === win.location.pathname && target.search === win.location.search && target.hash !== "") {
            return;
        }
        event.preventDefault();
        void go(target, "push");
    };
    const onPopState = () => {
        if (win === undefined) {
            return;
        }
        const key = win.history.state?.key ?? "";
        void go(new URL(win.location.href), "pop", scrollPositions.get(key));
    };
    if (win !== undefined) {
        if (options.scroll !== false && "scrollRestoration" in win.history) {
            win.history.scrollRestoration = "manual";
        }
        win.document.addEventListener("click", onClick);
        win.addEventListener("popstate", onPopState);
        if (win.history.state?.key === undefined) {
            win.history.replaceState({ key: "0" }, "", win.location.href);
        }
    }
    const ready = win === undefined ? Promise.resolve() : go(initial, "replace");
    const outlet = computed(() => {
        const matched = current.get();
        return untracked(() => {
            if (matched === undefined || matchedView === undefined) {
                return options.fallback?.(url.get());
            }
            return matchedView({ params: matched.params, data: matched.data, url: matched.url });
        });
    });
    return {
        current,
        url,
        pending,
        head,
        ready,
        href(name, ...args) {
            const entry = byName.get(name);
            if (entry === undefined) {
                return "/";
            }
            return build(entry.route.path, (args[0] ?? {}));
        },
        navigate(to, navigation = {}) {
            return go(toUrl(to), navigation.replace === true ? "replace" : "push");
        },
        matches(path, matching = {}) {
            return computed(() => {
                const { pathname } = url.get();
                return pathname === path || (matching.exact !== true && pathname.startsWith(path.endsWith("/") ? path : path + "/"));
            });
        },
        outlet() {
            return outlet;
        },
        dispose() {
            generation++;
            controller?.abort();
            if (win !== undefined) {
                win.document.removeEventListener("click", onClick);
                win.removeEventListener("popstate", onPopState);
            }
        }
    };
}
//# sourceMappingURL=router.js.map