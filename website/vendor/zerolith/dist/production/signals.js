/**
 * The reactivity core: a push-pull signal graph.
 *
 * State and computed values are sources; computed values and effects are
 * consumers. A write pushes an "outdated" mark through the subscribed part
 * of the graph and queues the effects it reaches; reads pull: a computed
 * value recomputes only when it is read and one of its sources actually
 * changed, so a diamond of dependencies evaluates each node once and an
 * effect runs once per batch with every value it reads already settled.
 *
 * Computed values subscribe to their sources only while something observes
 * them. An unobserved computed value is validated on read against a global
 * version counter, which keeps it correct without keeping it alive in its
 * sources' subscriber lists.
 */
import { internal, isInternal, measure, trackFlush, trackNode } from "./devtools.js";
import { fail } from "./diagnostics.js";
const RUNNING = 1;
const NOTIFIED = 2;
const OUTDATED = 4;
const DISPOSED = 8;
const HAS_ERROR = 16;
const TRACKING = 32;
/** Set on effects the dev tools create: what they create while running belongs to the dev tools too, and their runs are not announced. */
const INTERNAL = 64;
let consumer;
let owner;
let batchDepth = 0;
let pending;
let rounds = 0;
let globalVersion = 0;
/** Makes `node` the running consumer and returns the one it replaces. */
function enter(node) {
    const previous = consumer;
    consumer = node;
    return previous;
}
/** Makes `node` the current owner and returns the one it replaces. */
function own(node) {
    const previous = owner;
    owner = node;
    return previous;
}
function enqueue(node) {
    node.next = pending;
    pending = node;
}
function linkTarget(source, edge) {
    if (source.targets !== edge && edge.prevTarget === undefined) {
        edge.nextTarget = source.targets;
        if (source.targets !== undefined) {
            source.targets.prevTarget = edge;
        }
        source.targets = edge;
    }
}
function unlinkTarget(source, edge) {
    if (source.targets === undefined) {
        return;
    }
    const prev = edge.prevTarget;
    const next = edge.nextTarget;
    if (prev !== undefined) {
        prev.nextTarget = next;
        edge.prevTarget = undefined;
    }
    if (next !== undefined) {
        next.prevTarget = prev;
        edge.nextTarget = undefined;
    }
    if (edge === source.targets) {
        source.targets = next;
    }
}
/** Records that the running consumer read `source`; returns the edge when the read is tracked. */
function track(source) {
    if (consumer === undefined) {
        return undefined;
    }
    let edge = source.edge;
    if (edge === undefined || edge.target !== consumer) {
        edge = {
            source,
            target: consumer,
            version: 0,
            prevSource: consumer.sources,
            nextSource: undefined,
            prevTarget: undefined,
            nextTarget: undefined,
            rollback: source.edge
        };
        if (consumer.sources !== undefined) {
            consumer.sources.nextSource = edge;
        }
        consumer.sources = edge;
        source.edge = edge;
        if (consumer.flags & TRACKING) {
            source.subscribe(edge);
        }
        return edge;
    }
    if (edge.version === -1) {
        edge.version = 0;
        if (edge.nextSource !== undefined) {
            edge.nextSource.prevSource = edge.prevSource;
            if (edge.prevSource !== undefined) {
                edge.prevSource.nextSource = edge.nextSource;
            }
            const tail = consumer.sources;
            edge.prevSource = tail;
            edge.nextSource = undefined;
            if (tail !== undefined) {
                tail.nextSource = edge;
            }
            consumer.sources = edge;
        }
        return edge;
    }
    return undefined;
}
/** Marks every existing edge as unused and points `sources` at the tail so reads append in order. */
function prepareSources(target) {
    for (let edge = target.sources; edge !== undefined; edge = edge.nextSource) {
        const current = edge.source.edge;
        if (current !== undefined) {
            edge.rollback = current;
        }
        edge.source.edge = edge;
        edge.version = -1;
        if (edge.nextSource === undefined) {
            target.sources = edge;
            break;
        }
    }
}
/** Drops the edges a run did not read and points `sources` back at the head. */
function cleanupSources(target) {
    let edge = target.sources;
    let head;
    while (edge !== undefined) {
        const prev = edge.prevSource;
        if (edge.version === -1) {
            edge.source.unsubscribe(edge);
            if (prev !== undefined) {
                prev.nextSource = edge.nextSource;
            }
            if (edge.nextSource !== undefined) {
                edge.nextSource.prevSource = prev;
            }
        }
        else {
            head = edge;
        }
        edge.source.edge = edge.rollback;
        if (edge.rollback !== undefined) {
            edge.rollback = undefined;
        }
        edge = prev;
    }
    target.sources = head;
}
/** True when any source changed since the consumer last read it, checked in read order. */
function stale(target) {
    for (let edge = target.sources; edge !== undefined; edge = edge.nextSource) {
        const source = edge.source;
        if (source.version !== edge.version || !source.refresh() || source.version !== edge.version) {
            return true;
        }
    }
    return false;
}
function endBatch() {
    if (batchDepth > 1) {
        batchDepth--;
        return;
    }
    let error;
    let failed = false;
    let ran = 0;
    while (pending !== undefined) {
        let node = pending;
        pending = undefined;
        rounds++;
        while (node !== undefined) {
            const next = node.next;
            node.next = undefined;
            node.flags &= ~NOTIFIED;
            if (!(node.flags & DISPOSED) && stale(node)) {
                if (!(node.flags & INTERNAL)) {
                    ran++;
                }
                try {
                    node.run();
                }
                catch (caught) {
                    if (!failed) {
                        error = caught;
                        failed = true;
                    }
                }
            }
            node = next;
        }
    }
    rounds = 0;
    batchDepth--;
    if (ran > 0) {
        trackFlush(ran);
    }
    if (failed) {
        throw error;
    }
}
function countTargets(source) {
    let count = 0;
    for (let edge = source.targets; edge !== undefined; edge = edge.nextTarget) {
        count++;
    }
    return count;
}
class State {
    version = 0;
    targets = undefined;
    edge = undefined;
    value;
    equals;
    constructor(value, equals) {
        this.value = value;
        this.equals = equals;
    }
    get() {
        const edge = track(this);
        if (edge !== undefined) {
            edge.version = this.version;
        }
        return this.value;
    }
    set(value) {
        if (consumer instanceof Computed) {
            throw fail("signal_written_inside_computed");
        }
        if (this.equals(this.value, value)) {
            return;
        }
        if (rounds > 100) {
            throw fail("effect_loop");
        }
        this.value = value;
        this.version++;
        globalVersion++;
        batchDepth++;
        try {
            for (let edge = this.targets; edge !== undefined; edge = edge.nextTarget) {
                edge.target.notify();
            }
        }
        finally {
            endBatch();
        }
    }
    subscribe(edge) {
        linkTarget(this, edge);
    }
    unsubscribe(edge) {
        unlinkTarget(this, edge);
    }
    refresh() {
        return true;
    }
    /** Takes a value saved before a development reload. */
    restore(value) {
        this.set(value);
    }
}
class Computed {
    version = 0;
    targets = undefined;
    edge = undefined;
    flags = OUTDATED;
    sources = undefined;
    value = undefined;
    seen = -1;
    fn;
    equals;
    constructor(fn, equals) {
        this.fn = fn;
        this.equals = equals;
    }
    get() {
        if (this.flags & RUNNING) {
            throw fail("computed_cycle");
        }
        const edge = track(this);
        this.refresh();
        if (edge !== undefined) {
            edge.version = this.version;
        }
        if (this.flags & HAS_ERROR) {
            throw this.value;
        }
        return this.value;
    }
    refresh() {
        this.flags &= ~NOTIFIED;
        if (this.flags & RUNNING) {
            return false;
        }
        if ((this.flags & (OUTDATED | TRACKING)) === TRACKING) {
            return true;
        }
        this.flags &= ~OUTDATED;
        if (this.seen === globalVersion) {
            return true;
        }
        this.seen = globalVersion;
        this.flags |= RUNNING;
        if (this.version > 0 && !stale(this)) {
            this.flags &= ~RUNNING;
            return true;
        }
        const previous = enter(this);
        try {
            prepareSources(this);
            const value = this.fn();
            if ((this.flags & HAS_ERROR) || this.version === 0 || !this.equals(this.value, value)) {
                this.value = value;
                this.flags &= ~HAS_ERROR;
                this.version++;
            }
        }
        catch (error) {
            this.value = error;
            this.flags |= HAS_ERROR;
            this.version++;
        }
        consumer = previous;
        cleanupSources(this);
        this.flags &= ~RUNNING;
        return true;
    }
    notify() {
        if (!(this.flags & NOTIFIED)) {
            this.flags |= OUTDATED | NOTIFIED;
            for (let edge = this.targets; edge !== undefined; edge = edge.nextTarget) {
                edge.target.notify();
            }
        }
    }
    subscribe(edge) {
        if (this.targets === undefined) {
            this.flags |= OUTDATED | TRACKING;
            for (let source = this.sources; source !== undefined; source = source.nextSource) {
                source.source.subscribe(source);
            }
        }
        linkTarget(this, edge);
    }
    unsubscribe(edge) {
        if (this.targets !== undefined) {
            unlinkTarget(this, edge);
            if (this.targets === undefined) {
                this.flags &= ~TRACKING;
                for (let source = this.sources; source !== undefined; source = source.nextSource) {
                    source.source.unsubscribe(source);
                }
            }
        }
    }
}
class Effect {
    flags = TRACKING;
    sources = undefined;
    next = undefined;
    children = undefined;
    fn;
    cleanup = undefined;
    constructor(fn) {
        this.fn = fn;
        if (isInternal()) {
            this.flags |= INTERNAL;
        }
    }
    run() {
        if (this.flags & RUNNING) {
            throw fail("effect_cycle");
        }
        this.flags |= RUNNING;
        this.flags &= ~DISPOSED;
        this.settle();
        prepareSources(this);
        batchDepth++;
        const previousConsumer = enter(this);
        const previousOwner = own(this);
        try {
            if (this.fn !== undefined) {
                const cleanup = this.flags & INTERNAL ? internal(this.fn) : this.fn();
                if (typeof cleanup === "function") {
                    this.cleanup = cleanup;
                }
            }
        }
        finally {
            consumer = previousConsumer;
            owner = previousOwner;
            cleanupSources(this);
            this.flags &= ~RUNNING;
            if (this.flags & DISPOSED) {
                this.release();
            }
            endBatch();
        }
    }
    notify() {
        if (!(this.flags & NOTIFIED)) {
            this.flags |= NOTIFIED;
            enqueue(this);
        }
    }
    dispose() {
        this.flags |= DISPOSED;
        if (!(this.flags & RUNNING)) {
            this.release();
        }
    }
    /** Disposes nested effects and scopes, then runs the cleanup the last run returned. */
    settle() {
        const children = this.children;
        this.children = undefined;
        const cleanup = this.cleanup;
        this.cleanup = undefined;
        if (children === undefined && cleanup === undefined) {
            return;
        }
        batchDepth++;
        const previous = consumer;
        consumer = undefined;
        try {
            if (children !== undefined) {
                disposeAll(children);
            }
            if (cleanup !== undefined) {
                cleanup();
            }
        }
        catch (error) {
            this.flags &= ~RUNNING;
            this.flags |= DISPOSED;
            this.release();
            throw error;
        }
        finally {
            consumer = previous;
            endBatch();
        }
    }
    release() {
        for (let edge = this.sources; edge !== undefined; edge = edge.nextSource) {
            edge.source.unsubscribe(edge);
        }
        this.fn = undefined;
        this.sources = undefined;
        this.settle();
    }
}
function disposeAll(children) {
    while (children.length > 0) {
        children.pop()?.();
    }
}
function adopt(dispose) {
    if (owner !== undefined) {
        if (owner.children === undefined) {
            owner.children = [];
        }
        owner.children.push(dispose);
    }
}
/** Creates a writable signal. */
export function signal(initial, options) {
    const node = new State(initial, options?.equals ?? Object.is);
    trackNode(node, "state", options?.name, inspectSource);
    return node;
}
/** Reads a source's value and observer count for the dev tools without holding the source. */
function inspectSource(node) {
    return { value: untracked(() => node.get()), observers: countTargets(node) };
}
function inspectEffect() {
    return { observers: 0 };
}
/** Creates a lazily evaluated, memoized value derived from other signals. The function must not write signals. */
export function computed(fn, options) {
    const node = new Computed(fn, options?.equals ?? Object.is);
    trackNode(node, "computed", options?.name ?? (fn.name === "" ? undefined : fn.name), inspectSource);
    return node;
}
/**
 * Runs `fn` now and again whenever a signal it read changes. A returned
 * function is called before the next run and on dispose. Returns the
 * dispose function; the effect is also disposed with its enclosing effect
 * or scope.
 */
export function effect(fn) {
    const node = new Effect(fn);
    trackNode(node, "effect", fn.name === "" ? undefined : fn.name, inspectEffect);
    try {
        measure("Signals", "effect", () => {
            node.run();
        });
    }
    catch (error) {
        node.dispose();
        throw error;
    }
    const dispose = () => {
        node.dispose();
    };
    adopt(dispose);
    return dispose;
}
/** Applies several writes and runs the affected effects once, after `fn` returns. */
export function batch(fn) {
    if (batchDepth > 0) {
        return fn();
    }
    batchDepth++;
    try {
        return fn();
    }
    finally {
        endBatch();
    }
}
/** Runs `fn` without subscribing the running computed value or effect to the signals it reads. */
export function untracked(fn) {
    const previous = consumer;
    consumer = undefined;
    try {
        return fn();
    }
    finally {
        consumer = previous;
    }
}
/** Creates an owner, itself owned by the current effect or scope. */
export function createOwner() {
    const node = { children: undefined };
    const inside = isInternal();
    const handle = {
        run(fn) {
            const previousOwner = owner;
            const previousConsumer = consumer;
            owner = node;
            consumer = undefined;
            try {
                return inside ? internal(fn) : fn();
            }
            finally {
                owner = previousOwner;
                consumer = previousConsumer;
            }
        },
        dispose() {
            const children = node.children;
            node.children = undefined;
            if (children !== undefined) {
                disposeAll(children);
            }
        }
    };
    adopt(() => handle.dispose());
    return handle;
}
/**
 * Runs `fn` untracked as the owner of every effect and scope created inside
 * it, so they can be disposed together.
 */
export function scope(fn) {
    const handle = createOwner();
    let value;
    try {
        value = handle.run(fn);
    }
    catch (error) {
        handle.dispose();
        throw error;
    }
    return { value, dispose: () => handle.dispose() };
}
/** True for values created by `signal()` or `computed()`. */
export function isSignal(value) {
    return value instanceof State || value instanceof Computed;
}
/** Registers `fn` to run when the enclosing effect re-runs or is disposed, or when the enclosing scope is disposed. */
export function onDispose(fn) {
    if (owner === undefined) {
        throw fail("on_dispose_outside_scope");
    }
    adopt(fn);
}
