import type { Organization, Event } from '../../definitions.ts';

export async function fetchChicagoParkDistrictEvents(org: Organization, endSearchDate: Date): Promise<Event[]> {
    try {
        // fetch event data
        let apiString = generateApiUrl(org, endSearchDate);
        let response = await fetch(apiString);
        let data = await response.json()

        let events: Event[] = data.map(standardizeParkDistrictEvent);
        return events;
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

/** Generate API URL to get park district event data from City of Chicago's Open Data Portal*/
function generateApiUrl(org: Organization, endSearchDate: Date): string {

    const parkNames = org.api.split(",");
    const parkNamesQueryString = parkNames.map(s => `"${s.trim()}"`).join(", "); // format `"Park #1", "Park #2"`
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

function standardizeParkDistrictEvent(event: any): Event {

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