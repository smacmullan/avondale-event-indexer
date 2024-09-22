import * as cheerio from 'cheerio';

// Function to scrape JSON-LD data from all event pages
export async function fetchJsonLdEvents(org, endSearchDate) {

    const eventLinks = await extractEventLinks(org);

    // Concurrently get event data from individual event pages
    let allEventData = [];
    const eventExtractPromises = eventLinks.map(async (link) => {
        // Create a new URL by appending the subdirectory to the original URL
        const fullUrl = new URL(link, org.api).toString();
        try {
            const eventData = await extractJsonLdEvents(fullUrl);
            return eventData;  // Return the extracted data
        } catch (error) {
            console.log(`Error processing ${fullUrl}:`, error);
            return null;
        }
    });
    allEventData = await Promise.all(eventExtractPromises);

    // Filter out any null values and flatten sub-arrays into single array
    allEventData = allEventData.filter(eventData => eventData !== null);
    allEventData = allEventData.flat();

    // Filter out events outside time range
    let today = new Date();
    const filteredEventData = allEventData.filter(event => event.startDate && new Date(event.startDate) > today && new Date(event.startDate) < endSearchDate);

    return filteredEventData.map(event => standardizeJsonLdEvent(event, org));
}


async function extractJsonLdEvents(url) {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const $ = cheerio.load(data);

        let jsonLDData = [];
        $('script[type="application/ld+json"]').each((i, element) => {
            const jsonLD = $(element).html();
            try {
                jsonLDData.push(JSON.parse(jsonLD));
            } catch (error) {
                console.error('Error parsing JSON-LD:', error);
            }
        });

        jsonLDData = jsonLDData.flat();
        const events = jsonLDData.filter(item => item['@type'] == 'Event');
        return events;
    } catch (error) {
        console.error('Error fetching the page:', error);
        return null;
    }
}


async function extractEventLinks(org) {
    try {
        // Get and load the html
        const eventHubPageUrl = org.api;
        const response = await fetch(eventHubPageUrl);
        const data = await response.text();
        const $ = cheerio.load(data);

        // Get all event links on the page
        let baseDir = (new URL(eventHubPageUrl)).pathname;
        let eventLinks = [];
        $('a').each((i, element) => {
            const link = $(element).attr('href');
            if (link) {
                const cleanLink = link.split('?')[0]; //remove query parameters
                if (cleanLink.startsWith(baseDir) || cleanLink.startsWith(eventHubPageUrl) || cleanLink.includes("event"))
                    eventLinks.push(cleanLink);
            }
        });

        // deduplicate event links
        eventLinks = Array.from(new Set(eventLinks));

        // Remove the hub link if it shows up on the page
        eventLinks = eventLinks.filter(link => link !== eventHubPageUrl);

        // Filter out links on block list
        if (org.jsonLdLinkBlockList) {
            eventLinks = eventLinks.filter(link =>
                !org.jsonLdLinkBlockList.some(toRemove => link.endsWith(toRemove))
            );
        }

        return eventLinks;

    } catch (error) {
        console.error(`Error fetching the main event page "${eventHubPageUrl}":`, error);
        return [];
    }
}


function standardizeJsonLdEvent(event, org) {
    const { name, startDate, endDate, location } = event;

    return {
        name,
        startDate,
        endDate,
        organizer: {
            name: location?.name || org.name,
        },
    };
}
