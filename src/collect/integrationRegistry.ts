import type { EventRecord, EventIntegration, EventSource } from '../definitions.ts';

type Runner = (source: EventSource, endSearchDate: Date) => Promise<EventRecord[]>;

/**
 * Maps `integrationType` strings to integrations. Failures of any kind (invalid options,
 * thrown fetch errors, unknown type) are logged and produce an empty event list so
 * other sources keep processing.
 */
export class IntegrationRegistry {
    private runners = new Map<string, Runner>();

    register<TOptions>(integration: EventIntegration<TOptions>): void {
        if (this.runners.has(integration.type))
            throw new Error(`Integration "${integration.type}" is already registered`);

        // Closing over the typed integration erases TOptions for storage while keeping
        // parseOptions -> fetchEvents type-checked inside this closure.
        this.runners.set(integration.type, async (source, endSearchDate) => {
            try {
                const options = integration.parseOptions(source.options ?? {});
                return await integration.fetchEvents({ source: source, options, endSearchDate });
            } catch (error) {
                console.error(`[${source.name}] ${integration.type} failed:`,
                    error instanceof Error ? error.message : error);
                return [];
            }
        });
    }

    has(type: string): boolean {
        return this.runners.has(type);
    }

    types(): string[] {
        return [...this.runners.keys()];
    }

    async fetchEvents(source: EventSource, endSearchDate: Date): Promise<EventRecord[]> {
        const run = this.runners.get(source.integrationType);
        if (!run) {
            console.error(`[${source.name}] No integration registered for "${source.integrationType}"`);
            return [];
        }
        return run(source, endSearchDate);
    }
}