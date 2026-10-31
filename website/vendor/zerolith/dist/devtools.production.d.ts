import type { Diagnostic } from "./diagnostics.js";
export interface NodeSnapshot {
    id: number;
    kind: "state" | "computed" | "effect";
    name: string | undefined;
    value?: unknown;
    observers: number;
    internal: boolean;
}
export interface RootSnapshot {
    id: number;
    kind: "render" | "hydrate";
    container: Node;
    internal: boolean;
}
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
export interface DevtoolsHook {
    readonly version: number;
    nodes(): NodeSnapshot[];
    roots(): RootSnapshot[];
    diagnostics(): Diagnostic[];
    subscribe(listener: (event: DevtoolsEvent) => void): () => void;
}
export type Inspect<T extends object> = (node: T) => {
    value?: unknown;
    observers: number;
};
export declare function trackNode<T extends object>(_node: T, _kind: NodeSnapshot["kind"], _name: string | undefined, _inspect: Inspect<T>): void;
export declare function trackRoot(_root: object, _container: Node, _kind: RootSnapshot["kind"]): void;
export declare function untrackRoot(_root: object): void;
export declare function trackDiagnostic(_record: Diagnostic): void;
export declare function trackFlush(_effects: number): void;
export declare function saveRestore(_state: Record<string, unknown>): void;
export declare function isInternal(): boolean;
export declare function internal<T>(fn: () => T): T;
export declare function measure<T>(_track: string, _name: string, fn: () => T): T;
//# sourceMappingURL=devtools.production.d.ts.map