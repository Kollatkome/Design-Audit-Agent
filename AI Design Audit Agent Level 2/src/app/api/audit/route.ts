import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

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
          description: "Overall verdict. Must be exactly one of: Net Improvement, Mixed Changes, Net Regression" 
        },
        totalRegressions: { type: Type.INTEGER },
        totalImprovements: { type: Type.INTEGER },
        totalNeutral: { type: Type.INTEGER },
        accessibilityScore: { type: Type.INTEGER, description: "0 to 100 overall accessibility score" },
        averageConfidence: { type: Type.INTEGER, description: "0 to 100 average confidence score" },
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
      required: ["verdict", "totalRegressions", "totalImprovements", "totalNeutral", "accessibilityScore", "averageConfidence", "severityBreakdown"]
    },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { 
            type: Type.STRING, 
            description: "One of: Visual Hierarchy, Contrast (WCAG AA), Spacing, Alignment, Consistency, Layout" 
          },
          severity: { 
            type: Type.STRING, 
            description: "critical, high, medium, or low" 
          },
          changeType: { 
            type: Type.STRING, 
            description: "regression, improvement, or neutral" 
          },
          location: { type: Type.STRING, description: "Exact element location" },
          beforeValue: { type: Type.STRING, description: "Original design values (e.g. color #3b82f6, size 14px, right-aligned)" },
          afterValue: { type: Type.STRING, description: "Current implementation values (e.g. color #8b5cf6, size 18px, left-aligned)" },
          impact: { type: Type.STRING, description: "UX and user accessibility impact" },
          recommendation: { type: Type.STRING, description: "Actionable fix recommendation" },
          confidence: { type: Type.INTEGER, description: "0-100 rating" },
          measurableEvidence: { type: Type.STRING, description: "Measurable metrics (e.g. spacing decreased by 12px, font size increased, alignment offset)" }
        },
        required: [
          "id", "category", "severity", "changeType", "location", "beforeValue", 
          "afterValue", "impact", "recommendation", "confidence", "measurableEvidence"
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
  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e: unknown) {
    // Try to isolate any JSON block with { }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.substring(start, end + 1));
      } catch {
        // Ignore and throw original error
      }
    }
    throw e;
  }
}

async function generateContentWithRetry(
  baselineBase64: string,
  currentBase64: string,
  prompt: string,
  retries = 4,
  initialDelay = 1500
) {
  let lastError: unknown = null;
  
  // Extract and detect MIME types dynamically
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

  // Failover loop through available models
  for (const modelName of MODELS_TO_TRY) {
    let delay = initialDelay;
    console.log(`[Audit API] Attempting Level 2 analysis using model: ${modelName}`);
    
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
        console.log(`[Audit API] Analysis succeeded using model: ${modelName}`);
        return response; // Success!
      } catch (error: unknown) {
        lastError = error;
        const err = error as { message?: string; status?: number; statusCode?: number };
        const errorMessage = err?.message || "";
        const errorStatus = err?.status || err?.statusCode;
        
        // Retry on 429 (rate limit), 503 (overloaded), and 500 (internal server error)
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
          console.warn(`[Audit API] error (${errorStatus || 'unknown'}) on ${modelName}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        
        console.error(`[Audit API] failed on model ${modelName}:`, errorMessage);
        break; // Try next model in list
      }
    }
  }
  
  throw lastError || new Error("Failed to generate content using all available models");
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const { baselineBase64, currentBase64 } = await req.json();

    if (!baselineBase64 || !currentBase64) {
      return NextResponse.json(
        { error: "Both baseline and current images must be provided" },
        { status: 400 }
      );
    }

    // Level 2 Comparative Prompt
    const prompt = `
    You are an expert UI/UX Design Auditor and Visual Regression Engine.
    Compare the first image (Baseline / original design) with the second image (Current / implementation design).
    Identify differences across visual hierarchy, contrast (WCAG AA), spacing, alignment, typography, and component consistency.
    
    For each change, classify:
    - changeType: "regression" (worsens UX, violates rules), "improvement" (improves accessibility/UX), or "neutral" (just changed but fine).
    
    IMPORTANT RULES:
    - Zero hallucinations: Only report differences that are CLEARLY VISIBLE in the screenshots.
    - Be highly specific about the location.
    - Provide precise measurableEvidence (e.g. hex values, estimated spacing shifts in pixels).
    - Overall verdict: "Net Improvement" if improvements > regressions, "Net Regression" if regressions > improvements, otherwise "Mixed Changes".
    - Strictly follow the JSON schema.
    `;

    let response;
    try {
      response = await generateContentWithRetry(baselineBase64, currentBase64, prompt);
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("[Audit API] All models failed or timed out. Returning structured fallback.", err);
      
      const errorMsg = err?.message || "All Gemini models returned 503 / 429 quota errors.";
      return NextResponse.json({
        summary: {
          verdict: "Mixed Changes",
          totalRegressions: 1,
          totalImprovements: 0,
          totalNeutral: 0,
          accessibilityScore: 50,
          averageConfidence: 100,
          severityBreakdown: {
            critical: 0,
            high: 1,
            medium: 0,
            low: 0
          }
        },
        findings: [
          {
            id: "err-1",
            category: "Consistency",
            severity: "high",
            changeType: "regression",
            location: "AI Regression Pipeline",
            beforeValue: "AI Comparison Completed",
            afterValue: "API Quota Exceeded / Service Unavailable",
            impact: "Visual regression analysis failed due to: " + errorMsg,
            recommendation: "Please try again in a few moments.",
            confidence: 100,
            measurableEvidence: "API request failed all fallback models."
          }
        ]
      });
    }

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response content from Gemini API");
    }

    let parsedData;
    try {
      parsedData = cleanAndParseJson(resultText);
    } catch (e) {
      console.error("[Audit API] JSON Parse failed for text:", resultText, e);
      throw new Error("Failed to parse visual regression response from AI model.");
    }

    // Normalize and validate the parsed data against our schema
    const normalizedData = {
      summary: {
        verdict: String(parsedData?.summary?.verdict || "Mixed Changes"),
        totalRegressions: Number(parsedData?.summary?.totalRegressions ?? 0),
        totalImprovements: Number(parsedData?.summary?.totalImprovements ?? 0),
        totalNeutral: Number(parsedData?.summary?.totalNeutral ?? 0),
        accessibilityScore: Number(parsedData?.summary?.accessibilityScore ?? 85),
        averageConfidence: Number(parsedData?.summary?.averageConfidence ?? 90),
        severityBreakdown: {
          critical: Number(parsedData?.summary?.severityBreakdown?.critical ?? 0),
          high: Number(parsedData?.summary?.severityBreakdown?.high ?? 0),
          medium: Number(parsedData?.summary?.severityBreakdown?.medium ?? 0),
          low: Number(parsedData?.summary?.severityBreakdown?.low ?? 0),
        }
      },
      findings: Array.isArray(parsedData?.findings) 
        ? parsedData.findings.map((f: {
            id?: unknown;
            category?: unknown;
            severity?: unknown;
            changeType?: unknown;
            location?: unknown;
            beforeValue?: unknown;
            afterValue?: unknown;
            impact?: unknown;
            recommendation?: unknown;
            confidence?: unknown;
            measurableEvidence?: unknown;
          }, idx: number) => ({
            id: String(f.id || `f-${idx + 1}`),
            category: String(f.category || "Layout"),
            severity: String(f.severity || "medium").toLowerCase(),
            changeType: String(f.changeType || "neutral").toLowerCase(),
            location: String(f.location || "UI element"),
            beforeValue: String(f.beforeValue || "N/A"),
            afterValue: String(f.afterValue || "N/A"),
            impact: String(f.impact || "N/A"),
            recommendation: String(f.recommendation || "N/A"),
            confidence: Number(f.confidence ?? 90),
            measurableEvidence: String(f.measurableEvidence || "N/A")
          }))
        : []
    };

    return NextResponse.json(normalizedData);

  } catch (error: unknown) {
    console.error("API Error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || "Failed to run visual regression analysis." },
      { status: 500 }
    );
  }
}
