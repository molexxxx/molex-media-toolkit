import { type ReadableSignal } from "./signals.js";
/** The signals an element's view receives, one per declared prop. */
export type ElementProps<Props extends readonly string[]> = {
    readonly [K in Props[number]]: ReadableSignal<unknown>;
};
/** Options for `define`. */
export interface ElementOptions<Props extends readonly string[]> {
    /** The attribute and property names the element exposes. An attribute arrives as a string or undefined; a property keeps its value. */
    props: Props;
    /** Renders the element's content from the prop signals; `host` is the element, for events and measurements. */
    view: (props: ElementProps<Props>, host: HTMLElement) => unknown;
}
/**
 * Registers a custom element for the view. Declared props are observed as
 * attributes and exposed as properties, both feeding the same signals, and
 * values assigned before the element was upgraded are kept. The content is
 * rendered when the element connects, hydrated when it already holds
 * server-rendered markup, and disposed when it disconnects. Without a
 * `customElements` registry, as on the server, nothing is registered.
 * Defining a name twice is a no-op, so modules can re-run under hot
 * replacement.
 */
export declare function define<const Props extends readonly string[]>(name: string, options: ElementOptions<Props>): void;
//# sourceMappingURL=element.d.ts.map