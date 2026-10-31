/**
 * Async values in the reactive graph. A resource re-runs its loader when
 * the signals read by `params` change, aborts the previous request, ignores
 * stale results, and exposes the outcome as signals.
 */
import { batch, computed, effect, signal, untracked } from "./signals.js";
/** Creates a resource owned by the current effect or scope. */
export function resource(options) {
    const value = signal(undefined);
    const error = signal(undefined);
    const status = signal("idle");
    let controller;
    let generation = 0;
    let current;
    const load = (params) => {
        controller?.abort();
        controller = undefined;
        generation++;
        if (params === undefined) {
            batch(() => {
                status.set("idle");
                error.set(undefined);
            });
            return;
        }
        const run = generation;
        const abort = new AbortController();
        controller = abort;
        batch(() => {
            status.set("pending");
            error.set(undefined);
        });
        options.loader({ params, abort: abort.signal }).then((result) => {
            if (run !== generation) {
                return;
            }
            batch(() => {
                value.set(result);
                status.set("resolved");
            });
        }, (reason) => {
            if (run !== generation) {
                return;
            }
            batch(() => {
                error.set(reason);
                status.set("error");
            });
        });
    };
    effect(() => {
        const params = options.params();
        current = params;
        untracked(() => {
            load(params);
        });
        return () => {
            generation++;
            controller?.abort();
            controller = undefined;
        };
    });
    return {
        get: () => value.get(),
        status,
        pending: computed(() => status.get() === "pending"),
        error,
        reload: () => {
            load(current);
        }
    };
}
