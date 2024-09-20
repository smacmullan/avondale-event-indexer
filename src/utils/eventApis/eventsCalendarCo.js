
export async function fetchEventsCalendarCoEvents(org, endSearchDate) {
    try {
        // put dates into Unix timestamp format
        const today = new Date().getTime();
        const endDate = endSearchDate.getTime();

        let apiString = `https://${org.api}&from=${today}&to=${endDate}`;
        let response = await fetch(apiString);
        let data = await response.json();
        return data.events.map(standardizeEventsCalendarCoEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizeEventsCalendarCoEvent(event) {
    const { title, start_time, end_time, location } = event;

    return {
        name: title,
        startDate: start_time,
        endDate: end_time,
        organizer: {
            name: location,
        },
    };
}
