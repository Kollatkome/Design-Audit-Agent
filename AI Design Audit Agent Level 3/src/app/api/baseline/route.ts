import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { readMetadata, writeMetadata } from "@/lib/crawler";

export async function GET() {
  try {
    const metadata = await readMetadata();
    return NextResponse.json(metadata);
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json({ error: error.message || "Failed to get baseline data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, slug, versionId } = await req.json();

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const metadata = await readMetadata();
    const storeDir = path.join(process.cwd(), "public", "baseline-store");

    if (action === "approve") {
      if (!slug || !metadata.baselines[slug]) {
        return NextResponse.json({ error: "Valid page slug is required" }, { status: 400 });
      }

      const baselineInfo = metadata.baselines[slug];
      if (!baselineInfo.current) {
        return NextResponse.json({ error: "No current crawl screenshot found to approve" }, { status: 400 });
      }

      // Read current screenshot file
      const currentFilename = `${slug}-current.png`;
      const currentFilePath = path.join(storeDir, currentFilename);

      // Determine next version ID (v1, v2, v3...)
      const versions = baselineInfo.versions || [];
      let nextVerNum = 1;
      if (versions.length > 0) {
        const lastVer = versions[versions.length - 1].versionId;
        const match = lastVer.match(/^v(\d+)$/);
        if (match) {
          nextVerNum = parseInt(match[1]) + 1;
        } else {
          nextVerNum = versions.length + 1;
        }
      }

      const nextVersionId = `v${nextVerNum}`;
      const newBaselineFilename = `${slug}-${nextVersionId}.png`;
      const newBaselineFilePath = path.join(storeDir, newBaselineFilename);

      // Copy current file to the new versioned file path
      await fs.copyFile(currentFilePath, newBaselineFilePath);

      // Update metadata list
      const newVersionEntry = {
        versionId: nextVersionId,
        timestamp: new Date().toISOString(),
        screenshotPath: `/baseline-store/${newBaselineFilename}`,
        status: "approved" as const
      };

      baselineInfo.versions.push(newVersionEntry);
      baselineInfo.approvedVersion = nextVersionId;

      await writeMetadata(metadata);

      return NextResponse.json({
        success: true,
        message: `Approved new baseline version ${nextVersionId} for ${slug}`,
        approvedVersion: nextVersionId,
        baselineScreenshot: `/baseline-store/${slug}-${nextVersionId}.png`
      });
    }

    if (action === "rollback") {
      if (!slug || !metadata.baselines[slug] || !versionId) {
        return NextResponse.json({ error: "Slug and target versionId are required" }, { status: 400 });
      }

      const baselineInfo = metadata.baselines[slug];
      const versionExists = baselineInfo.versions.some((v: { versionId: string }) => v.versionId === versionId);

      if (!versionExists) {
        return NextResponse.json({ error: `Version ${versionId} does not exist for ${slug}` }, { status: 400 });
      }

      baselineInfo.approvedVersion = versionId;
      await writeMetadata(metadata);

      return NextResponse.json({
        success: true,
        message: `Successfully rolled back approved version to ${versionId} for ${slug}`,
        approvedVersion: versionId,
        baselineScreenshot: `/baseline-store/${slug}-${versionId}.png`
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[Baseline API Error]:", err);
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}
