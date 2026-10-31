export function trackNode(_node, _kind, _name, _inspect) {
}
export function trackRoot(_root, _container, _kind) {
}
export function untrackRoot(_root) {
}
export function trackDiagnostic(_record) {
}
export function trackFlush(_effects) {
}
export function saveRestore(_state) {
}
export function isInternal() {
    return false;
}
export function internal(fn) {
    return fn();
}
export function measure(_track, _name, fn) {
    return fn();
}
