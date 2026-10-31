/**
 * Rendering: template instantiation with fine-grained parts. A template is
 * cloned once and each expression binds to one node; a signal in a part
 * subscribes that part alone, so an update touches one text node or
 * attribute and the component function never runs again.
 *
 * Hydration binds the same parts to markup the server rendered instead of
 * cloning: the server wraps every child part's content in comment markers,
 * and the client walks the existing nodes with the template's part indices.
 */
import { URL_ATTRIBUTES, describe, isNothing, isText, join, safeUrl } from "./binding.js";
import { measure, trackRoot, untrackRoot } from "./devtools.js";
import { diagnostic, fail, report } from "./diagnostics.js";
import { createOwner, effect, isSignal, onDispose, signal, untracked } from "./signals.js";
import { ATTRIBUTE, BOOLEAN, CHILD, EVENT, REF, prepare, trusted, walker } from "./template.js";
/** Brand carried by every value the renderer accepts as a description of UI. */
export const VIEW = Symbol("zerolith.view");
/** Comment data that opens a server-rendered child part. */
export const PART_START = "zl:p";
/** Comment data that closes a server-rendered child part. */
export const PART_END = "/zl:p";
class TemplateResult {
    [VIEW] = true;
    strings;
    values;
    constructor(strings, values) {
        this.strings = strings;
        this.values = values;
    }
}
/** A view that controls its own part. `resolve` gives the server renderer the view to draw for the current state. */
class Directive {
    [VIEW] = true;
}
class RawHtml {
    [VIEW] = true;
    markup;
    constructor(markup) {
        this.markup = markup;
    }
}
/**
 * Marks a string as markup to insert without escaping. This is the one way
 * to put HTML you already trust into a view, for example content rendered
 * from Markdown you wrote. Never pass user input.
 */
export function unsafeHtml(markup) {
    return new RawHtml(markup);
}
/** True for the result of `unsafeHtml`. */
export function isRawHtml(value) {
    return value instanceof RawHtml;
}
/** True for the result of an `html` literal. */
export function isTemplate(value) {
    return value instanceof TemplateResult;
}
/** True for the views produced by `each` and `when`. */
export function isDirective(value) {
    return value instanceof Directive;
}
/** The view a directive would show for the current state, for renderers without a DOM. */
export function resolveDirective(view) {
    return view.resolve();
}
/** True when the server must wrap a directive's resolved view in its own part markers. */
export function directiveWrapsBranch(view) {
    return view.wrapsBranch;
}
/** Describes markup with live bindings. Values are bound as content or inside attribute values. */
export function html(strings, ...values) {
    return new TemplateResult(strings, values);
}
function anchorBefore(node) {
    const comment = document.createComment("");
    node.parentNode?.insertBefore(comment, node);
    return comment;
}
let mismatches;
function mismatch(kind, expected, found) {
    const record = { kind };
    if (expected !== undefined) {
        record.expected = expected;
    }
    if (found !== undefined) {
        record.found = found;
    }
    mismatches?.push(record);
    report(diagnostic("hydration_mismatch", "warning", { kind, expected: expected ?? "", found: found ?? "" }));
}
function isStart(node) {
    return node !== null && node.nodeType === 8 && node.data === PART_START;
}
function isEnd(node) {
    return node !== null && node.nodeType === 8 && node.data === PART_END;
}
/** The closing marker that matches an opening one, skipping nested pairs. */
function matchingEnd(start) {
    let depth = 1;
    for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
        if (isStart(node)) {
            depth++;
        }
        else if (isEnd(node)) {
            depth--;
            if (depth === 0) {
                return node;
            }
        }
    }
    return undefined;
}
function removeUntil(from, until) {
    let node = from;
    while (node !== null && node !== until) {
        const next = node.nextSibling;
        node.remove();
        node = next;
    }
}
class Instance {
    strings;
    fragment;
    nodes;
    parts;
    cursors;
    constructor(strings, parts, nodes, fragment, cursors) {
        this.strings = strings;
        this.parts = parts;
        this.nodes = nodes;
        this.fragment = fragment;
        this.cursors = cursors;
    }
    /** Clones the template and binds its parts. */
    static create(strings, prepared) {
        const fragment = document.importNode(prepared.content, true);
        const walk = walker(fragment);
        const parts = [];
        let index = 0;
        let next = 0;
        let node = walk.nextNode();
        while (next < prepared.parts.length && node !== null) {
            const spec = prepared.parts[next];
            if (spec !== undefined && spec.index === index) {
                parts.push(spec.kind === CHILD ? new ChildPart(node) : new AttributePart(node, spec));
                next++;
                continue;
            }
            node = walk.nextNode();
            index++;
        }
        return new Instance(strings, parts, Array.from(fragment.childNodes), fragment, undefined);
    }
    /** Binds the template's parts to server-rendered nodes between `cursor` and `anchor`, or returns undefined when they do not line up. */
    static adopt(strings, prepared, cursor, anchor) {
        const nodes = [];
        for (let node = cursor; node !== anchor; node = node.nextSibling) {
            if (node === null) {
                return undefined;
            }
            nodes.push(node);
        }
        const parts = [];
        const cursors = new Map();
        const expected = walker(prepared.content);
        let index = 0;
        let next = 0;
        let broken = false;
        /** Advances through the template's own nodes in lockstep and checks the served node has the same shape. */
        const matches = (node) => {
            const model = expected.nextNode();
            if (model === null || model.nodeType !== node.nodeType) {
                return false;
            }
            if (node.nodeType === 1) {
                return model.localName === node.localName;
            }
            const data = node.data;
            return isStart(node) ? model.data === "zl$" : model.data === data;
        };
        const visit = (first, last) => {
            for (let node = first; node !== null && node !== last && !broken; node = node.nextSibling) {
                if (node.nodeType !== 1 && node.nodeType !== 8) {
                    continue;
                }
                if (!matches(node)) {
                    broken = true;
                    return;
                }
                if (node.nodeType === 8) {
                    if (isStart(node)) {
                        const spec = prepared.parts[next];
                        const end = matchingEnd(node);
                        if (spec === undefined || spec.kind !== CHILD || spec.index !== index || end === undefined) {
                            broken = true;
                            return;
                        }
                        const part = new ChildPart(end);
                        parts.push(part);
                        cursors.set(part, node.nextSibling ?? end);
                        next++;
                        index++;
                        node = end;
                        continue;
                    }
                    index++;
                    continue;
                }
                for (let spec = prepared.parts[next]; spec !== undefined && spec.index === index; spec = prepared.parts[next]) {
                    if (spec.kind === CHILD) {
                        broken = true;
                        return;
                    }
                    parts.push(new AttributePart(node, spec));
                    next++;
                }
                index++;
                visit(node.firstChild, null);
            }
        };
        visit(cursor, anchor);
        if (broken || next !== prepared.parts.length || expected.nextNode() !== null) {
            return undefined;
        }
        return new Instance(strings, parts, nodes, undefined, cursors);
    }
    update(values) {
        let offset = 0;
        for (const part of this.parts) {
            const slice = values.slice(offset, offset + part.count);
            const cursor = this.cursors?.get(part);
            if (cursor !== undefined && part instanceof ChildPart) {
                part.set(slice[0], cursor);
            }
            else {
                part.bind(slice);
            }
            offset += part.count;
        }
    }
    remove() {
        for (const node of this.nodes) {
            node.remove();
        }
    }
}
/** A position between two nodes that displays one value. */
class ChildPart {
    count = 1;
    anchor;
    owner = undefined;
    instance = undefined;
    text = undefined;
    node = undefined;
    raw = undefined;
    items = undefined;
    controller = undefined;
    constructor(anchor) {
        this.anchor = anchor;
    }
    bind(values) {
        this.set(values[0]);
    }
    /** Replaces the displayed value, disposing whatever the previous value created. With `cursor`, adopts the server-rendered nodes starting there instead of creating new ones. */
    set(value, cursor) {
        this.owner?.dispose();
        this.owner = createOwner();
        this.owner.run(() => {
            if (isSignal(value)) {
                let adopt = cursor;
                effect(() => {
                    const current = value.get();
                    if (adopt !== undefined) {
                        const start = adopt;
                        adopt = undefined;
                        this.adopt(current, start);
                    }
                    else {
                        this.apply(current);
                    }
                });
            }
            else if (cursor !== undefined) {
                this.adopt(value, cursor);
            }
            else {
                this.apply(value);
            }
        });
    }
    /** Removes the displayed nodes. Effects are owned by `set()` and disposed there. */
    clear() {
        if (this.controller !== undefined) {
            this.controller.dispose();
            this.controller = undefined;
        }
        if (this.items !== undefined) {
            for (const item of this.items) {
                item.clear();
                item.anchor.remove();
            }
            this.items = undefined;
        }
        if (this.instance !== undefined) {
            this.instance.remove();
            this.instance = undefined;
        }
        if (this.node !== undefined) {
            this.node.remove();
            this.node = undefined;
        }
        if (this.raw !== undefined) {
            for (const node of this.raw) {
                node.remove();
            }
            this.raw = undefined;
        }
        if (this.text !== undefined) {
            this.text.remove();
            this.text = undefined;
        }
    }
    /** Removes the displayed nodes and the anchor itself. */
    destroy() {
        this.owner?.dispose();
        this.owner = undefined;
        this.clear();
        this.anchor.remove();
    }
    /** Takes over the server-rendered nodes from `cursor` to the anchor for `value`, repairing any disagreement. */
    adopt(value, cursor) {
        const { anchor } = this;
        if (isNothing(value)) {
            if (cursor !== anchor) {
                mismatch("extra", "", cursor.nodeName);
                removeUntil(cursor, anchor);
            }
            return;
        }
        if (isText(value)) {
            const text = String(value);
            if (cursor.nodeType === 3 && cursor.nextSibling === anchor) {
                const node = cursor;
                if (node.data !== text) {
                    mismatch("text", text, node.data);
                    node.data = text;
                }
                this.text = node;
                return;
            }
            mismatch("missing", text, cursor === anchor ? "" : cursor.nodeName);
            removeUntil(cursor, anchor);
            this.apply(value);
            return;
        }
        if (value instanceof TemplateResult) {
            const instance = Instance.adopt(value.strings, prepare(value.strings), cursor, anchor);
            if (instance !== undefined) {
                this.instance = instance;
                instance.update(value.values);
                return;
            }
            mismatch("structure", "template", cursor === anchor ? "" : cursor.nodeName);
            removeUntil(cursor, anchor);
            this.apply(value);
            return;
        }
        if (value instanceof Directive) {
            this.controller = value.mount(this, cursor);
            return;
        }
        if (value instanceof RawHtml) {
            const nodes = [];
            for (let node = cursor; node !== null && node !== anchor; node = node.nextSibling) {
                nodes.push(node);
            }
            this.raw = nodes;
            return;
        }
        if (isSignal(value)) {
            let first = true;
            effect(() => {
                const current = value.get();
                if (first) {
                    first = false;
                    this.adopt(current, cursor);
                }
                else {
                    this.apply(current);
                }
            });
            return;
        }
        if (typeof value === "object" && Symbol.iterator in value) {
            const items = [];
            let node = cursor;
            for (const item of value) {
                const end = isStart(node) ? matchingEnd(node) : undefined;
                if (end === undefined) {
                    mismatch("missing", "item", node === anchor ? "" : node.nodeName);
                    const part = new ChildPart(anchorBefore(anchor));
                    items.push(part);
                    part.set(item);
                    continue;
                }
                const part = new ChildPart(end);
                items.push(part);
                part.set(item, node.nextSibling ?? end);
                node = end.nextSibling ?? anchor;
            }
            if (node !== anchor) {
                mismatch("extra", "", node.nodeName);
                removeUntil(node, anchor);
            }
            this.items = items;
            return;
        }
        throw fail("unrenderable_value", { type: describe(value) });
    }
    apply(value) {
        if (isNothing(value)) {
            this.clear();
            return;
        }
        if (isText(value)) {
            const text = String(value);
            if (this.text !== undefined) {
                this.text.data = text;
                return;
            }
            this.clear();
            this.text = document.createTextNode(text);
            this.anchor.parentNode?.insertBefore(this.text, this.anchor);
            return;
        }
        if (value instanceof TemplateResult) {
            if (this.instance !== undefined && this.instance.strings === value.strings) {
                this.instance.update(value.values);
                return;
            }
            this.clear();
            const instance = Instance.create(value.strings, prepare(value.strings));
            instance.update(value.values);
            if (instance.fragment !== undefined) {
                this.anchor.parentNode?.insertBefore(instance.fragment, this.anchor);
            }
            this.instance = instance;
            return;
        }
        if (value instanceof Directive) {
            this.clear();
            this.controller = value.mount(this);
            return;
        }
        if (value instanceof RawHtml) {
            this.clear();
            const template = document.createElement("template");
            template.innerHTML = trusted(value.markup);
            const nodes = Array.from(template.content.childNodes);
            this.anchor.parentNode?.insertBefore(template.content, this.anchor);
            this.raw = nodes;
            return;
        }
        if (isSignal(value)) {
            effect(() => {
                this.apply(value.get());
            });
            return;
        }
        if (typeof Node !== "undefined" && value instanceof Node) {
            this.clear();
            this.anchor.parentNode?.insertBefore(value, this.anchor);
            this.node = value;
            return;
        }
        if (typeof value === "object" && Symbol.iterator in value) {
            this.clear();
            const items = [];
            for (const item of value) {
                const part = new ChildPart(anchorBefore(this.anchor));
                items.push(part);
                part.set(item);
            }
            this.items = items;
            return;
        }
        throw fail("unrenderable_value", { type: describe(value) });
    }
}
/** An attribute, boolean attribute, property, or event binding on one element. */
class AttributePart {
    count;
    element;
    spec;
    owner = undefined;
    listener = undefined;
    listenerOptions = undefined;
    target = undefined;
    constructor(element, spec) {
        this.element = element;
        this.spec = spec;
        this.count = spec.count;
    }
    bind(values) {
        if (this.spec.kind === EVENT) {
            this.listen(values[0]);
            return;
        }
        if (this.spec.kind === REF) {
            this.reference(values[0]);
            return;
        }
        this.owner?.dispose();
        this.owner = createOwner();
        this.owner.run(() => {
            if (values.some(isSignal)) {
                effect(() => {
                    this.apply(values.map((value) => (isSignal(value) ? value.get() : value)));
                });
            }
            else {
                this.apply(values);
            }
        });
    }
    apply(values) {
        const { element, spec } = this;
        const value = values[0];
        if (spec.kind === BOOLEAN) {
            if (value) {
                element.setAttribute(spec.name, "");
            }
            else {
                element.removeAttribute(spec.name);
            }
            return;
        }
        if (spec.kind === ATTRIBUTE) {
            if (spec.count === 1 && (value === null || value === undefined)) {
                element.removeAttribute(spec.name);
                return;
            }
            const text = join(spec.strings, values);
            if (URL_ATTRIBUTES.has(spec.name.toLowerCase()) && !safeUrl(text)) {
                element.removeAttribute(spec.name);
                report(diagnostic("unsafe_url_blocked", "warning", { attribute: spec.name, value: text }));
                return;
            }
            element.setAttribute(spec.name, text);
            return;
        }
        element[spec.name] = value;
    }
    /** Hands the element to a writable signal or a callback; the signal is reset when the element's template is removed. */
    reference(target) {
        if (target === this.target) {
            return;
        }
        this.target = target;
        this.owner?.dispose();
        this.owner = createOwner();
        this.owner.run(() => {
            const { element } = this;
            if (typeof target === "function") {
                target(element);
                return;
            }
            if (isSignal(target) && typeof target.set === "function") {
                const holder = target;
                holder.set(element);
                onDispose(() => {
                    if (untracked(() => holder.get()) === element) {
                        holder.set(undefined);
                    }
                });
                return;
            }
            throw fail("ref_not_assignable", { type: describe(target) });
        });
    }
    listen(handler) {
        if (this.listener !== undefined) {
            this.element.removeEventListener(this.spec.name, this.listener, this.listenerOptions);
            this.listener = undefined;
            this.listenerOptions = undefined;
        }
        if (handler === null || handler === undefined) {
            return;
        }
        if (typeof handler === "function") {
            this.listener = handler;
        }
        else if (typeof handler === "object" && typeof handler.handleEvent === "function") {
            const object = handler;
            this.listener = object;
            const options = {};
            if (object.capture !== undefined) {
                options.capture = object.capture;
            }
            if (object.passive !== undefined) {
                options.passive = object.passive;
            }
            if (object.once !== undefined) {
                options.once = object.once;
            }
            this.listenerOptions = options;
        }
        else {
            throw fail("event_handler_not_function", { event: this.spec.name, type: describe(handler) });
        }
        this.element.addEventListener(this.spec.name, this.listener, this.listenerOptions);
    }
}
/** The element behind a mount target; a selector that matches nothing is a `mount_target_missing` error. */
function resolveTarget(target) {
    if (typeof target !== "string") {
        return target;
    }
    const element = document.querySelector(target);
    if (element === null) {
        throw fail("mount_target_missing", { selector: target });
    }
    return element;
}
/** Renders a view at the end of `target`, an element or a selector for one, and returns a handle to dispose it. */
export function render(view, target) {
    const container = resolveTarget(target);
    const anchor = document.createComment("");
    container.append(anchor);
    const part = new ChildPart(anchor);
    const owner = createOwner();
    measure("Render", "render", () => {
        owner.run(() => {
            part.set(view);
        });
    });
    const root = {
        container,
        dispose() {
            untrackRoot(root);
            owner.dispose();
            part.destroy();
        }
    };
    trackRoot(root, container, "render");
    return root;
}
/**
 * Attaches a view to markup the server rendered into `target`, an element
 * or a selector for one, with `renderToString`, reusing the nodes and
 * binding signals, listeners, properties, and refs. Any disagreement is
 * repaired on the client and returned in `mismatches`. Without
 * server-rendered markup it falls back to `render`.
 */
export function hydrate(view, target) {
    const container = resolveTarget(target);
    const found = [];
    let start;
    for (let node = container.firstChild; node !== null; node = node.nextSibling) {
        if (isStart(node)) {
            start = node;
            break;
        }
    }
    const end = start === undefined ? undefined : matchingEnd(start);
    const owner = createOwner();
    let part;
    const previous = mismatches;
    mismatches = found;
    try {
        measure("Render", "hydrate", () => {
            if (start === undefined || end === undefined) {
                mismatch("root", "server-rendered markup", "");
                const anchor = document.createComment("");
                container.append(anchor);
                part = new ChildPart(anchor);
                owner.run(() => {
                    part.set(view);
                });
            }
            else {
                const cursor = start.nextSibling ?? end;
                part = new ChildPart(end);
                owner.run(() => {
                    part.set(view, cursor);
                });
            }
        });
    }
    finally {
        mismatches = previous;
    }
    const result = {
        container,
        mismatches: found,
        dispose() {
            untrackRoot(result);
            owner.dispose();
            part.destroy();
            start?.remove();
        }
    };
    trackRoot(result, container, "hydrate");
    return result;
}
/** Reads a signal or returns a plain value unchanged. */
function read(value) {
    return isSignal(value) ? value.get() : value;
}
/** Indices of one longest strictly increasing subsequence of `positions`, ignoring -1 entries. */
function longestIncreasing(positions) {
    const tails = [];
    const previous = Array.from({ length: positions.length }, () => -1);
    for (let i = 0; i < positions.length; i++) {
        const value = positions[i] ?? -1;
        if (value === -1) {
            continue;
        }
        let low = 0;
        let high = tails.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            const index = tails[middle] ?? 0;
            if ((positions[index] ?? -1) < value) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        previous[i] = low > 0 ? (tails[low - 1] ?? -1) : -1;
        tails[low] = i;
    }
    const kept = new Set();
    let cursor = tails.length > 0 ? (tails[tails.length - 1] ?? -1) : -1;
    while (cursor !== -1) {
        kept.add(cursor);
        cursor = previous[cursor] ?? -1;
    }
    return kept;
}
function moveRow(row, before) {
    const parent = before.parentNode;
    if (parent === null) {
        return;
    }
    let node = row.start;
    const end = row.part.anchor;
    while (node !== null && node !== end) {
        const next = node.nextSibling;
        parent.insertBefore(node, before);
        node = next;
    }
    parent.insertBefore(end, before);
}
class Keyed extends Directive {
    wrapsBranch = false;
    items;
    key;
    row;
    constructor(items, key, row) {
        super();
        this.items = items;
        this.key = key;
        this.row = row;
    }
    keyOf(value, index, keys) {
        const key = this.key(value, index);
        if (key === undefined) {
            throw fail("each_key_undefined", { index });
        }
        if (keys.has(key)) {
            throw fail("each_key_duplicate", { key: String(key), index });
        }
        keys.add(key);
        return key;
    }
    mount(part, cursor) {
        const owner = createOwner();
        const rows = new Map();
        let order = [];
        const end = part.anchor;
        const create = (key, value, index, adopt) => {
            const start = adopt?.start ?? anchorBefore(end);
            const rowPart = new ChildPart(adopt?.end ?? anchorBefore(end));
            const row = { start, part: rowPart, item: signal(value), index: signal(index), owner: createOwner() };
            row.owner.run(() => {
                rowPart.set(this.row(row.item, row.index), adopt === undefined ? undefined : adopt.start.nextSibling ?? adopt.end);
            });
            rows.set(key, row);
            return row;
        };
        const reconcile = (list) => {
            const next = [];
            const keys = new Set();
            for (let i = 0; i < list.length; i++) {
                const value = list[i];
                const key = this.keyOf(value, i, keys);
                const existing = rows.get(key);
                if (existing !== undefined) {
                    existing.item.set(value);
                    existing.index.set(i);
                    next.push(existing);
                }
                else {
                    next.push(create(key, value, i));
                }
            }
            for (const [key, row] of rows) {
                if (!keys.has(key)) {
                    row.owner.dispose();
                    row.part.destroy();
                    row.start.remove();
                    rows.delete(key);
                }
            }
            const previousIndex = new Map();
            for (let i = 0; i < order.length; i++) {
                previousIndex.set(order[i], i);
            }
            const positions = next.map((row) => previousIndex.get(row) ?? -1);
            const kept = longestIncreasing(positions);
            let before = end;
            for (let i = next.length - 1; i >= 0; i--) {
                const row = next[i];
                if (!kept.has(i)) {
                    moveRow(row, before);
                }
                before = row.start;
            }
            order = next;
        };
        if (cursor !== undefined) {
            owner.run(() => {
                const list = untracked(() => read(this.items));
                const keys = new Set();
                let node = cursor;
                const adopted = [];
                for (let i = 0; i < list.length; i++) {
                    const value = list[i];
                    const key = this.keyOf(value, i, keys);
                    const rowStart = isStart(node) ? node : undefined;
                    const rowEnd = rowStart === undefined ? undefined : matchingEnd(rowStart);
                    if (rowStart === undefined || rowEnd === undefined) {
                        mismatch("missing", "row", node === end ? "" : node.nodeName);
                        adopted.push(create(key, value, i));
                        continue;
                    }
                    adopted.push(create(key, value, i, { start: rowStart, end: rowEnd }));
                    node = rowEnd.nextSibling ?? end;
                }
                if (node !== end) {
                    mismatch("extra", "", node.nodeName);
                    removeUntil(node, end);
                }
                order = adopted;
            });
        }
        let initial = cursor !== undefined;
        owner.run(() => {
            effect(() => {
                const list = read(this.items);
                if (initial) {
                    initial = false;
                    return;
                }
                owner.run(() => {
                    reconcile(list);
                });
            });
        });
        return {
            dispose() {
                owner.dispose();
                for (const row of order) {
                    row.part.destroy();
                    row.start.remove();
                }
                rows.clear();
                order = [];
            }
        };
    }
    resolve() {
        const list = read(this.items);
        const keys = new Set();
        return list.map((value, index) => {
            this.keyOf(value, index, keys);
            return this.row(signal(value), signal(index));
        });
    }
}
/**
 * Renders one row per item, keyed, updating rows in place when their key
 * survives and moving the fewest nodes when the order changes.
 */
export function each(items, key, row) {
    return new Keyed(items, key, row);
}
class Conditional extends Directive {
    wrapsBranch = true;
    condition;
    whenTrue;
    whenFalse;
    constructor(condition, whenTrue, whenFalse) {
        super();
        this.condition = condition;
        this.whenTrue = whenTrue;
        this.whenFalse = whenFalse;
    }
    mount(part, cursor) {
        const owner = createOwner();
        let inner;
        let shown;
        let branch;
        const innerEnd = cursor !== undefined && isStart(cursor) ? matchingEnd(cursor) : undefined;
        if (cursor !== undefined && innerEnd !== undefined) {
            inner = new ChildPart(innerEnd);
            owner.run(() => {
                shown = Boolean(untracked(() => read(this.condition)));
                branch = createOwner();
                branch.run(() => {
                    inner.set(shown ? this.whenTrue() : this.whenFalse?.(), cursor.nextSibling ?? innerEnd);
                });
            });
            if (innerEnd.nextSibling !== part.anchor) {
                mismatch("extra", "", innerEnd.nextSibling?.nodeName ?? "");
                removeUntil(innerEnd.nextSibling, part.anchor);
            }
        }
        else {
            if (cursor !== undefined) {
                mismatch("missing", "branch", cursor === part.anchor ? "" : cursor.nodeName);
                removeUntil(cursor, part.anchor);
            }
            inner = new ChildPart(anchorBefore(part.anchor));
        }
        owner.run(() => {
            effect(() => {
                const next = Boolean(read(this.condition));
                if (next === shown) {
                    return;
                }
                shown = next;
                owner.run(() => {
                    branch?.dispose();
                    branch = createOwner();
                    branch.run(() => {
                        inner.set(next ? this.whenTrue() : this.whenFalse?.());
                    });
                });
            });
        });
        return {
            dispose() {
                owner.dispose();
                inner.destroy();
            }
        };
    }
    resolve() {
        return read(this.condition) ? this.whenTrue() : this.whenFalse?.();
    }
}
/** Renders `then()` while the condition is truthy and `otherwise()` while it is not. Branches are created lazily and disposed when hidden. */
export function when(condition, then, otherwise) {
    return new Conditional(condition, then, otherwise);
}
