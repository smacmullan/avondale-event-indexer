import assert from 'node:assert/strict';
import test from 'node:test';
import { google } from 'googleapis';
import type { EventSource } from '../src/definitions.ts';
import { googleCalendarIntegration } from '../src/collect/integrations/googleCalendar.ts';
import { jsonLdIntegration, standardizeJsonLdEvent } from '../src/collect/integrations/jsonLd.ts';
import { webCalIntegration } from '../src/collect/integrations/webcal.ts';

function upcomingDate(daysAhead: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date;
}

test('JSON-LD normalization decodes text and falls back to the source name', () => {
    assert.deepEqual(
        standardizeJsonLdEvent(
            {
                name: 'Arts &amp; Crafts',
                startDate: '2026-06-01T10:00:00Z',
                location: { name: 'Studio &amp; Gallery' },
                url: 'https://example.test/event',
            },
            { name: 'Fallback Source', integrationType: 'jsonLd' },
        ),
        {
            name: 'Arts & Crafts',
            startDate: '2026-06-01T10:00:00Z',
            endDate: undefined,
            organizer: { name: 'Studio & Gallery' },
            url: 'https://example.test/event',
        },
    );
    assert.equal(
        standardizeJsonLdEvent(
            { name: 'No Location', startDate: '2026-06-01' },
            { name: 'Fallback Source', integrationType: 'jsonLd' },
        ).organizer?.name,
        'Fallback Source',
    );
});

test('JSON-LD integration deduplicates hub links and excludes non-event metadata', async t => {
    const eventDate = upcomingDate(2);
    const startDate = new Date(eventDate);
    startDate.setHours(18, 0, 0, 0);
    const eventHtml = `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Event',
        name: 'Neighborhood Concert',
        startDate: startDate.toISOString(),
        location: { name: 'Local Stage' },
        url: 'https://example.test/events/concert',
    })}</script>
    <script type="application/ld+json">${JSON.stringify({
        '@type': 'Organization',
        name: 'Not an event',
    })}</script>`;

    const requestedUrls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url === 'https://example.test/events')
            return new Response('<a href="/events/concert?source=calendar">Concert</a><a href="/events/concert">Duplicate link</a>');
        return new Response(eventHtml);
    });

    const source: EventSource = {
        name: 'Local Source',
        integrationType: 'jsonLd',
        options: { url: 'https://example.test/events' },
    };
    const events = await jsonLdIntegration.fetchEvents({
        source,
        options: jsonLdIntegration.parseOptions(source.options),
        endSearchDate: upcomingDate(7),
        signal: new AbortController().signal,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'Neighborhood Concert');
    assert.equal(events[0].organizer?.name, 'Local Stage');
    assert.deepEqual(requestedUrls.sort(), [
        'https://example.test/events',
        'https://example.test/events/concert',
    ]);
});

test('Google Calendar integration maps timed and all-day events using current options', async t => {
    const timedStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const timedEnd = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
    const calendarClient = google.calendar({ version: 'v3' });
    let listRequest: unknown;
    const listMock = t.mock.method(calendarClient.events, 'list', async function () {
        listRequest = arguments[0];
        return {
            data: {
                items: [
                    {
                        summary: 'Evening Workshop',
                        start: { dateTime: timedStart },
                        end: { dateTime: timedEnd },
                        location: '123 Main St, Chicago, IL',
                    },
                    {
                        summary: 'All-day Market',
                        start: { date: '2026-06-01' },
                        end: { date: '2026-06-02' },
                    },
                ],
            },
        };
    });
    const originalCalendarDescriptor = Object.getOwnPropertyDescriptor(google, 'calendar');
    let calendarFactoryCallCount = 0;
    Object.defineProperty(google, 'calendar', {
        configurable: true,
        value: () => {
            calendarFactoryCallCount++;
            return calendarClient;
        },
    });
    const originalApiKey = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = 'test-api-key';
    t.after(() => {
        if (originalCalendarDescriptor)
            Object.defineProperty(google, 'calendar', originalCalendarDescriptor);
        else
            Reflect.deleteProperty(google, 'calendar');

        if (originalApiKey === undefined)
            delete process.env.GOOGLE_API_KEY;
        else
            process.env.GOOGLE_API_KEY = originalApiKey;
    });
    const endSearchDate = upcomingDate(7);
    const source: EventSource = {
        name: 'Calendar Source',
        integrationType: 'googleCalendar',
        options: {
            calendarId: 'calendar@example.test',
            useLocation: true,
            eventPageUrl: 'https://example.test/calendar',
        },
    };

    const events = await googleCalendarIntegration.fetchEvents({
        source,
        options: googleCalendarIntegration.parseOptions(source.options),
        endSearchDate,
        signal: new AbortController().signal,
    });

    assert.equal(calendarFactoryCallCount, 1);
    assert.equal(listMock.mock.callCount(), 1);
    assert.equal(typeof listRequest, 'object');
    assert.equal((listRequest as { calendarId: string }).calendarId, 'calendar@example.test');
    assert.equal((listRequest as { timeMax: string }).timeMax, endSearchDate.toISOString());
    assert.equal((listRequest as { maxResults: number }).maxResults, 20);
    assert.equal((listRequest as { singleEvents: boolean }).singleEvents, true);
    assert.equal((listRequest as { orderBy: string }).orderBy, 'startTime');
    assert.equal(events.length, 2);
    assert.deepEqual(events[0], {
        name: 'Evening Workshop',
        startDate: timedStart,
        endDate: timedEnd,
        organizer: { name: 'Calendar Source @ 123 Main St' },
        url: 'https://example.test/calendar',
    });
    assert.deepEqual(events[1], {
        name: 'All-day Market',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        organizer: { name: 'Calendar Source' },
        url: 'https://example.test/calendar',
    });
});

test('WebCal integration decodes summaries, uses configured URLs, and falls back to the source name', async t => {
    const start = upcomingDate(2);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(20, 0, 0, 0);
    const toIcalDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:community-event
DTSTART:${toIcalDate(start)}
DTEND:${toIcalDate(end)}
SUMMARY:Arts &amp; Music
ORGANIZER:mailto:organizer@example.test
END:VEVENT
BEGIN:VEVENT
UID:named-organizer-event
DTSTART:${toIcalDate(start)}
DTEND:${toIcalDate(end)}
SUMMARY:Named Organizer Event
ORGANIZER;CN=LocalHost:mailto:host@example.test
END:VEVENT
END:VCALENDAR`;

    t.mock.method(globalThis, 'fetch', async () => new Response(calendar));
    const source: EventSource = {
        name: 'Calendar Source',
        integrationType: 'webCal',
        options: {
            url: 'https://example.test/events.ics',
            eventPageUrl: 'https://example.test/calendar',
        },
    };
    const events = await webCalIntegration.fetchEvents({
        source,
        options: webCalIntegration.parseOptions(source.options),
        endSearchDate: upcomingDate(7),
        signal: new AbortController().signal,
    });
    const eventWithoutOrganizerName = events.find(event => event.name === 'Arts & Music');
    const eventWithOrganizerValue = events.find(event => event.name === 'Named Organizer Event');

    assert.equal(events.length, 2);
    assert.equal(eventWithoutOrganizerName?.organizer?.name, 'Calendar Source');
    assert.equal(eventWithOrganizerValue?.organizer?.name, 'mailto:host@example.test');
    assert.equal(eventWithoutOrganizerName?.url, 'https://example.test/calendar');
});
