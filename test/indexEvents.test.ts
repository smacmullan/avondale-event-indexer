import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchEvents, indexEvents } from '../src/indexEvents.ts';

function toIcalDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

test('fetchEvents returns an empty list for an unsupported provider type', async t => {
    t.mock.method(console, 'log', () => {});

    assert.deepEqual(
        await fetchEvents({ name: 'Unknown Org', eventApiType: 'unsupported', api: '' }),
        [],
    );
});

test('indexEvents returns no events and makes no fetch requests for unsupported providers', async t => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(process.stdout, 'write', () => true);
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('fetch should not be called for an unsupported provider');
    });

    const events = await indexEvents([
        { name: 'Unknown Org', eventApiType: 'unsupported', api: '' },
    ]);

    assert.deepEqual(events, []);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('indexEvents fetches and combines WebCal events from multiple organizations', async t => {
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fetchMock = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        const apiUrl = String(input);
        const eventName = apiUrl.includes('first') ? 'First Event' : 'Second Event';
        return new Response(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${eventName.replaceAll(' ', '-')}
DTSTART:${toIcalDate(start)}
DTEND:${toIcalDate(end)}
SUMMARY:${eventName}
END:VEVENT
END:VCALENDAR`);
    });
    t.mock.method(console, 'log', () => {});
    t.mock.method(process.stdout, 'write', () => true);

    const events = await indexEvents([
        { name: 'First Org', eventApiType: 'webCal', api: 'https://example.test/first.ics' },
        { name: 'Second Org', eventApiType: 'webCal', api: 'https://example.test/second.ics' },
    ]);

    assert.deepEqual(events.map(event => event.name).sort(), ['First Event', 'Second Event']);
    assert.equal(fetchMock.mock.callCount(), 2);
});
