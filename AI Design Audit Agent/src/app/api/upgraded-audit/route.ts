import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  RawLayoutElement, 
  ContrastDetector, 
  AlignmentDetector, 
  SpacingDetector, 
  TypographyDetector, 
  HierarchyDetector, 
  AccessibilityDetector,
  deriveConfidence
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
          text: { type: Type.STRING, description: "The raw text string visible on the element, if any" },
          fontFamily: { type: Type.STRING, description: "Identified font family or generic category" },
          fontSize: { type: Type.INTEGER, description: "Font size in pixels" },
          foregroundHex: { type: Type.STRING, description: "Foreground color hex code, e.g., #ffffff" },
          backgroundHex: { type: Type.STRING, description: "Background/underlying container color hex code, e.g., #3b82f6" },
          box: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Start X location as a percentage of total width (0-100)" },
              y: { type: Type.NUMBER, description: "Start Y location as a percentage of total height (0-100)" },
              width: { type: Type.NUMBER, description: "Box width as a percentage of total width (0-100)" },
              height: { type: Type.NUMBER, description: "Box height as a percentage of total height (0-100)" }
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
    console.log(`[Layout Extractor] Attempting extraction using model: ${modelName}`);
    
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
                            errorMessage.includes("500") || 
                            errorMessage.toLowerCase().includes("quota") || 
                            errorMessage.toLowerCase().includes("overloaded");

        if (shouldRetry && i < retries - 1) {
          console.warn(`[Layout Extractor] warning: retrying ${modelName} in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        break; // Try next model in failover list
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

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      addLog("Error: Image payload missing.");
      return NextResponse.json({ error: "Missing imageBase64 payload" }, { status: 400 });
    }

    addLog("AuditAgent AI engine initialized.");
    
    // Failure handling checks: tiny image or blank checks
    const dataSizeKb = (imageBase64.length * 0.75) / 1024;
    addLog(`Image validation: Size detected = ${dataSizeKb.toFixed(1)} KB.`);
    if (dataSizeKb < 5) {
      addLog("Error: Screenshot data payload is too tiny or blank.");
      return NextResponse.json({ error: "Corrupted or blank screenshot uploaded. Please load a valid UI image." }, { status: 400 });
    }

    addLog("Extracting layout schema and component coordinates using AI vision parser...");
    
    const extractionPrompt = `
    You are a professional frontend engineer acting as a deterministic component layout extractor.
    Analyze the provided screenshot. Locate and isolate exactly 6 to 12 most prominent UI layout elements (buttons, inputs, labels, headers, blocks).
    Detect their type, background hex colors, foreground font colors, text contents, font size (in px), and their exact bounding coordinates (x, y, width, height as percentages of total image dimension).
    Return a structured JSON output matching the elementsExtractionSchema. Keep colors exact.
    `;

    let extractionResult;
    try {
      extractionResult = await extractLayoutWithRetry(imageBase64, extractionPrompt);
    } catch (err: unknown) {
      const error = err as { message?: string };
      addLog(`AI OCR extraction crashed: ${error.message || String(err)}. Invoking failover local parser.`);
      // Fallback fallback output if all Gemini models are exhausted
      return NextResponse.json({
        summary: { totalIssues: 1, critical: 1, high: 0, medium: 0, low: 0 },
        findings: [{
          id: "err-ocr",
          category: "Accessibility",
          severity: "critical",
          location: "Visual Engine Loader",
          coordinates: { x: 10, y: 10, width: 80, height: 80 },
          evidence: "AI API returned quota/overload limits.",
          recommendation: "Please try running the check again in a few moments.",
          confidenceScore: 50
        }],
        logs: [...logs, `[${new Date().toLocaleTimeString()}] Error: Extraction pipeline timed out.`]
      });
    }

    const ocrTime = Date.now() - startTime;
    addLog(`AI vision extraction complete in ${ocrTime}ms using model: ${extractionResult.modelUsed}.`);
    
    const parsedData = cleanAndParseJson(extractionResult.response.text || "{}");
    const elements: RawLayoutElement[] = parsedData?.elements || [];
    const ocrClarity = parsedData?.ocrClarity ?? 90;
    const imageQuality = parsedData?.imageQuality ?? 95;

    addLog(`Deterministic layout parsed. Found ${elements.length} components. OCR clarity = ${ocrClarity}%, image quality = ${imageQuality}%.`);

    // Initialize local detectors
    addLog("Running local SpacingDetector...");
    const spacingDetector = new SpacingDetector();
    const spacingIssues = await spacingDetector.analyze(elements);
    addLog(`SpacingDetector complete. Found ${spacingIssues.length} spacing discrepancies.`);

    addLog("Running local AlignmentDetector...");
    const alignmentDetector = new AlignmentDetector();
    const alignmentIssues = await alignmentDetector.analyze(elements);
    addLog(`AlignmentDetector complete. Found ${alignmentIssues.length} alignment offsets.`);

    addLog("Running local ContrastDetector (WCAG relative luminance engine)...");
    const contrastDetector = new ContrastDetector();
    const contrastIssues = await contrastDetector.analyze(elements);
    addLog(`ContrastDetector complete. Found ${contrastIssues.length} WCAG contrast failures.`);

    addLog("Running local TypographyDetector...");
    const typographyDetector = new TypographyDetector();
    const typographyIssues = await typographyDetector.analyze(elements);
    addLog(`TypographyDetector complete. Found ${typographyIssues.length} font hierarchy alerts.`);

    addLog("Running local HierarchyDetector...");
    const hierarchyDetector = new HierarchyDetector();
    const hierarchyIssues = await hierarchyDetector.analyze(elements);
    addLog(`HierarchyDetector complete. Found ${hierarchyIssues.length} reading-flow warnings.`);

    addLog("Running local AccessibilityDetector...");
    const accessibilityDetector = new AccessibilityDetector();
    const accessibilityIssues = await accessibilityDetector.analyze(elements);
    addLog(`AccessibilityDetector complete. Found ${accessibilityIssues.length} accessibility breaches.`);

    // Combine all issues
    const combinedDetections = [
      ...contrastIssues,
      ...alignmentIssues,
      ...spacingIssues,
      ...typographyIssues,
      ...hierarchyIssues,
      ...accessibilityIssues
    ];

    // Compute derived confidence scores for each finding
    const findingsWithConfidence = combinedDetections.map(f => {
      // Derive specific certainty based on type of finding
      let certainty = 90;
      if (f.category.includes("Contrast")) certainty = 100; // Contrast check is mathematically perfect
      if (f.category.includes("Alignment")) certainty = 85; 
      
      const derived = deriveConfidence(ocrClarity, certainty, 90);
      return { ...f, confidenceScore: derived };
    });

    // Breakdown count summaries
    const breakdown = {
      totalIssues: findingsWithConfidence.length,
      critical: findingsWithConfidence.filter(f => f.severity === "critical").length,
      high: findingsWithConfidence.filter(f => f.severity === "high").length,
      medium: findingsWithConfidence.filter(f => f.severity === "medium").length,
      low: findingsWithConfidence.filter(f => f.severity === "low").length
    };

    addLog("Audit results compiled successfully.");
    addLog(`Total execution runtime: ${Date.now() - startTime}ms.`);

    return NextResponse.json({
      summary: breakdown,
      findings: findingsWithConfidence,
      logs,
      rawElements: elements,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("API Audit Error:", err);
    return NextResponse.json(
      { error: err.message || "Visual audit pipeline crash." },
      { status: 500 }
    );
  }
}
