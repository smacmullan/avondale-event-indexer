import { z } from 'zod';
import type { EventRecord, EventIntegration, EventSource } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** ElfSight widget data URL. Must include the widget id as the `w` query parameter. */
    url: z.url(),
    /** Link to the organization's public events page, used as each event's url */
    eventPageUrl: z.url().optional(),
}).strict().refine(
    options => new URL(options.url).searchParams.has('w'),
    { message: 'url must include a "w" (widget id) query parameter', path: ['url'] },
);

export type ElfSightOptions = z.infer<typeof optionsSchema>;

export const elfSightIntegration = {
    type: 'elfSight',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ source, options, endSearchDate }) {
        const data = await fetchJson(options.url);
        const elfSightEvents = extractEventArray(data, options.url);

        const events = standardizeAll(
            elfSightEvents,
            (event: any) => standardizeElfSightEvent(event, source, options),
            source.name,
        );

        // The widget data can't filter by date, so filter here.
        return events.filter((event: EventRecord) => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
} satisfies EventIntegration<ElfSightOptions>;

function extractEventArray(json: any, url: string): any[] {
    const widgetKey = new URL(url).searchParams.get('w') || '';
    const widget = json?.data?.widgets?.[widgetKey];
    if (!widget)
        throw new Error(`Widget "${widgetKey}" not found in ElfSight response`);
    return widget.data?.settings?.events || [];
}

function standardizeElfSightEvent(event: any, source: EventSource, options: ElfSightOptions): EventRecord {
    const startDate = new Date(`${event.start.date}T${event.start.time}:00`).toISOString();

    return {
        name: event.name,
        startDate,
        organizer: {
            name: source.name,
        },
        url: options.eventPageUrl || undefined,
    };
}