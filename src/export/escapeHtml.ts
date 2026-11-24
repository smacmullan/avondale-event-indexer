/** Escapes text for use in HTML content or a quoted attribute. Event data comes from third-party sites. */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** The URL if it is an absolute http(s) URL (so no javascript: or data: links), otherwise undefined. */
export function httpUrlOrUndefined(value: string | undefined): string | undefined {
    if (!value)
        return undefined;
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:' ? value : undefined;
    } catch {
        return undefined;
    }
}
