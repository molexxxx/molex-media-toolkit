import type { Diagnostic } from "./diagnostics.js";
/** What a reactive node looks like to an inspector. */
export interface NodeSnapshot {
    id: number;
    kind: "state" | "computed" | "effect";
    name: string | undefined;
    /** The current value for state and computed nodes; absent for effects and when reading threw. */
    value?: unknown;
    /** How many nodes currently depend on this one. */
    observers: number;
    /** Created while the inspector itself was rendering. */
    internal: boolean;
}
/** A mounted root as the inspector sees it. */
export interface RootSnapshot {
    id: number;
    kind: "render" | "hydrate";
    container: Node;
    internal: boolean;
}
/** Something the hook announces to subscribers. */
export type DevtoolsEvent = {
    type: "node";
    id: number;
} | {
    type: "root";
    id: number;
    removed: boolean;
} | {
    type: "diagnostic";
    diagnostic: Diagnostic;
} | {
    type: "flush";
    effects: number;
};
/** The object published as `globalThis.__ZEROLITH_DEVTOOLS__` in development builds. */
export interface DevtoolsHook {
    readonly version: number;
    /** Live reactive nodes, oldest first. */
    nodes(): NodeSnapshot[];
    /** Mounted roots. */
    roots(): RootSnapshot[];
    /** The most recent diagnostics, oldest first. */
    diagnostics(): Diagnostic[];
    /** Subscribes to changes; returns an unsubscribe function. */
    subscribe(listener: (event: DevtoolsEvent) => void): () => void;
}
/** Reads a node's state when the inspector asks. It receives the node so it never has to hold it. */
export type Inspect<T extends object> = (node: T) => {
    value?: unknown;
    observers: number;
};
/**
 * Records a reactive node, held weakly so discarded state can be collected.
 * `inspect` receives the node and reads its state untracked when the
 * inspector asks; it must not capture the node itself. The registry is
 * pruned of collected nodes each time it doubles. An internal node is
 * recorded but not announced, so the inspector's own rendering never wakes
 * it.
 */
export declare function trackNode<T extends object>(node: T, kind: NodeSnapshot["kind"], name: string | undefined, inspect: Inspect<T>): void;
/**
 * Queues values for named state signals created from now on, each taken
 * once. The dev server's client writes them to sessionStorage before a
 * reload; the Vite plugin's runtime calls this between a module's disposal
 * and the re-render that follows. An empty record drops what is left.
 */
export declare function saveRestore(state: Record<string, unknown>): void;
/** Records a mounted root. */
export declare function trackRoot(root: object, container: Node, kind: RootSnapshot["kind"]): void;
/** Forgets a disposed root. */
export declare function untrackRoot(root: object): void;
/** Appends a diagnostic to the feed. */
export declare function trackDiagnostic(record: Diagnostic): void;
/** Announces that a batch flushed `effects` effect runs. */
export declare function trackFlush(effects: number): void;
/** True while code that belongs to the inspector runs, inside `internal` or under an effect or owner created there. */
export declare function isInternal(): boolean;
/** Runs `fn` with everything it creates marked as belonging to the inspector, including what the effects and owners it creates make when they run later. */
export declare function internal<T>(fn: () => T): T;
/** Times `fn` as an entry on a custom track in the browser's Performance panel. */
export declare function measure<T>(track: string, name: string, fn: () => T): T;
//# sourceMappingURL=devtools.d.ts.map