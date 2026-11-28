import type { z } from 'zod';

/** Where an event came from. */
export type EventOrigin = {
    name: string;
    /** Lower is preferred. The source's dedupeRank with the default (0) already applied. */
    dedupeRank: number;
};

export type EventRecord = {
    name: string;
    startDate: ISODate | ISODatetime;
    endDate?: ISODate | ISODatetime;
    organizer?: {
        name: string;
    };
    url?: string;
    source?: EventOrigin;
}

export type EventSchedule = {
    startDate: string;
    endDate: string;
    frequency: string;
    byDay: string;
    monthlyOccurence?: string;
}

export type EventSource = {
    name: string;
    /** Optional override to use for the event organizer name. Note that using this is integration-dependent. */
    displayName?: string;
    integrationType: string;
    /** Used for picking event to keep from duplicates. Lower value is preferred. If not specified, assume 0 (highest).
     * 
     * Suggested values:
     *  - 0: direct source w/ event detail pages
     *  - 1: user submitted events
     *  - 2: an event aggregator
     *  - 3: direct source w/o event detail pages (e.g., a Google calendar)
     */
    dedupeRank?: number;
    /** Max time this source may take, in ms. Overrides the registry's default (60s). Raise it for slow, browser-rendered sources. */
    timeoutMs?: number;
    /** Integration-specific; validated by the integration's parseOptions */
    options?: unknown;
};

export interface IntegrationContext<TOptions> {
    source: EventSource;
    options: TOptions;
    /** Integrations must not return events starting after this. */
    endSearchDate: Date;
    /** Aborted when the source times out. Pass it to fetch() and any other cancellable calls (the shared fetch helpers do this automatically). */
    signal: AbortSignal;
}

/**
 * Shown by `node index.ts --list-integrations` and `--describe <type>`.
 * Per-option docs are not written here: they come from `.describe()` on the options schema.
 */
export type IntegrationDocs = {
    /** Human-readable name, e.g. "Google Calendar". */
    title: string;
    /** One line, shown in the integration list. */
    summary: string;
    /** Plain text: how it works, how to find the right option values, caveats. */
    details?: string;
    /** Environment variables the integration needs, e.g. API keys. */
    requiresEnv?: string[];
    /** For source-specific wrappers: the `type` of the integration they build on. Set automatically by withTransform(). */
    basedOn?: string;
    /** Example `options` object for sources.json. Must pass the options schema. */
    example?: Record<string, unknown>;
};

export interface EventIntegration<TOptions = unknown> {
    readonly type: string;
    readonly docs: IntegrationDocs;
    /** Single source of truth for the options: parseOptions validates with it and --describe documents from it. */
    readonly optionsSchema: z.ZodType<TOptions>;
    /** Validate and normalize raw config. Throw on invalid input. */
    parseOptions(raw: unknown): TOptions;
    /** May throw; the registry handles failures. */
    fetchEvents(ctx: IntegrationContext<TOptions>): Promise<EventRecord[]>;
}

type ISODate = string; // Expected format: YYYY-MM-DD
type ISODatetime = string; // Expected format: YYYY-MM-DDTHH:mm:ss.sssZ