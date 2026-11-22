import { z } from 'zod';
import { readFile } from 'fs/promises';
import type { Event, EventIntegration } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../time.ts';
import { standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Path to a JSON file copied from the Chicago.com site (resolved from the working directory) */
    file: z.string().min(1),
}).strict();

export type ChicagoDotComOptions = z.infer<typeof optionsSchema>;

export const chicagoDotComIntegration = {
    type: 'chicagoDotCom',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ org, options, endSearchDate }) {
        // Chicago.com does not have a public events API yet, so response data is copied to a file.
        // A missing or malformed file throws (whole integration fails).
        const fileContents = await readFile(options.file, 'utf8');
        const data = JSON.parse(fileContents);
        if (!Array.isArray(data?.events))
            throw new Error(`"${options.file}" has no "events" array`);

        const events = standardizeAll(data.events, standardizeChicagoDotComEvent, org.name);

        // A file has no date filter, so filter here.
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<ChicagoDotComOptions>;


function standardizeChicagoDotComEvent(event: any): Event {
    return {
        name: event.record.name,
        startDate: event.record.startsAt,
        endDate: event.record.endsAt,
        organizer: {
            name: event.record.locations?.[0]?.name?.split(',')[0].trim() || 'Chicago.com'
        },
        url: event.record.uris?.[0]?.uri || getChicagoDotComEventUrl(event.uri)
    };
}

function getChicagoDotComEventUrl(atProtocolUri: string) {
    // Note: hardcoded for avondale.chicago.com url
    if (!atProtocolUri) {
        return undefined;
    }

    const parts = atProtocolUri.split('/');
    const did = parts[2]?.replace('did:plc:', '');
    const eventId = parts[4];

    if (!did || !eventId)
        return undefined;
    else
        return `https://avondale.chicago.com/event/2Lws/did:plc:${did}-${eventId}`;
}