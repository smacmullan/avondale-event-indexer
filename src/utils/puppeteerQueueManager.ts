import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';

// Note: there's some weird behavior here where the queue would keep a Node process open.
// This has been addressed by unreffing the Puppeteer processes and websockets at browser start and close.

class PuppeteerQueueManager {
    private static instance: PuppeteerQueueManager;
    private browserPromise: Promise<Browser> | null = null;
    private activePages = 0;
    private readonly maxConcurrentPages: number;
    private readonly pageTimeout: number;
    private readonly idleTimeout: number;
    private idleTimer: NodeJS.Timeout | null = null;
    private queue: Array<{
        task: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    }> = [];

    private constructor(maxConcurrentPages = 20, pageTimeoutMs = 15000, idleTimeoutMs = 1000) {
        this.maxConcurrentPages = maxConcurrentPages;
        this.pageTimeout = pageTimeoutMs;
        this.idleTimeout = idleTimeoutMs;
    }

    static getInstance(maxConcurrentPages?: number, pageTimeoutMs?: number, idleTimeoutMs?: number): PuppeteerQueueManager {
        if (!PuppeteerQueueManager.instance) {
            PuppeteerQueueManager.instance = new PuppeteerQueueManager(maxConcurrentPages, pageTimeoutMs, idleTimeoutMs);
        }
        return PuppeteerQueueManager.instance;
    }

    async getBrowser(): Promise<Browser> {
        if (!this.browserPromise) {
            this.browserPromise = puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ]
            }).catch(err => {
                this.browserPromise = null; // allow retry on failure
                throw err;
            });
        }
        return this.browserPromise;
    }

    async closeBrowser(): Promise<void> {
        if (this.activePages > 0) {
            console.warn("Active pages still present, ignoring Puppeteer close request.")
            return;
        }

        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.browserPromise) {
            const promise = this.browserPromise;
            this.browserPromise = null; // clear first so new requests can re-launch
            try {
                const browser = await promise;
                await browser.close();
            } catch (err) {
                console.warn('Error closing browser:', err);
            }
        }
    }

    async queuePageOperation<T>(task: (page: Page) => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({
                task: async () => {
                    const browser = await this.getBrowser();
                    const page = await browser.newPage();
                    try {
                        await page.setUserAgent({
                            userAgent:
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
                        });
                        await page.setRequestInterception(true);
                        page.on('request', (request) => {
                            const resourceType = request.resourceType();
                            const url = request.url();
                            if (
                                ['image', 'stylesheet', 'font', 'media'].includes(resourceType) ||
                                url.includes('google-analytics') ||
                                url.includes('facebook.com') ||
                                url.includes('doubleclick.net') ||
                                url.includes('ads') ||
                                url.includes('tracking')
                            ) {
                                request.abort('blockedbyclient');
                            } else {
                                request.continue();
                            }
                        });
                        page.setDefaultTimeout(this.pageTimeout);
                        page.setDefaultNavigationTimeout(this.pageTimeout);
                        return await task(page);
                    } finally {
                        await page.close().catch(err => console.warn('Error closing page:', err));
                    }
                },
                resolve,
                reject,
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        while (this.queue.length > 0 && this.activePages < this.maxConcurrentPages) {
            const item = this.queue.shift();
            if (!item) continue;

            this.activePages++;
            item.task()
                .then(item.resolve)
                .catch(item.reject)
                .finally(() => {
                    this.activePages--;
                    if (this.queue.length > 0) {
                        this.processQueue();
                    }
                    if (this.activePages === 0 && this.queue.length === 0) {
                        this.resetIdleTimer();
                    }
                });
        }
    }

    private resetIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        // Unref immediately so this timer can never be the sole thing keeping Node alive.
        this.idleTimer = setTimeout(() => {
            this.closeBrowser().catch(err => console.warn('Error closing browser on idle:', err));
        }, this.idleTimeout);
        this.idleTimer.unref(); // ← must be right after creation, not deferred
    }

    getQueueSize(): number { return this.queue.length; }
    getActivePageCount(): number { return this.activePages; }
}

export default PuppeteerQueueManager;