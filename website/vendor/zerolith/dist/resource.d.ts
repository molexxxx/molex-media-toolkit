/**
 * Async values in the reactive graph. A resource re-runs its loader when
 * the signals read by `params` change, aborts the previous request, ignores
 * stale results, and exposes the outcome as signals.
 */
import { type ReadableSignal } from "./signals.js";
/** The lifecycle of a resource's current request. */
export type ResourceStatus = "idle" | "pending" | "resolved" | "error";
/** What the loader receives. */
export interface LoaderContext<P> {
    /** The value `params` returned; never undefined, because undefined skips loading. */
    params: P;
    /** Aborted when the params change, on reload, and when the owning scope is disposed. */
    abort: AbortSignal;
}
/** What `resource()` takes: a tracked params function and an untracked loader. */
export interface ResourceOptions<P, T> {
    /** Tracked: the signals it reads decide when the loader re-runs. Returning undefined puts the resource in the idle state. */
    params: () => P | undefined;
    /** Untracked: fetches the value for the given params. */
    loader: (context: LoaderContext<P>) => Promise<T>;
}
/** An async value and its request state. */
export interface Resource<T> extends ReadableSignal<T | undefined> {
    /** The last resolved value; kept while a newer request is pending. */
    get(): T | undefined;
    readonly status: ReadableSignal<ResourceStatus>;
    /** True while a request is in flight. */
    readonly pending: ReadableSignal<boolean>;
    /** The rejection of the latest request, or undefined. */
    readonly error: ReadableSignal<unknown>;
    /** Runs the loader again with the current params. */
    reload(): void;
}
/** Creates a resource owned by the current effect or scope. */
export declare function resource<P, T>(options: ResourceOptions<P, T>): Resource<T>;
//# sourceMappingURL=resource.d.ts.map