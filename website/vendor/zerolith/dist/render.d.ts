import { type ReadableSignal } from "./signals.js";
/** Brand carried by every value the renderer accepts as a description of UI. */
export declare const VIEW: unique symbol;
/** A description of UI produced by `html`, `each`, or `when`, or by a component function. */
export interface View {
    readonly [VIEW]: true;
}
/** The handle returned by `render()`. */
export interface Root {
    /** The element or fragment the view was rendered into. */
    readonly container: Element | DocumentFragment;
    /** Removes everything rendered and disposes every effect it created. */
    dispose(): void;
}
/** One place where the server-rendered markup and the view disagreed. */
export interface HydrationMismatch {
    /** `text`: a text node differed; `missing`: expected nodes were absent; `extra`: unexpected nodes were present; `structure`: a template's nodes did not line up; `root`: no server-rendered part was found. */
    kind: "text" | "missing" | "extra" | "structure" | "root";
    /** What was expected, when known. */
    expected?: string;
    /** What was found, when known. */
    found?: string;
}
/** The handle returned by `hydrate()`. */
export interface HydrateResult extends Root {
    /** Every disagreement found; each one was repaired by rendering on the client. */
    readonly mismatches: readonly HydrationMismatch[];
}
/** Comment data that opens a server-rendered child part. */
export declare const PART_START: string;
/** Comment data that closes a server-rendered child part. */
export declare const PART_END: string;
/** The result of an `html` literal as the server renderer sees it. */
export interface TemplateView extends View {
    readonly strings: TemplateStringsArray;
    readonly values: readonly unknown[];
}
/** Markup that is inserted as is, as the server renderer sees it. */
export interface RawView extends View {
    readonly markup: string;
}
/**
 * Marks a string as markup to insert without escaping. This is the one way
 * to put HTML you already trust into a view, for example content rendered
 * from Markdown you wrote. Never pass user input.
 */
export declare function unsafeHtml(markup: string): View;
/** True for the result of `unsafeHtml`. */
export declare function isRawHtml(value: unknown): value is RawView;
/** True for the result of an `html` literal. */
export declare function isTemplate(value: unknown): value is TemplateView;
/** True for the views produced by `each` and `when`. */
export declare function isDirective(value: unknown): value is View;
/** The view a directive would show for the current state, for renderers without a DOM. */
export declare function resolveDirective(view: View): unknown;
/** True when the server must wrap a directive's resolved view in its own part markers. */
export declare function directiveWrapsBranch(view: View): boolean;
/** Describes markup with live bindings. Values are bound as content or inside attribute values. */
export declare function html(strings: TemplateStringsArray, ...values: unknown[]): View;
/** Where a view mounts: an element or fragment, or a CSS selector for one element in the document. */
export type MountTarget = Element | DocumentFragment | string;
/** Renders a view at the end of `target`, an element or a selector for one, and returns a handle to dispose it. */
export declare function render(view: unknown, target: MountTarget): Root;
/**
 * Attaches a view to markup the server rendered into `target`, an element
 * or a selector for one, with `renderToString`, reusing the nodes and
 * binding signals, listeners, properties, and refs. Any disagreement is
 * repaired on the client and returned in `mismatches`. Without
 * server-rendered markup it falls back to `render`.
 */
export declare function hydrate(view: unknown, target: MountTarget): HydrateResult;
/** The key function for `each()`. */
export type KeyOf<T> = (item: T, index: number) => string | number | bigint | boolean | symbol | object;
/** The row renderer for `each()`; the item and index are signals that update in place. */
export type RowOf<T> = (item: ReadableSignal<T>, index: ReadableSignal<number>) => unknown;
/**
 * Renders one row per item, keyed, updating rows in place when their key
 * survives and moving the fewest nodes when the order changes.
 */
export declare function each<T>(items: ReadableSignal<readonly T[]> | readonly T[], key: KeyOf<T>, row: RowOf<T>): View;
/** Renders `then()` while the condition is truthy and `otherwise()` while it is not. Branches are created lazily and disposed when hidden. */
export declare function when(condition: unknown, then: () => unknown, otherwise?: () => unknown): View;
//# sourceMappingURL=render.d.ts.map