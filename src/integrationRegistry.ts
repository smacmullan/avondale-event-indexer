import type { Event, EventIntegration, Organization } from './definitions.ts';

type Runner = (org: Organization, endSearchDate: Date) => Promise<Event[]>;

/**
 * Maps `eventApiType` strings to integrations. Failures of any kind (invalid options,
 * thrown fetch errors, unknown type) are logged and produce an empty event list so
 * other organizations keep processing.
 */
export class IntegrationRegistry {
    private runners = new Map<string, Runner>();

    register<TOptions>(integration: EventIntegration<TOptions>): void {
        if (this.runners.has(integration.type))
            throw new Error(`Integration "${integration.type}" is already registered`);

        // Closing over the typed integration erases TOptions for storage while keeping
        // parseOptions -> fetchEvents type-checked inside this closure.
        this.runners.set(integration.type, async (org, endSearchDate) => {
            try {
                const options = integration.parseOptions(org.options ?? {});
                return await integration.fetchEvents({ org, options, endSearchDate });
            } catch (error) {
                console.error(`[${org.name}] ${integration.type} failed:`,
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

    async fetchEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
        const run = this.runners.get(org.eventApiType);
        if (!run) {
            console.error(`[${org.name}] No integration registered for "${org.eventApiType}"`);
            return [];
        }
        return run(org, endSearchDate);
    }
}