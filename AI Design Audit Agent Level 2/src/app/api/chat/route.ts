import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const { messages, results } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Chat history messages must be provided" },
        { status: 400 }
      );
    }

    // System instruction to restrict response to the visual regression audit context
    const systemInstruction = `
    You are a senior UI/UX Design Copilot.
    You are assisting a designer/developer in reviewing a visual regression and design audit report.
    
    Here is the exact visual regression data for the current design:
    ${JSON.stringify(results || {}, null, 2)}
    
    INSTRUCTIONS:
    1. Answer the user's questions strictly using the audit findings, locations, severity ratings, before vs after values, and recommendations provided in the context.
    2. If the user asks about something not visible or not detailed in the findings (e.g. general design questions or things not in the screenshots), state clearly that you can only answer questions related to the specific visual regression audit.
    3. Keep answers highly actionable, brief, and code/design focused (referencing CSS/Tailwind details where mentioned in the recommendations).
    4. Never hallucinate details that are not in the audit report.
    `;

    // Map conversation messages to Gemini contents structure
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    // Add the system instruction context as a user message at the very beginning,
    // or pass it in systemInstruction configuration if supported.
    // To ensure full compatibility across all Gemini SDK versions, we pass it as a systemInstruction parameter.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    const replyText = response.text || "I was unable to process your request.";

    return NextResponse.json({ reply: replyText });

  } catch (error: unknown) {
    console.error("Chat API Error:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || "Failed to communicate with Design Copilot API." },
      { status: 500 }
    );
  }
}
