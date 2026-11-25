import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EventRecord } from '../src/definitions.ts';
import { eventStep, type ProcessStep } from '../src/process/processStep.ts';
import { ProcessStepError } from '../src/process/processEvents.ts';
import type { Exporter } from '../src/export/exporter.ts';
import { runIndexerPipeline, type IndexerPipeline } from '../src/pipeline/runIndexerPipeline.ts';
import { parseRunArgs, UsageError } from '../src/pipeline/cliArgs.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-'));
const quiet = { log: () => {} };
const names = (file: string): string[] => JSON.parse(fs.readFileSync(file, 'utf-8')).map((e: EventRecord) => e.name);

const collected = (): EventRecord[] => [
    { name: 'Open Mic @ Bar', startDate: new Date('2030-01-02T20:00:00Z') as any },   // a Date object, like the webCal integration returns
    { name: 'Closed for holiday', startDate: '2030-01-01T20:00:00.000Z' },
    { name: 'Early Show', startDate: '2030-01-01T18:00:00.000Z' },
];
const removeClosed = eventStep('removeClosed', (e, ctx) => /closed/i.test(e.name) ? ctx.remove(e, 'closed') : e);
const trim = eventStep('trim', (e, ctx) => e.name.includes('@') ? ctx.change(e, { ...e, name: e.name.split('@')[0].trim() }, 'trimmed') : e);
const sort: ProcessStep = { name: 'sort', run: events => [...events].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)) };

let collectCalls = 0;
const ran: string[] = [];
const textExporter = (name: string, extra: Partial<Exporter> = {}): Exporter => ({
    name, ...extra,
    async export(events, { outputDir }) {
        ran.push(name);
        const file = path.join(outputDir, `${name}.txt`);
        fs.writeFileSync(file, events.map(e => e.name).join('\n'));
        return { fileNames: [file] };
    },
});
const pipeline = (over: Partial<IndexerPipeline> = {}): IndexerPipeline => ({
    collectEvents: async () => { collectCalls++; return collected(); },
    processEvents: [removeClosed, trim, sort],
    exportEvents: [textExporter('list'), textExporter('newsletter'), textExporter('images', { onDemand: true })],
    ...over,
});

test('a full run writes both checkpoints, processes, and skips on-demand exporters', async () => {
    const dir = tmp(); ran.length = 0;
    const result = await runIndexerPipeline(pipeline(), { outputDir: dir, ...quiet });

    assert.deepEqual(names(path.join(dir, 'rawEvents.json')), ['Open Mic @ Bar', 'Closed for holiday', 'Early Show']);
    assert.equal(typeof JSON.parse(fs.readFileSync(path.join(dir, 'rawEvents.json'), 'utf-8'))[0].startDate, 'string');   // Date normalized
    assert.deepEqual(names(path.join(dir, 'processedEvents.json')), ['Early Show', 'Open Mic']);
    assert.deepEqual(ran, ['list', 'newsletter']);
    assert.deepEqual(result.skippedOnDemand, ['images']);
    assert.deepEqual(result.processed!.steps.map(s => [s.step, s.inputCount, s.outputCount]), [['removeClosed', 3, 2], ['trim', 2, 2], ['sort', 2, 2]]);
});

test('--from process reuses rawEvents.json without collecting', async () => {
    const dir = tmp();
    await runIndexerPipeline(pipeline(), { outputDir: dir, to: 'collect', ...quiet });
    const before = collectCalls;
    await runIndexerPipeline(pipeline(), { outputDir: dir, from: 'process', to: 'process', ...quiet });
    assert.equal(collectCalls, before);
    assert.deepEqual(names(path.join(dir, 'processedEvents.json')), ['Early Show', 'Open Mic']);
});

test('--from export reads processedEvents.json, and named exporters include on-demand ones', async () => {
    const dir = tmp();
    await runIndexerPipeline(pipeline(), { outputDir: dir, ...quiet });
    ran.length = 0;
    const result = await runIndexerPipeline(pipeline(), { outputDir: dir, from: 'export', exporters: ['images'], ...quiet });
    assert.deepEqual(ran, ['images']);
    assert.deepEqual(result.skippedOnDemand, []);
    assert.equal(fs.readFileSync(path.join(dir, 'images.txt'), 'utf-8'), 'Early Show\nOpen Mic');
});

test('a bad exporter name fails before anything is collected', async () => {
    const before = collectCalls;
    await assert.rejects(() => runIndexerPipeline(pipeline(), { outputDir: tmp(), exporters: ['nope'], ...quiet }), /Unknown exporter: nope\. Available: list, newsletter, images/);
    assert.equal(collectCalls, before);
});

test('selecting exporters while stopping before the export stage is an error', async () => {
    await assert.rejects(() => runIndexerPipeline(pipeline(), { outputDir: tmp(), to: 'process', exporters: ['list'], ...quiet }), /Exporters were selected/);
});

test('duplicate exporter names are rejected up front', async () => {
    const before = collectCalls;
    await assert.rejects(() => runIndexerPipeline(pipeline({ exportEvents: [textExporter('same'), textExporter('same')] }), { outputDir: tmp(), ...quiet }), /Two exporters are named "same"/);
    assert.equal(collectCalls, before);
});

test('a throwing step stops the run: processedEvents.json untouched, nothing exported, raw checkpoint kept', async () => {
    const dir = tmp();
    await runIndexerPipeline(pipeline(), { outputDir: dir, ...quiet });
    const good = fs.readFileSync(path.join(dir, 'processedEvents.json'), 'utf-8');
    ran.length = 0;

    const boom = eventStep('boom', () => { throw new Error('bad data'); });
    await assert.rejects(() => runIndexerPipeline(pipeline({ processEvents: [removeClosed, boom, sort] }), { outputDir: dir, ...quiet }), (error: unknown) => {
        assert.ok(error instanceof ProcessStepError);
        assert.deepEqual([error.step, error.stepNumber, error.stepCount], ['boom', 2, 3]);
        return true;
    });
    assert.equal(fs.readFileSync(path.join(dir, 'processedEvents.json'), 'utf-8'), good);
    assert.deepEqual(ran, []);
    assert.deepEqual(names(path.join(dir, 'rawEvents.json')), ['Open Mic @ Bar', 'Closed for holiday', 'Early Show']);
});

test('exporter failures are isolated and reported', async () => {
    const broken: Exporter = { name: 'broken', async export() { throw new Error('disk full'); } };
    const result = await runIndexerPipeline(pipeline({ exportEvents: [broken, textExporter('list')] }), { outputDir: tmp(), ...quiet });
    assert.deepEqual(result.exports!.map(r => [r.exporter, r.status]), [['broken', 'failed'], ['list', 'ok']]);
    assert.equal(result.exports![0].error, 'disk full');
});

test('missing checkpoints give an error that says which stage to run', async () => {
    await assert.rejects(() => runIndexerPipeline(pipeline(), { outputDir: tmp(), from: 'process', ...quiet }), /rawEvents\.json" is not present\. Run the collect stage first \(--from collect\)/);
    await assert.rejects(() => runIndexerPipeline(pipeline(), { outputDir: tmp(), from: 'export', ...quiet }), /processedEvents\.json" is not present\. Run the process stage first \(--from process\)/);
});

test('exporters that do not need events work without processedEvents.json', async () => {
    const standalone = textExporter('standalone', { needsEvents: false });
    const result = await runIndexerPipeline(pipeline({ exportEvents: [standalone] }), { outputDir: tmp(), from: 'export', exporters: ['standalone'], ...quiet });
    assert.equal(result.exports![0].status, 'ok');
});

test('--from after --to is an error', async () => {
    await assert.rejects(() => runIndexerPipeline(pipeline(), { outputDir: tmp(), from: 'export', to: 'process', ...quiet }), /Cannot run from "export" to "process"/);
});

test('parseRunArgs defaults and --export implying --from export', () => {
    assert.deepEqual(parseRunArgs([]), { help: false, from: 'collect', to: 'export', exporters: undefined, verbose: false, weeksOut: undefined });
    assert.equal(parseRunArgs(['--export', 'postImages']).from, 'export');
    assert.equal(parseRunArgs(['--export', 'a,b', '--export', 'c']).exporters!.join(), 'a,b,c');
    assert.equal(parseRunArgs(['--export', 'x', '--from', 'process']).from, 'process');
    assert.deepEqual(parseRunArgs(['--from', 'process', '--to', 'process', '--verbose']).verbose, true);
    assert.equal(parseRunArgs(['--weeks', '4']).weeksOut, 4);
    assert.equal(parseRunArgs(['-h']).help, true);
});

test('parseRunArgs rejects invalid combinations with a UsageError', () => {
    const bad = (args: string[], message: RegExp) => assert.throws(() => parseRunArgs(args), (e: unknown) => e instanceof UsageError && message.test(e.message));
    bad(['--from', 'nope'], /--from must be one of: collect, process, export/);
    bad(['--from', 'export', '--to', 'process'], /--from export comes after --to process/);
    bad(['--export', 'x', '--to', 'process'], /--export needs the export stage/);
    bad(['--weeks', '0'], /--weeks must be a positive whole number/);
    bad(['--weeks', '2', '--from', 'process'], /--weeks only applies when the collect stage runs/);
    bad(['--export', ''], /--export needs at least one exporter name/);
    bad(['--bogus'], /Unknown option/);
});
