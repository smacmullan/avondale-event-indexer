export async function fetchDo312Events(org, endSearchDate) {
    try {
        // fetch event data
        let response = await fetch(org.api);
        let data = await response.json()
        let events = data.event_groups.flatMap(group => group.events);

        // Filter out events outside time range
        let today = new Date();
        events = events.filter(event => event.begin_time && new Date(event.begin_time) > today && new Date(event.begin_time) < endSearchDate);

        return events.map(standardizeDo312Event);
    } catch (error) {
        console.error(`Error fetching events for ${org.name}.`, error);
        return [];
    }
}

function standardizeDo312Event(event) {

    return {
        name: event.title,
        startDate: event.begin_time || event.begin_date,
        endDate: event.end_time,
        organizer: {
            name: event.venue.title,
        },
    };
}