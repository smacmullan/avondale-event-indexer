import type { EventRecord } from '../../../definitions.ts';
import { jsonLdIntegration } from '../jsonLd.ts';
import { withTransform } from '../../integrationHelpers.ts';

/**
 * Wrapper on the JSON LD integration for Hairpin Arts Center. Attempts to replace generic event titles with
 * information parsed from the event URL. Accepts the same options as the jsonLd integration.
 */
export const hairpinIntegration = withTransform(
    jsonLdIntegration,
    'hairpin',
    {
        title: 'Hairpin Arts Center',
        summary: 'JSON-LD events with generic Hairpin titles reconstructed from their event URLs.',
        details:
            'Some Hairpin Arts Center event pages use the generic title "Explore Our". This source-specific ' +
            'transform derives a readable event name from the event URL slug when possible.',
    },
    events => events.map(cleanupEventName),
);


const BAD_NAME_PREFIX = "Explore Our";
/**
 * Attempt to replace generic Hairpin name with event text in the event URL.
 * @param event 
 */
export function cleanupEventName(event: EventRecord): EventRecord {
    try {
        if (!shouldCleanupEvent(event)) {
            return event;
        }

        const slug = getSlugFromUrl(event.url!);

        if (!slug) {
            return event;
        }

        const cleanedParts = removeTrailingIdentifiers(slug.split("-"));

        if (cleanedParts.length === 0) {
            return event;
        }

        const cleanedName = toTitleCase(cleanedParts);

        if (!isValidEventName(cleanedName)) {
            return event;
        }

        return {
            ...event,
            name: cleanedName,
        };
    } catch {
        // Leave event untouched if unexpected issues occur
        return event;
    }
}

function shouldCleanupEvent(event: EventRecord): boolean {
    return Boolean(
        event?.name &&
        event?.url &&
        event.name.startsWith(BAD_NAME_PREFIX)
    );
}

function getSlugFromUrl(url: string): string | null {
    const pathname = new URL(url).pathname;

    return (
        pathname
            .split("/")
            .filter(Boolean)
            .pop() ?? null
    );
}

function removeTrailingIdentifiers(parts: string[]): string[] {
    const cleaned = [...parts];

    while (cleaned.length > 0) {
        const last = cleaned[cleaned.length - 1];

        if (isIdentifierToken(last)) {
            cleaned.pop();
            continue;
        }

        break;
    }

    return cleaned;
}

function isIdentifierToken(value: string): boolean {
    return isNumericToken(value) || isRandomLookingToken(value);
}

function isNumericToken(value: string): boolean {
    return /^\d+$/.test(value);
}

function isRandomLookingToken(value: string): boolean {
    const isShortAlphaNumeric = /^[a-z0-9]{4,10}$/i.test(value);
    const containsNumber = /\d/.test(value);
    const hasNoVowels = !/[aeiou]/i.test(value);

    return isShortAlphaNumeric && (containsNumber || hasNoVowels);
}

function toTitleCase(parts: string[]): string {
    return parts
        .map(capitalizeWord)
        .join(" ");
}

function capitalizeWord(word: string): string {
    if (word.toUpperCase() === word && word.length <= 5) {
        return word;
    }

    return word.charAt(0).toUpperCase() + word.slice(1);
}

function isValidEventName(name: string): boolean {
    return name.trim().length >= 3;
}