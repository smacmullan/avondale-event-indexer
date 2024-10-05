import fs from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer';

const folderPath = './output/posts';

// Check if the folder exists
if (!fs.existsSync(folderPath)) {
    // Create the folder if it doesn't exist
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Directory ${folderPath} created.`);
} else {
    // If the folder exists, delete all files inside it
    fs.readdirSync(folderPath).forEach(file => {
        const filePath = path.join(folderPath, file);
        if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
        }
    });
    console.log(`Deleted old files in ${folderPath}`);
}

// Convert markdown to HTML using markdown-it
const md = new MarkdownIt();
const markdownContent = fs.readFileSync('./output/eventList.md', 'utf-8');
const htmlContent = md.render(markdownContent);

// Function to generate images from HTML
async function generateImagesFromHTML(htmlContent) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set page size to Instagram post size (1080x1080 pixels)
    await page.setViewport({ width: 1080, height: 1080 });

    // Function to split HTML content into separate pages
    const splitHTMLIntoPages = (htmlContent, pageHeight) => {
        const lines = htmlContent.split('\n'); // Split by lines or elements
        let currentHeight = 0;
        let currentChunk = '';
        const chunks = [];

        lines.forEach((line) => {
            currentHeight += 40; // Estimate height for each line or adjust based on your styling
            if (currentHeight > pageHeight) {
                chunks.push(currentChunk);
                currentChunk = '';
                currentHeight = 40; // Reset height for new page
            }
            currentChunk += line + '\n';
        });

        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    };

    // Split the HTML content to fit into multiple images if necessary
    const htmlChunks = splitHTMLIntoPages(htmlContent, 1000);

    // Loop through each chunk and generate an image
    for (let i = 0; i < htmlChunks.length; i++) {
        const htmlChunk = htmlChunks[i];

        // Set the page content to the chunk of HTML
        await page.setContent(`
            <html>
                <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap');

                    body {
                        padding: 6%;
                        font-family: 'Noto Sans', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                        line-height: 1.5;
                    }


                    h1 {
                        font-size: 2.75em;
                    }

                    h2 {
                        font-size: 2.25em;
                        padding: 40px 0 3px 0;
                        border-bottom: 2px solid #dddddd;
                    }

                    h2:first-of-type {
                        padding-top: 0;
                    }

                    p {
                        margin: 0.25em 0;
                    }

                    ul,
                    ol {
                        font-size: 1.5em;
                        list-style-type: none;
                        padding-left: 15px;
                    }

                    li {
                        display: flex;
                        align-items: flex-start;
                        margin-bottom: 1em;
                    }

                    li strong {
                        min-width: 160px;
                        padding-right: 30px;
                        text-align: right;
                        vertical-align: top; 
                    }
                </style>
                </head>
                <body class="markdown-body">
                ${htmlChunk}
                </body>
            </html>
            `);

        // Take a screenshot of the rendered content
        await page.screenshot({ path: `${folderPath}/event_post_image_${i + 1}.png` });
    }

    // Close the browser
    await browser.close();
};

// Generate images from the HTML content
generateImagesFromHTML(htmlContent)
    .then(() => {
        console.log('Event images generated successfully!');
    })
    .catch((err) => {
        console.error('Error generating event images:', err);
    });
