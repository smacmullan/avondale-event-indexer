import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { printEventList } from '../src/printEventList.ts';

test('printEventList groups events by day and includes organizers', t => {
    t.mock.method(console, 'log', () => {});
    const tempDirectory = mkdtempSync(join(tmpdir(), 'event-indexer-test-'));
    const outputPath = join(tempDirectory, 'events.md');

    try {
        printEventList([
            {
                name: 'Morning Market',
                startDate: '2026-06-01',
                organizer: { name: 'Local Market' },
            },
            { name: 'Community Dinner', startDate: '2026-06-01' },
            { name: 'Art Workshop', startDate: '2026-06-02' },
        ], outputPath);

        const output = readFileSync(outputPath, 'utf8');
        assert.match(output, /## Monday, 6\/1/);
        assert.match(output, /\* \*\*All Day\*\*   Morning Market \| Local Market/);
        assert.match(output, /\* \*\*All Day\*\*   Community Dinner\s*\n/);
        assert.match(output, /## Tuesday, 6\/2/);
    } finally {
        rmSync(tempDirectory, { recursive: true, force: true });
    }
});

test('printEventList skips malformed events without dropping valid ones', t => {
    t.mock.method(console, 'log', () => {});
    const errorMock = t.mock.method(console, 'error', () => {});
    const tempDirectory = mkdtempSync(join(tmpdir(), 'event-indexer-test-'));
    const outputPath = join(tempDirectory, 'events.md');
    const malformedEvent = { name: 'Invalid Date', startDate: 'not-a-date' };

    try {
        printEventList([
            malformedEvent,
            { name: 'Valid Event', startDate: '2026-06-01' },
        ], outputPath);

        assert.match(readFileSync(outputPath, 'utf8'), /Valid Event/);
        assert.equal(errorMock.mock.calls[0].arguments[0], 'Error formatting event');
        assert.deepEqual(errorMock.mock.calls[0].arguments[1], malformedEvent);
    } finally {
        rmSync(tempDirectory, { recursive: true, force: true });
    }
});

test('printEventList reports file write failures', t => {
    t.mock.method(console, 'log', () => {});
    const errorMock = t.mock.method(console, 'error', () => {});
    const tempDirectory = mkdtempSync(join(tmpdir(), 'event-indexer-test-'));

    try {
        printEventList([], join(tempDirectory, 'missing', 'events.md'));

        assert.equal(
            errorMock.mock.calls[0].arguments[0],
            'Error writing event list text output to file',
        );
    } finally {
        rmSync(tempDirectory, { recursive: true, force: true });
    }
});
