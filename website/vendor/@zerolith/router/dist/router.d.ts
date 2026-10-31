/**
 * The router: a route table, the current match as a signal, navigation
 * through the History API, delegated handling of plain anchors, loaders
 * that run before the URL changes, head metadata, and scroll restoration.
 */
import { type ReadableSignal, type View } from "zerolith";
import { type ParamsOf } from "./match.js";
/** Document metadata a route contributes. */
export interface Head {
    title?: string;
    description?: string;
}
/** What a route's `load` receives. */
export interface LoadContext<Params> {
    params: Params;
    url: URL;
    /** Aborted when a newer navigation starts. */
    abort: AbortSignal;
}
/** What a route's `view` and `head` receive. */
export interface RouteContext<Params, Data> {
    params: Params;
    data: Data;
    url: URL;
}
/** Renders a route. Called once per navigation to that route. */
export type RouteView<Params, Data> = (context: RouteContext<Params, Data>) => unknown;
/** A view resolved on first navigation, created with `lazy()`. */
export interface LazyView<Params, Data> {
    readonly lazy: () => Promise<RouteView<Params, Data>>;
}
/** One entry of the route table. Write `load` before `view` so the data type flows into the view. */
export interface RouteDefinition<Path extends string = string, Data = undefined> {
    path: Path;
    view: RouteView<ParamsOf<Path>, Data> | LazyView<ParamsOf<Path>, Data>;
    load?: (context: LoadContext<ParamsOf<Path>>) => Promise<Data>;
    head?: Head | ((context: RouteContext<ParamsOf<Path>, Data>) => Head);
}
/** Declares one route, inferring its parameters from the path and its data from the loader. */
export declare function route<const Path extends string, Data = undefined>(definition: RouteDefinition<Path, Data>): RouteDefinition<Path, Data>;
/** The loose shape every route satisfies, used to constrain tables without losing each entry's own types. */
export interface AnyRoute {
    readonly path: string;
    readonly view: unknown;
    readonly load?: unknown;
    readonly head?: unknown;
}
/** A route table: route names to `route()` definitions. */
export type RouteTable = Readonly<Record<string, AnyRoute>>;
/** Declares the route table, preserving every name and path for `href()`; it returns its argument. */
export declare function defineRoutes<const T extends RouteTable>(routes: T): T;
/** Marks a view to be imported on first navigation. */
export declare function lazy<Params, Data>(loader: () => Promise<RouteView<Params, Data>>): LazyView<Params, Data>;
/** The route the URL resolved to. */
export interface Match {
    readonly name: string;
    readonly params: Readonly<Record<string, string>>;
    readonly url: URL;
    readonly data: unknown;
}
/** The arguments `href()` takes for a path: none when it has no parameters. */
export type HrefArgs<Path extends string> = Record<string, never> extends ParamsOf<Path> ? [] : [params: ParamsOf<Path>];
/** What `observe` receives: a navigation starting, committing, or failing, with one id per navigation. */
export interface NavigationEvent {
    readonly type: "start" | "commit" | "error";
    /** The same number for the start and the end of one navigation. */
    readonly id: number;
    readonly url: URL;
    readonly mode: "push" | "replace" | "pop";
    /** The matched route's name on commit; undefined when the fallback rendered. */
    readonly name?: string | undefined;
    /** The loader's error on failure. */
    readonly error?: unknown;
}
/** Options for `createRouter`. */
export interface RouterOptions {
    /** Renders when no route matches. */
    fallback?: (url: URL) => unknown;
    /** Called when a loader or a lazy import throws. Without it the error propagates from `navigate()`. */
    onError?: (error: unknown, url: URL) => void;
    /** Set false to leave scrolling to the application. Defaults to true. */
    scroll?: boolean;
    /** The window to attach to. Defaults to the global window; `null` attaches to none, as on the server, even where a window exists. */
    window?: Window | null;
    /** Receives one event when a navigation starts and one when it commits or fails; the hook tracing and logging attach to. */
    observe?: (event: NavigationEvent) => void;
}
/** The router returned by `createRouter`, typed by its route table. */
export interface Router<T extends RouteTable> {
    /** The current match, or undefined when nothing matched (the fallback renders). */
    readonly current: ReadableSignal<Match | undefined>;
    /** The current URL. */
    readonly url: ReadableSignal<URL>;
    /** True while a navigation is loading. */
    readonly pending: ReadableSignal<boolean>;
    /** The head metadata of the current route, for the server to render and for the browser to apply. */
    readonly head: ReadableSignal<Head>;
    /** Settles when the initial navigation from the window's location has committed; already settled without a window. Rejects as `navigate` would. */
    readonly ready: Promise<void>;
    /** Builds a URL path for a named route. */
    href<N extends keyof T & string>(name: N, ...args: HrefArgs<T[N]["path"]>): string;
    /** Navigates to a path or URL, running the route's loader first. */
    navigate(to: string, options?: {
        replace?: boolean;
    }): Promise<void>;
    /** A signal that is true while the URL is at `path` or below it; `exact` requires equality. */
    matches(path: string, options?: {
        exact?: boolean;
    }): ReadableSignal<boolean>;
    /** Renders the current route, used as `${outlet(router)}`. */
    outlet(): View;
    /** Detaches the router from the window. */
    dispose(): void;
}
/** What `renderRouteState` embeds: the route the server rendered, its URL, and the data its loader produced. */
export interface EmbeddedRouteState {
    readonly name: string;
    readonly href: string;
    readonly data: unknown;
}
/** The selector of the script `renderRouteState` writes. */
export declare const ROUTE_STATE_SELECTOR: string;
/** Creates a router over the given table and attaches it to the window when one exists. */
export declare function createRouter<const T extends RouteTable>(routes: T, options?: RouterOptions): Router<T>;
//# sourceMappingURL=router.d.ts.map