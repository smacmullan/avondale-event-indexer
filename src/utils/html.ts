export function decodeHtmlEntities(text: string) {
    if (!text)
        return null;
    else if (text.includes("&") && text.includes(";")) {
        // use regex to replace HTML entities
        return text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&(#x[0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }
    else
        return text;
};