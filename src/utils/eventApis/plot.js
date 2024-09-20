
export async function fetchPlotEvents(org, endSearchDate) {
    try {
        // put dates into YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const endDate = endSearchDate.toISOString().split('T')[0];

        let apiString = `https://${org.api}/api/plot/v1/listings?currentpage=1&notLoaded=false&listingsPerPage=48&from=${today}&to=${endDate}&_locale=user`;
        let response = await fetch(apiString);
        let plotEvents = await response.json()
        return plotEvents.map(standardizePlotEvent);
    } catch (error) {
        console.error(`Error fetching calendar events for ${org.name}.`, error);
        return [];
    }
}

function standardizePlotEvent(event) {
    const { title, dateTime, venue } = event;


    return {
        name: title,
        startDate: parseDateFromPlotDateTime(dateTime).toISOString(),
        organizer: {
            name: venue,
        },
    };
}

function parseDateFromPlotDateTime(dateTime) {
    // Extract the components of the dateTime string using regex
    const [_, month, day, time, meridian] = dateTime.match(/\w{3}, (\w{3}) (\d{1,2}) (\d{1,2}:\d{2})(AM|PM)/);
    // Map the month abbreviation to the corresponding numeric value
    const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    // Parse the hour and minute from the time string
    let [hours, minutes] = time.split(':').map(Number);
    // Convert the 12-hour format to 24-hour format based on AM/PM
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    // Calculate the year (not provided in parsed information)
    const today = new Date();
    let year;
    if (month < today.getMonth())
        year = today.getFullYear() + 1; // next year
    else
        year = today.getFullYear(); // this year


    // Create a Date object with the parsed information
    const date = new Date(year, monthMap[month], day, hours, minutes, 0)
    return date;
}