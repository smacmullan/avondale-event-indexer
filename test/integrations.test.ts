import assert from 'node:assert/strict';
import test from 'node:test';
import { google } from 'googleapis';
import { fetchGoogleCalendarEvents } from '../src/utils/eventApis/googleCalendar.ts';
import { standardizeJsonLdEvent } from '../src/utils/eventApis/jsonLd.ts';
import { fetchWebCalEvents } from '../src/utils/eventApis/webcal.ts';

function upcomingDate(daysAhead: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date;
}

function isCalendarListRequest(value: unknown): value is {
    calendarId: string;
    timeMax: string;
    maxResults: number;
    singleEvents: boolean;
    orderBy: string;
} {
    return typeof value === 'object' && value !== null
        && 'calendarId' in value
        && typeof value.calendarId === 'string'
        && 'timeMax' in value
        && typeof value.timeMax === 'string'
        && 'maxResults' in value
        && typeof value.maxResults === 'number'
        && 'singleEvents' in value
        && typeof value.singleEvents === 'boolean'
        && 'orderBy' in value
        && typeof value.orderBy === 'string';
}

test('JSON-LD normalization decodes text and falls back to the organization name', () => {
    assert.deepEqual(
        standardizeJsonLdEvent(
            {
                name: 'Arts &amp; Crafts',
                startDate: '2026-06-01T10:00:00Z',
                location: { name: 'Studio &amp; Gallery' },
                url: 'https://example.test/event',
            },
            { name: 'Fallback Org', eventApiType: 'jsonLd', api: 'https://example.test/events' },
        ),
        {
            name: 'Arts & Crafts',
            startDate: '2026-06-01T10:00:00Z',
            endDate: undefined,
            organizer: { name: 'Studio & Gallery' },
            url: 'https://example.test/event',
        },
    );
});

test('JSON-LD integration', async t => {
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
        requestedUrls.push(String(input));
        if (String(input) === 'https://example.test/events') {
            return new Response(
                '<a href="/events/concert?source=calendar">Concert</a><a href="/events/concert">Duplicate link</a>',
            );
        }
        return new Response(eventHtml);
    });

    const { fetchJsonLdEvents } = await import('../src/utils/eventApis/jsonLd.ts');
    const events = await fetchJsonLdEvents(
        { name: 'Local Org', eventApiType: 'jsonLd', api: 'https://example.test/events' },
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    await t.test('returns event data and excludes non-event metadata', () => {
        assert.equal(events.length, 1);
        assert.equal(events[0].name, 'Neighborhood Concert');
        assert.equal(events[0].organizer?.name, 'Local Stage');
    });

    await t.test('fetches the hub and one normalized URL for duplicate links', () => {
        assert.deepEqual(requestedUrls.sort(), [
            'https://example.test/events',
            'https://example.test/events/concert',
        ]);
    });
});

test('Google Calendar integration', async t => {
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
    t.after(() => {
        if (originalCalendarDescriptor) {
            Object.defineProperty(google, 'calendar', originalCalendarDescriptor);
        } else {
            Reflect.deleteProperty(google, 'calendar');
        }
    });
    const endSearchDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const events = await fetchGoogleCalendarEvents(
        {
            name: 'Calendar Org',
            eventApiType: 'googleCalendar',
            api: 'calendar@example.test',
            googleCalendarUseLocation: true,
            eventPageUrl: 'https://example.test/calendar',
        },
        endSearchDate,
    );

    await t.test('queries the configured calendar within the requested range', () => {
        assert.equal(calendarFactoryCallCount, 1);
        assert.equal(listMock.mock.callCount(), 1);
        assert.ok(isCalendarListRequest(listRequest));
        const request = listRequest;
        assert.equal(request.calendarId, 'calendar@example.test');
        assert.equal(request.timeMax, endSearchDate.toISOString());
        assert.equal(request.maxResults, 20);
        assert.equal(request.singleEvents, true);
        assert.equal(request.orderBy, 'startTime');
    });

    await t.test('maps timed events and appends their location to the organizer', () => {
        assert.equal(events.length, 2);
        assert.deepEqual(events[0], {
            name: 'Evening Workshop',
            startDate: timedStart,
            endDate: timedEnd,
            organizer: { name: 'Calendar Org @ 123 Main St' },
            url: 'https://example.test/calendar',
        });
    });

    await t.test('maps all-day date fields and uses the organization name without a location', () => {
        assert.deepEqual(events[1], {
            name: 'All-day Market',
            startDate: '2026-06-01',
            endDate: '2026-06-02',
            organizer: { name: 'Calendar Org' },
            url: 'https://example.test/calendar',
        });
    });
});

test('WebCal integration', async t => {
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

    const events = await fetchWebCalEvents(
        {
            name: 'Calendar Org',
            eventApiType: 'webCal',
            api: 'https://example.test/events.ics',
            eventPageUrl: 'https://example.test/calendar',
        },
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    const eventWithoutOrganizerName = events.find(event => event.name === 'Arts & Music');
    const eventWithOrganizerValue = events.find(event => event.name === 'Named Organizer Event');

    await t.test('decodes the summary and falls back when the organizer has no value object', () => {
        assert.equal(events.length, 2);
        assert.equal(eventWithoutOrganizerName?.name, 'Arts & Music');
        assert.equal(eventWithoutOrganizerName?.organizer?.name, 'Calendar Org');
    });

    await t.test('uses a structured organizer value when present', () => {
        assert.equal(eventWithOrganizerValue?.organizer?.name, 'mailto:host@example.test');
    });

    await t.test('attaches the configured event page URL', () => {
        assert.equal(eventWithoutOrganizerName?.url, 'https://example.test/calendar');
    });
});
