export type EventRecord = {
    name: string;
    startDate: ISODate | ISODatetime;
    endDate?: ISODate | ISODatetime;
    organizer?: {
        name: string;
    };
    url?: string;
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
    /** Max time this source may take, in ms. Overrides the registry's default (120s). Raise it for slow, browser-rendered sources. */
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

export interface EventIntegration<TOptions = unknown> {
    readonly type: string;
    /** Validate and normalize raw config. Throw on invalid input. */
    parseOptions(raw: unknown): TOptions;
    /** May throw; the registry handles failures. */
    fetchEvents(ctx: IntegrationContext<TOptions>): Promise<EventRecord[]>;
}

type ISODate = string; // Expected format: YYYY-MM-DD
type ISODatetime = string; // Expected format: YYYY-MM-DDTHH:mm:ss.sssZ