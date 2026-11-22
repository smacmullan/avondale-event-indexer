import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { cleanEvents } from '../src/cleanEvents.ts';
import type { EventRecord } from '../src/definitions.ts';

function clean(events: EventRecord[], t: TestContext) {
    t.mock.method(console, 'log', () => {});
    return cleanEvents(events);
}

function localDateTime(year: number, month: number, day: number, hour: number) {
    return new Date(year, month - 1, day, hour).toISOString();
}

test('cleanEvents removes events with an empty name', t => {
    assert.deepEqual(clean([{ name: '', startDate: '2026-06-01' }], t), []);
});

test('cleanEvents removes events whose name contains closed', t => {
    assert.deepEqual(
        clean([{ name: 'Venue CLOSED today', startDate: '2026-06-01' }], t),
        [],
    );
});

test('cleanEvents removes sold-out events', t => {
    assert.deepEqual(
        clean([{ name: 'SOLD OUT - Film Night', startDate: '2026-06-01' }], t),
        [],
    );
});

test('cleanEvents removes events listed in the configured filter list', t => {
    const events = clean([
        { name: 'Volunteer', startDate: '2026-06-01', organizer: { name: 'EcoShip' } },
        { name: 'Community Dinner', startDate: '2026-06-02' },
    ], t);

    assert.deepEqual(events.map(event => event.name), ['Community Dinner']);
});

test('cleanEvents trims a venue suffix after an at sign', t => {
    const [event] = clean([{ name: 'Earlier Event @ Library', startDate: '2026-06-01' }], t);

    assert.equal(event.name, 'Earlier Event');
});

test('cleanEvents trims a lowercase at-word venue suffix', t => {
    const [event] = clean([{ name: 'Later Event at the Hall', startDate: '2026-06-01' }], t);

    assert.equal(event.name, 'Later Event');
});

test('cleanEvents trims an uppercase At-word venue suffix', t => {
    const [event] = clean([{ name: 'Studio Event At Venue', startDate: '2026-06-01' }], t);

    assert.equal(event.name, 'Studio Event');
});

test('cleanEvents trims an em-dash venue suffix', t => {
    const [event] = clean([{ name: 'Dash Event — Gallery', startDate: '2026-06-01' }], t);

    assert.equal(event.name, 'Dash Event');
});

test('cleanEvents clamps a multi-day event end to its start day', t => {
    const [event] = clean([{
        name: 'Multi-day Event',
        startDate: '2026-06-02T10:00:00.000Z',
        endDate: '2026-06-03T12:00:00.000Z',
    }], t);

    assert.equal(event.endDate, '2026-06-02T12:00:00.000Z');
});

test('cleanEvents removes an end date that clamps to the start time', t => {
    const [event] = clean([{
        name: 'All-day Event',
        startDate: '2026-06-02T10:00:00.000Z',
        endDate: '2026-06-03T10:00:00.000Z',
    }], t);

    assert.equal(event.endDate, undefined);
});

test('cleanEvents leaves short overnight event durations unchanged', t => {
    const endDate = localDateTime(2026, 6, 6, 2);
    const [event] = clean([{
        name: 'Short Overnight Event',
        startDate: localDateTime(2026, 6, 5, 22),
        endDate,
    }], t);

    assert.equal(event.endDate, endDate);
});

test('cleanEvents moves a clamped end to the next day when it precedes the start time', t => {
    const expectedEnd = localDateTime(2026, 6, 8, 1);
    const [event] = clean([{
        name: 'Overnight Closing Event',
        startDate: localDateTime(2026, 6, 7, 22),
        endDate: localDateTime(2026, 6, 9, 1),
    }], t);

    assert.equal(event.endDate, expectedEnd);
});

test('cleanEvents sorts events by start date', t => {
    const events = clean([
        { name: 'Later Event', startDate: '2026-06-03T10:00:00.000Z' },
        { name: 'Earlier Event', startDate: '2026-06-01T10:00:00.000Z' },
    ], t);

    assert.deepEqual(events.map(event => event.name), ['Earlier Event', 'Later Event']);
});
