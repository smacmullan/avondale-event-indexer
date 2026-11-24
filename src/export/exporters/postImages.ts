import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type MarkdownIt from 'markdown-it';
import type { Exporter } from '../exporter.ts';

const optionsSchema = z.object({
    /** Markdown file to render. Default: <outputDir>/eventList.md (the file you hand-edit before posting). */
    input: z.string().min(1).optional(),
    /** Directory for the images. Default: <outputDir>/posts */
    dir: z.string().min(1).optional(),
    /** Image size in pixels. Default 1080x1350 (Instagram portrait). */
    viewport: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
    }).default({ width: 1080, height: 1350 }),
    /** On demand by default: it renders your edited eventList.md, so it only runs when named with --export postImages. */
    onDemand: z.boolean().default(true),
}).strict();

export type PostImagesOptions = z.input<typeof optionsSchema>;

const IMAGE_NAME = /^event_post_image_\d+\.png$/;

/**
 * Renders one image per day from the markdown event list. It reads the markdown file, not the
 * events, so manual edits to the list (shortened names, removed events) show up in the images.
 */
export function postImages(rawOptions: PostImagesOptions = {}): Exporter {
    const options = optionsSchema.parse(rawOptions);

    return {
        name: 'postImages',
        onDemand: options.onDemand,
        needsEvents: false,
        async export(_events, ctx) {
            const input = options.input ?? path.join(ctx.outputDir, 'eventList.md');
            const dir = options.dir ?? path.join(ctx.outputDir, 'posts');

            if (!fs.existsSync(input))
                throw new Error(`"${input}" is not present. Run the eventListMarkdown export first.`);

            // markdown-it and puppeteer are only loaded when this exporter actually runs
            const MarkdownItClass = (await import('markdown-it')).default;
            const dayHtml = splitMarkdownIntoDayHtml(fs.readFileSync(input, 'utf-8'), new MarkdownItClass());
            if (dayHtml.length === 0)
                return { fileNames: [], warnings: [`No "##" day headings found in "${input}"`] };

            // Render everything first, so a failure doesn't leave you without your previous images
            const images = await renderImages(dayHtml, options.viewport);

            // create directory if it doesn't exist
            fs.mkdirSync(dir, { recursive: true });
            // remove existing image files
            for (const file of fs.readdirSync(dir).filter(name => IMAGE_NAME.test(name)))
                fs.unlinkSync(path.join(dir, file));

            // make renders into new images files, storing file names
            const fileNames = images.map((image, index) => {
                const fileName = path.join(dir, `event_post_image_${index + 1}.png`);
                fs.writeFileSync(fileName, image);
                return fileName;
            });
            return { fileNames };
        },
    };
}

type MarkdownItInstance = InstanceType<typeof MarkdownIt>;
type Token = ReturnType<MarkdownItInstance['parse']>[number];

/**
 * Splits the markdown into one HTML chunk per day: each "##" heading plus the bullet list
 * directly after it, so a day is never split across images.
 */
export function splitMarkdownIntoDayHtml(markdown: string, md: MarkdownItInstance): string[] {
    const tokens = md.parse(markdown, {});
    const days: Token[][] = [];

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== 'heading_open' || tokens[i].tag !== 'h2')
            continue;

        const day: Token[] = tokens.slice(i, i + 3);   // heading_open, inline, heading_close
        i += 2;

        if (tokens[i + 1]?.type === 'bullet_list_open') {
            const level = tokens[i + 1].level;
            let end = i + 1;
            while (end < tokens.length && !(tokens[end].type === 'bullet_list_close' && tokens[end].level === level))
                end++;
            day.push(...tokens.slice(i + 1, end + 1));
            i = end;
        }
        days.push(day);
    }

    return days.map(day => md.renderer.render(day, md.options, {}));
}

async function renderImages(dayHtml: string[], viewport: { width: number; height: number }): Promise<Uint8Array[]> {
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setViewport(viewport);

        const images: Uint8Array[] = [];
        for (const html of dayHtml) {
            await page.setContent(wrapHtmlInStyle(html));
            images.push(await page.screenshot({ type: 'png' }));
        }
        return images;
    } finally {
        await browser.close();
    }
}

export function wrapHtmlInStyle(htmlContent: string) {
    return `
            <html>
                <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap');

                    body {
                        padding: 6%;
                        background-color: #ffffff;
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
                ${htmlContent}
                </body>
            </html>
            `;

}
