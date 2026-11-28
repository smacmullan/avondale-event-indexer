import { z } from 'zod';
import type { EventRecord, EventSource } from '../../definitions.ts';
import { isEventUpcomingAndBeforeDate } from '../../utils/time.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    webstoreName: z.string().min(1)
        .describe('BookManager "webstore_name" for the store. The numeric store id is looked up from this'),
}).strict();

export type BookManagerOptions = z.infer<typeof optionsSchema>;

const API_BASE = 'https://api.bookmanager.com/customer';

export const bookManagerIntegration = defineIntegration({
    type: 'bookManager',

    docs: {
        title: 'BookManager',
        summary: "Events from bookstores that use BookManager's webstore.",
        details:
            'BookManager is a tool used by some bookstores. To find the webstoreName, open the bookstore\'s events ' +
            'page, open the browser developer console (Network tab), and look at the POST requests the page makes. ' +
            'The "getSettings" request has webstore_name in its payload.',
        example: { webstoreName: '9999999' },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        const { storeId, baseUrl } = await getStoreInfo(options.webstoreName);
        const rows = await getBookManagerEventsFromApi(storeId);

        const events = standardizeAll(rows, row => standardizeBookManagerEvent(row, source, baseUrl), source.name);

        // The API can't filter by date, so filter here.
        return events.filter(event => isEventUpcomingAndBeforeDate(event, endSearchDate));
    },
});

async function postForm(path: string, fields: Record<string, string>): Promise<any> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields))
        formData.append(key, value);

    return fetchJson(`${API_BASE}/${path}`, {
        method: 'POST',
        body: formData,
        redirect: 'follow',
    });
}

async function getStoreInfo(webstoreName: string): Promise<{ storeId: string; baseUrl?: string }> {
    const data = await postForm('store/getSettings', { webstore_name: webstoreName });
    if (!data?.store_info?.id)
        throw new Error(`No BookManager store found for webstore "${webstoreName}"`);
    return { storeId: String(data.store_info.id), baseUrl: data.store_info.base_url };
}

async function getSessionId(storeId: string): Promise<string> {
    const data = await postForm('session/get', { store_id: storeId });
    if (!data?.session_id)
        throw new Error(`BookManager returned no session id for store ${storeId}`);
    return data.session_id;
}

async function getBookManagerEventsFromApi(storeId: string): Promise<any[]> {
    const sessionId = await getSessionId(storeId);
    const data = await postForm('event/v2/list', { store_id: storeId, session_id: sessionId });
    if (!Array.isArray(data?.rows))
        throw new Error('Unexpected BookManager event list response (no "rows" array)');
    return data.rows;
}

function standardizeBookManagerEvent(event: any, source: EventSource, baseUrl?: string): EventRecord {
    return {
        name: event.title,
        startDate: convertBookManagerDateToIsoString(event.date, event.start_time),
        endDate: event.end_time ? convertBookManagerDateToIsoString(event.date, event.end_time) : undefined,
        organizer: {
            name: source.displayName || source.name,
        },
        url: baseUrl ? `${baseUrl}/events/${event.id}` : undefined,
    };
}

/** date is "YYYYMMDD", time is "HH:mm:ss" in local time. Throws on invalid input. */
function convertBookManagerDateToIsoString(date: string, time: string): string {
    const localDateTime = new Date(
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time}`
    );
    return localDateTime.toISOString();
}