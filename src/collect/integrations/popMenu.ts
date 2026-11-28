import { z } from 'zod';
import type { EventRecord, EventSource } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    url: z.url().transform(value => value.replace(/\/+$/, ''))
        .describe('Restaurant website base URL; trailing slashes are removed'),
    sectionId: z.number().int().positive()
        .describe("ID of the calendar section on the restaurant's events page, found in its GraphQL traffic"),
}).strict();

export type PopMenuOptions = z.infer<typeof optionsSchema>;

// Persisted GraphQL query id used by the PopMenu client
const OPERATION_ID = "PopmenuClient/84a8c72179c517e7d584420f7a69a194";

export const popMenuIntegration = defineIntegration({
    type: 'popMenu',

    docs: {
        title: 'Popmenu',
        summary: 'Non-recurring events from a restaurant using Popmenu.',
        details:
            'Provide the restaurant website base URL and its calendar section ID. Find the section ID by inspecting ' +
            'the site GraphQL requests in browser developer tools. Recurring calendar entries are currently excluded.',
        example: { url: 'https://example-restaurant.com', sectionId: 1 },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        // The query filters by date range, so no post-filtering is needed.
        const today = new Date(new Date().setHours(0, 0, 0, 0)); // today at 00:00

        const data = await fetchJson(`${options.url}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": options.url,
            },
            body: JSON.stringify({
                operationName: "customPageCalendarSection",
                variables: {
                    rangeStartAt: today,
                    rangeEndAt: endSearchDate,
                    sectionId: options.sectionId,
                },
                extensions: {
                    operationId: OPERATION_ID,
                },
            }),
        });

        if (data?.errors?.length)
            throw new Error(`PopMenu GraphQL error: ${data.errors[0]?.message ?? 'unknown error'}`);

        const eventData = data?.data?.customPageSection?.upcomingCalendarEvents;
        if (!Array.isArray(eventData))
            throw new Error(`No calendar events found for section ${options.sectionId}`);

        // TODO populate recurring events and combine with non-recurring
        const singleInstanceEventData = eventData.filter((event: any) => event?.isRecurring == false);

        return standardizeAll(
            singleInstanceEventData,
            (event: any) => standardizePopMenuEvent(event, source, options),
            source.name,
        );
    },
});

function standardizePopMenuEvent(event: any, source: EventSource, options: PopMenuOptions): EventRecord {
    return {
        name: event.name,
        startDate: getISODateString(event.startAt, event.startTime),
        endDate: getISODateString(event.endAt || event.startAt, event.endTime),
        organizer: {
            name: source.displayName || source.name,
        },
        url: `${options.url}/events/${event.slug}`,
    };
}

function getISODateString(startAtText: string, startTimeUtcSeconds: number): string {
    const date = new Date(`${startAtText}T00:00:00`);
    date.setSeconds(date.getSeconds() + startTimeUtcSeconds);
    return date.toISOString();
}