import { z } from 'zod';
import type { EventIntegration } from '../definitions.ts';

/** Text for `--list-integrations`: general-purpose integrations first, then source-specific wrappers. */
export function formatIntegrationList(integrations: readonly EventIntegration<any>[]): string {
    const general = integrations.filter(integration => !integration.docs.basedOn);
    const specific = integrations.filter(integration => integration.docs.basedOn);
    const width = Math.max(0, ...integrations.map(integration => integration.type.length));
    const row = (integration: EventIntegration<any>, suffix = '') =>
        `  ${integration.type.padEnd(width)}  ${integration.docs.summary}${suffix}`;

    const lines = ['Integrations (use as "integrationType" in config/sources.json):', '', ...general.map(i => row(i))];
    if (specific.length) {
        lines.push('', 'Source-specific (built on a general integration, same options):', '');
        lines.push(...specific.map(i => row(i, ` (based on ${i.docs.basedOn})`)));
    }
    lines.push('', 'Run "node index.ts --describe <type>" for details, options, and an example.');
    return lines.join('\n');
}

/** Text for `--describe <type>`. */
export function formatIntegrationDescription(integration: EventIntegration<any>): string {
    const { type, docs } = integration;
    const lines = [`${docs.title} (${type})`, '', docs.summary];

    if (docs.basedOn)
        lines.push('', `Built on "${docs.basedOn}" and accepts the same options. Run "node index.ts --describe ${docs.basedOn}" for how it works.`);
    if (docs.details)
        lines.push('', docs.details.trim());
    if (docs.requiresEnv?.length)
        lines.push('', `Requires environment variable${docs.requiresEnv.length > 1 ? 's' : ''}: ${docs.requiresEnv.join(', ')} (see README: Environment Setup)`);

    lines.push('', ...formatOptions(integration.optionsSchema));

    if (docs.example) {
        const entry = JSON.stringify({ name: 'Example Source', integrationType: type, options: docs.example }, null, 2);
        lines.push('', 'Example config/sources.json entry:', ...entry.split('\n').map(line => `  ${line}`));
    }
    return lines.join('\n');
}

function formatOptions(schema: z.ZodType): string[] {
    let json: any;
    try {
        json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
    } catch {
        return ['Options: (could not be described automatically)'];
    }

    const entries = Object.entries<any>(json.properties ?? {});
    if (entries.length === 0)
        return ['Options: none'];

    const required = new Set<string>(json.required ?? []);
    const lines = ['Options:'];
    for (const [name, prop] of entries) {
        const traits = [describeType(prop), required.has(name) ? 'required' : 'optional'];
        if (prop.default !== undefined)
            traits.push(`default ${JSON.stringify(prop.default)}`);
        lines.push(`  ${name}  (${traits.join(', ')})`);
        if (prop.description)
            lines.push(`      ${prop.description}`);
    }
    return lines;
}

function describeType(prop: any): string {
    if (prop.enum)
        return prop.enum.map((value: unknown) => JSON.stringify(value)).join(' | ');
    if (prop.anyOf)
        return prop.anyOf.map(describeType).join(' | ');
    if (prop.type === 'array')
        return `${describeType(prop.items ?? {})}[]`;
    if (prop.format === 'uri')
        return 'URL';
    return prop.type ?? 'any';
}
