import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    parks: z.array(
        z.string().trim().min(1).refine(name => !name.includes('"'), 'must not contain double quotes (names go into a query)')
    ).min(1).describe("Park names exactly as they appear in the data portal's location_facility column"),
}).strict();

export type ChicagoParkDistrictOptions = z.infer<typeof optionsSchema>;

export const chicagoParkDistrictIntegration = defineIntegration({
    type: 'chicagoParkDistrict',

    docs: {
        title: 'Chicago Park District',
        summary: 'Events and activities at Chicago Park District facilities.',
        details: 'Queries the City of Chicago open data portal for activities at the specified facilities.',
        example: { parks: ['Example Park'] },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        // The query filters by date range, so no post-filtering is needed.
        const data = await fetchJson<any[]>(generateApiUrl(options, endSearchDate));
        if (!Array.isArray(data))
            throw new Error('Unexpected response from data portal (expected an array)');

        return standardizeAll(data, standardizeParkDistrictEvent, source.name);
    },
});

/** Generate API URL to get park district event data from City of Chicago's Open Data Portal */
function generateApiUrl(options: ChicagoParkDistrictOptions, endSearchDate: Date): string {

    const parkNamesQueryString = options.parks.map(name => `"${name}"`).join(", "); // format `"Park #1", "Park #2"`
    const today = new Date();

    return `https://data.cityofchicago.org/resource/tn7v-6rnw.json?$query=SELECT
        \`activity_id\`,
        \`type\`,
        \`title\`,
        \`description\`,
        \`start_date\`,
        \`end_date\`,
        \`date_notes\`,
        \`season\`,
        \`zone\`,
        \`location_facility\`,
        \`location_notes\`,
        \`age_range\`,
        \`activity_type\`,
        \`category\`,
        \`fee\`,
        \`image_link\`,
        \`movie_rating\`,
        \`movie_title\`,
        \`restrictions\`,
        \`information_link\`,
        \`registration_link\`,
        \`registration_date\`,
        \`event_cancelled\`,
        \`address\`,
        \`zip\`,
        \`latitude\`,
        \`longitude\`
        WHERE
        \`location_facility\` IN (${parkNamesQueryString})
        AND \`start_date\`
                BETWEEN "${toLocalDate(today)}T00:00:00" :: floating_timestamp
                AND "${toLocalDate(endSearchDate)}T23:59:59" :: floating_timestamp
        ORDER BY \`start_date\` ASC NULL LAST`;

}

function standardizeParkDistrictEvent(event: any): EventRecord {
    return {
        name: event.title,
        startDate: event.start_date,
        endDate: event.end_date,
        organizer: {
            name: event.location_facility,
        },
        url: event.information_link?.url
    };
}


// Helper functions

function toLocalDate(date: Date): string {
    const pad = (n: any) => String(n).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
}