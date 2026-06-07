import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import { readMetadata } from "@/lib/crawler";

export const maxDuration = 60; // Allow 60 seconds execution

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        verdict: { 
          type: Type.STRING, 
          description: "Must be PASS or FAIL. FAIL if there are any critical regressions, or more than 1 high regression." 
        },
        designHealth: { type: Type.INTEGER, description: "Overall quality score out of 100" },
        averageConfidence: { type: Type.INTEGER, description: "0 to 100" },
        layoutStabilityScore: { type: Type.INTEGER, description: "0 to 100 based on severity and count of layout instability shifts" },
        totalRegressions: { type: Type.INTEGER },
        totalImprovements: { type: Type.INTEGER },
        reasoning: { type: Type.STRING, description: "Summary explaining the release gate verdict" },
        severityBreakdown: {
          type: Type.OBJECT,
          properties: {
            critical: { type: Type.INTEGER },
            high: { type: Type.INTEGER },
            medium: { type: Type.INTEGER },
            low: { type: Type.INTEGER },
          },
          required: ["critical", "high", "medium", "low"]
        }
      },
      required: [
        "verdict", "designHealth", "averageConfidence", "layoutStabilityScore", 
        "totalRegressions", "totalImprovements", "reasoning", "severityBreakdown"
      ],
    },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { 
            type: Type.STRING,
            description: "One of: Layout Instability, Visual Regression, Accessibility Regression, Consistency, Functional Drift"
          },
          severity: { 
            type: Type.STRING,
            description: "critical, high, medium, or low" 
          },
          changeType: {
            type: Type.STRING,
            description: "regression, improvement, or neutral"
          },
          location: { type: Type.STRING, description: "Exact page selector, element, or bounding description" },
          beforeState: { type: Type.STRING, description: "What it looked like in the baseline mockup" },
          afterState: { type: Type.STRING, description: "What it looks like in the current implementation" },
          impact: {
            type: Type.STRING,
            description: "One of: cosmetic, usability, conversion-risk, or accessibility-critical"
          },
          measurableEvidence: { type: Type.STRING, description: "Observable evidence, e.g. '32px offset shift' or 'Contrast drops to 2.4:1'" },
          recommendation: { type: Type.STRING, description: "Actionable styling/code recommendations to resolve the issue" },
          confidenceScore: { type: Type.INTEGER, description: "0 to 100" }
        },
        required: [
          "id", "category", "severity", "changeType", "location", "beforeState", 
          "afterState", "impact", "measurableEvidence", "recommendation", "confidenceScore"
        ],
      },
    },
  },
  required: ["summary", "findings"],
};

const MODELS_TO_TRY = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest'
];

function getMimeType(base64String: string): string {
  const match = base64String.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : "image/png";
}

function cleanAndParseJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e: unknown) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.substring(start, end + 1));
      } catch {
        // ignore
      }
    }
    throw e;
  }
}

async function runRegressionComparison(
  baselineBase64: string,
  currentBase64: string,
  prompt: string,
  retries = 4,
  initialDelay = 1500
) {
  let lastError: unknown = null;
  
  const baselineMime = getMimeType(baselineBase64);
  const cleanBaseline = baselineBase64.replace(/^data:image\/\w+;base64,/, "");

  const currentMime = getMimeType(currentBase64);
  const cleanCurrent = currentBase64.replace(/^data:image\/\w+;base64,/, "");
  
  const contents = [
    prompt,
    {
      inlineData: {
        data: cleanBaseline,
        mimeType: baselineMime,
      },
    },
    {
      inlineData: {
        data: cleanCurrent,
        mimeType: currentMime,
      },
    }
  ];

  for (const modelName of MODELS_TO_TRY) {
    let delay = initialDelay;
    console.log(`[Watchdog API] Attempting comparison using model: ${modelName}`);
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1,
          },
        });
        console.log(`[Watchdog API] Comparison succeeded using model: ${modelName}`);
        return response;
      } catch (error: unknown) {
        lastError = error;
        const err = error as { message?: string; status?: number; statusCode?: number };
        const errorMessage = err?.message || "";
        const errorStatus = err?.status || err?.statusCode;
        
        const shouldRetry = errorStatus === 429 || 
                            errorStatus === 503 || 
                            errorStatus === 500 || 
                            errorMessage.includes("429") || 
                            errorMessage.includes("503") || 
                            errorMessage.includes("500") || 
                            errorMessage.toLowerCase().includes("quota") || 
                            errorMessage.toLowerCase().includes("overloaded") || 
                            errorMessage.toLowerCase().includes("demand");

        if (shouldRetry && i < retries - 1) {
          console.warn(`[Watchdog API] error (${errorStatus || 'unknown'}) on ${modelName}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        
        console.error(`[Watchdog API] failed on model ${modelName}:`, errorMessage);
        break; 
      }
    }
  }
  
  throw lastError || new Error("Failed to compare screenshots using all available models");
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const { slug, baselineBase64, currentBase64 } = await req.json();

    let finalBaselineBase64 = baselineBase64;
    let finalCurrentBase64 = currentBase64;
    let baselineTimestamp = "";
    let crawlTimestamp = "";

    // 1. If slug is provided, load the image files from baseline store
    if (slug) {
      const metadata = await readMetadata();
      const baselineInfo = metadata.baselines[slug];
      if (!baselineInfo) {
        return NextResponse.json({ error: `No baseline configurations found for page slug: ${slug}` }, { status: 404 });
      }

      if (!baselineInfo.current) {
        return NextResponse.json({ error: `No active runs found to compare for page slug: ${slug}` }, { status: 400 });
      }

      const storeDir = path.join(process.cwd(), "public", "baseline-store");
      const approvedVer = baselineInfo.approvedVersion;

      const baselineFilePath = path.join(storeDir, `${slug}-${approvedVer}.png`);
      const currentFilePath = path.join(storeDir, `${slug}-current.png`);

      try {
        const baselineBuffer = await fs.readFile(baselineFilePath);
        finalBaselineBase64 = `data:image/png;base64,${baselineBuffer.toString("base64")}`;
        baselineTimestamp = baselineInfo.versions.find((v: { versionId: string; timestamp: string }) => v.versionId === approvedVer)?.timestamp || "";

        const currentBuffer = await fs.readFile(currentFilePath);
        finalCurrentBase64 = `data:image/png;base64,${currentBuffer.toString("base64")}`;
        crawlTimestamp = baselineInfo.current.timestamp || "";
      } catch (fileErr: unknown) {
        const err = fileErr as { message?: string };
        return NextResponse.json({ error: `Failed to read snapshot files: ${err.message || String(fileErr)}` }, { status: 500 });
      }
    }

    if (!finalBaselineBase64 || !finalCurrentBase64) {
      return NextResponse.json(
        { error: "Both baseline and current screenshots must be provided (either by slug or direct base64 strings)" },
        { status: 400 }
      );
    }

    const prompt = `
    You are an expert AI QA Automation Watchdog and visual regression engine.
    You are analyzing two images representing the visual progression of a web application page:
    - Image 1 (First inline image): Approved BASELINE mockup design or baseline release.
    - Image 2 (Second inline image): CURRENT developed implementation or active deployment run.

    Your task is to:
    1. Compare the Baseline (Image 1) with the Current (Image 2) screenshot.
    2. Identify layout drift shifts (Layout Instability), alignment errors, spacing alterations (Visual Regressions), contrast issues, or accessibility faults.
    3. Categorize each finding into one of: Layout Instability, Visual Regression, Accessibility Regression, Consistency, Functional Drift.
    4. Assess severity (critical, high, medium, low). A regression is CRITICAL if it is a major layout break, a HIGH regression is a noticeabe shift or contrast violation.
    5. Categorize impact as: cosmetic, usability, conversion-risk, or accessibility-critical.
    6. Provide measurable evidence (e.g. "shifted 24px downward", "button text wrapping is broken").
    7. Provide exact recommendation and code modifications (CSS or Tailwind properties) to restore parity.
    8. Decide a Release Gate verdict (PASS or FAIL):
       - If there are ANY critical regressions, the verdict must be FAIL.
       - If there is more than 1 high severity regression, the verdict must be FAIL.
       - Otherwise, the verdict is PASS.
    9. Calculate:
       - designHealth: overall UI layout quality score (0 to 100)
       - layoutStabilityScore: 0 to 100, where 100 represents no layout shifts, dropping based on shift count and severity.

    Analyze thoroughly and provide a structured JSON matching the schema with zero hallucinations.
    `;

    let response;
    try {
      response = await runRegressionComparison(finalBaselineBase64, finalCurrentBase64, prompt);
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("[Watchdog API] Comparison model execution failed. Returning structured fallback.", err);
      
      return NextResponse.json({
        summary: {
          verdict: "FAIL",
          designHealth: 50,
          averageConfidence: 100,
          layoutStabilityScore: 50,
          totalRegressions: 1,
          totalImprovements: 0,
          reasoning: "Visual regression watchdog API failed all fallback models: " + (err?.message || "Unknown API error"),
          severityBreakdown: { critical: 1, high: 0, medium: 0, low: 0 }
        },
        findings: [
          {
            id: "err-1",
            category: "Consistency",
            severity: "critical",
            changeType: "regression",
            location: "AI Watchdog Pipeline",
            beforeState: "Successful comparative API run",
            afterState: "API error limit / timeout",
            impact: "accessibility-critical",
            measurableEvidence: "API connection error",
            recommendation: "Verify GEMINI_API_KEY quota, minimize screenshot size, or try again.",
            confidenceScore: 100
          }
        ],
        pageUrl: slug ? "Store database" : "Direct file upload",
        pageSlug: slug || "direct-upload"
      });
    }

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response contents from Gemini API");
    }

    let parsedData;
    try {
      parsedData = cleanAndParseJson(resultText);
    } catch (e) {
      console.error("[Watchdog API] JSON Parse failed for text:", resultText, e);
      throw new Error("Failed to parse visual regression response from AI model.");
    }

    // Normalize and validate response data
    const normalizedData = {
      summary: {
        verdict: String(parsedData?.summary?.verdict || "PASS").toUpperCase() === "FAIL" ? "FAIL" as const : "PASS" as const,
        designHealth: Math.min(100, Math.max(0, Number(parsedData?.summary?.designHealth ?? 90))),
        averageConfidence: Math.min(100, Math.max(0, Number(parsedData?.summary?.averageConfidence ?? 90))),
        layoutStabilityScore: Math.min(100, Math.max(0, Number(parsedData?.summary?.layoutStabilityScore ?? 90))),
        totalRegressions: Number(parsedData?.summary?.totalRegressions ?? 0),
        totalImprovements: Number(parsedData?.summary?.totalImprovements ?? 0),
        reasoning: String(parsedData?.summary?.reasoning || "Audit complete."),
        severityBreakdown: {
          critical: Number(parsedData?.summary?.severityBreakdown?.critical ?? 0),
          high: Number(parsedData?.summary?.severityBreakdown?.high ?? 0),
          medium: Number(parsedData?.summary?.severityBreakdown?.medium ?? 0),
          low: Number(parsedData?.summary?.severityBreakdown?.low ?? 0),
        }
      },
      findings: Array.isArray(parsedData?.findings)
        ? parsedData.findings.map((f: {
            id?: string;
            category?: string;
            severity?: string;
            changeType?: string;
            location?: string;
            beforeState?: string;
            afterState?: string;
            impact?: string;
            measurableEvidence?: string;
            recommendation?: string;
            confidenceScore?: number;
          }, idx: number) => ({
            id: String(f.id || `f-${idx + 1}`),
            category: String(f.category || "Visual Regression"),
            severity: String(f.severity || "medium").toLowerCase(),
            changeType: String(f.changeType || "regression").toLowerCase(),
            location: String(f.location || "UI element"),
            beforeState: String(f.beforeState || "N/A"),
            afterState: String(f.afterState || "N/A"),
            impact: String(f.impact || "cosmetic").toLowerCase(),
            measurableEvidence: String(f.measurableEvidence || "N/A"),
            recommendation: String(f.recommendation || "N/A"),
            confidenceScore: Math.min(100, Math.max(0, Number(f.confidenceScore ?? 90)))
          }))
        : [],
      pageUrl: slug ? "Store database" : "Direct upload",
      pageSlug: slug || "direct-upload",
      baselineTimestamp,
      crawlTimestamp
    };

    return NextResponse.json(normalizedData);

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to run visual regression watchdog audit." },
      { status: 500 }
    );
  }
}
