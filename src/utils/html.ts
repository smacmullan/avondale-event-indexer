const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
};

/**
 * Decodes numeric (&#39; &#x27;) and the basic named (&amp; &quot; &apos; &lt; &gt;) HTML entities.
 */
export function decodeHtmlEntities(text: string): string {
    if (!text || !text.includes("&") || !text.includes(";"))
        return text;

    return text.replace(
        /&(?:#(\d+)|#[xX]([0-9A-Fa-f]+)|(amp|quot|apos|lt|gt));/g,
        (match, decimal?: string, hex?: string, named?: string) => {
            if (named)
                return NAMED_ENTITIES[named];

            const codePoint = decimal !== undefined ? parseInt(decimal, 10) : parseInt(hex!, 16);
            return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
    );
}

/** Check that value is a real, printable-range Unicode scalar value */
function isValidCodePoint(codePoint: number): boolean {
    return Number.isInteger(codePoint)
        && codePoint > 0
        && codePoint <= 0x10FFFF
        && !(codePoint >= 0xD800 && codePoint <= 0xDFFF);
}