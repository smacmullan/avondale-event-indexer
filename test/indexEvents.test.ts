import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
    buildCollectionReport,
    collectEvents,
    collectEventsBySource,
    collectEventsFromSource,
    formatCollectionSummary,
} from '../src/collect/collectEvents.ts';
import { IntegrationRegistry } from '../src/collect/integrationRegistry.ts';
import { reportWarning } from '../src/collect/runContext.ts';
import type { EventRecord, EventSource } from '../src/definitions.ts';

function toIcalDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

test('collectEventsFromSource reports unsupported integrations without fetching', async t => {
    t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('fetch should not be called for an unsupported integration');
    });

    const result = await collectEventsFromSource({
        name: 'Unknown Source',
        integrationType: 'unsupported',
    });

    assert.equal(result.status, 'failed');
    assert.deepEqual(result.events, []);
    assert.match(result.error!, /No integration registered for "unsupported"/);
});

test('collectEvents fetches and combines WebCal events from multiple sources', async t => {
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

    const sources: EventSource[] = [
        { name: 'First Source', integrationType: 'webCal', options: { url: 'https://example.test/first.ics' } },
        { name: 'Second Source', integrationType: 'webCal', options: { url: 'https://example.test/second.ics' } },
    ];
    const events = await collectEvents(sources);

    assert.deepEqual(events.map(event => event.name).sort(), ['First Event', 'Second Event']);
    assert.deepEqual(events.map(event => event.source).sort((a, b) => a!.name.localeCompare(b!.name)), [
        { name: 'First Source', dedupeRank: 0 },
        { name: 'Second Source', dedupeRank: 0 },
    ]);
    assert.equal(fetchMock.mock.callCount(), 2);
});

test('collection isolates source failures and includes warnings in reports and summaries', async t => {
    const logs: string[] = [];
    t.mock.method(console, 'log', (message: string) => { logs.push(message); });
    t.mock.method(process.stdout, 'write', () => true);

    const registry = new IntegrationRegistry();
    registry.register({
        type: 'testCollection',
        docs: { title: 'Test Collection', summary: 'Test collection integration' },
        optionsSchema: z.object({}),
        parseOptions: () => ({}),
        async fetchEvents({ source }): Promise<EventRecord[]> {
            if (source.name === 'Broken Source')
                throw new Error('upstream unavailable');

            reportWarning('Skipped 1 malformed event');
            return [{ name: 'Community Event', startDate: '2030-01-05T20:00:00.000Z' }];
        },
    });

    const sources: EventSource[] = [
        { name: 'Broken Source', integrationType: 'testCollection' },
        { name: 'Partial Source', integrationType: 'testCollection' },
    ];
    const results = await collectEventsBySource(sources, { registry });

    assert.deepEqual(results.map(result => [result.source.name, result.status, result.events.length]), [
        ['Broken Source', 'failed', 0],
        ['Partial Source', 'ok', 1],
    ]);
    assert.deepEqual(results[1].warnings, ['Skipped 1 malformed event']);

    const report = buildCollectionReport(results);
    assert.equal(report[0].error, 'upstream unavailable');
    assert.deepEqual(report[1].warnings, ['Skipped 1 malformed event']);

    const summary = formatCollectionSummary(results);
    assert.match(summary, /1 failed/);
    assert.match(summary, /Broken Source \[testCollection\]: upstream unavailable/);
    assert.match(summary, /Partial Source: Skipped 1 malformed event/);

    const events = await collectEvents(sources, { registry });
    assert.deepEqual(events.map(event => event.name), ['Community Event']);
    assert.ok(logs.some(message => message.includes('Warnings:')));
    assert.ok(logs.some(message => message.includes('Failed:')));
});
