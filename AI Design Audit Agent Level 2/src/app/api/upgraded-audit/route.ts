import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  RawLayoutElement, 
  calculateContrastRatio,
  deriveConfidence,
  DetectionResult
} from "@/lib/upgraded/detector-engine";

export const maxDuration = 60; // Allow 60 seconds execution

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

const elementsExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    ocrClarity: { type: Type.INTEGER, description: "Estimated OCR legibility score 0-100" },
    imageQuality: { type: Type.INTEGER, description: "Estimated image resolution/quality score 0-100" },
    elements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, description: "One of: text, button, image, header, input, container" },
          text: { type: Type.STRING },
          fontFamily: { type: Type.STRING },
          fontSize: { type: Type.INTEGER },
          foregroundHex: { type: Type.STRING, description: "Foreground color hex, e.g. #000000" },
          backgroundHex: { type: Type.STRING, description: "Background color hex, e.g. #ffffff" },
          box: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Start X location percentage (0-100)" },
              y: { type: Type.NUMBER, description: "Start Y location percentage (0-100)" },
              width: { type: Type.NUMBER, description: "Width percentage (0-100)" },
              height: { type: Type.NUMBER, description: "Height percentage (0-100)" }
            },
            required: ["x", "y", "width", "height"]
          }
        },
        required: ["id", "type", "box"]
      }
    }
  },
  required: ["ocrClarity", "imageQuality", "elements"]
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

async function extractLayoutWithRetry(
  imageBase64: string,
  prompt: string,
  retries = 4,
  initialDelay = 1500
) {
  let lastError: unknown = null;
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

  for (const modelName of MODELS_TO_TRY) {
    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: elementsExtractionSchema,
            temperature: 0.1,
          },
        });
        return { response, modelUsed: modelName };
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
                            errorMessage.includes("500");

        if (shouldRetry && i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        break;
      }
    }
  }
  
  throw lastError || new Error("Failed to extract layout metadata using all models");
}

export async function POST(req: NextRequest) {
  const logs: string[] = [];
  const startTime = Date.now();

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ms = String(Date.now() - startTime).padStart(4, "0");
    logs.push(`[${timestamp}.${ms}] ${msg}`);
  };

  try {
    if (!process.env.GEMINI_API_KEY) {
      addLog("Error: GEMINI_API_KEY not configured.");
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 500 });
    }

    const { baselineBase64, currentBase64 } = await req.json();

    if (!baselineBase64 || !currentBase64) {
      addLog("Error: Baseline or current images missing.");
      return NextResponse.json({ error: "Missing baselineBase64 or currentBase64 payload" }, { status: 400 });
    }

    addLog("AuditAgent AI comparative engine initialized.");
    
    // Concurrently extract components from both images
    addLog("Extracting components layout from baseline design...");
    addLog("Extracting components layout from current developed UI...");
    
    const prompt = `
    Extract a structured list of prominent component layouts (buttons, headers, input fields, labels, texts) from the screenshot.
    Detect exact colors, sizing, text strings, and bounding box percentages (x, y, width, height).
    Return JSON matching the schema.
    `;

    const [baselineRes, currentRes] = await Promise.all([
      extractLayoutWithRetry(baselineBase64, prompt),
      extractLayoutWithRetry(currentBase64, prompt)
    ]);

    addLog(`Baseline layout extracted successfully using model: ${baselineRes.modelUsed}.`);
    addLog(`Current developed layout extracted successfully using model: ${currentRes.modelUsed}.`);

    const baselineData = cleanAndParseJson(baselineRes.response.text || "{}");
    const currentData = cleanAndParseJson(currentRes.response.text || "{}");

    const baselineElements: RawLayoutElement[] = baselineData.elements || [];
    const currentElements: RawLayoutElement[] = currentData.elements || [];
    const ocrClarity = Math.min(baselineData.ocrClarity ?? 90, currentData.ocrClarity ?? 90);

    addLog(`Comparing baseline (${baselineElements.length} elements) vs current (${currentElements.length} elements) using deterministic diff rules...`);

    const findings: DetectionResult[] = [];

    // Match elements in current with baseline using proximity or matching text
    for (const curEl of currentElements) {
      let matchedBase: RawLayoutElement | null = null;
      let minDistance = 9999;

      for (const baseEl of baselineElements) {
        // Calculate coordinate distance
        const dist = Math.sqrt(Math.pow(curEl.box.x - baseEl.box.x, 2) + Math.pow(curEl.box.y - baseEl.box.y, 2));
        
        // If text matches exactly or coordinates match closely
        if (curEl.text && baseEl.text && curEl.text === baseEl.text) {
          matchedBase = baseEl;
          break;
        } else if (dist < minDistance && dist < 12 && curEl.type === baseEl.type) {
          minDistance = dist;
          matchedBase = baseEl;
        }
      }

      if (matchedBase) {
        // 1. Position Shift Check (Alignment shift)
        const shiftX = curEl.box.x - matchedBase.box.x;
        const shiftY = curEl.box.y - matchedBase.box.y;
        const totalShift = Math.sqrt(Math.pow(shiftX, 2) + Math.pow(shiftY, 2));

        if (totalShift > 1.2) {
          findings.push({
            id: `regression-shift-${curEl.id}`,
            category: "Alignment",
            severity: totalShift > 5.0 ? "high" : "medium",
            location: curEl.text ? `Element: "${curEl.text}"` : `Component (type: ${curEl.type})`,
            coordinates: curEl.box,
            evidence: `Layout shift of total ${totalShift.toFixed(2)}% screen coordinates relative to baseline (x-shift: ${shiftX.toFixed(2)}%, y-shift: ${shiftY.toFixed(2)}%).`,
            recommendation: `Align coordinate axes to match the design mockup coordinates (X: ${matchedBase.box.x.toFixed(1)}%, Y: ${matchedBase.box.y.toFixed(1)}%).`,
            confidenceScore: deriveConfidence(ocrClarity, 85, 90)
          });
        }

        // 2. Contrast Change Check
        if (curEl.foregroundHex && curEl.backgroundHex && matchedBase.foregroundHex && matchedBase.backgroundHex) {
          const baseRatio = calculateContrastRatio(matchedBase.foregroundHex, matchedBase.backgroundHex);
          const curRatio = calculateContrastRatio(curEl.foregroundHex, curEl.backgroundHex);
          
          if (curRatio < baseRatio && curRatio < 4.5) {
            findings.push({
              id: `regression-contrast-${curEl.id}`,
              category: "Contrast (WCAG AA)",
              severity: curRatio < 2.5 ? "critical" : "high",
              location: curEl.text ? `Text element: "${curEl.text}"` : `Component (type: ${curEl.type})`,
              coordinates: curEl.box,
              evidence: `Contrast ratio dropped from ${baseRatio.toFixed(1)}:1 in design to ${curRatio.toFixed(1)}:1 in implementation. Colors: fg=${curEl.foregroundHex}, bg=${curEl.backgroundHex}.`,
              recommendation: `Restore design palette colors to restore WCAG compliant contrast ratio.`,
              confidenceScore: deriveConfidence(ocrClarity, 98, 90)
            });
          }
        }

        // 3. Font Size Change check
        if (curEl.fontSize && matchedBase.fontSize && curEl.fontSize !== matchedBase.fontSize) {
          findings.push({
            id: `regression-font-${curEl.id}`,
            category: "Typography",
            severity: "low",
            location: curEl.text ? `Text: "${curEl.text}"` : `Component typography`,
            coordinates: curEl.box,
            evidence: `Font size changed from ${matchedBase.fontSize}px in mockup to ${curEl.fontSize}px in developed UI.`,
            recommendation: `Update font-size styling rule to match design mockup dimensions exactly.`,
            confidenceScore: deriveConfidence(ocrClarity, 95, 90)
          });
        }
      } else {
        // Element in current does not match any element in baseline (Inconsistency)
        findings.push({
          id: `regression-new-${curEl.id}`,
          category: "Consistency",
          severity: "low",
          location: curEl.text ? `Element: "${curEl.text}"` : `Component (type: ${curEl.type})`,
          coordinates: curEl.box,
          evidence: `Unmatched element detected in current implementation layout. Element does not exist in design mockup.`,
          recommendation: `Verify if this component was intentionally added, or prune if redundant layout.`,
          confidenceScore: deriveConfidence(ocrClarity, 80, 90)
        });
      }
    }

    // Check for elements in baseline missing from current (Consistency regression)
    for (const baseEl of baselineElements) {
      const hasMatch = currentElements.some(curEl => 
        (curEl.text && baseEl.text && curEl.text === baseEl.text) || 
        (Math.sqrt(Math.pow(curEl.box.x - baseEl.box.x, 2) + Math.pow(curEl.box.y - baseEl.box.y, 2)) < 12 && curEl.type === baseEl.type)
      );

      if (!hasMatch) {
        findings.push({
          id: `regression-missing-${baseEl.id}`,
          category: "Consistency",
          severity: "high",
          location: baseEl.text ? `Element: "${baseEl.text}"` : `Component (type: ${baseEl.type})`,
          coordinates: baseEl.box,
          evidence: `Mockup component is completely missing in developed implementation.`,
          recommendation: `Implement missing section layout coordinates (X: ${baseEl.box.x.toFixed(1)}%, Y: ${baseEl.box.y.toFixed(1)}%).`,
          confidenceScore: deriveConfidence(ocrClarity, 85, 90)
        });
      }
    }

    const totalRegressions = findings.length;
    const criticalCount = findings.filter(f => f.severity === "critical").length;
    const highCount = findings.filter(f => f.severity === "high").length;
    const mediumCount = findings.filter(f => f.severity === "medium").length;
    const lowCount = findings.filter(f => f.severity === "low").length;

    addLog(`Comparison finished. Derived ${totalRegressions} regressions/discrepancies.`);
    addLog(`Total execution runtime: ${Date.now() - startTime}ms.`);

    return NextResponse.json({
      summary: {
        totalIssues: totalRegressions,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount
      },
      findings,
      logs,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error("API Audit Error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Comparative regression pipeline crash." },
      { status: 500 }
    );
  }
}
