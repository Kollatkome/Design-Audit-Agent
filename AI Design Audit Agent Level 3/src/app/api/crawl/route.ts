import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { runCrawler, readMetadata, writeMetadata } from "@/lib/crawler";
import { PlaywrightCrawlConfig } from "@/types";

export const maxDuration = 120; // Extended timeout for Playwright crawling

export async function POST(req: NextRequest) {
  try {
    const config: PlaywrightCrawlConfig = await req.json();

    if (!config.targetUrl) {
      return NextResponse.json({ error: "Target URL is required" }, { status: 400 });
    }

    const maxPages = config.maxPages || 3;
    const logs: string[] = [];
    const logCallback = (msg: string) => {
      console.log(`[Crawler API] ${msg}`);
      logs.push(msg);
    };

    // Run the crawler
    logCallback(`Starting autonomous crawl on: ${config.targetUrl}`);
    const crawledPages = await runCrawler({ ...config, maxPages }, logCallback);

    // Read metadata
    const metadata = await readMetadata();
    const storeDir = path.join(process.cwd(), "public", "baseline-store");
    const crawlTimestamp = new Date().toISOString();

    const results = [];

    for (const page of crawledPages) {
      if (page.status === "failed") {
        results.push({
          url: page.url,
          slug: page.slug,
          status: "failed",
          error: page.error
        });
        continue;
      }

      const cleanBase64 = page.screenshotBase64.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      // Save as the current run screenshot
      const currentFilename = `${page.slug}-current.png`;
      const currentPath = path.join(storeDir, currentFilename);
      await fs.writeFile(currentPath, buffer);

      let baselineInfo = metadata.baselines[page.slug];
      let isFirstRun = false;

      if (!baselineInfo) {
        // First time crawling this page. Automatically establish a baseline v1!
        isFirstRun = true;
        const baselineFilename = `${page.slug}-v1.png`;
        const baselinePath = path.join(storeDir, baselineFilename);
        await fs.writeFile(baselinePath, buffer);

        baselineInfo = {
          url: page.url,
          slug: page.slug,
          approvedVersion: "v1",
          versions: [
            {
              versionId: "v1",
              timestamp: crawlTimestamp,
              screenshotPath: `/baseline-store/${baselineFilename}`,
              status: "approved"
            }
          ]
        };

        metadata.baselines[page.slug] = baselineInfo;
        logCallback(`Established initial approved baseline 'v1' for slug: ${page.slug}`);
      }

      // Save current screenshot metadata
      baselineInfo.current = {
        timestamp: crawlTimestamp,
        screenshotPath: `/baseline-store/${currentFilename}`
      };

      results.push({
        url: page.url,
        slug: page.slug,
        status: "success",
        isFirstRun,
        approvedVersion: baselineInfo.approvedVersion,
        baselineScreenshot: `/baseline-store/${page.slug}-${baselineInfo.approvedVersion}.png`,
        currentScreenshot: `/baseline-store/${currentFilename}`
      });
    }

    // Write updated metadata
    await writeMetadata(metadata);

    return NextResponse.json({
      success: true,
      logs,
      results
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[Crawl API Error]:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Crawler execution encountered an error."
    }, { status: 500 });
  }
}
