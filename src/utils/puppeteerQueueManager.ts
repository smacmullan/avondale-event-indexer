import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';

// Note: there's some weird behavior here where the queue would keep a Node process open.
// This has been addressed by unreffing the Puppeteer processes and websockets at browser start and close.

class PuppeteerQueueManager {
    private static instance: PuppeteerQueueManager;
    private browser: Browser | null = null;
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

    private constructor(maxConcurrentPages = 20, pageTimeoutMs = 15000, idleTimeoutMs = 5000) {
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
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ]
            });

            const proc = this.browser.process();

            // unref browser processes to avoid keeping scripts open
            if (proc) {
                proc.unref();
                (proc.stdin as any)?.unref();
                (proc.stdout as any)?.unref();
                (proc.stderr as any)?.unref();
                proc.stdio.forEach(stream => (stream as any)?.unref());
            }
        }
        return this.browser;
    }

    async closeBrowser(): Promise<void> {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (err) {
                console.warn('Error closing browser:', err);
            } finally {
                // need to unref websockets or this will keep scripts open
                try {
                    (process as any)._getActiveHandles()
                        .filter((h: any) =>
                            Object.getOwnPropertySymbols(h)
                                .some(s => s.toString() === 'Symbol(websocket)')
                        )
                        .forEach((h: any) => {
                            h.unref();
                        });
                } catch { }
                this.browser = null;
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
                        await page.setUserAgent(
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
                        );
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