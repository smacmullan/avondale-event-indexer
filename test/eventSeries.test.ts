import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventSeriesStartDates } from '../src/utils/eventSeries.ts';

test('weekly schedules expand to matching weekdays within the requested range', () => {
    const dates = getEventSeriesStartDates(
        {
            startDate: '2026-06-01T18:00:00.000Z',
            endDate: '2026-06-15T18:00:00.000Z',
            frequency: 'Weekly',
            byDay: 'Monday, Wednesday',
        },
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-15T23:59:59.000Z'),
    );

    assert.deepEqual(
        dates.map(date => date.toISOString().slice(0, 10)),
        ['2026-06-01', '2026-06-03', '2026-06-08', '2026-06-10', '2026-06-15'],
    );
});

test('monthly schedules support ordinal weekday occurrences', () => {
    const dates = getEventSeriesStartDates(
        {
            startDate: '2026-06-01T18:00:00.000Z',
            endDate: '2026-08-31T18:00:00.000Z',
            frequency: 'Monthly',
            byDay: 'Friday',
            monthlyOccurence: '2nd',
        },
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-08-31T23:59:59.000Z'),
    );

    assert.deepEqual(
        dates.map(date => date.toISOString().slice(0, 10)),
        ['2026-06-12', '2026-07-10', '2026-08-14'],
    );
});

test('daily and yearly schedules include matching occurrences in range', () => {
    const dailyDates = getEventSeriesStartDates(
        {
            startDate: '2026-06-01T18:00:00.000Z',
            endDate: '2026-06-03T18:00:00.000Z',
            frequency: 'Daily',
            byDay: '',
        },
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-03T23:59:59.000Z'),
    );
    const yearlyDates = getEventSeriesStartDates(
        {
            startDate: '2024-04-15T18:00:00.000Z',
            endDate: '2026-04-15T18:00:00.000Z',
            frequency: 'Yearly',
            byDay: '',
        },
        new Date('2024-04-15T00:00:00.000Z'),
        new Date('2026-04-15T23:59:59.000Z'),
    );

    assert.deepEqual(
        dailyDates.map(date => date.toISOString().slice(0, 10)),
        ['2026-06-01', '2026-06-02', '2026-06-03'],
    );
    assert.deepEqual(
        yearlyDates.map(date => date.toISOString().slice(0, 10)),
        ['2024-04-15', '2025-04-15', '2026-04-15'],
    );
});
