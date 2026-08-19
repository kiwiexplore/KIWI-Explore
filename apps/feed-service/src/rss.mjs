/**
 * Just enough RSS/XML reading for the feeds this service pulls.
 *
 * Regex rather than a parser library because this runs with no
 * dependencies at all (see the service's own README) and the shapes
 * involved are four flat fields inside <item>. It is NOT a general XML
 * parser and shouldn't grow into one — the day a source needs real
 * parsing is the day this takes a dependency.
 */

const ENTITIES = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/** Undoes the entity escaping and CDATA wrapping feeds arrive in. */
export function decode(text) {
    return (text ?? "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/&(\w+);/g, (whole, name) => ENTITIES[name] ?? whole)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** The text of the first <tag> inside a chunk of XML. */
export function tag(xml, name) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
    return match ? decode(match[1]) : "";
}

/** One attribute of the first <tag …>, without decoding its text. */
export function attr(xml, name, attribute) {
    const match = xml.match(new RegExp(`<${name}[^>]*\\s${attribute}="([^"]*)"`, "i"));
    return match ? decode(match[1]) : null;
}

/** Every <item> (or <url>, for a sitemap) in a document. */
export function blocks(xml, name = "item") {
    return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi"))]
        .map((match) => match[1]);
}
