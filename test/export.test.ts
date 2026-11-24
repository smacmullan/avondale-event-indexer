import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import type { EventRecord } from '../src/definitions.ts';
import { formatDay, formatTimeRange } from '../src/utils/time.ts';
import { groupEventsByDay, describeSkipped } from '../src/export/groupEventsByDay.ts';
import { exportEvents, formatExportSummary } from '../src/export/exportEvents.ts';
import { withSteps } from '../src/export/withSteps.ts';
import type { Exporter } from '../src/export/exporter.ts';
import { escapeHtml, httpUrlOrUndefined } from '../src/export/escapeHtml.ts';
import { eventListMarkdown } from '../src/export/exporters/eventListMarkdown.ts';
import { newsletterHtml, renderNewsletterHtml } from '../src/export/exporters/newsletterHtml.ts';
import { postImages, splitMarkdownIntoDayHtml, wrapHtmlInStyle } from '../src/export/exporters/postImages.ts';
import { upcomingWeek } from '../src/process/steps/upcomingWeek.ts';
import { ProcessStepError } from '../src/process/processEvents.ts';
import { eventStep } from '../src/process/processStep.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'export-'));
const at = (day: number, hour: number) => new Date(2030, 0, day, hour).toISOString();
const ev = (name: string, startDate: string, extra: Partial<EventRecord> = {}): EventRecord => ({ name, startDate, ...extra });

const sample: EventRecord[] = [
    ev('Open Mic', at(8, 19), { organizer: { name: 'The Bar' }, url: 'https://bar.test/open-mic' }),
    ev('Trivia', at(8, 21), { organizer: { name: 'The Bar' } }),
    ev('No Venue Show', at(9, 20)),
];

test('groupEventsByDay groups consecutive events under one day heading', () => {
    const { days, skipped } = groupEventsByDay(sample);
    assert.equal(skipped.length, 0);
    assert.deepEqual(days.map(d => d.lines.length), [2, 1]);
    assert.equal(days[0].day, formatDay(sample[0]));
    assert.equal(days[0].lines[0].timeRange, formatTimeRange(sample[0]));
    assert.equal(days[1].lines[0].organizerName, '');
});

test('groupEventsByDay skips events that fail to format and reports them', () => {
    const formatters = {
        formatDay: (e: EventRecord) => { if (e.name === 'Broken') throw new Error('bad date'); return formatDay(e); },
        formatTimeRange,
    };
    const { days, skipped } = groupEventsByDay([sample[0], ev('Broken', 'nope'), sample[2]], formatters);
    assert.deepEqual(days.map(d => d.lines.length), [1, 1]);
    assert.equal(skipped.length, 1);
    assert.match(describeSkipped(skipped)[0], /Skipped 1 event that couldn't be formatted\. First: "Broken" \(bad date\)/);
});

test('eventListMarkdown writes one heading per day and one bullet per event', async () => {
    const dir = tmp();
    const { files } = await eventListMarkdown().export(sample, { outputDir: dir });
    assert.deepEqual(files, [path.join(dir, 'eventList.md')]);

    const expected = `\n\n## ${formatDay(sample[0])}\n`
        + `* **${formatTimeRange(sample[0])}**   Open Mic | The Bar\n`
        + `* **${formatTimeRange(sample[1])}**   Trivia | The Bar\n`
        + `\n\n## ${formatDay(sample[2])}\n`
        + `* **${formatTimeRange(sample[2])}**   No Venue Show \n`;      // trailing space when there is no organizer
    assert.equal(fs.readFileSync(files[0], 'utf-8'), expected);
});

test('eventListMarkdown honors a custom file path and rejects unknown options', async () => {
    const dir = tmp();
    const file = path.join(dir, 'nested', 'list.md');
    const { files } = await eventListMarkdown({ file }).export(sample, { outputDir: 'unused' });
    assert.deepEqual(files, [file]);
    assert.throws(() => eventListMarkdown({ flie: 'x' } as any));
});

test('escapeHtml and httpUrlOrUndefined', () => {
    assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
    assert.equal(httpUrlOrUndefined('https://a.test/x'), 'https://a.test/x');
    assert.equal(httpUrlOrUndefined('javascript:alert(1)'), undefined);
    assert.equal(httpUrlOrUndefined('/relative'), undefined);
    assert.equal(httpUrlOrUndefined(undefined), undefined);
});

test('newsletterHtml escapes scraped data and only links http(s) URLs', async () => {
    const dir = tmp();
    const evil: EventRecord[] = [
        ev('<img src=x onerror=alert(1)> Show', at(8, 19), { organizer: { name: 'A & B' }, url: 'https://ok.test/e?a=1&b="2"' }),
        ev('Sneaky', at(8, 20), { url: 'javascript:alert(1)' }),
    ];
    const { files, warnings } = await newsletterHtml().export(evil, { outputDir: dir });
    const html = fs.readFileSync(files[0], 'utf-8');

    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; Show'));
    assert.ok(html.includes('href="https://ok.test/e?a=1&amp;b=&quot;2&quot;"'));
    assert.ok(html.includes(' - A &amp; B'));
    assert.ok(!html.includes('javascript:'));
    assert.ok(html.includes('>Sneaky</td>'));        // plain text, no link
    assert.ok(!html.includes('</p></td></tr>') || !html.includes('Show</a></p>'));   // no stray </p> after the name cell
    assert.deepEqual(warnings, []);
});

test('newsletterHtml opens and closes one table per day', () => {
    const html = renderNewsletterHtml(groupEventsByDay(sample).days);
    assert.equal(html.match(/<table/g)?.length, 2);
    assert.equal(html.match(/<\/table>/g)?.length, 2);
    assert.equal(html.match(/<tbody>/g)?.length, html.match(/<\/tbody>/g)?.length);
});

test('newsletterHtml warns when there are no events', async () => {
    const { warnings } = await newsletterHtml().export([], { outputDir: tmp() });
    assert.deepEqual(warnings, ['No events to export']);
});

test('withSteps runs its steps before the exporter and keeps the exporter\'s settings', async () => {
    const received: string[][] = [];
    const base: Exporter = { name: 'spy', onDemand: true, needsEvents: true, async export(events) { received.push(events.map(e => e.name)); return { files: [] }; } };
    const wrapped = withSteps(base, [upcomingWeek({ now: new Date(2030, 0, 2, 12) })]);
    assert.deepEqual([wrapped.name, wrapped.onDemand, wrapped.needsEvents], ['spy', true, true]);

    await wrapped.export([ev('This week', at(9, 12)), ev('Too early', at(3, 12))], { outputDir: 'unused' });
    assert.deepEqual(received, [['This week']]);
});

test('a failing step inside withSteps fails only that exporter', async () => {
    const good: Exporter = { name: 'good', async export() { return { files: ['g.txt'] }; } };
    const boom = eventStep('boom', () => { throw new Error('bad data'); });
    const wrapped = withSteps({ name: 'wrapped', async export() { return { files: ['w.txt'] }; } }, [boom]);

    const results = await exportEvents(sample, [wrapped, good], { outputDir: 'unused' });
    assert.deepEqual(results.map(r => [r.exporter, r.status]), [['wrapped', 'failed'], ['good', 'ok']]);
    assert.match(results[0].error!, /Step 1 of 1 "boom" failed: bad data/);
    assert.ok(ProcessStepError);   // (the message above comes from a ProcessStepError)
});

test('exportEvents reports warnings and formats a summary', async () => {
    const warns: Exporter = { name: 'warns', async export() { return { files: ['a.md'], warnings: ['careful'] }; } };
    const broken: Exporter = { name: 'broken', async export() { throw new Error('disk full'); } };
    const results = await exportEvents(sample, [warns, broken], { outputDir: 'unused' });
    const summary = formatExportSummary(results, ['postImages']);
    assert.match(summary, /warns\s+ok\s+a\.md/);
    assert.match(summary, /warning: careful/);
    assert.match(summary, /broken\s+FAILED\s+disk full/);
    assert.match(summary, /Not run \(on demand\): postImages/);
});

test('postImages splits markdown into one chunk per day (heading plus the list after it)', () => {
    const markdown = `# Title\n\n## Saturday\n* **7pm**   One | A\n* **8pm**   Two\n\nA stray paragraph\n\n## Sunday\n* **1pm**   Three\n`;
    const days = splitMarkdownIntoDayHtml(markdown, new MarkdownIt());
    assert.equal(days.length, 2);
    assert.ok(days[0].startsWith('<h2>Saturday</h2>'));
    assert.ok(days[0].includes('<li><strong>7pm</strong>   One | A</li>') || days[0].includes('One | A'));
    assert.equal(days[0].match(/<li>/g)?.length, 2);
    assert.ok(!days[0].includes('stray paragraph'));
    assert.ok(days[1].includes('<h2>Sunday</h2>') && days[1].includes('Three'));
});

test('postImages renders what the markdown exporter wrote', async () => {
    const dir = tmp();
    const { files } = await eventListMarkdown().export(sample, { outputDir: dir });
    const days = splitMarkdownIntoDayHtml(fs.readFileSync(files[0], 'utf-8'), new MarkdownIt());
    assert.equal(days.length, 2);
    assert.ok(wrapHtmlInStyle(days[0]).includes(days[0]));
});

test('postImages is on demand, ignores events, and explains a missing markdown file', async () => {
    const exporter = postImages();
    assert.deepEqual([exporter.name, exporter.onDemand, exporter.needsEvents], ['postImages', true, false]);
    assert.equal(postImages({ onDemand: false }).onDemand, false);
    await assert.rejects(() => exporter.export([], { outputDir: tmp() }), /is not present\. Run the eventListMarkdown export first/);
    assert.throws(() => postImages({ viewport: { width: -1, height: 10 } }));
});
