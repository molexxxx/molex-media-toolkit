/**
 * The one record shape every zerolith diagnostic uses, whether it comes from
 * the runtime, the compiler, the CLI, or the dev tools. Tools consume it as
 * data: the overlay renders it, the editor surfaces it, the MCP endpoint
 * returns it, and a terminal prints it.
 */
import { diagnosticCatalog } from "./catalog.js";
import { trackDiagnostic } from "./devtools.js";
/** Base of every diagnostic URL; the code is appended as the path. */
export const DIAGNOSTIC_URL = "https://molexxxx.github.io/zerolith/e/";
/** Builds the full diagnostic record for a catalog code. */
export function diagnostic(code, severity, args, location) {
    const text = diagnosticCatalog[code];
    let url = DIAGNOSTIC_URL + code;
    if (args !== undefined) {
        const query = new URLSearchParams();
        for (const key of Object.keys(args)) {
            query.set(key, String(args[key]));
        }
        url += "?" + query.toString();
    }
    const record = { code, severity, cause: text?.cause ?? "", fix: text?.fix ?? "", url };
    if (args !== undefined) {
        record.args = args;
    }
    if (location !== undefined) {
        record.location = location;
    }
    return record;
}
/** An error thrown by zerolith. The diagnostic carries the machine-readable detail. */
export class ZerolithError extends Error {
    diagnostic;
    constructor(record) {
        const detail = (record.cause === "" ? "" : ": " + record.cause) + (record.fix === "" ? "" : " " + record.fix);
        super(`[zerolith] ${record.code}${detail} ${record.url}`);
        this.name = "ZerolithError";
        this.diagnostic = record;
    }
}
/** Builds an error for a catalog code. */
export function fail(code, args, location) {
    const record = diagnostic(code, "error", args, location);
    trackDiagnostic(record);
    return new ZerolithError(record);
}
const listeners = new Set();
/** Subscribes to warnings, deprecations, and info diagnostics. Returns an unsubscribe function. */
export function onDiagnostic(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
/** Reports a non-throwing diagnostic to every listener. */
export function report(record) {
    trackDiagnostic(record);
    for (const listener of listeners) {
        listener(record);
    }
}
