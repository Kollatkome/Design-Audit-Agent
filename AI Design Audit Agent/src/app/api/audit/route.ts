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
        totalIssues: { type: Type.INTEGER },
        critical: { type: Type.INTEGER },
        high: { type: Type.INTEGER },
        medium: { type: Type.INTEGER },
        low: { type: Type.INTEGER },
      },
      required: ["totalIssues", "critical", "high", "medium", "low"],
    },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          principle: { 
            type: Type.STRING,
            description: "One of: Visual Hierarchy, Contrast (WCAG AA), Spacing, Alignment, Consistency"
          },
          severity: { 
            type: Type.STRING,
            description: "critical, high, medium, or low" 
          },
          confidence: { 
            type: Type.INTEGER,
            description: "0 to 100"
          },
          location: { type: Type.STRING, description: "Exact page location visible in the screenshot" },
          issue: { type: Type.STRING },
          userImpact: { type: Type.STRING },
          recommendation: { type: Type.STRING },
          evidence: { type: Type.STRING, description: "Observable evidence from the image" },
        },
        required: [
          "id", "principle", "severity", "confidence", "location", "issue", 
          "userImpact", "recommendation", "evidence"
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
  imageBase64: string,
  prompt: string,
  retries = 4,
  initialDelay = 1500
) {
  let lastError: unknown = null;
  
  // Extract and detect MIME types dynamically
  const mimeType = getMimeType(imageBase64);
  const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  
  const contents = [
    prompt,
    {
      inlineData: {
        data: cleanImage,
        mimeType: mimeType,
      },
    }
  ];

  // Failover loop through available models
  for (const modelName of MODELS_TO_TRY) {
    let delay = initialDelay;
    console.log(`[Audit API] Attempting Level 1 analysis using model: ${modelName}`);
    
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

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Screenshot image must be provided" },
        { status: 400 }
      );
    }

    const prompt = `
    You are an expert UI/UX Design Auditor.
    Analyze the provided UI screenshot and identify exactly 3 to 5 key design issues.
    Categorize each issue under one of these five core design principles:
    - Visual Hierarchy
    - Contrast (WCAG AA)
    - Spacing
    - Alignment
    - Consistency
    
    For each issue, provide:
    1. location: Precise page area or component.
    2. issue: What is wrong and why it violates design principles.
    3. userImpact: How it affects usability and accessibility.
    4. recommendation: Actionable fix.
    5. evidence: Visual proof (colors, positioning, weights).
    
    Return a structured JSON output conforming to the schema. No hallucinations.
    `;

    let response;
    try {
      response = await generateContentWithRetry(imageBase64, prompt);
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error("[Audit API] All models failed or timed out. Returning structured fallback.", err);
      
      const errorMsg = err?.message || "All Gemini models returned 503 / 429 quota errors.";
      return NextResponse.json({
        summary: {
          totalIssues: 1,
          critical: 0,
          high: 1,
          medium: 0,
          low: 0
        },
        findings: [
          {
            id: "err-1",
            principle: "Consistency",
            severity: "high",
            confidence: 100,
            location: "AI Audit Pipeline",
            issue: "Visual audit API failed all fallback models.",
            userImpact: "The UI screenshot could not be analyzed due to: " + errorMsg,
            recommendation: "Please try again in a few moments or use optimized images to decrease token footprint.",
            evidence: "API request failed all fallback models."
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
        totalIssues: Number(parsedData?.summary?.totalIssues ?? 0),
        critical: Number(parsedData?.summary?.critical ?? 0),
        high: Number(parsedData?.summary?.high ?? 0),
        medium: Number(parsedData?.summary?.medium ?? 0),
        low: Number(parsedData?.summary?.low ?? 0),
      },
      findings: Array.isArray(parsedData?.findings) 
        ? parsedData.findings.map((f: {
            id?: unknown;
            principle?: unknown;
            severity?: unknown;
            confidence?: unknown;
            location?: unknown;
            issue?: unknown;
            userImpact?: unknown;
            recommendation?: unknown;
            evidence?: unknown;
          }, idx: number) => ({
            id: String(f.id || `f-${idx + 1}`),
            principle: String(f.principle || "Layout"),
            severity: String(f.severity || "medium").toLowerCase(),
            confidence: Number(f.confidence ?? 90),
            location: String(f.location || "UI element"),
            issue: String(f.issue || "N/A"),
            userImpact: String(f.userImpact || "N/A"),
            recommendation: String(f.recommendation || "N/A"),
            evidence: String(f.evidence || "N/A")
          }))
        : []
    };

    return NextResponse.json(normalizedData);

  } catch (error: unknown) {
    console.error("API Error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || "Failed to run UI audit." },
      { status: 500 }
    );
  }
}
