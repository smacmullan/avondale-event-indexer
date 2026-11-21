import assert from 'node:assert/strict';
import test from 'node:test';
import {
    eventSort,
    formatDay,
    formatTimeRange,
    getDateFromISODate,
    getEndOfWeek,
    isEventInTimeRange,
    isEventUpcomingAndBeforeDate,
    isISODate,
} from '../src/utils/time.ts';

function localDateTime(year: number, month: number, day: number, hour: number, minute = 0) {
    return new Date(year, month - 1, day, hour, minute).toISOString();
}

test('time helpers identify all-day dates and format event times', () => {
    assert.equal(isISODate('2026-06-01'), true);
    assert.equal(isISODate('2026-06-01T09:00:00Z'), false);
    assert.equal(formatDay({ name: 'Market', startDate: '2026-06-01' }), 'Monday, 6/1');
    assert.equal(formatTimeRange({ name: 'Market', startDate: '2026-06-01' }), 'All Day');
    const noon = localDateTime(2026, 6, 1, 12);
    assert.equal(formatTimeRange({ name: 'Opening', startDate: noon }), '12pm');
    assert.equal(
        formatTimeRange({ name: 'Brief Meeting', startDate: noon, endDate: noon }),
        '12pm',
    );
    assert.equal(
        formatTimeRange({
            name: 'Workshop',
            startDate: localDateTime(2026, 6, 1, 9),
            endDate: localDateTime(2026, 6, 1, 11),
        }),
        '9-11am',
    );
    assert.equal(
        formatTimeRange({
            name: 'Concert',
            startDate: localDateTime(2026, 6, 1, 11, 30),
            endDate: localDateTime(2026, 6, 1, 13),
        }),
        '11:30am-1pm',
    );
});

test('eventSort places timed events before all-day events on the same date', () => {
    const events = [
        { name: 'All day', startDate: '2026-06-01' },
        { name: 'Timed', startDate: localDateTime(2026, 6, 1, 9) },
    ];

    events.sort(eventSort);

    assert.deepEqual(events.map(event => event.name), ['Timed', 'All day']);
});

test('date helpers construct local dates and calculate the next Monday at noon', t => {
    t.mock.timers.enable({
        apis: ['Date'],
        now: new Date(2026, 10, 18, 8),
    });

    const dateOnly = getDateFromISODate('2026-06-01');
    assert.deepEqual(
        [dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate()],
        [2026, 5, 1],
    );
    assert.equal(getEndOfWeek().getTime(), new Date(2026, 10, 23, 12).getTime());
    assert.equal(getEndOfWeek(1).getTime(), new Date(2026, 10, 30, 12).getTime());
});

test('isEventInTimeRange includes short in-progress events but excludes boundary starts', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-02T12:00:00.000Z');

    assert.equal(
        isEventInTimeRange({
            name: 'Ongoing',
            startDate: '2026-06-01T10:00:00.000Z',
            endDate: '2026-06-01T13:00:00.000Z',
        }, start, end),
        true,
    );
    assert.equal(
        isEventInTimeRange({ name: 'At boundary', startDate: start.toISOString() }, start, end),
        false,
    );
    assert.equal(
        isEventInTimeRange({
            name: 'Ends at range start',
            startDate: '2026-06-01T11:00:00.000Z',
            endDate: start.toISOString(),
        }, start, end),
        false,
    );
    assert.equal(
        isEventInTimeRange({
            name: 'Long series',
            startDate: '2026-05-20T10:00:00.000Z',
            endDate: '2026-06-03T10:00:00.000Z',
        }, start, end),
        false,
    );
});

test('isEventUpcomingAndBeforeDate uses the current time and an exclusive end', t => {
    t.mock.timers.enable({
        apis: ['Date'],
        now: new Date('2026-06-01T12:00:00.000Z'),
    });

    assert.equal(
        isEventUpcomingAndBeforeDate(
            { name: 'Tomorrow', startDate: '2026-06-02T12:00:00.000Z' },
            new Date('2026-06-03T00:00:00.000Z'),
        ),
        true,
    );
    assert.equal(
        isEventUpcomingAndBeforeDate(
            { name: 'At end', startDate: '2026-06-03T00:00:00.000Z' },
            new Date('2026-06-03T00:00:00.000Z'),
        ),
        false,
    );
});
