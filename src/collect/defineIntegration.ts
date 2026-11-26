import type { z } from 'zod';
import type { EventIntegration, EventRecord, IntegrationContext, IntegrationDocs } from '../definitions.ts';

/**
 * Define an integration from a zod options schema. The schema is the single source of truth:
 *  - parseOptions is derived from it,
 *  - `options` in fetchEvents is typed from it,
 *  - `node index.ts --describe <type>` documents the options from its .describe() text.
 */
export function defineIntegration<TSchema extends z.ZodType>(definition: {
    type: string;
    docs: IntegrationDocs;
    options: TSchema;
    fetchEvents(ctx: IntegrationContext<z.output<TSchema>>): Promise<EventRecord[]>;
}): EventIntegration<z.output<TSchema>> {
    const { type, docs, options, fetchEvents } = definition;
    return {
        type,
        docs,
        optionsSchema: options as z.ZodType<z.output<TSchema>>,
        parseOptions: raw => options.parse(raw),
        fetchEvents: ctx => fetchEvents(ctx),
    };
}
