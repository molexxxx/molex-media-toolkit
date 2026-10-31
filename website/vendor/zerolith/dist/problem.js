/**
 * The failure shape the framework speaks over the wire: RFC 9457 problem
 * details, with a `fields` extension member that carries validation
 * messages per input. Servers answer failed requests with it, the typed
 * client throws it, forms show it, and client-side validation produces
 * the same document, so one handler serves every path.
 */
/** The media type of a problem details document. */
export const PROBLEM_MEDIA_TYPE = "application/problem+json";
/** True for an object that carries at least one problem details member with the right type. */
export function isProblem(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const record = value;
    const typed = (key, kind) => key in record && typeof record[key] === kind;
    const fields = record["fields"];
    const hasFields = fields !== null && typeof fields === "object" && !Array.isArray(fields);
    return typed("title", "string") || typed("status", "number") || typed("detail", "string") || typed("type", "string") || hasFields;
}
//# sourceMappingURL=problem.js.map