/**
 * The live announcer and the visually hidden style it uses: text for
 * assistive technology that takes no space on screen.
 */
import { css } from "zerolith";
/** The clip pattern that hides an element visually while assistive technology still reads it. */
export const visuallyHidden = css `
    :scope { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
`;
/**
 * Creates a pair of live regions, one polite and one assertive, appended to
 * the document body and hidden visually. Each announcement clears the
 * region and writes the message on the next task, so repeating a message
 * is read again.
 */
export function createAnnouncer(doc = document) {
    const regions = new Map();
    const region = (politeness) => {
        let element = regions.get(politeness);
        if (element === undefined) {
            element = doc.createElement("div");
            element.setAttribute("aria-live", politeness);
            element.setAttribute("aria-atomic", "true");
            element.setAttribute("role", politeness === "assertive" ? "alert" : "status");
            element.className = `zl-s ${visuallyHidden.scope}`;
            doc.body.append(element);
            regions.set(politeness, element);
        }
        return element;
    };
    let timer;
    return {
        announce(message, politeness = "polite") {
            const element = region(politeness);
            element.textContent = "";
            clearTimeout(timer);
            timer = setTimeout(() => {
                element.textContent = message;
            }, 0);
        },
        dispose() {
            clearTimeout(timer);
            for (const element of regions.values()) {
                element.remove();
            }
            regions.clear();
        }
    };
}
//# sourceMappingURL=announce.js.map