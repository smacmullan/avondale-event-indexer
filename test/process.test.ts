import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EventRecord } from '../src/definitions.ts';
import { eventStep, type ProcessStep } from '../src/process/processStep.ts';
import { processEvents, formatProcessSummary, ProcessStepError } from '../src/process/processEvents.ts';
import { defaultProcessSteps } from '../src/process/defaultSteps.ts';
import { removeClosed } from '../src/process/steps/removeClosed.ts';
import { removeListed } from '../src/process/steps/removeListed.ts';
import { trimLocations } from '../src/process/steps/trimLocations.ts';
import { normalizeDurations } from '../src/process/steps/normalizeDurations.ts';
import { sortEvents } from '../src/process/steps/sortEvents.ts';

const ev = (name: string, startDate = '2030-01-05T20:00:00.000Z', extra: Partial<EventRecord> = {}): EventRecord =>
    ({ name, startDate, ...extra });
/** Local-time ISO string, so duration tests don't depend on the machine's timezone. */
const local = (day: number, hour: number) => new Date(2030, 0, day, hour, 0, 0, 0).toISOString();
/** Runs with deep-frozen inputs, so any step that mutates its input throws. */
const run = (events: EventRecord[], steps: ProcessStep[]) => processEvents(events, steps, { freezeInputs: true });

test('removeClosed removes unnamed, closed, and sold out events', async () => {
    const { events, steps } = await run(
        [ev('Open Mic'), ev('CLOSED for the holiday'), ev('Show (Sold Out)'), ev('')], [removeClosed()]);
    assert.deepEqual(events.map(e => e.name), ['Open Mic']);
    assert.deepEqual(steps[0].removed.map(r => r.reason), ['name contains "closed"', 'name contains "sold out"', 'no name']);
});

test('removeListed matches name (trimmed) and organizer', async () => {
    const step = removeListed({ entries: [{ name: 'Trivia', organizer: 'Bar' }, { name: 'Loner' }] });
    const { events } = await run([
        ev(' Trivia ', undefined, { organizer: { name: 'Bar' } }),      // removed
        ev('Trivia', undefined, { organizer: { name: 'Other Venue' } }), // kept: different organizer
        ev('Loner'),                                                      // removed: entry and event both have no organizer
        ev('Loner', undefined, { organizer: { name: 'Bar' } }),         // kept
    ], [step]);
    assert.deepEqual(events.map(e => `${e.name.trim()}|${e.organizer?.name}`), ['Trivia|Other Venue', 'Loner|Bar']);
});

test('removeListed reads its file lazily, and a missing file stops the pipeline', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-'));
    const file = path.join(dir, 'list.json');
    const step = removeListed({ file });                 // constructing does no file IO
    await assert.rejects(() => run([ev('A')], [step]), (error: unknown) => {
        assert.ok(error instanceof ProcessStepError);
        assert.equal(error.step, 'removeListed');
        return true;
    });
    fs.writeFileSync(file, JSON.stringify([{ name: 'A', organizer: 'X' }]));
    const { events } = await run([ev('A', undefined, { organizer: { name: 'X' } }), ev('B')], [removeListed({ file })]);
    assert.deepEqual(events.map(e => e.name), ['B']);
});

test('removeListed rejects bad options when the pipeline is built', () => {
    assert.throws(() => removeListed({} as any));
    assert.throws(() => removeListed({ file: 'a.json', entries: [] } as any));
});

test('trimLocations trims at @, em dash, and "at", and leaves other names untouched', async () => {
    const plain = ev('Plain Name');
    const { events, steps } = await run(
        [ev('Open Mic @ The Bar'), ev('Jazz — Late Show'), ev('Dinner at 7'), ev('Dinner At Seven'), ev('Trim @ A at B'), plain],
        [trimLocations()]);
    assert.deepEqual(events.map(e => e.name), ['Open Mic', 'Jazz', 'Dinner', 'Dinner', 'Trim', 'Plain Name']);
    assert.equal(steps[0].changed.length, 5);
    assert.match(steps[0].changed[0].detail, /trimmed "@ The Bar"/);
});

test('normalizeDurations clamps multi-day events to the start day', async () => {
    const short = ev('Short', local(5, 10), { endDate: local(5, 12) });
    const multi = ev('Multi', local(5, 10), { endDate: local(7, 12) });          // 2 days later at 12:00
    const overnight = ev('Overnight', local(5, 20), { endDate: local(7, 2) });   // clamped end (02:00) is before the start
    const exactDay = ev('Exact', local(5, 10), { endDate: local(6, 10) });       // clamped end equals the start
    const noEnd = ev('NoEnd', local(5, 10));
    const { events } = await run([short, multi, overnight, exactDay, noEnd], [normalizeDurations()]);

    const byName = Object.fromEntries(events.map(e => [e.name, e]));
    assert.equal(byName.Short.endDate, short.endDate);
    assert.deepEqual([new Date(byName.Multi.endDate!).getDate(), new Date(byName.Multi.endDate!).getHours()], [5, 12]);
    assert.deepEqual([new Date(byName.Overnight.endDate!).getDate(), new Date(byName.Overnight.endDate!).getHours()], [6, 2]);
    assert.equal('endDate' in byName.Exact, false);
    assert.equal(byName.NoEnd.endDate, undefined);
});

test('sortEvents sorts chronologically without touching its input array', async () => {
    const { events } = await run([ev('Late', '2030-01-07T20:00:00.000Z'), ev('Early', '2030-01-05T20:00:00.000Z')], [sortEvents()]);
    assert.deepEqual(events.map(e => e.name), ['Early', 'Late']);
});

test('source survives the built-in cleaning steps', async () => {
    const source = { name: 'Venue', dedupeRank: 0 };
    const { events } = await run(
        [ev('Open Mic @ Bar', local(5, 10), { source, endDate: local(7, 12) })],
        [removeClosed(), removeListed({ entries: [] }), trimLocations(), normalizeDurations(), sortEvents()]);
    assert.deepEqual(events[0].source, source);
    assert.equal(events[0].name, 'Open Mic');
});

test('processEvents reports counts and removal reasons per step', async () => {
    const { steps } = await run([ev('A'), ev('Closed'), ev('B @ x')], [removeClosed(), trimLocations()]);
    assert.deepEqual(steps.map(s => [s.step, s.inputCount, s.outputCount]), [['removeClosed', 3, 2], ['trimLocations', 2, 2]]);
    const summary = formatProcessSummary(steps);
    assert.match(summary, /removeClosed\s+3 → 2\s+removed 1/);
    assert.match(formatProcessSummary(steps, true), /- removed "Closed": name contains "closed"/);
});

test('a throwing step stops the pipeline and names the step', async () => {
    let laterStepRan = false;
    const boom = eventStep('boom', () => { throw new Error('bad data'); });
    const later: ProcessStep = { name: 'later', run: events => { laterStepRan = true; return events; } };

    await assert.rejects(() => run([ev('A')], [removeClosed(), boom, later]), (error: unknown) => {
        assert.ok(error instanceof ProcessStepError);
        assert.deepEqual([error.step, error.stepNumber, error.stepCount], ['boom', 2, 3]);
        assert.deepEqual(error.completed.map(s => s.step), ['removeClosed']);
        assert.match(error.message, /Step 2 of 3 "boom" failed: bad data/);
        return true;
    });
    assert.equal(laterStepRan, false);
});

test('a step that returns a non-array fails the pipeline', async () => {
    const bad: ProcessStep = { name: 'bad', run: () => undefined as any };
    await assert.rejects(() => run([ev('A')], [bad]), /Step 1 of 1 "bad" failed: returned undefined/);
});

test('a step that mutates its input is caught when inputs are frozen', async () => {
    const mutator = eventStep('mutator', event => { event.name = 'changed'; return event; });
    await assert.rejects(() => run([ev('A')], [mutator]), ProcessStepError);
});

test('whole-list steps work: a step can see every event at once', async () => {
    const keepFirstPerName: ProcessStep = {
        name: 'keepFirstPerName',
        run: (events, ctx) => {
            const seen = new Set<string>();
            return events.filter(event => {
                if (seen.has(event.name)) {
                    ctx.remove(event, 'duplicate name');
                    return false;
                }
                seen.add(event.name);
                return true;
            });
        },
    };
    const { events, steps } = await run([ev('A'), ev('B'), ev('A')], [keepFirstPerName]);
    assert.deepEqual(events.map(e => e.name), ['A', 'B']);
    assert.equal(steps[0].removed.length, 1);
});

test('default steps run in the expected order', () => {
    assert.deepEqual(defaultProcessSteps.map(s => s.name),
        ['removeClosed', 'removeListed', 'trimLocations', 'normalizeDurations', 'sortEvents']);
});