/**
 * Custom elements as the coexistence boundary: `define` registers an
 * element whose attributes and properties are signals and whose content is
 * a zerolith view, so a view can be mounted inside a page or a tree that
 * another framework owns. The content lives in light DOM, like every other
 * zerolith view, so scoped styles and design tokens apply unchanged.
 */
import { hydrate } from "./render.js";
import { signal } from "./signals.js";
const stores = new WeakMap();
function store(host, props) {
    let signals = stores.get(host);
    if (signals === undefined) {
        signals = {};
        for (const name of props) {
            signals[name] = signal(undefined);
        }
        stores.set(host, signals);
    }
    return signals;
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
export function define(name, options) {
    if (typeof customElements === "undefined" || customElements.get(name) !== undefined) {
        return;
    }
    const props = options.props;
    const roots = new WeakMap();
    class ZerolithElement extends HTMLElement {
        static observedAttributes = props;
        constructor() {
            super();
            const signals = store(this, props);
            for (const prop of props) {
                if (Object.hasOwn(this, prop)) {
                    const value = this[prop];
                    delete this[prop];
                    signals[prop]?.set(value);
                }
            }
        }
        attributeChangedCallback(attribute, _previous, value) {
            store(this, props)[attribute]?.set(value === null ? undefined : value);
        }
        connectedCallback() {
            if (roots.has(this)) {
                return;
            }
            roots.set(this, hydrate(options.view(store(this, props), this), this));
        }
        disconnectedCallback() {
            roots.get(this)?.dispose();
            roots.delete(this);
        }
    }
    for (const prop of props) {
        Object.defineProperty(ZerolithElement.prototype, prop, {
            configurable: true,
            enumerable: true,
            get() {
                return store(this, props)[prop]?.get();
            },
            set(value) {
                store(this, props)[prop]?.set(value);
            }
        });
    }
    customElements.define(name, ZerolithElement);
}
