import { chromium, Page } from "playwright";
import fs from "fs/promises";
import path from "path";
import { PlaywrightCrawlConfig, CrawlPageResult } from "@/types";

const STORE_DIR = path.join(process.cwd(), "public", "baseline-store");
const METADATA_PATH = path.join(STORE_DIR, "metadata.json");

// Ensure the store directory exists
async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

// Read current metadata or return empty
export async function readMetadata() {
  await ensureStoreDir();
  try {
    const data = await fs.readFile(METADATA_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return { baselines: {} };
  }
}

// Write metadata
export async function writeMetadata(metadata: unknown) {
  await ensureStoreDir();
  await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), "utf-8");
}

// Generate a clean slug from a URL
export function getSlug(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const pathname = url.pathname.replace(/^\/|\/$/g, "");
    if (!pathname) return "home";
    return pathname.replace(/[^a-zA-Z0-9-]/g, "_");
  } catch {
    return "url_" + Math.random().toString(36).substring(7);
  }
}

// Helper to remove noise from the page before taking screenshot
async function applyNoiseFilters(page: Page, customFilters: string[] = []) {
  const defaultNoiseFilters = [
    // Spinners & loaders
    "[class*='spinner']", "[id*='spinner']", "[class*='loader']", "[id*='loader']",
    // Ads & promotion banners
    "[class*='ad-']", "[id*='ad-']", "[class*='banner']", "[id*='banner']", "iframe[src*='ads']",
    // Live clocks / timers
    "[class*='clock']", "[id*='clock']", "[class*='timer']", "[id*='timer']",
    // Dynamic badges / counts (optional notification noise)
    "[class*='badge']", "[id*='badge']"
  ];

  const allFilters = Array.from(new Set([...defaultNoiseFilters, ...customFilters]));

  await page.evaluate((selectors) => {
    selectors.forEach(sel => {
      try {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => {
          (el as HTMLElement).style.display = "none";
        });
      } catch {
        // Ignore invalid selectors
      }
    });
  }, allFilters);
}

// Main crawler function
export async function runCrawler(config: PlaywrightCrawlConfig, onLog: (msg: string) => void): Promise<CrawlPageResult[]> {
  onLog(`Launching Chromium browser headlessly...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const results: CrawlPageResult[] = [];
  const crawledUrls = new Set<string>();
  const queue: string[] = [config.targetUrl];

  try {
    // 1. Perform login if loginUrl is provided
    if (config.loginUrl && config.loginUsername && config.loginPassword) {
      onLog(`Navigating to login URL: ${config.loginUrl}`);
      await page.goto(config.loginUrl, { waitUntil: "networkidle", timeout: 30000 });

      // Scan and identify login inputs autonomously
      onLog("Scanning page for username/email inputs...");
      const userSel = config.usernameSelector || "input[type='email'], input[type='text'], input[name*='user'], input[name*='email'], input[id*='user'], input[id*='email']";
      const passSel = config.passwordSelector || "input[type='password'], input[name*='pass'], input[id*='pass']";
      const submitSel = config.submitSelector || "button[type='submit'], input[type='submit'], button:has-text('Log'), button:has-text('Sign'), button:has-text('Submit')";

      try {
        await page.waitForSelector(userSel, { timeout: 5000 });
        await page.fill(userSel, config.loginUsername);
        onLog("Username/Email input populated.");

        await page.waitForSelector(passSel, { timeout: 5000 });
        await page.fill(passSel, config.loginPassword);
        onLog("Password input populated.");

        onLog("Submitting credentials...");
        const submitBtn = page.locator(submitSel).first();
        await submitBtn.click();
        
        // Wait for redirect/navigation
        onLog("Waiting for redirection after login...");
        await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {
          onLog("Login navigation timed out, continuing anyway.");
        });
      } catch (loginErr: unknown) {
        const error = loginErr as { message?: string };
        onLog(`Autonomous login failed: ${error.message || String(loginErr)}. Continuing as guest.`);
      }
    }

    // 2. Crawl loop
    while (queue.length > 0 && results.length < config.maxPages) {
      const currentUrl = queue.shift()!;
      if (crawledUrls.has(currentUrl)) continue;
      crawledUrls.add(currentUrl);

      onLog(`Crawling [${results.length + 1}/${config.maxPages}]: ${currentUrl}`);
      
      try {
        await page.goto(currentUrl, { waitUntil: "networkidle", timeout: 30000 });
        
        // Wait extra for animations/dynamic chunks
        await page.waitForTimeout(1000);

        // Apply noise filters
        onLog("Applying dynamic noise filters (hiding spinners, ads, clocks)...");
        await applyNoiseFilters(page, config.noiseSelectors);

        // Capture screenshot
        const slug = getSlug(currentUrl);
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const base64 = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;

        results.push({
          url: currentUrl,
          slug,
          screenshotBase64: base64,
          status: "success"
        });

        onLog(`Successfully captured screenshot for ${slug}`);

        // Discover more links if below maxPages
        if (results.length < config.maxPages) {
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a"))
              .map(a => a.href)
              .filter(href => href.startsWith(window.location.origin));
          });

          for (const link of links) {
            // strip hash/query
            try {
              const cleanLink = new URL(link);
              cleanLink.hash = "";
              cleanLink.search = "";
              const finalLink = cleanLink.toString();

              if (!crawledUrls.has(finalLink) && !queue.includes(finalLink)) {
                queue.push(finalLink);
              }
            } catch {
              // ignore malformed URLs
            }
          }
        }
      } catch (pageErr: unknown) {
        const error = pageErr as { message?: string };
        onLog(`Failed to crawl ${currentUrl}: ${error.message || String(pageErr)}`);
        results.push({
          url: currentUrl,
          slug: getSlug(currentUrl),
          screenshotBase64: "",
          status: "failed",
          error: error.message || String(pageErr)
        });
      }
    }

  } finally {
    onLog("Closing browser instance...");
    await browser.close();
  }

  return results;
}
