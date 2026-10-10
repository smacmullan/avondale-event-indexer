
export type Event = {
    name: string;
    startDate: ISODate | ISODatetime;
    endDate?: ISODate | ISODatetime;
    organizer?: {
        name: string;
    };
    url?: string;
};

export type EventSchedule = {
    startDate: string;
    endDate: string;
    frequency: string;
    byDay: string;
    monthlyOccurence?: string;
};

export type Organization = {
    name: string,
    eventApiType: string,
    api: string,
    /** Used for picking event to keep from duplicates. Lower value is preffered. If not specified, assume 0 (highest).
     * 
     * Suggested values:
     *  - 0: direct source w/ event detail pages
     *  - 1: user submitted events
     *  - 2: an event aggregator
     *  - 3: direct source w/o event detail pages (e.g., a Google calendar)
     */
    dedupeRank?: Number,
    jsonLdLinkBlockList?: string[];
    jsonLdEventLinkMustInclude?: string;
    jsonLdHubPageRequiresRendering?: boolean;
    jsonLdEventPagesRequireRendering?: boolean;
    googleCalendarUseLocation?: boolean;
    eventPageUrl?: string;
};

type ISODate = string; // Expected format: YYYY-MM-DD
type ISODatetime = string; // Expected format: YYYY-MM-DDTHH:mm:ss.sssZ
