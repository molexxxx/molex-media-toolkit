/** Decides whether a new value counts as a change. */
export type Equals<T> = (previous: T, next: T) => boolean;
/** Options accepted by `signal()` and `computed()`. */
export interface SignalOptions<T> {
    /** Defaults to `Object.is`. */
    equals?: Equals<T>;
    /** A label shown by the dev tools; it has no effect on behavior. */
    name?: string;
}
/** A value that can be read and tracked. */
export interface ReadableSignal<T> {
    /** Returns the current value and subscribes the running computed value or effect to it. */
    get(): T;
}
/** A value that can be read, tracked, and written. */
export interface Signal<T> extends ReadableSignal<T> {
    /** Stores a new value and queues the effects that depend on it. Writes are not allowed inside computed functions. */
    set(value: T): void;
}
/** The function run by `effect()`; it may return a cleanup function. */
export type EffectFunction = () => void | (() => void);
/** The result of `scope()`. */
export interface Scope<T> {
    /** The value the scope function returned. */
    readonly value: T;
    /** Disposes every effect and nested scope created inside, in reverse order of creation. */
    dispose(): void;
}
/**
 * Owns the effects and scopes created while it runs, independent of any
 * running effect, so a part of the UI can outlive the effect that created
 * it and still be disposed as a unit. Internal to the runtime packages.
 */
export interface Owner {
    /** Runs `fn` untracked with this owner current and returns its result. */
    run<T>(fn: () => T): T;
    /** Disposes everything created under this owner, in reverse order of creation. */
    dispose(): void;
}
/** Creates a writable signal. */
export declare function signal<T>(initial: T, options?: SignalOptions<T>): Signal<T>;
/** Creates a lazily evaluated, memoized value derived from other signals. The function must not write signals. */
export declare function computed<T>(fn: () => T, options?: SignalOptions<T>): ReadableSignal<T>;
/**
 * Runs `fn` now and again whenever a signal it read changes. A returned
 * function is called before the next run and on dispose. Returns the
 * dispose function; the effect is also disposed with its enclosing effect
 * or scope.
 */
export declare function effect(fn: EffectFunction): () => void;
/** Applies several writes and runs the affected effects once, after `fn` returns. */
export declare function batch<T>(fn: () => T): T;
/** Runs `fn` without subscribing the running computed value or effect to the signals it reads. */
export declare function untracked<T>(fn: () => T): T;
/** Creates an owner, itself owned by the current effect or scope. */
export declare function createOwner(): Owner;
/**
 * Runs `fn` untracked as the owner of every effect and scope created inside
 * it, so they can be disposed together.
 */
export declare function scope<T>(fn: () => T): Scope<T>;
/** True for values created by `signal()` or `computed()`. */
export declare function isSignal(value: unknown): value is ReadableSignal<unknown>;
/** Registers `fn` to run when the enclosing effect re-runs or is disposed, or when the enclosing scope is disposed. */
export declare function onDispose(fn: () => void): void;
//# sourceMappingURL=signals.d.ts.map