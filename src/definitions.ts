
export type Event = {
    name: string,
    startDate: ISODate | ISODatetime,
    endDate?: ISODate | ISODatetime,
    organizer?: {
        name: string,
    },
};

export type Organization = {
    name: string,
    eventApiType: string,
    api: string,
    jsonLdLinkBlockList?: string[];
    jsonLdEventLinkMustInclude?: string;
};

type ISODate = string; // Expected format: YYYY-MM-DD
type ISODatetime = string; // Expected format: YYYY-MM-DDTHH:mm:ss.sssZ
