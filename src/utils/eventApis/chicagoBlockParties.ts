import { Organization, Event } from '../../definitions.js';

export async function fetchChicagoBlockPartyEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // fetch event data
        let apiString = generateApiUrl(org, endSearchDate);
        let response = await fetch(apiString);
        let data = await response.json()

        let events: Event[] = data.map(standardizeBlockPartyEvent);
        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

/** Generate API URL to get block party data from City of Chicago's Open Data Portal's Transportation Department Permits. */
function generateApiUrl(org: Organization, endSearchDate: Date): string {

    const neighborhoodCode = org.api; // chicago community area id on data portal
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

function standardizeBlockPartyEvent(event: any): Event {

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