import { z } from 'zod';
import type { Event, EventIntegration, Organization } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';

const optionsSchema = z.object({
    /** Restaurant website base URL, e.g. https://www.chiefoneillspub.com (trailing slash is removed) */
    url: z.url().transform(value => value.replace(/\/+$/, '')),
    /** Id of the calendar section on the restaurant's events page (from the site's GraphQL traffic) */
    sectionId: z.number().int().positive(),
}).strict();

export type PopMenuOptions = z.infer<typeof optionsSchema>;

// Persisted GraphQL query id used by the PopMenu client
const OPERATION_ID = "PopmenuClient/84a8c72179c517e7d584420f7a69a194";

export const popMenuIntegration = {
    type: 'popMenu',

    parseOptions: raw => optionsSchema.parse(raw),

    async fetchEvents({ org, options, endSearchDate }) {
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
            (event: any) => standardizePopMenuEvent(event, org, options),
            org.name,
        );
    },
} satisfies EventIntegration<PopMenuOptions>;

function standardizePopMenuEvent(event: any, org: Organization, options: PopMenuOptions): Event {
    return {
        name: event.name,
        startDate: getISODateString(event.startAt, event.startTime),
        endDate: getISODateString(event.endAt || event.startAt, event.endTime),
        organizer: {
            name: org.name,
        },
        url: `${options.url}/events/${event.slug}`,
    };
}

function getISODateString(startAtText: string, startTimeUtcSeconds: number): string {
    const date = new Date(`${startAtText}T00:00:00`);
    date.setSeconds(date.getSeconds() + startTimeUtcSeconds);
    return date.toISOString();
}