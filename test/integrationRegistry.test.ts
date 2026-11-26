import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import type { EventIntegration, EventSource } from '../src/definitions.ts';
import { IntegrationRegistry } from '../src/collect/integrationRegistry.ts';

const source = (integrationType: string, extra: Partial<EventSource> = {}): EventSource => ({
    name: 'Test Source',
    integrationType,
    ...extra,
});

const testDocs = (title: string) => ({ title, summary: `${title} test integration` });
const emptyOptions = z.object({});

test('IntegrationRegistry reports invalid options without calling the integration', async () => {
    let fetchCalled = false;
    const registry = new IntegrationRegistry();
    registry.register({
        type: 'invalidOptions',
        docs: testDocs('Invalid Options'),
        optionsSchema: emptyOptions,
        parseOptions() {
            throw new Error('bad configuration');
        },
        async fetchEvents() {
            fetchCalled = true;
            return [];
        },
    });

    const result = await registry.collectEventsFromSource(source('invalidOptions'), new Date());

    assert.equal(result.status, 'failed');
    assert.deepEqual(result.events, []);
    assert.equal(result.error, 'Invalid options: bad configuration (see: node index.ts --describe invalidOptions)');
    assert.equal(fetchCalled, false);
});

test('IntegrationRegistry converts integration exceptions into failed source results', async () => {
    const registry = new IntegrationRegistry();
    const integration: EventIntegration<Record<string, never>> = {
        type: 'throws',
        docs: testDocs('Throws'),
        optionsSchema: emptyOptions,
        parseOptions: () => ({}),
        async fetchEvents() {
            throw new Error('upstream unavailable');
        },
    };
    registry.register(integration);

    const result = await registry.collectEventsFromSource(source('throws'), new Date());

    assert.equal(result.status, 'failed');
    assert.deepEqual(result.events, []);
    assert.equal(result.error, 'upstream unavailable');
});

test('IntegrationRegistry aborts timed-out integrations and reports the timeout', async () => {
    let receivedSignal: AbortSignal | undefined;
    const registry = new IntegrationRegistry();
    const integration: EventIntegration<Record<string, never>> = {
        type: 'slow',
        docs: testDocs('Slow'),
        optionsSchema: emptyOptions,
        parseOptions: () => ({}),
        fetchEvents({ signal }) {
            receivedSignal = signal;
            return new Promise(resolve => {
                signal.addEventListener('abort', () => resolve([]), { once: true });
            });
        },
    };
    registry.register(integration);

    const result = await registry.collectEventsFromSource(
        source('slow', { timeoutMs: 100 }),
        new Date(),
    );

    assert.equal(result.status, 'failed');
    assert.deepEqual(result.events, []);
    assert.match(result.error!, /^Timed out after \d+(?:\.\d+)?s$/);
    assert.equal(receivedSignal?.aborted, true);
});
