import { z } from 'zod';
import type { EventRecord } from '../../definitions.ts';
import { fetchJson, standardizeAll } from '../integrationHelpers.ts';
import { defineIntegration } from '../defineIntegration.ts';

const optionsSchema = z.object({
    neighborhoodId: z.string().regex(/^\d+$/, 'must be a numeric community area id')
        .describe('Chicago community area ID on the City of Chicago data portal; digits only'),
}).strict();

export type ChicagoBlockPartiesOptions = z.infer<typeof optionsSchema>;

export const chicagoBlockPartiesIntegration = defineIntegration({
    type: 'chicagoBlockParties',

    docs: {
        title: 'Chicago Block Parties',
        summary: 'Block parties in a selected Chicago community area.',
        details:
            'Queries the City of Chicago open data portal for block party permits in the selected community area. ' +
            'Use the numeric community area ID used by the portal; this is not a neighborhood name.',
        example: { neighborhoodId: '24' },
    },

    options: optionsSchema,

    async fetchEvents({ source, options, endSearchDate }) {
        // The query filters by date range, so no post-filtering is needed.
        const data = await fetchJson<any[]>(generateApiUrl(options, endSearchDate));
        if (!Array.isArray(data))
            throw new Error('Unexpected response from data portal (expected an array)');

        return standardizeAll(data, standardizeBlockPartyEvent, source.name);
    },
});

/** Generate API URL to get block party data from City of Chicago's Open Data Portal's Transportation Department Permits. */
function generateApiUrl(options: ChicagoBlockPartiesOptions, endSearchDate: Date): string {

    const neighborhoodCode = options.neighborhoodId;
    const today = new Date();

    return `https://data.cityofchicago.org/resource/pubx-yq2d.json?$query=SELECT
    \`applicationnumber\`,
    \`applicationstatus\`,
    \`currentmilestone\`,
    \`applicationstartdate\`,
    \`applicationname\`,
    \`comments\`,
    \`streetnumberfrom\`,
    \`streetnumberto\`,
    \`direction\`,
    \`streetname\`,
    \`suffix\`,
    \`latitude\`,
    \`longitude\`,
    \`:@computed_region_vrxf_vc4k\`
  WHERE
    caseless_eq(\`worktype\`, "BlockParty")
    AND \`:@computed_region_vrxf_vc4k\` IN ("${neighborhoodCode}")
    AND caseless_one_of(
      \`currentmilestone\`,
      "Complete",
      "Application in Review"
    )
    AND \`applicationstartdate\`
      BETWEEN "${toLocalDate(today)}T00:00:00" :: floating_timestamp
      AND "${toLocalDate(endSearchDate)}T23:59:59" :: floating_timestamp
  ORDER BY \`applicationstartdate\` ASC NULL LAST`;

}

function standardizeBlockPartyEvent(event: any): EventRecord {
    return {
        name: "Block Party",
        startDate: event.applicationstartdate.split("T")[0], // date only
        organizer: {
            name: formatAddress(event),
        },
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

function formatAddress(event: any) {
    return `${roundToNearestTenth(event.streetnumberfrom)} ${event.direction} ${toTitleCase(event.streetname)} ${toTitleCase(event.suffix)}`;
}

function roundToNearestTenth(numStr: string): number {
    const num = parseInt(numStr, 10);
    return Math.round(num / 10) * 10;
}

function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}