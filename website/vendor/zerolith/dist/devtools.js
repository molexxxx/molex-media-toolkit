const DIAGNOSTICS_KEPT = 200;
const RESTORE_KEY = "zerolith:restore";
/** Values of named signals saved by the dev server's client before it reloaded the page; consumed once. */
function readRestore() {
    try {
        if (typeof sessionStorage === "undefined") {
            return undefined;
        }
        const raw = sessionStorage.getItem(RESTORE_KEY);
        if (raw === null) {
            return undefined;
        }
        sessionStorage.removeItem(RESTORE_KEY);
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
let nextId = 1;
let depth = 0;
let pruneAt = 256;
let restored = readRestore();
const nodes = [];
const roots = new Map();
const diagnostics = [];
const listeners = new Set();
function emit(event) {
    for (const listener of listeners) {
        listener(event);
    }
}
function prune() {
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i]?.ref.deref() === undefined) {
            nodes.splice(i, 1);
        }
    }
}
const hook = {
    version: 1,
    nodes() {
        prune();
        return nodes.map((node) => {
            const snapshot = { id: node.id, kind: node.kind, name: node.name, observers: 0, internal: node.internal };
            const target = node.ref.deref();
            if (target === undefined) {
                return snapshot;
            }
            try {
                const state = node.inspect(target);
                snapshot.observers = state.observers;
                if ("value" in state) {
                    snapshot.value = state.value;
                }
            }
            catch {
                // A computed value that throws is shown without a value.
            }
            return snapshot;
        });
    },
    roots() {
        return [...roots.values()];
    },
    diagnostics() {
        return [...diagnostics];
    },
    subscribe(listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
};
globalThis.__ZEROLITH_DEVTOOLS__ = hook;
/**
 * Records a reactive node, held weakly so discarded state can be collected.
 * `inspect` receives the node and reads its state untracked when the
 * inspector asks; it must not capture the node itself. The registry is
 * pruned of collected nodes each time it doubles. An internal node is
 * recorded but not announced, so the inspector's own rendering never wakes
 * it.
 */
export function trackNode(node, kind, name, inspect) {
    const id = nextId++;
    const inside = depth > 0;
    nodes.push({ id, kind, name, internal: inside, ref: new WeakRef(node), inspect: inspect });
    if (nodes.length >= pruneAt) {
        prune();
        pruneAt = Math.max(256, nodes.length * 2);
    }
    if (kind === "state" && name !== undefined && restored !== undefined && Object.hasOwn(restored, name)) {
        node.restore(restored[name]);
        delete restored[name];
        if (Object.keys(restored).length === 0) {
            restored = undefined;
        }
    }
    if (!inside) {
        emit({ type: "node", id });
    }
}
/**
 * Queues values for named state signals created from now on, each taken
 * once. The dev server's client writes them to sessionStorage before a
 * reload; the Vite plugin's runtime calls this between a module's disposal
 * and the re-render that follows. An empty record drops what is left.
 */
export function saveRestore(state) {
    const names = Object.keys(state);
    restored = names.length === 0 ? undefined : { ...state };
}
/** Records a mounted root. */
export function trackRoot(root, container, kind) {
    const id = nextId++;
    const inside = depth > 0;
    roots.set(root, { id, kind, container, internal: inside });
    if (!inside) {
        emit({ type: "root", id, removed: false });
    }
}
/** Forgets a disposed root. */
export function untrackRoot(root) {
    const snapshot = roots.get(root);
    if (snapshot !== undefined) {
        roots.delete(root);
        if (!snapshot.internal) {
            emit({ type: "root", id: snapshot.id, removed: true });
        }
    }
}
/** Appends a diagnostic to the feed. */
export function trackDiagnostic(record) {
    diagnostics.push(record);
    if (diagnostics.length > DIAGNOSTICS_KEPT) {
        diagnostics.shift();
    }
    emit({ type: "diagnostic", diagnostic: record });
}
/** Announces that a batch flushed `effects` effect runs. */
export function trackFlush(effects) {
    emit({ type: "flush", effects });
}
/** True while code that belongs to the inspector runs, inside `internal` or under an effect or owner created there. */
export function isInternal() {
    return depth > 0;
}
/** Runs `fn` with everything it creates marked as belonging to the inspector, including what the effects and owners it creates make when they run later. */
export function internal(fn) {
    depth++;
    try {
        return fn();
    }
    finally {
        depth--;
    }
}
/** Times `fn` as an entry on a custom track in the browser's Performance panel. */
export function measure(track, name, fn) {
    if (typeof performance === "undefined" || typeof performance.measure !== "function") {
        return fn();
    }
    const start = performance.now();
    try {
        return fn();
    }
    finally {
        try {
            performance.measure(name, { start, end: performance.now(), detail: { devtools: { dataType: "track-entry", track, trackGroup: "zerolith" } } });
        }
        catch {
            // Some runtimes reject the options form; the measurement is only a convenience.
        }
    }
}
//# sourceMappingURL=devtools.js.map