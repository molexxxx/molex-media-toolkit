/**
 * The message text for every diagnostic code. The documentation pages for
 * the codes are generated from this table, so an entry here is the single
 * source of truth for both the message and the docs. Production builds
 * ship an empty catalog, so look entries up with `?.`.
 */
export const diagnosticCatalog = {
    signal_written_inside_computed: {
        cause: "A signal was written while a computed value was being evaluated.",
        fix: "Move the write into an effect or an event handler; computed functions must be pure."
    },
    computed_cycle: {
        cause: "A computed value read itself, directly or through other computed values.",
        fix: "Break the cycle, for example by reading the previous value inside untracked()."
    },
    effect_cycle: {
        cause: "An effect was triggered synchronously while it was already running.",
        fix: "Do not write to a signal the effect reads from inside its own cleanup function."
    },
    effect_loop: {
        cause: "Effects kept re-triggering each other for more than 100 rounds in one batch.",
        fix: "Find the effect that writes a signal it also reads and make the write conditional."
    },
    on_dispose_outside_scope: {
        cause: "onDispose() was called with no enclosing effect or scope to attach to.",
        fix: "Call onDispose() inside an effect, a scope(), or a component."
    },
    binding_in_tag_position: {
        cause: "An expression appears where a tag or attribute name is expected.",
        fix: "Bind values only as element content or inside an attribute value; tag and attribute names must be static."
    },
    binding_in_comment: {
        cause: "An expression appears inside an HTML comment.",
        fix: "Remove the expression from the comment; comments are static."
    },
    binding_in_raw_text: {
        cause: "An expression appears inside an element whose content is raw text.",
        fix: "Set the content of style, textarea, and title elements through a .textContent or .value property binding instead."
    },
    binding_not_single: {
        cause: "A boolean attribute, property, or event binding has more than one expression or extra text.",
        fix: "Bind exactly one expression with nothing around it, for example ?disabled=${flag}."
    },
    script_in_template: {
        cause: "A template contains a script element.",
        fix: "Keep scripts in modules; templates describe markup only."
    },
    template_unclosed_tag: {
        cause: "A template ends inside a tag, attribute, or comment.",
        fix: "Close the tag or comment inside the same template literal."
    },
    unsafe_property_binding: {
        cause: "A property binding targets a property that parses its value as HTML.",
        fix: "Bind child content with ${} instead; for trusted markup use the raw HTML API explicitly."
    },
    unsafe_attribute_binding: {
        cause: "An attribute binding targets an attribute that runs script or parses HTML.",
        fix: "Use an @event binding for handlers and child content for markup."
    },
    unsafe_url_blocked: {
        cause: "A URL attribute received a value with a scheme that can run script, and the attribute was removed.",
        fix: "Pass http, https, mailto, tel, or a relative URL; data URLs are allowed only for images."
    },
    unrenderable_value: {
        cause: "A value of a type the renderer cannot display was bound as content.",
        fix: "Bind a string, number, signal, template, node, or iterable; call component functions rather than passing them."
    },
    event_handler_not_function: {
        cause: "An @event binding received something other than a function or an object with handleEvent.",
        fix: "Pass a function, for example @click=${() => count.set(count.get() + 1)}."
    },
    each_key_undefined: {
        cause: "The key function passed to each() returned undefined for an item.",
        fix: "Return a stable string or number per item, such as its id."
    },
    each_key_duplicate: {
        cause: "Two items in an each() list produced the same key.",
        fix: "Return a key that is unique within the list; duplicates make rows indistinguishable."
    },
    css_value_not_allowed: {
        cause: "A css literal received a value that is not a number or another css result.",
        fix: "Interpolate only numbers and css results; put dynamic values in custom properties set through a style binding."
    },
    ref_not_assignable: {
        cause: "A ref binding received something other than a writable signal or a function.",
        fix: "Pass a signal created with signal<Element | undefined>(undefined) or a callback that receives the element."
    },
    hydration_mismatch: {
        cause: "The server-rendered markup did not match the view, and the differing part was rendered again on the client.",
        fix: "Render the same view with the same data on the server and the client; check the mismatches returned by hydrate()."
    },
    lazy_module_not_split: {
        cause: "A module meant to load as a chunk of its own, a view declared with lazy() from @zerolith/router or a locale of a message index compiled by zerolith-i18n, is also imported statically, so the bundler put it in the importing chunk.",
        fix: "Remove the static import, or import only its types with import type. Declare the view without lazy() if it should load with the page."
    },
    template_not_prepared: {
        cause: "A template reached the runtime that the build's prepare pass never saw, in a bundle built without the scanner.",
        fix: "Build every module that uses html through @zerolith/vite, or pass prepare: false to the plugin to keep the scanner in the bundle."
    },
    mount_target_missing: {
        cause: "render or hydrate received a selector that matches no element in the document.",
        fix: "Check the selector, and mount once the element exists: a module script runs after the document is parsed, so an element earlier in the page is already there."
    },
    jsx_not_lowered: {
        cause: "A JSX expression reached the runtime, which means the lowering in @zerolith/vite did not run for this file.",
        fix: "Add zerolith() to the Vite plugins and keep JSX in .jsx or .tsx files; without a build step write html templates instead."
    },
    template_frozen_read: {
        cause: "A .get() read is bound in a template, so the value was read once when the template was created and never updates; the Vite plugin reports it in development, since the runtime cannot tell a frozen read from a deliberate one.",
        fix: "Bind the signal itself, or computed(() => ...) for a derived value; call .get() only inside computed, effect, resource.params, and event handlers."
    },
    image_without_alt: {
        cause: "An <img> in a template has no alt attribute, so assistive technology has nothing to read for it.",
        fix: "Add alt text that says what the image conveys, or alt=\"\" when it is decorative."
    },
    button_without_name: {
        cause: "A <button> has no content and no aria-label, so it has no accessible name.",
        fix: "Put text inside the button, or add aria-label; an icon alone needs the label."
    },
    frame_without_title: {
        cause: "An <iframe> has no title attribute, so what it embeds is not announced.",
        fix: "Add a title that names the embedded content."
    }
};
//# sourceMappingURL=catalog.js.map